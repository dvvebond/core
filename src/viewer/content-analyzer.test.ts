import { describe, expect, it } from "vitest";

import { analyzeContent, ContentAnalyzer, createContentAnalyzer } from "./content-analyzer";
import { RenderingType } from "./rendering-types";

describe("ContentAnalyzer", () => {
  describe("createContentAnalyzer", () => {
    it("creates an analyzer with default options", () => {
      const analyzer = createContentAnalyzer();
      expect(analyzer).toBeInstanceOf(ContentAnalyzer);
    });

    it("creates an analyzer with custom options", () => {
      const analyzer = createContentAnalyzer({
        maxOperatorsToAnalyze: 5000,
        analyzeXObjects: true,
        pageDimensions: { width: 595, height: 842 },
      });
      expect(analyzer).toBeInstanceOf(ContentAnalyzer);
    });
  });

  describe("analyze", () => {
    it("returns default result for empty content", () => {
      const analyzer = new ContentAnalyzer();
      const result = analyzer.analyze(new Uint8Array(0));

      expect(result.renderingType).toBe(RenderingType.Unknown);
      expect(result.confidence).toBe(0);
      expect(result.composition.totalOperatorCount).toBe(0);
    });

    it("analyzes simple text content", () => {
      const analyzer = new ContentAnalyzer();
      // Simple content stream: "BT /F1 12 Tf 100 700 Td (Hello) Tj ET"
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n100 700 Td\n(Hello) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.composition.textOperatorCount).toBeGreaterThan(0);
      expect(result.textCharacteristics.visibleTextCount).toBeGreaterThan(0);
    });

    it("analyzes path construction operators", () => {
      const analyzer = new ContentAnalyzer();
      // Simple path: "100 100 m 200 100 l 200 200 l 100 200 l h S"
      const content = new TextEncoder().encode("100 100 m\n200 100 l\n200 200 l\n100 200 l\nh\nS");
      const result = analyzer.analyze(content);

      expect(result.composition.pathOperatorCount).toBeGreaterThan(0);
    });

    it("analyzes graphics state operators", () => {
      const analyzer = new ContentAnalyzer();
      // Nested graphics state: "q q q Q Q Q"
      const content = new TextEncoder().encode("q\nq\nq\nQ\nQ\nQ");
      const result = analyzer.analyze(content);

      expect(result.graphicsCharacteristics.maxGraphicsStateDepth).toBe(3);
    });

    it("detects clipping operations", () => {
      const analyzer = new ContentAnalyzer();
      // Path with clipping: "100 100 200 200 re W n"
      const content = new TextEncoder().encode("100 100 200 200 re\nW\nn");
      const result = analyzer.analyze(content);

      expect(result.graphicsCharacteristics.hasClipping).toBe(true);
    });

    it("handles malformed content gracefully", () => {
      const analyzer = new ContentAnalyzer();
      // Invalid content that might cause parsing errors
      const content = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
      const result = analyzer.analyze(content);

      // Should return default result without throwing
      expect(result.renderingType).toBe(RenderingType.Unknown);
    });
  });

  describe("text characteristics detection", () => {
    it("detects invisible text (render mode 3)", () => {
      const analyzer = new ContentAnalyzer();
      // Text with invisible render mode: "BT 3 Tr (Hidden) Tj ET"
      const content = new TextEncoder().encode("BT\n3 Tr\n(Hidden) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.textCharacteristics.hasInvisibleText).toBe(true);
      expect(result.textCharacteristics.invisibleTextCount).toBeGreaterThan(0);
    });

    it("detects visible text (render mode 0)", () => {
      const analyzer = new ContentAnalyzer();
      // Text with fill render mode: "BT 0 Tr (Visible) Tj ET"
      const content = new TextEncoder().encode("BT\n0 Tr\n(Visible) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.textCharacteristics.visibleTextCount).toBeGreaterThan(0);
    });

    it("detects very small text", () => {
      const analyzer = new ContentAnalyzer();
      // Very small font: "BT /F1 1 Tf (Tiny) Tj ET"
      const content = new TextEncoder().encode("BT\n/F1 1 Tf\n(Tiny) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.textCharacteristics.hasVerySmallText).toBe(true);
    });

    it("tracks unique fonts", () => {
      const analyzer = new ContentAnalyzer();
      // Multiple fonts: "BT /F1 12 Tf (Text1) Tj /F2 12 Tf (Text2) Tj ET"
      const content = new TextEncoder().encode(
        "BT\n/F1 12 Tf\n(Text1) Tj\n/F2 12 Tf\n(Text2) Tj\nET",
      );
      const result = analyzer.analyze(content);

      expect(result.textCharacteristics.uniqueFontCount).toBe(2);
    });
  });

  describe("rendering type classification", () => {
    it("classifies text-heavy content as Vector", () => {
      const analyzer = new ContentAnalyzer();
      // Multiple text operations
      const content = new TextEncoder().encode(
        "BT\n/F1 12 Tf\n100 700 Td\n(Line 1) Tj\n" +
          "0 -14 Td\n(Line 2) Tj\n" +
          "0 -14 Td\n(Line 3) Tj\n" +
          "0 -14 Td\n(Line 4) Tj\n" +
          "0 -14 Td\n(Line 5) Tj\nET",
      );
      const result = analyzer.analyze(content);

      expect(result.renderingType).toBe(RenderingType.Vector);
    });

    it("classifies path-heavy content as Vector", () => {
      const analyzer = new ContentAnalyzer();
      // Multiple path operations
      const paths: string[] = [];
      for (let i = 0; i < 20; i++) {
        paths.push(`${i * 10} ${i * 10} m\n${i * 10 + 50} ${i * 10} l\nS`);
      }
      const content = new TextEncoder().encode(paths.join("\n"));
      const result = analyzer.analyze(content);

      expect(result.renderingType).toBe(RenderingType.Vector);
    });

    it("assigns confidence scores", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hello) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("rendering hints generation", () => {
    it("generates hints for vector content", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.hints).toBeDefined();
      expect(result.hints.generateTextLayer).toBe(true);
    });

    it("suggests text layer for text content", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Selectable) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.hints.generateTextLayer).toBe(true);
    });
  });

  describe("caching recommendations", () => {
    it("recommends caching for complex content", () => {
      const analyzer = new ContentAnalyzer();
      // Generate a large content stream
      const ops: string[] = [];
      for (let i = 0; i < 500; i++) {
        ops.push(`${i} ${i} m\n${i + 10} ${i + 10} l\nS`);
      }
      const content = new TextEncoder().encode(ops.join("\n"));
      const result = analyzer.analyze(content);

      expect(result.shouldCache).toBe(true);
    });

    it("does not recommend caching for simple content", () => {
      const analyzer = new ContentAnalyzer();
      // Simple content
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hi) Tj\nET");
      const result = analyzer.analyze(content);

      expect(result.shouldCache).toBe(false);
    });
  });

  describe("analyzeContent convenience function", () => {
    it("analyzes content with default options", () => {
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Test) Tj\nET");
      const result = analyzeContent(content);

      expect(result).toBeDefined();
      expect(result.composition).toBeDefined();
      expect(result.textCharacteristics).toBeDefined();
    });

    it("analyzes content with resources", () => {
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Test) Tj\nET");
      const resources = {
        fonts: new Map([["F1", { subtype: "Type1", isCID: false }]]),
      };
      const result = analyzeContent(content, resources);

      expect(result).toBeDefined();
    });
  });

  describe("options", () => {
    it("respects maxOperatorsToAnalyze limit", () => {
      const analyzer = new ContentAnalyzer({ maxOperatorsToAnalyze: 5 });
      // Generate more operators than the limit
      const ops: string[] = [];
      for (let i = 0; i < 20; i++) {
        ops.push(`${i} ${i} m`);
      }
      const content = new TextEncoder().encode(ops.join("\n"));
      const result = analyzer.analyze(content);

      // Should still return a result without error
      expect(result).toBeDefined();
    });

    it("uses custom page dimensions for analysis", () => {
      const analyzer = new ContentAnalyzer({
        pageDimensions: { width: 1000, height: 1000 },
      });
      const content = new TextEncoder().encode("100 100 m\n200 200 l\nS");
      const result = analyzer.analyze(content);

      expect(result).toBeDefined();
    });
  });

  describe("color operators", () => {
    it("handles RGB color operators", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("1 0 0 rg\n100 100 200 50 re\nf");
      const result = analyzer.analyze(content);

      expect(result.composition.pathOperatorCount).toBeGreaterThan(0);
    });

    it("handles grayscale color operators", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("0.5 g\n100 100 200 50 re\nf");
      const result = analyzer.analyze(content);

      expect(result.composition.pathOperatorCount).toBeGreaterThan(0);
    });

    it("handles CMYK color operators", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("0 1 1 0 k\n100 100 200 50 re\nf");
      const result = analyzer.analyze(content);

      expect(result.composition.pathOperatorCount).toBeGreaterThan(0);
    });
  });

  describe("shading detection", () => {
    it("detects shading operators", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("/Sh1 sh");
      const result = analyzer.analyze(content);

      expect(result.graphicsCharacteristics.hasShading).toBe(true);
    });
  });

  describe("extended graphics state", () => {
    it("detects ExtGState usage", () => {
      const analyzer = new ContentAnalyzer();
      const content = new TextEncoder().encode("/GS1 gs\n100 100 m\n200 200 l\nS");
      const result = analyzer.analyze(content);

      expect(result.graphicsCharacteristics.hasTransparency).toBe(true);
    });
  });
});
