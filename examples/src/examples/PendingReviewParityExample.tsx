import { useCallback, useRef, useState } from "react";

import { PendingReviewParityReactPDFViewer } from "../components/PendingReviewParityReactPDFViewer";
import { CodeDisplay } from "../utils/code-display";

function deriveFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const candidate = pathname.split("/").pop()?.trim();
    return candidate || "remote.pdf";
  } catch {
    return "remote.pdf";
  }
}

const pendingReviewCode = `function PendingReviewPageExample() {
  const pdfViewerRef = useRef(null);
  const [urlInput, setUrlInput] = useState("");
  const [manualPdfUrl, setManualPdfUrl] = useState("");
  const [manualPdfFilename, setManualPdfFilename] = useState("remote.pdf");

  const handleLoadPdfUrl = () => {
    const nextUrl = urlInput.trim();
    if (!nextUrl) {
      return;
    }

    setManualPdfUrl(nextUrl);
    setManualPdfFilename(deriveFilenameFromUrl(nextUrl));
  };

  return (
    <>
      <div className="input-group">
        <input
          type="text"
          className="input"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLoadPdfUrl()}
          placeholder="https://example.com/document.pdf"
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleLoadPdfUrl}>
          Load URL
        </button>
      </div>

      <PendingReviewParityReactPDFViewer
        ref={pdfViewerRef}
        pdfUrl={manualPdfUrl}
        filename={manualPdfFilename}
        className="h-full w-full flex-1"
        onRefreshUrl={async () => {
          return manualPdfUrl;
        }}
      />
    </>
  );
}`;

export function PendingReviewParityExample() {
  const pdfViewerRef = useRef<HTMLDivElement | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [manualPdfUrl, setManualPdfUrl] = useState("");
  const [manualPdfFilename, setManualPdfFilename] = useState("remote.pdf");

  const handleRefreshUrl = useCallback(async () => {
    return manualPdfUrl;
  }, [manualPdfUrl]);

  const handleLoadPdfUrl = useCallback(() => {
    const nextUrl = urlInput.trim();
    if (!nextUrl) {
      return;
    }

    setManualPdfUrl(nextUrl);
    setManualPdfFilename(deriveFilenameFromUrl(nextUrl));
  }, [urlInput]);

  return (
    <>
      <div className="page-header">
        <h2>Pending Review Parity</h2>
        <p>
          This page mirrors the Pending Review flow you described more literally: a page-level
          component passes `pdfUrl` into a local `ReactPDFViewer`-style wrapper, that wrapper loads
          with `initializePDFJS()` and `createPDFResourceLoader()`, and each page child renders a
          canvas plus `buildPDFJSTextLayer()` before appending the text layer.
        </p>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <h3>Literal Flow Replica</h3>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                Enter a PDF URL to test this wrapper flow
              </label>
              <div className="input-group">
                <input
                  type="text"
                  className="input"
                  value={urlInput}
                  onChange={event => setUrlInput(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && handleLoadPdfUrl()}
                  placeholder="https://example.com/document.pdf"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleLoadPdfUrl}>
                  Load URL
                </button>
              </div>
              <p style={{ marginTop: 8, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                Use a direct PDF URL with CORS enabled so the browser can fetch it.
              </p>
            </div>

            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
              This is meant to be closer to the structure you pasted than the earlier wrapper page.
              If you can reproduce the issue here, we know there is still a mismatch in the real
              library path. If you cannot, then the next thing to compare is the exact DOM/CSS in
              your external app.
            </p>
            <PendingReviewParityReactPDFViewer
              ref={pdfViewerRef}
              pdfUrl={manualPdfUrl}
              filename={manualPdfFilename}
              className="h-full w-full flex-1"
              onRefreshUrl={handleRefreshUrl}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Page-Level Shape</h3>
          </div>
          <div className="card-body">
            <CodeDisplay code={pendingReviewCode} filename="PendingReviewParityExample.tsx" />
          </div>
        </div>
      </div>
    </>
  );
}
