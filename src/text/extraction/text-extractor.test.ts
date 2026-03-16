import type { FontDescriptor } from "#src/fonts/font-descriptor";
import type { PdfFont } from "#src/fonts/pdf-font";
import { describe, expect, it } from "vitest";

import { TextContentStreamParser } from "./content-stream-parser";
import { groupCharactersIntoPage, type Character } from "./index";
import { HierarchicalTextExtractor, createHierarchicalTextExtractor } from "./text-extractor";
import { TextPositionCalculator } from "./text-positioning";

/**
 * Create a mock PdfFont for testing.
 */
function createMockFont(
  name: string,
  widths: Map<number, number> = new Map(),
  unicodeMap: Map<number, string> = new Map(),
): PdfFont {
  return {
    subtype: "TrueType",
    baseFontName: name,
    descriptor: {
      ascent: 800,
      descent: -200,
      fontBBox: [0, -200, 600, 800],
    } as FontDescriptor,
    getWidth: (code: number) => widths.get(code) ?? 500,
    toUnicode: (code: number) => unicodeMap.get(code) ?? String.fromCharCode(code),
    encodeText: (text: string) => text.split("").map(c => c.charCodeAt(0)),
    canEncode: () => true,
    getTextWidth: (text: string, fontSize: number) => {
      let totalWidth = 0;
      for (const char of text) {
        totalWidth += widths.get(char.charCodeAt(0)) ?? 500;
      }
      return (totalWidth * fontSize) / 1000;
    },
  } as PdfFont;
}

/**
 * Create content stream bytes from a string.
 */
function contentBytes(content: string): Uint8Array {
  return new Uint8Array(content.split("").map(c => c.charCodeAt(0)));
}

describe("HierarchicalTextExtractor", () => {
  describe("basic extraction", () => {
    it("extracts simple text from content stream", () => {
      const content = `
        BT
        /F1 12 Tf
        50 700 Td
        (Hello) Tj
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
        pageIndex: 0,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(5);
      expect(result.text).toContain("Hello");
      expect(result.pageIndex).toBe(0);
      expect(result.width).toBe(612);
      expect(result.height).toBe(792);
    });

    it("handles TJ array with positioning adjustments", () => {
      const content = `
        BT
        /F1 12 Tf
        50 700 Td
        [(H) -50 (i)] TJ
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(2);
      expect(result.text).toContain("Hi");
    });

    it("returns empty result for empty content stream", () => {
      const content = ``;

      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => null,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(0);
      expect(result.words).toHaveLength(0);
      expect(result.lines).toHaveLength(0);
      expect(result.paragraphs).toHaveLength(0);
      expect(result.text).toBe("");
    });

    it("skips text when no font is set", () => {
      const content = `
        BT
        50 700 Td
        (NoFont) Tj
        ET
      `;

      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => null,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(0);
    });
  });

  describe("hierarchical structure", () => {
    it("groups characters into words", () => {
      // Create characters manually for testing grouping
      const chars: Character[] = [
        {
          text: "H",
          bbox: { x: 0, y: 0, width: 8, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 0,
        },
        {
          text: "i",
          bbox: { x: 8, y: 0, width: 4, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 1,
        },
        // Gap for word break
        {
          text: "t",
          bbox: { x: 20, y: 0, width: 6, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 2,
        },
        {
          text: "h",
          bbox: { x: 26, y: 0, width: 6, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 3,
        },
        {
          text: "e",
          bbox: { x: 32, y: 0, width: 6, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 4,
        },
        {
          text: "r",
          bbox: { x: 38, y: 0, width: 5, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 5,
        },
        {
          text: "e",
          bbox: { x: 43, y: 0, width: 6, height: 12 },
          baseline: 10,
          fontSize: 12,
          fontName: "Helvetica",
          index: 6,
        },
      ];

      const page = groupCharactersIntoPage(chars, 612, 792, 0);

      expect(page.words.length).toBeGreaterThanOrEqual(2);
      expect(page.lines).toHaveLength(1);
    });

    it("groups characters into lines by baseline", () => {
      const chars: Character[] = [
        // Line 1 at baseline 100
        {
          text: "A",
          bbox: { x: 0, y: 90, width: 10, height: 12 },
          baseline: 100,
          fontSize: 12,
          fontName: "Helvetica",
          index: 0,
        },
        {
          text: "B",
          bbox: { x: 10, y: 90, width: 10, height: 12 },
          baseline: 100,
          fontSize: 12,
          fontName: "Helvetica",
          index: 1,
        },
        // Line 2 at baseline 80
        {
          text: "C",
          bbox: { x: 0, y: 70, width: 10, height: 12 },
          baseline: 80,
          fontSize: 12,
          fontName: "Helvetica",
          index: 2,
        },
        {
          text: "D",
          bbox: { x: 10, y: 70, width: 10, height: 12 },
          baseline: 80,
          fontSize: 12,
          fontName: "Helvetica",
          index: 3,
        },
      ];

      const page = groupCharactersIntoPage(chars, 612, 792, 0);

      expect(page.lines).toHaveLength(2);
      expect(page.lines[0].baseline).toBe(100);
      expect(page.lines[1].baseline).toBe(80);
    });

    it("groups lines into paragraphs based on spacing", () => {
      const chars: Character[] = [
        // Paragraph 1, Line 1
        {
          text: "A",
          bbox: { x: 0, y: 780, width: 10, height: 12 },
          baseline: 790,
          fontSize: 12,
          fontName: "Helvetica",
          index: 0,
        },
        // Paragraph 1, Line 2 (close spacing)
        {
          text: "B",
          bbox: { x: 0, y: 765, width: 10, height: 12 },
          baseline: 775,
          fontSize: 12,
          fontName: "Helvetica",
          index: 1,
        },
        // Paragraph 2 (large gap)
        {
          text: "C",
          bbox: { x: 0, y: 720, width: 10, height: 12 },
          baseline: 730,
          fontSize: 12,
          fontName: "Helvetica",
          index: 2,
        },
      ];

      const page = groupCharactersIntoPage(chars, 612, 792, 0, {
        detectParagraphs: true,
        paragraphSpacingThreshold: 1.5,
      });

      expect(page.paragraphs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("bounding box calculations", () => {
    it("calculates character bounding boxes in PDF coordinates", () => {
      const content = `
        BT
        /F1 12 Tf
        100 500 Td
        (A) Tj
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(1);

      const char = result.characters[0];
      expect(char.bbox.x).toBeCloseTo(100, 0);
      // Y should be around 500 adjusted for descender
      expect(char.bbox.y).toBeLessThan(510);
      expect(char.bbox.width).toBeGreaterThan(0);
      expect(char.bbox.height).toBeGreaterThan(0);
    });

    it("applies text matrix transformations", () => {
      const content = `
        BT
        /F1 12 Tf
        2 0 0 2 100 500 Tm
        (A) Tj
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(1);

      const char = result.characters[0];
      // Font size should be scaled by matrix
      expect(char.fontSize).toBeCloseTo(24, 0); // 12 * 2
    });

    it("handles CTM transformations", () => {
      const content = `
        q
        2 0 0 2 0 0 cm
        BT
        /F1 12 Tf
        50 350 Td
        (A) Tj
        ET
        Q
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(1);

      const char = result.characters[0];
      // Position should be scaled by CTM
      expect(char.bbox.x).toBeCloseTo(100, 0); // 50 * 2
    });
  });

  describe("text state handling", () => {
    it("tracks font changes", () => {
      const content = `
        BT
        /F1 12 Tf
        50 700 Td
        (A) Tj
        /F2 14 Tf
        (B) Tj
        ET
      `;

      const fonts = new Map<string, PdfFont>([
        ["F1", createMockFont("Helvetica")],
        ["F2", createMockFont("Arial")],
      ]);

      const extractor = createHierarchicalTextExtractor({
        resolveFont: name => fonts.get(name) ?? null,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(2);
      expect(result.characters[0].fontName).toBe("Helvetica");
      expect(result.characters[1].fontName).toBe("Arial");
    });

    it("handles text positioning operators", () => {
      const content = `
        BT
        /F1 12 Tf
        50 700 Td
        (A) Tj
        100 0 Td
        (B) Tj
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(2);
      // Second character should be offset by 100 points
      expect(result.characters[1].bbox.x - result.characters[0].bbox.x).toBeCloseTo(100, -1);
    });

    it("handles T* operator for line breaks", () => {
      const content = `
        BT
        /F1 12 Tf
        14 TL
        50 700 Td
        (A) Tj
        T*
        (B) Tj
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(2);
      expect(result.lines.length).toBeGreaterThanOrEqual(1);
    });

    it("handles quote operators", () => {
      const content = `
        BT
        /F1 12 Tf
        14 TL
        50 700 Td
        (A) '
        (B) '
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(2);
    });

    it("handles graphics state save/restore", () => {
      const content = `
        q
        1.5 0 0 1.5 0 0 cm
        BT
        /F1 12 Tf
        50 500 Td
        (A) Tj
        ET
        Q
        BT
        /F1 12 Tf
        50 500 Td
        (B) Tj
        ET
      `;

      const mockFont = createMockFont("Helvetica");
      const extractor = createHierarchicalTextExtractor({
        resolveFont: () => mockFont,
        pageWidth: 612,
        pageHeight: 792,
      });

      const result = extractor.extract(contentBytes(content));

      expect(result.characters).toHaveLength(2);
      // First char should have scaled position, second should not
      expect(result.characters[0].bbox.x).toBeCloseTo(75, 0); // 50 * 1.5
      expect(result.characters[1].bbox.x).toBeCloseTo(50, 0);
    });
  });
});

describe("TextContentStreamParser", () => {
  it("parses text showing operators", () => {
    const content = `
      BT
      /F1 12 Tf
      50 700 Td
      (Hello) Tj
      ET
    `;

    const parser = new TextContentStreamParser(contentBytes(content));
    const result = parser.parse();

    const showOps = result.operations.filter(op => op.type === "show");
    expect(showOps).toHaveLength(1);
  });

  it("parses TJ arrays correctly", () => {
    const content = `
      BT
      /F1 12 Tf
      [(A) -100 (B)] TJ
      ET
    `;

    const parser = new TextContentStreamParser(contentBytes(content));
    const result = parser.parse();

    const showOps = result.operations.filter(op => op.type === "show");
    expect(showOps).toHaveLength(1);

    const tjOp = showOps[0];
    if (tjOp.type === "show" && tjOp.operator === "TJ" && tjOp.items) {
      expect(tjOp.items).toHaveLength(3);
      expect(tjOp.items[0].type).toBe("string");
      expect(tjOp.items[1].type).toBe("adjustment");
      expect(tjOp.items[2].type).toBe("string");
    }
  });

  it("parses text state operators", () => {
    const content = `
      BT
      2 Tc
      3 Tw
      110 Tz
      14 TL
      1 Tr
      5 Ts
      ET
    `;

    const parser = new TextContentStreamParser(contentBytes(content));
    const result = parser.parse();

    const stateOps = result.operations.filter(op => op.type === "state");
    expect(stateOps).toHaveLength(6);
  });

  it("parses text matrix operators", () => {
    const content = `
      BT
      1 0 0 1 100 200 Tm
      50 0 Td
      100 -14 TD
      T*
      ET
    `;

    const parser = new TextContentStreamParser(contentBytes(content));
    const result = parser.parse();

    const matrixOps = result.operations.filter(op => op.type === "matrix");
    expect(matrixOps).toHaveLength(1);

    const positionOps = result.operations.filter(op => op.type === "position");
    expect(positionOps).toHaveLength(3);
  });
});

describe("TextPositionCalculator", () => {
  it("calculates character bounding box", () => {
    const calc = new TextPositionCalculator();

    const mockFont = createMockFont("Helvetica");
    calc.setFont(mockFont, 12);
    calc.setTextMatrix(1, 0, 0, 1, 100, 500);

    const result = calc.calculateCharBBox(500);

    expect(result.bbox.x).toBeCloseTo(100, 0);
    expect(result.bbox.width).toBeGreaterThan(0);
    expect(result.bbox.height).toBeGreaterThan(0);
    expect(result.baseline).toBeCloseTo(500, 0);
  });

  it("handles text matrix scaling", () => {
    const calc = new TextPositionCalculator();

    const mockFont = createMockFont("Helvetica");
    calc.setFont(mockFont, 12);
    // Scale by 2
    calc.setTextMatrix(2, 0, 0, 2, 100, 500);

    expect(calc.effectiveFontSize).toBeCloseTo(24, 0);
  });

  it("advances position after character", () => {
    const calc = new TextPositionCalculator();

    const mockFont = createMockFont("Helvetica");
    calc.setFont(mockFont, 12);
    calc.beginText();
    calc.setTextMatrix(1, 0, 0, 1, 100, 500);

    const initialPos = { ...calc.position };
    calc.advancePosition(500, false);
    const newPos = calc.position;

    expect(newPos.x).toBeGreaterThan(initialPos.x);
  });

  it("applies TJ adjustment", () => {
    const calc = new TextPositionCalculator();

    const mockFont = createMockFont("Helvetica");
    calc.setFont(mockFont, 12);
    calc.beginText();
    calc.setTextMatrix(1, 0, 0, 1, 100, 500);

    const initialPos = { ...calc.position };
    calc.applyTJAdjustment(-100); // Negative moves right
    const newPos = calc.position;

    expect(newPos.x).toBeGreaterThan(initialPos.x);
  });

  it("saves and restores graphics state", () => {
    const calc = new TextPositionCalculator();

    calc.concatMatrix(2, 0, 0, 2, 0, 0);
    calc.saveGraphicsState();

    calc.concatMatrix(2, 0, 0, 2, 0, 0);
    const mockFont = createMockFont("Helvetica");
    calc.setFont(mockFont, 12);
    calc.setTextMatrix(1, 0, 0, 1, 100, 500);

    // Effective font size with 4x scale
    expect(calc.effectiveFontSize).toBeCloseTo(48, 0);

    calc.restoreGraphicsState();
    calc.setFont(mockFont, 12);
    calc.setTextMatrix(1, 0, 0, 1, 100, 500);

    // After restore, only 2x scale
    expect(calc.effectiveFontSize).toBeCloseTo(24, 0);
  });
});

describe("groupCharactersIntoPage", () => {
  it("creates hierarchical structure from characters", () => {
    const chars: Character[] = [
      {
        text: "H",
        bbox: { x: 0, y: 0, width: 8, height: 12 },
        baseline: 10,
        fontSize: 12,
        fontName: "Helvetica",
        index: 0,
      },
      {
        text: "i",
        bbox: { x: 8, y: 0, width: 4, height: 12 },
        baseline: 10,
        fontSize: 12,
        fontName: "Helvetica",
        index: 1,
      },
    ];

    const page = groupCharactersIntoPage(chars, 612, 792, 0);

    expect(page.characters).toHaveLength(2);
    expect(page.lines).toHaveLength(1);
    expect(page.paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(page.text).toContain("Hi");
  });

  it("handles empty character array", () => {
    const page = groupCharactersIntoPage([], 612, 792, 0);

    expect(page.characters).toHaveLength(0);
    expect(page.words).toHaveLength(0);
    expect(page.lines).toHaveLength(0);
    expect(page.paragraphs).toHaveLength(0);
    expect(page.text).toBe("");
  });

  it("respects extraction options", () => {
    const chars: Character[] = [
      {
        text: "A",
        bbox: { x: 0, y: 0, width: 10, height: 12 },
        baseline: 10,
        fontSize: 12,
        fontName: "Helvetica",
        index: 0,
      },
      {
        text: "B",
        bbox: { x: 10, y: 0, width: 10, height: 12 },
        baseline: 10,
        fontSize: 12,
        fontName: "Helvetica",
        index: 1,
      },
    ];

    const page = groupCharactersIntoPage(chars, 612, 792, 0, {
      detectParagraphs: false,
    });

    // With paragraph detection disabled, should have exactly 1 paragraph
    expect(page.paragraphs).toHaveLength(1);
  });
});
