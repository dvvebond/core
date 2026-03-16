/**
 * Hierarchical text structure types for comprehensive text extraction.
 *
 * Provides types for representing text at multiple levels:
 * - Character: Individual characters with precise bounding boxes
 * - Word: Groups of characters forming words
 * - Line: Groups of words on the same baseline
 * - Paragraph: Groups of related lines
 * - TextPage: All text content from a single PDF page
 *
 * All coordinates use PDF coordinate system (origin at bottom-left, units in points).
 */

import type { BoundingBox } from "../types";

/**
 * An extracted character with precise position information.
 */
export interface Character {
  /** The Unicode character(s) */
  text: string;
  /** Bounding box in PDF coordinates (bottom-left origin, points) */
  bbox: BoundingBox;
  /** Y coordinate of the text baseline */
  baseline: number;
  /** Font size in points */
  fontSize: number;
  /** Font name (e.g., "Helvetica", "Arial-BoldMT") */
  fontName: string;
  /** Character index within the extraction sequence (0-based) */
  index: number;
  /** Confidence score for character recognition (0-1), if available */
  confidence?: number;
}

/**
 * A word consisting of one or more characters.
 */
export interface Word {
  /** The text content of the word */
  text: string;
  /** Bounding box encompassing all characters in the word */
  bbox: BoundingBox;
  /** Individual characters in the word */
  characters: Character[];
  /** Y coordinate of the baseline (average of character baselines) */
  baseline: number;
  /** Primary font size used in this word */
  fontSize: number;
  /** Primary font name used in this word */
  fontName: string;
  /** Index of this word within its line */
  indexInLine: number;
  /** Index of this word within the page */
  indexInPage: number;
}

/**
 * A line of text containing one or more words.
 */
export interface Line {
  /** Combined text from all words (space-separated) */
  text: string;
  /** Bounding box encompassing all words in the line */
  bbox: BoundingBox;
  /** Words in reading order */
  words: Word[];
  /** All characters in the line (flat list) */
  characters: Character[];
  /** Y coordinate of the baseline */
  baseline: number;
  /** Primary font size used in this line */
  fontSize: number;
  /** Primary font name used in this line */
  fontName: string;
  /** Index of this line within its paragraph (if available) */
  indexInParagraph?: number;
  /** Index of this line within the page */
  indexInPage: number;
}

/**
 * A paragraph consisting of one or more related lines.
 *
 * Paragraphs are detected based on vertical spacing, indentation,
 * and text flow analysis.
 */
export interface Paragraph {
  /** Combined text from all lines (newline-separated) */
  text: string;
  /** Bounding box encompassing all lines in the paragraph */
  bbox: BoundingBox;
  /** Lines in reading order */
  lines: Line[];
  /** All words in the paragraph (flat list) */
  words: Word[];
  /** All characters in the paragraph (flat list) */
  characters: Character[];
  /** Index of this paragraph within the page */
  indexInPage: number;
}

/**
 * Complete text extraction result for a single PDF page.
 */
export interface TextPage {
  /** Page index (0-based) */
  pageIndex: number;
  /** Page width in points */
  width: number;
  /** Page height in points */
  height: number;
  /** All paragraphs on the page */
  paragraphs: Paragraph[];
  /** All lines on the page (flat list) */
  lines: Line[];
  /** All words on the page (flat list) */
  words: Word[];
  /** All characters on the page (flat list) */
  characters: Character[];
  /** Plain text content (paragraphs separated by double newlines) */
  text: string;
}

/**
 * Options for text extraction.
 */
export interface ExtractionOptions {
  /**
   * Whether to detect and group text into paragraphs.
   * Default: true
   */
  detectParagraphs?: boolean;

  /**
   * Tolerance for grouping characters on the same baseline (in points).
   * Characters within this Y distance are considered on the same line.
   * Default: 2
   */
  baselineTolerance?: number;

  /**
   * Factor of font size to detect word boundaries.
   * If gap between characters exceeds this fraction of font size, start a new word.
   * Default: 0.3 (30% of font size)
   */
  wordSpacingThreshold?: number;

  /**
   * Factor of line height to detect paragraph breaks.
   * If gap between lines exceeds this multiple of average line height, start a new paragraph.
   * Default: 1.5
   */
  paragraphSpacingThreshold?: number;

  /**
   * Minimum indentation (in points) to consider a line as starting a new paragraph.
   * Default: 15
   */
  indentThreshold?: number;
}

/**
 * Result of extracting text from multiple pages.
 */
export interface DocumentText {
  /** Text pages in page order */
  pages: TextPage[];
  /** Total number of pages */
  pageCount: number;
  /** Combined plain text from all pages */
  text: string;
}

/**
 * Merge multiple bounding boxes into one that encompasses all of them.
 */
export function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...boxes.map(b => b.x));
  const minY = Math.min(...boxes.map(b => b.y));
  const maxX = Math.max(...boxes.map(b => b.x + b.width));
  const maxY = Math.max(...boxes.map(b => b.y + b.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate if two bounding boxes overlap.
 */
export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Calculate the horizontal gap between two bounding boxes.
 * Returns negative value if boxes overlap horizontally.
 */
export function horizontalGap(a: BoundingBox, b: BoundingBox): number {
  const aRight = a.x + a.width;
  const bRight = b.x + b.width;

  if (a.x < b.x) {
    return b.x - aRight;
  }
  return a.x - bRight;
}

/**
 * Calculate the vertical gap between two bounding boxes.
 * Returns negative value if boxes overlap vertically.
 */
export function verticalGap(a: BoundingBox, b: BoundingBox): number {
  const aTop = a.y + a.height;
  const bTop = b.y + b.height;

  if (a.y < b.y) {
    return b.y - aTop;
  }
  return a.y - bTop;
}
