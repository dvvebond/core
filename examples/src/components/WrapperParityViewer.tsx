import {
  buildPDFJSTextLayer,
  createPDFResourceLoader,
  initializePDFJS,
  type PDFDocumentProxy,
  type PageViewport,
} from "@dvvebond/core";
import { useEffect, useRef, useState } from "react";

interface WrapperParityViewerProps {
  pdfUrl: string;
  workerSrc?: string;
  scale?: number;
}

interface RenderedPageProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

function RenderedWrapperPage({ pdfDocument, pageNumber, scale }: RenderedPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel?: () => void; promise: Promise<unknown> } | null = null;

    const renderPage = async () => {
      if (!pageRef.current) {
        return;
      }

      try {
        const pageProxy = await pdfDocument.getPage(pageNumber);
        const rawViewport = pageProxy.getViewport({ scale });
        const textLayerViewport: PageViewport = {
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
        const pageContainer = pageRef.current;

        pageContainer.innerHTML = "";

        const content = document.createElement("div");
        content.style.position = "relative";
        content.style.width = `${rawViewport.width}px`;
        content.style.height = `${rawViewport.height}px`;
        content.style.margin = "0 auto";

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Unable to create a rendering context for the page canvas.");
        }

        canvas.width = Math.ceil(rawViewport.width * window.devicePixelRatio);
        canvas.height = Math.ceil(rawViewport.height * window.devicePixelRatio);
        canvas.style.width = `${rawViewport.width}px`;
        canvas.style.height = `${rawViewport.height}px`;

        const transform =
          window.devicePixelRatio > 1
            ? [window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0]
            : undefined;

        renderTask = pageProxy.render({
          canvasContext: context,
          viewport: rawViewport,
          transform,
        });

        await renderTask.promise;
        if (cancelled) {
          return;
        }

        const textLayer = document.createElement("div");
        textLayer.className = "react-pdf__Page__textContent textLayer";

        await buildPDFJSTextLayer(pageProxy, {
          container: textLayer,
          viewport: textLayerViewport,
        });

        if (cancelled) {
          return;
        }

        content.appendChild(canvas);
        content.appendChild(textLayer);
        pageContainer.appendChild(content);
        setError(null);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "Unable to render this page.";
          setError(message);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdfDocument, pageNumber, scale]);

  return (
    <div
      ref={pageRef}
      className="wrapper-parity-page-inner"
      style={{ minHeight: 240, position: "relative" }}
    >
      {error ? <div className="wrapper-parity-error">{error}</div> : null}
    </div>
  );
}

export function WrapperParityViewer({ pdfUrl, workerSrc, scale = 1.3 }: WrapperParityViewerProps) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await initializePDFJS(workerSrc ? { workerSrc } : {});

        const loader = createPDFResourceLoader({
          maxRetries: 3,
          timeout: 30000,
          ...(workerSrc ? { workerSrc } : {}),
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
        setPageCount(result.document.numPages);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "Failed to load PDF.";
          setError(message);
          setPdfDocument(null);
          setPageCount(0);
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
  }, [pdfUrl, workerSrc]);

  return (
    <div className="wrapper-parity-shell">
      <div className="wrapper-parity-meta">
        <div>
          <strong>Integration path:</strong> `initializePDFJS()` + `createPDFResourceLoader()` +
          `buildPDFJSTextLayer()`
        </div>
        <div>
          <strong>Selection manager:</strong> auto-attached by the library through the text-layer
          builder
        </div>
      </div>

      {isLoading ? <div className="wrapper-parity-status">Loading PDF…</div> : null}
      {error ? <div className="wrapper-parity-error">{error}</div> : null}

      {!isLoading && !error && pdfDocument ? (
        <div className="react-pdf__Document wrapper-parity-document">
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;

            return (
              <div
                key={pageNumber}
                className="react-pdf__Page wrapper-parity-page"
                data-page-number={pageNumber}
              >
                <RenderedWrapperPage
                  pdfDocument={pdfDocument}
                  pageNumber={pageNumber}
                  scale={scale}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
