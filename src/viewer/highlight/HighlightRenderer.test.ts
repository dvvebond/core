/**
 * Tests for HighlightRenderer.
 *
 * These tests use a minimal DOM mock since the project doesn't include jsdom.
 * The mock provides enough functionality to test the HighlightRenderer's logic.
 */

import { CoordinateTransformer } from "#src/coordinate-transformer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHighlightRenderer, HighlightRenderer } from "./HighlightRenderer";
import type {
  HighlightClickEvent,
  HighlightHoverEvent,
  HighlightLeaveEvent,
  HighlightRegion,
  HighlightsUpdatedEvent,
} from "./types";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

// Minimal DOM mock for testing without jsdom
class MockStyle {
  [key: string]: string | ((property: string, value: string) => void);

  // Handle cssText by parsing it into individual properties
  set cssText(value: string) {
    // Parse css text like "position: absolute; top: 0; ..."
    const declarations = value.split(";").filter(d => d.trim());
    for (const decl of declarations) {
      const [prop, val] = decl.split(":").map(s => s.trim());
      if (prop && val) {
        // Convert kebab-case to camelCase
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
    // Simple selector support
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

// Replace global document for tests
const originalDocument = globalThis.document;

function createMockContainer(): MockElement {
  const container = mockDocument.createElement("div");
  container.style.position = "relative";
  container.style.width = `${LETTER_WIDTH}px`;
  container.style.height = `${LETTER_HEIGHT}px`;
  mockDocument.body.appendChild(container);
  return container;
}

function createTestTransformer(scale = 1): CoordinateTransformer {
  return new CoordinateTransformer({
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    scale,
  });
}

function createTestHighlight(overrides?: Partial<HighlightRegion>): HighlightRegion {
  return {
    pageIndex: 0,
    bounds: { x: 100, y: 600, width: 200, height: 20 },
    type: "search",
    ...overrides,
  };
}

describe("HighlightRenderer", () => {
  let container: MockElement;
  let renderer: HighlightRenderer;
  let transformer: CoordinateTransformer;

  beforeEach(() => {
    // Install mock document
    globalThis.document = mockDocument as unknown as Document;
    container = createMockContainer();
    renderer = new HighlightRenderer(container as unknown as HTMLElement);
    transformer = createTestTransformer();
    renderer.setTransformer(transformer);
  });

  afterEach(() => {
    renderer.destroy();
    container.remove();
    // Restore original document
    globalThis.document = originalDocument;
  });

  describe("construction", () => {
    it("creates renderer with default options", () => {
      expect(renderer).toBeInstanceOf(HighlightRenderer);
      expect(renderer.highlightCount).toBe(0);
    });

    it("creates highlight layer in container", () => {
      const layer = container.querySelector(".pdf-highlight-layer");
      expect(layer).toBeTruthy();
      expect(layer?.tagName).toBe("DIV");
    });

    it("accepts custom options", () => {
      renderer.destroy();
      renderer = new HighlightRenderer(container as unknown as HTMLElement, {
        classPrefix: "custom-highlight",
        zIndex: 100,
      });
      const layer = container.querySelector(".custom-highlight-layer");
      expect(layer).toBeTruthy();
    });

    it("applies custom z-index to highlight layer", () => {
      renderer.destroy();
      renderer = new HighlightRenderer(container as unknown as HTMLElement, { zIndex: 50 });
      const layer = container.querySelector(".pdf-highlight-layer");
      expect(layer?.style.zIndex).toBe("50");
    });
  });

  describe("createHighlightRenderer helper", () => {
    it("creates renderer via helper function", () => {
      const customRenderer = createHighlightRenderer(container as unknown as HTMLElement);
      expect(customRenderer).toBeInstanceOf(HighlightRenderer);
      customRenderer.destroy();
    });
  });

  describe("transformer management", () => {
    it("sets and gets transformer", () => {
      const newTransformer = createTestTransformer(2);
      renderer.setTransformer(newTransformer);
      expect(renderer.getTransformer()).toBe(newTransformer);
    });

    it("returns null when no transformer set", () => {
      const newRenderer = new HighlightRenderer(container as unknown as HTMLElement);
      expect(newRenderer.getTransformer()).toBeNull();
      newRenderer.destroy();
    });
  });

  describe("adding highlights", () => {
    it("adds a single highlight", () => {
      const highlight = createTestHighlight();
      const id = renderer.addHighlight(highlight);

      expect(id).toBeTruthy();
      expect(renderer.highlightCount).toBe(1);
      expect(renderer.getHighlight(id)).toMatchObject(highlight);
    });

    it("uses provided ID when available", () => {
      const highlight = createTestHighlight({ id: "my-custom-id" });
      const id = renderer.addHighlight(highlight);

      expect(id).toBe("my-custom-id");
    });

    it("generates unique IDs for highlights without ID", () => {
      const highlight1 = createTestHighlight();
      const highlight2 = createTestHighlight();

      const id1 = renderer.addHighlight(highlight1);
      const id2 = renderer.addHighlight(highlight2);

      expect(id1).not.toBe(id2);
    });

    it("adds multiple highlights at once", () => {
      const highlights = [
        createTestHighlight({ bounds: { x: 100, y: 700, width: 100, height: 20 } }),
        createTestHighlight({ bounds: { x: 100, y: 650, width: 150, height: 20 } }),
        createTestHighlight({ bounds: { x: 100, y: 600, width: 200, height: 20 } }),
      ];

      const ids = renderer.addHighlights(highlights);

      expect(ids).toHaveLength(3);
      expect(renderer.highlightCount).toBe(3);
    });

    it("creates DOM elements for highlights", () => {
      renderer.addHighlight(createTestHighlight());

      const highlightElements = container.querySelectorAll(".pdf-highlight");
      expect(highlightElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("removing highlights", () => {
    it("removes a highlight by ID", () => {
      const id = renderer.addHighlight(createTestHighlight());
      expect(renderer.highlightCount).toBe(1);

      const removed = renderer.removeHighlight(id);
      expect(removed).toBe(true);
      expect(renderer.highlightCount).toBe(0);
      expect(renderer.getHighlight(id)).toBeUndefined();
    });

    it("returns false when removing non-existent highlight", () => {
      const removed = renderer.removeHighlight("non-existent");
      expect(removed).toBe(false);
    });

    it("removes DOM element when highlight is removed", () => {
      const id = renderer.addHighlight(createTestHighlight({ id: "to-remove" }));

      let elements = container.querySelector("[data-highlight-id='to-remove']");
      expect(elements).toBeTruthy();

      renderer.removeHighlight(id);

      elements = container.querySelector("[data-highlight-id='to-remove']");
      expect(elements).toBeNull();
    });

    it("removes highlights by type", () => {
      renderer.addHighlights([
        createTestHighlight({ type: "search" }),
        createTestHighlight({ type: "search" }),
        createTestHighlight({ type: "user" }),
      ]);

      expect(renderer.highlightCount).toBe(3);

      const removed = renderer.removeHighlightsByType("search");
      expect(removed).toBe(2);
      expect(renderer.highlightCount).toBe(1);
      expect(renderer.getHighlightsByType("user")).toHaveLength(1);
    });

    it("clears all highlights", () => {
      renderer.addHighlights([createTestHighlight(), createTestHighlight(), createTestHighlight()]);

      expect(renderer.highlightCount).toBe(3);

      renderer.clearHighlights();

      expect(renderer.highlightCount).toBe(0);
    });

    it("clears current highlight when removed", () => {
      const id = renderer.addHighlight(createTestHighlight({ type: "search" }));
      renderer.setCurrentHighlight(id);
      expect(renderer.getCurrentHighlightId()).toBe(id);

      renderer.removeHighlight(id);
      expect(renderer.getCurrentHighlightId()).toBeNull();
    });
  });

  describe("getting highlights", () => {
    it("gets all highlights", () => {
      renderer.addHighlights([createTestHighlight(), createTestHighlight(), createTestHighlight()]);

      const all = renderer.getAllHighlights();
      expect(all).toHaveLength(3);
    });

    it("gets highlights by type", () => {
      renderer.addHighlights([
        createTestHighlight({ type: "search" }),
        createTestHighlight({ type: "search" }),
        createTestHighlight({ type: "user" }),
        createTestHighlight({ type: "selection" }),
      ]);

      expect(renderer.getHighlightsByType("search")).toHaveLength(2);
      expect(renderer.getHighlightsByType("user")).toHaveLength(1);
      expect(renderer.getHighlightsByType("selection")).toHaveLength(1);
    });

    it("gets highlights for a specific page", () => {
      renderer.addHighlights([
        createTestHighlight({ pageIndex: 0 }),
        createTestHighlight({ pageIndex: 0 }),
        createTestHighlight({ pageIndex: 1 }),
        createTestHighlight({ pageIndex: 2 }),
      ]);

      expect(renderer.getHighlightsForPage(0)).toHaveLength(2);
      expect(renderer.getHighlightsForPage(1)).toHaveLength(1);
      expect(renderer.getHighlightsForPage(2)).toHaveLength(1);
      expect(renderer.getHighlightsForPage(3)).toHaveLength(0);
    });
  });

  describe("current highlight", () => {
    it("sets and gets current highlight", () => {
      const id = renderer.addHighlight(createTestHighlight({ type: "search" }));

      renderer.setCurrentHighlight(id);
      expect(renderer.getCurrentHighlightId()).toBe(id);
    });

    it("clears current highlight", () => {
      const id = renderer.addHighlight(createTestHighlight({ type: "search" }));
      renderer.setCurrentHighlight(id);

      renderer.setCurrentHighlight(null);
      expect(renderer.getCurrentHighlightId()).toBeNull();
    });

    it("applies search-current style to current highlight", () => {
      const id = renderer.addHighlight(createTestHighlight({ type: "search", id: "search-1" }));

      const element = container.querySelector("[data-highlight-id='search-1']");
      const initialBg = element?.style.backgroundColor;

      renderer.setCurrentHighlight(id);

      // The style should be different after setting as current
      expect(element?.style.backgroundColor).not.toBe(initialBg);
    });

    it("restores previous current highlight to normal style", () => {
      const id1 = renderer.addHighlight(createTestHighlight({ type: "search", id: "search-1" }));
      renderer.addHighlight(createTestHighlight({ type: "search", id: "search-2" }));

      renderer.setCurrentHighlight(id1);
      const element1 = container.querySelector("[data-highlight-id='search-1']");
      const currentBg = element1?.style.backgroundColor;

      renderer.setCurrentHighlight("search-2");

      // First highlight should be restored to normal style
      expect(element1?.style.backgroundColor).not.toBe(currentBg);
    });
  });

  describe("position updates", () => {
    it("updates all highlight positions", () => {
      renderer.addHighlight(createTestHighlight({ id: "pos-test" }));
      const element = container.querySelector("[data-highlight-id='pos-test']");

      const initialLeft = element?.style.left;

      // Change scale and update
      transformer.setScale(2);
      renderer.updatePositions();

      // Position should have changed
      expect(element?.style.left).not.toBe(initialLeft);
    });

    it("updates positions for specific page only", () => {
      renderer.addHighlight(createTestHighlight({ pageIndex: 0, id: "page-0" }));
      renderer.addHighlight(createTestHighlight({ pageIndex: 1, id: "page-1" }));

      // This should only update page 0 highlights
      renderer.updatePositionsForPage(0);

      // Both elements should still exist
      expect(container.querySelector("[data-highlight-id='page-0']")).toBeTruthy();
      expect(container.querySelector("[data-highlight-id='page-1']")).toBeTruthy();
    });

    it("handles missing transformer gracefully", () => {
      const newRenderer = new HighlightRenderer(container as unknown as HTMLElement);
      newRenderer.addHighlight(createTestHighlight());

      // Should not throw
      expect(() => newRenderer.updatePositions()).not.toThrow();
      newRenderer.destroy();
    });
  });

  describe("visibility control", () => {
    it("sets visibility by type", () => {
      renderer.addHighlight(createTestHighlight({ type: "search", id: "vis-search" }));
      renderer.addHighlight(createTestHighlight({ type: "user", id: "vis-user" }));

      renderer.setTypeVisibility("search", false);

      const searchEl = container.querySelector("[data-highlight-id='vis-search']");
      const userEl = container.querySelector("[data-highlight-id='vis-user']");

      expect(searchEl?.style.display).toBe("none");
      expect(userEl?.style.display).not.toBe("none");
    });

    it("restores visibility", () => {
      renderer.addHighlight(createTestHighlight({ type: "search", id: "vis-restore" }));

      renderer.setTypeVisibility("search", false);
      renderer.setTypeVisibility("search", true);

      const element = container.querySelector("[data-highlight-id='vis-restore']");
      expect(element?.style.display).toBe("");
    });
  });

  describe("character-level highlighting", () => {
    it("uses character bounds when available and enabled", () => {
      const highlight = createTestHighlight({
        charBounds: [
          { x: 100, y: 600, width: 10, height: 20 },
          { x: 110, y: 600, width: 10, height: 20 },
          { x: 120, y: 600, width: 10, height: 20 },
        ],
      });

      renderer.addHighlight(highlight);

      // Should have a container with multiple child elements
      const charElements = container.querySelectorAll(".pdf-highlight-char");
      expect(charElements.length).toBe(3);
    });

    it("respects useCharBounds option", () => {
      renderer.destroy();
      renderer = new HighlightRenderer(container as unknown as HTMLElement, {
        useCharBounds: false,
      });
      renderer.setTransformer(transformer);

      const highlight = createTestHighlight({
        charBounds: [
          { x: 100, y: 600, width: 10, height: 20 },
          { x: 110, y: 600, width: 10, height: 20 },
        ],
      });

      renderer.addHighlight(highlight);

      // Should not have character-level elements
      const charElements = container.querySelectorAll(".pdf-highlight-char");
      expect(charElements.length).toBe(0);
    });
  });

  describe("custom styles", () => {
    it("applies custom styles", () => {
      renderer.destroy();
      renderer = new HighlightRenderer(container as unknown as HTMLElement, {
        styles: {
          search: {
            backgroundColor: "rgba(255, 0, 0, 0.5)",
            borderColor: "red",
            borderWidth: 2,
          },
        },
      });
      renderer.setTransformer(transformer);

      renderer.addHighlight(createTestHighlight({ type: "search", id: "styled" }));

      const element = container.querySelector("[data-highlight-id='styled']");
      expect(element?.style.backgroundColor).toBe("rgba(255, 0, 0, 0.5)");
    });
  });

  describe("event handling", () => {
    it("emits highlights-updated event on add", () => {
      const listener = vi.fn();
      renderer.addEventListener("highlights-updated", listener);

      renderer.addHighlight(createTestHighlight());

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as HighlightsUpdatedEvent;
      expect(event.addedCount).toBe(1);
      expect(event.removedCount).toBe(0);
      expect(event.totalCount).toBe(1);
    });

    it("emits highlights-updated event on remove", () => {
      const id = renderer.addHighlight(createTestHighlight());

      const listener = vi.fn();
      renderer.addEventListener("highlights-updated", listener);

      renderer.removeHighlight(id);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as HighlightsUpdatedEvent;
      expect(event.addedCount).toBe(0);
      expect(event.removedCount).toBe(1);
      expect(event.totalCount).toBe(0);
    });

    it("emits highlights-updated event on clear", () => {
      renderer.addHighlights([createTestHighlight(), createTestHighlight()]);

      const listener = vi.fn();
      renderer.addEventListener("highlights-updated", listener);

      renderer.clearHighlights();

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as HighlightsUpdatedEvent;
      expect(event.removedCount).toBe(2);
    });

    it("emits highlight-click event on click", () => {
      const listener = vi.fn();
      renderer.addEventListener("highlight-click", listener);

      renderer.addHighlight(createTestHighlight({ id: "click-test" }));

      const element = container.querySelector("[data-highlight-id='click-test']");
      (element as MockElement)?.click();

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as HighlightClickEvent;
      expect(event.type).toBe("highlight-click");
      expect(event.highlight.id).toBe("click-test");
    });

    it("emits highlight-hover event on mouseenter", () => {
      const listener = vi.fn();
      renderer.addEventListener("highlight-hover", listener);

      renderer.addHighlight(createTestHighlight({ id: "hover-test" }));

      const element = container.querySelector("[data-highlight-id='hover-test']");
      (element as MockElement)?.dispatchEvent({ type: "mouseenter", bubbles: true });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as HighlightHoverEvent;
      expect(event.type).toBe("highlight-hover");
    });

    it("emits highlight-leave event on mouseleave", () => {
      const listener = vi.fn();
      renderer.addEventListener("highlight-leave", listener);

      renderer.addHighlight(createTestHighlight({ id: "leave-test" }));

      const element = container.querySelector("[data-highlight-id='leave-test']");
      (element as MockElement)?.dispatchEvent({ type: "mouseleave", bubbles: true });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as HighlightLeaveEvent;
      expect(event.type).toBe("highlight-leave");
    });

    it("removes event listener", () => {
      const listener = vi.fn();
      renderer.addEventListener("highlights-updated", listener);
      renderer.removeEventListener("highlights-updated", listener);

      renderer.addHighlight(createTestHighlight());

      expect(listener).not.toHaveBeenCalled();
    });

    it("handles errors in event listeners gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalListener = vi.fn();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      renderer.addEventListener("highlights-updated", errorListener);
      renderer.addEventListener("highlights-updated", normalListener);

      renderer.addHighlight(createTestHighlight());

      // Both listeners should be called, error should be logged
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("destroy", () => {
    it("cleans up all highlights", () => {
      renderer.addHighlights([createTestHighlight(), createTestHighlight()]);

      renderer.destroy();

      expect(renderer.highlightCount).toBe(0);
    });

    it("removes highlight layer from DOM", () => {
      renderer.destroy();

      const layer = container.querySelector(".pdf-highlight-layer");
      expect(layer).toBeNull();
    });

    it("clears event listeners", () => {
      const listener = vi.fn();
      renderer.addEventListener("highlights-updated", listener);

      renderer.destroy();

      // Re-create for testing - listener should not be called
      const newRenderer = new HighlightRenderer(container as unknown as HTMLElement);
      newRenderer.addHighlight(createTestHighlight());
      newRenderer.destroy();

      // Original listener should not have been called for newRenderer's highlight
      expect(listener).toHaveBeenCalledTimes(0);
    });
  });

  describe("zoom persistence", () => {
    it("maintains correct positioning after zoom change", () => {
      const highlight = createTestHighlight({
        id: "zoom-test",
        bounds: { x: 100, y: 600, width: 200, height: 20 },
      });

      renderer.addHighlight(highlight);

      // Get initial position at scale 1
      const element = container.querySelector("[data-highlight-id='zoom-test']");
      const initialWidth = parseFloat(element?.style.width ?? "0");

      // Change to scale 2
      transformer.setScale(2);
      renderer.updatePositions();

      // Width should be doubled
      const scaledWidth = parseFloat(element?.style.width ?? "0");
      expect(scaledWidth).toBeCloseTo(initialWidth * 2, 1);
    });

    it("maintains correct positioning after pan (offset change)", () => {
      const highlight = createTestHighlight({
        id: "pan-test",
        bounds: { x: 100, y: 600, width: 200, height: 20 },
      });

      renderer.addHighlight(highlight);

      const element = container.querySelector("[data-highlight-id='pan-test']");
      const initialLeft = parseFloat(element?.style.left ?? "0");

      // Apply offset
      transformer.setOffset(50, 0);
      renderer.updatePositions();

      // Position should shift by offset
      const newLeft = parseFloat(element?.style.left ?? "0");
      expect(newLeft).toBeCloseTo(initialLeft + 50, 1);
    });
  });

  describe("edge cases", () => {
    it("handles empty highlights array", () => {
      const ids = renderer.addHighlights([]);
      expect(ids).toHaveLength(0);
      expect(renderer.highlightCount).toBe(0);
    });

    it("handles zero-dimension bounds", () => {
      const highlight = createTestHighlight({
        bounds: { x: 100, y: 600, width: 0, height: 0 },
      });

      // Should not throw
      expect(() => renderer.addHighlight(highlight)).not.toThrow();
    });

    it("handles negative coordinates", () => {
      const highlight = createTestHighlight({
        bounds: { x: -50, y: -50, width: 100, height: 20 },
      });

      // Should not throw
      expect(() => renderer.addHighlight(highlight)).not.toThrow();
    });

    it("handles removing from empty renderer", () => {
      expect(renderer.removeHighlightsByType("search")).toBe(0);
      expect(() => renderer.clearHighlights()).not.toThrow();
    });
  });
});
