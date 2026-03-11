import { describe, expect, it } from "vitest";

import {
  createRenderingStrategySelector,
  getDefaultStrategy,
  getStrategyForType,
  RenderingStrategySelector,
} from "./rendering-strategy";
import {
  createDefaultAnalysisResult,
  RenderingType,
  type ContentAnalysisResult,
} from "./rendering-types";

describe("rendering-strategy", () => {
  describe("getDefaultStrategy", () => {
    it("returns a valid strategy with default values", () => {
      const strategy = getDefaultStrategy();

      expect(strategy.rendererType).toBe("canvas");
      expect(strategy.rendererOptions.scale).toBe(1);
      expect(strategy.generateTextLayer).toBe(true);
      expect(strategy.enableAnnotations).toBe(true);
    });

    it("has caching disabled by default", () => {
      const strategy = getDefaultStrategy();

      expect(strategy.caching.enabled).toBe(false);
      expect(strategy.caching.ttlMs).toBe(60000);
      expect(strategy.caching.maxVersions).toBe(1);
      expect(strategy.caching.cacheMultipleScales).toBe(false);
    });

    it("has priority settings", () => {
      const strategy = getDefaultStrategy();

      expect(strategy.priority.immediate).toBe(true);
      expect(strategy.priority.level).toBe(1);
      expect(strategy.priority.prefetchAdjacent).toBe(true);
    });

    it("returns a new instance each time", () => {
      const strategy1 = getDefaultStrategy();
      const strategy2 = getDefaultStrategy();

      expect(strategy1).not.toBe(strategy2);
    });
  });

  describe("getStrategyForType", () => {
    it("returns appropriate strategy for Vector type", () => {
      const strategy = getStrategyForType(RenderingType.Vector);

      expect(strategy.rendererOptions.scale).toBe(1.5);
      expect(strategy.generateTextLayer).toBe(true);
    });

    it("returns appropriate strategy for ImageBased type", () => {
      const strategy = getStrategyForType(RenderingType.ImageBased);

      expect(strategy.generateTextLayer).toBe(false);
      expect(strategy.caching.enabled).toBe(true);
      expect(strategy.caching.ttlMs).toBe(300000);
    });

    it("returns appropriate strategy for OCR type", () => {
      const strategy = getStrategyForType(RenderingType.OCR);

      expect(strategy.generateTextLayer).toBe(true);
      expect(strategy.caching.enabled).toBe(true);
    });

    it("returns appropriate strategy for Flattened type", () => {
      const strategy = getStrategyForType(RenderingType.Flattened);

      expect(strategy.rendererOptions.scale).toBe(1.25);
    });

    it("returns appropriate strategy for Hybrid type", () => {
      const strategy = getStrategyForType(RenderingType.Hybrid);

      expect(strategy.caching.enabled).toBe(true);
      expect(strategy.caching.ttlMs).toBe(120000);
    });

    it("returns default strategy for Unknown type", () => {
      const strategy = getStrategyForType(RenderingType.Unknown);

      expect(strategy.rendererType).toBe("canvas");
      expect(strategy.generateTextLayer).toBe(true);
    });
  });

  describe("RenderingStrategySelector", () => {
    describe("constructor", () => {
      it("creates with default options", () => {
        const selector = new RenderingStrategySelector();
        expect(selector).toBeInstanceOf(RenderingStrategySelector);
      });

      it("creates with custom options", () => {
        const selector = new RenderingStrategySelector({
          defaultRenderer: "svg",
          defaultScale: 2,
          textLayerEnabled: false,
          annotationsEnabled: false,
          maxCacheTtl: 600000,
        });
        expect(selector).toBeInstanceOf(RenderingStrategySelector);
      });
    });

    describe("selectStrategy", () => {
      it("selects strategy based on analysis result", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.Vector;
        analysis.hints.preferredRenderer = "canvas";

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy).toBeDefined();
        expect(strategy.rendererType).toBeDefined();
      });

      it("uses hint preferences when available", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.Vector;
        analysis.hints.preferredRenderer = "svg";

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.rendererType).toBe("svg");
      });

      it("generates text layer based on analysis", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.Vector;
        analysis.textCharacteristics.visibleTextCount = 100;
        analysis.hints.generateTextLayer = true;

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.generateTextLayer).toBe(true);
      });

      it("disables text layer for pure image content", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.ImageBased;
        analysis.textCharacteristics.visibleTextCount = 0;
        analysis.textCharacteristics.hasInvisibleText = false;
        analysis.hints.generateTextLayer = false;

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.generateTextLayer).toBe(false);
      });

      it("enables caching for complex content", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.ImageBased;
        analysis.shouldCache = true;

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.caching.enabled).toBe(true);
      });

      it("sets high priority for initial pages", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.priority.level).toBe(0);
        expect(strategy.priority.immediate).toBe(true);
      });

      it("sets lower priority for later pages", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.composition.totalOperatorCount = 50; // Simple page

        const strategy = selector.selectStrategy(analysis, 10);

        expect(strategy.priority.level).toBeGreaterThan(0);
      });
    });

    describe("respects global options", () => {
      it("respects textLayerEnabled option", () => {
        const selector = new RenderingStrategySelector({
          textLayerEnabled: false,
        });
        const analysis = createDefaultAnalysisResult();
        analysis.hints.generateTextLayer = true;

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.generateTextLayer).toBe(false);
      });

      it("respects annotationsEnabled option", () => {
        const selector = new RenderingStrategySelector({
          annotationsEnabled: false,
        });
        const analysis = createDefaultAnalysisResult();

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.enableAnnotations).toBe(false);
      });

      it("respects forceRenderer option", () => {
        const selector = new RenderingStrategySelector({
          forceRenderer: "svg",
        });
        const analysis = createDefaultAnalysisResult();
        analysis.hints.preferredRenderer = "canvas";

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.rendererType).toBe("svg");
      });

      it("caps cache TTL to maxCacheTtl", () => {
        const selector = new RenderingStrategySelector({
          maxCacheTtl: 60000,
        });
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.ImageBased;
        analysis.shouldCache = true;

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.caching.ttlMs).toBeLessThanOrEqual(60000);
      });
    });

    describe("scale calculation", () => {
      it("uses higher scale for vector content", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.renderingType = RenderingType.Vector;
        analysis.hints.suggestedScale = 1;

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.rendererOptions.scale).toBeGreaterThanOrEqual(1);
      });

      it("caps scale to reasonable range", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.hints.suggestedScale = 10; // Unreasonably high

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.rendererOptions.scale).toBeLessThanOrEqual(3);
      });

      it("uses minimum scale of 0.5", () => {
        const selector = new RenderingStrategySelector();
        const analysis = createDefaultAnalysisResult();
        analysis.hints.suggestedScale = 0.1; // Very low

        const strategy = selector.selectStrategy(analysis, 0);

        expect(strategy.rendererOptions.scale).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe("createRenderingStrategySelector", () => {
    it("creates a selector with default options", () => {
      const selector = createRenderingStrategySelector();
      expect(selector).toBeInstanceOf(RenderingStrategySelector);
    });

    it("creates a selector with custom options", () => {
      const selector = createRenderingStrategySelector({
        defaultRenderer: "svg",
      });
      expect(selector).toBeInstanceOf(RenderingStrategySelector);
    });
  });

  describe("SVG vs Canvas selection", () => {
    it("selects SVG for simple vector content", () => {
      const selector = new RenderingStrategySelector();
      const analysis = createDefaultAnalysisResult();
      analysis.renderingType = RenderingType.Vector;
      analysis.composition.totalOperatorCount = 100;
      analysis.composition.imageXObjectCount = 0;
      analysis.hints.preferredRenderer = "svg";

      const strategy = selector.selectStrategy(analysis, 0);

      expect(strategy.rendererType).toBe("svg");
    });

    it("prefers canvas for image content", () => {
      const selector = new RenderingStrategySelector();
      const analysis = createDefaultAnalysisResult();
      analysis.renderingType = RenderingType.ImageBased;
      analysis.hints.preferredRenderer = "canvas";

      const strategy = selector.selectStrategy(analysis, 0);

      expect(strategy.rendererType).toBe("canvas");
    });
  });

  describe("caching strategy details", () => {
    it("enables multiple scale caching for images", () => {
      const selector = new RenderingStrategySelector();
      const analysis = createDefaultAnalysisResult();
      analysis.renderingType = RenderingType.ImageBased;
      analysis.shouldCache = true;

      const strategy = selector.selectStrategy(analysis, 0);

      expect(strategy.caching.cacheMultipleScales).toBe(true);
    });

    it("limits cache versions for vector content", () => {
      const selector = new RenderingStrategySelector();
      const analysis = createDefaultAnalysisResult();
      analysis.renderingType = RenderingType.Vector;
      analysis.composition.totalOperatorCount = 2000;
      analysis.shouldCache = true;

      const strategy = selector.selectStrategy(analysis, 0);

      expect(strategy.caching.maxVersions).toBeLessThanOrEqual(3);
    });
  });
});
