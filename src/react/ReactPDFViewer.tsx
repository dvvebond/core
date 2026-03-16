/**
 * ReactPDFViewer - React component wrapper for PDF viewing.
 *
 * Provides a complete PDF viewing solution with React integration,
 * including page rendering, navigation, search, and bounding box visualization.
 *
 * @example
 * ```tsx
 * import { ReactPDFViewer } from "@libpdf/core/react";
 *
 * function App() {
 *   return (
 *     <ReactPDFViewer
 *       url="/document.pdf"
 *       initialScale={1.5}
 *       onPageChange={(page) => console.log('Page:', page)}
 *     />
 *   );
 * }
 * ```
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import type { RenderResult } from "../renderers/base-renderer";
import { usePDFViewer, usePDFSearch, useBoundingBoxOverlay, useViewport } from "./hooks";
import type { ReactPDFViewerProps, ReactPDFViewerRef, RenderedPage } from "./types";

/**
 * Default styles for the viewer container.
 */
const defaultContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "auto",
  backgroundColor: "#525659",
};

/**
 * Default styles for a page container.
 */
const defaultPageStyle: React.CSSProperties = {
  position: "relative",
  margin: "10px auto",
  backgroundColor: "#fff",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
};

/**
 * ReactPDFViewer component for rendering PDF documents in React applications.
 *
 * This component wraps the core PDF viewer infrastructure and provides a React-friendly
 * API with hooks for state management, search, and bounding box visualization.
 *
 * @example
 * Basic usage with URL:
 * ```tsx
 * <ReactPDFViewer url="/path/to/document.pdf" />
 * ```
 *
 * @example
 * With document instance:
 * ```tsx
 * const pdf = await PDF.load(bytes);
 * <ReactPDFViewer document={pdf} initialScale={1.5} />
 * ```
 *
 * @example
 * With ref for imperative control:
 * ```tsx
 * const viewerRef = useRef<ReactPDFViewerRef>(null);
 *
 * // Navigate programmatically
 * viewerRef.current?.goToPage(5);
 * viewerRef.current?.zoomIn();
 *
 * <ReactPDFViewer ref={viewerRef} url="/document.pdf" />
 * ```
 */
export const ReactPDFViewer = forwardRef<ReactPDFViewerRef, ReactPDFViewerProps>(
  function ReactPDFViewer(props, ref) {
    const {
      document: providedDocument,
      data,
      url,
      renderer = "canvas",
      initialScale = 1,
      initialPage = 1,
      initialRotation = 0,
      scrollMode = "vertical",
      spreadMode = "none",
      enableTextLayer = true,
      enableAnnotationLayer = true,
      maxConcurrentRenders = 4,
      cacheSize = 10,
      className,
      style,
      onPageRender,
      onPageError,
      onPageChange,
      onScaleChange,
      onDocumentLoad,
      onDocumentError,
      children,
    } = props;

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const pagesContainerRef = useRef<HTMLDivElement>(null);

    // State for rendered pages
    const [renderedPages, setRenderedPages] = useState<Map<number, HTMLElement>>(new Map());

    // Use PDF viewer hook
    const {
      state: viewerState,
      viewer,
      goToPage,
      nextPage,
      previousPage,
      setScale,
      zoomIn,
      zoomOut,
      setRotation,
      rotateClockwise,
      rotateCounterClockwise,
      setPageState,
      refresh,
    } = usePDFViewer({
      document: providedDocument,
      data,
      url,
      initialScale,
      initialPage,
      initialRotation,
      viewerOptions: {
        renderer,
        scrollMode,
        spreadMode,
        maxConcurrent: maxConcurrentRenders,
        cacheSize,
      },
      onDocumentLoad,
      onDocumentError,
      onPageChange,
      onScaleChange,
    });

    // Use search hook
    const { state: searchState, actions: searchActions } = usePDFSearch({
      document: viewerState.document,
      enabled: true,
    });

    // Use bounding box hook
    const {
      state: bbState,
      actions: bbActions,
      overlay,
    } = useBoundingBoxOverlay({
      enabled: true,
    });

    // Use viewport hook
    const viewport = useViewport(containerRef);

    // Render a single page
    const renderPage = useCallback(
      async (pageIndex: number) => {
        if (!viewer || !viewerState.document || !viewerState.initialized) {
          return;
        }

        const pageNumber = pageIndex + 1;

        // Update page state
        setPageState(pageIndex, {
          pageIndex,
          state: "rendering",
          element: null,
          error: null,
          viewport: null,
        });

        try {
          const renderTask = viewer.renderPage(pageNumber);
          const result = await renderTask.promise;

          // Store the rendered element (cast from unknown to HTMLElement)
          const renderedElement = result.element as HTMLElement;
          setRenderedPages(prev => {
            const next = new Map(prev);
            next.set(pageIndex, renderedElement);
            return next;
          });

          // Update page state
          setPageState(pageIndex, {
            pageIndex,
            state: "rendered",
            element: renderedElement,
            error: null,
            viewport: null, // RenderResult doesn't include viewport
          });

          onPageRender?.(pageIndex, result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          setPageState(pageIndex, {
            pageIndex,
            state: "error",
            element: null,
            error: err,
            viewport: null,
          });

          onPageError?.(pageIndex, err);
        }
      },
      [
        viewer,
        viewerState.document,
        viewerState.initialized,
        setPageState,
        onPageRender,
        onPageError,
      ],
    );

    // Render visible pages when document changes or scale changes
    useEffect(() => {
      if (!viewerState.document || !viewerState.initialized) {
        return;
      }

      // Clear existing renders on scale change
      setRenderedPages(new Map());

      // Render current page and surrounding pages
      const currentIndex = viewerState.currentPage - 1;
      const pagesToRender = [currentIndex];

      // Add adjacent pages
      if (currentIndex > 0) {
        pagesToRender.push(currentIndex - 1);
      }
      if (currentIndex < viewerState.pageCount - 1) {
        pagesToRender.push(currentIndex + 1);
      }

      // Render pages
      for (const pageIndex of pagesToRender) {
        void renderPage(pageIndex);
      }
    }, [viewerState.document, viewerState.initialized, viewerState.scale, viewerState.currentPage]);

    // Scroll to current page
    useEffect(() => {
      const container = pagesContainerRef.current;
      if (!container) {
        return;
      }

      const pageElement = container.querySelector(
        `[data-page-index="${viewerState.currentPage - 1}"]`,
      );
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, [viewerState.currentPage]);

    // Expose imperative API through ref
    useImperativeHandle(
      ref,
      () => ({
        goToPage,
        nextPage,
        previousPage,
        setScale,
        zoomIn,
        zoomOut,
        setRotation,
        rotateClockwise,
        rotateCounterClockwise,
        refresh,
        getState: () => viewerState,
        search: searchActions,
        boundingBox: bbActions,
      }),
      [
        goToPage,
        nextPage,
        previousPage,
        setScale,
        zoomIn,
        zoomOut,
        setRotation,
        rotateClockwise,
        rotateCounterClockwise,
        refresh,
        viewerState,
        searchActions,
        bbActions,
      ],
    );

    // Render loading state
    if (viewerState.loading) {
      return (
        <div
          ref={containerRef}
          className={className}
          style={{ ...defaultContainerStyle, ...style }}
          role="document"
          aria-busy="true"
          aria-label="Loading PDF document"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#fff",
            }}
          >
            Loading...
          </div>
        </div>
      );
    }

    // Render error state
    if (viewerState.error) {
      return (
        <div
          ref={containerRef}
          className={className}
          style={{ ...defaultContainerStyle, ...style }}
          role="alert"
          aria-label="PDF loading error"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#ff6b6b",
              padding: "20px",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ marginBottom: "10px" }}>Failed to load PDF</div>
              <div style={{ fontSize: "0.875rem", opacity: 0.8 }}>{viewerState.error.message}</div>
            </div>
          </div>
        </div>
      );
    }

    // Render empty state
    if (!viewerState.document) {
      return (
        <div
          ref={containerRef}
          className={className}
          style={{ ...defaultContainerStyle, ...style }}
          role="document"
          aria-label="No PDF document loaded"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#888",
            }}
          >
            No document loaded
          </div>
        </div>
      );
    }

    // Calculate page dimensions
    const getPageDimensions = (pageIndex: number) => {
      const page = viewerState.document!.getPage(pageIndex);
      if (!page) {
        return { width: 612 * viewerState.scale, height: 792 * viewerState.scale }; // Default letter size
      }
      return {
        width: page.width * viewerState.scale,
        height: page.height * viewerState.scale,
      };
    };

    // Render document
    return (
      <div
        ref={containerRef}
        className={className}
        style={{ ...defaultContainerStyle, ...style }}
        role="document"
        aria-label={`PDF document with ${viewerState.pageCount} pages`}
      >
        <div
          ref={pagesContainerRef}
          style={{
            display: "flex",
            flexDirection: scrollMode === "horizontal" ? "row" : "column",
            alignItems: "center",
            padding: "20px",
            minHeight: "100%",
          }}
        >
          {Array.from({ length: viewerState.pageCount }, (_, pageIndex) => {
            const dims = getPageDimensions(pageIndex);
            const renderedElement = renderedPages.get(pageIndex);
            const pageState = viewerState.pageStates.get(pageIndex);

            return (
              <div
                key={pageIndex}
                data-page-index={pageIndex}
                style={{
                  ...defaultPageStyle,
                  width: dims.width,
                  height: dims.height,
                }}
                role="img"
                aria-label={`Page ${pageIndex + 1} of ${viewerState.pageCount}`}
              >
                {/* Rendered page content */}
                {renderedElement && (
                  <div
                    ref={el => {
                      if (el && renderedElement && !el.contains(renderedElement)) {
                        el.innerHTML = "";
                        el.appendChild(renderedElement);
                      }
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                )}

                {/* Loading indicator for page */}
                {pageState?.state === "rendering" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      color: "#666",
                    }}
                  >
                    Loading page {pageIndex + 1}...
                  </div>
                )}

                {/* Error indicator for page */}
                {pageState?.state === "error" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      color: "#ff6b6b",
                      textAlign: "center",
                      padding: "10px",
                    }}
                  >
                    <div>Failed to render page {pageIndex + 1}</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                      {pageState.error?.message}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Custom children (overlays, controls, etc.) */}
        {children}
      </div>
    );
  },
);

/**
 * Convenience component for the page navigation bar.
 */
export interface PageNavigationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  pageCount: number;
  /** Callback when user requests a page change */
  onPageChange: (page: number) => void;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

export function PageNavigation({
  currentPage,
  pageCount,
  onPageChange,
  className,
  style,
}: PageNavigationProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));

  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= pageCount) {
      onPageChange(page);
    } else {
      setInputValue(String(currentPage));
    }
  };

  return (
    <div className={className} style={style}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        Previous
      </button>

      <form onSubmit={handleSubmit} style={{ display: "inline" }}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          style={{ width: "50px", textAlign: "center" }}
          aria-label="Page number"
        />
        <span> / {pageCount}</span>
      </form>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= pageCount}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}

/**
 * Convenience component for zoom controls.
 */
export interface ZoomControlsProps {
  /** Current scale */
  scale: number;
  /** Minimum scale */
  minScale?: number;
  /** Maximum scale */
  maxScale?: number;
  /** Callback when scale changes */
  onScaleChange: (scale: number) => void;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

export function ZoomControls({
  scale,
  minScale = 0.25,
  maxScale = 4,
  onScaleChange,
  className,
  style,
}: ZoomControlsProps) {
  const handleZoomIn = () => {
    const newScale = Math.min(scale * 1.25, maxScale);
    onScaleChange(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(scale / 1.25, minScale);
    onScaleChange(newScale);
  };

  const handleReset = () => {
    onScaleChange(1);
  };

  return (
    <div className={className} style={style}>
      <button onClick={handleZoomOut} disabled={scale <= minScale} aria-label="Zoom out">
        -
      </button>

      <span style={{ margin: "0 10px" }}>{Math.round(scale * 100)}%</span>

      <button onClick={handleZoomIn} disabled={scale >= maxScale} aria-label="Zoom in">
        +
      </button>

      <button onClick={handleReset} style={{ marginLeft: "10px" }} aria-label="Reset zoom">
        Reset
      </button>
    </div>
  );
}

/**
 * Convenience component for search input.
 */
export interface SearchInputProps {
  /** Search state */
  searchState: {
    query: string;
    results: Array<unknown>;
    currentIndex: number;
    isSearching: boolean;
  };
  /** Search actions */
  searchActions: {
    search: (query: string) => void;
    findNext: () => void;
    findPrevious: () => void;
    clearSearch: () => void;
  };
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

export function SearchInput({ searchState, searchActions, className, style }: SearchInputProps) {
  const [query, setQuery] = useState(searchState.query);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchActions.search(query);
  };

  const handleClear = () => {
    setQuery("");
    searchActions.clearSearch();
  };

  return (
    <div className={className} style={style}>
      <form onSubmit={handleSubmit} style={{ display: "inline" }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          aria-label="Search text"
        />
        <button type="submit" disabled={searchState.isSearching}>
          Search
        </button>
      </form>

      {searchState.results.length > 0 && (
        <>
          <span style={{ margin: "0 10px" }}>
            {searchState.currentIndex + 1} / {searchState.results.length}
          </span>
          <button onClick={searchActions.findPrevious} aria-label="Previous result">
            Prev
          </button>
          <button onClick={searchActions.findNext} aria-label="Next result">
            Next
          </button>
        </>
      )}

      {(query || searchState.results.length > 0) && (
        <button onClick={handleClear} aria-label="Clear search">
          Clear
        </button>
      )}
    </div>
  );
}

export default ReactPDFViewer;
