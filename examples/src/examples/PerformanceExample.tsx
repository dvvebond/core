import { useState, useCallback, useRef, useEffect } from "react";

import { CodeDisplay } from "../utils/code-display";
import { MetricsPanel, TimingDisplay, usePerformanceMetrics } from "../utils/metrics";

interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  avgDuration: number;
}

export function PerformanceExample() {
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const { metrics } = usePerformanceMetrics();

  // Simulated benchmark functions
  const runBenchmark = useCallback(async (name: string, iterations: number, fn: () => void) => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const duration = performance.now() - start;
    return {
      name,
      duration,
      iterations,
      avgDuration: duration / iterations,
    };
  }, []);

  const runAllBenchmarks = useCallback(async () => {
    setIsRunning(true);
    setBenchmarkResults([]);

    const results: BenchmarkResult[] = [];

    // Simulated benchmarks
    results.push(
      await runBenchmark("Coordinate Transform", 10000, () => {
        // Simulate coordinate transformation
        const x = Math.random() * 612;
        const y = Math.random() * 792;
        const scale = 1.5;
        const _screenX = x * scale;
        const _screenY = (792 - y) * scale;
      }),
    );

    results.push(
      await runBenchmark("Bounding Box Hit Test", 1000, () => {
        // Simulate hit testing
        const boxes = Array.from({ length: 100 }, () => ({
          x: Math.random() * 612,
          y: Math.random() * 792,
          width: 50,
          height: 12,
        }));
        const point = { x: 300, y: 400 };
        boxes.filter(
          box =>
            point.x >= box.x &&
            point.x <= box.x + box.width &&
            point.y >= box.y &&
            point.y <= box.y + box.height,
        );
      }),
    );

    results.push(
      await runBenchmark("Text Search (1000 chars)", 100, () => {
        const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20);
        const pattern = /ipsum/gi;
        const matches: RegExpExecArray[] = [];
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          matches.push(match);
        }
      }),
    );

    results.push(
      await runBenchmark("Box Grouping (100 boxes)", 100, () => {
        const chars = Array.from({ length: 100 }, (_, i) => ({
          x: 72 + (i % 50) * 10,
          y: 720 - Math.floor(i / 50) * 14,
          width: 8,
          height: 12,
          text: String.fromCharCode(65 + (i % 26)),
        }));
        // Group into words (gaps > 5px)
        const _words: (typeof chars)[] = [];
        let currentWord: typeof chars = [];
        for (const char of chars) {
          if (
            currentWord.length === 0 ||
            char.x - (currentWord[currentWord.length - 1]?.x ?? 0) < 15
          ) {
            currentWord.push(char);
          } else {
            _words.push(currentWord);
            currentWord = [char];
          }
        }
      }),
    );

    results.push(
      await runBenchmark("Canvas Draw Calls", 500, () => {
        // Simulate canvas operations
        const operations: Array<{ type: string; params: number[] }> = [];
        for (let i = 0; i < 50; i++) {
          operations.push({ type: "rect", params: [i * 10, i * 10, 100, 50] });
          operations.push({ type: "fill", params: [] });
        }
      }),
    );

    setBenchmarkResults(results);
    setIsRunning(false);
  }, [runBenchmark]);

  const totalDuration = benchmarkResults.reduce((sum, r) => sum + r.duration, 0);

  const timingData = benchmarkResults.map(r => ({
    label: r.name,
    duration: r.avgDuration,
  }));

  const metricsData = [
    { label: "Frame Rate", value: metrics.frameRate, unit: "fps" },
    { label: "Total Benchmark Time", value: totalDuration.toFixed(2), unit: "ms" },
    { label: "Tests Completed", value: benchmarkResults.length },
    ...(metrics.memoryUsage
      ? [{ label: "Memory Usage", value: metrics.memoryUsage, unit: "MB" }]
      : []),
  ];

  const performanceOptimizationCode = `// Performance optimization techniques for PDF rendering

// 1. Use RequestIdleCallback for non-critical work
function scheduleWork(work: () => void) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(work, { timeout: 2000 });
  } else {
    setTimeout(work, 0);
  }
}

// 2. Debounce resize handlers
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// 3. Use IntersectionObserver for visibility detection
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const pageIndex = Number(entry.target.dataset.pageIndex);
      if (entry.isIntersecting) {
        renderPage(pageIndex);
      } else {
        unloadPage(pageIndex);
      }
    });
  },
  { rootMargin: "200px" } // Pre-render pages 200px before visible
);

// 4. Use OffscreenCanvas for background rendering
async function renderInBackground(page: PDFPage, scale: number) {
  if ("OffscreenCanvas" in window) {
    const canvas = new OffscreenCanvas(
      page.width * scale,
      page.height * scale
    );
    const ctx = canvas.getContext("2d")!;
    await renderPageToContext(page, ctx, scale);
    return canvas.transferToImageBitmap();
  }
  // Fallback to regular canvas
  return null;
}`;

  const workerRenderingCode = `import {
  createWorkerProxy,
  WorkerProxy,
  type LoadedDocument,
} from "@dvvebond/core";

// Use Web Workers for heavy operations
async function setupWorkerRendering() {
  // Create worker proxy
  const worker = createWorkerProxy({
    workerUrl: "/pdf-worker.js",
    maxConcurrentTasks: 4,
  });

  // Load document in worker
  const doc = await worker.loadDocument("/large-document.pdf", {
    onProgress: (loaded, total) => {
      console.log(\`Loading: \${Math.round(loaded / total * 100)}%\`);
    },
  });

  // Extract text in worker (doesn't block main thread)
  const text = await worker.extractText(doc, {
    startPage: 0,
    endPage: 10,
    onProgress: (pagesProcessed, totalPages) => {
      console.log(\`Extracting: \${pagesProcessed}/\${totalPages}\`);
    },
  });

  // Search in worker
  const results = await worker.search(doc, "search term", {
    caseSensitive: false,
    maxResults: 100,
  });

  return { doc, text, results };
}

// Worker communication protocol
// Main thread sends:
// { type: "load", id: 1, url: "/doc.pdf" }
// { type: "extract-text", id: 2, docId: "doc-123", options: {...} }
// { type: "search", id: 3, docId: "doc-123", query: "..." }

// Worker responds:
// { type: "progress", id: 1, progress: 0.5 }
// { type: "result", id: 1, data: {...} }
// { type: "error", id: 1, error: "..." }`;

  const memoryManagementCode = `import { createViewportManager } from "@dvvebond/core";

// Memory management for large documents
const viewportManager = createViewportManager({
  // ... other options
  cacheSize: 10,        // Keep 10 rendered pages in memory
  unloadBuffer: 5,      // Unload pages 5+ pages away from visible
  lowMemoryMode: false, // Enable for constrained devices
});

// Manual cache control
viewportManager.clearCache();              // Clear all cached pages
viewportManager.clearCache([0, 1, 2]);     // Clear specific pages
viewportManager.preloadPages([5, 6, 7]);   // Pre-render pages

// Memory pressure handling
if ("memory" in performance) {
  const memory = (performance as any).memory;
  if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
    // High memory pressure - clear cache
    viewportManager.clearCache();
    viewportManager.setOption("cacheSize", 3);
  }
}

// Release resources when document is closed
async function closeDocument() {
  viewportManager.clearCache();
  viewportManager.destroy();

  // Force garbage collection hint (not guaranteed)
  if ("gc" in window) {
    (window as any).gc();
  }
}`;

  const renderingPipelineCode = `import {
  RenderingPipeline,
  createRenderingPipeline,
  type RenderingPipelineOptions,
} from "@dvvebond/core";

// Configure rendering pipeline for optimal performance
const pipeline = createRenderingPipeline({
  maxConcurrentRenders: 4,   // Parallel page renders
  priorityMode: "visible",   // Prioritize visible pages
  textLayerMode: "lazy",     // Defer text layer until needed
  annotationLayerMode: "lazy",

  // Quality settings
  resolution: window.devicePixelRatio || 1,
  useOffscreenCanvas: true,

  // Callbacks
  onRenderStart: (pageIndex) => {
    console.log(\`Starting render: page \${pageIndex + 1}\`);
  },
  onRenderComplete: (pageIndex, timing) => {
    console.log(\`Rendered page \${pageIndex + 1} in \${timing}ms\`);
  },
  onRenderError: (pageIndex, error) => {
    console.error(\`Render failed: page \${pageIndex + 1}\`, error);
  },
});

// Queue multiple pages
pipeline.enqueue([0, 1, 2, 3, 4], { priority: "high" });

// Cancel pending renders
pipeline.cancelAll();
pipeline.cancel([5, 6, 7]); // Cancel specific pages

// Get render statistics
const stats = pipeline.getStats();
console.log({
  pagesRendered: stats.pagesRendered,
  totalRenderTime: stats.totalRenderTime,
  averageRenderTime: stats.averageRenderTime,
  cacheHitRate: stats.cacheHitRate,
});`;

  return (
    <>
      <div className="page-header">
        <h2>Performance Testing</h2>
        <p>
          Tools and techniques for measuring and optimizing PDF rendering performance. Run
          benchmarks, analyze bottlenecks, and apply optimizations.
        </p>
      </div>

      <div className="page-content">
        {/* Metrics */}
        <MetricsPanel metrics={metricsData} />

        {/* Benchmark Runner */}
        <div className="card">
          <div className="card-header">
            <h3>Benchmark Suite</h3>
            <button className="btn btn-primary" onClick={runAllBenchmarks} disabled={isRunning}>
              {isRunning ? "Running..." : "Run Benchmarks"}
            </button>
          </div>
          <div className="card-body">
            {benchmarkResults.length === 0 ? (
              <div className="empty-state">
                <h3>No Results Yet</h3>
                <p>Click "Run Benchmarks" to measure performance</p>
              </div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th style={{ textAlign: "right" }}>Iterations</th>
                      <th style={{ textAlign: "right" }}>Total Time</th>
                      <th style={{ textAlign: "right" }}>Avg Time</th>
                      <th style={{ textAlign: "right" }}>Ops/sec</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarkResults.map((result, index) => (
                      <tr
                        key={index}
                        onClick={() => setSelectedTest(result.name)}
                        style={{
                          cursor: "pointer",
                          backgroundColor:
                            selectedTest === result.name ? "rgba(59, 130, 246, 0.1)" : undefined,
                        }}
                      >
                        <td>{result.name}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {result.iterations.toLocaleString()}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {result.duration.toFixed(2)}ms
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {result.avgDuration.toFixed(4)}ms
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {Math.round(1000 / result.avgDuration).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {timingData.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <TimingDisplay timings={timingData} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Performance Tips */}
        <div className="card">
          <div className="card-header">
            <h3>Performance Optimization Tips</h3>
          </div>
          <div className="card-body">
            <div className="info-box success" style={{ marginBottom: 16 }}>
              <p>
                <strong>Do:</strong>
              </p>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>Use virtual scrolling for large documents</li>
                <li>Debounce resize and scroll handlers</li>
                <li>Pre-render pages just before they become visible</li>
                <li>Use Web Workers for text extraction and search</li>
                <li>Cache rendered pages appropriately</li>
              </ul>
            </div>
            <div className="info-box warning">
              <p>
                <strong>Avoid:</strong>
              </p>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>Rendering all pages upfront</li>
                <li>Blocking the main thread with heavy operations</li>
                <li>Keeping unlimited pages in memory</li>
                <li>Re-rendering pages unnecessarily on scroll</li>
                <li>Using synchronous APIs for large files</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>Performance Optimization Techniques</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Common optimization patterns for PDF rendering applications.
            </p>
            <CodeDisplay code={performanceOptimizationCode} filename="optimizations.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Web Worker Rendering</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Offload heavy operations to Web Workers to keep the UI responsive.
            </p>
            <CodeDisplay code={workerRenderingCode} filename="workerRendering.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Memory Management</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Manage memory effectively for large documents.
            </p>
            <CodeDisplay code={memoryManagementCode} filename="memoryManagement.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Rendering Pipeline</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Configure the rendering pipeline for optimal performance.
            </p>
            <CodeDisplay code={renderingPipelineCode} filename="renderingPipeline.ts" />
          </div>
        </div>

        {/* Performance Targets */}
        <div className="card">
          <div className="card-header">
            <h3>Performance Targets</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Target</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Page Render Time</td>
                  <td>
                    <span className="badge badge-success">&lt; 100ms</span>
                  </td>
                  <td>Time to render a single page at 100% zoom</td>
                </tr>
                <tr>
                  <td>Initial Load Time</td>
                  <td>
                    <span className="badge badge-success">&lt; 1s</span>
                  </td>
                  <td>Time to display first page (for 10MB PDF)</td>
                </tr>
                <tr>
                  <td>Scroll Frame Rate</td>
                  <td>
                    <span className="badge badge-success">60 fps</span>
                  </td>
                  <td>Smooth scrolling without jank</td>
                </tr>
                <tr>
                  <td>Search Response</td>
                  <td>
                    <span className="badge badge-success">&lt; 500ms</span>
                  </td>
                  <td>First results for a 100-page document</td>
                </tr>
                <tr>
                  <td>Text Extraction</td>
                  <td>
                    <span className="badge badge-warning">&lt; 50ms/page</span>
                  </td>
                  <td>Extract text from a single page</td>
                </tr>
                <tr>
                  <td>Memory Usage</td>
                  <td>
                    <span className="badge badge-warning">&lt; 200MB</span>
                  </td>
                  <td>For a 500-page document</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
