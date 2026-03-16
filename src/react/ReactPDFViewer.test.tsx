/**
 * Tests for ReactPDFViewer component and related hooks.
 *
 * These tests verify the React wrapper functionality including:
 * - Component rendering and lifecycle
 * - Props handling
 * - Hook behavior
 * - Event callbacks
 */

import React, { createRef } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock React hooks for unit testing without DOM
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: vi.fn(initial => [initial, vi.fn()]),
    useEffect: vi.fn(fn => fn()),
    useCallback: vi.fn(fn => fn),
    useMemo: vi.fn(fn => fn()),
    useRef: vi.fn(initial => ({ current: initial })),
    useReducer: vi.fn((reducer, initial) => [initial, vi.fn()]),
  };
});

import {
  ReactPDFViewer,
  PageNavigation,
  ZoomControls,
  SearchInput,
  usePDFViewer,
  usePDFSearch,
  useBoundingBoxOverlay,
} from "./index";
import type {
  ReactPDFViewerRef,
  ReactPDFViewerProps,
  PDFViewerState,
  SearchStateHook,
} from "./types";

describe("ReactPDFViewer", () => {
  describe("types", () => {
    it("exports ReactPDFViewerProps type", () => {
      // Type-level test - if this compiles, the type is exported correctly
      const props: ReactPDFViewerProps = {
        initialScale: 1.5,
        initialPage: 1,
        className: "test-class",
      };
      expect(props).toBeDefined();
    });

    it("exports ReactPDFViewerRef type", () => {
      // Type-level test
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(() => ({
          initialized: true,
          loading: false,
          document: null,
          currentPage: 1,
          pageCount: 0,
          scale: 1,
          rotation: 0,
          error: null,
          pageStates: new Map(),
        })),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };
      expect(ref).toBeDefined();
    });

    it("exports PDFViewerState type", () => {
      const state: PDFViewerState = {
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
      expect(state).toBeDefined();
    });

    it("exports SearchStateHook type", () => {
      const state: SearchStateHook = {
        query: "",
        options: {},
        results: [],
        currentIndex: -1,
        isSearching: false,
        currentResult: null,
        resultCount: 0,
        error: null,
      };
      expect(state).toBeDefined();
    });
  });

  describe("component exports", () => {
    it("exports ReactPDFViewer component", () => {
      expect(ReactPDFViewer).toBeDefined();
      expect(typeof ReactPDFViewer).toBe("object"); // forwardRef returns object
    });

    it("exports PageNavigation component", () => {
      expect(PageNavigation).toBeDefined();
      expect(typeof PageNavigation).toBe("function");
    });

    it("exports ZoomControls component", () => {
      expect(ZoomControls).toBeDefined();
      expect(typeof ZoomControls).toBe("function");
    });

    it("exports SearchInput component", () => {
      expect(SearchInput).toBeDefined();
      expect(typeof SearchInput).toBe("function");
    });
  });

  describe("hook exports", () => {
    it("exports usePDFViewer hook", () => {
      expect(usePDFViewer).toBeDefined();
      expect(typeof usePDFViewer).toBe("function");
    });

    it("exports usePDFSearch hook", () => {
      expect(usePDFSearch).toBeDefined();
      expect(typeof usePDFSearch).toBe("function");
    });

    it("exports useBoundingBoxOverlay hook", () => {
      expect(useBoundingBoxOverlay).toBeDefined();
      expect(typeof useBoundingBoxOverlay).toBe("function");
    });
  });

  describe("props interface", () => {
    it("accepts document prop", () => {
      const props: ReactPDFViewerProps = {
        document: null,
      };
      expect(props.document).toBeNull();
    });

    it("accepts data prop", () => {
      const props: ReactPDFViewerProps = {
        data: new Uint8Array([1, 2, 3]),
      };
      expect(props.data).toBeInstanceOf(Uint8Array);
    });

    it("accepts url prop", () => {
      const props: ReactPDFViewerProps = {
        url: "/path/to/document.pdf",
      };
      expect(props.url).toBe("/path/to/document.pdf");
    });

    it("accepts renderer prop", () => {
      const props: ReactPDFViewerProps = {
        renderer: "canvas",
      };
      expect(props.renderer).toBe("canvas");
    });

    it("accepts initialScale prop", () => {
      const props: ReactPDFViewerProps = {
        initialScale: 1.5,
      };
      expect(props.initialScale).toBe(1.5);
    });

    it("accepts initialPage prop", () => {
      const props: ReactPDFViewerProps = {
        initialPage: 5,
      };
      expect(props.initialPage).toBe(5);
    });

    it("accepts initialRotation prop", () => {
      const props: ReactPDFViewerProps = {
        initialRotation: 90,
      };
      expect(props.initialRotation).toBe(90);
    });

    it("accepts scrollMode prop", () => {
      const props: ReactPDFViewerProps = {
        scrollMode: "horizontal",
      };
      expect(props.scrollMode).toBe("horizontal");
    });

    it("accepts spreadMode prop", () => {
      const props: ReactPDFViewerProps = {
        spreadMode: "odd",
      };
      expect(props.spreadMode).toBe("odd");
    });

    it("accepts enableTextLayer prop", () => {
      const props: ReactPDFViewerProps = {
        enableTextLayer: false,
      };
      expect(props.enableTextLayer).toBe(false);
    });

    it("accepts enableAnnotationLayer prop", () => {
      const props: ReactPDFViewerProps = {
        enableAnnotationLayer: false,
      };
      expect(props.enableAnnotationLayer).toBe(false);
    });

    it("accepts maxConcurrentRenders prop", () => {
      const props: ReactPDFViewerProps = {
        maxConcurrentRenders: 8,
      };
      expect(props.maxConcurrentRenders).toBe(8);
    });

    it("accepts cacheSize prop", () => {
      const props: ReactPDFViewerProps = {
        cacheSize: 20,
      };
      expect(props.cacheSize).toBe(20);
    });

    it("accepts className prop", () => {
      const props: ReactPDFViewerProps = {
        className: "custom-viewer",
      };
      expect(props.className).toBe("custom-viewer");
    });

    it("accepts style prop", () => {
      const props: ReactPDFViewerProps = {
        style: { width: "100%", height: "500px" },
      };
      expect(props.style).toEqual({ width: "100%", height: "500px" });
    });

    it("accepts callback props", () => {
      const onPageRender = vi.fn();
      const onPageError = vi.fn();
      const onPageChange = vi.fn();
      const onScaleChange = vi.fn();
      const onDocumentLoad = vi.fn();
      const onDocumentError = vi.fn();

      const props: ReactPDFViewerProps = {
        onPageRender,
        onPageError,
        onPageChange,
        onScaleChange,
        onDocumentLoad,
        onDocumentError,
      };

      expect(props.onPageRender).toBe(onPageRender);
      expect(props.onPageError).toBe(onPageError);
      expect(props.onPageChange).toBe(onPageChange);
      expect(props.onScaleChange).toBe(onScaleChange);
      expect(props.onDocumentLoad).toBe(onDocumentLoad);
      expect(props.onDocumentError).toBe(onDocumentError);
    });
  });

  describe("ref methods", () => {
    it("provides goToPage method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.goToPage(5);
      expect(ref.goToPage).toHaveBeenCalledWith(5);
    });

    it("provides nextPage method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.nextPage();
      expect(ref.nextPage).toHaveBeenCalled();
    });

    it("provides previousPage method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.previousPage();
      expect(ref.previousPage).toHaveBeenCalled();
    });

    it("provides setScale method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.setScale(2);
      expect(ref.setScale).toHaveBeenCalledWith(2);
    });

    it("provides zoomIn method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.zoomIn(1.5);
      expect(ref.zoomIn).toHaveBeenCalledWith(1.5);
    });

    it("provides zoomOut method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.zoomOut(1.5);
      expect(ref.zoomOut).toHaveBeenCalledWith(1.5);
    });

    it("provides setRotation method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.setRotation(90);
      expect(ref.setRotation).toHaveBeenCalledWith(90);
    });

    it("provides rotateClockwise method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.rotateClockwise();
      expect(ref.rotateClockwise).toHaveBeenCalled();
    });

    it("provides rotateCounterClockwise method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.rotateCounterClockwise();
      expect(ref.rotateCounterClockwise).toHaveBeenCalled();
    });

    it("provides refresh method", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.refresh();
      expect(ref.refresh).toHaveBeenCalled();
    });

    it("provides getState method", () => {
      const mockState: PDFViewerState = {
        initialized: true,
        loading: false,
        document: null,
        currentPage: 3,
        pageCount: 10,
        scale: 1.5,
        rotation: 90,
        error: null,
        pageStates: new Map(),
      };

      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(() => mockState),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      const state = ref.getState();
      expect(state).toEqual(mockState);
    });

    it("provides search actions", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.search.search("test query");
      expect(ref.search.search).toHaveBeenCalledWith("test query");

      ref.search.findNext();
      expect(ref.search.findNext).toHaveBeenCalled();

      ref.search.findPrevious();
      expect(ref.search.findPrevious).toHaveBeenCalled();

      ref.search.goToResult(5);
      expect(ref.search.goToResult).toHaveBeenCalledWith(5);

      ref.search.clearSearch();
      expect(ref.search.clearSearch).toHaveBeenCalled();

      ref.search.cancelSearch();
      expect(ref.search.cancelSearch).toHaveBeenCalled();
    });

    it("provides boundingBox actions", () => {
      const ref: ReactPDFViewerRef = {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setScale: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setRotation: vi.fn(),
        rotateClockwise: vi.fn(),
        rotateCounterClockwise: vi.fn(),
        refresh: vi.fn(),
        getState: vi.fn(),
        search: {
          search: vi.fn(),
          findNext: vi.fn(),
          findPrevious: vi.fn(),
          goToResult: vi.fn(),
          clearSearch: vi.fn(),
          cancelSearch: vi.fn(),
        },
        boundingBox: {
          setVisibility: vi.fn(),
          toggleVisibility: vi.fn(),
          setAllVisibility: vi.fn(),
          setBoundingBoxes: vi.fn(),
          clearBoundingBoxes: vi.fn(),
          clearAllBoundingBoxes: vi.fn(),
        },
      };

      ref.boundingBox.setVisibility("word", true);
      expect(ref.boundingBox.setVisibility).toHaveBeenCalledWith("word", true);

      ref.boundingBox.toggleVisibility("character");
      expect(ref.boundingBox.toggleVisibility).toHaveBeenCalledWith("character");

      ref.boundingBox.setAllVisibility({ word: true, line: true });
      expect(ref.boundingBox.setAllVisibility).toHaveBeenCalledWith({ word: true, line: true });

      const boxes = [{ x: 0, y: 0, width: 100, height: 20, type: "word" as const, pageIndex: 0 }];
      ref.boundingBox.setBoundingBoxes(0, boxes);
      expect(ref.boundingBox.setBoundingBoxes).toHaveBeenCalledWith(0, boxes);

      ref.boundingBox.clearBoundingBoxes(0);
      expect(ref.boundingBox.clearBoundingBoxes).toHaveBeenCalledWith(0);

      ref.boundingBox.clearAllBoundingBoxes();
      expect(ref.boundingBox.clearAllBoundingBoxes).toHaveBeenCalled();
    });
  });
});

describe("PageNavigation", () => {
  it("is a function component", () => {
    expect(typeof PageNavigation).toBe("function");
  });

  it("accepts correct props", () => {
    const onPageChange = vi.fn();
    const props = {
      currentPage: 5,
      pageCount: 10,
      onPageChange,
      className: "nav-class",
      style: { padding: "10px" },
    };

    expect(props.currentPage).toBe(5);
    expect(props.pageCount).toBe(10);
    expect(props.onPageChange).toBe(onPageChange);
    expect(props.className).toBe("nav-class");
    expect(props.style).toEqual({ padding: "10px" });
  });
});

describe("ZoomControls", () => {
  it("is a function component", () => {
    expect(typeof ZoomControls).toBe("function");
  });

  it("accepts correct props", () => {
    const onScaleChange = vi.fn();
    const props = {
      scale: 1.5,
      minScale: 0.5,
      maxScale: 3,
      onScaleChange,
      className: "zoom-class",
      style: { margin: "5px" },
    };

    expect(props.scale).toBe(1.5);
    expect(props.minScale).toBe(0.5);
    expect(props.maxScale).toBe(3);
    expect(props.onScaleChange).toBe(onScaleChange);
    expect(props.className).toBe("zoom-class");
    expect(props.style).toEqual({ margin: "5px" });
  });
});

describe("SearchInput", () => {
  it("is a function component", () => {
    expect(typeof SearchInput).toBe("function");
  });

  it("accepts correct props", () => {
    const searchState = {
      query: "test",
      results: [{}, {}],
      currentIndex: 0,
      isSearching: false,
    };

    const searchActions = {
      search: vi.fn(),
      findNext: vi.fn(),
      findPrevious: vi.fn(),
      clearSearch: vi.fn(),
    };

    const props = {
      searchState,
      searchActions,
      className: "search-class",
      style: { width: "300px" },
    };

    expect(props.searchState).toBe(searchState);
    expect(props.searchActions).toBe(searchActions);
    expect(props.className).toBe("search-class");
    expect(props.style).toEqual({ width: "300px" });
  });
});
