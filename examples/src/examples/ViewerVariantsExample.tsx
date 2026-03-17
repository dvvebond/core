import { useState } from "react";

import { CodeDisplay } from "../utils/code-display";

type ViewerVariant = "ReactPDFViewer" | "SimplePDFViewer" | "DirectPDFViewer" | "BlobPDFViewer";

interface VariantInfo {
  name: ViewerVariant;
  description: string;
  useCase: string;
  features: string[];
  limitations: string[];
}

const variants: VariantInfo[] = [
  {
    name: "ReactPDFViewer",
    description:
      "Full-featured React component with hooks integration, bounding box support, and comprehensive controls.",
    useCase:
      "Production applications requiring complete PDF viewing functionality with React integration.",
    features: [
      "Full React hooks integration",
      "Bounding box visualization",
      "Built-in search support",
      "Page navigation & zoom controls",
      "Text layer & annotation layer",
      "Rotation support",
      "Event callbacks",
      "Imperative ref API",
    ],
    limitations: ["Larger bundle size", "Requires React 17+"],
  },
  {
    name: "SimplePDFViewer",
    description:
      "Lightweight viewer with minimal dependencies. Good for simple PDF display without advanced features.",
    useCase: "Simple PDF previews, thumbnails, or when bundle size is critical.",
    features: [
      "Small bundle footprint",
      "Basic page rendering",
      "Simple zoom controls",
      "Minimal dependencies",
    ],
    limitations: ["No bounding box support", "No search functionality", "Limited event handling"],
  },
  {
    name: "DirectPDFViewer",
    description:
      "Renders PDFs directly from URLs without intermediate loading states. Ideal for server-side URLs.",
    useCase: "Static PDF hosting, CDN-served documents, or when URL is known at render time.",
    features: [
      "Direct URL rendering",
      "Automatic caching",
      "Streaming support",
      "Progress tracking",
    ],
    limitations: ["Requires accessible URL", "No byte array support"],
  },
  {
    name: "BlobPDFViewer",
    description:
      "Specialized for Azure Blob Storage with SAS token support and automatic token refresh.",
    useCase: "Enterprise applications using Azure Blob Storage with time-limited access tokens.",
    features: [
      "SAS token support",
      "Automatic token refresh",
      "Azure authentication",
      "Retry on 403 errors",
      "URL expiration handling",
    ],
    limitations: ["Azure-specific", "Requires token provider"],
  },
];

export function ViewerVariantsExample() {
  const [selectedVariant, setSelectedVariant] = useState<ViewerVariant>("ReactPDFViewer");

  const selected = variants.find(v => v.name === selectedVariant)!;

  const reactPDFViewerCode = `import { ReactPDFViewer, type ReactPDFViewerRef } from "@dvvebond/core/react";
import { useRef, useState } from "react";

function FullFeaturedViewer() {
  const viewerRef = useRef<ReactPDFViewerRef>(null);
  const [pageCount, setPageCount] = useState(0);

  return (
    <ReactPDFViewer
      ref={viewerRef}
      url="/document.pdf"
      initialScale={1}
      enableTextLayer={true}
      enableAnnotationLayer={true}
      scrollMode="vertical"
      onDocumentLoad={(pdf) => setPageCount(pdf.getPageCount())}
      onPageChange={(page) => console.log("Page:", page)}
      onScaleChange={(scale) => console.log("Scale:", scale)}
    />
  );
}`;

  const simplePDFViewerCode = `import { PDFViewer, createPDFViewer } from "@dvvebond/core";
import { useEffect, useRef } from "react";

function SimplePDFViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PDFViewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = createPDFViewer({
      container: containerRef.current,
      scale: 1,
    });

    viewer.initialize().then(() => {
      return viewer.loadFromUrl(url);
    });

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
    };
  }, [url]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}`;

  const directPDFViewerCode = `import { loadPDFFromUrl, PDFJSRenderer, createPDFJSRenderer } from "@dvvebond/core";
import { useEffect, useRef, useState } from "react";

function DirectPDFViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;

    async function loadAndRender() {
      // Load directly from URL with progress tracking
      const result = await loadPDFFromUrl(url, {
        onProgress: (loaded, total) => {
          console.log(\`Loading: \${Math.round(loaded / total * 100)}%\`);
        },
      });

      if (cancelled) return;

      setPageCount(result.document.numPages);

      // Create renderer and render first page
      const renderer = createPDFJSRenderer({
        document: result.document,
        canvas: canvasRef.current!,
      });

      await renderer.renderPage(currentPage);
    }

    loadAndRender();

    return () => {
      cancelled = true;
    };
  }, [url, currentPage]);

  return (
    <div>
      <canvas ref={canvasRef} />
      <div>
        Page {currentPage} of {pageCount}
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
          Previous
        </button>
        <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}>
          Next
        </button>
      </div>
    </div>
  );
}`;

  const blobPDFViewerCode = `import { PDFResourceLoader, createPDFResourceLoader } from "@dvvebond/core";
import { ReactPDFViewer } from "@dvvebond/core/react";
import { useCallback, useEffect, useState } from "react";

interface SASToken {
  url: string;
  expiresAt: Date;
}

function BlobPDFViewer({ blobPath }: { blobPath: string }) {
  const [sasUrl, setSasUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Token provider that fetches fresh SAS tokens
  const getSASToken = useCallback(async (): Promise<SASToken> => {
    const response = await fetch(\`/api/sas-token?path=\${blobPath}\`);
    if (!response.ok) throw new Error("Failed to get SAS token");
    return response.json();
  }, [blobPath]);

  // Initial token fetch
  useEffect(() => {
    getSASToken()
      .then((token) => setSasUrl(token.url))
      .catch((err) => setError(err.message));
  }, [getSASToken]);

  // Handle token expiration
  const handleDocumentError = useCallback(async (err: Error) => {
    if (err.message.includes("403") || err.message.includes("expired")) {
      try {
        const newToken = await getSASToken();
        setSasUrl(newToken.url);
        setError(null);
      } catch (refreshErr) {
        setError("Session expired. Please refresh.");
      }
    } else {
      setError(err.message);
    }
  }, [getSASToken]);

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!sasUrl) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ReactPDFViewer
      url={sasUrl}
      onDocumentError={handleDocumentError}
    />
  );
}

// With automatic retry using ResourceLoader
function BlobPDFViewerWithRetry({ blobPath }: { blobPath: string }) {
  const [documentData, setDocumentData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    const loader = createPDFResourceLoader({
      authConfig: {
        getToken: async () => {
          const response = await fetch(\`/api/sas-token?path=\${blobPath}\`);
          const { token } = await response.json();
          return token;
        },
        refreshToken: async () => {
          // Called automatically when 401/403 received
          const response = await fetch(\`/api/sas-token?path=\${blobPath}\`);
          const { token } = await response.json();
          return token;
        },
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        retryOn: [401, 403, 408, 429, 500, 502, 503, 504],
      },
    });

    loader.load(blobPath).then((result) => {
      setDocumentData(result.data);
    });
  }, [blobPath]);

  if (!documentData) {
    return <div>Loading...</div>;
  }

  return <ReactPDFViewer data={documentData} />;
}`;

  return (
    <>
      <div className="page-header">
        <h2>Viewer Variants</h2>
        <p>
          Choose the right PDF viewer component for your use case. Each variant offers different
          trade-offs between features, bundle size, and complexity.
        </p>
      </div>

      <div className="page-content">
        {/* Variant Selector */}
        <div className="card">
          <div className="card-header">
            <h3>Select Viewer Type</h3>
          </div>
          <div className="card-body">
            <div className="toggle-group">
              {variants.map(variant => (
                <button
                  key={variant.name}
                  className={`toggle-btn ${selectedVariant === variant.name ? "active" : ""}`}
                  onClick={() => setSelectedVariant(variant.name)}
                >
                  {variant.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Variant Details */}
        <div className="split-layout">
          <div className="card">
            <div className="card-header">
              <h3>{selected.name}</h3>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>{selected.description}</p>
              <div className="info-box info">
                <p>
                  <strong>Best for:</strong> {selected.useCase}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Features & Limitations</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 16 }}>
                <h4
                  style={{ fontSize: "0.875rem", color: "var(--success-color)", marginBottom: 8 }}
                >
                  Features
                </h4>
                <ul
                  style={{ paddingLeft: 20, color: "var(--text-secondary)", fontSize: "0.875rem" }}
                >
                  {selected.features.map((feature, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4
                  style={{ fontSize: "0.875rem", color: "var(--warning-color)", marginBottom: 8 }}
                >
                  Limitations
                </h4>
                <ul
                  style={{ paddingLeft: 20, color: "var(--text-secondary)", fontSize: "0.875rem" }}
                >
                  {selected.limitations.map((limitation, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>ReactPDFViewer</h3>
            <span className="badge badge-success">Recommended</span>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              The full-featured React component with all hooks and controls built-in.
            </p>
            <CodeDisplay code={reactPDFViewerCode} filename="FullFeaturedViewer.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>SimplePDFViewer (Vanilla)</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Use the core <code>PDFViewer</code> class directly for minimal bundle size.
            </p>
            <CodeDisplay code={simplePDFViewerCode} filename="SimplePDFViewer.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>DirectPDFViewer</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Load and render PDFs directly from URLs using the PDF.js wrapper.
            </p>
            <CodeDisplay code={directPDFViewerCode} filename="DirectPDFViewer.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>BlobPDFViewer (Azure)</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Specialized viewer for Azure Blob Storage with SAS token management.
            </p>
            <CodeDisplay code={blobPDFViewerCode} filename="BlobPDFViewer.tsx" />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="card">
          <div className="card-header">
            <h3>Feature Comparison</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>ReactPDFViewer</th>
                  <th>SimplePDFViewer</th>
                  <th>DirectPDFViewer</th>
                  <th>BlobPDFViewer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>React Integration</td>
                  <td>
                    <span className="badge badge-success">Full</span>
                  </td>
                  <td>
                    <span className="badge badge-warning">Manual</span>
                  </td>
                  <td>
                    <span className="badge badge-warning">Manual</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Full</span>
                  </td>
                </tr>
                <tr>
                  <td>Bounding Boxes</td>
                  <td>
                    <span className="badge badge-success">Yes</span>
                  </td>
                  <td>
                    <span className="badge badge-error">No</span>
                  </td>
                  <td>
                    <span className="badge badge-error">No</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Yes</span>
                  </td>
                </tr>
                <tr>
                  <td>Search</td>
                  <td>
                    <span className="badge badge-success">Yes</span>
                  </td>
                  <td>
                    <span className="badge badge-error">No</span>
                  </td>
                  <td>
                    <span className="badge badge-warning">Manual</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Yes</span>
                  </td>
                </tr>
                <tr>
                  <td>Token Refresh</td>
                  <td>
                    <span className="badge badge-warning">Manual</span>
                  </td>
                  <td>
                    <span className="badge badge-error">No</span>
                  </td>
                  <td>
                    <span className="badge badge-error">No</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Auto</span>
                  </td>
                </tr>
                <tr>
                  <td>Bundle Size</td>
                  <td>
                    <span className="badge badge-warning">Large</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Small</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Small</span>
                  </td>
                  <td>
                    <span className="badge badge-warning">Large</span>
                  </td>
                </tr>
                <tr>
                  <td>Text Layer</td>
                  <td>
                    <span className="badge badge-success">Yes</span>
                  </td>
                  <td>
                    <span className="badge badge-warning">Optional</span>
                  </td>
                  <td>
                    <span className="badge badge-warning">Optional</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Yes</span>
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
