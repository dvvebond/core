/**
 * Integration tests for viewer components.
 *
 * These tests verify that different viewer components work together correctly,
 * including renderers, text layers, search, highlights, and virtual scrolling.
 */

import { CoordinateTransformer } from "#src/coordinate-transformer";
import { SearchEngine } from "#src/frontend/search/SearchEngine";
import type { TextProvider, SearchResult } from "#src/frontend/search/types";
import { CanvasRenderer } from "#src/renderers/canvas-renderer";
import { SVGRenderer } from "#src/renderers/svg-renderer";
import { TextLayerBuilder } from "#src/renderers/text-layer-builder";
import type { BoundingBox } from "#src/text/types";
import type { ExtractedChar } from "#src/text/types";
import { VirtualScrollContainer } from "#src/viewer/virtual-scrolling/virtual-scroll-container";
import { VirtualScroller, type PageDimensions } from "#src/virtual-scroller";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Standard page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

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

  remove(): void {
    // Mock remove
  }
}

class MockSpanElement extends MockHTMLElement {}

class MockCanvasElement extends MockHTMLElement {
  width = 0;
  height = 0;

  getContext(_type: string): object {
    return {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
  }
}

/**
 * Create mock text provider.
 */
function createMockTextProvider(pages: string[]): TextProvider {
  return {
    getPageCount: () => pages.length,
    getPageText: async (pageIndex: number) => {
      if (pageIndex >= 0 && pageIndex < pages.length) {
        return pages[pageIndex];
      }
      return null;
    },
    getCharBounds: async (
      _pageIndex: number,
      startOffset: number,
      endOffset: number,
    ): Promise<BoundingBox[]> => {
      const boxes: BoundingBox[] = [];
      for (let i = startOffset; i < endOffset; i++) {
        boxes.push({
          x: 72 + (i % 60) * 10,
          y: 720 - Math.floor(i / 60) * 14,
          width: 10,
          height: 12,
        });
      }
      return boxes;
    },
  };
}

/**
 * Create mock extracted characters.
 */
function createMockChars(text: string, startX: number, y: number, charWidth = 10): ExtractedChar[] {
  return text.split("").map((char, i) => ({
    char,
    bbox: {
      x: startX + i * charWidth,
      y,
      width: charWidth,
      height: 12,
    },
    fontSize: 12,
    fontName: "Helvetica",
    baseline: y,
    sequenceIndex: i,
  }));
}

/**
 * Create page dimensions array.
 */
function createPages(count: number): PageDimensions[] {
  return Array(count)
    .fill(null)
    .map(() => ({
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
    }));
}

describe("Renderer and TextLayer integration", () => {
  let canvasRenderer: CanvasRenderer;
  let svgRenderer: SVGRenderer;
  let container: MockHTMLElement;
  let transformer: CoordinateTransformer;
  let textBuilder: TextLayerBuilder;
  let originalDocument: typeof globalThis.document;

  beforeEach(async () => {
    originalDocument = globalThis.document;
    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tagName: string) => {
        if (tagName === "span") {
          return new MockSpanElement();
        }
        if (tagName === "canvas") {
          return new MockCanvasElement();
        }
        return new MockHTMLElement();
      },
    };

    canvasRenderer = new CanvasRenderer();
    await canvasRenderer.initialize({ headless: true });

    svgRenderer = new SVGRenderer();
    await svgRenderer.initialize({ headless: true });

    container = new MockHTMLElement();
    transformer = new CoordinateTransformer({
      pageWidth: LETTER_WIDTH,
      pageHeight: LETTER_HEIGHT,
      scale: 1,
      viewerRotation: 0,
    });
    textBuilder = new TextLayerBuilder({
      container: container as unknown as HTMLElement,
      transformer,
    });
  });

  afterEach(() => {
    canvasRenderer.destroy();
    svgRenderer.destroy();
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("renderer and text layer coordinate alignment", () => {
    it("uses same viewport dimensions for both", async () => {
      const canvasViewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);
      const svgViewport = svgRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);

      expect(canvasViewport.width).toBe(svgViewport.width);
      expect(canvasViewport.height).toBe(svgViewport.height);
    });

    it("aligns text layer positions with renderer coordinate system", () => {
      const chars = createMockChars("Test", 100, 700);

      textBuilder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(4);

      // Check that spans are positioned using the same coordinate system
      const firstSpan = spans[0];
      const left = parseFloat(firstSpan.style.left ?? "0");

      // At scale 1, PDF x=100 should map to screen left=100
      expect(left).toBeCloseTo(100, 0);
    });

    it("maintains alignment at different zoom levels", () => {
      const scale = 2;
      const scaledTransformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale,
        viewerRotation: 0,
      });
      const scaledBuilder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: scaledTransformer,
      });

      const chars = createMockChars("Test", 100, 700);
      scaledBuilder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      const left = parseFloat(spans[0].style.left ?? "0");

      // At scale 2, PDF x=100 should map to screen left=200
      expect(left).toBeCloseTo(200, 0);
    });

    it("handles rotation consistently", () => {
      const rotatedTransformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
        viewerRotation: 90,
      });
      const rotatedBuilder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: rotatedTransformer,
      });

      const chars = createMockChars("Test", 100, 700);
      rotatedBuilder.buildTextLayer(chars);

      // Should not throw and should create spans
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(4);
    });
  });

  describe("renderer switching", () => {
    it("produces consistent viewports between renderers", () => {
      const viewport1 = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 1.5);
      const viewport2 = svgRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 1.5);

      expect(viewport1.width).toBe(viewport2.width);
      expect(viewport1.height).toBe(viewport2.height);
      expect(viewport1.scale).toBe(viewport2.scale);
      expect(viewport1.rotation).toBe(viewport2.rotation);
    });

    it("maintains graphics state consistency", () => {
      // Set same state on both renderers
      canvasRenderer.setLineWidth(2.5);
      canvasRenderer.setStrokingRGB(1, 0, 0);

      svgRenderer.setLineWidth(2.5);
      svgRenderer.setStrokingRGB(1, 0, 0);

      expect(canvasRenderer.graphicsState.lineWidth).toBe(svgRenderer.graphicsState.lineWidth);
      expect(canvasRenderer.graphicsState.strokeColor).toBe(svgRenderer.graphicsState.strokeColor);
    });
  });
});

describe("Search and Highlight integration", () => {
  let searchEngine: SearchEngine;
  let textBuilder: TextLayerBuilder;
  let container: MockHTMLElement;
  let transformer: CoordinateTransformer;
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

    const provider = createMockTextProvider([
      "The quick brown fox jumps over the lazy dog.",
      "Another page with some text about foxes.",
      "Final page without the search term.",
    ]);
    searchEngine = new SearchEngine({ textProvider: provider });

    container = new MockHTMLElement();
    transformer = new CoordinateTransformer({
      pageWidth: LETTER_WIDTH,
      pageHeight: LETTER_HEIGHT,
      scale: 1,
      viewerRotation: 0,
    });
    textBuilder = new TextLayerBuilder({
      container: container as unknown as HTMLElement,
      transformer,
    });
  });

  afterEach(() => {
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("search result to highlight conversion", () => {
    it("provides bounding boxes for highlight rendering", async () => {
      const results = await searchEngine.search("fox");

      results.forEach(result => {
        expect(result.bounds).toBeDefined();
        expect(result.bounds.x).toBeGreaterThanOrEqual(0);
        expect(result.bounds.y).toBeGreaterThanOrEqual(0);
        expect(result.bounds.width).toBeGreaterThan(0);
        expect(result.bounds.height).toBeGreaterThan(0);
      });
    });

    it("provides character-level bounds for precise highlighting", async () => {
      const results = await searchEngine.search("quick");

      const result = results[0];
      expect(result.charBounds.length).toBe(5); // "quick" has 5 characters

      result.charBounds.forEach(bbox => {
        expect(bbox.width).toBeGreaterThan(0);
        expect(bbox.height).toBeGreaterThan(0);
      });
    });

    it("groups results by page for efficient rendering", async () => {
      const results = await searchEngine.search("fox");

      const page0Results = searchEngine.getResultsForPage(0);
      const page1Results = searchEngine.getResultsForPage(1);

      expect(page0Results.length).toBe(1);
      expect(page1Results.length).toBe(1);
    });
  });

  describe("navigation updates highlight", () => {
    it("emits result-change for highlight updates", async () => {
      await searchEngine.search("the");

      const changes: SearchResult[] = [];
      searchEngine.addEventListener("result-change", event => {
        if ((event as { result?: SearchResult }).result) {
          changes.push((event as { result: SearchResult }).result);
        }
      });

      searchEngine.findNext();
      searchEngine.findNext();

      expect(changes.length).toBe(2);
    });

    it("provides page index for scroll-to-result", async () => {
      await searchEngine.search("fox");

      expect(searchEngine.currentResult?.pageIndex).toBe(0);

      searchEngine.findNext();
      expect(searchEngine.currentResult?.pageIndex).toBe(1);
    });
  });
});

describe("Virtual Scrolling and Renderer integration", () => {
  let scroller: VirtualScroller;
  let container: VirtualScrollContainer;
  let canvasRenderer: CanvasRenderer;
  let originalDocument: typeof globalThis.document;

  beforeEach(async () => {
    originalDocument = globalThis.document;
    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tagName: string) => {
        if (tagName === "canvas") {
          return new MockCanvasElement();
        }
        return new MockHTMLElement();
      },
    };

    scroller = new VirtualScroller({
      viewportWidth: 800,
      viewportHeight: 600,
    });

    container = new VirtualScrollContainer({
      scroller,
      useDefaultPools: true,
      autoManageElements: true,
    });

    canvasRenderer = new CanvasRenderer();
    await canvasRenderer.initialize({ headless: true });
  });

  afterEach(() => {
    container.dispose();
    canvasRenderer.destroy();
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("page visibility and rendering", () => {
    it("determines which pages need rendering", () => {
      container.setPageDimensions(createPages(20));

      const visibleIndices = container.getVisiblePageIndices();

      expect(visibleIndices.length).toBeGreaterThan(0);
      expect(visibleIndices[0]).toBe(0);
    });

    it("updates visible pages on scroll", () => {
      container.setPageDimensions(createPages(20));

      const initialVisible = container.getVisiblePageIndices();

      scroller.scrollTo(0, 3000);

      const newVisible = container.getVisiblePageIndices();

      expect(newVisible[0]).toBeGreaterThan(initialVisible[0]);
    });

    it("creates viewports for visible pages", () => {
      container.setPageDimensions(createPages(10));

      const visibleIndices = container.getVisiblePageIndices();

      visibleIndices.forEach(pageIndex => {
        const viewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);
        expect(viewport.width).toBe(LETTER_WIDTH);
        expect(viewport.height).toBe(LETTER_HEIGHT);
      });
    });
  });

  describe("scale changes", () => {
    it("updates renderer viewports on zoom", () => {
      container.setPageDimensions(createPages(10));
      scroller.setScale(2);

      const viewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      expect(viewport.width).toBe(LETTER_WIDTH * 2);
      expect(viewport.height).toBe(LETTER_HEIGHT * 2);
      expect(viewport.scale).toBe(2);
    });

    it("synchronizes scale between scroller and estimator", () => {
      container.setPageDimensions(createPages(10));

      scroller.setScale(1.5);

      const estimatedHeight = container.getEstimatedHeight(0);
      expect(estimatedHeight).toBeCloseTo(LETTER_HEIGHT * 1.5, 0);
    });
  });

  describe("actual height tracking", () => {
    it("updates layout when actual heights differ", () => {
      container.setPageDimensions(createPages(10));

      const initialLayout = container.getPageLayout(1);

      container.setActualPageHeight(0, LETTER_HEIGHT + 100);

      const updatedLayout = container.getPageLayout(1);

      expect(updatedLayout!.top).toBeGreaterThan(initialLayout!.top);
    });
  });
});

describe("Complete viewer workflow", () => {
  let scroller: VirtualScroller;
  let container: VirtualScrollContainer;
  let canvasRenderer: CanvasRenderer;
  let searchEngine: SearchEngine;
  let originalDocument: typeof globalThis.document;

  beforeEach(async () => {
    originalDocument = globalThis.document;
    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tagName: string) => {
        if (tagName === "canvas") {
          return new MockCanvasElement();
        }
        if (tagName === "span") {
          return new MockSpanElement();
        }
        return new MockHTMLElement();
      },
    };

    scroller = new VirtualScroller({
      viewportWidth: 800,
      viewportHeight: 600,
    });

    container = new VirtualScrollContainer({
      scroller,
      useDefaultPools: true,
    });

    canvasRenderer = new CanvasRenderer();
    await canvasRenderer.initialize({ headless: true });

    const pages = [
      "Page 1: The quick brown fox.",
      "Page 2: More content here.",
      "Page 3: Even more content.",
      "Page 4: Final page text.",
    ];
    searchEngine = new SearchEngine({ textProvider: createMockTextProvider(pages) });
  });

  afterEach(() => {
    container.dispose();
    canvasRenderer.destroy();
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  it("simulates complete page render workflow", async () => {
    // 1. Initialize document
    container.setPageDimensions(createPages(4));

    // 2. Get visible pages
    const visiblePages = container.getVisiblePageIndices();
    expect(visiblePages.length).toBeGreaterThan(0);

    // 3. Render each visible page
    for (const pageIndex of visiblePages) {
      const viewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);
      const task = canvasRenderer.render(pageIndex, viewport);
      const result = await task.promise;

      expect(result.width).toBe(LETTER_WIDTH);
      expect(result.height).toBe(LETTER_HEIGHT);

      // 4. Update actual height
      container.setActualPageHeight(pageIndex, result.height);
    }

    // Verify heights are tracked
    expect(container.hasActualHeight(0)).toBe(true);
  });

  it("simulates search and navigate workflow", async () => {
    container.setPageDimensions(createPages(4));

    // 1. Perform search
    const results = await searchEngine.search("content");
    expect(results.length).toBeGreaterThan(0);

    // 2. Get current result
    const currentResult = searchEngine.currentResult;
    expect(currentResult).not.toBeNull();

    // 3. Check if page is visible
    const isVisible = container.isPageVisible(currentResult!.pageIndex);

    // 4. If not visible, scroll to page
    if (!isVisible) {
      const layout = container.getPageLayout(currentResult!.pageIndex);
      if (layout) {
        scroller.scrollTo(0, layout.top);
      }
    }

    // 5. Navigate to next result
    const nextResult = searchEngine.findNext();
    expect(nextResult).not.toBeNull();
  });

  it("simulates zoom workflow", async () => {
    container.setPageDimensions(createPages(4));

    // 1. Get initial state
    const initialVisible = container.getVisiblePageIndices();
    const initialHeight = container.getEstimatedHeight(0);

    // 2. Zoom in
    scroller.setScale(2);

    // 3. Verify scale propagates
    expect(scroller.scale).toBe(2);
    expect(container.scale).toBe(2);

    // 4. Verify heights are scaled
    const scaledHeight = container.getEstimatedHeight(0);
    expect(scaledHeight).toBeCloseTo(initialHeight * 2, 0);

    // 5. Create viewport at new scale
    const viewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);
    expect(viewport.width).toBe(LETTER_WIDTH * 2);
    expect(viewport.height).toBe(LETTER_HEIGHT * 2);
  });

  it("simulates scroll and render workflow", async () => {
    container.setPageDimensions(createPages(10));

    const renderedPages = new Set<number>();

    // 1. Render initial visible pages
    let visiblePages = container.getVisiblePageIndices();
    for (const pageIndex of visiblePages) {
      const viewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);
      await canvasRenderer.render(pageIndex, viewport).promise;
      renderedPages.add(pageIndex);
    }

    // 2. Scroll down
    scroller.scrollTo(0, 2000);

    // 3. Get new visible pages
    visiblePages = container.getVisiblePageIndices();

    // 4. Render newly visible pages
    for (const pageIndex of visiblePages) {
      if (!renderedPages.has(pageIndex)) {
        const viewport = canvasRenderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);
        await canvasRenderer.render(pageIndex, viewport).promise;
        renderedPages.add(pageIndex);
      }
    }

    // 5. Verify we've rendered more pages
    expect(renderedPages.size).toBeGreaterThan(1);
  });
});

describe("Error handling integration", () => {
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
  });

  afterEach(() => {
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  it("handles search errors gracefully", async () => {
    const provider = createMockTextProvider(["test content"]);
    const searchEngine = new SearchEngine({ textProvider: provider });

    // Invalid regex should not crash
    await searchEngine.search("[invalid", { isRegex: true });

    expect(searchEngine.state.status).toBe("error");

    // Should recover for next search
    const results = await searchEngine.search("test");
    expect(results.length).toBeGreaterThan(0);
    expect(searchEngine.state.status).toBe("complete");
  });

  it("handles renderer not initialized", async () => {
    const renderer = new CanvasRenderer();

    expect(() => renderer.createViewport(612, 792, 0)).toThrow("Renderer must be initialized");
  });

  it("handles empty document", () => {
    const scroller = new VirtualScroller({
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const container = new VirtualScrollContainer({
      scroller,
      useDefaultPools: true,
    });

    container.setPageDimensions([]);

    expect(container.pageCount).toBe(0);
    expect(container.getVisiblePageIndices()).toEqual([]);

    container.dispose();
  });
});
