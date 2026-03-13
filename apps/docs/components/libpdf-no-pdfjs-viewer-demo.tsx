"use client";

import { renderViewerPageToCanvas } from "@/lib/no-pdfjs-renderer";
import type {
  ViewerAnnotation,
  ViewerDocument,
  ViewerPage,
  ViewerRect,
  ViewerSpan,
} from "@/lib/no-pdfjs-viewer-types";
import {
  Boxes,
  FileUp,
  Highlighter,
  Link2,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Sparkles,
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

const SAMPLE_URL = "/viewer/sample.pdf";
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.2;

type DemoStatus = "idle" | "loading" | "ready" | "error";

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function formatZoom(zoom: number) {
  return `${Math.round(zoom * 100)}%`;
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function spanMatches(span: ViewerSpan, query: string) {
  if (!query) {
    return false;
  }

  return span.text.toLowerCase().includes(query);
}

function getBaseDimensions(page: ViewerPage) {
  if (page.rotation === 90 || page.rotation === 270) {
    return {
      width: page.height,
      height: page.width,
    };
  }

  return {
    width: page.width,
    height: page.height,
  };
}

function transformRect(page: ViewerPage, rect: ViewerRect, zoom: number) {
  const base = getBaseDimensions(page);

  let left = rect.x;
  let top = base.height - rect.y - rect.height;
  let width = rect.width;
  let height = rect.height;

  if (page.rotation === 90) {
    left = rect.y;
    top = rect.x;
    width = rect.height;
    height = rect.width;
  } else if (page.rotation === 180) {
    left = base.width - rect.x - rect.width;
    top = rect.y;
  } else if (page.rotation === 270) {
    left = base.height - rect.y - rect.height;
    top = base.width - rect.x - rect.width;
    width = rect.height;
    height = rect.width;
  }

  return {
    left: left * zoom,
    top: top * zoom,
    width: Math.max(width * zoom, 1),
    height: Math.max(height * zoom, 1),
  };
}

function resolveFontStyle(fontName: string) {
  const normalized = fontName.toLowerCase();

  let fontFamily = "var(--font-sans)";

  if (normalized.includes("courier") || normalized.includes("mono")) {
    fontFamily = "var(--font-mono)";
  } else if (normalized.includes("times") || normalized.includes("serif")) {
    fontFamily = "var(--font-serif)";
  }

  return {
    fontFamily,
    fontStyle:
      normalized.includes("italic") || normalized.includes("oblique") ? "italic" : "normal",
    fontWeight: normalized.includes("bold") ? 700 : 400,
  };
}

function countMatches(page: ViewerPage, query: string) {
  if (!query) {
    return 0;
  }

  let total = 0;

  for (const line of page.lines) {
    for (const span of line.spans) {
      if (spanMatches(span, query)) {
        total += 1;
      }
    }
  }

  return total;
}

async function parseDocument(blob: Blob, label: string): Promise<ViewerDocument> {
  const formData = new FormData();
  formData.append("file", new File([blob], label, { type: "application/pdf" }));

  const response = await fetch("/api/viewer/libpdf", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to load PDF.");
  }

  return payload as ViewerDocument;
}

function AnnotationOverlay({
  page,
  annotation,
  zoom,
}: {
  page: ViewerPage;
  annotation: ViewerAnnotation;
  zoom: number;
}) {
  const rect = transformRect(page, annotation.rect, zoom);

  if (annotation.uri) {
    return (
      <a
        href={annotation.uri}
        target="_blank"
        rel="noreferrer"
        title={annotation.uri}
        className="absolute rounded-[10px] border border-sky-400/70 bg-sky-300/10 transition hover:bg-sky-300/20"
        style={rect}
      >
        <span className="absolute -top-6 left-0 inline-flex items-center gap-1 rounded-full bg-sky-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white shadow-sm">
          <Link2 className="h-3 w-3" />
          Link
        </span>
      </a>
    );
  }

  return (
    <div
      className="absolute rounded-[10px] border border-amber-500/60 bg-amber-300/10"
      style={rect}
      title={annotation.contents ?? annotation.type}
    >
      <span className="absolute -top-6 left-0 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white shadow-sm">
        {annotation.type}
      </span>
    </div>
  );
}

export function LibPDFNoPdfJsViewerDemo() {
  const fileInputId = useId();
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});

  const [documentData, setDocumentData] = useState<ViewerDocument | null>(null);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.1);
  const [query, setQuery] = useState("");
  const [showBoxes, setShowBoxes] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);

  const deferredQuery = useDeferredValue(normalizeQuery(query));

  useEffect(() => {
    let cancelled = false;

    async function loadSample() {
      setStatus("loading");
      setError(null);

      try {
        const response = await fetch(SAMPLE_URL);

        if (!response.ok) {
          throw new Error("Unable to fetch the bundled sample PDF.");
        }

        const blob = await response.blob();
        const nextDocument = await parseDocument(blob, "sample.pdf");

        if (!cancelled) {
          setDocumentData(nextDocument);
          setStatus("ready");
        }
      } catch (currentError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setError(
          currentError instanceof Error ? currentError.message : "Failed to load the sample.",
        );
      }
    }

    void loadSample();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const nextDocument = await parseDocument(file, file.name);

      startTransition(() => {
        setDocumentData(nextDocument);
        setQuery("");
        setStatus("ready");
      });
    } catch (currentError) {
      setStatus("error");
      setError(
        currentError instanceof Error ? currentError.message : "Failed to parse the uploaded PDF.",
      );
    } finally {
      event.target.value = "";
    }
  }

  const pages = documentData?.pages ?? [];
  const pageMatches = pages.map(page => countMatches(page, deferredQuery));
  const totalMatches = pageMatches.reduce((sum, current) => sum + current, 0);
  const firstMatchPage = pageMatches.findIndex(count => count > 0);
  const totalRenderWarnings = pages.reduce((sum, page) => sum + page.renderPlan.warnings.length, 0);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    let cancelled = false;

    async function renderPages() {
      for (const page of pages) {
        const canvas = canvasRefs.current[page.pageIndex];

        if (!canvas || cancelled) {
          continue;
        }

        await renderViewerPageToCanvas(canvas, page, zoom);
      }
    }

    void renderPages().catch(currentError => {
      if (!cancelled) {
        console.error("Failed to render LibPDF page plan", currentError);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pages, status, zoom]);

  function scrollToPage(pageIndex: number) {
    const pageElement = pageRefs.current[pageIndex];

    if (!pageElement) {
      return;
    }

    pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="not-prose my-10 overflow-hidden rounded-[34px] border border-black/10 bg-[radial-gradient(circle_at_top_left,#f4dfba,transparent_26%),radial-gradient(circle_at_bottom_right,#d3e6ff,transparent_24%),linear-gradient(180deg,#f7f3ea_0%,#e9e1d1_100%)] shadow-[0_30px_120px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,#48331d,transparent_24%),radial-gradient(circle_at_bottom_right,#0f2944,transparent_20%),linear-gradient(180deg,#111111_0%,#0b0b0b_100%)]">
      <div className="border-b border-black/5 bg-white/70 px-6 py-6 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              No pdf.js anywhere in this path
            </div>
            <h3 className="mt-4 font-serif text-3xl tracking-tight text-foreground">
              A standalone LibPDF-only viewer with a native canvas render plan
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              This version does not import `pdf.js`, its worker, or its viewer layer. The server
              parses the PDF with LibPDF, returns a LibPDF-native render plan plus text geometry,
              and the browser paints canvas pages with searchable text and annotation overlays.
            </p>
          </div>

          <div className="grid gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>Engine</div>
              <div className="mt-2 text-base font-semibold tracking-normal text-foreground">
                LibPDF
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>Renderer</div>
              <div className="mt-2 text-base font-semibold tracking-normal text-foreground">
                Canvas + HTML text
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>Scope</div>
              <div className="mt-2 text-base font-semibold tracking-normal text-foreground">
                paths, images, text
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

            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search extracted text"
                className="w-48 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowBoxes(current => !current)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                showBoxes
                  ? "border-violet-400 bg-violet-500 text-white"
                  : "border-black/10 bg-white/80 text-foreground hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              }`}
            >
              <Boxes className="h-4 w-4" />
              Guides
            </button>

            <button
              type="button"
              onClick={() => setShowAnnotations(current => !current)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                showAnnotations
                  ? "border-sky-400 bg-sky-500 text-white"
                  : "border-black/10 bg-white/80 text-foreground hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              }`}
            >
              <Link2 className="h-4 w-4" />
              Annotations
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-black/10 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setZoom(current => clampZoom(current - ZOOM_STEP))}
                className="rounded-full p-2 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-16 px-2 text-center text-sm font-medium text-foreground">
                {formatZoom(zoom)}
              </span>
              <button
                type="button"
                onClick={() => setZoom(current => clampZoom(current + ZOOM_STEP))}
                className="rounded-full p-2 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {firstMatchPage >= 0 ? (
              <button
                type="button"
                onClick={() => scrollToPage(firstMatchPage)}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Highlighter className="h-4 w-4" />
                Jump to match
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 dark:bg-white/10">
            {status === "loading" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
            <span>
              {status === "loading"
                ? "Parsing with LibPDF"
                : status === "error"
                  ? "Parse failed"
                  : "Viewer ready"}
            </span>
          </div>
          <span>
            {documentData ? `${documentData.pageCount} pages loaded` : "Loading sample PDF"}
          </span>
          <span>
            {deferredQuery
              ? `${totalMatches} span matches`
              : "Search highlights the extracted text overlay"}
          </span>
          <span>
            {totalRenderWarnings > 0
              ? `${totalRenderWarnings} render warnings`
              : "No render warnings in this document"}
          </span>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/80 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.6))] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
          <div className="rounded-[22px] border border-black/5 bg-black px-4 py-4 text-white dark:border-white/10">
            <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Current source</p>
            <p className="mt-2 text-lg font-semibold">
              {documentData?.sourceLabel ?? "sample.pdf"}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {documentData?.title ?? "Untitled document"}
              {documentData?.author ? ` by ${documentData.author}` : ""}
            </p>
          </div>

          <div className="mt-4 rounded-[22px] border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
              Metadata
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="font-medium text-foreground">{documentData?.subject ?? "None"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Creator</dt>
                <dd className="font-medium text-foreground">
                  {documentData?.creator ?? "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Producer</dt>
                <dd className="font-medium text-foreground">
                  {documentData?.producer ?? "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Keywords</dt>
                <dd className="font-medium text-foreground">
                  {documentData?.keywords?.length ? documentData.keywords.join(", ") : "None"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 rounded-[22px] border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
              Page navigator
            </p>
            <div className="mt-4 space-y-2">
              {pages.map((page, index) => (
                <button
                  key={page.pageIndex}
                  type="button"
                  onClick={() => scrollToPage(index)}
                  className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white/80 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <span>
                    <span className="block text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Page {index + 1}
                    </span>
                    <span className="mt-1 block text-sm font-medium text-foreground">
                      {Math.round(page.width)} x {Math.round(page.height)} pt
                    </span>
                  </span>
                  <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold text-foreground dark:bg-white/10">
                    {pageMatches[index] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-amber-300/70 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            This viewer now composites a LibPDF-native canvas render plan with searchable text and
            annotation overlays. If a document hits unsupported operators, the warning count above
            reflects the exact gaps from the current renderer instead of hiding them behind a
            blanket limitation.
          </div>
        </aside>

        <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.28))] p-3 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
          <div className="libpdf-html-viewer h-[min(80vh,1200px)] overflow-auto rounded-[24px] border border-black/5 bg-[#d4ccbf] p-4 dark:border-white/10 dark:bg-[#121212]">
            <div className="mx-auto flex flex-col gap-8">
              {pages.map(page => {
                const pageWidth = page.width * zoom;
                const pageHeight = page.height * zoom;
                const pageMatchCount = countMatches(page, deferredQuery);
                const pageWarningCount = page.renderPlan.warnings.length;

                return (
                  <section
                    key={page.pageIndex}
                    ref={node => {
                      pageRefs.current[page.pageIndex] = node;
                    }}
                    className="rounded-[32px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.88))] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))]"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      <span>Page {page.pageIndex + 1}</span>
                      <span>{pageMatchCount} matches</span>
                      <span>{pageWarningCount} warnings</span>
                      <span>{page.rotation} deg rotation</span>
                    </div>

                    <div
                      className="relative mx-auto overflow-hidden rounded-[22px] border border-black/10 bg-[#fffdfa] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-white/10 dark:bg-[#f7f3ea]"
                      style={{ width: pageWidth, height: pageHeight }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(transparent_31px,rgba(80,65,40,0.04)_32px)] bg-[size:100%_32px] opacity-20" />

                      <canvas
                        ref={node => {
                          canvasRefs.current[page.pageIndex] = node;
                        }}
                        className="absolute inset-0 h-full w-full"
                      />

                      {page.lines.length === 0 && page.renderPlan.commands.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                          This page has no extractable text and no paint commands were emitted by
                          the current LibPDF renderer.
                        </div>
                      ) : null}

                      {page.lines.flatMap((line, lineIndex) =>
                        line.spans.map((span, spanIndex) => {
                          if (!span.text) {
                            return null;
                          }

                          const rect = transformRect(page, span.bbox, zoom);
                          const fontStyle = resolveFontStyle(span.fontName);
                          const isMatch = spanMatches(span, deferredQuery);

                          return (
                            <span
                              key={`${page.pageIndex}-${lineIndex}-${spanIndex}`}
                              className={`absolute whitespace-pre text-[rgb(28,25,23)] selection:bg-emerald-200 ${
                                isMatch ? "rounded-sm bg-emerald-200/80" : ""
                              }`}
                              style={{
                                left: rect.left,
                                top: rect.top,
                                width: rect.width,
                                minHeight: rect.height,
                                fontSize: Math.max(span.fontSize * zoom, 9),
                                lineHeight: 1,
                                ...fontStyle,
                              }}
                              title={`${span.fontName} ${span.fontSize.toFixed(1)}pt`}
                            >
                              {span.text}
                            </span>
                          );
                        }),
                      )}

                      {showBoxes
                        ? page.lines.flatMap((line, lineIndex) =>
                            line.spans.map((span, spanIndex) => {
                              const rect = transformRect(page, span.bbox, zoom);

                              return (
                                <div
                                  key={`box-${page.pageIndex}-${lineIndex}-${spanIndex}`}
                                  className="absolute rounded-[4px] border border-fuchsia-500/40 bg-fuchsia-300/10"
                                  style={rect}
                                />
                              );
                            }),
                          )
                        : null}

                      {showAnnotations
                        ? page.annotations.map((annotation, annotationIndex) => (
                            <AnnotationOverlay
                              key={`annot-${page.pageIndex}-${annotationIndex}`}
                              page={page}
                              annotation={annotation}
                              zoom={zoom}
                            />
                          ))
                        : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
