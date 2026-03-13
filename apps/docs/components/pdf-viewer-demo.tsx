"use client";

import {
  FileUp,
  LoaderCircle,
  RefreshCw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type ViewerStatus = "idle" | "loading" | "rendering" | "ready" | "error";

type ViewerSource =
  | {
      kind: "url";
      url: string;
      label: string;
    }
  | {
      kind: "data";
      data: Uint8Array;
      label: string;
    };

type ViewerSummary = {
  label: string;
  pageCount: number;
};

const SAMPLE_URL = "/viewer/sample.pdf";

const SAMPLE_SOURCE: ViewerSource = {
  kind: "url",
  url: SAMPLE_URL,
  label: "sample.pdf",
};

const MIN_SCALE = 0.75;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.25;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function formatScale(scale: number) {
  return `${Math.round(scale * 100)}%`;
}

function isSampleSource(source: ViewerSource) {
  return source.kind === "url" && source.url === SAMPLE_URL;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The viewer failed while loading or rendering the PDF.";
}

export function PDFViewerDemo() {
  const fileInputId = useId();
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const [source, setSource] = useState<ViewerSource>(SAMPLE_SOURCE);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [scale, setScale] = useState(1.25);
  const [rotation, setRotation] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<ViewerSummary>({
    label: SAMPLE_SOURCE.label,
    pageCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const deferredScale = useDeferredValue(scale);
  const deferredRotation = useDeferredValue(rotation);

  useEffect(() => {
    const viewerElement = viewerRef.current;

    if (!viewerElement) {
      return;
    }

    const mountNode = viewerElement;

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let pdfDocument: PDFDocumentProxy | null = null;

    const renderTasks: RenderTask[] = [];
    const textLayers: Array<{ cancel(): void }> = [];
    const annotationLayers: Array<{ cancel(): void }> = [];

    async function renderDocument() {
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      const pdfjsViewer = await import("pdfjs-dist/web/pdf_viewer.mjs");

      if (cancelled) {
        return;
      }

      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      setError(null);
      setStatus("loading");
      setSummary(current => ({
        ...current,
        label: source.label,
      }));

      mountNode.replaceChildren();
      mountNode.style.setProperty("--scale-factor", String(deferredScale));

      const nextLoadingTask =
        source.kind === "url"
          ? pdfjs.getDocument(source.url)
          : pdfjs.getDocument({ data: source.data });
      loadingTask = nextLoadingTask;

      const documentProxy = await nextLoadingTask.promise;

      if (cancelled) {
        void documentProxy.destroy();
        return;
      }

      pdfDocument = documentProxy;

      const eventBus = new pdfjsViewer.EventBus();
      const linkService = new pdfjsViewer.SimpleLinkService({
        eventBus,
        externalLinkTarget: pdfjsViewer.LinkTarget.BLANK,
      });
      const pageAnchors = new Map<number, HTMLElement>();
      const viewerShim = {
        currentPageNumber: 1,
        pagesRotation: deferredRotation,
        isInPresentationMode: false,
        pageLabelToPageNumber(label: string) {
          const pageNumber = Number.parseInt(label, 10);

          return Number.isFinite(pageNumber) ? pageNumber : 0;
        },
        scrollPageIntoView({
          pageNumber,
        }: {
          pageNumber: number;
        }) {
          const pageElement = pageAnchors.get(pageNumber);

          if (!pageElement) {
            return;
          }

          viewerShim.currentPageNumber = pageNumber;
          pageElement.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      };

      linkService.setDocument(documentProxy);
      linkService.setViewer(viewerShim);

      setSummary({
        label: source.label,
        pageCount: documentProxy.numPages,
      });
      setStatus("rendering");

      for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
        if (cancelled) {
          return;
        }

        const page = await documentProxy.getPage(pageNumber);
        const viewport = page.getViewport({
          scale: deferredScale,
          rotation: deferredRotation,
        });

        const frame = document.createElement("article");
        frame.className =
          "rounded-[28px] border border-border/70 bg-white/90 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-neutral-950/80 dark:shadow-[0_20px_80px_rgba(0,0,0,0.35)]";

        const header = document.createElement("div");
        header.className =
          "mb-3 flex items-center justify-between gap-3 px-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground";
        const pageLabel = document.createElement("span");
        pageLabel.textContent = `Page ${pageNumber}`;
        const sizeLabel = document.createElement("span");
        sizeLabel.textContent = `${Math.round(viewport.width)} x ${Math.round(viewport.height)} px`;
        header.append(pageLabel, sizeLabel);

        const pageElement = document.createElement("div");
        pageElement.className = "page mx-auto overflow-hidden rounded-[20px] bg-white";
        pageElement.style.width = `${viewport.width}px`;
        pageElement.style.height = `${viewport.height}px`;
        pageElement.style.setProperty("--user-unit", String(page.userUnit));

        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "canvasWrapper";

        const canvas = document.createElement("canvas");
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
        const canvasContext = canvas.getContext("2d", { alpha: false });

        if (!canvasContext) {
          throw new Error("Unable to create a 2D canvas context for the PDF page.");
        }

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        canvasWrapper.append(canvas);
        pageElement.append(canvasWrapper);
        frame.append(header, pageElement);
        mountNode.append(frame);
        pageAnchors.set(pageNumber, pageElement);

        const renderTask = page.render({
          canvasContext,
          canvas,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });

        renderTasks.push(renderTask);
        await renderTask.promise;

        if (cancelled) {
          return;
        }

        const textLayer = new pdfjsViewer.TextLayerBuilder({
          pdfPage: page,
          onAppend(div: HTMLDivElement) {
            pageElement.append(div);
          },
        });

        textLayers.push(textLayer);
        await textLayer.render({ viewport });

        if (cancelled) {
          return;
        }

        const annotationLayer = new pdfjsViewer.AnnotationLayerBuilder({
          pdfPage: page,
          linkService,
          renderForms: true,
          imageResourcesPath: "/pdfjs-images/",
          onAppend(div: HTMLDivElement) {
            pageElement.append(div);
          },
        });

        annotationLayers.push(annotationLayer);
        await annotationLayer.render({
          viewport,
          intent: "display",
        });

        page.cleanup();
      }

      if (!cancelled) {
        setStatus("ready");
      }
    }

    renderDocument().catch(currentError => {
      if (cancelled) {
        return;
      }

      const name = currentError instanceof Error ? currentError.name : "";

      if (name === "AbortException" || name === "RenderingCancelledException") {
        return;
      }

      mountNode.replaceChildren();
      setStatus("error");
      setError(getErrorMessage(currentError));
    });

    return () => {
      cancelled = true;

      for (const task of renderTasks) {
        task.cancel();
      }

      for (const textLayer of textLayers) {
        textLayer.cancel();
      }

      for (const annotationLayer of annotationLayers) {
        annotationLayer.cancel();
      }

      if (loadingTask) {
        void loadingTask.destroy();
      }

      if (pdfDocument) {
        void pdfDocument.destroy();
      }
    };
  }, [source, deferredRotation, deferredScale, reloadKey]);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    startTransition(() => {
      setSource({
        kind: "data",
        data: bytes,
        label: file.name,
      });
      setError(null);
    });

    event.target.value = "";
  }

  function handleZoom(delta: number) {
    startTransition(() => {
      setScale(current => clampScale(current + delta));
    });
  }

  function handleRotate() {
    startTransition(() => {
      setRotation(current => (current + 90) % 360);
    });
  }

  function handleResetSample() {
    startTransition(() => {
      setSource(SAMPLE_SOURCE);
      setRotation(0);
      setScale(1.25);
      setError(null);
    });
  }

  function handleRefresh() {
    startTransition(() => {
      setReloadKey(current => current + 1);
      setError(null);
    });
  }

  return (
    <div className="not-prose my-10 overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,#f7f1e8,transparent_38%),linear-gradient(180deg,#fffdf8_0%,#f6efe3_48%,#ebe6db_100%)] shadow-[0_30px_120px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,#40311d,transparent_28%),linear-gradient(180deg,#171717_0%,#0f0f0f_100%)]">
      <div className="border-b border-black/5 bg-white/70 px-6 py-6 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Custom Viewer
            </p>
            <h3 className="mt-3 font-serif text-3xl tracking-tight text-foreground">
              A LibPDF repo viewer built with the same runtime primitives that power pdf.js
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This is not the stock Mozilla UI. It is a custom viewer shell that wires together the
              `pdf.js` worker, page proxies, canvas renderer, text selection layer, and annotation
              layer in this repo&apos;s docs app.
            </p>
          </div>

          <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>Document</div>
              <div className="mt-2 text-base font-semibold tracking-normal text-foreground">
                {summary.label}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>Pages</div>
              <div className="mt-2 text-base font-semibold tracking-normal text-foreground">
                {summary.pageCount || "..."}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>Mode</div>
              <div className="mt-2 text-base font-semibold tracking-normal text-foreground">
                canvas + text + annotations
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={fileInputId}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              <FileUp className="h-4 w-4" />
              Upload PDF
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleFileSelection}
            />

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Re-render
            </button>

            {!isSampleSource(source) ? (
              <button
                type="button"
                onClick={handleResetSample}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-transparent px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/60 dark:border-white/10 dark:hover:bg-white/10"
              >
                Reset sample
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-black/10 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => handleZoom(-SCALE_STEP)}
                className="rounded-full p-2 text-foreground transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                disabled={scale <= MIN_SCALE}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-16 px-2 text-center text-sm font-medium text-foreground">
                {formatScale(scale)}
              </span>
              <button
                type="button"
                onClick={() => handleZoom(SCALE_STEP)}
                className="rounded-full p-2 text-foreground transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                disabled={scale >= MAX_SCALE}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleRotate}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <RotateCw className="h-4 w-4" />
              Rotate {rotation} deg
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 dark:bg-white/10">
            {status === "loading" || status === "rendering" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
            <span>
              {status === "loading"
                ? "Booting worker"
                : status === "rendering"
                  ? `Painting pages at ${formatScale(deferredScale)}`
                  : status === "error"
                    ? "Render failed"
                    : "Viewer ready"}
            </span>
          </div>
          <span>Text selection enabled.</span>
          <span>Links and form widgets come from the annotation layer.</span>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/80 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(255,255,255,0.18))] p-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]">
        <div className="rounded-[28px] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(255,255,255,0.42))] p-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
          <div className="libpdf-demo-viewer overflow-auto rounded-[24px] border border-black/5 bg-[#ddd7ca] p-4 dark:border-white/10 dark:bg-[#151515]">
            <div
              ref={viewerRef}
              className="pdfViewer mx-auto flex min-h-[22rem] flex-col gap-6"
              aria-live="polite"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
