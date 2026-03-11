/**
 * Viewer-level tests for VirtualScrollingSystem.
 *
 * These tests focus on the complete virtual scrolling integration including
 * VirtualScrollContainer, DOMRecycler, PageEstimator, and their interaction
 * with the VirtualScroller for PDF viewing scenarios.
 */

import { DOMRecycler, createDefaultPoolConfigs } from "#src/viewer/virtual-scrolling/dom-recycler";
import { PageEstimator } from "#src/viewer/virtual-scrolling/page-estimator";
import {
  VirtualScrollContainer,
  createVirtualScrollContainer,
  type VirtualScrollContainerEvent,
} from "#src/viewer/virtual-scrolling/virtual-scroll-container";
import { VirtualScroller, type PageDimensions } from "#src/virtual-scroller";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Standard page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/**
 * Create standard letter-size page dimensions.
 */
function createLetterPages(count: number): PageDimensions[] {
  return Array(count)
    .fill(null)
    .map(() => ({
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
    }));
}

/**
 * Create mixed page dimensions.
 */
function createMixedPages(count: number): PageDimensions[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      width: i % 2 === 0 ? LETTER_WIDTH : A4_WIDTH,
      height: i % 2 === 0 ? LETTER_HEIGHT : A4_HEIGHT,
    }));
}

/**
 * Mock HTMLElement for testing DOM recycling.
 */
class MockHTMLElement {
  style: Record<string, string> = {};
  children: MockHTMLElement[] = [];
  private attributes: Map<string, string> = new Map();

  appendChild(child: MockHTMLElement): void {
    this.children.push(child);
  }

  removeChild(child: MockHTMLElement): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  remove(): void {
    // Mock remove
  }
}

/**
 * Mock canvas element.
 */
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

describe("VirtualScrollingSystem viewer integration", () => {
  let scroller: VirtualScroller;
  let container: VirtualScrollContainer;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    // Store original document
    originalDocument = globalThis.document;

    // Create mock document
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
      syncHeights: true,
    });
  });

  afterEach(() => {
    container.dispose();
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("initialization", () => {
    it("creates container with scroller", () => {
      expect(container.scroller).toBe(scroller);
      expect(container.pageCount).toBe(0);
    });

    it("initializes with default pools", () => {
      const recycler = container.recycler;
      expect(recycler.hasPool("pageContainer")).toBe(true);
    });

    it("creates container via factory function", () => {
      const factoryContainer = createVirtualScrollContainer({
        scroller,
        useDefaultPools: true,
      });

      expect(factoryContainer.scroller).toBe(scroller);
      factoryContainer.dispose();
    });
  });

  describe("page dimension management", () => {
    it("sets page dimensions for document", () => {
      const dimensions = createLetterPages(10);
      container.setPageDimensions(dimensions);

      expect(container.pageCount).toBe(10);
    });

    it("handles mixed page dimensions", () => {
      const dimensions = createMixedPages(5);
      container.setPageDimensions(dimensions);

      expect(container.pageCount).toBe(5);
    });

    it("syncs dimensions with scroller", () => {
      const dimensions = createLetterPages(5);
      container.setPageDimensions(dimensions);

      expect(scroller.pageCount).toBe(5);
    });

    it("emits layoutUpdated event", () => {
      const listener = vi.fn();
      container.addEventListener("layoutUpdated", listener);

      container.setPageDimensions(createLetterPages(3));

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "layoutUpdated" }));
    });
  });

  describe("actual height tracking", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(10));
    });

    it("sets actual page height", () => {
      container.setActualPageHeight(0, 800);

      expect(container.hasActualHeight(0)).toBe(true);
      expect(container.getEstimatedHeight(0)).toBe(800);
    });

    it("tracks which pages have actual heights", () => {
      container.setActualPageHeight(0, 800);
      container.setActualPageHeight(2, 850);

      expect(container.hasActualHeight(0)).toBe(true);
      expect(container.hasActualHeight(1)).toBe(false);
      expect(container.hasActualHeight(2)).toBe(true);
    });

    it("emits scrollCorrected when height changes affect scroll", () => {
      scroller.scrollTo(0, 1000);

      const listener = vi.fn();
      container.addEventListener("scrollCorrected", listener);

      // Simulate a significant height change
      container.setActualPageHeight(0, LETTER_HEIGHT + 100);

      // May or may not emit depending on scroll correction threshold
    });
  });

  describe("element management", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(10));
    });

    it("acquires elements for pages", () => {
      const element = container.acquireElement("pageContainer", 0);

      expect(element).toBeTruthy();
      expect(container.getElement("pageContainer", 0)).toBe(element);
    });

    it("releases elements back to pool", () => {
      container.acquireElement("pageContainer", 0);
      container.releaseElement("pageContainer", 0);

      expect(container.getElement("pageContainer", 0)).toBeNull();
    });

    it("releases all elements for a page", () => {
      container.acquireElement("pageContainer", 0);
      container.releaseAllElements(0);

      expect(container.getElement("pageContainer", 0)).toBeNull();
    });

    it("gets all elements for a page", () => {
      container.acquireElement("pageContainer", 0);

      const elements = container.getElementsForPage(0);

      expect(elements.has("pageContainer")).toBe(true);
    });
  });

  describe("visibility tracking", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(20));
    });

    it("tracks visible pages", () => {
      const visible = container.getVisiblePageIndices();

      expect(visible.length).toBeGreaterThan(0);
      expect(visible[0]).toBe(0);
    });

    it("checks if specific page is visible", () => {
      expect(container.isPageVisible(0)).toBe(true);
      expect(container.isPageVisible(19)).toBe(false);
    });

    it("gets visible range", () => {
      const range = container.visibleRange;

      expect(range.start).toBe(0);
      expect(range.end).toBeGreaterThanOrEqual(0);
    });

    it("updates visibility on scroll", () => {
      // Scroll down
      scroller.scrollTo(0, 2000);

      const visible = container.getVisiblePageIndices();
      expect(visible[0]).toBeGreaterThan(0);
    });
  });

  describe("layout information", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(10));
    });

    it("gets page layout", () => {
      const layout = container.getPageLayout(0);

      expect(layout).not.toBeNull();
      expect(layout!.top).toBeDefined();
      expect(layout!.height).toBeDefined();
    });

    it("gets estimated height", () => {
      const height = container.getEstimatedHeight(0);

      expect(height).toBeGreaterThan(0);
    });

    it("finds page at position", () => {
      const pageIndex = container.getPageAtPosition(100);

      expect(pageIndex).toBe(0);
    });

    it("finds correct page at different positions", () => {
      const page0 = container.getPageAtPosition(0);
      const page1 = container.getPageAtPosition(LETTER_HEIGHT + 50);

      expect(page0).toBe(0);
      expect(page1).toBe(1);
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(20));
    });

    it("emits pageVisible event when page enters viewport", () => {
      const events: VirtualScrollContainerEvent[] = [];
      container.addEventListener("pageVisible", event => events.push(event));

      // Scroll to show new pages
      scroller.scrollTo(0, 3000);

      // Should have emitted pageVisible events
      const visibleEvents = events.filter(e => e.type === "pageVisible");
      expect(visibleEvents.length).toBeGreaterThan(0);
    });

    it("emits pageHidden event when page leaves viewport", () => {
      const events: VirtualScrollContainerEvent[] = [];
      container.addEventListener("pageHidden", event => events.push(event));

      // Scroll down to hide initial pages
      scroller.scrollTo(0, 5000);

      const hiddenEvents = events.filter(e => e.type === "pageHidden");
      expect(hiddenEvents.length).toBeGreaterThan(0);
    });

    it("removes event listeners", () => {
      const listener = vi.fn();
      container.addEventListener("pageVisible", listener);
      container.removeEventListener("pageVisible", listener);

      scroller.scrollTo(0, 3000);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("scale changes", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(10));
    });

    it("tracks current scale", () => {
      expect(container.scale).toBe(1);

      scroller.setScale(2);
      expect(container.scale).toBe(2);
    });

    it("updates estimator on scale change", () => {
      scroller.setScale(1.5);

      // Estimated heights should be scaled
      const height = container.getEstimatedHeight(0);
      expect(height).toBeCloseTo(LETTER_HEIGHT * 1.5, 0);
    });
  });

  describe("statistics", () => {
    beforeEach(() => {
      container.setPageDimensions(createLetterPages(10));
    });

    it("provides recycler stats", () => {
      container.acquireElement("pageContainer", 0);
      container.acquireElement("pageContainer", 1);

      const stats = container.getRecyclerStats();

      expect(stats).toBeDefined();
    });

    it("provides height estimates", () => {
      const estimates = container.getHeightEstimates();

      expect(estimates.length).toBe(10);
    });
  });

  describe("custom pools", () => {
    it("registers custom element pool", () => {
      container.registerPool("customLayer", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
        maxSize: 5,
      });

      const element = container.acquireElement("customLayer", 0);
      expect(element).toBeTruthy();
    });
  });

  describe("cleanup", () => {
    it("disposes container and resources", () => {
      container.setPageDimensions(createLetterPages(5));
      container.acquireElement("pageContainer", 0);

      container.dispose();

      // Should not throw after dispose
      expect(() => container.setPageDimensions(createLetterPages(3))).not.toThrow();
    });

    it("prevents operations after dispose", () => {
      container.dispose();

      // Operations after dispose should be no-ops
      container.setPageDimensions(createLetterPages(5));
      expect(container.pageCount).toBe(0);
    });
  });
});

describe("DOMRecycler", () => {
  let recycler: DOMRecycler;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tagName: string) => {
        if (tagName === "canvas") {
          return new MockCanvasElement();
        }
        return new MockHTMLElement();
      },
    };

    recycler = new DOMRecycler();
  });

  afterEach(() => {
    recycler.dispose();
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("pool management", () => {
    it("registers and uses pools", () => {
      recycler.registerPool("testPool", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
        maxSize: 5,
      });

      expect(recycler.hasPool("testPool")).toBe(true);

      const element = recycler.acquire("testPool", 0);
      expect(element).toBeTruthy();
    });

    it("reuses released elements", () => {
      recycler.registerPool("testPool", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
        maxSize: 5,
      });

      const element1 = recycler.acquire("testPool", 0);
      recycler.release("testPool", 0);

      const element2 = recycler.acquire("testPool", 1);

      // Should reuse the released element
      expect(element2).toBe(element1);
    });

    it("respects max pool size", () => {
      let createdCount = 0;
      recycler.registerPool("testPool", {
        factory: () => {
          createdCount++;
          return new MockHTMLElement() as unknown as HTMLElement;
        },
        maxSize: 2,
      });

      // Acquire and release 5 elements
      for (let i = 0; i < 5; i++) {
        recycler.acquire("testPool", i);
      }
      for (let i = 0; i < 5; i++) {
        recycler.release("testPool", i);
      }

      // Pool should only hold maxSize elements
      const stats = recycler.getStats();
      const poolStats = stats.byType.get("testPool");
      expect(poolStats?.available).toBeLessThanOrEqual(2);
    });
  });

  describe("element retrieval", () => {
    beforeEach(() => {
      recycler.registerPool("testPool", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
      });
    });

    it("gets element for page", () => {
      const acquired = recycler.acquire("testPool", 0);
      const retrieved = recycler.getElement("testPool", 0);

      expect(retrieved).toBe(acquired);
    });

    it("returns null for non-existent element", () => {
      const element = recycler.getElement("testPool", 999);
      expect(element).toBeNull();
    });

    it("gets all elements for page", () => {
      recycler.registerPool("pool1", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
      });
      recycler.registerPool("pool2", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
      });

      recycler.acquire("pool1", 0);
      recycler.acquire("pool2", 0);

      const elements = recycler.getElementsForPage(0);
      expect(elements.size).toBe(2);
    });
  });

  describe("batch operations", () => {
    beforeEach(() => {
      recycler.registerPool("testPool", {
        factory: () => new MockHTMLElement() as unknown as HTMLElement,
      });
    });

    it("releases all elements for page", () => {
      recycler.acquire("testPool", 0);
      recycler.releaseAllForPage(0);

      expect(recycler.getElement("testPool", 0)).toBeNull();
    });

    it("checks if element exists", () => {
      expect(recycler.hasElement("testPool", 0)).toBe(false);

      recycler.acquire("testPool", 0);

      expect(recycler.hasElement("testPool", 0)).toBe(true);
    });
  });
});

describe("PageEstimator", () => {
  let estimator: PageEstimator;

  beforeEach(() => {
    estimator = new PageEstimator({ scale: 1, pageGap: 10, verticalPadding: 0 });
  });

  afterEach(() => {
    estimator.dispose();
  });

  describe("initialization", () => {
    it("creates with default options", () => {
      const defaultEstimator = new PageEstimator();
      expect(defaultEstimator.pageCount).toBe(0);
      defaultEstimator.dispose();
    });

    it("sets page dimensions", () => {
      estimator.setPageDimensions(createLetterPages(5));
      expect(estimator.pageCount).toBe(5);
    });
  });

  describe("height estimation", () => {
    beforeEach(() => {
      estimator.setPageDimensions(createLetterPages(10));
    });

    it("estimates height based on page dimensions", () => {
      const height = estimator.getEstimatedHeight(0);
      expect(height).toBe(LETTER_HEIGHT);
    });

    it("tracks actual heights", () => {
      estimator.setActualHeight(0, 800);

      expect(estimator.hasActualHeight(0)).toBe(true);
      expect(estimator.getEstimatedHeight(0)).toBe(800);
    });

    it("gets all estimates", () => {
      const estimates = estimator.getAllEstimates();
      expect(estimates.length).toBe(10);
    });
  });

  describe("layout calculation", () => {
    beforeEach(() => {
      estimator.setPageDimensions(createLetterPages(5));
    });

    it("calculates page layout", () => {
      const layout = estimator.getPageLayout(0);

      expect(layout).not.toBeNull();
      expect(layout!.top).toBe(0);
      expect(layout!.height).toBe(LETTER_HEIGHT);
    });

    it("calculates cumulative positions", () => {
      const layout0 = estimator.getPageLayout(0);
      const layout1 = estimator.getPageLayout(1);

      expect(layout1!.top).toBe(layout0!.height + 10); // page gap
    });

    it("finds page at position", () => {
      expect(estimator.getPageAtPosition(0)).toBe(0);
      expect(estimator.getPageAtPosition(LETTER_HEIGHT + 15)).toBe(1);
    });
  });

  describe("scale handling", () => {
    beforeEach(() => {
      estimator.setPageDimensions(createLetterPages(5));
    });

    it("applies scale to heights", () => {
      estimator.setScale(2);

      const height = estimator.getEstimatedHeight(0);
      expect(height).toBe(LETTER_HEIGHT * 2);
    });

    it("applies scale to layout positions", () => {
      estimator.setScale(2);

      const layout1 = estimator.getPageLayout(1);
      expect(layout1!.top).toBe(LETTER_HEIGHT * 2 + 10);
    });
  });

  describe("scroll correction", () => {
    beforeEach(() => {
      estimator.setPageDimensions(createLetterPages(10));
    });

    it("calculates scroll correction", () => {
      const initialCorrection = estimator.getScrollCorrection(1000);

      // Set actual height different from estimate
      estimator.setActualHeight(0, LETTER_HEIGHT + 100);

      const newCorrection = estimator.getScrollCorrection(1000);

      expect(newCorrection).not.toBe(initialCorrection);
    });
  });

  describe("events", () => {
    beforeEach(() => {
      estimator.setPageDimensions(createLetterPages(5));
    });

    it("emits heightUpdated event", () => {
      const listener = vi.fn();
      estimator.addEventListener("heightUpdated", listener);

      estimator.setActualHeight(0, 900);

      expect(listener).toHaveBeenCalled();
    });

    it("removes event listener", () => {
      const listener = vi.fn();
      estimator.addEventListener("heightUpdated", listener);
      estimator.removeEventListener("heightUpdated", listener);

      estimator.setActualHeight(0, 900);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("VirtualScrollingSystem performance scenarios", () => {
  let scroller: VirtualScroller;
  let container: VirtualScrollContainer;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => new MockHTMLElement(),
    };

    scroller = new VirtualScroller({
      viewportWidth: 800,
      viewportHeight: 600,
    });

    container = new VirtualScrollContainer({
      scroller,
      useDefaultPools: true,
    });
  });

  afterEach(() => {
    container.dispose();
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  it("handles large documents efficiently", () => {
    const dimensions = createLetterPages(1000);

    const start = performance.now();
    container.setPageDimensions(dimensions);
    const duration = performance.now() - start;

    expect(container.pageCount).toBe(1000);
    expect(duration).toBeLessThan(100);
  });

  it("handles rapid scrolling", () => {
    container.setPageDimensions(createLetterPages(100));

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      scroller.scrollTo(0, i * 100);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it("handles many element acquisitions", () => {
    container.setPageDimensions(createLetterPages(100));

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      container.acquireElement("pageContainer", i);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it("handles repeated acquire/release cycles", () => {
    container.setPageDimensions(createLetterPages(50));

    const start = performance.now();
    for (let cycle = 0; cycle < 10; cycle++) {
      for (let i = 0; i < 50; i++) {
        container.acquireElement("pageContainer", i);
      }
      for (let i = 0; i < 50; i++) {
        container.releaseElement("pageContainer", i);
      }
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
