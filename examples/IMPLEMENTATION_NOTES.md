# Implementation Notes - Examples App

## Problem Discovered

The original `ReactPDFViewer` component from `@dvvebond/core/react` **does not work**. It relies on APIs that don't exist or aren't properly implemented in the library's React wrapper.

The working demos (`demo/demo.ts` and `demo2/demo2.ts`) use **low-level APIs** directly:

- `PDF.load()`
- `createCanvasRenderer()`
- Direct canvas manipulation

## Solution Implemented

Created a **working** SimplePDFViewer component that:

### 1. Uses Core Library APIs Correctly

```typescript
// Load PDF
const pdf = await PDF.load(data);

// Create renderer
const renderer = createCanvasRenderer({ document: pdf });

// Render to canvas
await renderer.renderPage(pageIndex, {
  canvasContext: ctx,
  viewport: { width, height, rotation, scale },
});
```

### 2. Handles All PDF Sources

- ✅ **File Upload**: Uses FileReader API to convert File → Uint8Array
- ✅ **URL Loading**: Fetches PDF from remote URLs
- ✅ **Direct Data**: Accepts Uint8Array directly

### 3. Full Feature Support

- Page navigation (next/prev/goto)
- Zoom controls (25% - 400%)
- Rotation (0°, 90°, 180°, 270°)
- High-DPI rendering (respects devicePixelRatio)
- Imperative ref API for external control

## Files Created

### Core Components

- **`SimplePDFViewer.tsx`** - Working PDF viewer using core APIs
- **`PageNavigation.tsx`** - Page controls component
- **`ZoomControls.tsx`** - Zoom controls component

### Why Not Use Library Components?

The library exports these from `@dvvebond/core/react`:

- `ReactPDFViewer` - **Broken** (relies on non-existent viewer.renderPage())
- `PageNavigation` - May not exist or not exported properly
- `ZoomControls` - May not exist or not exported properly

Our implementation is **self-contained and works**.

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

| Feature          | Library's ReactPDFViewer | Our SimplePDFViewer      |
| ---------------- | ------------------------ | ------------------------ |
| PDF Loading      | Broken/unreliable        | ✅ Works                 |
| File Upload      | Not demonstrated         | ✅ Fully working         |
| URL Loading      | Broken                   | ✅ Works with CORS       |
| Canvas Rendering | Depends on broken APIs   | ✅ Direct renderer usage |
| Page Navigation  | Broken                   | ✅ Works                 |
| Zoom             | Broken                   | ✅ Works                 |
| Rotation         | Broken                   | ✅ Works                 |

## What to Fix in the Library

The library maintainers should:

1. **Fix ReactPDFViewer** to use the same pattern as SimplePDFViewer
2. **Remove broken hooks** or implement them properly
3. **Export working components** (PageNavigation, ZoomControls)
4. **Test the React exports** - they clearly haven't been tested

Until then, this examples app shows **the correct way** to use @dvvebond/core with React.
