/**
 * Event types for the PDF viewer event system.
 */
export enum EventType {
  PDFReady = "pdf:ready",
  ScaleChanged = "scale:changed",
  PageRendered = "page:rendered",
}

/**
 * Payload for PDFReady event, emitted when a PDF document is loaded.
 */
export interface PDFReadyPayload {
  /** Total number of pages in the document */
  pageCount: number;
  /** Document title from metadata, if available */
  title?: string;
  /** Document author from metadata, if available */
  author?: string;
}

/**
 * Payload for ScaleChanged event, emitted when zoom level changes.
 */
export interface ScaleChangedPayload {
  /** Previous scale factor */
  previousScale: number;
  /** New scale factor */
  currentScale: number;
  /** Origin point for the scale change (e.g., pinch center) */
  origin?: { x: number; y: number };
}

/**
 * Payload for PageRendered event, emitted when a page finishes rendering.
 */
export interface PageRenderedPayload {
  /** 1-based page number */
  pageNumber: number;
  /** Render duration in milliseconds */
  renderTime: number;
  /** Whether this was a re-render of an already rendered page */
  isRerender: boolean;
}

/**
 * Maps event types to their corresponding payload types.
 */
export interface EventPayloadMap {
  [EventType.PDFReady]: PDFReadyPayload;
  [EventType.ScaleChanged]: ScaleChangedPayload;
  [EventType.PageRendered]: PageRenderedPayload;
}

/**
 * Generic event listener function type.
 */
export type EventListener<T extends EventType> = (payload: EventPayloadMap[T]) => void;

/**
 * Event handler with metadata for internal management.
 */
export interface EventHandler<T extends EventType> {
  listener: EventListener<T>;
  once: boolean;
}

/**
 * Subscription handle returned when subscribing to events.
 * Call unsubscribe() to remove the listener.
 */
export interface Subscription {
  unsubscribe: () => void;
}
