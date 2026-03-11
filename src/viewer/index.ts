/**
 * PDF Viewer module.
 *
 * Provides components for building interactive PDF viewers including
 * highlight rendering, coordinate transformation integration, and
 * search result visualization.
 *
 * @example
 * ```ts
 * import {
 *   HighlightRenderer,
 *   createHighlightRenderer,
 * } from '@libpdf/core/viewer';
 *
 * // Create a highlight renderer attached to your viewer container
 * const highlightRenderer = createHighlightRenderer(containerElement);
 *
 * // Connect it to the coordinate transformer
 * highlightRenderer.setTransformer(coordinateTransformer);
 *
 * // Add search result highlights
 * highlightRenderer.addHighlights(searchResults.map(r => ({
 *   pageIndex: r.pageIndex,
 *   bounds: r.bounds,
 *   charBounds: r.charBounds,
 *   type: 'search',
 * })));
 *
 * // Update positions when viewport changes
 * highlightRenderer.updatePositions();
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Highlight Renderer
// ─────────────────────────────────────────────────────────────────────────────

export { HighlightRenderer, createHighlightRenderer } from "./highlight/HighlightRenderer";

// ─────────────────────────────────────────────────────────────────────────────
// Highlight Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Core types
  HighlightType,
  HighlightRegion,
  HighlightGroup,
  HighlightStyle,
  HighlightRendererOptions,
  RenderedHighlight,
  // Event types
  HighlightEventType,
  HighlightEvent,
  HighlightEventListener,
  BaseHighlightEvent,
  HighlightClickEvent,
  HighlightHoverEvent,
  HighlightLeaveEvent,
  HighlightsUpdatedEvent,
} from "./highlight/types";

export {
  DEFAULT_HIGHLIGHT_STYLES,
  createHighlightEvent,
  mergeHighlightStyles,
} from "./highlight/types";

// ─────────────────────────────────────────────────────────────────────────────
// Zoom Controller
// ─────────────────────────────────────────────────────────────────────────────

export { ZoomController, createZoomController } from "./zoom-controller.ts";
export type { ZoomControllerOptions } from "./zoom-controller.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Pan Handler
// ─────────────────────────────────────────────────────────────────────────────

export { PanHandler, createPanHandler } from "./pan-handler.ts";
export type { PanHandlerOptions } from "./pan-handler.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Events
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Common types
  Point,
  Velocity,
  EasingFunction,
  // Zoom events
  ZoomStartEvent,
  ZoomUpdateEvent,
  ZoomEndEvent,
  ZoomEvent,
  ZoomEventListener,
  ZoomAnimationConfig,
  // Pan events
  PanStartEvent,
  PanMoveEvent,
  PanEndEvent,
  PanMomentumEvent,
  PanMomentumEndEvent,
  PanEvent,
  PanEventListener,
  PanMomentumConfig,
  // Combined types
  InteractionEvent,
  InteractionEventListener,
} from "./interaction-events.ts";

export {
  easeLinear,
  easeOutCubic,
  easeOutQuart,
  easeInOutCubic,
  easeOutExpo,
} from "./interaction-events.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Content Stream Processing
// ─────────────────────────────────────────────────────────────────────────────

export {
  ContentStreamProcessor,
  createContentStreamProcessor,
  type TextArrayElement,
} from "./ContentStreamProcessor.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Font Management
// ─────────────────────────────────────────────────────────────────────────────

export {
  FontManager,
  createFontManager,
  getGlobalFontManager,
  type FontMetrics,
  type LoadedFont,
  type FontStyle,
} from "./FontManager.ts";
