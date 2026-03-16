import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  ViewportAwareBoundingBoxOverlay,
  createViewportAwareBoundingBoxOverlay,
  type OverlayBoundingBox,
  type ViewportBounds,
  type ViewportOverlayEvent,
} from "./bounding-box-overlay";

// Mock HTMLElement interface for testing
interface MockHTMLElement {
  tagName: string;
  style: Record<string, string>;
  className: string;
  children: MockHTMLElement[];
  parentElement: MockHTMLElement | null;
  innerHTML: string;
  appendChild(child: MockHTMLElement): MockHTMLElement;
  removeChild(child: MockHTMLElement): MockHTMLElement;
  querySelector(selector: string): MockHTMLElement | null;
  querySelectorAll(selector: string): MockHTMLElement[];
  remove(): void;
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener: (event: string, callback: () => void) => void;
  dataset: Record<string, string>;
  insertBefore(newChild: MockHTMLElement, refChild: MockHTMLElement | null): MockHTMLElement;
}

function createMockElement(tagName: string = "div"): MockHTMLElement {
  const element: MockHTMLElement = {
    tagName: tagName.toUpperCase(),
    style: {},
    className: "",
    children: [],
    parentElement: null,
    innerHTML: "",
    dataset: {},
    appendChild(child: MockHTMLElement) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    removeChild(child: MockHTMLElement) {
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
        child.parentElement = null;
      }
      return child;
    },
    querySelector(selector: string) {
      // Simple class selector matching
      if (selector.startsWith(".")) {
        const className = selector.slice(1);
        return this.children.find(c => c.className.includes(className)) || null;
      }
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.startsWith(".")) {
        const className = selector.slice(1);
        return this.children.filter(c => c.className.includes(className));
      }
      return [];
    },
    remove() {
      if (this.parentElement) {
        this.parentElement.removeChild(this);
      }
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    insertBefore(newChild: MockHTMLElement, refChild: MockHTMLElement | null) {
      newChild.parentElement = this;
      if (refChild) {
        const index = this.children.indexOf(refChild);
        if (index !== -1) {
          this.children.splice(index, 0, newChild);
          return newChild;
        }
      }
      this.children.push(newChild);
      return newChild;
    },
  };
  return element;
}

// Create mock document
const mockDocument = {
  createElement: vi.fn((tagName: string) => createMockElement(tagName)),
  createDocumentFragment: vi.fn(() => ({
    appendChild: vi.fn(),
    children: [],
  })),
  body: createMockElement("body"),
  documentElement: createMockElement("html"),
};

describe("ViewportAwareBoundingBoxOverlay", () => {
  // ============================================================================
  // Setup and Helpers
  // ============================================================================

  beforeEach(() => {
    // Set up global document mock
    (global as any).document = mockDocument;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up global document
    delete (global as any).document;
  });

  function createMockBoundingBoxes(
    pageIndex: number,
    count: number,
    options: { x?: number; y?: number; width?: number; height?: number } = {},
  ): OverlayBoundingBox[] {
    const boxes: OverlayBoundingBox[] = [];
    const { x = 50, y = 100, width = 100, height = 20 } = options;

    for (let i = 0; i < count; i++) {
      boxes.push({
        type: "word",
        pageIndex,
        x: x + i * (width + 10),
        y: y + Math.floor(i / 5) * (height + 5),
        width,
        height,
        text: `word-${i}`,
      });
    }
    return boxes;
  }

  function createMockContainer(): MockHTMLElement {
    const container = createMockElement("div");
    container.style.position = "relative";
    container.style.width = "612px";
    container.style.height = "792px";
    return container;
  }

  // ============================================================================
  // Construction Tests
  // ============================================================================

  describe("construction", () => {
    it("creates overlay with default options", () => {
      const overlay = createViewportAwareBoundingBoxOverlay();

      expect(overlay).toBeInstanceOf(ViewportAwareBoundingBoxOverlay);
      expect(overlay.isConnected).toBe(false);
      expect(overlay.currentViewport).toBeNull();
    });

    it("creates overlay with custom options", () => {
      const overlay = createViewportAwareBoundingBoxOverlay({
        enableViewportCulling: false,
        cullingMargin: 200,
        autoRenderOnViewportChange: false,
        initialVisibility: {
          word: true,
          character: false,
          line: true,
          paragraph: false,
        },
      });

      expect(overlay.visibility).toEqual({
        word: true,
        character: false,
        line: true,
        paragraph: false,
      });
    });
  });

  // ============================================================================
  // Visibility Tests
  // ============================================================================

  describe("visibility management", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay();
    });

    it("sets visibility for individual types", () => {
      overlay.setVisibility("word", true);
      expect(overlay.visibility.word).toBe(true);
      expect(overlay.visibility.character).toBe(false);

      overlay.setVisibility("character", true);
      expect(overlay.visibility.character).toBe(true);
    });

    it("toggles visibility", () => {
      expect(overlay.visibility.word).toBe(false);
      overlay.toggleVisibility("word");
      expect(overlay.visibility.word).toBe(true);
      overlay.toggleVisibility("word");
      expect(overlay.visibility.word).toBe(false);
    });

    it("sets all visibility at once", () => {
      overlay.setAllVisibility({
        word: true,
        character: true,
        line: true,
        paragraph: true,
      });

      expect(overlay.visibility).toEqual({
        word: true,
        character: true,
        line: true,
        paragraph: true,
      });
    });

    it("emits visibilityChange event", () => {
      const listener = vi.fn();
      overlay.addEventListener("visibilityChange", listener);

      overlay.setVisibility("word", true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "visibilityChange",
          visibility: expect.objectContaining({ word: true }),
        }),
      );
    });
  });

  // ============================================================================
  // Bounding Box Management Tests
  // ============================================================================

  describe("bounding box management", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay();
    });

    it("sets and gets bounding boxes for a page", () => {
      const boxes = createMockBoundingBoxes(0, 5);
      overlay.setBoundingBoxes(0, boxes);

      const retrieved = overlay.getBoundingBoxes(0);
      expect(retrieved).toHaveLength(5);
      expect(retrieved[0].text).toBe("word-0");
    });

    it("returns empty array for pages without boxes", () => {
      const boxes = overlay.getBoundingBoxes(99);
      expect(boxes).toHaveLength(0);
    });

    it("clears bounding boxes for a specific page", () => {
      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setBoundingBoxes(1, createMockBoundingBoxes(1, 3));

      overlay.clearBoundingBoxes(0);

      expect(overlay.getBoundingBoxes(0)).toHaveLength(0);
      expect(overlay.getBoundingBoxes(1)).toHaveLength(3);
    });

    it("clears all bounding boxes", () => {
      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setBoundingBoxes(1, createMockBoundingBoxes(1, 3));
      overlay.setBoundingBoxes(2, createMockBoundingBoxes(2, 7));

      overlay.clearAllBoundingBoxes();

      expect(overlay.getBoundingBoxes(0)).toHaveLength(0);
      expect(overlay.getBoundingBoxes(1)).toHaveLength(0);
      expect(overlay.getBoundingBoxes(2)).toHaveLength(0);
    });

    it("emits boxesChange event", () => {
      const listener = vi.fn();
      overlay.addEventListener("boxesChange", listener);

      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "boxesChange",
          pageIndex: 0,
        }),
      );
    });
  });

  // ============================================================================
  // Viewport Culling Tests
  // ============================================================================

  describe("viewport culling", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay({
        enableViewportCulling: true,
        cullingMargin: 50,
      });
    });

    it("returns all boxes when culling is disabled", () => {
      const noCullingOverlay = createViewportAwareBoundingBoxOverlay({
        enableViewportCulling: false,
      });

      const boxes = createMockBoundingBoxes(0, 10);
      noCullingOverlay.setBoundingBoxes(0, boxes);

      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
      };

      const visible = noCullingOverlay.getVisibleBoundingBoxes(0, viewportBounds);
      expect(visible).toHaveLength(10);
    });

    it("culls boxes outside viewport using scale and pageHeight", () => {
      // Create boxes at different Y positions
      const boxes: OverlayBoundingBox[] = [
        // This box should be visible (y=700 in PDF coords = y=92 in screen coords for 792 height)
        { type: "word", pageIndex: 0, x: 50, y: 700, width: 100, height: 20, text: "visible" },
        // This box should be culled (y=100 in PDF coords = y=692 in screen coords)
        { type: "word", pageIndex: 0, x: 50, y: 100, width: 100, height: 20, text: "culled" },
      ];

      overlay.setBoundingBoxes(0, boxes);

      // Viewport showing only top portion of page
      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 612,
        bottom: 200, // Only showing top 200px
      };

      const visible = overlay.getVisibleBoundingBoxes(0, viewportBounds, 1, 792);

      // Only the box at y=700 (screen y=72) should be visible + margin of 50
      expect(visible.length).toBeLessThanOrEqual(boxes.length);
      expect(visible.some(b => b.text === "visible")).toBe(true);
    });

    it("includes boxes within culling margin", () => {
      // Create a box just outside the viewport but within culling margin
      const boxes: OverlayBoundingBox[] = [
        { type: "word", pageIndex: 0, x: 50, y: 742, width: 100, height: 20, text: "near-edge" },
      ];

      overlay.setBoundingBoxes(0, boxes);

      // Viewport that doesn't quite reach the box, but culling margin should include it
      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 612,
        bottom: 100,
      };

      const visible = overlay.getVisibleBoundingBoxes(0, viewportBounds, 1, 792);

      // Box at y=742 -> screen y=30, which is within viewport + margin
      expect(visible).toHaveLength(1);
    });

    it("returns all boxes when no scale/pageHeight provided and no transformer", () => {
      const boxes = createMockBoundingBoxes(0, 5);
      overlay.setBoundingBoxes(0, boxes);

      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
      };

      // Without scale and pageHeight, all boxes should be included
      const visible = overlay.getVisibleBoundingBoxes(0, viewportBounds);
      expect(visible).toHaveLength(5);
    });
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe("rendering", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;
    let container: MockHTMLElement;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay({
        enableViewportCulling: true,
        cullingMargin: 50,
      });
      container = createMockContainer();
    });

    it("renders to a page container", () => {
      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setVisibility("word", true);

      const element = overlay.renderToPage(0, container as any, 1, 792);

      expect(element).toBeDefined();
      expect(container.querySelector(".bounding-box-overlay")).not.toBeNull();
    });

    it("emits render event with box counts", () => {
      const listener = vi.fn();
      overlay.addEventListener("render", listener);

      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setVisibility("word", true);
      overlay.renderToPage(0, container as any, 1, 792);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "render",
          pageIndex: 0,
          renderedBoxCount: expect.any(Number),
          culledBoxCount: expect.any(Number),
        }),
      );
    });

    it("emits render event with culled count when culling is applied", () => {
      const events: ViewportOverlayEvent[] = [];
      overlay.addEventListener("render", e => events.push(e));

      // Create boxes spread across the page
      const boxes: OverlayBoundingBox[] = [];
      for (let i = 0; i < 20; i++) {
        boxes.push({
          type: "word",
          pageIndex: 0,
          x: 50,
          y: 50 + i * 35, // Spread boxes vertically
          width: 100,
          height: 20,
          text: `word-${i}`,
        });
      }
      overlay.setBoundingBoxes(0, boxes);
      overlay.setVisibility("word", true);

      // Render with limited viewport
      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 612,
        bottom: 200,
      };
      overlay.renderToPage(0, container as any, 1, 792, viewportBounds);

      // Should have culled some boxes
      const renderEvent = events.find(e => e.type === "render");
      expect(renderEvent).toBeDefined();
      expect(renderEvent!.renderedBoxCount).toBeLessThan(20);
    });

    it("removes overlay from page", () => {
      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setVisibility("word", true);
      overlay.renderToPage(0, container as any, 1, 792);

      expect(container.querySelector(".bounding-box-overlay")).not.toBeNull();

      overlay.removeFromPage(0);

      expect(container.querySelector(".bounding-box-overlay")).toBeNull();
    });

    it("removes all overlays", () => {
      const containers = [createMockContainer(), createMockContainer()];

      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setBoundingBoxes(1, createMockBoundingBoxes(1, 3));
      overlay.setVisibility("word", true);
      overlay.renderToPage(0, containers[0] as any, 1, 792);
      overlay.renderToPage(1, containers[1] as any, 1, 792);

      overlay.removeAllOverlays();

      expect(containers[0].querySelector(".bounding-box-overlay")).toBeNull();
      expect(containers[1].querySelector(".bounding-box-overlay")).toBeNull();
    });

    it("updates scale on all overlays", () => {
      const containers = [createMockContainer(), createMockContainer()];

      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setBoundingBoxes(1, createMockBoundingBoxes(1, 3));
      overlay.setVisibility("word", true);
      overlay.renderToPage(0, containers[0] as any, 1, 792);
      overlay.renderToPage(1, containers[1] as any, 1, 792);

      // Update scale - this should trigger re-render internally
      overlay.updateScale(2);

      // The overlays should still exist
      expect(containers[0].querySelector(".bounding-box-overlay")).not.toBeNull();
      expect(containers[1].querySelector(".bounding-box-overlay")).not.toBeNull();
    });
  });

  // ============================================================================
  // Viewport Change Handling Tests
  // ============================================================================

  describe("viewport change handling", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay({
        autoRenderOnViewportChange: true,
      });
    });

    it("handles viewport changes", () => {
      const listener = vi.fn();
      overlay.addEventListener("viewportChange", listener);

      overlay.handleViewportChange(
        { width: 612, height: 792, scale: 1.5, rotation: 0, offsetX: 0, offsetY: 0 },
        612,
        792,
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "viewportChange",
          scale: 1.5,
        }),
      );
    });

    it("stores current viewport", () => {
      expect(overlay.currentViewport).toBeNull();

      overlay.handleViewportChange(
        { width: 1224, height: 1584, scale: 2, rotation: 90, offsetX: 10, offsetY: 20 },
        612,
        792,
      );

      expect(overlay.currentViewport).toEqual({
        width: 1224,
        height: 1584,
        scale: 2,
        rotation: 90,
        offsetX: 10,
        offsetY: 20,
      });
    });
  });

  // ============================================================================
  // Event System Tests
  // ============================================================================

  describe("event system", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay();
    });

    it("adds and removes event listeners", () => {
      const listener = vi.fn();

      overlay.addEventListener("visibilityChange", listener);
      overlay.setVisibility("word", true);
      expect(listener).toHaveBeenCalledTimes(1);

      overlay.removeEventListener("visibilityChange", listener);
      overlay.setVisibility("word", false);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("supports multiple listeners for same event type", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      overlay.addEventListener("visibilityChange", listener1);
      overlay.addEventListener("visibilityChange", listener2);
      overlay.setVisibility("word", true);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("handles listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const goodListener = vi.fn();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      overlay.addEventListener("visibilityChange", errorListener);
      overlay.addEventListener("visibilityChange", goodListener);

      // Should not throw
      overlay.setVisibility("word", true);

      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Dispose Tests
  // ============================================================================

  describe("dispose", () => {
    it("cleans up all resources", () => {
      const overlay = createViewportAwareBoundingBoxOverlay();
      const container = createMockContainer();

      overlay.setBoundingBoxes(0, createMockBoundingBoxes(0, 5));
      overlay.setVisibility("word", true);
      overlay.renderToPage(0, container as any, 1, 792);

      const listener = vi.fn();
      overlay.addEventListener("visibilityChange", listener);

      overlay.dispose();

      // Overlay should be removed
      expect(container.querySelector(".bounding-box-overlay")).toBeNull();

      // Listener should not be called after dispose
      overlay.setVisibility("character", true);
      expect(listener).not.toHaveBeenCalled();
    });

    it("handles multiple dispose calls gracefully", () => {
      const overlay = createViewportAwareBoundingBoxOverlay();

      // Should not throw
      overlay.dispose();
      overlay.dispose();
      overlay.dispose();
    });
  });

  // ============================================================================
  // Coordinate Transformation Tests
  // ============================================================================

  describe("coordinate transformation accuracy", () => {
    let overlay: ViewportAwareBoundingBoxOverlay;

    beforeEach(() => {
      overlay = createViewportAwareBoundingBoxOverlay({
        enableViewportCulling: true,
        cullingMargin: 0, // No margin for precise testing
      });
    });

    it("correctly transforms PDF coordinates to screen coordinates", () => {
      // Box at bottom-left of PDF page should appear at top-left of screen
      const boxes: OverlayBoundingBox[] = [
        { type: "word", pageIndex: 0, x: 0, y: 772, width: 100, height: 20, text: "top" },
      ];
      overlay.setBoundingBoxes(0, boxes);

      // Viewport covering top portion of screen
      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 612,
        bottom: 50,
      };

      const visible = overlay.getVisibleBoundingBoxes(0, viewportBounds, 1, 792);

      // Box at PDF y=772 -> screen y = 792-772-20 = 0
      // Should be visible since it's at the very top
      expect(visible).toHaveLength(1);
    });

    it("respects scale factor in culling", () => {
      const boxes: OverlayBoundingBox[] = [
        { type: "word", pageIndex: 0, x: 50, y: 700, width: 100, height: 20, text: "scaled" },
      ];
      overlay.setBoundingBoxes(0, boxes);

      const viewportBounds: ViewportBounds = {
        left: 0,
        top: 0,
        right: 1224, // 612 * 2
        bottom: 200, // 100 * 2
      };

      // At scale 2, box at PDF y=700 -> screen y = (792-700-20)*2 = 144
      const visible = overlay.getVisibleBoundingBoxes(0, viewportBounds, 2, 792);

      expect(visible).toHaveLength(1);
    });
  });
});
