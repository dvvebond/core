/**
 * Content stream parser for text extraction.
 *
 * Wraps the core ContentStreamParser and provides a text-focused interface
 * for processing PDF content streams. Handles text state operators (Tm, Td, TD, etc.)
 * and text showing operators (Tj, TJ, etc.) while tracking graphics state.
 */

import { ContentStreamParser as CoreParser } from "#src/content/parsing/content-stream-parser";
import {
  isInlineImageOperation,
  type AnyOperation,
  type ContentToken,
} from "#src/content/parsing/types";

/**
 * Parsed text state from a content stream operation.
 */
export interface TextStateChange {
  type: "state";
  operator: TextStateOperator;
  values: number[];
}

/**
 * Parsed text matrix set operation.
 */
export interface TextMatrixSet {
  type: "matrix";
  operator: "Tm";
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Parsed text position change.
 */
export interface TextPositionChange {
  type: "position";
  operator: TextPositionOperator;
  tx: number;
  ty: number;
}

/**
 * Parsed text showing operation.
 */
export interface TextShow {
  type: "show";
  operator: TextShowOperator;
  /** String bytes for Tj, ', " operators */
  bytes?: Uint8Array;
  /** Array items for TJ operator - strings and position adjustments */
  items?: TextShowItem[];
}

/**
 * An item in a TJ array.
 */
export type TextShowItem =
  | { type: "string"; bytes: Uint8Array }
  | { type: "adjustment"; value: number };

/**
 * Font change operation.
 */
export interface FontChange {
  type: "font";
  operator: "Tf";
  fontName: string;
  fontSize: number;
}

/**
 * Graphics state operation.
 */
export interface GraphicsStateChange {
  type: "graphics";
  operator: GraphicsOperator;
  values?: number[];
}

/**
 * Text object boundary.
 */
export interface TextObjectBoundary {
  type: "textObject";
  operator: "BT" | "ET";
}

/**
 * Union of all text-related operations.
 */
export type TextOperation =
  | TextStateChange
  | TextMatrixSet
  | TextPositionChange
  | TextShow
  | FontChange
  | GraphicsStateChange
  | TextObjectBoundary;

/**
 * Text state operators that take numeric parameters.
 */
export type TextStateOperator =
  | "Tc" // Character spacing
  | "Tw" // Word spacing
  | "Tz" // Horizontal scaling
  | "TL" // Leading
  | "Tr" // Render mode
  | "Ts"; // Rise

/**
 * Text position operators.
 */
export type TextPositionOperator =
  | "Td" // Move text position
  | "TD" // Move position and set leading
  | "T*"; // Move to next line

/**
 * Text showing operators.
 */
export type TextShowOperator =
  | "Tj" // Show string
  | "TJ" // Show strings with positioning
  | "'" // Move to next line and show string
  | '"'; // Set spacing, move to next line, show string

/**
 * Graphics state operators relevant to text.
 */
export type GraphicsOperator =
  | "q" // Save state
  | "Q" // Restore state
  | "cm"; // Concat matrix

/**
 * Result from parsing content stream for text extraction.
 */
export interface TextParseResult {
  operations: TextOperation[];
  warnings: string[];
}

/**
 * Content stream parser specialized for text extraction.
 *
 * Filters and transforms content stream operations into a format
 * optimized for text extraction and positioning calculations.
 */
export class TextContentStreamParser {
  private readonly parser: CoreParser;

  constructor(bytes: Uint8Array) {
    this.parser = new CoreParser(bytes);
  }

  /**
   * Parse all text-related operations from the content stream.
   */
  parse(): TextParseResult {
    const result = this.parser.parse();
    const operations: TextOperation[] = [];
    const warnings = [...result.warnings];

    for (const op of result.operations) {
      const textOp = this.processOperation(op);
      if (textOp) {
        operations.push(textOp);
      }
    }

    return { operations, warnings };
  }

  /**
   * Iterate text operations lazily.
   */
  *[Symbol.iterator](): Iterator<TextOperation> {
    for (const op of this.parser) {
      const textOp = this.processOperation(op);
      if (textOp) {
        yield textOp;
      }
    }
  }

  /**
   * Process a content stream operation and convert to text operation if relevant.
   */
  private processOperation(op: AnyOperation): TextOperation | null {
    // Skip inline images
    if (isInlineImageOperation(op)) {
      return null;
    }

    const { operator, operands } = op;

    switch (operator) {
      // Text object boundaries
      case "BT":
        return { type: "textObject", operator: "BT" };
      case "ET":
        return { type: "textObject", operator: "ET" };

      // Graphics state
      case "q":
        return { type: "graphics", operator: "q" };
      case "Q":
        return { type: "graphics", operator: "Q" };
      case "cm":
        return {
          type: "graphics",
          operator: "cm",
          values: this.getNumbers(operands, 6),
        };

      // Font selection
      case "Tf":
        return {
          type: "font",
          operator: "Tf",
          fontName: this.getName(operands[0]) ?? "",
          fontSize: this.getNumber(operands[1]),
        };

      // Text state operators
      case "Tc":
      case "Tw":
      case "Tz":
      case "TL":
      case "Tr":
      case "Ts":
        return {
          type: "state",
          operator: operator as TextStateOperator,
          values: [this.getNumber(operands[0])],
        };

      // Text matrix
      case "Tm":
        return {
          type: "matrix",
          operator: "Tm",
          a: this.getNumber(operands[0]),
          b: this.getNumber(operands[1]),
          c: this.getNumber(operands[2]),
          d: this.getNumber(operands[3]),
          e: this.getNumber(operands[4]),
          f: this.getNumber(operands[5]),
        };

      // Text position
      case "Td":
        return {
          type: "position",
          operator: "Td",
          tx: this.getNumber(operands[0]),
          ty: this.getNumber(operands[1]),
        };
      case "TD":
        return {
          type: "position",
          operator: "TD",
          tx: this.getNumber(operands[0]),
          ty: this.getNumber(operands[1]),
        };
      case "T*":
        return {
          type: "position",
          operator: "T*",
          tx: 0,
          ty: 0,
        };

      // Text showing
      case "Tj":
        return {
          type: "show",
          operator: "Tj",
          bytes: this.getString(operands[0]),
        };
      case "'":
        return {
          type: "show",
          operator: "'",
          bytes: this.getString(operands[0]),
        };
      case '"':
        return {
          type: "show",
          operator: '"',
          bytes: this.getString(operands[2]),
        };
      case "TJ":
        return {
          type: "show",
          operator: "TJ",
          items: this.getTJItems(operands[0]),
        };

      default:
        // Ignore non-text operators
        return null;
    }
  }

  /**
   * Get a number from a content token.
   */
  private getNumber(token: ContentToken | undefined): number {
    if (token?.type === "number") {
      return token.value;
    }
    return 0;
  }

  /**
   * Get multiple numbers from content tokens.
   */
  private getNumbers(tokens: ContentToken[], count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.getNumber(tokens[i]));
    }
    return result;
  }

  /**
   * Get a name from a content token.
   */
  private getName(token: ContentToken | undefined): string | null {
    if (token?.type === "name") {
      return token.value;
    }
    return null;
  }

  /**
   * Get string bytes from a content token.
   */
  private getString(token: ContentToken | undefined): Uint8Array {
    if (token?.type === "string") {
      return token.value;
    }
    return new Uint8Array(0);
  }

  /**
   * Parse TJ array items.
   */
  private getTJItems(token: ContentToken | undefined): TextShowItem[] {
    if (token?.type !== "array") {
      return [];
    }

    return token.items.map((item): TextShowItem => {
      if (item.type === "string") {
        return { type: "string", bytes: item.value };
      } else if (item.type === "number") {
        return { type: "adjustment", value: item.value };
      }
      // Ignore other types
      return { type: "adjustment", value: 0 };
    });
  }
}
