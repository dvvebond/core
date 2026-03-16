/**
 * TypeScript interfaces for the React PDF Viewer component.
 *
 * Defines props, state, and event types used by ReactPDFViewer
 * and related hooks.
 */

import type React from "react";

import type { PDF } from "../api/pdf";
import type {
  BoundingBoxType,
  BoundingBoxVisibility,
  OverlayBoundingBox,
} from "../frontend/bounding-box-overlay";
import type {
  SearchOptions,
  SearchResult,
  SearchState,
  SearchEventType,
} from "../frontend/search/types";
import type { ScrollMode, SpreadMode } from "../pdf-viewer";
import type { RendererType, RenderResult, Viewport } from "../renderers/base-renderer";

// Re-export types that are also used in the component file
export type { SearchResult, SearchOptions } from "../frontend/search/types";

/**
 * Page render state for tracking individual page status.
 */
export type PageRenderState = "idle" | "rendering" | "rendered" | "error";

/**
 * Information about a rendered page.
 */
export interface RenderedPage {
  /** Page index (0-based) */
  pageIndex: number;
  /** Current render state */
  state: PageRenderState;
  /** Rendered element (canvas or SVG) */
  element: HTMLElement | null;
  /** Error if rendering failed */
  error: Error | null;
  /** Viewport used for rendering */
  viewport: Viewport | null;
}

/**
 * Props for the ReactPDFViewer component.
 */
export interface ReactPDFViewerProps {
  /**
   * The PDF document to display.
   * Can be null/undefined for initial empty state.
   */
  document?: PDF | null;

  /**
   * PDF data as Uint8Array bytes.
   * Alternative to passing a PDF document directly.
   * If provided, the component will load the PDF internally.
   */
  data?: Uint8Array;

  /**
   * URL to load the PDF from.
   * Alternative to passing document or data.
   */
  url?: string;

  /**
   * Renderer type to use for rendering pages.
   * @default "canvas"
   */
  renderer?: RendererType;

  /**
   * Initial scale factor for rendering.
   * @default 1
   */
  initialScale?: number;

  /**
   * Initial page number (1-indexed).
   * @default 1
   */
  initialPage?: number;

  /**
   * Initial rotation in degrees (0, 90, 180, 270).
   * @default 0
   */
  initialRotation?: number;

  /**
   * Scroll mode for page navigation.
   * @default "vertical"
   */
  scrollMode?: ScrollMode;

  /**
   * Spread mode for displaying pages.
   * @default "none"
   */
  spreadMode?: SpreadMode;

  /**
   * Whether to enable text selection layer.
   * @default true
   */
  enableTextLayer?: boolean;

  /**
   * Whether to enable annotation layer.
   * @default true
   */
  enableAnnotationLayer?: boolean;

  /**
   * Maximum concurrent page renders.
   * @default 4
   */
  maxConcurrentRenders?: number;

  /**
   * Number of pages to cache.
   * @default 10
   */
  cacheSize?: number;

  /**
   * CSS class name for the container element.
   */
  className?: string;

  /**
   * Inline styles for the container element.
   */
  style?: React.CSSProperties;

  /**
   * Callback when a page is rendered.
   */
  onPageRender?: (pageIndex: number, result: RenderResult) => void;

  /**
   * Callback when page rendering fails.
   */
  onPageError?: (pageIndex: number, error: Error) => void;

  /**
   * Callback when the current page changes.
   */
  onPageChange?: (pageNumber: number) => void;

  /**
   * Callback when the scale changes.
   */
  onScaleChange?: (scale: number) => void;

  /**
   * Callback when the document is loaded.
   */
  onDocumentLoad?: (pdf: PDF) => void;

  /**
   * Callback when document loading fails.
   */
  onDocumentError?: (error: Error) => void;

  /**
   * Children to render inside the viewer (e.g., overlays).
   */
  children?: React.ReactNode;
}

/**
 * State for the PDF viewer.
 */
export interface PDFViewerState {
  /** Whether the viewer is initialized */
  initialized: boolean;
  /** Whether a document is currently loading */
  loading: boolean;
  /** The loaded PDF document */
  document: PDF | null;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  pageCount: number;
  /** Current scale factor */
  scale: number;
  /** Current rotation in degrees */
  rotation: number;
  /** Loading/error state */
  error: Error | null;
  /** Map of page states by page index */
  pageStates: Map<number, RenderedPage>;
}

/**
 * Actions for the PDF viewer state reducer.
 */
export type PDFViewerAction =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_DOCUMENT"; document: PDF | null }
  | { type: "SET_ERROR"; error: Error | null }
  | { type: "SET_INITIALIZED"; initialized: boolean }
  | { type: "SET_CURRENT_PAGE"; page: number }
  | { type: "SET_SCALE"; scale: number }
  | { type: "SET_ROTATION"; rotation: number }
  | { type: "SET_PAGE_STATE"; pageIndex: number; state: RenderedPage }
  | { type: "CLEAR_PAGE_STATES" };

/**
 * Props for search functionality.
 */
export interface SearchProps {
  /**
   * Enable search functionality.
   * @default true
   */
  enabled?: boolean;

  /**
   * Initial search query.
   */
  initialQuery?: string;

  /**
   * Initial search options.
   */
  initialOptions?: SearchOptions;

  /**
   * Callback when search results change.
   */
  onSearchResults?: (results: SearchResult[]) => void;

  /**
   * Callback when current search result changes.
   */
  onCurrentResultChange?: (result: SearchResult | null, index: number) => void;

  /**
   * Callback when search state changes.
   */
  onSearchStateChange?: (state: SearchState) => void;
}

/**
 * State for search functionality.
 */
export interface SearchStateHook {
  /** Current search query */
  query: string;
  /** Current search options */
  options: SearchOptions;
  /** All search results */
  results: SearchResult[];
  /** Current result index (-1 if none) */
  currentIndex: number;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Current result or null */
  currentResult: SearchResult | null;
  /** Total number of results */
  resultCount: number;
  /** Search error if any */
  error: string | null;
}

/**
 * Search actions returned by the search hook.
 */
export interface SearchActions {
  /** Execute a search */
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  /** Navigate to next result */
  findNext: () => SearchResult | null;
  /** Navigate to previous result */
  findPrevious: () => SearchResult | null;
  /** Go to a specific result by index */
  goToResult: (index: number) => SearchResult | null;
  /** Clear the current search */
  clearSearch: () => void;
  /** Cancel an in-progress search */
  cancelSearch: () => void;
}

/**
 * Props for bounding box overlay functionality.
 */
export interface BoundingBoxProps {
  /**
   * Enable bounding box visualization.
   * @default false
   */
  enabled?: boolean;

  /**
   * Initial visibility settings for bounding box types.
   */
  initialVisibility?: Partial<BoundingBoxVisibility>;

  /**
   * Callback when visibility changes.
   */
  onVisibilityChange?: (visibility: BoundingBoxVisibility) => void;

  /**
   * Callback when a bounding box is clicked.
   */
  onBoxClick?: (box: OverlayBoundingBox, pageIndex: number) => void;

  /**
   * Callback when a bounding box is hovered.
   */
  onBoxHover?: (box: OverlayBoundingBox | null, pageIndex: number) => void;
}

/**
 * State for bounding box functionality.
 */
export interface BoundingBoxStateHook {
  /** Current visibility settings */
  visibility: BoundingBoxVisibility;
  /** Bounding boxes by page index */
  boxes: Map<number, OverlayBoundingBox[]>;
}

/**
 * Bounding box actions returned by the hook.
 */
export interface BoundingBoxActions {
  /** Set visibility for a specific type */
  setVisibility: (type: BoundingBoxType, visible: boolean) => void;
  /** Toggle visibility for a specific type */
  toggleVisibility: (type: BoundingBoxType) => void;
  /** Set all visibility settings */
  setAllVisibility: (visibility: Partial<BoundingBoxVisibility>) => void;
  /** Set bounding boxes for a page */
  setBoundingBoxes: (pageIndex: number, boxes: OverlayBoundingBox[]) => void;
  /** Clear bounding boxes for a page */
  clearBoundingBoxes: (pageIndex: number) => void;
  /** Clear all bounding boxes */
  clearAllBoundingBoxes: () => void;
}

/**
 * Ref handle for imperative control of the viewer.
 */
export interface ReactPDFViewerRef {
  /** Go to a specific page (1-indexed) */
  goToPage: (pageNumber: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  previousPage: () => void;
  /** Set the scale */
  setScale: (scale: number) => void;
  /** Zoom in by a factor */
  zoomIn: (factor?: number) => void;
  /** Zoom out by a factor */
  zoomOut: (factor?: number) => void;
  /** Set the rotation */
  setRotation: (rotation: number) => void;
  /** Rotate by 90 degrees clockwise */
  rotateClockwise: () => void;
  /** Rotate by 90 degrees counter-clockwise */
  rotateCounterClockwise: () => void;
  /** Force re-render of visible pages */
  refresh: () => void;
  /** Get the current viewer state */
  getState: () => PDFViewerState;
  /** Access search functionality */
  search: SearchActions;
  /** Access bounding box functionality */
  boundingBox: BoundingBoxActions;
}

/**
 * Event types emitted by the React viewer.
 */
export type ReactPDFViewerEventType =
  | "pageChange"
  | "scaleChange"
  | "rotationChange"
  | "documentLoad"
  | "documentError"
  | "pageRenderStart"
  | "pageRenderComplete"
  | "pageRenderError"
  | SearchEventType;

/**
 * Event data for React viewer events.
 */
export interface ReactPDFViewerEvent {
  type: ReactPDFViewerEventType;
  pageNumber?: number;
  pageIndex?: number;
  scale?: number;
  rotation?: number;
  document?: PDF;
  error?: Error;
  result?: RenderResult;
  searchResults?: SearchResult[];
  searchState?: SearchState;
}
