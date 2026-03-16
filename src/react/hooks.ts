/**
 * Custom React hooks for PDF viewer functionality.
 *
 * Provides hooks for managing PDF viewer state, search operations,
 * viewport management, and bounding box visualization.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { PDF } from "../api/pdf";
import {
  BoundingBoxOverlay,
  type BoundingBoxOverlayOptions,
  type BoundingBoxType,
  type BoundingBoxVisibility,
  type OverlayBoundingBox,
} from "../frontend/bounding-box-overlay";
import { SearchEngine, type SearchEngineOptions } from "../frontend/search/SearchEngine";
import type {
  TextProvider,
  SearchOptions,
  SearchResult,
  SearchState,
} from "../frontend/search/types";
import { PDFViewer, type PDFViewerOptions } from "../pdf-viewer";
import type {
  PDFViewerState,
  PDFViewerAction,
  RenderedPage,
  SearchStateHook,
  SearchActions,
  BoundingBoxStateHook,
  BoundingBoxActions,
} from "./types";

/**
 * Initial state for the PDF viewer.
 */
function createInitialViewerState(): PDFViewerState {
  return {
    initialized: false,
    loading: false,
    document: null,
    currentPage: 1,
    pageCount: 0,
    scale: 1,
    rotation: 0,
    error: null,
    pageStates: new Map(),
  };
}

/**
 * Reducer for PDF viewer state.
 */
function viewerReducer(state: PDFViewerState, action: PDFViewerAction): PDFViewerState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "SET_DOCUMENT":
      return {
        ...state,
        document: action.document,
        pageCount: action.document?.getPageCount() ?? 0,
        currentPage: 1,
        error: null,
        pageStates: new Map(),
      };

    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };

    case "SET_INITIALIZED":
      return { ...state, initialized: action.initialized };

    case "SET_CURRENT_PAGE":
      return { ...state, currentPage: action.page };

    case "SET_SCALE":
      return { ...state, scale: action.scale };

    case "SET_ROTATION":
      return { ...state, rotation: action.rotation };

    case "SET_PAGE_STATE": {
      const newPageStates = new Map(state.pageStates);
      newPageStates.set(action.pageIndex, action.state);
      return { ...state, pageStates: newPageStates };
    }

    case "CLEAR_PAGE_STATES":
      return { ...state, pageStates: new Map() };

    default:
      return state;
  }
}

/**
 * Hook for managing PDF viewer state.
 *
 * Handles document loading, page navigation, scale, and rotation.
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   loadDocument,
 *   goToPage,
 *   setScale,
 *   setRotation,
 *   viewer,
 * } = usePDFViewer({
 *   initialScale: 1.5,
 *   onDocumentLoad: (pdf) => console.log('Loaded:', pdf.getPageCount(), 'pages'),
 * });
 * ```
 */
export function usePDFViewer(
  options: {
    document?: PDF | null;
    data?: Uint8Array;
    url?: string;
    initialScale?: number;
    initialPage?: number;
    initialRotation?: number;
    viewerOptions?: PDFViewerOptions;
    onDocumentLoad?: (pdf: PDF) => void;
    onDocumentError?: (error: Error) => void;
    onPageChange?: (pageNumber: number) => void;
    onScaleChange?: (scale: number) => void;
  } = {},
) {
  const [state, dispatch] = useReducer(viewerReducer, createInitialViewerState());
  const viewerRef = useRef<PDFViewer | null>(null);

  // Initialize viewer
  useEffect(() => {
    const viewer = new PDFViewer({
      scale: options.initialScale ?? 1,
      rotation: options.initialRotation ?? 0,
      ...options.viewerOptions,
    });

    viewerRef.current = viewer;

    viewer
      .initialize()
      .then(() => {
        dispatch({ type: "SET_INITIALIZED", initialized: true });
        dispatch({ type: "SET_SCALE", scale: options.initialScale ?? 1 });
        dispatch({ type: "SET_ROTATION", rotation: options.initialRotation ?? 0 });
      })
      .catch(error => {
        dispatch({ type: "SET_ERROR", error });
      });

    // Set up event listeners
    viewer.addEventListener("pagechange", event => {
      if (event.pageNumber !== undefined) {
        dispatch({ type: "SET_CURRENT_PAGE", page: event.pageNumber });
        options.onPageChange?.(event.pageNumber);
      }
    });

    viewer.addEventListener("scalechange", event => {
      if (event.scale !== undefined) {
        dispatch({ type: "SET_SCALE", scale: event.scale });
        options.onScaleChange?.(event.scale);
      }
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Load document from props
  useEffect(() => {
    if (options.document) {
      dispatch({ type: "SET_DOCUMENT", document: options.document });
      viewerRef.current?.setDocument(options.document);
      options.onDocumentLoad?.(options.document);
    }
  }, [options.document]);

  // Load from data
  useEffect(() => {
    if (options.data && !options.document) {
      dispatch({ type: "SET_LOADING", loading: true });

      PDF.load(options.data)
        .then(pdf => {
          dispatch({ type: "SET_DOCUMENT", document: pdf });
          viewerRef.current?.setDocument(pdf);
          dispatch({ type: "SET_LOADING", loading: false });
          options.onDocumentLoad?.(pdf);
        })
        .catch(error => {
          dispatch({ type: "SET_ERROR", error });
          options.onDocumentError?.(error);
        });
    }
  }, [options.data, options.document]);

  // Load from URL
  useEffect(() => {
    if (options.url && !options.document && !options.data) {
      dispatch({ type: "SET_LOADING", loading: true });

      fetch(options.url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then(buffer => PDF.load(new Uint8Array(buffer)))
        .then(pdf => {
          dispatch({ type: "SET_DOCUMENT", document: pdf });
          viewerRef.current?.setDocument(pdf);
          dispatch({ type: "SET_LOADING", loading: false });
          options.onDocumentLoad?.(pdf);
        })
        .catch(error => {
          dispatch({
            type: "SET_ERROR",
            error: error instanceof Error ? error : new Error(String(error)),
          });
          options.onDocumentError?.(error instanceof Error ? error : new Error(String(error)));
        });
    }
  }, [options.url, options.document, options.data]);

  // Navigation functions
  const goToPage = useCallback(
    (pageNumber: number) => {
      if (viewerRef.current && pageNumber >= 1 && pageNumber <= state.pageCount) {
        viewerRef.current.goToPage(pageNumber);
        dispatch({ type: "SET_CURRENT_PAGE", page: pageNumber });
      }
    },
    [state.pageCount],
  );

  const nextPage = useCallback(() => {
    if (state.currentPage < state.pageCount) {
      goToPage(state.currentPage + 1);
    }
  }, [state.currentPage, state.pageCount, goToPage]);

  const previousPage = useCallback(() => {
    if (state.currentPage > 1) {
      goToPage(state.currentPage - 1);
    }
  }, [state.currentPage, goToPage]);

  // Scale functions
  const setScale = useCallback((scale: number) => {
    if (viewerRef.current && scale > 0) {
      viewerRef.current.setScale(scale);
      dispatch({ type: "SET_SCALE", scale });
    }
  }, []);

  const zoomIn = useCallback(
    (factor = 1.25) => {
      setScale(state.scale * factor);
    },
    [state.scale, setScale],
  );

  const zoomOut = useCallback(
    (factor = 1.25) => {
      setScale(state.scale / factor);
    },
    [state.scale, setScale],
  );

  // Rotation functions
  const setRotation = useCallback((rotation: number) => {
    if (viewerRef.current) {
      const normalized = ((rotation % 360) + 360) % 360;
      viewerRef.current.setRotation(normalized);
      dispatch({ type: "SET_ROTATION", rotation: normalized });
    }
  }, []);

  const rotateClockwise = useCallback(() => {
    setRotation(state.rotation + 90);
  }, [state.rotation, setRotation]);

  const rotateCounterClockwise = useCallback(() => {
    setRotation(state.rotation - 90);
  }, [state.rotation, setRotation]);

  // Page state management
  const setPageState = useCallback((pageIndex: number, pageState: RenderedPage) => {
    dispatch({ type: "SET_PAGE_STATE", pageIndex, state: pageState });
  }, []);

  const refresh = useCallback(() => {
    dispatch({ type: "CLEAR_PAGE_STATES" });
    viewerRef.current?.clearCache();
  }, []);

  return {
    state,
    viewer: viewerRef.current,
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
  };
}

/**
 * Hook for PDF search functionality.
 *
 * Provides search state and actions for searching text within a PDF document.
 *
 * @example
 * ```tsx
 * const { state, actions } = usePDFSearch({
 *   document: pdf,
 *   onSearchResults: (results) => console.log('Found:', results.length),
 * });
 *
 * // Execute search
 * actions.search('hello world', { caseSensitive: false });
 *
 * // Navigate results
 * actions.findNext();
 * actions.findPrevious();
 * ```
 */
export function usePDFSearch(options: {
  document: PDF | null;
  enabled?: boolean;
  onSearchResults?: (results: SearchResult[]) => void;
  onCurrentResultChange?: (result: SearchResult | null, index: number) => void;
  onSearchStateChange?: (state: SearchState) => void;
}): { state: SearchStateHook; actions: SearchActions } {
  const { document, enabled = true } = options;

  const [searchState, setSearchState] = useState<SearchStateHook>({
    query: "",
    options: {},
    results: [],
    currentIndex: -1,
    isSearching: false,
    currentResult: null,
    resultCount: 0,
    error: null,
  });

  const searchEngineRef = useRef<SearchEngine | null>(null);

  // Create text provider from document
  const textProvider = useMemo<TextProvider | null>(() => {
    if (!document) {
      return null;
    }

    return {
      getPageCount: () => document.getPageCount(),
      getPageText: async (pageIndex: number) => {
        const page = document.getPage(pageIndex);
        if (!page) {
          return null;
        }
        const pageText = page.extractText();
        return pageText.text;
      },
      getCharBounds: async (_pageIndex: number, _startOffset: number, _endOffset: number) => {
        // For now, return empty array - full implementation would need character-level extraction
        return [];
      },
    };
  }, [document]);

  // Initialize search engine
  useEffect(() => {
    if (!textProvider || !enabled) {
      searchEngineRef.current = null;
      return;
    }

    const engine = new SearchEngine({ textProvider });

    // Set up event listeners
    engine.addEventListener("state-change", event => {
      if ("state" in event) {
        const engineState = event.state as SearchState;
        setSearchState({
          query: engineState.query,
          options: engineState.options,
          results: engineState.results,
          currentIndex: engineState.currentIndex,
          isSearching: engineState.status === "searching",
          currentResult:
            engineState.currentIndex >= 0 ? engineState.results[engineState.currentIndex] : null,
          resultCount: engineState.results.length,
          error: engineState.errorMessage ?? null,
        });
        options.onSearchStateChange?.(engineState);
      }
    });

    engine.addEventListener("search-complete", event => {
      if ("totalResults" in event) {
        options.onSearchResults?.([...(searchEngineRef.current?.results ?? [])]);
      }
    });

    engine.addEventListener("result-change", event => {
      if ("result" in event && "currentIndex" in event) {
        options.onCurrentResultChange?.(
          event.result as SearchResult | null,
          event.currentIndex as number,
        );
      }
    });

    searchEngineRef.current = engine;

    return () => {
      engine.cancelSearch();
    };
  }, [textProvider, enabled]);

  // Actions
  const actions = useMemo<SearchActions>(
    () => ({
      search: async (query: string, searchOptions?: SearchOptions) => {
        if (!searchEngineRef.current) {
          return [];
        }
        return searchEngineRef.current.search(query, searchOptions);
      },
      findNext: () => {
        return searchEngineRef.current?.findNext() ?? null;
      },
      findPrevious: () => {
        return searchEngineRef.current?.findPrevious() ?? null;
      },
      goToResult: (index: number) => {
        return searchEngineRef.current?.goToResult(index) ?? null;
      },
      clearSearch: () => {
        searchEngineRef.current?.clearSearch();
      },
      cancelSearch: () => {
        searchEngineRef.current?.cancelSearch();
      },
    }),
    [],
  );

  return { state: searchState, actions };
}

/**
 * Hook for bounding box visualization.
 *
 * Manages visibility and state for bounding box overlays.
 *
 * @example
 * ```tsx
 * const { state, actions, overlay } = useBoundingBoxOverlay({
 *   initialVisibility: { character: true, word: true },
 * });
 *
 * // Set boxes for a page
 * actions.setBoundingBoxes(0, characterBoxes);
 *
 * // Toggle visibility
 * actions.toggleVisibility('word');
 * ```
 */
export function useBoundingBoxOverlay(options: {
  enabled?: boolean;
  initialVisibility?: Partial<BoundingBoxVisibility>;
  overlayOptions?: BoundingBoxOverlayOptions;
  onVisibilityChange?: (visibility: BoundingBoxVisibility) => void;
}): {
  state: BoundingBoxStateHook;
  actions: BoundingBoxActions;
  overlay: BoundingBoxOverlay | null;
} {
  const { enabled = true, initialVisibility } = options;

  const [state, setState] = useState<BoundingBoxStateHook>({
    visibility: {
      character: false,
      word: false,
      line: false,
      paragraph: false,
      ...initialVisibility,
    },
    boxes: new Map(),
  });

  const overlayRef = useRef<BoundingBoxOverlay | null>(null);

  // Initialize overlay
  useEffect(() => {
    if (!enabled) {
      overlayRef.current = null;
      return;
    }

    const overlay = new BoundingBoxOverlay({
      ...options.overlayOptions,
    });

    // Apply initial visibility
    if (initialVisibility) {
      overlay.setAllVisibility(initialVisibility);
    }

    // Listen for visibility changes
    overlay.addEventListener("visibilityChange", event => {
      if (event.visibility) {
        setState(prev => ({
          ...prev,
          visibility: event.visibility as BoundingBoxVisibility,
        }));
        options.onVisibilityChange?.(event.visibility as BoundingBoxVisibility);
      }
    });

    overlayRef.current = overlay;

    return () => {
      overlay.dispose();
    };
  }, [enabled]);

  // Actions
  const actions = useMemo<BoundingBoxActions>(
    () => ({
      setVisibility: (type: BoundingBoxType, visible: boolean) => {
        overlayRef.current?.setVisibility(type, visible);
        setState(prev => ({
          ...prev,
          visibility: { ...prev.visibility, [type]: visible },
        }));
      },
      toggleVisibility: (type: BoundingBoxType) => {
        overlayRef.current?.toggleVisibility(type);
        setState(prev => ({
          ...prev,
          visibility: { ...prev.visibility, [type]: !prev.visibility[type] },
        }));
      },
      setAllVisibility: (visibility: Partial<BoundingBoxVisibility>) => {
        overlayRef.current?.setAllVisibility(visibility);
        setState(prev => ({
          ...prev,
          visibility: { ...prev.visibility, ...visibility },
        }));
      },
      setBoundingBoxes: (pageIndex: number, boxes: OverlayBoundingBox[]) => {
        overlayRef.current?.setBoundingBoxes(pageIndex, boxes);
        setState(prev => {
          const newBoxes = new Map(prev.boxes);
          newBoxes.set(pageIndex, boxes);
          return { ...prev, boxes: newBoxes };
        });
      },
      clearBoundingBoxes: (pageIndex: number) => {
        overlayRef.current?.clearBoundingBoxes(pageIndex);
        setState(prev => {
          const newBoxes = new Map(prev.boxes);
          newBoxes.delete(pageIndex);
          return { ...prev, boxes: newBoxes };
        });
      },
      clearAllBoundingBoxes: () => {
        overlayRef.current?.clearAllBoundingBoxes();
        setState(prev => ({
          ...prev,
          boxes: new Map(),
        }));
      },
    }),
    [],
  );

  return { state, actions, overlay: overlayRef.current };
}

/**
 * Hook for viewport management.
 *
 * Tracks viewport dimensions and provides utilities for coordinate transformation.
 */
export function useViewport(containerRef: React.RefObject<HTMLElement>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateDimensions = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return dimensions;
}

/**
 * Hook for scroll position tracking.
 */
export function useScrollPosition(containerRef: React.RefObject<HTMLElement>) {
  const [position, setPosition] = useState({ scrollTop: 0, scrollLeft: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      setPosition({
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef]);

  return position;
}
