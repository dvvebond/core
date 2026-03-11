/**
 * PDF.js-based text layer builder.
 *
 * This module provides text layer functionality using PDF.js's text content
 * extraction and positioning. It creates a transparent DOM overlay that enables
 * native browser text selection over rendered PDF pages.
 */

import type {
  PageViewport,
  PDFPageProxy,
  TextContent,
  TextItem,
  TextMarkedContent,
} from "./pdfjs-wrapper";
import { getTextContent, isTextItem } from "./pdfjs-wrapper";

/**
 * Options for building the text layer.
 */
export interface PDFJSTextLayerOptions {
  /**
   * The container element to render the text layer into.
   */
  container: HTMLElement;

  /**
   * The PDF.js viewport for positioning text.
   */
  viewport: PageViewport;

  /**
   * Whether to enhance text readability for screen readers.
   * @default true
   */
  enhanceTextAccessibility?: boolean;
}

/**
 * Result of building the text layer.
 */
export interface PDFJSTextLayerResult {
  /**
   * The number of text divs created.
   */
  divCount: number;

  /**
   * The container element with the text layer.
   */
  container: HTMLElement;

  /**
   * The text content used to build the layer.
   */
  textContent: TextContent;
}

/**
 * Build a text layer from PDF.js text content.
 *
 * Creates transparent div elements positioned over the rendered text,
 * enabling native browser text selection.
 *
 * @param page - The PDF.js page proxy
 * @param options - Configuration options for the text layer
 * @returns The result containing the built text layer
 */
export async function buildPDFJSTextLayer(
  page: PDFPageProxy,
  options: PDFJSTextLayerOptions,
): Promise<PDFJSTextLayerResult> {
  const { container, viewport, enhanceTextAccessibility = true } = options;

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Setup container styles
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.overflow = "hidden";
  container.style.opacity = "1";
  container.style.lineHeight = "1";
  container.style.pointerEvents = "none";

  // Get text content from PDF.js
  const textContent = await getTextContent(page);

  let divCount = 0;

  // Process each text item
  for (const item of textContent.items) {
    if (!isTextItem(item)) {
      // Skip marked content
      continue;
    }

    const textItem = item as TextItem;

    // Skip empty strings
    if (!textItem.str || textItem.str.trim() === "") {
      continue;
    }

    const div = createTextDiv(textItem, viewport, enhanceTextAccessibility);
    container.appendChild(div);
    divCount++;
  }

  return {
    divCount,
    container,
    textContent,
  };
}

/**
 * Create a text div element for a text item.
 */
function createTextDiv(
  item: TextItem,
  viewport: PageViewport,
  enhanceAccessibility: boolean,
): HTMLDivElement {
  const div = document.createElement("div");

  // Set text content
  div.textContent = item.str;

  // Calculate position
  // PDF.js text items have transform property: [scaleX, skewX, skewY, scaleY, x, y]
  const tx = item.transform;
  const angle = Math.atan2(tx[1], tx[0]);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const fontAscent = fontHeight;

  // Convert to viewport coordinates
  const [x, y] = viewport.convertToViewportPoint(tx[4], tx[5]);

  // Apply styles
  div.style.position = "absolute";
  div.style.left = `${x}px`;
  div.style.top = `${y - fontAscent * viewport.scale}px`;
  div.style.fontSize = `${fontHeight * viewport.scale}px`;
  div.style.fontFamily = item.fontName ? mapFontName(item.fontName) : "sans-serif";

  // Apply rotation if needed
  if (angle !== 0) {
    div.style.transform = `rotate(${angle}rad)`;
    div.style.transformOrigin = "left bottom";
  }

  // Make text transparent but selectable
  div.style.color = "transparent";
  div.style.whiteSpace = "nowrap";
  div.style.pointerEvents = "auto";

  // Apply width if available
  if (item.width) {
    div.style.width = `${item.width * viewport.scale}px`;
  }

  // Accessibility enhancements
  if (enhanceAccessibility) {
    div.setAttribute("role", "text");
  }

  return div;
}

/**
 * Map PDF font names to CSS font families.
 */
function mapFontName(fontName: string): string {
  // Remove subset prefix (e.g., "ABCDEF+Arial" -> "Arial")
  const name = fontName.replace(/^[A-Z]{6}\+/, "");

  const fontMap: Record<string, string> = {
    Helvetica: "Helvetica, Arial, sans-serif",
    "Helvetica-Bold": "Helvetica, Arial, sans-serif",
    "Helvetica-Oblique": "Helvetica, Arial, sans-serif",
    "Helvetica-BoldOblique": "Helvetica, Arial, sans-serif",
    "Times-Roman": "'Times New Roman', Times, serif",
    "Times-Bold": "'Times New Roman', Times, serif",
    "Times-Italic": "'Times New Roman', Times, serif",
    "Times-BoldItalic": "'Times New Roman', Times, serif",
    Courier: "'Courier New', Courier, monospace",
    "Courier-Bold": "'Courier New', Courier, monospace",
    "Courier-Oblique": "'Courier New', Courier, monospace",
    "Courier-BoldOblique": "'Courier New', Courier, monospace",
    Symbol: "Symbol, serif",
    ZapfDingbats: "ZapfDingbats, serif",
    Arial: "Arial, Helvetica, sans-serif",
    ArialMT: "Arial, Helvetica, sans-serif",
    "Arial-BoldMT": "Arial, Helvetica, sans-serif",
    "Arial-ItalicMT": "Arial, Helvetica, sans-serif",
  };

  // Check for exact match first
  if (fontMap[name]) {
    return fontMap[name];
  }

  // Check for partial matches
  const lowerName = name.toLowerCase();
  if (lowerName.includes("arial") || lowerName.includes("helvetica")) {
    return "Helvetica, Arial, sans-serif";
  }
  if (lowerName.includes("times")) {
    return "'Times New Roman', Times, serif";
  }
  if (lowerName.includes("courier")) {
    return "'Courier New', Courier, monospace";
  }

  return "sans-serif";
}

/**
 * Class-based text layer builder for more control.
 */
export class PDFJSTextLayerBuilder {
  private readonly _container: HTMLElement;
  private readonly _viewport: PageViewport;
  private readonly _enhanceAccessibility: boolean;

  constructor(options: PDFJSTextLayerOptions) {
    this._container = options.container;
    this._viewport = options.viewport;
    this._enhanceAccessibility = options.enhanceTextAccessibility ?? true;
  }

  /**
   * Build the text layer from a PDF page.
   */
  async build(page: PDFPageProxy): Promise<PDFJSTextLayerResult> {
    return buildPDFJSTextLayer(page, {
      container: this._container,
      viewport: this._viewport,
      enhanceTextAccessibility: this._enhanceAccessibility,
    });
  }

  /**
   * Clear the text layer.
   */
  clear(): void {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  }

  /**
   * Get the container element.
   */
  get container(): HTMLElement {
    return this._container;
  }

  /**
   * Get the viewport.
   */
  get viewport(): PageViewport {
    return this._viewport;
  }
}

/**
 * Create a new text layer builder.
 */
export function createPDFJSTextLayerBuilder(options: PDFJSTextLayerOptions): PDFJSTextLayerBuilder {
  return new PDFJSTextLayerBuilder(options);
}
