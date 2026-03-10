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
