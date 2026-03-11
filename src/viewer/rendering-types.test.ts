import { describe, expect, it } from "vitest";

import {
  createDefaultAnalysisResult,
  createDefaultRenderingHints,
  RenderingType,
  type ContentAnalysisResult,
  type ContentComposition,
  type GraphicsCharacteristics,
  type ImageCharacteristics,
  type RenderingHints,
  type TextCharacteristics,
} from "./rendering-types";

describe("rendering-types", () => {
  describe("RenderingType enum", () => {
    it("has all expected rendering types", () => {
      expect(RenderingType.Vector).toBe("vector");
      expect(RenderingType.ImageBased).toBe("image-based");
      expect(RenderingType.OCR).toBe("ocr");
      expect(RenderingType.Flattened).toBe("flattened");
      expect(RenderingType.Hybrid).toBe("hybrid");
      expect(RenderingType.Unknown).toBe("unknown");
    });

    it("has exactly 6 rendering types", () => {
      const values = Object.values(RenderingType);
      expect(values).toHaveLength(6);
    });
  });

  describe("createDefaultAnalysisResult", () => {
    it("returns a valid ContentAnalysisResult", () => {
      const result = createDefaultAnalysisResult();

      expect(result.renderingType).toBe(RenderingType.Unknown);
      expect(result.confidence).toBe(0);
      expect(result.shouldCache).toBe(false);
    });

    it("has zero composition values", () => {
      const result = createDefaultAnalysisResult();

      expect(result.composition.vectorPathPercent).toBe(0);
      expect(result.composition.textPercent).toBe(0);
      expect(result.composition.imagePercent).toBe(0);
      expect(result.composition.pathOperatorCount).toBe(0);
      expect(result.composition.textOperatorCount).toBe(0);
      expect(result.composition.xObjectCount).toBe(0);
      expect(result.composition.imageXObjectCount).toBe(0);
      expect(result.composition.formXObjectCount).toBe(0);
      expect(result.composition.totalOperatorCount).toBe(0);
    });

    it("has default text characteristics", () => {
      const result = createDefaultAnalysisResult();

      expect(result.textCharacteristics.hasInvisibleText).toBe(false);
      expect(result.textCharacteristics.invisibleTextCount).toBe(0);
      expect(result.textCharacteristics.visibleTextCount).toBe(0);
      expect(result.textCharacteristics.hasVerySmallText).toBe(false);
      expect(result.textCharacteristics.uniqueFontCount).toBe(0);
      expect(result.textCharacteristics.hasCIDFonts).toBe(false);
    });

    it("has default image characteristics", () => {
      const result = createDefaultAnalysisResult();

      expect(result.imageCharacteristics.imageCount).toBe(0);
      expect(result.imageCharacteristics.hasFullPageImage).toBe(false);
      expect(result.imageCharacteristics.hasInlineImages).toBe(false);
      expect(result.imageCharacteristics.inlineImageCount).toBe(0);
    });

    it("has default graphics characteristics", () => {
      const result = createDefaultAnalysisResult();

      expect(result.graphicsCharacteristics.hasTransparency).toBe(false);
      expect(result.graphicsCharacteristics.hasShading).toBe(false);
      expect(result.graphicsCharacteristics.hasClipping).toBe(false);
      expect(result.graphicsCharacteristics.maxGraphicsStateDepth).toBe(0);
    });

    it("includes default rendering hints", () => {
      const result = createDefaultAnalysisResult();

      expect(result.hints).toBeDefined();
      expect(result.hints.preferredRenderer).toBe("canvas");
      expect(result.hints.enableSubpixelText).toBe(true);
      expect(result.hints.enableImageSmoothing).toBe(true);
      expect(result.hints.suggestedScale).toBe(1);
      expect(result.hints.generateTextLayer).toBe(true);
      expect(result.hints.renderPriority).toBe("balanced");
    });

    it("returns a new instance each time", () => {
      const result1 = createDefaultAnalysisResult();
      const result2 = createDefaultAnalysisResult();

      expect(result1).not.toBe(result2);
      expect(result1.composition).not.toBe(result2.composition);
      expect(result1.hints).not.toBe(result2.hints);
    });
  });

  describe("createDefaultRenderingHints", () => {
    it("returns default hints with canvas renderer", () => {
      const hints = createDefaultRenderingHints();

      expect(hints.preferredRenderer).toBe("canvas");
    });

    it("enables text-related features by default", () => {
      const hints = createDefaultRenderingHints();

      expect(hints.enableSubpixelText).toBe(true);
      expect(hints.generateTextLayer).toBe(true);
    });

    it("enables image smoothing by default", () => {
      const hints = createDefaultRenderingHints();

      expect(hints.enableImageSmoothing).toBe(true);
    });

    it("has default scale of 1", () => {
      const hints = createDefaultRenderingHints();

      expect(hints.suggestedScale).toBe(1);
    });

    it("has balanced render priority", () => {
      const hints = createDefaultRenderingHints();

      expect(hints.renderPriority).toBe("balanced");
    });

    it("returns a new instance each time", () => {
      const hints1 = createDefaultRenderingHints();
      const hints2 = createDefaultRenderingHints();

      expect(hints1).not.toBe(hints2);
    });
  });

  describe("Type interfaces", () => {
    it("ContentComposition interface has required properties", () => {
      const composition: ContentComposition = {
        vectorPathPercent: 50,
        textPercent: 30,
        imagePercent: 20,
        pathOperatorCount: 100,
        textOperatorCount: 50,
        xObjectCount: 5,
        imageXObjectCount: 3,
        formXObjectCount: 2,
        totalOperatorCount: 200,
      };

      expect(composition.vectorPathPercent).toBe(50);
      expect(composition.textPercent).toBe(30);
      expect(composition.imagePercent).toBe(20);
    });

    it("TextCharacteristics interface has required properties", () => {
      const text: TextCharacteristics = {
        hasInvisibleText: true,
        invisibleTextCount: 10,
        visibleTextCount: 90,
        hasVerySmallText: false,
        uniqueFontCount: 3,
        hasCIDFonts: true,
      };

      expect(text.hasInvisibleText).toBe(true);
      expect(text.hasCIDFonts).toBe(true);
    });

    it("ImageCharacteristics interface has required properties", () => {
      const image: ImageCharacteristics = {
        imageCount: 5,
        hasFullPageImage: true,
        hasInlineImages: false,
        inlineImageCount: 0,
      };

      expect(image.imageCount).toBe(5);
      expect(image.hasFullPageImage).toBe(true);
    });

    it("GraphicsCharacteristics interface has required properties", () => {
      const graphics: GraphicsCharacteristics = {
        hasTransparency: true,
        hasShading: false,
        hasClipping: true,
        maxGraphicsStateDepth: 5,
      };

      expect(graphics.hasTransparency).toBe(true);
      expect(graphics.maxGraphicsStateDepth).toBe(5);
    });

    it("RenderingHints interface has required properties", () => {
      const hints: RenderingHints = {
        preferredRenderer: "svg",
        enableSubpixelText: false,
        enableImageSmoothing: true,
        suggestedScale: 2,
        generateTextLayer: true,
        renderPriority: "text",
      };

      expect(hints.preferredRenderer).toBe("svg");
      expect(hints.renderPriority).toBe("text");
    });

    it("ContentAnalysisResult interface has all required sections", () => {
      const result: ContentAnalysisResult = {
        renderingType: RenderingType.Vector,
        confidence: 0.85,
        composition: {
          vectorPathPercent: 60,
          textPercent: 30,
          imagePercent: 10,
          pathOperatorCount: 500,
          textOperatorCount: 200,
          xObjectCount: 5,
          imageXObjectCount: 3,
          formXObjectCount: 2,
          totalOperatorCount: 800,
        },
        textCharacteristics: {
          hasInvisibleText: false,
          invisibleTextCount: 0,
          visibleTextCount: 200,
          hasVerySmallText: false,
          uniqueFontCount: 5,
          hasCIDFonts: false,
        },
        imageCharacteristics: {
          imageCount: 3,
          hasFullPageImage: false,
          hasInlineImages: false,
          inlineImageCount: 0,
        },
        graphicsCharacteristics: {
          hasTransparency: false,
          hasShading: false,
          hasClipping: false,
          maxGraphicsStateDepth: 2,
        },
        shouldCache: true,
        hints: {
          preferredRenderer: "canvas",
          enableSubpixelText: true,
          enableImageSmoothing: true,
          suggestedScale: 1.5,
          generateTextLayer: true,
          renderPriority: "text",
        },
      };

      expect(result.renderingType).toBe(RenderingType.Vector);
      expect(result.confidence).toBe(0.85);
      expect(result.shouldCache).toBe(true);
    });
  });

  describe("Rendering type semantics", () => {
    it("Vector type represents programmatic PDF content", () => {
      // Vector PDFs are created programmatically and contain primarily
      // path operators (m, l, c) and text operators (Tj, TJ)
      const vectorResult = createDefaultAnalysisResult();
      vectorResult.renderingType = RenderingType.Vector;
      vectorResult.composition.vectorPathPercent = 40;
      vectorResult.composition.textPercent = 50;
      vectorResult.composition.imagePercent = 10;

      expect(vectorResult.renderingType).toBe(RenderingType.Vector);
    });

    it("ImageBased type represents scanned or photo content", () => {
      // Image-based PDFs are dominated by image XObjects with little/no text
      const imageResult = createDefaultAnalysisResult();
      imageResult.renderingType = RenderingType.ImageBased;
      imageResult.imageCharacteristics.hasFullPageImage = true;
      imageResult.composition.imagePercent = 95;

      expect(imageResult.renderingType).toBe(RenderingType.ImageBased);
      expect(imageResult.imageCharacteristics.hasFullPageImage).toBe(true);
    });

    it("OCR type represents scanned documents with text overlay", () => {
      // OCR PDFs have a full-page image with invisible text overlay
      const ocrResult = createDefaultAnalysisResult();
      ocrResult.renderingType = RenderingType.OCR;
      ocrResult.imageCharacteristics.hasFullPageImage = true;
      ocrResult.textCharacteristics.hasInvisibleText = true;
      ocrResult.textCharacteristics.invisibleTextCount = 500;

      expect(ocrResult.renderingType).toBe(RenderingType.OCR);
      expect(ocrResult.textCharacteristics.hasInvisibleText).toBe(true);
    });

    it("Flattened type represents merged form/annotation content", () => {
      // Flattened PDFs have complex graphics state from merged layers
      const flattenedResult = createDefaultAnalysisResult();
      flattenedResult.renderingType = RenderingType.Flattened;
      flattenedResult.graphicsCharacteristics.hasTransparency = true;
      flattenedResult.graphicsCharacteristics.maxGraphicsStateDepth = 8;

      expect(flattenedResult.renderingType).toBe(RenderingType.Flattened);
      expect(flattenedResult.graphicsCharacteristics.maxGraphicsStateDepth).toBeGreaterThan(5);
    });

    it("Hybrid type represents mixed content", () => {
      // Hybrid PDFs have significant amounts of multiple content types
      const hybridResult = createDefaultAnalysisResult();
      hybridResult.renderingType = RenderingType.Hybrid;
      hybridResult.composition.vectorPathPercent = 30;
      hybridResult.composition.textPercent = 30;
      hybridResult.composition.imagePercent = 40;

      expect(hybridResult.renderingType).toBe(RenderingType.Hybrid);
    });
  });
});
