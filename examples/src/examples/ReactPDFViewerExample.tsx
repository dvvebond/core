import {
  ReactPDFViewer,
  PageNavigation,
  ZoomControls,
  type ReactPDFViewerRef,
} from "@dvvebond/core/react";
import { useRef, useState, useCallback } from "react";

import { CodeDisplay } from "../utils/code-display";
import { MetricsPanel, usePerformanceMetrics } from "../utils/metrics";

export function ReactPDFViewerExample() {
  const viewerRef = useRef<ReactPDFViewerRef>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { metrics, recordPageLoad, startRenderTimer, endRenderTimer } = usePerformanceMetrics();

  const handleDocumentLoad = useCallback(
    (pdf: unknown) => {
      const loadStart = performance.now();
      const pdfDoc = pdf as { getPageCount: () => number };
      setPageCount(pdfDoc.getPageCount());
      setIsLoaded(true);
      setLoadError(null);
      recordPageLoad(performance.now() - loadStart);
    },
    [recordPageLoad],
  );

  const handleDocumentError = useCallback((error: Error) => {
    setLoadError(error.message);
    setIsLoaded(false);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleScaleChange = useCallback((newScale: number) => {
    setScale(newScale);
  }, []);

  const metricsData = [
    { label: "Current Page", value: currentPage, unit: `/ ${pageCount}` },
    { label: "Zoom Level", value: `${Math.round(scale * 100)}%` },
    { label: "Frame Rate", value: metrics.frameRate, unit: "fps" },
    { label: "Render Time", value: metrics.renderTime, unit: "ms" },
    ...(metrics.memoryUsage ? [{ label: "Memory", value: metrics.memoryUsage, unit: "MB" }] : []),
  ];

  const basicUsageCode = `import { ReactPDFViewer } from "@dvvebond/core/react";

function MyViewer() {
  return (
    <ReactPDFViewer
      url="/path/to/document.pdf"
      initialScale={1}
      onDocumentLoad={(pdf) => console.log("Loaded!")}
      onPageChange={(page) => console.log("Page:", page)}
    />
  );
}`;

  const withRefCode = `import { useRef } from "react";
import { ReactPDFViewer, type ReactPDFViewerRef } from "@dvvebond/core/react";

function MyViewer() {
  const viewerRef = useRef<ReactPDFViewerRef>(null);

  const handleZoomIn = () => viewerRef.current?.zoomIn();
  const handleZoomOut = () => viewerRef.current?.zoomOut();
  const handleNextPage = () => viewerRef.current?.nextPage();
  const handlePrevPage = () => viewerRef.current?.previousPage();
  const handleGoToPage = (n: number) => viewerRef.current?.goToPage(n);

  return (
    <>
      <div className="controls">
        <button onClick={handlePrevPage}>Previous</button>
        <button onClick={handleNextPage}>Next</button>
        <button onClick={handleZoomOut}>Zoom Out</button>
        <button onClick={handleZoomIn}>Zoom In</button>
      </div>
      <ReactPDFViewer ref={viewerRef} url="/document.pdf" />
    </>
  );
}`;

  const propsCode = `interface ReactPDFViewerProps {
  // Document source (one required)
  document?: PDF;           // Pre-loaded PDF instance
  data?: Uint8Array;        // Raw PDF bytes
  url?: string;             // URL to fetch PDF from

  // Rendering options
  renderer?: "canvas" | "svg";  // Default: "canvas"
  initialScale?: number;        // Default: 1
  initialPage?: number;         // Default: 1
  initialRotation?: number;     // Default: 0 (0, 90, 180, 270)

  // Scroll and layout
  scrollMode?: "vertical" | "horizontal" | "wrapped";
  spreadMode?: "none" | "odd" | "even";

  // Layer controls
  enableTextLayer?: boolean;       // Default: true
  enableAnnotationLayer?: boolean; // Default: true

  // Performance
  maxConcurrentRenders?: number;   // Default: 4
  cacheSize?: number;              // Default: 10

  // Event handlers
  onDocumentLoad?: (pdf: PDF) => void;
  onDocumentError?: (error: Error) => void;
  onPageChange?: (pageNumber: number) => void;
  onScaleChange?: (scale: number) => void;
  onPageRender?: (pageIndex: number, result: RenderResult) => void;
  onPageError?: (pageIndex: number, error: Error) => void;

  // Styling
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}`;

  return (
    <>
      <div className="page-header">
        <h2>ReactPDFViewer</h2>
        <p>
          A complete PDF viewing solution with React integration. Includes page rendering,
          navigation, zoom controls, and bounding box visualization support.
        </p>
      </div>

      <div className="page-content">
        {/* Live Metrics */}
        <MetricsPanel metrics={metricsData} />

        {/* Controls */}
        <div className="card">
          <div className="card-header">
            <h3>Controls</h3>
            <div className="btn-group">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => viewerRef.current?.rotateClockwise()}
              >
                Rotate CW
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => viewerRef.current?.rotateCounterClockwise()}
              >
                Rotate CCW
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => viewerRef.current?.refresh()}
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="controls-bar">
              <PageNavigation
                currentPage={currentPage}
                pageCount={pageCount}
                onPageChange={page => viewerRef.current?.goToPage(page)}
              />
              <div className="separator" />
              <ZoomControls
                scale={scale}
                minScale={0.25}
                maxScale={4}
                onScaleChange={s => viewerRef.current?.setScale(s)}
              />
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="card">
          <div className="card-header">
            <h3>PDF Viewer</h3>
            {isLoaded ? (
              <span className="badge badge-success">Loaded</span>
            ) : loadError ? (
              <span className="badge badge-error">Error</span>
            ) : (
              <span className="badge badge-info">Loading...</span>
            )}
          </div>
          <div className="card-body">
            {loadError && (
              <div className="info-box warning">
                <p>{loadError}</p>
              </div>
            )}
            <div className="pdf-viewer-container large">
              <ReactPDFViewer
                ref={viewerRef}
                url="/assets/sample.pdf"
                initialScale={1}
                onDocumentLoad={handleDocumentLoad}
                onDocumentError={handleDocumentError}
                onPageChange={handlePageChange}
                onScaleChange={handleScaleChange}
              />
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>Basic Usage</h3>
          </div>
          <div className="card-body">
            <CodeDisplay code={basicUsageCode} filename="BasicViewer.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>With Imperative Ref</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Use a ref to access imperative methods for programmatic control of the viewer.
            </p>
            <CodeDisplay code={withRefCode} filename="ViewerWithRef.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Props Reference</h3>
          </div>
          <div className="card-body">
            <CodeDisplay code={propsCode} language="typescript" filename="types.ts" />
          </div>
        </div>

        {/* Features */}
        <div className="card">
          <div className="card-header">
            <h3>Features</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Canvas Rendering</td>
                  <td>High-performance canvas-based page rendering</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>SVG Rendering</td>
                  <td>Vector-based rendering for crisp scaling</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Text Layer</td>
                  <td>Selectable text overlay for copy/paste</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Annotation Layer</td>
                  <td>Interactive links and form fields</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Page Navigation</td>
                  <td>Go to specific pages, next/previous</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Zoom Controls</td>
                  <td>Scale in/out with configurable limits</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Rotation</td>
                  <td>Rotate pages 90/180/270 degrees</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Bounding Box Overlay</td>
                  <td>Visualize character/word/line/paragraph boxes</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
                <tr>
                  <td>Search</td>
                  <td>Find text with highlighting</td>
                  <td>
                    <span className="badge badge-success">Available</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
