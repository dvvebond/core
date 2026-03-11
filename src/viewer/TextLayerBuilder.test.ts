/**
 * Viewer-level tests for TextLayerBuilder.
 *
 * These tests focus on TextLayerBuilder integration with viewer components,
 * including text selection, highlight overlay, search result highlighting,
 * and coordinate transformation for text positioning.
 */

import { CoordinateTransformer } from "#src/coordinate-transformer";
import { TextLayerBuilder, createTextLayerBuilder } from "#src/renderers/text-layer-builder";
import type { ExtractedChar } from "#src/text/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Standard page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/**
 * Create a mock ExtractedChar for testing.
 */
function createMockChar(overrides: Partial<ExtractedChar> = {}): ExtractedChar {
  return {
    char: "A",
    bbox: {
      x: 100,
      y: 700,
      width: 10,
      height: 12,
    },
    fontSize: 12,
    fontName: "Helvetica",
    baseline: 700,
    sequenceIndex: 0,
    ...overrides,
  };
}

/**
 * Create mock characters for a word.
 */
function createMockWord(
  word: string,
  startX: number,
  y: number,
  charWidth = 10,
  fontSize = 12,
  fontName = "Helvetica",
): ExtractedChar[] {
  return word.split("").map((char, i) => ({
    char,
    bbox: {
      x: startX + i * charWidth,
      y,
      width: charWidth,
      height: fontSize,
    },
    fontSize,
    fontName,
    baseline: y,
    sequenceIndex: i,
  }));
}

/**
 * Create mock characters for multiple lines of text.
 */
function createMockParagraph(
  lines: string[],
  startX: number,
  startY: number,
  lineHeight = 14,
  charWidth = 10,
  fontSize = 12,
): ExtractedChar[] {
  const chars: ExtractedChar[] = [];
  let sequenceIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const y = startY - lineIndex * lineHeight;

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      chars.push({
        char: line[charIndex],
        bbox: {
          x: startX + charIndex * charWidth,
          y,
          width: charWidth,
          height: fontSize,
        },
        fontSize,
        fontName: "Helvetica",
        baseline: y,
        sequenceIndex: sequenceIndex++,
      });
    }
  }

  return chars;
}

/**
 * Mock HTMLElement for testing.
 */
class MockHTMLElement {
  style: Record<string, string> = {};
  children: MockHTMLElement[] = [];
  textContent: string | null = null;
  private attributes: Map<string, string> = new Map();

  get firstChild(): MockHTMLElement | null {
    return this.children[0] ?? null;
  }

  appendChild(child: MockHTMLElement): void {
    this.children.push(child);
  }

  removeChild(child: MockHTMLElement): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  querySelectorAll(selector: string): MockHTMLElement[] {
    if (selector === "span") {
      return this.children.filter(c => c instanceof MockSpanElement);
    }
    return [];
  }

  querySelector(selector: string): MockHTMLElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
}

/**
 * Mock span element.
 */
class MockSpanElement extends MockHTMLElement {}

/**
 * Create a mock container element for testing.
 */
function createMockContainer(): MockHTMLElement {
  return new MockHTMLElement();
}

/**
 * Create a standard coordinate transformer for testing.
 */
function createTransformer(
  pageWidth = LETTER_WIDTH,
  pageHeight = LETTER_HEIGHT,
  scale = 1,
  rotation: 0 | 90 | 180 | 270 = 0,
): CoordinateTransformer {
  return new CoordinateTransformer({
    pageWidth,
    pageHeight,
    scale,
    viewerRotation: rotation,
  });
}

describe("TextLayerBuilder viewer integration", () => {
  let container: MockHTMLElement;
  let transformer: CoordinateTransformer;
  let builder: TextLayerBuilder;
  let originalDocument: typeof globalThis.document;
  let mockCreateElement: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Store original document
    originalDocument = globalThis.document;

    // Create mock createElement
    mockCreateElement = vi.fn((tagName: string) => {
      if (tagName === "span") {
        return new MockSpanElement();
      }
      return new MockHTMLElement();
    });

    // Set up minimal document mock
    (globalThis as unknown as { document: unknown }).document = {
      createElement: mockCreateElement,
    };

    container = createMockContainer();
    transformer = createTransformer();
    builder = new TextLayerBuilder({
      container: container as unknown as HTMLElement,
      transformer,
    });
  });

  afterEach(() => {
    // Restore original document
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("multi-page text layer building", () => {
    it("builds text layer for Letter size page", () => {
      const chars = createMockParagraph(["Hello World", "Second line"], 72, 720);

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(22); // 11 + 11 chars
    });

    it("builds text layer for A4 size page", () => {
      const a4Transformer = createTransformer(A4_WIDTH, A4_HEIGHT);
      const a4Builder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: a4Transformer,
      });

      const chars = createMockParagraph(["A4 Page Text"], 72, 800);

      const result = a4Builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(12);
    });

    it("clears previous text layer when building new one", () => {
      const chars1 = createMockWord("First", 100, 700);
      const chars2 = createMockWord("Second", 100, 700);

      builder.buildTextLayer(chars1);
      const result = builder.buildTextLayer(chars2);

      expect(result.spanCount).toBe(6);
      expect(container.children.length).toBe(6);
    });
  });

  describe("zoom level text positioning", () => {
    const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

    for (const zoom of zoomLevels) {
      it(`positions text correctly at ${zoom * 100}% zoom`, () => {
        const zoomedTransformer = createTransformer(LETTER_WIDTH, LETTER_HEIGHT, zoom);
        const zoomedBuilder = new TextLayerBuilder({
          container: container as unknown as HTMLElement,
          transformer: zoomedTransformer,
        });

        const chars = [
          createMockChar({
            bbox: { x: 100, y: 700, width: 10, height: 12 },
            fontSize: 12,
          }),
        ];

        zoomedBuilder.buildTextLayer(chars);

        const span = container.querySelector("span");
        const width = parseFloat(span?.style.width ?? "0");
        const fontSize = parseFloat(span?.style.fontSize ?? "0");

        // Width and font size should be scaled
        expect(width).toBeCloseTo(10 * zoom, 0);
        expect(fontSize).toBeCloseTo(12 * zoom, 0);
      });
    }

    it("maintains character spacing at different zoom levels", () => {
      const chars = createMockWord("ABC", 100, 700);

      builder.buildTextLayer(chars);
      const spans = container.querySelectorAll("span");

      const left0 = parseFloat(spans[0].style.left ?? "0");
      const left1 = parseFloat(spans[1].style.left ?? "0");

      expect(left1 - left0).toBeCloseTo(10, 0); // char width at 1x zoom
    });
  });

  describe("rotation text positioning", () => {
    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

    for (const rotation of rotations) {
      it(`positions text correctly with ${rotation}° rotation`, () => {
        const rotatedTransformer = createTransformer(LETTER_WIDTH, LETTER_HEIGHT, 1, rotation);
        const rotatedBuilder = new TextLayerBuilder({
          container: container as unknown as HTMLElement,
          transformer: rotatedTransformer,
        });

        const chars = [createMockChar()];

        // Should not throw
        rotatedBuilder.buildTextLayer(chars);

        const span = container.querySelector("span");
        expect(span).toBeTruthy();
      });
    }

    it("combines rotation with zoom", () => {
      const combinedTransformer = createTransformer(LETTER_WIDTH, LETTER_HEIGHT, 2, 90);
      const combinedBuilder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: combinedTransformer,
      });

      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 12 },
          fontSize: 12,
        }),
      ];

      combinedBuilder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const fontSize = parseFloat(span?.style.fontSize ?? "0");

      // Font size should be doubled due to 2x zoom
      expect(fontSize).toBeCloseTo(24, 0);
    });
  });

  describe("text selection support", () => {
    it("positions spans for accurate text selection", () => {
      const chars = createMockWord("Select", 100, 700);

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(6);

      // Verify spans are positioned sequentially
      for (let i = 1; i < spans.length; i++) {
        const prevLeft = parseFloat(spans[i - 1].style.left ?? "0");
        const currLeft = parseFloat(spans[i].style.left ?? "0");
        expect(currLeft).toBeGreaterThan(prevLeft);
      }
    });

    it("enables pointer events on spans for selection", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.pointerEvents).toBe("auto");
    });

    it("disables pointer events on container", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      expect(container.style.pointerEvents).toBe("none");
    });

    it("makes text transparent for invisible selection layer", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.color).toBe("transparent");
    });
  });

  describe("search result highlighting support", () => {
    it("provides data attributes for search highlighting", () => {
      const chars = createMockWord("Search", 100, 700);

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");

      // Each span should have data-index for targeting
      spans.forEach((span, i) => {
        expect(span.getAttribute("data-index")).toBe(String(i));
      });
    });

    it("provides data-char attribute for character identification", () => {
      const chars = createMockWord("Find", 100, 700);

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans[0].getAttribute("data-char")).toBe("F");
      expect(spans[1].getAttribute("data-char")).toBe("i");
      expect(spans[2].getAttribute("data-char")).toBe("n");
      expect(spans[3].getAttribute("data-char")).toBe("d");
    });

    it("builds layer with continuous sequence indices", () => {
      const line1 = createMockParagraph(["Line 1"], 100, 700);
      const line2 = createMockParagraph(["Line 2"], 100, 680);

      // Manually adjust sequence indices for line 2
      line2.forEach((char, i) => {
        char.sequenceIndex = line1.length + i;
      });

      const allChars = [...line1, ...line2];
      builder.buildTextLayer(allChars);

      const spans = container.querySelectorAll("span");

      // Verify sequence indices are continuous
      for (let i = 0; i < spans.length; i++) {
        expect(spans[i].getAttribute("data-index")).toBe(String(i));
      }
    });
  });

  describe("font handling in viewer context", () => {
    const fontMappings: Array<{ pdfFont: string; expectedFamily: string }> = [
      { pdfFont: "Helvetica", expectedFamily: "Helvetica" },
      { pdfFont: "/Helvetica", expectedFamily: "Helvetica" },
      { pdfFont: "Helvetica-Bold", expectedFamily: "Helvetica" },
      { pdfFont: "Times-Roman", expectedFamily: "Times New Roman" },
      { pdfFont: "Times-Bold", expectedFamily: "Times New Roman" },
      { pdfFont: "Courier", expectedFamily: "Courier New" },
      { pdfFont: "Courier-Bold", expectedFamily: "Courier New" },
    ];

    for (const { pdfFont, expectedFamily } of fontMappings) {
      it(`maps ${pdfFont} to ${expectedFamily}`, () => {
        const chars = [createMockChar({ fontName: pdfFont })];

        builder.buildTextLayer(chars);

        const span = container.querySelector("span");
        expect(span?.style.fontFamily).toContain(expectedFamily);
      });
    }

    it("falls back to sans-serif for unknown fonts", () => {
      const chars = [createMockChar({ fontName: "CustomFont-Regular" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.fontFamily).toBe("sans-serif");
    });

    it("handles mixed fonts in same text layer", () => {
      const chars = [
        createMockChar({ char: "H", fontName: "Helvetica", sequenceIndex: 0 }),
        createMockChar({
          char: "T",
          fontName: "Times-Roman",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 10, height: 12 },
        }),
        createMockChar({
          char: "C",
          fontName: "Courier",
          sequenceIndex: 2,
          bbox: { x: 120, y: 700, width: 10, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans[0].style.fontFamily).toContain("Helvetica");
      expect(spans[1].style.fontFamily).toContain("Times New Roman");
      expect(spans[2].style.fontFamily).toContain("Courier New");
    });
  });

  describe("whitespace handling", () => {
    it("creates spans for space characters", () => {
      const chars = [
        createMockChar({ char: "A", sequenceIndex: 0 }),
        createMockChar({
          char: " ",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 5, height: 12 },
        }),
        createMockChar({
          char: "B",
          sequenceIndex: 2,
          bbox: { x: 115, y: 700, width: 10, height: 12 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(3);
    });

    it("sets nowrap whitespace on spans", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.whiteSpace).toBe("nowrap");
    });

    it("handles tab characters", () => {
      const chars = [
        createMockChar({ char: "A", sequenceIndex: 0 }),
        createMockChar({
          char: "\t",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 40, height: 12 },
        }),
        createMockChar({
          char: "B",
          sequenceIndex: 2,
          bbox: { x: 150, y: 700, width: 10, height: 12 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(3);
    });
  });

  describe("special character handling", () => {
    it("handles HTML special characters", () => {
      const chars = [
        createMockChar({ char: "&", sequenceIndex: 0 }),
        createMockChar({
          char: "<",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 10, height: 12 },
        }),
        createMockChar({
          char: ">",
          sequenceIndex: 2,
          bbox: { x: 120, y: 700, width: 10, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("&");
      expect(spans[1].textContent).toBe("<");
      expect(spans[2].textContent).toBe(">");
    });

    it("handles Unicode characters", () => {
      const chars = [
        createMockChar({ char: "é", sequenceIndex: 0 }),
        createMockChar({
          char: "中",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 12, height: 12 },
        }),
        createMockChar({
          char: "日",
          sequenceIndex: 2,
          bbox: { x: 122, y: 700, width: 12, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("é");
      expect(spans[1].textContent).toBe("中");
      expect(spans[2].textContent).toBe("日");
    });

    it("handles emoji characters", () => {
      const chars = [
        createMockChar({ char: "😀", sequenceIndex: 0 }),
        createMockChar({
          char: "📄",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 12, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("😀");
      expect(spans[1].textContent).toBe("📄");
    });
  });

  describe("coordinate transformation", () => {
    it("converts PDF bottom-left to screen top-left", () => {
      // Character at PDF top-left (0, pageHeight)
      const chars = [
        createMockChar({
          bbox: { x: 0, y: LETTER_HEIGHT, width: 10, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const top = parseFloat(span?.style.top ?? "0");
      // PDF top should map to screen top (near 0)
      expect(top).toBeLessThan(20);
    });

    it("converts PDF bottom to screen bottom", () => {
      // Character at PDF bottom-left (0, 0)
      const chars = [
        createMockChar({
          bbox: { x: 0, y: 12, width: 10, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const top = parseFloat(span?.style.top ?? "0");
      // PDF bottom should map to screen bottom (near pageHeight)
      expect(top).toBeGreaterThan(LETTER_HEIGHT - 50);
    });

    it("applies scale transformation", () => {
      const scaledTransformer = createTransformer(LETTER_WIDTH, LETTER_HEIGHT, 2);
      const scaledBuilder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: scaledTransformer,
      });

      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 12 },
        }),
      ];

      scaledBuilder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const left = parseFloat(span?.style.left ?? "0");
      const width = parseFloat(span?.style.width ?? "0");

      // At 2x scale, positions and sizes should be doubled
      expect(left).toBeCloseTo(200, 0);
      expect(width).toBeCloseTo(20, 0);
    });
  });

  describe("container setup", () => {
    it("positions container absolutely", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.position).toBe("absolute");
    });

    it("fills parent container", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.left).toBe("0");
      expect(container.style.top).toBe("0");
      expect(container.style.right).toBe("0");
      expect(container.style.bottom).toBe("0");
    });

    it("hides overflow on container", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.overflow).toBe("hidden");
    });
  });

  describe("clear method", () => {
    it("removes all child elements", () => {
      builder.buildTextLayer([createMockChar(), createMockChar()]);
      expect(container.children.length).toBe(2);

      builder.clear();

      expect(container.children.length).toBe(0);
    });

    it("can be called multiple times safely", () => {
      builder.buildTextLayer([createMockChar()]);

      builder.clear();
      builder.clear();
      builder.clear();

      expect(container.children.length).toBe(0);
    });

    it("can be called on empty container", () => {
      expect(() => builder.clear()).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles empty character array", () => {
      const result = builder.buildTextLayer([]);

      expect(result.spanCount).toBe(0);
      expect(container.children.length).toBe(0);
    });

    it("skips characters with zero width", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 0, height: 12 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(0);
    });

    it("skips characters with zero height", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 0 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(0);
    });

    it("handles very small bounding boxes", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 0.5, height: 1 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(1);
    });

    it("handles negative coordinates", () => {
      const chars = [
        createMockChar({
          bbox: { x: -10, y: 700, width: 10, height: 12 },
        }),
      ];

      expect(() => builder.buildTextLayer(chars)).not.toThrow();
    });

    it("handles coordinates outside page bounds", () => {
      const chars = [
        createMockChar({
          bbox: { x: LETTER_WIDTH + 100, y: LETTER_HEIGHT + 100, width: 10, height: 12 },
        }),
      ];

      expect(() => builder.buildTextLayer(chars)).not.toThrow();
    });
  });

  describe("factory function", () => {
    it("creates builder via factory function", () => {
      const factoryBuilder = createTextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer,
      });

      expect(factoryBuilder).toBeInstanceOf(TextLayerBuilder);
      expect(factoryBuilder.container).toBe(container);
      expect(factoryBuilder.transformer).toBe(transformer);
    });
  });
});

describe("TextLayerBuilder performance scenarios", () => {
  let container: MockHTMLElement;
  let transformer: CoordinateTransformer;
  let builder: TextLayerBuilder;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;

    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tagName: string) => {
        if (tagName === "span") {
          return new MockSpanElement();
        }
        return new MockHTMLElement();
      },
    };

    container = createMockContainer();
    transformer = createTransformer();
    builder = new TextLayerBuilder({
      container: container as unknown as HTMLElement,
      transformer,
    });
  });

  afterEach(() => {
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  it("handles large text content efficiently", () => {
    // Create 1000 characters
    const chars: ExtractedChar[] = [];
    for (let i = 0; i < 1000; i++) {
      chars.push(
        createMockChar({
          char: String.fromCharCode(65 + (i % 26)),
          sequenceIndex: i,
          bbox: {
            x: (i % 50) * 12,
            y: 700 - Math.floor(i / 50) * 14,
            width: 10,
            height: 12,
          },
        }),
      );
    }

    const start = performance.now();
    const result = builder.buildTextLayer(chars);
    const duration = performance.now() - start;

    expect(result.spanCount).toBe(1000);
    expect(duration).toBeLessThan(1000); // Should complete in reasonable time
  });

  it("handles rapid rebuilding", () => {
    const chars = createMockWord("Test", 100, 700);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      builder.buildTextLayer(chars);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000);
  });
});
