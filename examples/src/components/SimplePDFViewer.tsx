import { PDF, createCanvasRenderer, type CanvasRenderer } from "@dvvebond/core";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

interface SimplePDFViewerProps {
  url?: string;
  data?: Uint8Array;
  document?: PDF;
  initialScale?: number;
  onDocumentLoad?: (pdf: PDF) => void;
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

const DPR = window.devicePixelRatio || 1;

export const SimplePDFViewer = forwardRef<SimplePDFViewerRef, SimplePDFViewerProps>(
  function SimplePDFViewer(props, ref) {
    const {
      url,
      data,
      document: providedDocument,
      initialScale = 1,
      onDocumentLoad,
      onDocumentError,
      onPageChange,
      onScaleChange,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<PDF | null>(providedDocument || null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScaleState] = useState(initialScale);
    const [rotation, setRotation] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const renderersRef = useRef<Map<number, CanvasRenderer>>(new Map());
    const canvasesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

    // Load PDF from URL
    useEffect(() => {
      if (url && !data && !providedDocument) {
        setLoading(true);
        setError(null);
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch PDF: ${response.status}`);
            }
            return response.arrayBuffer();
          })
          .then(buffer => PDF.load(new Uint8Array(buffer)))
          .then(loadedPdf => {
            setPdf(loadedPdf);
            setPageCount(loadedPdf.getPageCount());
            setLoading(false);
            onDocumentLoad?.(loadedPdf);
          })
          .catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
            setLoading(false);
            onDocumentError?.(err instanceof Error ? err : new Error(errorMsg));
          });
      }
    }, [url, data, providedDocument, onDocumentLoad, onDocumentError]);

    // Load PDF from data
    useEffect(() => {
      if (data && !providedDocument) {
        setLoading(true);
        setError(null);
        PDF.load(data)
          .then(loadedPdf => {
            setPdf(loadedPdf);
            setPageCount(loadedPdf.getPageCount());
            setLoading(false);
            onDocumentLoad?.(loadedPdf);
          })
          .catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
            setLoading(false);
            onDocumentError?.(err instanceof Error ? err : new Error(errorMsg));
          });
      }
    }, [data, providedDocument, onDocumentLoad, onDocumentError]);

    // Use provided document
    useEffect(() => {
      if (providedDocument) {
        setPdf(providedDocument);
        setPageCount(providedDocument.getPageCount());
        onDocumentLoad?.(providedDocument);
      }
    }, [providedDocument, onDocumentLoad]);

    // Render pages
    useEffect(() => {
      if (!pdf || !containerRef.current) {
        return;
      }

      const container = containerRef.current;
      container.innerHTML = "";

      const pagesContainer = document.createElement("div");
      pagesContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 20px;
      `;
      container.appendChild(pagesContainer);

      // Render all pages
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const pageWrapper = document.createElement("div");
        pageWrapper.style.cssText = `
          background: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          position: relative;
        `;
        pageWrapper.dataset.pageIndex = String(pageIndex);

        const canvas = document.createElement("canvas");
        pageWrapper.appendChild(canvas);
        pagesContainer.appendChild(pageWrapper);

        canvasesRef.current.set(pageIndex, canvas);

        // Render this page
        renderPage(pdf, pageIndex, canvas, scale, rotation);
      }

      return () => {
        // Cleanup renderers
        renderersRef.current.forEach(renderer => {
          // Renderer cleanup if needed
        });
        renderersRef.current.clear();
        canvasesRef.current.clear();
      };
    }, [pdf, pageCount, scale, rotation]);

    const renderPage = async (
      pdfDoc: PDF,
      pageIndex: number,
      canvas: HTMLCanvasElement,
      pageScale: number,
      pageRotation: number,
    ) => {
      try {
        const page = pdfDoc.getPage(pageIndex);
        if (!page) {
          return;
        }

        // Create renderer if needed
        let renderer = renderersRef.current.get(pageIndex);
        if (!renderer) {
          renderer = createCanvasRenderer({ document: pdfDoc });
          renderersRef.current.set(pageIndex, renderer);
        }

        // Calculate dimensions
        let width = page.width * pageScale;
        let height = page.height * pageScale;

        // Swap dimensions for 90/270 degree rotation
        if (pageRotation === 90 || pageRotation === 270) {
          [width, height] = [height, width];
        }

        // Set canvas size
        canvas.width = width * DPR;
        canvas.height = height * DPR;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }

        ctx.scale(DPR, DPR);

        // Apply rotation
        if (pageRotation !== 0) {
          ctx.save();
          ctx.translate(width / 2, height / 2);
          ctx.rotate((pageRotation * Math.PI) / 180);
          ctx.translate((-page.width * pageScale) / 2, (-page.height * pageScale) / 2);
        }

        // Render the page
        await renderer.renderPage(pageIndex, {
          canvasContext: ctx,
          viewport: {
            width: page.width * pageScale,
            height: page.height * pageScale,
            rotation: pageRotation,
            scale: pageScale,
          },
        });

        if (pageRotation !== 0) {
          ctx.restore();
        }
      } catch (err) {
        console.error(`Failed to render page ${pageIndex}:`, err);
      }
    };

    const goToPage = (page: number) => {
      if (page < 1 || page > pageCount) {
        return;
      }
      setCurrentPage(page);
      onPageChange?.(page);

      // Scroll to page
      const pageElement = containerRef.current?.querySelector(`[data-page-index="${page - 1}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const nextPage = () => {
      if (currentPage < pageCount) {
        goToPage(currentPage + 1);
      }
    };

    const previousPage = () => {
      if (currentPage > 1) {
        goToPage(currentPage - 1);
      }
    };

    const setScale = (newScale: number) => {
      const clampedScale = Math.max(0.25, Math.min(4, newScale));
      setScaleState(clampedScale);
      onScaleChange?.(clampedScale);
    };

    const zoomIn = () => setScale(scale * 1.25);
    const zoomOut = () => setScale(scale / 1.25);

    const rotateClockwise = () => {
      setRotation((rotation + 90) % 360);
    };

    const rotateCounterClockwise = () => {
      setRotation((rotation - 90 + 360) % 360);
    };

    const refresh = () => {
      // Force re-render
      setScaleState(s => s);
    };

    useImperativeHandle(ref, () => ({
      goToPage,
      nextPage,
      previousPage,
      setScale,
      zoomIn,
      zoomOut,
      rotateClockwise,
      rotateCounterClockwise,
      refresh,
    }));

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

    if (!pdf) {
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
