import {
  buildPDFJSTextLayer,
  createPDFResourceLoader,
  initializePDFJS,
  type PDFDocumentProxy,
  type PageViewport,
} from "@dvvebond/core";
import { forwardRef, useEffect, useRef, useState } from "react";

interface RenderedPDFPageContentProps {
  pdfDocument: PDFDocumentProxy;
  pageNum: number;
  scale: number;
  onRenderSuccess?: (pageNum: number) => void;
  onTextLayerRendered?: (pageNum: number) => void;
}

interface PendingReviewParityReactPDFViewerProps {
  pdfUrl: string;
  filename?: string;
  className?: string;
  onRefreshUrl?: () => Promise<string | null>;
}

function createTextLayerViewport(
  rawViewport: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> extends infer _T
    ? PageViewport
    : never,
): PageViewport {
  return {
    width: rawViewport.width,
    height: rawViewport.height,
    scale: rawViewport.scale,
    rotation: rawViewport.rotation,
    offsetX: rawViewport.offsetX,
    offsetY: rawViewport.offsetY,
    transform: [...rawViewport.transform],
    convertToViewportPoint: (x, y) => {
      const [viewportX, viewportY] = rawViewport.convertToViewportPoint(x, y);
      return [viewportX, viewportY];
    },
    convertToViewportRectangle: rect => rawViewport.convertToViewportRectangle(rect),
    convertToPdfPoint: (x, y) => rawViewport.convertToPdfPoint(x, y),
  };
}

function RenderedPDFPageContent({
  pdfDocument,
  pageNum,
  scale,
  onRenderSuccess,
  onTextLayerRendered,
}: RenderedPDFPageContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel?: () => void; promise: Promise<unknown> } | null = null;

    const renderPage = async () => {
      if (!contentRef.current) {
        return;
      }

      try {
        const pageProxy = await pdfDocument.getPage(pageNum);
        const viewport = pageProxy.getViewport({ scale });
        const textLayerViewport = createTextLayerViewport(viewport as unknown as PageViewport);
        const content = contentRef.current;

        content.innerHTML = "";

        const pageLayer = document.createElement("div");
        pageLayer.style.position = "relative";
        pageLayer.style.width = `${viewport.width}px`;
        pageLayer.style.height = `${viewport.height}px`;
        pageLayer.style.margin = "0 auto";

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Unable to acquire a 2D rendering context.");
        }

        canvas.width = Math.ceil(viewport.width * window.devicePixelRatio);
        canvas.height = Math.ceil(viewport.height * window.devicePixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = "block";
        canvas.style.background = "#ffffff";

        const transform =
          window.devicePixelRatio > 1
            ? [window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0]
            : undefined;

        renderTask = pageProxy.render({
          canvasContext: context,
          viewport,
          transform,
        });

        await renderTask.promise;
        if (cancelled) {
          return;
        }

        onRenderSuccess?.(pageNum);

        const textLayer = document.createElement("div");
        textLayer.className = "react-pdf__Page__textContent textLayer";

        await buildPDFJSTextLayer(pageProxy, {
          container: textLayer,
          viewport: textLayerViewport,
        });

        if (cancelled) {
          return;
        }

        pageLayer.appendChild(canvas);
        pageLayer.appendChild(textLayer);
        content.appendChild(pageLayer);
        onTextLayerRendered?.(pageNum);
        setPageError(null);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "Failed to render page.";
          setPageError(message);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [onRenderSuccess, onTextLayerRendered, pageNum, pdfDocument, scale]);

  return (
    <div ref={contentRef} className="wrapper-parity-page-inner" style={{ minHeight: 240 }}>
      {pageError ? <div className="wrapper-parity-error">{pageError}</div> : null}
    </div>
  );
}

export const PendingReviewParityReactPDFViewer = forwardRef<
  HTMLDivElement,
  PendingReviewParityReactPDFViewerProps
>(function PendingReviewParityReactPDFViewer({ pdfUrl, filename, className, onRefreshUrl }, ref) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale] = useState(1.3);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onRefreshUrlRef = useRef(onRefreshUrl);

  useEffect(() => {
    onRefreshUrlRef.current = onRefreshUrl;
  }, [onRefreshUrl]);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      if (!pdfUrl) {
        setPdfDocument(null);
        setNumPages(0);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        await initializePDFJS();

        const loader = createPDFResourceLoader({
          maxRetries: 3,
          timeout: 30000,
          onUrlRefresh: async () => {
            const refreshCallback = onRefreshUrlRef.current;
            return refreshCallback ? refreshCallback() : null;
          },
        });

        const result = await loader.load({
          type: "url",
          url: pdfUrl,
        });

        if (cancelled) {
          await result.document.destroy();
          return;
        }

        loadedDocument = result.document;
        setPdfDocument(result.document);
        setNumPages(result.document.numPages);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "Failed to load PDF.";
          setError(message);
          setPdfDocument(null);
          setNumPages(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      void loadedDocument?.destroy();
    };
  }, [pdfUrl]);

  return (
    <div ref={ref} className={className}>
      <div className="wrapper-parity-meta" style={{ marginBottom: 16 }}>
        <div>
          <strong>Filename:</strong> {filename ?? "sample.pdf"}
        </div>
        <div>
          <strong>Flow:</strong> PendingPage {"->"} wrapper {"->"} load via
          {" `@dvvebond/core` "} {"->"} render canvas {"->"} build text layer
        </div>
      </div>

      {!pdfUrl && !isLoading ? (
        <div className="wrapper-parity-status">Enter a PDF URL above to load a document.</div>
      ) : null}
      {isLoading ? <div className="wrapper-parity-status">Loading PDF…</div> : null}
      {error ? <div className="wrapper-parity-error">{error}</div> : null}

      {!isLoading && !error && pdfDocument ? (
        <div className="react-pdf__Document mx-auto max-w-full wrapper-parity-document">
          {Array.from({ length: numPages }, (_, index) => {
            const pageNum = index + 1;

            return (
              <div
                key={pageNum}
                className="react-pdf__Page relative wrapper-parity-page"
                data-page-number={pageNum}
              >
                <RenderedPDFPageContent pdfDocument={pdfDocument} pageNum={pageNum} scale={scale} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
