# Migration Guide: react-pdf to @dvvebond/core

This guide helps you migrate from [react-pdf](https://github.com/wojtekmaj/react-pdf) to @dvvebond/core. The migration offers enhanced features like bounding box visualization, integrated search, and viewport management.

## Installation

Replace react-pdf with @dvvebond/core:

```bash
# Remove react-pdf
npm uninstall react-pdf

# Install @dvvebond/core
npm install @dvvebond/core
```

## Basic Document Viewer

### react-pdf

```tsx
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function PDFViewer({ url }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  return (
    <div>
      <Document file={url} onLoadSuccess={onDocumentLoadSuccess}>
        <Page pageNumber={pageNumber} />
      </Document>
      <p>
        Page {pageNumber} of {numPages}
      </p>
      <button onClick={() => setPageNumber(pageNumber - 1)} disabled={pageNumber <= 1}>
        Previous
      </button>
      <button onClick={() => setPageNumber(pageNumber + 1)} disabled={pageNumber >= numPages}>
        Next
      </button>
    </div>
  );
}
```

### @dvvebond/core

```tsx
import { ReactPDFViewer, PageNavigation, type ReactPDFViewerRef } from "@dvvebond/core/react";
import { useRef } from "react";

function PDFViewer({ url }) {
  const viewerRef = useRef<ReactPDFViewerRef>(null);

  return (
    <div>
      <ReactPDFViewer
        ref={viewerRef}
        url={url}
        onDocumentLoad={info => console.log(`Loaded ${info.numPages} pages`)}
      />
      <PageNavigation viewerRef={viewerRef} />
    </div>
  );
}
```

## Zoom Controls

### react-pdf

```tsx
function ZoomableViewer() {
  const [scale, setScale] = useState(1.0);

  return (
    <div>
      <button onClick={() => setScale(s => s - 0.1)}>Zoom Out</button>
      <button onClick={() => setScale(s => s + 0.1)}>Zoom In</button>
      <Document file={url}>
        <Page pageNumber={1} scale={scale} />
      </Document>
    </div>
  );
}
```

### @dvvebond/core

```tsx
import { ReactPDFViewer, ZoomControls, type ReactPDFViewerRef } from "@dvvebond/core/react";

function ZoomableViewer({ url }) {
  const viewerRef = useRef<ReactPDFViewerRef>(null);

  return (
    <div>
      <ZoomControls viewerRef={viewerRef} />
      <ReactPDFViewer ref={viewerRef} url={url} initialScale={1.0} />
    </div>
  );
}
```

## Text Selection and Search

### react-pdf

react-pdf provides text layer but requires custom search implementation:

```tsx
function SearchablePDF() {
  const [searchText, setSearchText] = useState("");
  // Custom search implementation needed

  return (
    <Document file={url}>
      <Page pageNumber={1} renderTextLayer={true} />
    </Document>
  );
}
```

### @dvvebond/core

Built-in search with highlighting:

```tsx
import { ReactPDFViewer, SearchInput, usePDFSearch } from "@dvvebond/core/react";

function SearchablePDF({ url }) {
  const viewerRef = useRef<ReactPDFViewerRef>(null);
  const { searchState, search, nextMatch, prevMatch } = usePDFSearch(viewerRef);

  return (
    <div>
      <SearchInput
        onSearch={search}
        onNext={nextMatch}
        onPrevious={prevMatch}
        matchCount={searchState.totalMatches}
        currentMatch={searchState.currentMatch}
      />
      <ReactPDFViewer ref={viewerRef} url={url} />
    </div>
  );
}
```

## Rendering Multiple Pages

### react-pdf

```tsx
function AllPagesViewer({ url }) {
  const [numPages, setNumPages] = useState(0);

  return (
    <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
      {Array.from(new Array(numPages), (_, index) => (
        <Page key={`page_${index + 1}`} pageNumber={index + 1} />
      ))}
    </Document>
  );
}
```

### @dvvebond/core

Virtual scrolling is built-in for efficient rendering:

```tsx
import { ReactPDFViewer } from "@dvvebond/core/react";

function AllPagesViewer({ url }) {
  return (
    <ReactPDFViewer
      url={url}
      // Virtual scrolling automatically handles large documents
      // Only visible pages are rendered
    />
  );
}
```

## Loading from Different Sources

### react-pdf

```tsx
// URL
<Document file="https://example.com/document.pdf" />

// Base64
<Document file={`data:application/pdf;base64,${base64String}`} />

// ArrayBuffer/Uint8Array
<Document file={{ data: uint8Array }} />

// File object
<Document file={fileObject} />
```

### @dvvebond/core

```tsx
// URL
<ReactPDFViewer url="https://example.com/document.pdf" />;

// Uint8Array (use the core API)
import { loadPDFJSDocument } from "@dvvebond/core";

const doc = await loadPDFJSDocument(uint8Array);
<ReactPDFViewer document={doc} />;

// File object with URL.createObjectURL
const url = URL.createObjectURL(fileObject);
<ReactPDFViewer url={url} />;
```

## Error Handling

### react-pdf

```tsx
<Document
  file={url}
  onLoadError={error => console.error("Load error:", error)}
  error={<div>Failed to load PDF</div>}
  loading={<div>Loading...</div>}
>
  <Page pageNumber={1} />
</Document>
```

### @dvvebond/core

```tsx
<ReactPDFViewer
  url={url}
  onError={error => console.error("Error:", error)}
  onDocumentLoad={info => console.log("Loaded:", info)}
  loadingComponent={<div>Loading...</div>}
  errorComponent={<div>Failed to load PDF</div>}
/>
```

## Custom Rendering

### react-pdf

```tsx
<Page
  pageNumber={1}
  renderTextLayer={true}
  renderAnnotationLayer={true}
  customTextRenderer={({ str, itemIndex }) => <span className="custom-text">{str}</span>}
/>
```

### @dvvebond/core

For custom rendering, use the lower-level APIs:

```tsx
import {
  createCanvasRenderer,
  createTextLayerBuilder,
  loadPDFJSDocument,
  getPDFJSPage,
} from "@dvvebond/core";

function CustomRenderer({ url }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function render() {
      const doc = await loadPDFJSDocument(url);
      const page = await getPDFJSPage(doc, 1);

      // Canvas rendering
      const renderer = createCanvasRenderer(canvasRef.current!, {
        scale: 1.5,
      });
      await renderer.render(page);

      // Text layer
      const textBuilder = createTextLayerBuilder(textLayerRef.current!, {
        scale: 1.5,
      });
      await textBuilder.render(page);
    }
    render();
  }, [url]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} style={{ position: "absolute", top: 0, left: 0 }} />
    </div>
  );
}
```

## Password-Protected PDFs

### react-pdf

```tsx
<Document
  file={url}
  onPassword={(callback, reason) => {
    const password = prompt("Enter password:");
    callback(password);
  }}
>
  <Page pageNumber={1} />
</Document>
```

### @dvvebond/core

```tsx
import { PDF } from "@dvvebond/core";

// Using core API
const pdf = await PDF.load(bytes, { credentials: "password" });

// With ReactPDFViewer, handle via the PDF.js integration
import { loadPDFJSDocument } from "@dvvebond/core";

const doc = await loadPDFJSDocument(url, {
  password: "user-provided-password",
});
```

## Feature Comparison

| Feature              | react-pdf   | @dvvebond/core     |
| -------------------- | ----------- | ------------------ |
| Basic rendering      | Yes         | Yes                |
| Text layer           | Yes         | Yes                |
| Annotation layer     | Yes         | Yes                |
| Virtual scrolling    | No (manual) | Built-in           |
| Search               | No (manual) | Built-in           |
| Bounding boxes       | No          | Built-in           |
| Coordinate transform | No          | Built-in           |
| Zoom controls        | Manual      | Built-in component |
| Page navigation      | Manual      | Built-in component |
| PDF modification     | No          | Yes                |
| Digital signatures   | No          | Yes                |
| Form filling         | No          | Yes                |

## TypeScript Types

### react-pdf

```tsx
import type { DocumentProps, PageProps } from "react-pdf";
```

### @dvvebond/core

```tsx
import type {
  ReactPDFViewerProps,
  ReactPDFViewerRef,
  PageNavigationProps,
  ZoomControlsProps,
  SearchInputProps,
  PDFViewerState,
  SearchState,
} from "@dvvebond/core/react";
```

## Troubleshooting

### Worker Configuration

react-pdf requires manual worker configuration. @dvvebond/core handles this automatically, but you can customize if needed:

```tsx
import { initializePDFJS } from "@dvvebond/core";

// Custom worker path (optional)
await initializePDFJS({
  workerSrc: "/custom-path/pdf.worker.min.js",
});
```

### CSS Imports

react-pdf requires CSS imports for text and annotation layers. @dvvebond/core includes styles automatically, but you may want to customize:

```css
/* Custom styles for text layer */
.dvvebond-text-layer {
  /* your styles */
}

/* Custom styles for bounding boxes */
.dvvebond-bbox-overlay {
  /* your styles */
}
```

### Memory Management

@dvvebond/core includes automatic memory management with virtual scrolling. For very large documents:

```tsx
<ReactPDFViewer
  url={url}
  // Adjust overscan for memory/performance tradeoff
  overscan={2} // Number of pages to pre-render above/below viewport
/>
```
