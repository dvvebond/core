import { Op, Operator } from "#src/content/operators";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import { ContentStreamProcessor, createContentStreamProcessor } from "./ContentStreamProcessor";

describe("ContentStreamProcessor", () => {
  describe("parseToOperators", () => {
    it("parses empty content stream", () => {
      const bytes = new Uint8Array([]);
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toEqual([]);
    });

    it("parses simple operator without operands", () => {
      // "q" (push graphics state)
      const bytes = new Uint8Array([0x71]); // 'q'
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toHaveLength(1);
      expect(operators[0].op).toBe(Op.PushGraphicsState);
    });

    it("parses operator with number operands", () => {
      // "100 200 m" (move to)
      const bytes = new TextEncoder().encode("100 200 m");
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toHaveLength(1);
      expect(operators[0].op).toBe(Op.MoveTo);
      expect(operators[0].operands).toHaveLength(2);
      expect(operators[0].operands[0]).toBe(100);
      expect(operators[0].operands[1]).toBe(200);
    });

    it("parses multiple operators", () => {
      // "q 100 200 m Q"
      const bytes = new TextEncoder().encode("q\n100 200 m\nQ");
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toHaveLength(3);
      expect(operators[0].op).toBe(Op.PushGraphicsState);
      expect(operators[1].op).toBe(Op.MoveTo);
      expect(operators[2].op).toBe(Op.PopGraphicsState);
    });

    it("parses text operators with string operands", () => {
      // "BT (Hello) Tj ET"
      const bytes = new TextEncoder().encode("BT\n(Hello) Tj\nET");
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toHaveLength(3);
      expect(operators[0].op).toBe(Op.BeginText);
      expect(operators[1].op).toBe(Op.ShowText);
      expect(operators[2].op).toBe(Op.EndText);
    });

    it("parses name operands", () => {
      // "/F1 12 Tf"
      const bytes = new TextEncoder().encode("/F1 12 Tf");
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toHaveLength(1);
      expect(operators[0].op).toBe(Op.SetFont);
      expect(operators[0].operands).toHaveLength(2);
    });

    it("parses color operators", () => {
      // "1 0 0 rg"
      const bytes = new TextEncoder().encode("1 0 0 rg");
      const operators = ContentStreamProcessor.parseToOperators(bytes);
      expect(operators).toHaveLength(1);
      expect(operators[0].op).toBe(Op.SetNonStrokingRGB);
      expect(operators[0].operands[0]).toBe(1);
      expect(operators[0].operands[1]).toBe(0);
      expect(operators[0].operands[2]).toBe(0);
    });
  });

  describe("extractFontName", () => {
    it("extracts string font name", () => {
      expect(ContentStreamProcessor.extractFontName("Helvetica")).toBe("Helvetica");
    });

    it("extracts font name from object with value", () => {
      const obj = { value: "Times-Roman" };
      expect(ContentStreamProcessor.extractFontName(obj)).toBe("Times-Roman");
    });

    it("returns empty string for null", () => {
      expect(ContentStreamProcessor.extractFontName(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(ContentStreamProcessor.extractFontName(undefined)).toBe("");
    });
  });

  describe("extractTextString", () => {
    it("extracts string directly", () => {
      expect(ContentStreamProcessor.extractTextString("Hello")).toBe("Hello");
    });

    it("extracts from object with asString method", () => {
      const obj = {
        asString: () => "World",
      };
      expect(ContentStreamProcessor.extractTextString(obj)).toBe("World");
    });

    it("extracts from object with bytes property", () => {
      const obj = {
        bytes: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
      };
      expect(ContentStreamProcessor.extractTextString(obj)).toBe("Hello");
    });

    it("returns empty string for null", () => {
      expect(ContentStreamProcessor.extractTextString(null)).toBe("");
    });
  });

  describe("extractTextArray", () => {
    it("extracts mixed string and number elements", () => {
      const array = new PdfArray([
        PdfString.fromString("H"),
        PdfNumber.of(-10),
        PdfString.fromString("ello"),
      ]);
      const result = ContentStreamProcessor.extractTextArray(array);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("H");
      expect(result[1]).toBe(-10);
      expect(result[2]).toBe("ello");
    });

    it("handles empty array", () => {
      const array = new PdfArray([]);
      const result = ContentStreamProcessor.extractTextArray(array);
      expect(result).toEqual([]);
    });
  });

  describe("decodeLatin1", () => {
    it("decodes ASCII bytes", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(ContentStreamProcessor.decodeLatin1(bytes)).toBe("Hello");
    });

    it("decodes extended Latin-1 characters", () => {
      const bytes = new Uint8Array([233]); // é
      expect(ContentStreamProcessor.decodeLatin1(bytes)).toBe("é");
    });

    it("handles empty array", () => {
      const bytes = new Uint8Array([]);
      expect(ContentStreamProcessor.decodeLatin1(bytes)).toBe("");
    });
  });

  describe("cmykToRgb", () => {
    it("converts black", () => {
      const [r, g, b] = ContentStreamProcessor.cmykToRgb(0, 0, 0, 1);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it("converts white", () => {
      const [r, g, b] = ContentStreamProcessor.cmykToRgb(0, 0, 0, 0);
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
    });

    it("converts cyan", () => {
      const [r, g, b] = ContentStreamProcessor.cmykToRgb(1, 0, 0, 0);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(255);
    });

    it("converts magenta", () => {
      const [r, g, b] = ContentStreamProcessor.cmykToRgb(0, 1, 0, 0);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(255);
    });

    it("converts yellow", () => {
      const [r, g, b] = ContentStreamProcessor.cmykToRgb(0, 0, 1, 0);
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });
  });

  describe("createContentStreamProcessor", () => {
    it("returns the ContentStreamProcessor class", () => {
      const processor = createContentStreamProcessor();
      expect(processor).toBe(ContentStreamProcessor);
    });
  });
});
