/**
 * Content Stream Processor for PDF rendering.
 *
 * Parses PDF content stream bytes and converts them to Operator objects
 * that can be executed by renderers. This processor handles the conversion
 * between the raw content stream tokens and the typed Operator representation.
 */

import { Op, Operator, type Operand } from "#src/content/operators";
import { ContentStreamParser } from "#src/content/parsing";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

/**
 * Parsed text array element - either a string to display or a positioning adjustment.
 */
export type TextArrayElement = string | number;

/**
 * Content stream processor for converting raw bytes to executable operators.
 */
export class ContentStreamProcessor {
  /**
   * Parse content stream bytes into Operator objects.
   *
   * @param bytes - Raw content stream bytes
   * @returns Array of parsed operators ready for execution
   */
  static parseToOperators(bytes: Uint8Array): Operator[] {
    const parser = new ContentStreamParser(bytes);
    const { operations } = parser.parse();

    return operations.map(op => {
      if ("operands" in op) {
        const operands: Operand[] = [];
        for (const token of op.operands) {
          switch (token.type) {
            case "number":
              operands.push(token.value);
              break;
            case "name":
              operands.push(PdfName.of(token.value));
              break;
            case "string":
              operands.push(PdfString.fromBytes(token.value));
              break;
            case "array": {
              const arr = new PdfArray();
              for (const item of token.items) {
                if (item.type === "number") {
                  arr.push(PdfNumber.of(item.value));
                } else if (item.type === "string") {
                  arr.push(PdfString.fromBytes(item.value));
                } else if (item.type === "name") {
                  arr.push(PdfName.of(item.value));
                }
              }
              operands.push(arr);
              break;
            }
            default:
              break;
          }
        }
        return Operator.of(op.operator as Op, ...operands);
      }
      // Inline image - return no-op for now
      return Operator.of(Op.EndPath);
    });
  }

  /**
   * Extract font name from an operand (string or PdfName).
   */
  static extractFontName(operand: unknown): string {
    if (typeof operand === "string") {
      return operand;
    }
    if (operand && typeof operand === "object" && "value" in operand) {
      return String((operand as PdfName).value);
    }
    return "";
  }

  /**
   * Extract text string from an operand (string or PdfString).
   */
  static extractTextString(operand: unknown): string {
    if (typeof operand === "string") {
      return operand;
    }
    if (operand && typeof operand === "object") {
      if ("asString" in operand && typeof operand.asString === "function") {
        return (operand as PdfString).asString();
      }
      if ("bytes" in operand && operand.bytes instanceof Uint8Array) {
        return ContentStreamProcessor.decodeLatin1(operand.bytes);
      }
    }
    return "";
  }

  /**
   * Extract text array elements (strings and numbers) from a PdfArray.
   */
  static extractTextArray(array: PdfArray): TextArrayElement[] {
    const result: TextArrayElement[] = [];
    for (const item of array) {
      if (item && typeof item === "object") {
        if ("value" in item && typeof (item as PdfNumber).value === "number") {
          result.push((item as PdfNumber).value);
        } else if ("asString" in item && typeof item.asString === "function") {
          result.push(item.asString());
        } else if ("bytes" in item && item.bytes instanceof Uint8Array) {
          result.push(ContentStreamProcessor.decodeLatin1(item.bytes));
        }
      }
    }
    return result;
  }

  /**
   * Decode bytes as Latin-1 (ISO-8859-1) string.
   * This is the PDF default encoding for string bytes.
   */
  static decodeLatin1(bytes: Uint8Array): string {
    let result = "";
    for (const byte of bytes) {
      result += String.fromCharCode(byte);
    }
    return result;
  }

  /**
   * Convert CMYK color values to RGB.
   *
   * @param c - Cyan (0-1)
   * @param m - Magenta (0-1)
   * @param y - Yellow (0-1)
   * @param k - Black (0-1)
   * @returns RGB values as [r, g, b] where each is 0-255
   */
  static cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));
    return [r, g, b];
  }
}

/**
 * Create a content stream processor (convenience function).
 */
export function createContentStreamProcessor(): typeof ContentStreamProcessor {
  return ContentStreamProcessor;
}
