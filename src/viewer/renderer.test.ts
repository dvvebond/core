import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  createIntelligentRenderer,
  detectContentType,
  IntelligentRenderer,
  quickAnalyze,
} from "./renderer";
import { RenderingType } from "./rendering-types";

describe("IntelligentRenderer", () => {
  let renderer: IntelligentRenderer;

  beforeEach(async () => {
    renderer = new IntelligentRenderer({ debug: false });
    await renderer.initialize();
  });

  afterEach(() => {
    renderer.destroy();
  });

  describe("constructor", () => {
    it("creates renderer with default options", () => {
      const r = new IntelligentRenderer();
      expect(r).toBeInstanceOf(IntelligentRenderer);
    });

    it("creates renderer with custom options", () => {
      const r = new IntelligentRenderer({
        enableAnalysis: false,
        cacheAnalysis: false,
        debug: true,
      });
      expect(r).toBeInstanceOf(IntelligentRenderer);
    });
  });

  describe("initialize", () => {
    it("initializes successfully", async () => {
      const r = new IntelligentRenderer();
      await r.initialize();

      expect(r.initialized).toBe(true);
      r.destroy();
    });

    it("can be called multiple times safely", async () => {
      const r = new IntelligentRenderer();
      await r.initialize();
      await r.initialize();

      expect(r.initialized).toBe(true);
      r.destroy();
    });

    it("initializes underlying renderers", async () => {
      expect(renderer.getCanvasRenderer()).not.toBeNull();
      expect(renderer.getSVGRenderer()).not.toBeNull();
    });
  });

  describe("createViewport", () => {
    it("creates viewport with given dimensions", () => {
      const viewport = renderer.createViewport(612, 792, 0, 1, 0);

      expect(viewport.width).toBe(612);
      expect(viewport.height).toBe(792);
      expect(viewport.scale).toBe(1);
      expect(viewport.rotation).toBe(0);
    });

    it("creates viewport with rotation", () => {
      const viewport = renderer.createViewport(612, 792, 90, 1, 0);

      expect(viewport.rotation).toBe(90);
      // Rotated 90 degrees swaps width/height
      expect(viewport.width).toBe(792);
      expect(viewport.height).toBe(612);
    });

    it("creates viewport with scale", () => {
      const viewport = renderer.createViewport(612, 792, 0, 2, 0);

      expect(viewport.width).toBe(1224);
      expect(viewport.height).toBe(1584);
      expect(viewport.scale).toBe(2);
    });

    it("throws if not initialized", () => {
      const r = new IntelligentRenderer();

      expect(() => r.createViewport(612, 792, 0)).toThrow();
    });
  });

  describe("analyzeContent", () => {
    it("analyzes content and returns result", () => {
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hello) Tj\nET");
      const result = renderer.analyzeContent(content, 0);

      expect(result).toBeDefined();
      expect(result.renderingType).toBeDefined();
      expect(result.composition).toBeDefined();
    });

    it("caches analysis results", () => {
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hello) Tj\nET");

      const result1 = renderer.analyzeContent(content, 0);
      const result2 = renderer.analyzeContent(content, 0);

      // Same object should be returned from cache
      expect(result1).toBe(result2);
    });

    it("returns different results for different pages", () => {
      const content1 = new TextEncoder().encode("BT\n(Text) Tj\nET");
      const content2 = new TextEncoder().encode("100 100 m\n200 200 l\nS");

      const result1 = renderer.analyzeContent(content1, 0);
      const result2 = renderer.analyzeContent(content2, 1);

      expect(result1.composition.textOperatorCount).toBeGreaterThan(
        result2.composition.textOperatorCount,
      );
    });
  });

  describe("getStrategy", () => {
    it("returns strategy based on content analysis", () => {
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hello) Tj\nET");
      const strategy = renderer.getStrategy(content, 0);

      expect(strategy).toBeDefined();
      expect(strategy.rendererType).toBeDefined();
      expect(strategy.rendererOptions).toBeDefined();
    });

    it("returns default strategy when analysis disabled", async () => {
      const r = new IntelligentRenderer({ enableAnalysis: false });
      await r.initialize();

      const content = new TextEncoder().encode("BT\n(Hello) Tj\nET");
      const strategy = r.getStrategy(content, 0);

      expect(strategy.rendererType).toBe("canvas");

      r.destroy();
    });
  });

  describe("detectRenderingType", () => {
    it("detects vector content", () => {
      const content = new TextEncoder().encode(
        "BT\n/F1 12 Tf\n(Hello World) Tj\nET\n100 100 m\n200 200 l\nS",
      );
      const type = renderer.detectRenderingType(content, 0);

      expect(type).toBe(RenderingType.Vector);
    });

    it("detects unknown for empty content", () => {
      const type = renderer.detectRenderingType(new Uint8Array(0), 0);

      expect(type).toBe(RenderingType.Unknown);
    });
  });

  describe("render", () => {
    it("throws if not initialized", () => {
      const r = new IntelligentRenderer();
      const viewport = { width: 612, height: 792, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };

      expect(() => r.render(0, viewport)).toThrow();
    });

    it("renders with content bytes", async () => {
      const viewport = renderer.createViewport(612, 792, 0);
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Test) Tj\nET");

      const task = renderer.render(0, viewport, content);
      const result = await task.promise;

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it("renders without content bytes", async () => {
      const viewport = renderer.createViewport(612, 792, 0);

      const task = renderer.render(0, viewport, null);
      const result = await task.promise;

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it("returns extended result with analysis", async () => {
      const viewport = renderer.createViewport(612, 792, 0);
      const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Test) Tj\nET");

      const task = renderer.render(0, viewport, content);
      const result = await task.promise;

      // Extended result includes analysis and strategy
      expect((result as any).analysis).toBeDefined();
      expect((result as any).strategy).toBeDefined();
      expect((result as any).rendererUsed).toBeDefined();
    });

    it("can be cancelled", async () => {
      const viewport = renderer.createViewport(612, 792, 0);

      const task = renderer.render(0, viewport);
      task.cancel();

      expect(task.cancelled).toBe(true);
      await expect(task.promise).rejects.toThrow("cancelled");
    });
  });

  describe("renderWithType", () => {
    it("renders with explicit canvas type", async () => {
      const viewport = renderer.createViewport(612, 792, 0);
      const content = new TextEncoder().encode("BT\n(Test) Tj\nET");

      const task = renderer.renderWithType(0, viewport, content, null, "canvas");
      const result = await task.promise;

      expect(result.width).toBeGreaterThan(0);
    });

    it("renders with explicit svg type", async () => {
      const viewport = renderer.createViewport(612, 792, 0);
      const content = new TextEncoder().encode("BT\n(Test) Tj\nET");

      const task = renderer.renderWithType(0, viewport, content, null, "svg");
      const result = await task.promise;

      expect(result.width).toBeGreaterThan(0);
    });

    it("throws if not initialized", () => {
      const r = new IntelligentRenderer();
      const viewport = { width: 612, height: 792, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };

      expect(() => r.renderWithType(0, viewport)).toThrow();
    });
  });

  describe("clearAnalysisCache", () => {
    it("clears all cached analysis", () => {
      const content = new TextEncoder().encode("BT\n(Test) Tj\nET");

      const result1 = renderer.analyzeContent(content, 0);
      renderer.clearAnalysisCache();
      const result2 = renderer.analyzeContent(content, 0);

      // Different objects after cache clear
      expect(result1).not.toBe(result2);
    });

    it("clears specific page cache", () => {
      const content = new TextEncoder().encode("BT\n(Test) Tj\nET");

      renderer.analyzeContent(content, 0);
      renderer.analyzeContent(content, 1);

      renderer.clearAnalysisCache(0);

      const result0 = renderer.analyzeContent(content, 0);
      const result1 = renderer.analyzeContent(content, 1);

      // Page 0 should be re-analyzed, page 1 should be cached
      expect(result0).not.toBe(result1);
    });
  });

  describe("destroy", () => {
    it("cleans up resources", () => {
      renderer.destroy();

      expect(renderer.initialized).toBe(false);
      expect(renderer.getCanvasRenderer()).toBeNull();
      expect(renderer.getSVGRenderer()).toBeNull();
    });

    it("can be called multiple times", () => {
      renderer.destroy();
      renderer.destroy();

      expect(renderer.initialized).toBe(false);
    });
  });
});

describe("createIntelligentRenderer", () => {
  it("creates renderer with default options", () => {
    const renderer = createIntelligentRenderer();
    expect(renderer).toBeInstanceOf(IntelligentRenderer);
  });

  it("creates renderer with custom options", () => {
    const renderer = createIntelligentRenderer({
      enableAnalysis: false,
      debug: true,
    });
    expect(renderer).toBeInstanceOf(IntelligentRenderer);
  });
});

describe("quickAnalyze", () => {
  it("analyzes content without renderer initialization", () => {
    const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hello) Tj\nET");
    const result = quickAnalyze(content);

    expect(result).toBeDefined();
    expect(result.renderingType).toBeDefined();
    expect(result.composition.textOperatorCount).toBeGreaterThan(0);
  });

  it("accepts custom analyzer options", () => {
    const content = new TextEncoder().encode("BT\n(Test) Tj\nET");
    const result = quickAnalyze(content, { maxOperatorsToAnalyze: 100 });

    expect(result).toBeDefined();
  });

  it("handles empty content", () => {
    const result = quickAnalyze(new Uint8Array(0));

    expect(result.renderingType).toBe(RenderingType.Unknown);
  });
});

describe("detectContentType", () => {
  it("detects rendering type from content", () => {
    const content = new TextEncoder().encode("BT\n/F1 12 Tf\n(Hello World) Tj\nET");
    const type = detectContentType(content);

    expect(type).toBe(RenderingType.Vector);
  });

  it("returns Unknown for empty content", () => {
    const type = detectContentType(new Uint8Array(0));

    expect(type).toBe(RenderingType.Unknown);
  });

  it("accepts custom options", () => {
    const content = new TextEncoder().encode("BT\n(Test) Tj\nET");
    const type = detectContentType(content, { maxOperatorsToAnalyze: 50 });

    expect(type).toBeDefined();
  });
});

describe("integration with different content types", () => {
  let renderer: IntelligentRenderer;

  beforeEach(async () => {
    renderer = new IntelligentRenderer();
    await renderer.initialize();
  });

  afterEach(() => {
    renderer.destroy();
  });

  it("handles text-heavy content", async () => {
    const lines = [];
    for (let i = 0; i < 20; i++) {
      lines.push(`0 ${-i * 14} Td\n(Line ${i + 1}) Tj`);
    }
    const content = new TextEncoder().encode(`BT\n/F1 12 Tf\n100 700 Td\n${lines.join("\n")}\nET`);

    const analysis = renderer.analyzeContent(content, 0);
    expect(analysis.renderingType).toBe(RenderingType.Vector);
    expect(analysis.composition.textOperatorCount).toBeGreaterThan(10);
  });

  it("handles path-heavy content", async () => {
    const paths = [];
    for (let i = 0; i < 50; i++) {
      paths.push(`${i * 10} ${i * 5} m\n${i * 10 + 50} ${i * 5 + 50} l\nS`);
    }
    const content = new TextEncoder().encode(paths.join("\n"));

    const analysis = renderer.analyzeContent(content, 0);
    expect(analysis.composition.pathOperatorCount).toBeGreaterThan(40);
  });

  it("handles mixed content", async () => {
    const content = new TextEncoder().encode(
      "BT\n/F1 12 Tf\n100 700 Td\n(Title) Tj\nET\n" +
        "100 600 m\n500 600 l\nS\n" +
        "BT\n/F1 10 Tf\n100 580 Td\n(Body text) Tj\nET",
    );

    const analysis = renderer.analyzeContent(content, 0);
    expect(analysis.composition.textOperatorCount).toBeGreaterThan(0);
    expect(analysis.composition.pathOperatorCount).toBeGreaterThan(0);
  });

  it("handles graphics state nesting", async () => {
    const content = new TextEncoder().encode(
      "q\n" + "1 0 0 1 100 100 cm\n" + "q\n" + "0.5 g\n" + "100 100 200 200 re\nf\n" + "Q\n" + "Q",
    );

    const analysis = renderer.analyzeContent(content, 0);
    expect(analysis.graphicsCharacteristics.maxGraphicsStateDepth).toBeGreaterThanOrEqual(2);
  });
});
