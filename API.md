# API Reference

Complete API documentation for @dvvebond/core.

## Table of Contents

- [Core PDF Operations](#core-pdf-operations)
- [React Components](#react-components)
- [React Hooks](#react-hooks)
- [Text Extraction](#text-extraction)
- [Search](#search)
- [Bounding Box Visualization](#bounding-box-visualization)
- [Coordinate Transformation](#coordinate-transformation)
- [Virtual Scrolling](#virtual-scrolling)
- [PDF.js Integration](#pdfjs-integration)
- [Renderers](#renderers)
- [UI Components](#ui-components)

---

## Core PDF Operations

### PDF

Main class for PDF document manipulation.

```typescript
import { PDF } from "@dvvebond/core";

// Load existing PDF
const pdf = await PDF.load(bytes: Uint8Array, options?: LoadOptions);

// Create new PDF
const pdf = PDF.create();

// Merge multiple PDFs
const merged = await PDF.merge(pdfs: Uint8Array[]);
```

#### LoadOptions

```typescript
interface LoadOptions {
  credentials?: string; // Password for encrypted PDFs
}
```

#### PDF Methods

| Method              | Description                         |
| ------------------- | ----------------------------------- |
| `getPages()`        | Returns array of PDFPage objects    |
| `addPage(options?)` | Adds a new page                     |
| `getForm()`         | Returns PDFForm for form operations |
| `save(options?)`    | Saves PDF to Uint8Array             |
| `sign(options)`     | Digitally signs the document        |

### PDFPage

Represents a single PDF page.

```typescript
const page = pdf.getPages()[0];

// Drawing operations
page.drawText(text, options);
page.drawRectangle(options);
page.drawCircle(options);
page.drawImage(image, options);
page.drawLine(options);
```

### PDFForm

Form manipulation.

```typescript
const form = pdf.getForm();

// Fill form fields
form.fill({
  fieldName: "value",
  checkboxField: true,
});

// Get/set individual fields
const field = form.getField("fieldName");
field.setValue("new value");
```

---

## React Components

Import from `@dvvebond/core/react`:

```typescript
import { ReactPDFViewer, PageNavigation, ZoomControls, SearchInput } from "@dvvebond/core/react";
```

### ReactPDFViewer

Main PDF viewer component.

```tsx
<ReactPDFViewer
  ref={viewerRef}
  url={string}
  initialScale={number}
  initialPage={number}
  onPageChange={(page: number) => void}
  onDocumentLoad={(info: DocumentInfo) => void}
  onError={(error: Error) => void}
  loadingComponent={ReactNode}
  errorComponent={ReactNode}
/>
```

#### Props

| Prop               | Type        | Default  | Description                |
| ------------------ | ----------- | -------- | -------------------------- |
| `url`              | `string`    | required | URL to PDF document        |
| `initialScale`     | `number`    | `1.0`    | Initial zoom level         |
| `initialPage`      | `number`    | `1`      | Initial page number        |
| `onPageChange`     | `function`  | -        | Called when page changes   |
| `onDocumentLoad`   | `function`  | -        | Called when document loads |
| `onError`          | `function`  | -        | Called on error            |
| `loadingComponent` | `ReactNode` | -        | Custom loading UI          |
| `errorComponent`   | `ReactNode` | -        | Custom error UI            |

#### Ref Methods (ReactPDFViewerRef)

```typescript
interface ReactPDFViewerRef {
  goToPage(page: number): void;
  setScale(scale: number): void;
  zoomIn(): void;
  zoomOut(): void;
  getCurrentPage(): number;
  getTotalPages(): number;
  getScale(): number;
}
```

### PageNavigation

Page navigation controls.

```tsx
<PageNavigation viewerRef={viewerRef} showPageInput={boolean} showPageCount={boolean} />
```

### ZoomControls

Zoom controls component.

```tsx
<ZoomControls viewerRef={viewerRef} minScale={number} maxScale={number} step={number} />
```

### SearchInput

Search input with controls.

```tsx
<SearchInput
  onSearch={(query: string) => void}
  onNext={() => void}
  onPrevious={() => void}
  matchCount={number}
  currentMatch={number}
/>
```

---

## React Hooks

### usePDFViewer

```typescript
const {
  currentPage,
  totalPages,
  scale,
  isLoading,
  error,
  goToPage,
  setScale,
  zoomIn,
  zoomOut,
} = usePDFViewer(viewerRef: RefObject<ReactPDFViewerRef>);
```

### usePDFSearch

```typescript
const {
  searchState,
  search,
  nextMatch,
  prevMatch,
  clearSearch,
} = usePDFSearch(viewerRef: RefObject<ReactPDFViewerRef>);
```

#### SearchState

```typescript
interface SearchState {
  query: string;
  matches: SearchMatch[];
  currentMatch: number;
  totalMatches: number;
  status: "idle" | "searching" | "complete" | "error";
}
```

### useBoundingBoxOverlay

```typescript
const {
  boundingBoxes,
  visibility,
  setVisibility,
  addBoundingBoxes,
  clearBoundingBoxes,
  highlightBox,
} = useBoundingBoxOverlay(viewerRef: RefObject<ReactPDFViewerRef>);
```

### useViewport

```typescript
const {
  viewportWidth,
  viewportHeight,
  scrollTop,
  scrollLeft,
  visiblePages,
} = useViewport(viewerRef: RefObject<ReactPDFViewerRef>);
```

### useScrollPosition

```typescript
const {
  scrollTop,
  scrollLeft,
  scrollTo,
  scrollToPage,
} = useScrollPosition(viewerRef: RefObject<ReactPDFViewerRef>);
```

---

## Text Extraction

### HierarchicalTextExtractor

Extracts text with hierarchical structure (characters, words, lines, paragraphs).

```typescript
import {
  HierarchicalTextExtractor,
  createHierarchicalTextExtractor,
} from "@dvvebond/core";

const extractor = createHierarchicalTextExtractor(options?: HierarchicalTextExtractorOptions);

const pageText = await extractor.extractPage(page, {
  includeCharacters: boolean,
  includeWords: boolean,
  includeLines: boolean,
  includeParagraphs: boolean,
});
```

#### Types

```typescript
interface Character {
  char: string;
  boundingBox: BoundingBox;
  fontName?: string;
  fontSize?: number;
}

interface Word {
  text: string;
  boundingBox: BoundingBox;
  characters: Character[];
}

interface Line {
  text: string;
  boundingBox: BoundingBox;
  words: Word[];
}

interface Paragraph {
  text: string;
  boundingBox: BoundingBox;
  lines: Line[];
}

interface TextPage {
  pageNumber: number;
  width: number;
  height: number;
  characters: Character[];
  words: Word[];
  lines: Line[];
  paragraphs: Paragraph[];
}
```

### TextExtractor

Basic text extraction.

```typescript
import { TextExtractor, getPlainText } from "@dvvebond/core";

const extractor = new TextExtractor(options);
const text = await extractor.extract(page);

// Or use helper
const plainText = await getPlainText(page);
```

### searchPage / searchPages

Search for text in pages.

```typescript
import { searchPage, searchPages } from "@dvvebond/core";

// Single page
const matches = searchPage(pageText, query, options);

// Multiple pages
const allMatches = searchPages(pagesText, query, options);
```

---

## Search

### SearchEngine

```typescript
import { SearchEngine, createSearchEngine } from "@dvvebond/core";

const engine = createSearchEngine(options?: SearchEngineOptions);

// Search
const results = await engine.search(query, {
  caseSensitive: boolean,
  wholeWord: boolean,
  regex: boolean,
});

// Navigate
engine.nextMatch();
engine.previousMatch();
engine.goToMatch(index);
```

### SearchStateManager

```typescript
import { SearchStateManager, createSearchStateManager } from "@dvvebond/core";

const manager = createSearchStateManager(options);

manager.on("stateChange", state => {
  console.log(state.currentMatch, state.totalMatches);
});
```

---

## Bounding Box Visualization

### BoundingBoxOverlay

```typescript
import { createBoundingBoxOverlay, BoundingBoxOverlay } from "@dvvebond/core";

const overlay = createBoundingBoxOverlay(container, {
  pageWidth: number,
  pageHeight: number,
  scale: number,
});

overlay.setBoundingBoxes(boxes: OverlayBoundingBox[]);
overlay.setVisibility(visibility: BoundingBoxVisibility);
overlay.clear();
```

#### OverlayBoundingBox

```typescript
interface OverlayBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "character" | "word" | "line" | "paragraph" | "custom";
  text?: string;
  data?: unknown;
}
```

#### BoundingBoxVisibility

```typescript
interface BoundingBoxVisibility {
  character: boolean;
  word: boolean;
  line: boolean;
  paragraph: boolean;
  custom: boolean;
}
```

### BoundingBoxControls

Toggle controls for visibility.

```typescript
import { createBoundingBoxControls } from "@dvvebond/core";

const controls = createBoundingBoxControls(container, {
  overlay: boundingBoxOverlay,
  initialVisibility: BoundingBoxVisibility,
});
```

### ViewportAwareBoundingBoxOverlay

Optimized overlay that only renders visible boxes.

```typescript
import { createViewportAwareBoundingBoxOverlay } from "@dvvebond/core";

const overlay = createViewportAwareBoundingBoxOverlay(container, {
  pageWidth: number,
  pageHeight: number,
  scale: number,
  viewportBounds: ViewportBounds,
});
```

---

## Coordinate Transformation

### CoordinateTransformer

```typescript
import { createCoordinateTransformer, CoordinateTransformer } from "@dvvebond/core";

const transformer = createCoordinateTransformer({
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: 0 | 90 | 180 | 270,
});

// PDF to screen
const screenPoint = transformer.pdfToScreen({ x, y });
const screenRect = transformer.pdfRectToScreen({ x, y, width, height });

// Screen to PDF
const pdfPoint = transformer.screenToPdf({ x, y });
const pdfRect = transformer.screenRectToPdf({ x, y, width, height });
```

### Mouse/Touch Coordinate Helpers

```typescript
import { getMousePdfCoordinates, getTouchPdfCoordinates } from "@dvvebond/core";

element.addEventListener("click", event => {
  const pdfCoords = getMousePdfCoordinates(event, container, transformer);
});

element.addEventListener("touchstart", event => {
  const pdfCoords = getTouchPdfCoordinates(event, container, transformer);
});
```

### Bounding Box Transformation

```typescript
import { transformBoundingBoxes, hitTestBoundingBoxes } from "@dvvebond/core";

// Transform PDF boxes to screen coordinates
const screenBoxes = transformBoundingBoxes(pdfBoxes, transformer);

// Hit test: find box at point
const hitBox = hitTestBoundingBoxes(screenBoxes, { x, y });

// Find all boxes at point
const allHitBoxes = findAllBoxesAtPoint(screenBoxes, { x, y });
```

---

## Virtual Scrolling

### VirtualScroller

```typescript
import { createVirtualScroller, VirtualScroller } from "@dvvebond/core";

const scroller = createVirtualScroller(container, {
  totalPages: number,
  pageHeight: number,
  pageGap: number,
  overscan: number,
});

// Events
scroller.on("visibleRangeChange", ({ startPage, endPage }) => {});
scroller.on("scroll", ({ scrollTop, scrollLeft }) => {});

// Methods
scroller.scrollToPage(pageNumber);
scroller.getVisibleRange();
scroller.setTotalPages(count);
```

### ViewportManager

Manages page rendering based on viewport visibility.

```typescript
import { createViewportManager, ViewportManager } from "@dvvebond/core";

const manager = createViewportManager({
  pageSource: PageSource,
  scroller: VirtualScroller,
  renderer: BaseRenderer,
});

// Events
manager.on("pageRender", ({ pageNumber, element }) => {});
manager.on("pageUnload", ({ pageNumber }) => {});

// State
const state = manager.getPageState(pageNumber);
```

---

## PDF.js Integration

### Initialization

```typescript
import { initializePDFJS, isPDFJSInitialized, getPDFJS } from "@dvvebond/core";

// Initialize (call once at app startup)
await initializePDFJS(options?: PDFJSWrapperOptions);

// Check status
if (isPDFJSInitialized()) {
  const pdfjs = getPDFJS();
}
```

### Document Loading

```typescript
import { loadPDFJSDocument, loadPDFJSDocumentFromUrl, closePDFJSDocument } from "@dvvebond/core";

// From bytes
const doc = await loadPDFJSDocument(bytes, options);

// From URL
const doc = await loadPDFJSDocumentFromUrl(url, options);

// Close when done
closePDFJSDocument(doc);
```

### Page Operations

```typescript
import {
  getPDFJSPage,
  getPDFJSPageCount,
  createPDFJSPageViewport,
  getPDFJSTextContent,
} from "@dvvebond/core";

const page = await getPDFJSPage(doc, pageNumber);
const pageCount = getPDFJSPageCount(doc);
const viewport = createPDFJSPageViewport(page, scale, rotation);
const textContent = await getPDFJSTextContent(page);
```

### PDFJSRenderer

```typescript
import { createPDFJSRenderer, PDFJSRenderer } from "@dvvebond/core";

const renderer = createPDFJSRenderer(canvas, {
  scale: number,
  enableTextLayer: boolean,
});

await renderer.render(page);
renderer.cancel();
```

### PDFJSSearchEngine

```typescript
import { createPDFJSSearchEngine, searchPDFJSDocument } from "@dvvebond/core";

// Quick search
const results = await searchPDFJSDocument(doc, query, options);

// Engine for ongoing search
const engine = createPDFJSSearchEngine(doc);
const results = await engine.search(query);
```

---

## Renderers

### CanvasRenderer

```typescript
import { createCanvasRenderer, CanvasRenderer } from "@dvvebond/core";

const renderer = createCanvasRenderer(canvas, {
  scale: number,
  background: string,
});

await renderer.render(page);
```

### SVGRenderer

```typescript
import { createSVGRenderer, SVGRenderer } from "@dvvebond/core";

const renderer = createSVGRenderer(container, {
  scale: number,
});

await renderer.render(page);
```

### TextLayerBuilder

```typescript
import { createTextLayerBuilder, TextLayerBuilder } from "@dvvebond/core";

const builder = createTextLayerBuilder(container, {
  scale: number,
  enhanceTextSelection: boolean,
});

await builder.render(page);
```

---

## UI Components

### UIStateManager

```typescript
import { createUIStateManager, UIStateManager } from "@dvvebond/core";

const manager = createUIStateManager(options);

manager.on("stateChange", (state: UIState) => {});

manager.setCurrentPage(page);
manager.setScale(scale);
manager.setZoomMode(mode);
```

### ToolbarController

```typescript
import { createToolbarController, ToolbarController } from "@dvvebond/core";

const toolbar = createToolbarController({
  container: element,
  stateManager: UIStateManager,
});

toolbar.on("action", ({ type, payload }) => {});
```

### OverlayManager

```typescript
import { createOverlayManager, OverlayManager } from "@dvvebond/core";

const overlays = createOverlayManager({
  container: element,
});

overlays.show("search", searchOverlayConfig);
overlays.hide("search");
```

---

## Types

All types are exported and can be imported for TypeScript usage:

```typescript
import type {
  // PDF types
  LoadOptions,
  SaveOptions,
  Rectangle,

  // React types
  ReactPDFViewerProps,
  ReactPDFViewerRef,
  PDFViewerState,

  // Text types
  BoundingBox,
  TextPage,
  Character,
  Word,
  Line,
  Paragraph,

  // Search types
  SearchResult,
  SearchState,
  SearchOptions,

  // Bounding box types
  OverlayBoundingBox,
  BoundingBoxVisibility,
  BoundingBoxType,

  // Coordinate types
  Point2D,
  Rect2D,
  CoordinateTransformerOptions,

  // Viewport types
  ViewportBounds,
  VisibleRange,
  PageLayout,

  // Renderer types
  RenderResult,
  RenderTask,
  Viewport,
} from "@dvvebond/core";
```
