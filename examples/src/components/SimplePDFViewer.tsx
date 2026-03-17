import {
  initializePDFJS,
  createPDFResourceLoader,
  createPDFJSRenderer,
  createVirtualScroller,
  createViewportManager,
  buildPDFJSTextLayer,
  type PDFDocumentProxy,
  type PDFResourceLoader,
  type PDFJSRenderer,
  type VirtualScroller,
  type ViewportManager,
  type PageDimensions,
} from "@dvvebond/core";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";

interface SimplePDFViewerProps {
  url?: string;
  data?: Uint8Array;
  initialScale?: number;
  onDocumentLoad?: (pdf: PDFDocumentProxy) => void;
  onDocumentError?: (error: Error) => void;
  onPageChange?: (page: number) => void;
  onScaleChange?: (scale: number) => void;
}

export interface SimplePDFViewerRef {
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
  refresh: () => void;
}

const WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

export const SimplePDFViewer = forwardRef<SimplePDFViewerRef, SimplePDFViewerProps>(
  function SimplePDFViewer(props, ref) {
    const {
      url,
      data,
      initialScale = 1,
      onDocumentLoad,
      onDocumentError,
      onPageChange,
      onScaleChange,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const contentContainerRef = useRef<HTMLDivElement | null>(null);
    const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScaleState] = useState(initialScale);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resourceLoaderRef = useRef<PDFResourceLoader | null>(null);
    const rendererRef = useRef<PDFJSRenderer | null>(null);
    const virtualScrollerRef = useRef<VirtualScroller | null>(null);
    const viewportManagerRef = useRef<ViewportManager | null>(null);
    const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
    const pageDimensionsRef = useRef<Map<number, PageDimensions>>(new Map());

    // Initialize PDF.js and resource loader once
    useEffect(() => {
      let mounted = true;

      const init = async () => {
        try {
          // Initialize PDF.js
          await initializePDFJS({
            workerSrc: WORKER_SRC,
          });

          if (!mounted) {
            return;
          }

          // Create resource loader
          resourceLoaderRef.current = createPDFResourceLoader({
            workerSrc: WORKER_SRC,
            maxRetries: 3,
            timeout: 30000,
          });
        } catch (err) {
          console.error("Failed to initialize PDF.js:", err);
          if (mounted) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(`Initialization failed: ${errorMsg}`);
            onDocumentError?.(err instanceof Error ? err : new Error(errorMsg));
          }
        }
      };

      init();

      return () => {
        mounted = false;
      };
    }, [onDocumentError]);

    // Load PDF when source changes
    useEffect(() => {
      if (!resourceLoaderRef.current) {
        return;
      }
      if (!url && !data) {
        return;
      }

      let mounted = true;

      const loadPDF = async () => {
        setLoading(true);
        setError(null);

        try {
          const loader = resourceLoaderRef.current!;

          let result;
          if (data) {
            result = await loader.load({ type: "bytes", data });
          } else if (url) {
            result = await loader.load({ type: "url", url });
          } else {
            return;
          }

          if (!mounted) {
            return;
          }

          const doc = result.document;
          setPdfDocument(doc);
          setPageCount(doc.numPages);
          setLoading(false);
          onDocumentLoad?.(doc);
        } catch (err) {
          console.error("Failed to load PDF:", err);
          if (mounted) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
            setLoading(false);
            onDocumentError?.(err instanceof Error ? err : new Error(errorMsg));
          }
        }
      };

      loadPDF();

      return () => {
        mounted = false;
      };
    }, [url, data, onDocumentLoad, onDocumentError]);

    // Initialize viewer when document loads
    useEffect(() => {
      if (!pdfDocument || !containerRef.current) {
        return;
      }

      let mounted = true;
      const container = containerRef.current;

      const initViewer = async () => {
        try {
          // Clear previous viewer
          container.innerHTML = "";
          pageElementsRef.current.clear();
          pageDimensionsRef.current.clear();

          // Get page dimensions
          const pageDimensions: PageDimensions[] = [];
          for (let i = 0; i < pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i + 1); // PDF.js uses 1-based indexing
            const viewport = page.getViewport({ scale: 1 });
            const dims = {
              width: viewport.width,
              height: viewport.height,
            };
            pageDimensions.push(dims);
            pageDimensionsRef.current.set(i, dims);
          }

          if (!mounted) {
            return;
          }

          // Create virtual scroller
          const scroller = createVirtualScroller({
            pageDimensions,
            scale: scale,
            pageGap: 20,
            bufferSize: 1,
            viewportWidth: container.clientWidth,
            viewportHeight: container.clientHeight,
          });
          virtualScrollerRef.current = scroller;

          // Set up container for scrolling
          container.style.position = "relative";
          container.style.overflow = "auto";

          // Create content container
          const contentContainer = document.createElement("div");
          contentContainer.className = "viewer-content";
          contentContainer.style.position = "relative";
          contentContainer.style.width = `${Math.max(scroller.totalWidth, container.clientWidth)}px`;
          contentContainer.style.height = `${scroller.totalHeight}px`;
          container.appendChild(contentContainer);
          contentContainerRef.current = contentContainer;

          // Create renderer
          const renderer = createPDFJSRenderer();
          await renderer.initialize();

          // Load document into renderer
          if (data) {
            await renderer.loadDocument(data);
          } else if (url) {
            // Fetch the PDF data for the renderer
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            await renderer.loadDocument(new Uint8Array(arrayBuffer));
          }

          if (!mounted) {
            return;
          }
          rendererRef.current = renderer;

          // Create page source for viewport manager
          const pageSource = {
            async getPage(pageIndex: number) {
              return pdfDocument.getPage(pageIndex + 1);
            },
            getPageCount() {
              return pdfDocument.numPages;
            },
            async getPageDimensions(pageIndex: number) {
              return pageDimensionsRef.current.get(pageIndex) || { width: 0, height: 0 };
            },
            getPageRotation(_pageIndex: number) {
              return 0; // Rotation not yet implemented
            },
          };

          // Create viewport manager
          const viewportManager = createViewportManager({
            scroller: scroller,
            renderer: renderer,
            pageSource: pageSource,
            maxConcurrentRenders: 3,
          });
          viewportManagerRef.current = viewportManager;

          // Handle scroll events
          const handleScroll = () => {
            if (scroller) {
              scroller.scrollTo(container.scrollLeft, container.scrollTop);
            }
          };
          container.addEventListener("scroll", handleScroll);

          // Handle visible range changes
          scroller.addEventListener("visibleRangeChange", (event: any) => {
            if (event.visibleRange) {
              const newPage = event.visibleRange.startIndex + 1;
              if (newPage !== currentPage) {
                setCurrentPage(newPage);
                onPageChange?.(newPage);
              }
            }
          });

          // Handle page renders
          viewportManager.addEventListener("pageRendered", async (event: any) => {
            if (!event.element || !scroller || !pdfDocument) {
              return;
            }

            const pageIndex = event.pageIndex;
            const layout = scroller.getPageLayout(pageIndex);
            if (!layout) {
              return;
            }

            // Get or create page container
            let pageContainer = pageElementsRef.current.get(pageIndex);
            if (!pageContainer && contentContainer) {
              pageContainer = document.createElement("div");
              pageContainer.className = "page-container";
              pageContainer.dataset.pageIndex = String(pageIndex);
              pageElementsRef.current.set(pageIndex, pageContainer);
              contentContainer.appendChild(pageContainer);
            }
            if (!pageContainer) {
              return;
            }

            // Position the container
            pageContainer.style.position = "absolute";
            pageContainer.style.left = `${layout.left}px`;
            pageContainer.style.top = `${layout.top}px`;
            pageContainer.style.width = `${layout.width}px`;
            pageContainer.style.height = `${layout.height}px`;

            // Clear and add canvas
            pageContainer.innerHTML = "";
            const canvas = event.element as HTMLCanvasElement;
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.position = "absolute";
            canvas.style.left = "0";
            canvas.style.top = "0";
            pageContainer.appendChild(canvas);

            // Add text layer
            try {
              const page = await pdfDocument.getPage(pageIndex + 1);
              const viewport = page.getViewport({ scale });

              const textLayerDiv = document.createElement("div");
              textLayerDiv.className = "text-layer";
              textLayerDiv.style.position = "absolute";
              textLayerDiv.style.left = "0";
              textLayerDiv.style.top = "0";
              textLayerDiv.style.right = "0";
              textLayerDiv.style.bottom = "0";
              textLayerDiv.style.overflow = "hidden";
              textLayerDiv.style.lineHeight = "1";
              textLayerDiv.style.opacity = "0.2";

              await buildPDFJSTextLayer(page, {
                container: textLayerDiv,
                viewport: viewport as any,
              });

              pageContainer.appendChild(textLayerDiv);
            } catch (err) {
              console.error(`Failed to build text layer for page ${pageIndex}:`, err);
            }
          });

          // Cleanup function
          return () => {
            container.removeEventListener("scroll", handleScroll);
          };
        } catch (err) {
          console.error("Failed to initialize viewer:", err);
          if (mounted) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(`Viewer initialization failed: ${errorMsg}`);
          }
        }
      };

      initViewer();

      return () => {
        mounted = false;

        // Cleanup viewport manager
        if (viewportManagerRef.current) {
          // ViewportManager cleanup if needed
          viewportManagerRef.current = null;
        }

        // Cleanup virtual scroller
        if (virtualScrollerRef.current) {
          virtualScrollerRef.current = null;
        }

        // Cleanup renderer
        if (rendererRef.current) {
          // Renderer cleanup if needed
          rendererRef.current = null;
        }
      };
    }, [pdfDocument, scale, currentPage, onPageChange, data, url]);

    // Update scale in virtual scroller
    useEffect(() => {
      if (virtualScrollerRef.current) {
        virtualScrollerRef.current.setScale(scale);
      }
    }, [scale]);

    const goToPage = useCallback(
      (page: number) => {
        if (page < 1 || page > pageCount) {
          return;
        }

        // Scroll to page using virtual scroller
        if (virtualScrollerRef.current) {
          const layout = virtualScrollerRef.current.getPageLayout(page - 1);
          if (layout && containerRef.current) {
            containerRef.current.scrollTo({
              top: layout.top,
              behavior: "smooth",
            });
          }
        }

        setCurrentPage(page);
        onPageChange?.(page);
      },
      [pageCount, onPageChange],
    );

    const nextPage = useCallback(() => {
      if (currentPage < pageCount) {
        goToPage(currentPage + 1);
      }
    }, [currentPage, pageCount, goToPage]);

    const previousPage = useCallback(() => {
      if (currentPage > 1) {
        goToPage(currentPage - 1);
      }
    }, [currentPage, goToPage]);

    const setScale = useCallback(
      (newScale: number) => {
        const clampedScale = Math.max(0.25, Math.min(4, newScale));
        setScaleState(clampedScale);
        onScaleChange?.(clampedScale);
      },
      [onScaleChange],
    );

    const zoomIn = useCallback(() => {
      setScale(scale * 1.25);
    }, [scale, setScale]);

    const zoomOut = useCallback(() => {
      setScale(scale / 1.25);
    }, [scale, setScale]);

    const rotateClockwise = useCallback(() => {
      // Rotation not implemented yet
      console.warn("Rotation not yet implemented");
    }, []);

    const rotateCounterClockwise = useCallback(() => {
      // Rotation not implemented yet
      console.warn("Rotation not yet implemented");
    }, []);

    const refresh = useCallback(() => {
      // Force re-render by updating scale
      setScaleState(s => s);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        goToPage,
        nextPage,
        previousPage,
        setScale,
        zoomIn,
        zoomOut,
        rotateClockwise,
        rotateCounterClockwise,
        refresh,
      }),
      [
        goToPage,
        nextPage,
        previousPage,
        setScale,
        zoomIn,
        zoomOut,
        rotateClockwise,
        rotateCounterClockwise,
        refresh,
      ],
    );

    if (loading) {
      return (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#525659",
            color: "#fff",
          }}
        >
          Loading PDF...
        </div>
      );
    }

    if (error) {
      return (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#525659",
            color: "#ff6b6b",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ marginBottom: "10px" }}>Failed to load PDF</div>
            <div style={{ fontSize: "0.875rem", opacity: 0.8 }}>{error}</div>
          </div>
        </div>
      );
    }

    if (!pdfDocument) {
      return (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#525659",
            color: "#888",
          }}
        >
          No document loaded
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          backgroundColor: "#525659",
        }}
      />
    );
  },
);
