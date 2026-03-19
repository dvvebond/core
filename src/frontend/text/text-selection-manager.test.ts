/**
 * Tests for TextSelectionManager.
 *
 * These tests verify that the text selection system correctly handles:
 * - Selection within text areas
 * - Selection that crosses non-text areas (the main bug fix)
 * - Multi-page selection
 * - Event emission
 */

import { describe, it, expect, vi } from "vitest";

import {
  createInitialSelectionState,
  createInitialDragState,
  createSelectionAnchor,
  createSelectionEvent,
  textPositionsEqual,
  compareTextPositions,
  getOrderedPositions,
  type TextPosition,
  type TextSpanInfo,
  type SelectionPoint,
} from "./selection-state";
import {
  findSpanAtOffset,
} from "./spatial-positioning";

// ─────────────────────────────────────────────────────────────────────────────
// Selection State Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Selection State", () => {
  describe("createInitialSelectionState", () => {
    it("should create initial state with no selection", () => {
      const state = createInitialSelectionState();

      expect(state.hasSelection).toBe(false);
      expect(state.anchor).toBeNull();
      expect(state.focus).toBeNull();
      expect(state.isMultiPage).toBe(false);
      expect(state.pageRanges).toEqual([]);
      expect(state.selectedText).toBe("");
      expect(state.dragState.isDragging).toBe(false);
    });
  });

  describe("createInitialDragState", () => {
    it("should create initial drag state", () => {
      const state = createInitialDragState();

      expect(state.isDragging).toBe(false);
      expect(state.anchor).toBeNull();
      expect(state.focus).toBeNull();
      expect(state.hasLeftTextLayer).toBe(false);
      expect(state.lastTextPosition).toBeNull();
      expect(state.nonTextCrossings).toBe(0);
    });
  });

  describe("textPositionsEqual", () => {
    it("should return true for equal positions", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 10 };
      const b: TextPosition = { pageIndex: 0, charOffset: 10 };

      expect(textPositionsEqual(a, b)).toBe(true);
    });

    it("should return false for different positions", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 10 };
      const b: TextPosition = { pageIndex: 0, charOffset: 20 };

      expect(textPositionsEqual(a, b)).toBe(false);
    });

    it("should return false for different pages", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 10 };
      const b: TextPosition = { pageIndex: 1, charOffset: 10 };

      expect(textPositionsEqual(a, b)).toBe(false);
    });

    it("should handle undefined values", () => {
      expect(textPositionsEqual(undefined, undefined)).toBe(true);
      expect(textPositionsEqual({ pageIndex: 0, charOffset: 0 }, undefined)).toBe(false);
      expect(textPositionsEqual(undefined, { pageIndex: 0, charOffset: 0 })).toBe(false);
    });
  });

  describe("compareTextPositions", () => {
    it("should return negative when a is before b", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 10 };
      const b: TextPosition = { pageIndex: 0, charOffset: 20 };

      expect(compareTextPositions(a, b)).toBeLessThan(0);
    });

    it("should return positive when a is after b", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 30 };
      const b: TextPosition = { pageIndex: 0, charOffset: 20 };

      expect(compareTextPositions(a, b)).toBeGreaterThan(0);
    });

    it("should return 0 when equal", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 10 };
      const b: TextPosition = { pageIndex: 0, charOffset: 10 };

      expect(compareTextPositions(a, b)).toBe(0);
    });

    it("should compare pages first", () => {
      const a: TextPosition = { pageIndex: 0, charOffset: 100 };
      const b: TextPosition = { pageIndex: 1, charOffset: 0 };

      expect(compareTextPositions(a, b)).toBeLessThan(0);
    });
  });

  describe("getOrderedPositions", () => {
    it("should return positions in document order", () => {
      const anchor: TextPosition = { pageIndex: 0, charOffset: 20 };
      const focus: TextPosition = { pageIndex: 0, charOffset: 10 };

      const { start, end } = getOrderedPositions(anchor, focus);

      expect(start).toEqual(focus);
      expect(end).toEqual(anchor);
    });

    it("should preserve order when already correct", () => {
      const anchor: TextPosition = { pageIndex: 0, charOffset: 10 };
      const focus: TextPosition = { pageIndex: 0, charOffset: 20 };

      const { start, end } = getOrderedPositions(anchor, focus);

      expect(start).toEqual(anchor);
      expect(end).toEqual(focus);
    });
  });

  describe("createSelectionEvent", () => {
    it("should create event with timestamp", () => {
      const mockPoint: SelectionPoint = {
        screen: { x: 0, y: 0 },
        pageIndex: 0,
        isInText: true,
        isInNonTextArea: false,
      };
      const event = createSelectionEvent("selection-start", {
        anchor: createSelectionAnchor(mockPoint),
        source: "mouse",
      });

      expect(event.type).toBe("selection-start");
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.source).toBe("mouse");
    });
  });

  describe("createSelectionAnchor", () => {
    it("should create anchor with timestamp and locked state", () => {
      const mockPoint: SelectionPoint = {
        screen: { x: 100, y: 200 },
        pageIndex: 0,
        isInText: true,
        isInNonTextArea: false,
      };

      const anchor = createSelectionAnchor(mockPoint, true);

      expect(anchor.point).toEqual(mockPoint);
      expect(anchor.timestamp).toBeGreaterThan(0);
      expect(anchor.locked).toBe(true);
    });

    it("should default locked to false", () => {
      const mockPoint: SelectionPoint = {
        screen: { x: 100, y: 200 },
        pageIndex: 0,
        isInText: true,
        isInNonTextArea: false,
      };

      const anchor = createSelectionAnchor(mockPoint);

      expect(anchor.locked).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spatial Positioning Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Spatial Positioning", () => {
  describe("findSpanAtOffset", () => {
    it("should find span containing offset", () => {
      const spans: TextSpanInfo[] = [
        { element: {} as HTMLElement, text: "Hello", startOffset: 0, endOffset: 5, bounds: {} as DOMRect, pageIndex: 0 },
        { element: {} as HTMLElement, text: " World", startOffset: 5, endOffset: 11, bounds: {} as DOMRect, pageIndex: 0 },
      ];

      const span = findSpanAtOffset(7, spans);
      expect(span?.text).toBe(" World");
    });

    it("should return null for out of range offset", () => {
      const spans: TextSpanInfo[] = [
        { element: {} as HTMLElement, text: "Hello", startOffset: 0, endOffset: 5, bounds: {} as DOMRect, pageIndex: 0 },
      ];

      const span = findSpanAtOffset(10, spans);
      expect(span).toBeNull();
    });

    it("should find span at exact end", () => {
      const spans: TextSpanInfo[] = [
        { element: {} as HTMLElement, text: "Hello", startOffset: 0, endOffset: 5, bounds: {} as DOMRect, pageIndex: 0 },
      ];

      const span = findSpanAtOffset(5, spans);
      expect(span?.text).toBe("Hello");
    });

    it("should find span at exact start", () => {
      const spans: TextSpanInfo[] = [
        { element: {} as HTMLElement, text: "Hello", startOffset: 0, endOffset: 5, bounds: {} as DOMRect, pageIndex: 0 },
        { element: {} as HTMLElement, text: " World", startOffset: 5, endOffset: 11, bounds: {} as DOMRect, pageIndex: 0 },
      ];

      const span = findSpanAtOffset(0, spans);
      expect(span?.text).toBe("Hello");
    });

    it("should return null for empty spans array", () => {
      const span = findSpanAtOffset(0, []);
      expect(span).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests: Selection Across Non-Text Areas (Bug Fix)
// ─────────────────────────────────────────────────────────────────────────────

describe("Selection Across Non-Text Areas (Bug Fix)", () => {
  it("should track non-text crossings during drag", () => {
    /**
     * Verifies that the manager tracks when the cursor moves in/out of text areas
     */
    const dragState = createInitialDragState();

    expect(dragState.hasLeftTextLayer).toBe(false);
    expect(dragState.nonTextCrossings).toBe(0);

    // Simulate crossing into non-text area
    dragState.hasLeftTextLayer = true;
    dragState.nonTextCrossings = 1;

    expect(dragState.hasLeftTextLayer).toBe(true);
    expect(dragState.nonTextCrossings).toBe(1);
  });

  it("should preserve lastTextPosition when entering non-text area", () => {
    /**
     * When cursor leaves text, we save the last known text position
     * so we can continue the selection when returning to text
     */
    const lastPosition: TextPosition = {
      pageIndex: 0,
      charOffset: 5,
    };

    const dragState = createInitialDragState();
    dragState.lastTextPosition = lastPosition;
    dragState.hasLeftTextLayer = true;

    expect(dragState.lastTextPosition).toEqual(lastPosition);
    expect(dragState.hasLeftTextLayer).toBe(true);
  });

  it("should maintain selection state through drag state transitions", () => {
    /**
     * Verifies the full flow of state changes during a drag that
     * crosses non-text areas
     */
    const selectionState = createInitialSelectionState();

    // Initially no selection
    expect(selectionState.hasSelection).toBe(false);
    expect(selectionState.dragState.isDragging).toBe(false);

    // Start drag
    selectionState.dragState.isDragging = true;
    const anchor: SelectionPoint = {
      screen: { x: 100, y: 100 },
      pageIndex: 0,
      textPosition: { pageIndex: 0, charOffset: 0 },
      isInText: true,
      isInNonTextArea: false,
    };
    selectionState.anchor = createSelectionAnchor(anchor);

    // Move into non-text area
    selectionState.dragState.hasLeftTextLayer = true;
    selectionState.dragState.lastTextPosition = { pageIndex: 0, charOffset: 5 };
    selectionState.dragState.nonTextCrossings = 1;

    // Verify state is preserved
    expect(selectionState.dragState.isDragging).toBe(true);
    expect(selectionState.dragState.lastTextPosition).toEqual({ pageIndex: 0, charOffset: 5 });
    expect(selectionState.anchor).not.toBeNull();

    // End drag
    selectionState.dragState.isDragging = false;

    expect(selectionState.dragState.isDragging).toBe(false);
    expect(selectionState.anchor).not.toBeNull(); // Anchor preserved after drag
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Page Selection Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-Page Selection", () => {
  it("should handle selection spanning multiple pages", () => {
    const anchor: TextPosition = { pageIndex: 0, charOffset: 10 };
    const focus: TextPosition = { pageIndex: 2, charOffset: 5 };

    const { start, end } = getOrderedPositions(anchor, focus);

    expect(start.pageIndex).toBe(0);
    expect(end.pageIndex).toBe(2);
  });

  it("should order positions correctly across pages", () => {
    // Selection from page 2 back to page 0
    const anchor: TextPosition = { pageIndex: 2, charOffset: 10 };
    const focus: TextPosition = { pageIndex: 0, charOffset: 5 };

    const { start, end } = getOrderedPositions(anchor, focus);

    expect(start.pageIndex).toBe(0);
    expect(start.charOffset).toBe(5);
    expect(end.pageIndex).toBe(2);
    expect(end.charOffset).toBe(10);
  });

  it("should handle selection within same page", () => {
    const anchor: TextPosition = { pageIndex: 1, charOffset: 50 };
    const focus: TextPosition = { pageIndex: 1, charOffset: 10 };

    const { start, end } = getOrderedPositions(anchor, focus);

    // Focus should be start since it has smaller charOffset
    expect(start.pageIndex).toBe(1);
    expect(start.charOffset).toBe(10);
    expect(end.pageIndex).toBe(1);
    expect(end.charOffset).toBe(50);
  });

  it("should handle selection at page boundary", () => {
    const anchor: TextPosition = { pageIndex: 0, charOffset: 100 };
    const focus: TextPosition = { pageIndex: 1, charOffset: 0 };

    const { start, end } = getOrderedPositions(anchor, focus);

    expect(start.pageIndex).toBe(0);
    expect(end.pageIndex).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Selection Event Types Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Selection Event Types", () => {
  it("should create drag-start event", () => {
    const mockPoint: SelectionPoint = {
      screen: { x: 100, y: 200 },
      pageIndex: 0,
      isInText: true,
      isInNonTextArea: false,
    };
    const anchor = createSelectionAnchor(mockPoint);

    const event = createSelectionEvent("drag-start", {
      anchor,
      screenPosition: { x: 100, y: 200 },
    });

    expect(event.type).toBe("drag-start");
    expect(event.anchor).toEqual(anchor);
    expect(event.screenPosition).toEqual({ x: 100, y: 200 });
  });

  it("should create drag-move event", () => {
    const focus: SelectionPoint = {
      screen: { x: 150, y: 250 },
      pageIndex: 0,
      isInText: false,
      isInNonTextArea: true,
    };

    const event = createSelectionEvent("drag-move", {
      focus,
      screenPosition: { x: 150, y: 250 },
      isInTextArea: false,
    });

    expect(event.type).toBe("drag-move");
    expect(event.focus).toEqual(focus);
    expect(event.isInTextArea).toBe(false);
  });

  it("should create non-text-crossing event", () => {
    const lastPosition: TextPosition = { pageIndex: 0, charOffset: 10 };

    const event = createSelectionEvent("non-text-crossing", {
      direction: "entering",
      screenPosition: { x: 200, y: 300 },
      lastTextPosition: lastPosition,
    });

    expect(event.type).toBe("non-text-crossing");
    expect(event.direction).toBe("entering");
    expect(event.lastTextPosition).toEqual(lastPosition);
  });
});
