/**
 * Overlay components for PDF visualization.
 *
 * This module provides viewport-aware overlay components that integrate
 * with the ViewportManager for efficient rendering of visual elements
 * on top of PDF content.
 */

export {
  ViewportAwareBoundingBoxOverlay,
  createViewportAwareBoundingBoxOverlay,
  type ViewportAwareBoundingBoxOverlayOptions,
  type ViewportBounds,
  type ViewportOverlayEventType,
  type ViewportOverlayEvent,
  type ViewportOverlayEventListener,
  // Re-exported base types
  type OverlayBoundingBox,
  type BoundingBoxType,
  type BoundingBoxColors,
  type BoundingBoxVisibility,
  type BoundingBoxOverlayOptions,
} from "./bounding-box-overlay";
