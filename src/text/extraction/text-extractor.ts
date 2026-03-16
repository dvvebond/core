/**
 * Hierarchical TextExtractor for comprehensive PDF text extraction.
 *
 * Parses PDF content streams to extract text with accurate bounding boxes
 * at character, word, line, and paragraph levels. Uses PDF coordinate system
 * (bottom-left origin, points as units).
 */

import type { PdfFont } from "#src/fonts/pdf-font";

import {
  TextContentStreamParser,
  type TextOperation,
  type TextShowItem,
} from "./content-stream-parser";
import { groupCharactersIntoPage } from "./text-grouping";
import { TextPositionCalculator } from "./text-positioning";
import type { Character, ExtractionOptions, TextPage } from "./types";

/**
 * Options for hierarchical text extraction.
 */
export interface HierarchicalTextExtractorOptions {
  /**
   * Resolve a font name to a PdfFont object.
   * Font names are keys in the /Resources/Font dictionary (e.g., "F1", "TT0").
   */
  resolveFont: (name: string) => PdfFont | null;

  /**
   * Page dimensions (required for proper text page structure).
   */
  pageWidth?: number;
  pageHeight?: number;
  pageIndex?: number;

  /**
   * Extraction options for grouping.
   */
  extractionOptions?: ExtractionOptions;
}

/**
 * Raw extraction result (characters only).
 */
export interface RawExtractionResult {
  /** Extracted characters with positions */
  characters: Character[];
  /** Warnings from parsing */
  warnings: string[];
}

/**
 * Hierarchical text extractor.
 *
 * Parses PDF content streams and extracts text at multiple levels:
 * - Characters: Individual characters with precise bounding boxes
 * - Words: Groups of characters forming words
 * - Lines: Groups of words on the same baseline
 * - Paragraphs: Groups of related lines
 */
export class HierarchicalTextExtractor {
  private readonly resolveFont: (name: string) => PdfFont | null;
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  private readonly pageIndex: number;
  private readonly extractionOptions: ExtractionOptions;

  private readonly positionCalculator: TextPositionCalculator;
  private readonly characters: Character[] = [];
  private readonly warnings: string[] = [];
  private characterIndex = 0;

  constructor(options: HierarchicalTextExtractorOptions) {
    this.resolveFont = options.resolveFont;
    this.pageWidth = options.pageWidth ?? 612; // Default Letter width
    this.pageHeight = options.pageHeight ?? 792; // Default Letter height
    this.pageIndex = options.pageIndex ?? 0;
    this.extractionOptions = options.extractionOptions ?? {};
    this.positionCalculator = new TextPositionCalculator();
  }

  /**
   * Extract text from a content stream.
   *
   * @param contentBytes - Raw content stream bytes
   * @returns Complete TextPage with hierarchical structure
   */
  extract(contentBytes: Uint8Array): TextPage {
    const raw = this.extractRaw(contentBytes);

    return groupCharactersIntoPage(
      raw.characters,
      this.pageWidth,
      this.pageHeight,
      this.pageIndex,
      this.extractionOptions,
    );
  }

  /**
   * Extract raw characters without hierarchical grouping.
   *
   * @param contentBytes - Raw content stream bytes
   * @returns Raw extraction result with characters and warnings
   */
  extractRaw(contentBytes: Uint8Array): RawExtractionResult {
    const parser = new TextContentStreamParser(contentBytes);
    const result = parser.parse();

    this.warnings.push(...result.warnings);

    for (const op of result.operations) {
      this.processOperation(op);
    }

    return {
      characters: [...this.characters],
      warnings: [...this.warnings],
    };
  }

  /**
   * Extract text from multiple content streams (for pages with multiple content arrays).
   *
   * @param contentStreams - Array of content stream bytes
   * @returns Complete TextPage with hierarchical structure
   */
  extractMultiple(contentStreams: Uint8Array[]): TextPage {
    for (const stream of contentStreams) {
      this.extractRaw(stream);
    }

    return groupCharactersIntoPage(
      this.characters,
      this.pageWidth,
      this.pageHeight,
      this.pageIndex,
      this.extractionOptions,
    );
  }

  /**
   * Process a single text operation.
   */
  private processOperation(op: TextOperation): void {
    switch (op.type) {
      case "graphics":
        this.processGraphicsOp(op);
        break;

      case "textObject":
        this.processTextObjectOp(op);
        break;

      case "font":
        this.processFontOp(op);
        break;

      case "state":
        this.processStateOp(op);
        break;

      case "matrix":
        this.processMatrixOp(op);
        break;

      case "position":
        this.processPositionOp(op);
        break;

      case "show":
        this.processShowOp(op);
        break;
    }
  }

  /**
   * Process graphics state operations.
   */
  private processGraphicsOp(op: Extract<TextOperation, { type: "graphics" }>): void {
    switch (op.operator) {
      case "q":
        this.positionCalculator.saveGraphicsState();
        break;

      case "Q":
        this.positionCalculator.restoreGraphicsState();
        break;

      case "cm":
        if (op.values && op.values.length >= 6) {
          this.positionCalculator.concatMatrix(
            op.values[0],
            op.values[1],
            op.values[2],
            op.values[3],
            op.values[4],
            op.values[5],
          );
        }
        break;
    }
  }

  /**
   * Process text object boundaries.
   */
  private processTextObjectOp(op: Extract<TextOperation, { type: "textObject" }>): void {
    if (op.operator === "BT") {
      this.positionCalculator.beginText();
    } else {
      this.positionCalculator.endText();
    }
  }

  /**
   * Process font selection.
   */
  private processFontOp(op: Extract<TextOperation, { type: "font" }>): void {
    const font = this.resolveFont(op.fontName);
    this.positionCalculator.setFont(font, op.fontSize);
  }

  /**
   * Process text state changes.
   */
  private processStateOp(op: Extract<TextOperation, { type: "state" }>): void {
    const value = op.values[0] ?? 0;

    switch (op.operator) {
      case "Tc":
        this.positionCalculator.setCharSpacing(value);
        break;

      case "Tw":
        this.positionCalculator.setWordSpacing(value);
        break;

      case "Tz":
        this.positionCalculator.setHorizontalScale(value);
        break;

      case "TL":
        this.positionCalculator.setLeading(value);
        break;

      case "Tr":
        this.positionCalculator.setRenderMode(value);
        break;

      case "Ts":
        this.positionCalculator.setTextRise(value);
        break;
    }
  }

  /**
   * Process text matrix changes.
   */
  private processMatrixOp(op: Extract<TextOperation, { type: "matrix" }>): void {
    this.positionCalculator.setTextMatrix(op.a, op.b, op.c, op.d, op.e, op.f);
  }

  /**
   * Process text position changes.
   */
  private processPositionOp(op: Extract<TextOperation, { type: "position" }>): void {
    switch (op.operator) {
      case "Td":
        this.positionCalculator.moveTextPosition(op.tx, op.ty);
        break;

      case "TD":
        this.positionCalculator.moveTextPositionAndSetLeading(op.tx, op.ty);
        break;

      case "T*":
        this.positionCalculator.moveToNextLine();
        break;
    }
  }

  /**
   * Process text showing operations.
   */
  private processShowOp(op: Extract<TextOperation, { type: "show" }>): void {
    switch (op.operator) {
      case "Tj":
        if (op.bytes) {
          this.showString(op.bytes);
        }
        break;

      case "'":
        this.positionCalculator.moveToNextLine();
        if (op.bytes) {
          this.showString(op.bytes);
        }
        break;

      case '"':
        // Word and char spacing were set in the parser
        this.positionCalculator.moveToNextLine();
        if (op.bytes) {
          this.showString(op.bytes);
        }
        break;

      case "TJ":
        if (op.items) {
          this.showTJArray(op.items);
        }
        break;
    }
  }

  /**
   * Show a string and extract characters.
   */
  private showString(bytes: Uint8Array): void {
    const font = this.positionCalculator.currentFont;

    if (!font) {
      // No font - can't decode
      return;
    }

    const codes = this.decodeStringToCodes(bytes, font);

    for (const code of codes) {
      const char = font.toUnicode(code);
      const width = font.getWidth(code);

      // Skip if we can't decode to Unicode
      if (!char) {
        this.positionCalculator.advancePosition(width, false);
        continue;
      }

      // Calculate bounding box
      const charResult = this.positionCalculator.calculateCharBBox(width);

      // Create extracted character
      this.characters.push({
        text: char,
        bbox: charResult.bbox,
        baseline: charResult.baseline,
        fontSize: this.positionCalculator.effectiveFontSize,
        fontName: font.baseFontName,
        index: this.characterIndex++,
      });

      // Advance position
      const isSpace = char === " " || char === "\u00A0";
      this.positionCalculator.advancePosition(width, isSpace);
    }
  }

  /**
   * Show TJ array with positioning adjustments.
   */
  private showTJArray(items: TextShowItem[]): void {
    for (const item of items) {
      if (item.type === "string") {
        this.showString(item.bytes);
      } else if (item.type === "adjustment") {
        this.positionCalculator.applyTJAdjustment(item.value);
      }
    }
  }

  /**
   * Decode string bytes to character codes.
   */
  private decodeStringToCodes(bytes: Uint8Array, font: PdfFont): number[] {
    const codes: number[] = [];

    if (font.subtype === "Type0") {
      // Composite font - 2-byte codes
      for (let i = 0; i < bytes.length - 1; i += 2) {
        const code = (bytes[i] << 8) | bytes[i + 1];
        codes.push(code);
      }

      // Handle odd byte
      if (bytes.length % 2 === 1) {
        codes.push(bytes[bytes.length - 1]);
      }
    } else {
      // Simple font - single byte codes
      for (const byte of bytes) {
        codes.push(byte);
      }
    }

    return codes;
  }
}

/**
 * Create a hierarchical text extractor.
 */
export function createHierarchicalTextExtractor(
  options: HierarchicalTextExtractorOptions,
): HierarchicalTextExtractor {
  return new HierarchicalTextExtractor(options);
}
