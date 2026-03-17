import { useState, useRef, useCallback, useEffect } from "react";

import { CodeDisplay } from "../utils/code-display";
import { MetricsPanel } from "../utils/metrics";

interface ViewportState {
  scale: number;
  rotation: number;
  scrollTop: number;
  scrollLeft: number;
  currentPage: number;
  visiblePages: number[];
  containerWidth: number;
  containerHeight: number;
}

export function ViewportExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    rotation: 0,
    scrollTop: 0,
    scrollLeft: 0,
    currentPage: 1,
    visiblePages: [1],
    containerWidth: 0,
    containerHeight: 0,
  });

  const totalPages = 5;
  const pageHeight = 200;
  const pageGap = 20;

  // Update container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateDimensions = () => {
      setViewport(prev => ({
        ...prev,
        containerWidth: container.clientWidth,
        containerHeight: container.clientHeight,
      }));
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate visible pages based on scroll position
  const calculateVisiblePages = useCallback(
    (scrollTop: number) => {
      const visible: number[] = [];
      const effectivePageHeight = pageHeight * viewport.scale + pageGap;
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + viewport.containerHeight;

      for (let i = 1; i <= totalPages; i++) {
        const pageTop = (i - 1) * effectivePageHeight;
        const pageBottom = pageTop + effectivePageHeight;

        if (pageBottom > viewportTop && pageTop < viewportBottom) {
          visible.push(i);
        }
      }

      return visible;
    },
    [viewport.scale, viewport.containerHeight],
  );

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    const visiblePages = calculateVisiblePages(scrollTop);
    const currentPage = visiblePages[0] || 1;

    setViewport(prev => ({
      ...prev,
      scrollTop,
      scrollLeft,
      visiblePages,
      currentPage,
    }));
  };

  // Control functions
  const setScale = (scale: number) => {
    setViewport(prev => ({ ...prev, scale: Math.max(0.25, Math.min(4, scale)) }));
  };

  const setRotation = (rotation: number) => {
    setViewport(prev => ({ ...prev, rotation: ((rotation % 360) + 360) % 360 }));
  };

  const goToPage = (page: number) => {
    const effectivePageHeight = pageHeight * viewport.scale + pageGap;
    const scrollTop = (page - 1) * effectivePageHeight;
    containerRef.current?.scrollTo({ top: scrollTop, behavior: "smooth" });
  };

  const metricsData = [
    { label: "Scale", value: `${Math.round(viewport.scale * 100)}%` },
    { label: "Rotation", value: `${viewport.rotation}°` },
    { label: "Current Page", value: viewport.currentPage, unit: `/ ${totalPages}` },
    { label: "Visible Pages", value: viewport.visiblePages.join(", ") },
    { label: "Scroll Position", value: `${Math.round(viewport.scrollTop)}px` },
  ];

  const viewportManagerCode = `import {
  ViewportManager,
  createViewportManager,
  type ViewportManagerEvent,
  type ManagedPage,
} from "@dvvebond/core";

// Create viewport manager for a PDF
const viewportManager = createViewportManager({
  pageSource: {
    getPageCount: () => pdf.getPageCount(),
    getPageDimensions: (pageIndex) => {
      const page = pdf.getPage(pageIndex);
      return { width: page.width, height: page.height };
    },
  },
  containerElement: document.getElementById("pdf-container")!,
  initialScale: 1,
  initialRotation: 0,
  renderBuffer: 2,        // Pre-render pages before/after visible
  unloadBuffer: 5,        // Unload pages when far from visible
  scrollMode: "vertical", // or "horizontal"
  spreadMode: "none",     // or "odd", "even"
});

// Listen for events
viewportManager.addEventListener("pagechange", (event) => {
  console.log(\`Current page: \${event.currentPage}\`);
});

viewportManager.addEventListener("visiblechange", (event) => {
  console.log(\`Visible pages: \${event.visiblePages.join(", ")}\`);
});

viewportManager.addEventListener("scalechange", (event) => {
  console.log(\`Scale: \${event.scale}\`);
});

// Control the viewport
viewportManager.setScale(1.5);
viewportManager.setRotation(90);
viewportManager.goToPage(5);
viewportManager.scrollToPosition({ x: 100, y: 200 });

// Get current state
const state = viewportManager.getState();
console.log({
  currentPage: state.currentPage,
  visiblePages: state.visiblePages,
  scale: state.scale,
  rotation: state.rotation,
  scrollPosition: state.scrollPosition,
});

// Cleanup
viewportManager.destroy();`;

  const virtualScrollerCode = `import {
  VirtualScroller,
  createVirtualScroller,
  type VisibleRange,
  type PageLayout,
} from "@dvvebond/core";

// Create virtual scroller for efficient page rendering
const scroller = createVirtualScroller({
  container: document.getElementById("pdf-container")!,
  itemCount: pdf.getPageCount(),
  estimatedItemSize: 800, // Estimated page height in pixels
  getItemSize: (index) => {
    // Return actual page height (considering scale)
    const page = pdf.getPage(index);
    return page.height * scale;
  },
  overscan: 2, // Extra pages to render above/below
});

// Listen for visible range changes
scroller.addEventListener("visiblechange", (event) => {
  const { startIndex, endIndex } = event.visibleRange;

  // Render pages in visible range
  for (let i = startIndex; i <= endIndex; i++) {
    renderPage(i);
  }

  // Unload pages outside buffer
  const bufferStart = Math.max(0, startIndex - 5);
  const bufferEnd = Math.min(pdf.getPageCount() - 1, endIndex + 5);

  for (let i = 0; i < pdf.getPageCount(); i++) {
    if (i < bufferStart || i > bufferEnd) {
      unloadPage(i);
    }
  }
});

// Get layout information
const layout = scroller.getLayout();
console.log({
  totalHeight: layout.totalHeight,
  visibleRange: layout.visibleRange,
  itemPositions: layout.itemPositions,
});

// Scroll to specific page
scroller.scrollToItem(5, { align: "start" }); // or "center", "end"`;

  const useViewportHookCode = `import { useViewport, useScrollPosition } from "@dvvebond/core/react";
import { useRef, useEffect, useState } from "react";

function PDFViewport({ pdf }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track viewport dimensions
  const dimensions = useViewport(containerRef);

  // Track scroll position
  const scrollPosition = useScrollPosition(containerRef);

  // Calculate visible pages
  const [visiblePages, setVisiblePages] = useState<number[]>([]);

  useEffect(() => {
    const pageHeight = 800; // Scaled page height
    const gap = 20;

    const visible: number[] = [];
    const viewportTop = scrollPosition.scrollTop;
    const viewportBottom = viewportTop + dimensions.height;

    for (let i = 0; i < pdf.getPageCount(); i++) {
      const pageTop = i * (pageHeight + gap);
      const pageBottom = pageTop + pageHeight;

      if (pageBottom > viewportTop && pageTop < viewportBottom) {
        visible.push(i);
      }
    }

    setVisiblePages(visible);
  }, [scrollPosition.scrollTop, dimensions.height, pdf]);

  return (
    <div ref={containerRef} style={{ overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {Array.from({ length: pdf.getPageCount() }, (_, i) => (
          <PageRenderer
            key={i}
            pageIndex={i}
            isVisible={visiblePages.includes(i)}
          />
        ))}
      </div>
    </div>
  );
}

// Only render visible pages
function PageRenderer({ pageIndex, isVisible }) {
  if (!isVisible) {
    // Return placeholder with correct dimensions
    return <div style={{ height: 800, backgroundColor: "#f0f0f0" }} />;
  }

  return <ActualPageComponent pageIndex={pageIndex} />;
}`;

  const fitModesCode = `import { createViewportManager, type ZoomFitMode } from "@dvvebond/core";

// Fit modes for automatic scaling
type ZoomFitMode = "page-width" | "page-height" | "page-fit" | "actual-size";

const viewportManager = createViewportManager({ /* options */ });

// Fit to page width (most common)
viewportManager.setFitMode("page-width");
// Calculates scale so page width matches container width

// Fit to page height
viewportManager.setFitMode("page-height");
// Calculates scale so page height matches container height

// Fit entire page in view
viewportManager.setFitMode("page-fit");
// Shows entire page, may have margins on sides or top/bottom

// Actual size (100%)
viewportManager.setFitMode("actual-size");
// Sets scale to 1.0 (72 pixels per inch)

// Calculate fit scale manually
function calculateFitScale(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
  mode: ZoomFitMode
): number {
  switch (mode) {
    case "page-width":
      return containerWidth / pageWidth;
    case "page-height":
      return containerHeight / pageHeight;
    case "page-fit":
      return Math.min(
        containerWidth / pageWidth,
        containerHeight / pageHeight
      );
    case "actual-size":
      return 1;
  }
}`;

  return (
    <>
      <div className="page-header">
        <h2>Viewport Management</h2>
        <p>
          Manage zoom, pan, rotation, and page visibility with efficient virtual scrolling for large
          documents.
        </p>
      </div>

      <div className="page-content">
        {/* Metrics */}
        <MetricsPanel metrics={metricsData} />

        {/* Interactive Demo */}
        <div className="card">
          <div className="card-header">
            <h3>Viewport Controls</h3>
          </div>
          <div className="card-body">
            {/* Controls */}
            <div className="controls-bar">
              {/* Zoom */}
              <div className="btn-group">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScale(viewport.scale / 1.25)}
                >
                  -
                </button>
                <span style={{ minWidth: 60, textAlign: "center" }}>
                  {Math.round(viewport.scale * 100)}%
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScale(viewport.scale * 1.25)}
                >
                  +
                </button>
              </div>

              <div className="separator" />

              {/* Rotation */}
              <div className="btn-group">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRotation(viewport.rotation - 90)}
                >
                  ↺
                </button>
                <span style={{ minWidth: 40, textAlign: "center" }}>{viewport.rotation}°</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRotation(viewport.rotation + 90)}
                >
                  ↻
                </button>
              </div>

              <div className="separator" />

              {/* Page Navigation */}
              <div className="btn-group">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => goToPage(viewport.currentPage - 1)}
                  disabled={viewport.currentPage <= 1}
                >
                  Prev
                </button>
                <span style={{ minWidth: 80, textAlign: "center" }}>
                  Page {viewport.currentPage} / {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => goToPage(viewport.currentPage + 1)}
                  disabled={viewport.currentPage >= totalPages}
                >
                  Next
                </button>
              </div>

              <div className="separator" />

              {/* Fit modes */}
              <div className="btn-group">
                <button className="btn btn-secondary btn-sm" onClick={() => setScale(1)}>
                  100%
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScale(viewport.containerWidth / 500)}
                >
                  Fit Width
                </button>
              </div>
            </div>

            {/* Scrollable Container */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              style={{
                height: 400,
                overflow: "auto",
                backgroundColor: "#525659",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: 20,
                  gap: pageGap,
                }}
              >
                {Array.from({ length: totalPages }, (_, i) => {
                  const isVisible = viewport.visiblePages.includes(i + 1);
                  return (
                    <div
                      key={i}
                      style={{
                        width: 500 * viewport.scale,
                        height: pageHeight * viewport.scale,
                        backgroundColor: "#fff",
                        borderRadius: 4,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: `rotate(${viewport.rotation}deg)`,
                        border: isVisible ? "2px solid #3b82f6" : "none",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <span style={{ fontSize: 24, color: "#666" }}>Page {i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Minimap */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                Page Visibility
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <div
                    key={i}
                    onClick={() => goToPage(i + 1)}
                    style={{
                      width: 40,
                      height: 50,
                      backgroundColor: viewport.visiblePages.includes(i + 1)
                        ? "var(--primary-color)"
                        : "var(--bg-card)",
                      border:
                        viewport.currentPage === i + 1
                          ? "2px solid var(--primary-color)"
                          : "1px solid var(--border-color)",
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      color: viewport.visiblePages.includes(i + 1)
                        ? "#fff"
                        : "var(--text-secondary)",
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>ViewportManager</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              The <code>ViewportManager</code> class handles page layout, visibility tracking, and
              viewport state management.
            </p>
            <CodeDisplay code={viewportManagerCode} filename="viewportManager.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>VirtualScroller</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Efficient virtual scrolling for large documents. Only renders pages that are currently
              visible.
            </p>
            <CodeDisplay code={virtualScrollerCode} filename="virtualScroller.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>React Hooks</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Use <code>useViewport</code> and <code>useScrollPosition</code> hooks for React
              integration.
            </p>
            <CodeDisplay code={useViewportHookCode} filename="PDFViewport.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Fit Modes</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Automatic scale calculation for different fit modes.
            </p>
            <CodeDisplay code={fitModesCode} filename="fitModes.ts" />
          </div>
        </div>

        {/* Scroll Modes Reference */}
        <div className="card">
          <div className="card-header">
            <h3>Scroll & Spread Modes</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>vertical</code>
                  </td>
                  <td>Scroll</td>
                  <td>Pages stacked vertically (default)</td>
                </tr>
                <tr>
                  <td>
                    <code>horizontal</code>
                  </td>
                  <td>Scroll</td>
                  <td>Pages arranged horizontally</td>
                </tr>
                <tr>
                  <td>
                    <code>wrapped</code>
                  </td>
                  <td>Scroll</td>
                  <td>Pages wrap to fit container width</td>
                </tr>
                <tr>
                  <td>
                    <code>none</code>
                  </td>
                  <td>Spread</td>
                  <td>Single page view</td>
                </tr>
                <tr>
                  <td>
                    <code>odd</code>
                  </td>
                  <td>Spread</td>
                  <td>Two-page spread, odd pages on right</td>
                </tr>
                <tr>
                  <td>
                    <code>even</code>
                  </td>
                  <td>Spread</td>
                  <td>Two-page spread, even pages on right</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
