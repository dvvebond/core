/**
 * React components and hooks for PDF viewing.
 *
 * This module provides React-friendly wrappers around the core PDF viewer
 * infrastructure, including components for rendering PDFs and hooks for
 * managing viewer state, search, and bounding box visualization.
 *
 * @example
 * ```tsx
 * import {
 *   ReactPDFViewer,
 *   usePDFViewer,
 *   usePDFSearch,
 *   PageNavigation,
 *   ZoomControls,
 * } from "@dvvebond/core/react";
 *
 * function App() {
 *   const viewerRef = useRef<ReactPDFViewerRef>(null);
 *
 *   return (
 *     <ReactPDFViewer
 *       ref={viewerRef}
 *       url="/document.pdf"
 *       initialScale={1.5}
 *       onPageChange={(page) => console.log('Page:', page)}
 *     />
 *   );
 * }
 * ```
 *
 * @module react
 */

// Main component and component types
export {
  ReactPDFViewer,
  PageNavigation,
  ZoomControls,
  SearchInput,
  type PageNavigationProps,
  type ZoomControlsProps,
  type SearchInputProps,
} from "./ReactPDFViewer";

// Hooks
export {
  usePDFViewer,
  usePDFSearch,
  useBoundingBoxOverlay,
  useViewport,
  useScrollPosition,
} from "./hooks";

// Types
export type {
  // Component props
  ReactPDFViewerProps,
  ReactPDFViewerRef,

  // State types
  PageRenderState,
  RenderedPage,
  PDFViewerState,
  PDFViewerAction,

  // Search types
  SearchProps,
  SearchStateHook,
  SearchActions,

  // Bounding box types
  BoundingBoxProps,
  BoundingBoxStateHook,
  BoundingBoxActions,

  // Event types
  ReactPDFViewerEvent,
  ReactPDFViewerEventType,
} from "./types";
