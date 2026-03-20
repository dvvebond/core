/**
 * PDF.js-based text layer builder.
 *
 * This module provides text layer functionality using PDF.js's text content
 * extraction and positioning. It creates a transparent DOM overlay that enables
 * native browser text selection over rendered PDF pages.
 *
 * Integration with TextSelectionManager:
 * When using the TextSelectionManager for custom text selection (solving the
 * drag-across-non-text issue), register text layer containers with the manager
 * after building them:
 *
 * @example
 * ```ts
 * const textLayer = await buildPDFJSTextLayer(page, options);
 * selectionManager.registerTextLayer(pageIndex, textLayer.container);
 * ```
 */

import {
  createTextSelectionManager,
  getAttachedTextSelectionManager,
  type TextSelectionManager,
} from "../../frontend/text/text-selection-manager";
import type {
  PageViewport,
  PDFPageProxy,
  TextContent,
  TextItem,
  TextMarkedContent,
} from "./pdfjs-wrapper";
import { getTextContent, isTextItem } from "./pdfjs-wrapper";

const AUTO_SELECTION_ROOT_SELECTOR = "[data-pdf-selection-root], .react-pdf__Document";
const PAGE_NUMBER_SELECTOR = "[data-page-number]";
const autoSelectionManagers = new WeakMap<HTMLElement, TextSelectionManager>();
const trackedAutoSelectionRoots = new Set<HTMLElement>();
let autoSelectionCleanupObserver: MutationObserver | null = null;

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

  /**
   * The page index for this text layer (0-based).
   * Used when integrating with TextSelectionManager.
   */
  pageIndex?: number;

  /**
   * Root container that should own the shared text selection manager.
   *
   * When omitted, the builder will auto-detect common viewer roots such as
   * `.react-pdf__Document`.
   */
  selectionContainer?: HTMLElement;

  /**
   * Whether to automatically connect built text layers to the robust custom
   * text selection manager.
   *
   * @default true
   */
  enableCustomTextSelection?: boolean;
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

  /**
   * Array of text spans with their character offsets for highlighting.
   * Compatible with TextSelectionManager's TextSpanInfo interface.
   */
  textSpans: Array<{
    element: HTMLElement;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;

  /**
   * The page index if provided in options.
   */
  pageIndex?: number;

  /**
   * The full text content of the layer.
   * Useful for text extraction and selection.
   */
  fullText: string;
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
  const {
    container,
    viewport,
    enhanceTextAccessibility = true,
    pageIndex,
    selectionContainer,
    enableCustomTextSelection = true,
  } = options;

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
  let charOffset = 0;
  const textSpans: PDFJSTextLayerResult["textSpans"] = [];

  // Create a reusable measurement element for text width calculations
  const measureSpan = document.createElement("span");
  measureSpan.style.position = "absolute";
  measureSpan.style.visibility = "hidden";
  measureSpan.style.whiteSpace = "pre";
  document.body.appendChild(measureSpan);

  try {
    // Process each text item
    for (const item of textContent.items) {
      if (!isTextItem(item)) {
        // Skip marked content
        continue;
      }

      const textItem = item;

      // Skip empty strings
      if (!textItem.str) {
        continue;
      }

      const span = createTextSpan(textItem, viewport, enhanceTextAccessibility, measureSpan);
      container.appendChild(span);

      // Store span info for highlighting
      textSpans.push({
        element: span,
        text: textItem.str,
        startOffset: charOffset,
        endOffset: charOffset + textItem.str.length,
      });

      charOffset += textItem.str.length;
      divCount++;
    }
  } finally {
    // Clean up measurement element
    document.body.removeChild(measureSpan);
  }

  // Build full text for text extraction/selection
  const fullText = textSpans.map(span => span.text).join("");

  maybeRegisterTextLayerWithSelectionManager({
    textLayerContainer: container,
    pageIndex,
    selectionContainer,
    enableCustomTextSelection,
  });

  return {
    divCount,
    container,
    textContent,
    textSpans,
    pageIndex,
    fullText,
  };
}

/**
 * Create a text span element for a text item.
 */
function createTextSpan(
  item: TextItem,
  viewport: PageViewport,
  enhanceAccessibility: boolean,
  measureSpan: HTMLSpanElement,
): HTMLSpanElement {
  const span = document.createElement("span");

  // Set text content
  span.textContent = item.str;

  // Calculate position
  // PDF.js text items have transform property: [scaleX, skewX, skewY, scaleY, x, y]
  const tx = item.transform;
  const angle = Math.atan2(tx[1], tx[0]);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const fontAscent = fontHeight;

  // Convert to viewport coordinates
  const [x, y] = viewport.convertToViewportPoint(tx[4], tx[5]);

  // Calculate font size in pixels
  const fontSize = fontHeight * viewport.scale;
  const fontFamily = item.fontName ? mapFontName(item.fontName) : "sans-serif";

  // Apply styles
  span.style.position = "absolute";
  span.style.left = `${x}px`;
  span.style.top = `${y - fontAscent * viewport.scale}px`;
  span.style.fontSize = `${fontSize}px`;
  span.style.fontFamily = fontFamily;

  // Make text transparent but selectable
  span.style.color = "transparent";
  span.style.whiteSpace = "pre";
  span.style.pointerEvents = "auto";

  // Calculate horizontal scale to match PDF text width
  // This is critical for accurate text selection alignment
  if (item.width && item.str.length > 0) {
    const targetWidth = item.width * viewport.scale;

    // Measure the actual rendered width using the reusable measurement span
    measureSpan.style.fontSize = `${fontSize}px`;
    measureSpan.style.fontFamily = fontFamily;
    measureSpan.textContent = item.str;

    const actualWidth = measureSpan.getBoundingClientRect().width;

    if (actualWidth > 0) {
      const scaleX = targetWidth / actualWidth;
      // Apply horizontal scaling to stretch text to match PDF width
      if (angle !== 0) {
        span.style.transform = `rotate(${angle}rad) scaleX(${scaleX})`;
      } else {
        span.style.transform = `scaleX(${scaleX})`;
      }
      span.style.transformOrigin = "left top";
    }
  } else if (angle !== 0) {
    // Apply rotation only if no width scaling needed
    span.style.transform = `rotate(${angle}rad)`;
    span.style.transformOrigin = "left bottom";
  }

  // Accessibility enhancements
  if (enhanceAccessibility) {
    span.setAttribute("role", "presentation");
    span.setAttribute("dir", "ltr");
  }

  return span;
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
 *
 * This builder can be integrated with the TextSelectionManager for
 * robust text selection that works across non-text areas:
 *
 * @example
 * ```ts
 * const builder = createPDFJSTextLayerBuilder({
 *   container: textLayerDiv,
 *   viewport: viewport,
 *   pageIndex: 0,
 * });
 *
 * const result = await builder.build(page);
 *
 * // Register with selection manager
 * selectionManager.registerTextLayer(0, result.container);
 * ```
 */
export class PDFJSTextLayerBuilder {
  private readonly _container: HTMLElement;
  private readonly _viewport: PageViewport;
  private readonly _enhanceAccessibility: boolean;
  private readonly _pageIndex?: number;
  private readonly _selectionContainer?: HTMLElement;
  private readonly _enableCustomTextSelection: boolean;
  private _lastResult: PDFJSTextLayerResult | null = null;

  constructor(options: PDFJSTextLayerOptions) {
    this._container = options.container;
    this._viewport = options.viewport;
    this._enhanceAccessibility = options.enhanceTextAccessibility ?? true;
    this._pageIndex = options.pageIndex;
    this._selectionContainer = options.selectionContainer;
    this._enableCustomTextSelection = options.enableCustomTextSelection ?? true;
  }

  /**
   * Build the text layer from a PDF page.
   */
  async build(page: PDFPageProxy): Promise<PDFJSTextLayerResult> {
    this._lastResult = await buildPDFJSTextLayer(page, {
      container: this._container,
      viewport: this._viewport,
      enhanceTextAccessibility: this._enhanceAccessibility,
      pageIndex: this._pageIndex,
      selectionContainer: this._selectionContainer,
      enableCustomTextSelection: this._enableCustomTextSelection,
    });
    return this._lastResult;
  }

  /**
   * Clear the text layer.
   */
  clear(): void {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
    this._lastResult = null;
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

  /**
   * Get the page index.
   */
  get pageIndex(): number | undefined {
    return this._pageIndex;
  }

  /**
   * Get the last build result.
   * Useful for accessing text spans for selection integration.
   */
  get lastResult(): PDFJSTextLayerResult | null {
    return this._lastResult;
  }

  /**
   * Get the full text content from the last build.
   */
  get fullText(): string {
    return this._lastResult?.fullText ?? "";
  }
}

/**
 * Create a new text layer builder.
 */
export function createPDFJSTextLayerBuilder(options: PDFJSTextLayerOptions): PDFJSTextLayerBuilder {
  return new PDFJSTextLayerBuilder(options);
}

interface TextSelectionRegistrationOptions {
  textLayerContainer: HTMLElement;
  pageIndex?: number;
  selectionContainer?: HTMLElement;
  enableCustomTextSelection: boolean;
}

function maybeRegisterTextLayerWithSelectionManager(
  options: TextSelectionRegistrationOptions,
): void {
  if (!options.enableCustomTextSelection) {
    return;
  }

  if (!tryRegisterTextLayerWithSelectionManager(options)) {
    scheduleDeferredTextLayerRegistration(options);
  }
}

function tryRegisterTextLayerWithSelectionManager(
  options: TextSelectionRegistrationOptions,
): boolean {
  const selectionRoot =
    options.selectionContainer ?? resolveSelectionRoot(options.textLayerContainer);
  const pageIndex = resolveSelectionPageIndex(options.textLayerContainer, options.pageIndex);

  if (!selectionRoot || pageIndex === null) {
    return false;
  }

  const manager = getOrCreateTextSelectionManager(selectionRoot);
  manager.registerTextLayer(pageIndex, options.textLayerContainer);
  return true;
}

function scheduleDeferredTextLayerRegistration(
  options: TextSelectionRegistrationOptions,
  attempt = 0,
): void {
  if (attempt >= 12) {
    return;
  }

  const schedule =
    typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
      ? (callback: () => void) => window.requestAnimationFrame(callback)
      : (callback: () => void) => setTimeout(callback, 16);

  schedule(() => {
    if (!tryRegisterTextLayerWithSelectionManager(options)) {
      scheduleDeferredTextLayerRegistration(options, attempt + 1);
    }
  });
}

function resolveSelectionRoot(textLayerContainer: HTMLElement): HTMLElement | null {
  return textLayerContainer.closest(AUTO_SELECTION_ROOT_SELECTOR);
}

function resolveSelectionPageIndex(
  textLayerContainer: HTMLElement,
  explicitPageIndex?: number,
): number | null {
  if (typeof explicitPageIndex === "number" && Number.isInteger(explicitPageIndex)) {
    return explicitPageIndex;
  }

  const pageElement = textLayerContainer.closest(PAGE_NUMBER_SELECTOR);
  const pageNumber = Number.parseInt(pageElement?.getAttribute("data-page-number") ?? "", 10);

  if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
    return null;
  }

  return pageNumber - 1;
}

function getOrCreateTextSelectionManager(selectionRoot: HTMLElement): TextSelectionManager {
  const attachedManager = getAttachedTextSelectionManager(selectionRoot);
  if (attachedManager) {
    return attachedManager;
  }

  const existingAutoManager = autoSelectionManagers.get(selectionRoot);
  if (existingAutoManager) {
    return existingAutoManager;
  }

  const manager = createTextSelectionManager({
    container: selectionRoot,
  });
  manager.enable();

  autoSelectionManagers.set(selectionRoot, manager);
  trackedAutoSelectionRoots.add(selectionRoot);
  ensureAutoSelectionCleanupObserver();

  return manager;
}

function ensureAutoSelectionCleanupObserver(): void {
  if (
    autoSelectionCleanupObserver ||
    typeof MutationObserver === "undefined" ||
    typeof document === "undefined" ||
    !document.body
  ) {
    return;
  }

  autoSelectionCleanupObserver = new MutationObserver(() => {
    for (const selectionRoot of Array.from(trackedAutoSelectionRoots)) {
      if (selectionRoot.isConnected) {
        continue;
      }

      autoSelectionManagers.get(selectionRoot)?.dispose();
      autoSelectionManagers.delete(selectionRoot);
      trackedAutoSelectionRoots.delete(selectionRoot);
    }

    if (trackedAutoSelectionRoots.size === 0) {
      autoSelectionCleanupObserver?.disconnect();
      autoSelectionCleanupObserver = null;
    }
  });

  autoSelectionCleanupObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
