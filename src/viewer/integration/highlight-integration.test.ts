/**
 * Integration tests for HighlightRenderer with search engine and coordinate transformation.
 *
 * Tests end-to-end functionality including:
 * - Search result highlighting
 * - Coordinate transformation during zoom/pan
 * - Event handling across components
 *
 * These tests use a minimal DOM mock since the project doesn't include jsdom.
 */

import { CoordinateTransformer } from "#src/coordinate-transformer";
import type { SearchResult } from "#src/frontend/search/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HighlightRenderer } from "../highlight/HighlightRenderer";
import type { HighlightRegion } from "../highlight/types";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

// Minimal DOM mock for testing without jsdom
class MockStyle {
  [key: string]: string | ((property: string, value: string) => void);

  // Handle cssText by parsing it into individual properties
  set cssText(value: string) {
    const declarations = value.split(";").filter(d => d.trim());
    for (const decl of declarations) {
      const [prop, val] = decl.split(":").map(s => s.trim());
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        this[camelProp] = val;
      }
    }
  }

  get cssText(): string {
    return Object.entries(this)
      .filter(([_, v]) => typeof v === "string")
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
  }
}

class MockElement {
  tagName = "DIV";
  className = "";
  dataset: Record<string, string> = {};
  style: MockStyle = new MockStyle();
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  private eventListeners: Map<string, Set<(e: unknown) => void>> = new Map();

  constructor(tagName = "DIV") {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: MockElement): MockElement {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  remove(): void {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index > -1) {
        this.parentElement.children.splice(index, 1);
      }
      this.parentElement = null;
    }
  }

  querySelector(selector: string): MockElement | null {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      if (this.className.includes(className)) {
        return this;
      }
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) {
          return found;
        }
      }
    } else if (selector.startsWith("[data-")) {
      const match = selector.match(/\[data-([^=]+)='([^']+)'\]/);
      if (match) {
        const [, key, value] = match;
        const dataKey = key.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        if (this.dataset[dataKey] === value) {
          return this;
        }
        for (const child of this.children) {
          const found = child.querySelector(selector);
          if (found) {
            return found;
          }
        }
      }
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      if (this.className.includes(className)) {
        results.push(this);
      }
      for (const child of this.children) {
        results.push(...child.querySelectorAll(selector));
      }
    }
    return results;
  }

  addEventListener(type: string, listener: (e: unknown) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e: unknown) => void): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  click(): void {
    this.dispatchEvent({ type: "click", target: this });
  }

  dispatchEvent(event: { type: string; target?: unknown; bubbles?: boolean }): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

// Mock document
const mockDocument = {
  createElement: (tagName: string): MockElement => new MockElement(tagName),
  body: new MockElement("BODY"),
};

const originalDocument = globalThis.document;

function createMockContainer(): MockElement {
  const container = mockDocument.createElement("div");
  container.style.position = "relative";
  container.style.width = `${LETTER_WIDTH}px`;
  container.style.height = `${LETTER_HEIGHT}px`;
  mockDocument.body.appendChild(container);
  return container;
}

function createTransformer(options?: {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}): CoordinateTransformer {
  return new CoordinateTransformer({
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    scale: options?.scale ?? 1,
    offsetX: options?.offsetX ?? 0,
    offsetY: options?.offsetY ?? 0,
  });
}

function createMockSearchResult(index: number, overrides?: Partial<SearchResult>): SearchResult {
  const y = 700 - index * 50;
  return {
    pageIndex: 0,
    text: `result ${index}`,
    startOffset: index * 10,
    endOffset: index * 10 + 6,
    bounds: { x: 100, y, width: 100, height: 20 },
    charBounds: [
      { x: 100, y, width: 15, height: 20 },
      { x: 115, y, width: 15, height: 20 },
      { x: 130, y, width: 15, height: 20 },
      { x: 145, y, width: 15, height: 20 },
      { x: 160, y, width: 15, height: 20 },
      { x: 175, y, width: 15, height: 20 },
    ],
    resultIndex: index,
    ...overrides,
  };
}

function searchResultToHighlight(result: SearchResult): HighlightRegion {
  return {
    pageIndex: result.pageIndex,
    bounds: result.bounds,
    charBounds: result.charBounds,
    type: "search",
    id: `search-${result.resultIndex}`,
    data: { resultIndex: result.resultIndex },
  };
}

describe("HighlightRenderer Integration", () => {
  let container: MockElement;
  let renderer: HighlightRenderer;
  let transformer: CoordinateTransformer;

  beforeEach(() => {
    globalThis.document = mockDocument as unknown as Document;
    container = createMockContainer();
    renderer = new HighlightRenderer(container as unknown as HTMLElement);
    transformer = createTransformer();
    renderer.setTransformer(transformer);
  });

  afterEach(() => {
    renderer.destroy();
    container.remove();
    globalThis.document = originalDocument;
  });

  describe("search result highlighting", () => {
    it("converts search results to highlights", () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult(0),
        createMockSearchResult(1),
        createMockSearchResult(2),
      ];

      const highlights = searchResults.map(searchResultToHighlight);
      const ids = renderer.addHighlights(highlights);

      expect(ids).toHaveLength(3);
      expect(renderer.highlightCount).toBe(3);
      expect(renderer.getHighlightsByType("search")).toHaveLength(3);
    });

    it("preserves search result data in highlights", () => {
      const searchResult = createMockSearchResult(5);
      const highlight = searchResultToHighlight(searchResult);

      renderer.addHighlight(highlight);

      const retrieved = renderer.getHighlight("search-5");
      expect(retrieved?.data).toEqual({ resultIndex: 5 });
    });

    it("supports navigating through search results", () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult(0),
        createMockSearchResult(1),
        createMockSearchResult(2),
      ];

      const highlights = searchResults.map(searchResultToHighlight);
      renderer.addHighlights(highlights);

      // Navigate to first result
      renderer.setCurrentHighlight("search-0");
      expect(renderer.getCurrentHighlightId()).toBe("search-0");

      // Navigate to next
      renderer.setCurrentHighlight("search-1");
      expect(renderer.getCurrentHighlightId()).toBe("search-1");

      // Navigate to previous
      renderer.setCurrentHighlight("search-0");
      expect(renderer.getCurrentHighlightId()).toBe("search-0");
    });

    it("clears search highlights when search is cleared", () => {
      const searchResults: SearchResult[] = [createMockSearchResult(0), createMockSearchResult(1)];

      const highlights = searchResults.map(searchResultToHighlight);
      renderer.addHighlights(highlights);

      // Also add a user highlight
      renderer.addHighlight({
        pageIndex: 0,
        bounds: { x: 200, y: 500, width: 100, height: 20 },
        type: "user",
        id: "user-1",
      });

      expect(renderer.highlightCount).toBe(3);

      // Clear only search highlights
      renderer.removeHighlightsByType("search");

      expect(renderer.highlightCount).toBe(1);
      expect(renderer.getHighlightsByType("user")).toHaveLength(1);
    });

    it("uses character bounds for precise highlighting", () => {
      const searchResult = createMockSearchResult(0);
      const highlight = searchResultToHighlight(searchResult);

      renderer.addHighlight(highlight);

      // Should have individual character highlight elements
      const charElements = container.querySelectorAll(".pdf-highlight-char");
      expect(charElements.length).toBe(searchResult.charBounds.length);
    });
  });

  describe("coordinate transformation integration", () => {
    it("positions highlights correctly at scale 1", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      const element = container.querySelector("[data-highlight-id='test-1']");

      // At scale 1, the screen rect should match the PDF rect's dimensions
      expect(parseFloat(element?.style.width ?? "0")).toBeCloseTo(200, 1);
      expect(parseFloat(element?.style.height ?? "0")).toBeCloseTo(20, 1);
    });

    it("scales highlights correctly at scale 2", () => {
      transformer.setScale(2);

      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      const element = container.querySelector("[data-highlight-id='test-1']");

      // At scale 2, dimensions should be doubled
      expect(parseFloat(element?.style.width ?? "0")).toBeCloseTo(400, 1);
      expect(parseFloat(element?.style.height ?? "0")).toBeCloseTo(40, 1);
    });

    it("updates positions dynamically when zoom changes", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      const element = container.querySelector("[data-highlight-id='test-1']");
      const initialWidth = parseFloat(element?.style.width ?? "0");

      // Change zoom
      transformer.setScale(1.5);
      renderer.updatePositions();

      const newWidth = parseFloat(element?.style.width ?? "0");
      expect(newWidth).toBeCloseTo(initialWidth * 1.5, 1);
    });

    it("updates positions dynamically when pan changes", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      const element = container.querySelector("[data-highlight-id='test-1']");
      const initialLeft = parseFloat(element?.style.left ?? "0");

      // Pan by 100 pixels
      transformer.setOffset(100, 50);
      renderer.updatePositions();

      const newLeft = parseFloat(element?.style.left ?? "0");
      expect(newLeft).toBeCloseTo(initialLeft + 100, 1);
    });

    it("handles combined zoom and pan", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 100, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      const element = container.querySelector("[data-highlight-id='test-1']");
      const initialWidth = parseFloat(element?.style.width ?? "0");
      const initialLeft = parseFloat(element?.style.left ?? "0");

      // Apply zoom and pan together
      transformer.setScale(2);
      transformer.setOffset(50, 25);
      renderer.updatePositions();

      const newWidth = parseFloat(element?.style.width ?? "0");
      const newLeft = parseFloat(element?.style.left ?? "0");

      // Width should be scaled
      expect(newWidth).toBeCloseTo(initialWidth * 2, 1);
      // Position should be scaled and offset
      expect(newLeft).toBeCloseTo(initialLeft * 2 + 50, 1);
    });

    it("handles transformer replacement", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      // Create new transformer with different scale
      const newTransformer = createTransformer({ scale: 3 });
      renderer.setTransformer(newTransformer);

      const element = container.querySelector("[data-highlight-id='test-1']");

      // Should be positioned for scale 3
      expect(parseFloat(element?.style.width ?? "0")).toBeCloseTo(600, 1);
    });
  });

  describe("multi-page support", () => {
    it("handles highlights across multiple pages", () => {
      const highlights: HighlightRegion[] = [
        {
          pageIndex: 0,
          bounds: { x: 100, y: 700, width: 100, height: 20 },
          type: "search",
          id: "p0-1",
        },
        {
          pageIndex: 0,
          bounds: { x: 100, y: 650, width: 100, height: 20 },
          type: "search",
          id: "p0-2",
        },
        {
          pageIndex: 1,
          bounds: { x: 100, y: 700, width: 100, height: 20 },
          type: "search",
          id: "p1-1",
        },
        {
          pageIndex: 2,
          bounds: { x: 100, y: 700, width: 100, height: 20 },
          type: "search",
          id: "p2-1",
        },
      ];

      renderer.addHighlights(highlights);

      expect(renderer.getHighlightsForPage(0)).toHaveLength(2);
      expect(renderer.getHighlightsForPage(1)).toHaveLength(1);
      expect(renderer.getHighlightsForPage(2)).toHaveLength(1);
    });

    it("updates only specific page highlights", () => {
      const highlights: HighlightRegion[] = [
        {
          pageIndex: 0,
          bounds: { x: 100, y: 700, width: 100, height: 20 },
          type: "search",
          id: "p0",
        },
        {
          pageIndex: 1,
          bounds: { x: 100, y: 700, width: 100, height: 20 },
          type: "search",
          id: "p1",
        },
      ];

      renderer.addHighlights(highlights);

      // Should not throw even with multi-page highlights
      expect(() => renderer.updatePositionsForPage(0)).not.toThrow();
      expect(() => renderer.updatePositionsForPage(1)).not.toThrow();
    });
  });

  describe("event-driven updates", () => {
    it("integrates with viewport change events", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      // Simulate viewport change event handler pattern
      const handleViewportChange = (newScale: number, offsetX: number, offsetY: number) => {
        transformer.setScale(newScale);
        transformer.setOffset(offsetX, offsetY);
        renderer.updatePositions();
      };

      // Trigger simulated viewport change
      handleViewportChange(1.5, 20, 10);

      const element = container.querySelector("[data-highlight-id='test-1']");
      expect(parseFloat(element?.style.width ?? "0")).toBeCloseTo(300, 1);
    });

    it("handles rapid successive updates", () => {
      const highlight: HighlightRegion = {
        pageIndex: 0,
        bounds: { x: 100, y: 600, width: 200, height: 20 },
        type: "search",
        id: "test-1",
      };

      renderer.addHighlight(highlight);

      // Simulate rapid zoom changes (like pinch-to-zoom)
      for (let i = 0; i <= 10; i++) {
        const scale = 1 + i * 0.1;
        transformer.setScale(scale);
        renderer.updatePositions();
      }

      const element = container.querySelector("[data-highlight-id='test-1']");
      // Should settle at scale 2
      expect(parseFloat(element?.style.width ?? "0")).toBeCloseTo(400, 1);
    });
  });

  describe("mixed highlight types", () => {
    it("manages different highlight types independently", () => {
      // Add search highlights
      const searchHighlights: HighlightRegion[] = [
        {
          pageIndex: 0,
          bounds: { x: 100, y: 700, width: 100, height: 20 },
          type: "search",
          id: "s1",
        },
        {
          pageIndex: 0,
          bounds: { x: 100, y: 650, width: 100, height: 20 },
          type: "search",
          id: "s2",
        },
      ];
      renderer.addHighlights(searchHighlights);

      // Add user highlights
      const userHighlights: HighlightRegion[] = [
        {
          pageIndex: 0,
          bounds: { x: 200, y: 700, width: 100, height: 20 },
          type: "user",
          id: "u1",
        },
      ];
      renderer.addHighlights(userHighlights);

      // Add selection
      renderer.addHighlight({
        pageIndex: 0,
        bounds: { x: 300, y: 700, width: 50, height: 20 },
        type: "selection",
        id: "sel1",
      });

      expect(renderer.getHighlightsByType("search")).toHaveLength(2);
      expect(renderer.getHighlightsByType("user")).toHaveLength(1);
      expect(renderer.getHighlightsByType("selection")).toHaveLength(1);

      // Clear search - others remain
      renderer.removeHighlightsByType("search");

      expect(renderer.getHighlightsByType("search")).toHaveLength(0);
      expect(renderer.getHighlightsByType("user")).toHaveLength(1);
      expect(renderer.getHighlightsByType("selection")).toHaveLength(1);
    });

    it("toggles visibility by type without affecting others", () => {
      renderer.addHighlight({
        pageIndex: 0,
        bounds: { x: 100, y: 700, width: 100, height: 20 },
        type: "search",
        id: "s1",
      });
      renderer.addHighlight({
        pageIndex: 0,
        bounds: { x: 200, y: 700, width: 100, height: 20 },
        type: "user",
        id: "u1",
      });

      // Hide search highlights
      renderer.setTypeVisibility("search", false);

      const searchEl = container.querySelector("[data-highlight-id='s1']");
      const userEl = container.querySelector("[data-highlight-id='u1']");

      expect(searchEl?.style.display).toBe("none");
      expect(userEl?.style.display).not.toBe("none");
    });
  });

  describe("performance considerations", () => {
    it("handles large number of highlights", () => {
      const highlights: HighlightRegion[] = [];
      for (let i = 0; i < 100; i++) {
        highlights.push({
          pageIndex: Math.floor(i / 10),
          bounds: { x: 100, y: 700 - (i % 10) * 30, width: 100, height: 20 },
          type: "search",
          id: `h-${i}`,
        });
      }

      const startTime = performance.now();
      renderer.addHighlights(highlights);
      const addTime = performance.now() - startTime;

      expect(renderer.highlightCount).toBe(100);
      expect(addTime).toBeLessThan(1000); // Should complete in reasonable time

      // Update positions should also be fast
      const updateStart = performance.now();
      transformer.setScale(1.5);
      renderer.updatePositions();
      const updateTime = performance.now() - updateStart;

      expect(updateTime).toBeLessThan(500);
    });

    it("efficiently updates single page in multi-page document", () => {
      // Add highlights across many pages
      const highlights: HighlightRegion[] = [];
      for (let page = 0; page < 10; page++) {
        for (let i = 0; i < 10; i++) {
          highlights.push({
            pageIndex: page,
            bounds: { x: 100, y: 700 - i * 30, width: 100, height: 20 },
            type: "search",
            id: `p${page}-h${i}`,
          });
        }
      }

      renderer.addHighlights(highlights);

      // Update only one page should be faster
      const startTime = performance.now();
      renderer.updatePositionsForPage(5);
      const singlePageTime = performance.now() - startTime;

      // This is a simple timing check - actual performance will vary
      expect(singlePageTime).toBeLessThan(100);
    });
  });
});
