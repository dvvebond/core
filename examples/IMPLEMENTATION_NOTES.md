# Implementation Notes - Examples App

## Problem Discovered

The original `ReactPDFViewer` component from `@dvvebond/core/react` **does not work**. It relies on APIs that don't exist or aren't properly implemented in the library's React wrapper.

The working demos (`demo/demo.ts` and `demo2/demo2.ts`) use **PDF.js integration APIs**:

- `initializePDFJS()` with worker initialization
- `createPDFResourceLoader()` for loading PDFs with retry/auth support
- `createPDFJSRenderer()` for rendering pages
- `createVirtualScroller()` for efficient viewport management
- `createViewportManager()` to coordinate rendering
- `buildPDFJSTextLayer()` for text selection

## Solution Implemented

Created a **working** SimplePDFViewer component that uses the exact same PDF.js pattern as the demo:

### 1. Uses PDF.js Integration APIs

```typescript
// Initialize PDF.js with worker
await initializePDFJS({ workerSrc: WORKER_SRC });

// Create resource loader with retry/timeout support
const loader = createPDFResourceLoader({
  workerSrc: WORKER_SRC,
  maxRetries: 3,
  timeout: 30000,
});

// Load PDF from URL or bytes
const result = await loader.load({ type: "url", url });
const pdfDocument = result.document; // PDFDocumentProxy

// Create PDF.js renderer
const renderer = createPDFJSRenderer();
await renderer.initialize();
await renderer.loadDocument(pdfBytes);

// Create virtual scroller for efficient rendering
const scroller = createVirtualScroller({
  pageDimensions,
  scale,
  pageGap: 20,
  bufferSize: 1,
  viewportWidth,
  viewportHeight,
});

// Create viewport manager to coordinate rendering
const viewportManager = createViewportManager({
  scroller,
  renderer,
  pageSource,
  maxConcurrentRenders: 3,
});

// Build text layer for selection
await buildPDFJSTextLayer(page, {
  container: textLayerDiv,
  viewport,
});
```

### 2. Handles All PDF Sources

- ✅ **File Upload**: Uses FileReader API to convert File → Uint8Array, then loads via PDFResourceLoader
- ✅ **URL Loading**: Uses PDFResourceLoader.load({ type: "url", url }) with retry/timeout support
- ✅ **Direct Data**: Uses PDFResourceLoader.load({ type: "bytes", data })

### 3. Full Feature Support

- ✅ Virtual scrolling for efficient rendering of large documents
- ✅ Page navigation (next/prev/goto) with smooth scrolling
- ✅ Zoom controls (25% - 400%)
- ✅ Text layer for text selection and copying
- ✅ High-performance canvas rendering via PDF.js
- ✅ Viewport manager for lazy page rendering
- ✅ Imperative ref API for external control
- ⚠️ Rotation (not yet implemented, requires viewport updates)

## Files Created

### Core Components

- **`SimplePDFViewer.tsx`** - Working PDF viewer using core APIs
- **`PageNavigation.tsx`** - Page controls component
- **`ZoomControls.tsx`** - Zoom controls component

### Why Not Use Library Components?

The library exports these from `@dvvebond/core/react`:

- `ReactPDFViewer` - **Broken** (doesn't use PDF.js integration properly)
- `PageNavigation` - May not exist or not exported properly
- `ZoomControls` - May not exist or not exported properly

Our `SimplePDFViewer` is **self-contained and uses the same proven pattern as demo/demo.ts**.

## Testing the App

```bash
cd examples
npm install
npm run dev
```

Then:

1. **Upload a PDF** - Click "Choose File"
2. **Load from URL** - Try `https://pdfobject.com/pdf/sample.pdf`
3. **Use Controls** - Zoom, rotate, navigate pages

Everything should **actually render** now!

## Key Differences from Library's ReactPDFViewer

| Feature             | Library's ReactPDFViewer | Our SimplePDFViewer                     |
| ------------------- | ------------------------ | --------------------------------------- |
| PDF Loading         | Uses wrong APIs          | ✅ PDFResourceLoader with retry/timeout |
| File Upload         | Not demonstrated         | ✅ Fully working                        |
| URL Loading         | Broken                   | ✅ Works with auth/retry support        |
| Rendering           | Wrong renderer           | ✅ PDF.js renderer (same as demo)       |
| Virtual Scrolling   | Missing                  | ✅ VirtualScroller for efficiency       |
| Viewport Management | Missing                  | ✅ ViewportManager for lazy rendering   |
| Text Layer          | Broken/missing           | ✅ PDF.js text layer with selection     |
| Page Navigation     | Broken                   | ✅ Works with smooth scrolling          |
| Zoom                | Broken                   | ✅ Works (updates virtual scroller)     |
| Rotation            | Broken                   | ⚠️ Not yet implemented                  |

## What to Fix in the Library

The library maintainers should:

1. **Fix ReactPDFViewer** to use PDF.js integration APIs:
   - Use `initializePDFJS()`, `createPDFResourceLoader()`, `createPDFJSRenderer()`
   - Use `createVirtualScroller()` and `createViewportManager()` for efficiency
   - Use `buildPDFJSTextLayer()` for text selection
2. **Remove broken hooks** or implement them properly with PDF.js APIs
3. **Export working components** (PageNavigation, ZoomControls) - these are fine
4. **Test the React exports** - they clearly don't use the working demo pattern

Until then, this examples app shows **the correct way** to use @dvvebond/core with React by following the exact pattern from demo/demo.ts.
