/**
 * Types and interfaces for text selection state management.
 *
 * This module defines the data structures used to track text selection
 * across PDF pages, including anchor points, drag state, and selection
 * boundaries.
 */

import type { Point2D } from "../coordinate-transformer";

/**
 * Represents a text position within a page.
 */
export interface TextPosition {
  /** The page index (0-based) */
  pageIndex: number;

  /** The character offset within the page text */
  charOffset: number;

  /** The DOM element containing this text position, if any */
  element?: HTMLElement;

  /** The offset within the element's text content */
  elementOffset?: number;
}

/**
 * Represents a point in the selection with both screen and logical coordinates.
 */
export interface SelectionPoint {
  /** Screen coordinates relative to the viewport */
  screen: Point2D;

  /** Page index where the point lies (-1 if outside all pages) */
  pageIndex: number;

  /** The resolved text position, if any text was found */
  textPosition?: TextPosition;

  /** Whether this point is in a text area */
  isInText: boolean;

  /** Whether this point is in a non-text area (like margins, gutters) */
  isInNonTextArea: boolean;
}

/**
 * Represents an anchor point for text selection.
 *
 * The anchor is the starting point of a selection and remains fixed
 * while the focus (end point) moves during drag operations.
 */
export interface SelectionAnchor {
  /** The selection point at the anchor */
  point: SelectionPoint;

  /** Timestamp when the anchor was set */
  timestamp: number;

  /** Whether the anchor is locked (shouldn't be reset) */
  locked: boolean;
}

/**
 * Represents the current drag state during selection.
 */
export interface DragState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;

  /** The anchor point where dragging started */
  anchor: SelectionAnchor | null;

  /** The current focus point (end of selection) */
  focus: SelectionPoint | null;

  /** Whether the cursor has left the text layer since drag started */
  hasLeftTextLayer: boolean;

  /** The last known text position before leaving text areas */
  lastTextPosition: TextPosition | null;

  /** Number of times the cursor has crossed non-text areas */
  nonTextCrossings: number;
}

/**
 * Represents a range of selected text within a single page.
 */
export interface PageSelectionRange {
  /** The page index */
  pageIndex: number;

  /** Start character offset within the page */
  startOffset: number;

  /** End character offset within the page */
  endOffset: number;

  /** The DOM Range object for this page, if available */
  domRange?: Range;
}

/**
 * Represents the complete selection state.
 */
export interface SelectionState {
  /** Whether there is an active selection */
  hasSelection: boolean;

  /** The selection anchor point */
  anchor: SelectionAnchor | null;

  /** The selection focus point */
  focus: SelectionPoint | null;

  /** Whether the selection spans multiple pages */
  isMultiPage: boolean;

  /** Selection ranges for each affected page */
  pageRanges: PageSelectionRange[];

  /** The selected text content */
  selectedText: string;

  /** Current drag state */
  dragState: DragState;

  /** Timestamp of last state change */
  lastUpdated: number;
}

/**
 * Configuration for text span elements in the text layer.
 */
export interface TextSpanInfo {
  /** The DOM element */
  element: HTMLElement;

  /** The text content */
  text: string;

  /** Start offset in the page's full text */
  startOffset: number;

  /** End offset in the page's full text */
  endOffset: number;

  /** Bounding rect in screen coordinates */
  bounds: DOMRect;

  /** The page index this span belongs to */
  pageIndex: number;
}

/**
 * Information about a text layer container.
 */
export interface TextLayerInfo {
  /** The container element */
  container: HTMLElement;

  /** The page index */
  pageIndex: number;

  /** Array of text spans in this layer */
  spans: TextSpanInfo[];

  /** Total text content of the layer */
  fullText: string;

  /** Whether the layer is currently visible */
  isVisible: boolean;
}

/**
 * Event types for selection state changes.
 */
export type SelectionEventType =
  | "selection-start"
  | "selection-change"
  | "selection-end"
  | "drag-start"
  | "drag-move"
  | "drag-end"
  | "non-text-crossing";

/**
 * Base selection event interface.
 */
export interface BaseSelectionEvent<T extends SelectionEventType> {
  type: T;
  timestamp: number;
}

/**
 * Event emitted when selection starts.
 */
export interface SelectionStartEvent extends BaseSelectionEvent<"selection-start"> {
  anchor: SelectionAnchor;
  source: "mouse" | "touch" | "keyboard";
}

/**
 * Event emitted when selection changes.
 */
export interface SelectionChangeEvent extends BaseSelectionEvent<"selection-change"> {
  state: SelectionState;
  previousText: string;
  newText: string;
}

/**
 * Event emitted when selection ends.
 */
export interface SelectionEndEvent extends BaseSelectionEvent<"selection-end"> {
  state: SelectionState;
  source: "mouse" | "touch" | "keyboard" | "blur";
}

/**
 * Event emitted when drag starts.
 */
export interface DragStartEvent extends BaseSelectionEvent<"drag-start"> {
  anchor: SelectionAnchor;
  screenPosition: Point2D;
}

/**
 * Event emitted during drag movement.
 */
export interface DragMoveEvent extends BaseSelectionEvent<"drag-move"> {
  focus: SelectionPoint;
  screenPosition: Point2D;
  isInTextArea: boolean;
}

/**
 * Event emitted when drag ends.
 */
export interface DragEndEvent extends BaseSelectionEvent<"drag-end"> {
  state: SelectionState;
  wasInNonTextArea: boolean;
}

/**
 * Event emitted when cursor crosses into/out of non-text areas.
 */
export interface NonTextCrossingEvent extends BaseSelectionEvent<"non-text-crossing"> {
  direction: "entering" | "leaving";
  screenPosition: Point2D;
  lastTextPosition: TextPosition | null;
}

/**
 * Union type of all selection events.
 */
export type SelectionEvent =
  | SelectionStartEvent
  | SelectionChangeEvent
  | SelectionEndEvent
  | DragStartEvent
  | DragMoveEvent
  | DragEndEvent
  | NonTextCrossingEvent;

/**
 * Selection event listener type.
 */
export type SelectionEventListener<T extends SelectionEvent = SelectionEvent> = (event: T) => void;

/**
 * Create an initial selection state.
 */
export function createInitialSelectionState(): SelectionState {
  return {
    hasSelection: false,
    anchor: null,
    focus: null,
    isMultiPage: false,
    pageRanges: [],
    selectedText: "",
    dragState: createInitialDragState(),
    lastUpdated: Date.now(),
  };
}

/**
 * Create an initial drag state.
 */
export function createInitialDragState(): DragState {
  return {
    isDragging: false,
    anchor: null,
    focus: null,
    hasLeftTextLayer: false,
    lastTextPosition: null,
    nonTextCrossings: 0,
  };
}

/**
 * Create a selection event with timestamp.
 */
export function createSelectionEvent<T extends SelectionEventType>(
  type: T,
  data: Omit<Extract<SelectionEvent, { type: T }>, "type" | "timestamp">,
): Extract<SelectionEvent, { type: T }> {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as Extract<SelectionEvent, { type: T }>;
}

/**
 * Create a selection anchor from a selection point.
 */
export function createSelectionAnchor(point: SelectionPoint, locked = false): SelectionAnchor {
  return {
    point,
    timestamp: Date.now(),
    locked,
  };
}

/**
 * Check if two text positions are equal.
 */
export function textPositionsEqual(
  a: TextPosition | undefined,
  b: TextPosition | undefined,
): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.pageIndex === b.pageIndex && a.charOffset === b.charOffset;
}

/**
 * Compare two text positions for ordering.
 * Returns negative if a comes before b, positive if after, 0 if equal.
 */
export function compareTextPositions(a: TextPosition, b: TextPosition): number {
  if (a.pageIndex !== b.pageIndex) {
    return a.pageIndex - b.pageIndex;
  }
  return a.charOffset - b.charOffset;
}

/**
 * Get the ordered start and end positions from anchor and focus.
 * Returns positions in document order (start is always before end).
 */
export function getOrderedPositions(
  anchor: TextPosition,
  focus: TextPosition,
): { start: TextPosition; end: TextPosition } {
  const comparison = compareTextPositions(anchor, focus);
  if (comparison <= 0) {
    return { start: anchor, end: focus };
  }
  return { start: focus, end: anchor };
}
