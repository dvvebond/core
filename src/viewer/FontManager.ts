/**
 * Font Manager for PDF rendering.
 *
 * Handles font loading, caching, and mapping of PDF font names to system fonts.
 * Provides consistent font handling across Canvas and SVG renderers.
 */

/**
 * Font metrics information.
 */
export interface FontMetrics {
  /** Ascender height (above baseline) */
  ascender: number;
  /** Descender depth (below baseline) */
  descender: number;
  /** Line height */
  lineHeight: number;
  /** Average character width */
  avgCharWidth: number;
}

/**
 * Loaded font information.
 */
export interface LoadedFont {
  /** The font family name to use in CSS/Canvas */
  family: string;
  /** Whether the font is a standard PDF font */
  isStandard: boolean;
  /** Font metrics */
  metrics: FontMetrics;
  /** Whether italic style is available */
  hasItalic: boolean;
  /** Whether bold style is available */
  hasBold: boolean;
}

/**
 * Font style options.
 */
export interface FontStyle {
  /** Font weight: normal, bold, or numeric */
  weight?: "normal" | "bold" | number;
  /** Font style: normal or italic */
  style?: "normal" | "italic" | "oblique";
}

/**
 * Standard PDF Base 14 fonts mapped to web-safe alternatives.
 */
const STANDARD_FONT_MAP: Record<string, string> = {
  // Helvetica family
  Helvetica: "Helvetica, Arial, sans-serif",
  "Helvetica-Bold": "Helvetica, Arial, sans-serif",
  "Helvetica-Oblique": "Helvetica, Arial, sans-serif",
  "Helvetica-BoldOblique": "Helvetica, Arial, sans-serif",

  // Times family
  "Times-Roman": "'Times New Roman', Times, serif",
  "Times-Bold": "'Times New Roman', Times, serif",
  "Times-Italic": "'Times New Roman', Times, serif",
  "Times-BoldItalic": "'Times New Roman', Times, serif",

  // Courier family
  Courier: "'Courier New', Courier, monospace",
  "Courier-Bold": "'Courier New', Courier, monospace",
  "Courier-Oblique": "'Courier New', Courier, monospace",
  "Courier-BoldOblique": "'Courier New', Courier, monospace",

  // Symbol fonts
  Symbol: "Symbol, serif",
  ZapfDingbats: "ZapfDingbats, serif",
};

/**
 * Font styles derived from PDF font name suffixes.
 * Order matters - check longer suffixes first to match BoldItalic before Bold.
 */
const FONT_STYLE_SUFFIXES: Array<[string, FontStyle]> = [
  ["BoldItalic", { weight: "bold", style: "italic" }],
  ["BoldOblique", { weight: "bold", style: "oblique" }],
  ["Bold", { weight: "bold" }],
  ["Italic", { style: "italic" }],
  ["Oblique", { style: "oblique" }],
];

/**
 * Default font metrics for standard fonts.
 */
const DEFAULT_METRICS: FontMetrics = {
  ascender: 0.8,
  descender: -0.2,
  lineHeight: 1.2,
  avgCharWidth: 0.5,
};

/**
 * Font Manager handles font loading and mapping for PDF rendering.
 */
export class FontManager {
  private _initialized = false;
  private _fontCache: Map<string, LoadedFont> = new Map();
  // Using unknown type to avoid DOM type dependencies
  private _measureCanvas: unknown = null;
  private _measureContext: unknown = null;

  /**
   * Whether the font manager has been initialized.
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize the font manager.
   * Creates necessary resources for font measurement.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Create a canvas for font measurement (browser environment only)
    // Using globalThis to avoid DOM type dependencies
    const globalObj = globalThis as Record<string, unknown>;

    if (typeof globalObj.OffscreenCanvas !== "undefined") {
      const OffscreenCanvasClass = globalObj.OffscreenCanvas as new (
        w: number,
        h: number,
      ) => { getContext: (type: string) => unknown };
      this._measureCanvas = new OffscreenCanvasClass(1, 1);
      this._measureContext = (
        this._measureCanvas as { getContext: (type: string) => unknown }
      ).getContext("2d");
    } else if (typeof globalObj.document !== "undefined") {
      const doc = globalObj.document as {
        createElement: (type: string) => {
          width: number;
          height: number;
          getContext: (type: string) => unknown;
        };
      };
      const canvas = doc.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      this._measureCanvas = canvas;
      this._measureContext = canvas.getContext("2d");
    }

    // Pre-cache standard fonts
    for (const fontName of Object.keys(STANDARD_FONT_MAP)) {
      this.getFont(fontName);
    }

    this._initialized = true;
  }

  /**
   * Get a loaded font by PDF font name.
   *
   * @param pdfFontName - The font name from the PDF (e.g., "/F1" or "Helvetica")
   * @returns The loaded font information
   */
  getFont(pdfFontName: string): LoadedFont {
    // Normalize font name (remove leading slash)
    const normalizedName = pdfFontName.startsWith("/") ? pdfFontName.slice(1) : pdfFontName;

    // Check cache first
    const cached = this._fontCache.get(normalizedName);
    if (cached) {
      return cached;
    }

    // Map to web font
    const font = this.mapFont(normalizedName);
    this._fontCache.set(normalizedName, font);

    return font;
  }

  /**
   * Get the CSS font family string for a PDF font name.
   */
  getFontFamily(pdfFontName: string): string {
    return this.getFont(pdfFontName).family;
  }

  /**
   * Get the font style (weight/style) from a PDF font name.
   */
  getFontStyle(pdfFontName: string): FontStyle {
    const normalizedName = pdfFontName.startsWith("/") ? pdfFontName.slice(1) : pdfFontName;

    for (const [suffix, style] of FONT_STYLE_SUFFIXES) {
      if (normalizedName.endsWith(suffix)) {
        return style;
      }
    }

    return { weight: "normal", style: "normal" };
  }

  /**
   * Build a CSS font string for use in canvas or SVG.
   *
   * @param pdfFontName - The PDF font name
   * @param size - Font size in points
   * @returns CSS font string (e.g., "bold 12px Helvetica, Arial, sans-serif")
   */
  buildFontString(pdfFontName: string, size: number): string {
    const font = this.getFont(pdfFontName);
    const style = this.getFontStyle(pdfFontName);

    const parts: string[] = [];

    if (style.style === "italic" || style.style === "oblique") {
      parts.push(style.style);
    }

    if (style.weight === "bold" || (typeof style.weight === "number" && style.weight >= 700)) {
      parts.push("bold");
    }

    parts.push(`${size}px`);
    parts.push(font.family);

    return parts.join(" ");
  }

  /**
   * Measure text width using the current font settings.
   *
   * @param text - Text to measure
   * @param pdfFontName - PDF font name
   * @param size - Font size in points
   * @returns Width in points
   */
  measureText(text: string, pdfFontName: string, size: number): number {
    if (!this._measureContext) {
      // Fallback estimation
      return text.length * size * DEFAULT_METRICS.avgCharWidth;
    }

    const fontString = this.buildFontString(pdfFontName, size);
    // Use type assertion for canvas context methods
    const ctx = this._measureContext as {
      font: string;
      measureText: (text: string) => { width: number };
    };
    ctx.font = fontString;

    return ctx.measureText(text).width;
  }

  /**
   * Get font metrics for a PDF font.
   *
   * @param pdfFontName - PDF font name
   * @returns Font metrics
   */
  getFontMetrics(pdfFontName: string): FontMetrics {
    const font = this.getFont(pdfFontName);
    return font.metrics;
  }

  /**
   * Clear the font cache.
   */
  clearCache(): void {
    this._fontCache.clear();
  }

  /**
   * Destroy the font manager and release resources.
   */
  destroy(): void {
    this._fontCache.clear();
    this._measureCanvas = null;
    this._measureContext = null;
    this._initialized = false;
  }

  /**
   * Map a PDF font name to a LoadedFont.
   */
  private mapFont(normalizedName: string): LoadedFont {
    // Check if it's a standard font
    const standardFamily = STANDARD_FONT_MAP[normalizedName];
    if (standardFamily) {
      return {
        family: standardFamily,
        isStandard: true,
        metrics: { ...DEFAULT_METRICS },
        hasItalic: normalizedName.includes("Italic") || normalizedName.includes("Oblique"),
        hasBold: normalizedName.includes("Bold"),
      };
    }

    // Try to find a partial match (font subset names often have prefixes)
    for (const [stdName, family] of Object.entries(STANDARD_FONT_MAP)) {
      if (normalizedName.includes(stdName)) {
        return {
          family,
          isStandard: true,
          metrics: { ...DEFAULT_METRICS },
          hasItalic: normalizedName.includes("Italic") || normalizedName.includes("Oblique"),
          hasBold: normalizedName.includes("Bold"),
        };
      }
    }

    // Unknown font - fall back to sans-serif
    return {
      family: "sans-serif",
      isStandard: false,
      metrics: { ...DEFAULT_METRICS },
      hasItalic: false,
      hasBold: false,
    };
  }
}

/**
 * Create a new FontManager instance.
 */
export function createFontManager(): FontManager {
  return new FontManager();
}

/**
 * Global shared font manager instance.
 * Can be used when you don't need separate font manager instances.
 */
let globalFontManager: FontManager | null = null;

/**
 * Get the global shared font manager instance.
 * Lazily initializes the font manager on first call.
 */
export async function getGlobalFontManager(): Promise<FontManager> {
  if (!globalFontManager) {
    globalFontManager = new FontManager();
    await globalFontManager.initialize();
  }
  return globalFontManager;
}
