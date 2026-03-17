# @dvvebond/core

[![npm](https://img.shields.io/npm/v/@dvvebond/core)](https://www.npmjs.com/package/@dvvebond/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A fork of [@libpdf/core](https://github.com/LibPDF-js/core) with enhanced React components, Azure Document Intelligence integration, text extraction with bounding boxes, and enterprise PDF viewing features.

## Fork Enhancements

This fork extends the original LibPDF library with:

- **React Integration Layer**: Production-ready React components and hooks for PDF viewing
- **Text Extraction with Bounding Boxes**: Character, word, line, and paragraph-level extraction with precise coordinates
- **Search Functionality**: Full-text search with highlighting and navigation
- **Viewport Management**: Virtual scrolling for large documents with efficient memory usage
- **Azure Document Intelligence Integration**: Process PDFs with Azure AI services
- **Coordinate Transformation**: Convert between PDF and screen coordinates

## Features

### Core PDF Operations (from LibPDF)

| Feature            | Status | Notes                                      |
| ------------------ | ------ | ------------------------------------------ |
| Parse any PDF      | Yes    | Graceful fallback for malformed documents  |
| Create PDFs        | Yes    | From scratch or modify existing            |
| Encryption         | Yes    | RC4, AES-128, AES-256 (R2-R6)              |
| Digital Signatures | Yes    | PAdES B-B, B-T, B-LT, B-LTA                |
| Form Filling       | Yes    | Text, checkbox, radio, dropdown, signature |
| Form Flattening    | Yes    | Bake fields into page content              |
| Merge & Split      | Yes    | Combine or extract pages                   |
| Attachments        | Yes    | Embed and extract files                    |
| Text Extraction    | Yes    | With position information                  |
| Font Embedding     | Yes    | TTF/OpenType with subsetting               |
| Images             | Yes    | JPEG, PNG (with alpha)                     |
| Incremental Saves  | Yes    | Append changes, preserve signatures        |

### Enhanced Features (this fork)

| Feature                    | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| React Components           | ReactPDFViewer, PageNavigation, ZoomControls, SearchInput      |
| React Hooks                | usePDFViewer, usePDFSearch, useBoundingBoxOverlay, useViewport |
| Text Extraction            | Hierarchical extraction (char/word/line/paragraph)             |
| Bounding Box Visualization | Overlay system for highlighting text regions                   |
| Virtual Scrolling          | Efficient rendering of large documents                         |
| Search Engine              | Full-text search with match highlighting                       |
| Coordinate Transformation  | PDF-to-screen and screen-to-PDF conversions                    |
| PDF.js Integration         | Seamless integration with Mozilla's PDF.js                     |

## Installation

```bash
npm install @dvvebond/core
# or
bun add @dvvebond/core
# or
pnpm add @dvvebond/core
```

For React components:

```bash
# React is a peer dependency
npm install @dvvebond/core react react-dom
```

## Quick Start

### Basic PDF Loading

```typescript
import { PDF } from "@dvvebond/core";

const pdf = await PDF.load(bytes);
const pages = pdf.getPages();
console.log(`${pages.length} pages`);
```

### React PDF Viewer

```tsx
import { ReactPDFViewer, usePDFViewer, PageNavigation, ZoomControls } from "@dvvebond/core/react";
import { useRef } from "react";

function PDFViewerApp() {
  const viewerRef = useRef<ReactPDFViewerRef>(null);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="toolbar">
        <PageNavigation viewerRef={viewerRef} />
        <ZoomControls viewerRef={viewerRef} />
      </div>
      <ReactPDFViewer
        ref={viewerRef}
        url="/document.pdf"
        initialScale={1.0}
        onPageChange={page => console.log("Current page:", page)}
        onDocumentLoad={info => console.log("Loaded:", info.numPages, "pages")}
      />
    </div>
  );
}
```

### Text Extraction with Bounding Boxes

```typescript
import {
  HierarchicalTextExtractor,
  createHierarchicalTextExtractor,
  type TextPage,
} from "@dvvebond/core";

// Extract text with full hierarchy
const extractor = createHierarchicalTextExtractor();
const pageText: TextPage = await extractor.extractPage(pdfPage, {
  includeCharacters: true,
  includeWords: true,
  includeLines: true,
  includeParagraphs: true,
});

// Access bounding boxes at any level
for (const paragraph of pageText.paragraphs) {
  console.log("Paragraph bbox:", paragraph.boundingBox);
  for (const line of paragraph.lines) {
    console.log("  Line:", line.text, "at", line.boundingBox);
  }
}
```

### Search with Highlighting

```tsx
import { usePDFSearch, useBoundingBoxOverlay } from "@dvvebond/core/react";

function SearchableViewer() {
  const { searchState, search, nextMatch, prevMatch, clearSearch } = usePDFSearch();
  const { boundingBoxes, setHighlights } = useBoundingBoxOverlay();

  const handleSearch = async (query: string) => {
    const results = await search(query);
    // Results include bounding boxes for highlighting
    setHighlights(results.map(r => r.boundingBox));
  };

  return (
    <div>
      <input type="text" onChange={e => handleSearch(e.target.value)} placeholder="Search..." />
      <span>
        {searchState.currentMatch} / {searchState.totalMatches}
      </span>
      <button onClick={prevMatch}>Previous</button>
      <button onClick={nextMatch}>Next</button>
    </div>
  );
}
```

### Bounding Box Visualization

```typescript
import { createBoundingBoxOverlay, type OverlayBoundingBox } from "@dvvebond/core";

const overlay = createBoundingBoxOverlay(containerElement, {
  pageWidth: 612,
  pageHeight: 792,
  scale: 1.5,
});

// Add bounding boxes with different types
overlay.setBoundingBoxes([
  { x: 50, y: 100, width: 200, height: 20, type: "word", text: "Hello" },
  { x: 50, y: 130, width: 300, height: 20, type: "line", text: "Hello World" },
  { x: 50, y: 100, width: 300, height: 100, type: "paragraph" },
]);

// Control visibility by type
overlay.setVisibility({
  character: false,
  word: true,
  line: true,
  paragraph: false,
});
```

### Virtual Scrolling for Large Documents

```typescript
import { createViewportManager, createVirtualScroller, type PageSource } from "@dvvebond/core";

const scroller = createVirtualScroller(containerElement, {
  totalPages: 100,
  pageHeight: 792,
  pageGap: 10,
  overscan: 2, // Render 2 extra pages above/below viewport
});

const viewportManager = createViewportManager({
  pageSource: pdfDocument,
  scroller,
  renderer: createCanvasRenderer(),
});

// Pages are automatically loaded/unloaded as user scrolls
scroller.on("visibleRangeChange", ({ startPage, endPage }) => {
  console.log(`Visible pages: ${startPage} - ${endPage}`);
});
```

### Coordinate Transformation

```typescript
import {
  createCoordinateTransformer,
  getMousePdfCoordinates,
  transformBoundingBoxes,
} from "@dvvebond/core";

const transformer = createCoordinateTransformer({
  pageWidth: 612,
  pageHeight: 792,
  scale: 1.5,
  rotation: 0,
});

// Handle click events on PDF
containerElement.addEventListener("click", event => {
  const pdfCoords = getMousePdfCoordinates(event, containerElement, transformer);
  console.log(`Clicked at PDF coordinates: (${pdfCoords.x}, ${pdfCoords.y})`);
});

// Transform bounding boxes from PDF to screen coordinates
const screenBoxes = transformBoundingBoxes(pdfBoundingBoxes, transformer);
```

### PDF.js Integration

```typescript
import {
  initializePDFJS,
  loadPDFJSDocument,
  getPDFJSTextContent,
  createPDFJSRenderer,
} from "@dvvebond/core";

// Initialize PDF.js (call once at app startup)
await initializePDFJS();

// Load document
const doc = await loadPDFJSDocument(pdfBytes);
const page = await doc.getPage(1);

// Render to canvas
const renderer = createPDFJSRenderer(canvas, {
  scale: 1.5,
  enableTextLayer: true,
});
await renderer.render(page);

// Extract text content
const textContent = await getPDFJSTextContent(page);
```

## React Hooks Reference

### usePDFViewer

Main hook for PDF viewer state management.

```tsx
const { currentPage, totalPages, scale, isLoading, error, goToPage, setScale, zoomIn, zoomOut } =
  usePDFViewer(viewerRef);
```

### usePDFSearch

Hook for search functionality.

```tsx
const {
  searchState, // { query, matches, currentMatch, totalMatches, status }
  search, // (query: string) => Promise<SearchResult[]>
  nextMatch, // () => void
  prevMatch, // () => void
  clearSearch, // () => void
} = usePDFSearch(viewerRef);
```

### useBoundingBoxOverlay

Hook for bounding box visualization.

```tsx
const {
  boundingBoxes,
  visibility,
  setVisibility,
  addBoundingBoxes,
  clearBoundingBoxes,
  highlightBox,
} = useBoundingBoxOverlay(viewerRef);
```

### useViewport

Hook for viewport information.

```tsx
const { viewportWidth, viewportHeight, scrollTop, scrollLeft, visiblePages } =
  useViewport(viewerRef);
```

### useScrollPosition

Hook for scroll position tracking.

```tsx
const { scrollTop, scrollLeft, scrollTo, scrollToPage } = useScrollPosition(viewerRef);
```

## Runtime Support

Works in all modern JavaScript environments:

- **Node.js** 20+
- **Bun**
- **Browsers** (modern, with Web Crypto)

## Migration from react-pdf

See [MIGRATION.md](./MIGRATION.md) for a detailed migration guide from react-pdf to @dvvebond/core.

## API Reference

See [API.md](./API.md) for complete API documentation.

## Acknowledgments

This project is a fork of [LibPDF](https://github.com/LibPDF-js/core) by [Documenso](https://documenso.com). The core PDF parsing and generation functionality is their excellent work.

## License

[MIT](LICENSE)

The `src/fontbox/` directory is licensed under [Apache-2.0](src/fontbox/LICENSE) as it is derived from [Apache PDFBox](https://pdfbox.apache.org/).
