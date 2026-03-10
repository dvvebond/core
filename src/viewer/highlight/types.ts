/**
 * Types for highlight rendering in the PDF viewer.
 *
 * Defines interfaces for search highlights, user highlights, and the
 * data structures used by the HighlightRenderer.
 */

import type { BoundingBox } from "#src/text/types";

/**
 * Types of highlights that can be rendered.
 */
export type HighlightType = "search" | "search-current" | "user" | "selection";

/**
 * A single highlight region in PDF coordinates.
 */
export interface HighlightRegion {
  /** Page index where the highlight appears (0-based) */
  pageIndex: number;

  /** Bounding box in PDF coordinates (origin at bottom-left) */
  bounds: BoundingBox;

  /** Individual character bounding boxes for precise highlighting */
  charBounds?: BoundingBox[];

  /** Type of highlight for styling purposes */
  type: HighlightType;

  /** Optional unique identifier for this highlight */
  id?: string;

  /** Optional data associated with this highlight */
  data?: unknown;
}

/**
 * A group of highlights that share the same styling.
 */
export interface HighlightGroup {
  /** Unique identifier for this group */
  id: string;

  /** Highlights in this group */
  highlights: HighlightRegion[];

  /** Type of highlights in this group */
  type: HighlightType;

  /** Whether this group is visible */
  visible: boolean;
}

/**
 * Configuration for highlight styling.
 */
export interface HighlightStyle {
  /** Background color (CSS color string) */
  backgroundColor: string;

  /** Border color (CSS color string) */
  borderColor?: string;

  /** Border width in pixels */
  borderWidth?: number;

  /** Border radius in pixels */
  borderRadius?: number;

  /** Opacity (0-1) */
  opacity?: number;

  /** Mix blend mode for compositing */
  mixBlendMode?: string;
}

/**
 * Default styles for each highlight type.
 */
export const DEFAULT_HIGHLIGHT_STYLES: Record<HighlightType, HighlightStyle> = {
  search: {
    backgroundColor: "rgba(255, 235, 59, 0.4)",
    opacity: 1,
    mixBlendMode: "multiply",
  },
  "search-current": {
    backgroundColor: "rgba(255, 152, 0, 0.6)",
    borderColor: "rgba(255, 87, 34, 0.8)",
    borderWidth: 2,
    opacity: 1,
    mixBlendMode: "multiply",
  },
  user: {
    backgroundColor: "rgba(76, 175, 80, 0.3)",
    opacity: 1,
    mixBlendMode: "multiply",
  },
  selection: {
    backgroundColor: "rgba(33, 150, 243, 0.3)",
    opacity: 1,
    mixBlendMode: "multiply",
  },
};

/**
 * Options for the HighlightRenderer.
 */
export interface HighlightRendererOptions {
  /** Custom styles for highlight types */
  styles?: Partial<Record<HighlightType, Partial<HighlightStyle>>>;

  /** CSS class prefix for highlight elements */
  classPrefix?: string;

  /** Whether to use character-level highlighting when available */
  useCharBounds?: boolean;

  /** Z-index for the highlight layer */
  zIndex?: number;
}

/**
 * State of a rendered highlight element.
 */
export interface RenderedHighlight {
  /** The DOM element representing this highlight */
  element: HTMLElement;

  /** The original highlight region data */
  region: HighlightRegion;

  /** Whether this highlight is currently visible in the viewport */
  visible: boolean;
}

/**
 * Event types emitted by the HighlightRenderer.
 */
export type HighlightEventType =
  | "highlight-click"
  | "highlight-hover"
  | "highlight-leave"
  | "highlights-updated";

/**
 * Base event structure for highlight events.
 */
export interface BaseHighlightEvent<T extends HighlightEventType> {
  type: T;
  timestamp: number;
}

/**
 * Event emitted when a highlight is clicked.
 */
export interface HighlightClickEvent extends BaseHighlightEvent<"highlight-click"> {
  highlight: HighlightRegion;
  originalEvent: MouseEvent;
}

/**
 * Event emitted when mouse hovers over a highlight.
 */
export interface HighlightHoverEvent extends BaseHighlightEvent<"highlight-hover"> {
  highlight: HighlightRegion;
  originalEvent: MouseEvent;
}

/**
 * Event emitted when mouse leaves a highlight.
 */
export interface HighlightLeaveEvent extends BaseHighlightEvent<"highlight-leave"> {
  highlight: HighlightRegion;
  originalEvent: MouseEvent;
}

/**
 * Event emitted when highlights are updated.
 */
export interface HighlightsUpdatedEvent extends BaseHighlightEvent<"highlights-updated"> {
  addedCount: number;
  removedCount: number;
  totalCount: number;
}

/**
 * Union type of all highlight events.
 */
export type HighlightEvent =
  | HighlightClickEvent
  | HighlightHoverEvent
  | HighlightLeaveEvent
  | HighlightsUpdatedEvent;

/**
 * Callback function for highlight event listeners.
 */
export type HighlightEventListener<T extends HighlightEvent = HighlightEvent> = (event: T) => void;

/**
 * Create a highlight event with timestamp.
 */
export function createHighlightEvent<T extends HighlightEventType>(
  type: T,
  data: Omit<Extract<HighlightEvent, { type: T }>, "type" | "timestamp">,
): Extract<HighlightEvent, { type: T }> {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as Extract<HighlightEvent, { type: T }>;
}

/**
 * Merge highlight styles with defaults.
 */
export function mergeHighlightStyles(
  type: HighlightType,
  custom?: Partial<HighlightStyle>,
): HighlightStyle {
  const defaults = DEFAULT_HIGHLIGHT_STYLES[type];
  if (!custom) {
    return { ...defaults };
  }
  return {
    ...defaults,
    ...custom,
  };
}
