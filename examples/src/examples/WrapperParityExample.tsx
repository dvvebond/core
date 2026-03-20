import { WrapperParityViewer } from "../components/WrapperParityViewer";
import { CodeDisplay } from "../utils/code-display";

const parityCode = `import {
  buildPDFJSTextLayer,
  createPDFResourceLoader,
  initializePDFJS,
} from "@dvvebond/core";

await initializePDFJS();

const loader = createPDFResourceLoader({
  maxRetries: 3,
  timeout: 30000,
});

const result = await loader.load({
  type: "url",
  url: pdfUrl,
});

const pageProxy = await result.document.getPage(pageNum);
const viewport = pageProxy.getViewport({ scale });

const canvas = document.createElement("canvas");
const context = canvas.getContext("2d", { alpha: false });

await pageProxy.render({
  canvasContext: context!,
  viewport,
}).promise;

const textLayer = document.createElement("div");
textLayer.className = "react-pdf__Page__textContent textLayer";

await buildPDFJSTextLayer(pageProxy, {
  container: textLayer,
  viewport,
});
`;

export function WrapperParityExample() {
  return (
    <>
      <div className="page-header">
        <h2>Wrapper Parity Viewer</h2>
        <p>
          This page mirrors the integration path you described from your other app: load with the
          core resource loader, render each page to a canvas, then build the selectable text layer
          with <code>buildPDFJSTextLayer()</code>. There is no manual example-only selection wiring
          here.
        </p>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <h3>Why This Page Exists</h3>
          </div>
          <div className="card-body">
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              The goal is to demo the exact library path your wrapper uses, inside the examples app,
              so selection issues can be verified against the real `@dvvebond/core` text-layer
              builder instead of the richer custom demo viewer.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Live Wrapper-Style Viewer</h3>
          </div>
          <div className="card-body">
            <WrapperParityViewer pdfUrl="/assets/sample.pdf" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Integration Shape</h3>
          </div>
          <div className="card-body">
            <CodeDisplay code={parityCode} filename="WrapperParityViewer.tsx" />
          </div>
        </div>
      </div>
    </>
  );
}
