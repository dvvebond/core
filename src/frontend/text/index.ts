/**
 * Text selection module for PDF documents.
 *
 * This module provides custom text selection handling that solves the problem
 * of selection resetting when users drag across non-text areas in PDF documents.
 *
 * @example
 * ```ts
 * import {
 *   TextSelectionManager,
 *   createTextSelectionManager,
 * } from "@libpdf/core/frontend/text";
 *
 * const manager = createTextSelectionManager({
 *   container: viewerContainer,
 * });
 *
 * // Register text layers for each page
 * manager.registerTextLayer(0, page1TextLayer);
 * manager.registerTextLayer(1, page2TextLayer);
 *
 * // Enable selection handling
 * manager.enable();
 *
 * // Listen for selection changes
 * manager.on("selection-change", (event) => {
 *   console.log("Selected:", event.newText);
 * });
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Selection State Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Core types
  TextPosition,
  SelectionPoint,
  SelectionAnchor,
  DragState,
  PageSelectionRange,
  SelectionState,
  // Text layer types
  TextSpanInfo,
  TextLayerInfo,
  // Event types
  SelectionEventType,
  BaseSelectionEvent,
  SelectionStartEvent,
  SelectionChangeEvent,
  SelectionEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  NonTextCrossingEvent,
  SelectionEvent,
  SelectionEventListener,
} from "./selection-state";

export {
  // State factories
  createInitialSelectionState,
  createInitialDragState,
  createSelectionEvent,
  createSelectionAnchor,
  // Utility functions
  textPositionsEqual,
  compareTextPositions,
  getOrderedPositions,
} from "./selection-state";

// ─────────────────────────────────────────────────────────────────────────────
// Spatial Positioning
// ─────────────────────────────────────────────────────────────────────────────

export type { SpatialPositioningOptions, NearestTextResult } from "./spatial-positioning";

export {
  findNearestText,
  findPageAtPoint,
  createSelectionPointFromScreen,
  findSpanAtOffset,
  getScreenPositionForChar,
  findSpansInRange,
  collectTextLayerInfo,
  collectSpanInfo,
  refreshSpanBounds,
  findNearestLine,
  getLineStart,
  getLineEnd,
} from "./spatial-positioning";

// ─────────────────────────────────────────────────────────────────────────────
// Selection Renderer
// ─────────────────────────────────────────────────────────────────────────────

export type { SelectionRendererOptions } from "./selection-renderer";

export { SelectionRenderer, createSelectionRenderer } from "./selection-renderer";

// ─────────────────────────────────────────────────────────────────────────────
// Text Selection Manager
// ─────────────────────────────────────────────────────────────────────────────

export type { TextSelectionManagerOptions } from "./text-selection-manager";

export { TextSelectionManager, createTextSelectionManager } from "./text-selection-manager";
