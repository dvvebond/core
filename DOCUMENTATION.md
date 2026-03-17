# @dvvebond/core - Complete Documentation

> **The only documentation you'll ever need for @dvvebond/core**

A comprehensive, production-ready PDF library for TypeScript with React components, PDF.js integration, Azure Document Intelligence support, and enterprise features.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [PDF.js Integration (Recommended)](#pdfjs-integration-recommended)
- [React Components](#react-components)
- [PDF Operations](#pdf-operations)
- [Text Extraction & Search](#text-extraction--search)
- [Annotations & Markup](#annotations--markup)
- [Forms](#forms)
- [Security & Encryption](#security--encryption)
- [Digital Signatures](#digital-signatures)
- [Azure Document Intelligence](#azure-document-intelligence)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install @dvvebond/core
# or
yarn add @dvvebond/core
# or
bun add @dvvebond/core
```

### Peer Dependencies

For React components:

```bash
npm install react react-dom
```

---

## Quick Start

### Loading and Viewing a PDF (React)

```typescript
import { SimplePDFViewer } from "@dvvebond/core/examples";
import { useState } from "react";

function MyApp() {
  const [pdfUrl, setPdfUrl] = useState("https://example.com/document.pdf");

  return (
    <SimplePDFViewer
      url={pdfUrl}
      initialScale={1.0}
      onDocumentLoad={(pdf) => console.log(`Loaded ${pdf.numPages} pages`)}
      onDocumentError={(error) => console.error(error)}
      onPageChange={(page) => console.log(`Current page: ${page}`)}
    />
  );
}
```

### Loading a PDF (Node.js/Bun)

```typescript
import { PDF } from "@dvvebond/core";
import { readFileSync } from "fs";

// Load from file
const bytes = readFileSync("document.pdf");
const pdf = await PDF.load(bytes);

console.log(`Pages: ${pdf.getPageCount()}`);
console.log(`Title: ${pdf.getTitle()}`);

// Save modified PDF
const modifiedBytes = await pdf.save();
```

---

## Core Concepts

### Architecture Overview

@dvvebond/core provides **two rendering approaches**:

1. **PDF.js Integration** (Recommended) - High-performance rendering with virtual scrolling
2. **Core Library API** - Direct PDF manipulation and generation

### When to Use What

| Use Case                    | Recommended Approach      |
| --------------------------- | ------------------------- |
| **Viewing PDFs in browser** | PDF.js Integration        |
| **Creating/editing PDFs**   | Core Library API          |
| **Text extraction**         | Either (PDF.js is faster) |
| **Form filling**            | Core Library API          |
| **Digital signatures**      | Core Library API          |
| **Annotations**             | Core Library API          |
| **React components**        | PDF.js Integration        |

---

## PDF.js Integration (Recommended)

The PDF.js integration provides the **proven, production-ready** rendering pipeline used in the demos.

### Why PDF.js Integration?

✅ **High Performance** - Virtual scrolling, lazy rendering
✅ **Battle-Tested** - Used by Firefox, millions of users
✅ **Text Selection** - Native text layer support
✅ **Production Ready** - Retry logic, error handling, auth support

### Basic Setup

```typescript
import {
  initializePDFJS,
  createPDFResourceLoader,
  createPDFJSRenderer,
  createVirtualScroller,
  createViewportManager,
  buildPDFJSTextLayer,
  type PDFDocumentProxy,
} from "@dvvebond/core";

// 1. Initialize PDF.js (once per application)
await initializePDFJS({
  workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs",
});

// 2. Create resource loader with retry/timeout
const loader = createPDFResourceLoader({
  workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs",
  maxRetries: 3,
  timeout: 30000,
  onProgress: (loaded, total) => {
    console.log(`Progress: ${loaded}/${total}`);
  },
});

// 3. Load PDF
const result = await loader.load({ type: "url", url: "https://example.com/doc.pdf" });
const pdfDocument: PDFDocumentProxy = result.document;
const pdfBytes: Uint8Array = result.bytes;

console.log(`Loaded ${pdfDocument.numPages} pages`);
```

### Complete Viewer Implementation

```typescript
// 1. Get page dimensions
const pageDimensions = [];
for (let i = 0; i < pdfDocument.numPages; i++) {
  const page = await pdfDocument.getPage(i + 1); // PDF.js uses 1-based indexing
  const viewport = page.getViewport({ scale: 1 });
  pageDimensions.push({
    width: viewport.width,
    height: viewport.height,
  });
}

// 2. Create virtual scroller for efficient rendering
const scroller = createVirtualScroller({
  pageDimensions,
  scale: 1.0,
  pageGap: 20, // Gap between pages in pixels
  bufferSize: 1, // Number of pages to render outside viewport
  viewportWidth: containerElement.clientWidth,
  viewportHeight: containerElement.clientHeight,
});

// 3. Create PDF.js renderer
const renderer = createPDFJSRenderer();
await renderer.initialize();
await renderer.loadDocument(pdfBytes);

// 4. Create page source
const pageSource = {
  async getPage(pageIndex: number) {
    return pdfDocument.getPage(pageIndex + 1);
  },
  getPageCount() {
    return pdfDocument.numPages;
  },
  async getPageDimensions(pageIndex: number) {
    const page = await pdfDocument.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  },
  getPageRotation(_pageIndex: number) {
    return 0;
  },
};

// 5. Create viewport manager
const viewportManager = createViewportManager({
  scroller,
  renderer,
  pageSource,
  maxConcurrentRenders: 3, // Render up to 3 pages simultaneously
});

// 6. Handle page renders
viewportManager.addEventListener("pageRendered", async event => {
  const canvas = event.element as HTMLCanvasElement;
  const pageIndex = event.pageIndex;

  // Position the canvas
  const layout = scroller.getPageLayout(pageIndex);
  canvas.style.position = "absolute";
  canvas.style.left = `${layout.left}px`;
  canvas.style.top = `${layout.top}px`;

  // Add to container
  containerElement.appendChild(canvas);

  // Add text layer for selection
  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1.0 });

  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "text-layer";
  textLayerDiv.style.position = "absolute";
  textLayerDiv.style.left = "0";
  textLayerDiv.style.top = "0";

  await buildPDFJSTextLayer(page, {
    container: textLayerDiv,
    viewport: viewport,
  });

  containerElement.appendChild(textLayerDiv);
});

// 7. Handle scroll events
containerElement.addEventListener("scroll", () => {
  scroller.scrollTo(containerElement.scrollLeft, containerElement.scrollTop);
});

// 8. Initialize to trigger rendering
await viewportManager.initialize();
```

### Loading PDFs from Different Sources

```typescript
// From URL
const result = await loader.load({
  type: "url",
  url: "https://example.com/document.pdf",
});

// From File (browser)
const file = event.target.files[0];
const arrayBuffer = await file.arrayBuffer();
const bytes = new Uint8Array(arrayBuffer);
const result = await loader.load({
  type: "bytes",
  data: bytes,
});

// From Uint8Array
const result = await loader.load({
  type: "bytes",
  data: pdfBytesArray,
});
```

### Zoom Controls

```typescript
let currentScale = 1.0;

function setZoom(newScale: number) {
  currentScale = Math.max(0.25, Math.min(4, newScale));

  // Update virtual scroller
  scroller.setScale(currentScale);

  // Update viewport size if container changed
  scroller.setViewportSize(containerElement.clientWidth, containerElement.clientHeight);

  // Update content container height
  contentContainer.style.height = `${scroller.totalHeight}px`;
}

function zoomIn() {
  setZoom(currentScale * 1.25);
}

function zoomOut() {
  setZoom(currentScale / 1.25);
}
```

### Page Navigation

```typescript
function goToPage(pageNumber: number) {
  const layout = scroller.getPageLayout(pageNumber - 1);
  if (layout) {
    containerElement.scrollTo({
      top: layout.top,
      behavior: "smooth",
    });
  }
}

// Track current page
scroller.addEventListener("visibleRangeChange", event => {
  if (event.visibleRange) {
    const currentPage = event.visibleRange.startIndex + 1;
    console.log(`Current page: ${currentPage}`);
  }
});
```

### Search in PDF

```typescript
import { createPDFJSSearchEngine } from "@dvvebond/core";

const searchEngine = createPDFJSSearchEngine(pdfDocument);

// Search for text
const results = await searchEngine.search("search term", {
  caseSensitive: false,
  wholeWords: false,
  matchDiacritics: false,
});

console.log(`Found ${results.length} matches`);

results.forEach(result => {
  console.log(`Page ${result.pageIndex + 1}: "${result.text}"`);
  console.log(`Position: ${result.boundingBox}`);
});
```

---

## React Components

### SimplePDFViewer

A production-ready PDF viewer component using PDF.js integration.

```typescript
import { SimplePDFViewer, SimplePDFViewerRef } from "@dvvebond/core/examples";
import { useRef, useState } from "react";

function MyViewer() {
  const viewerRef = useRef<SimplePDFViewerRef>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.0);

  return (
    <div>
      {/* Controls */}
      <div>
        <button onClick={() => viewerRef.current?.previousPage()}>Previous</button>
        <span>{currentPage} / {pageCount}</span>
        <button onClick={() => viewerRef.current?.nextPage()}>Next</button>

        <button onClick={() => viewerRef.current?.zoomOut()}>-</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => viewerRef.current?.zoomIn()}>+</button>
      </div>

      {/* Viewer */}
      <SimplePDFViewer
        ref={viewerRef}
        url="https://example.com/document.pdf"
        initialScale={1.0}
        onDocumentLoad={(pdf) => setPageCount(pdf.numPages)}
        onPageChange={setCurrentPage}
        onScaleChange={setScale}
      />
    </div>
  );
}
```

#### Props

| Prop              | Type                              | Description                       |
| ----------------- | --------------------------------- | --------------------------------- |
| `url`             | `string`                          | URL to load PDF from              |
| `data`            | `Uint8Array`                      | PDF data as bytes                 |
| `initialScale`    | `number`                          | Initial zoom level (default: 1.0) |
| `onDocumentLoad`  | `(pdf: PDFDocumentProxy) => void` | Called when PDF loads             |
| `onDocumentError` | `(error: Error) => void`          | Called on load error              |
| `onPageChange`    | `(page: number) => void`          | Called when page changes          |
| `onScaleChange`   | `(scale: number) => void`         | Called when zoom changes          |

#### Ref Methods

```typescript
interface SimplePDFViewerRef {
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
  refresh: () => void;
}
```

### PageNavigation Component

```typescript
import { PageNavigation } from "@dvvebond/core/examples";

<PageNavigation
  currentPage={currentPage}
  pageCount={pageCount}
  onPageChange={(page) => viewerRef.current?.goToPage(page)}
/>
```

### ZoomControls Component

```typescript
import { ZoomControls } from "@dvvebond/core/examples";

<ZoomControls
  scale={scale}
  onZoomIn={() => viewerRef.current?.zoomIn()}
  onZoomOut={() => viewerRef.current?.zoomOut()}
  onScaleChange={(newScale) => viewerRef.current?.setScale(newScale)}
/>
```

### File Upload Example

```typescript
function PDFUploader() {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      setPdfData(new Uint8Array(arrayBuffer));
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <input type="file" accept=".pdf" onChange={handleFileUpload} />
      {pdfData && <SimplePDFViewer data={pdfData} />}
    </div>
  );
}
```

---

## PDF Operations

### Creating a New PDF

```typescript
import { PDF, StandardFonts, rgb } from "@dvvebond/core";

// Create new PDF
const pdf = await PDF.create();

// Add a page
const page = pdf.addPage([600, 800]); // width, height in points

// Draw text
page.drawText("Hello World!", {
  x: 50,
  y: 750,
  size: 24,
  font: await pdf.embedFont(StandardFonts.Helvetica),
  color: rgb(0, 0, 0),
});

// Draw rectangle
page.drawRectangle({
  x: 50,
  y: 650,
  width: 200,
  height: 100,
  borderColor: rgb(0, 0, 1),
  borderWidth: 2,
  color: rgb(0.9, 0.9, 1),
});

// Save
const bytes = await pdf.save();
```

### Loading and Modifying PDFs

```typescript
import { PDF } from "@dvvebond/core";
import { readFileSync, writeFileSync } from "fs";

// Load existing PDF
const existingBytes = readFileSync("input.pdf");
const pdf = await PDF.load(existingBytes);

// Get page
const page = pdf.getPage(0);

// Add text to existing page
page.drawText("Added Text", {
  x: 100,
  y: 100,
  size: 12,
});

// Save modified PDF
const modifiedBytes = await pdf.save();
writeFileSync("output.pdf", modifiedBytes);
```

### Page Operations

```typescript
// Get page count
const count = pdf.getPageCount();

// Get specific page
const firstPage = pdf.getPage(0);

// Get page dimensions
const { width, height } = firstPage;

// Add new page
const newPage = pdf.addPage([612, 792]); // Letter size

// Insert page at position
const insertedPage = pdf.insertPage(1, [600, 800]);

// Remove page
pdf.removePage(2);

// Copy pages from another PDF
const otherPdf = await PDF.load(otherBytes);
const copiedPages = await pdf.copyPages(otherPdf, [0, 1, 2]);
copiedPages.forEach(page => pdf.addPage(page));
```

### Drawing Operations

```typescript
const page = pdf.getPage(0);

// Text
page.drawText("Sample Text", {
  x: 50,
  y: 700,
  size: 14,
  font: await pdf.embedFont(StandardFonts.TimesRoman),
  color: rgb(0, 0, 0),
  rotate: degrees(0),
  opacity: 1.0,
});

// Line
page.drawLine({
  start: { x: 50, y: 650 },
  end: { x: 550, y: 650 },
  thickness: 2,
  color: rgb(1, 0, 0),
  opacity: 0.75,
});

// Rectangle
page.drawRectangle({
  x: 50,
  y: 550,
  width: 200,
  height: 100,
  borderColor: rgb(0, 0, 1),
  borderWidth: 3,
  color: rgb(0.8, 0.8, 1),
  opacity: 0.5,
  rotate: degrees(0),
});

// Circle
page.drawCircle({
  x: 150,
  y: 450,
  size: 50,
  borderColor: rgb(0, 1, 0),
  borderWidth: 2,
  color: rgb(0.8, 1, 0.8),
  opacity: 0.75,
});

// Ellipse
page.drawEllipse({
  x: 150,
  y: 350,
  xScale: 75,
  yScale: 50,
  borderColor: rgb(1, 0, 1),
  borderWidth: 2,
  color: rgb(1, 0.8, 1),
});

// SVG Path
page.drawSvgPath("M 0,0 L 100,0 L 100,100 L 0,100 Z", {
  x: 50,
  y: 250,
  scale: 1,
  borderColor: rgb(0, 0, 0),
  color: rgb(1, 1, 0),
});
```

### Images

```typescript
import { readFileSync } from "fs";

// Embed PNG
const pngBytes = readFileSync("image.png");
const pngImage = await pdf.embedPng(pngBytes);

page.drawImage(pngImage, {
  x: 50,
  y: 500,
  width: 200,
  height: 150,
  rotate: degrees(0),
  opacity: 1.0,
});

// Embed JPG
const jpgBytes = readFileSync("photo.jpg");
const jpgImage = await pdf.embedJpg(jpgBytes);

page.drawImage(jpgImage, {
  x: 50,
  y: 300,
  width: 150,
  height: 100,
});

// Get image dimensions
const dims = pngImage.scale(0.5);
page.drawImage(pngImage, {
  x: 50,
  y: 150,
  width: dims.width,
  height: dims.height,
});
```

### Fonts

```typescript
import { StandardFonts } from "@dvvebond/core";

// Standard fonts (no embedding needed)
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
const times = await pdf.embedFont(StandardFonts.TimesRoman);
const courier = await pdf.embedFont(StandardFonts.Courier);

// Custom fonts
const fontBytes = readFileSync("CustomFont.ttf");
const customFont = await pdf.embedFont(fontBytes);

// Use font
page.drawText("Custom Font", {
  x: 50,
  y: 100,
  size: 24,
  font: customFont,
});

// Measure text
const textWidth = customFont.widthOfTextAtSize("Sample", 12);
const textHeight = customFont.heightAtSize(12);
```

---

## Text Extraction & Search

### Extract All Text

```typescript
import { TextExtractor } from "@dvvebond/core";

const pdf = await PDF.load(pdfBytes);
const extractor = new TextExtractor();

// Extract from all pages
const allText = [];
for (let i = 0; i < pdf.getPageCount(); i++) {
  const page = pdf.getPage(i);
  const text = await extractor.extractText(page);
  allText.push(text);
}

console.log(allText.join("\n\n"));
```

### Extract with Bounding Boxes

```typescript
import { TextExtractor } from "@dvvebond/core";

const extractor = new TextExtractor();
const page = pdf.getPage(0);

// Extract text with positions
const result = await extractor.extract(page);

result.items.forEach(item => {
  console.log(`Text: "${item.text}"`);
  console.log(`Position: (${item.x}, ${item.y})`);
  console.log(`Size: ${item.width} x ${item.height}`);
  console.log(`Font: ${item.fontName}, Size: ${item.fontSize}`);
});
```

### Search Text

```typescript
import { searchPage, searchPages } from "@dvvebond/core";

// Search single page
const pageResults = await searchPage(page, "search term", {
  caseSensitive: false,
  wholeWords: false,
});

pageResults.forEach(match => {
  console.log(`Found at: ${match.boundingBox}`);
  console.log(`Text: "${match.text}"`);
});

// Search all pages
const allResults = await searchPages(pdf, "search term", {
  caseSensitive: true,
  wholeWords: true,
});

allResults.forEach(result => {
  console.log(`Page ${result.pageIndex}: ${result.matches.length} matches`);
});
```

### Hierarchical Text Extraction

```typescript
import { createHierarchicalTextExtractor } from "@dvvebond/core";

const extractor = createHierarchicalTextExtractor();

// Extract with hierarchy (characters → words → lines → paragraphs)
const pageText = await extractor.extractPage(pdf, 0);

console.log(`Page dimensions: ${pageText.width} x ${pageText.height}`);

pageText.paragraphs.forEach((paragraph, i) => {
  console.log(`\nParagraph ${i}:`);
  console.log(`  Lines: ${paragraph.lines.length}`);
  console.log(`  Text: ${paragraph.text}`);
  console.log(`  BBox: ${JSON.stringify(paragraph.boundingBox)}`);

  paragraph.lines.forEach(line => {
    console.log(`    Line: "${line.text}"`);
  });
});
```

---

## Annotations & Markup

### Adding Annotations

```typescript
import { rgb } from "@dvvebond/core";

const page = pdf.getPage(0);

// Text annotation (sticky note)
page.addTextAnnotation({
  rect: { x: 100, y: 700, width: 20, height: 20 },
  contents: "This is a note",
  color: rgb(1, 1, 0),
  icon: "Note", // Note, Comment, Help, Insert, Key, NewParagraph, Paragraph
});

// Highlight annotation
page.addHighlightAnnotation({
  rect: { x: 50, y: 650, width: 200, height: 20 },
  color: rgb(1, 1, 0),
  opacity: 0.5,
  contents: "Important text",
});

// Link annotation
page.addLinkAnnotation({
  rect: { x: 50, y: 600, width: 100, height: 20 },
  uri: "https://example.com",
  borderColor: rgb(0, 0, 1),
  borderWidth: 1,
});

// Ink annotation (freehand drawing)
page.addInkAnnotation({
  inkLists: [
    [
      { x: 50, y: 550 },
      { x: 100, y: 500 },
      { x: 150, y: 550 },
    ],
  ],
  color: rgb(1, 0, 0),
  borderWidth: 2,
  contents: "Drawn path",
});

// Square annotation
page.addSquareAnnotation({
  rect: { x: 50, y: 450, width: 100, height: 100 },
  borderColor: rgb(0, 0, 1),
  color: rgb(0.8, 0.8, 1),
  borderWidth: 2,
  contents: "Rectangle annotation",
});

// Circle annotation
page.addCircleAnnotation({
  rect: { x: 200, y: 450, width: 100, height: 100 },
  borderColor: rgb(0, 1, 0),
  color: rgb(0.8, 1, 0.8),
  borderWidth: 2,
});

// Free text annotation
page.addFreeTextAnnotation({
  rect: { x: 50, y: 350, width: 200, height: 50 },
  contents: "Free text annotation",
  color: rgb(1, 1, 1),
  fontSize: 14,
  fontColor: rgb(0, 0, 0),
  borderColor: rgb(0, 0, 0),
  borderWidth: 1,
});

// Stamp annotation
page.addStampAnnotation({
  rect: { x: 50, y: 250, width: 150, height: 50 },
  stampType: "Approved", // Approved, Experimental, NotApproved, AsIs, Expired, NotForPublicRelease, Confidential, Final, Sold, Departmental, ForComment, TopSecret, ForPublicRelease, Draft
});
```

### Getting Annotations

```typescript
const annotations = page.getAnnotations();

annotations.forEach(annotation => {
  console.log(`Type: ${annotation.getType()}`);
  console.log(`Rect: ${annotation.getRect()}`);
  console.log(`Contents: ${annotation.getContents()}`);
});
```

### Removing Annotations

```typescript
// Remove all annotations from page
page.removeAnnotations();

// Remove specific annotation
const annotations = page.getAnnotations();
page.removeAnnotation(annotations[0]);
```

### Flattening Annotations

```typescript
// Flatten all annotations (make them part of page content)
await pdf.flattenAllAnnotations();

// Flatten specific page
await page.flattenAnnotations();
```

---

## Forms

### Reading Form Fields

```typescript
const form = pdf.getForm();

// Get all fields
const fields = form.getFields();

fields.forEach(field => {
  console.log(`Name: ${field.getName()}`);
  console.log(`Type: ${field.getType()}`); // text, checkbox, radio, dropdown, listbox
  console.log(`Value: ${field.getValue()}`);
});

// Get specific field
const nameField = form.getTextField("name");
console.log(`Current value: ${nameField.getValue()}`);
```

### Filling Form Fields

```typescript
const form = pdf.getForm();

// Text field
const textField = form.getTextField("firstName");
textField.setText("John");
textField.setFontSize(12);

// Checkbox
const checkbox = form.getCheckBox("agree");
checkbox.check(); // or checkbox.uncheck()

// Radio button
const radio = form.getRadioGroup("gender");
radio.select("male");

// Dropdown
const dropdown = form.getDropdown("country");
dropdown.select("USA");

// Multi-select listbox
const listbox = form.getListBox("interests");
listbox.select(["sports", "music"]);
```

### Creating Form Fields

```typescript
const form = pdf.getForm();
const page = pdf.getPage(0);

// Text field
const textField = form.createTextField("email");
textField.addToPage(page, {
  x: 50,
  y: 700,
  width: 200,
  height: 30,
});
textField.setText("user@example.com");
textField.setFontSize(12);

// Checkbox
const checkbox = form.createCheckBox("subscribe");
checkbox.addToPage(page, {
  x: 50,
  y: 650,
  width: 20,
  height: 20,
});

// Radio group
const radioGroup = form.createRadioGroup("plan");
radioGroup.addOptionToPage("basic", page, {
  x: 50,
  y: 600,
  width: 20,
  height: 20,
});
radioGroup.addOptionToPage("premium", page, {
  x: 50,
  y: 570,
  width: 20,
  height: 20,
});

// Dropdown
const dropdown = form.createDropdown("state");
dropdown.addToPage(page, {
  x: 50,
  y: 520,
  width: 150,
  height: 30,
});
dropdown.addOptions(["CA", "NY", "TX", "FL"]);
dropdown.select("CA");
```

### Flattening Forms

```typescript
// Flatten all form fields (make them non-editable)
await pdf.flattenForm();
```

---

## Security & Encryption

### Check Security

```typescript
const pdf = await PDF.load(pdfBytes);

// Check if encrypted
if (pdf.isEncrypted()) {
  console.log("PDF is encrypted");

  // Try to unlock with password
  const unlocked = await pdf.unlock("password");
  if (!unlocked) {
    console.log("Failed to unlock PDF");
  }
}

// Get permissions
const permissions = pdf.getPermissions();
console.log(`Can print: ${permissions.printing}`);
console.log(`Can modify: ${permissions.modifying}`);
console.log(`Can copy: ${permissions.copying}`);
console.log(`Can annotate: ${permissions.annotating}`);
```

### Encrypt PDF

```typescript
import { PDF, PermissionOptions } from "@dvvebond/core";

const pdf = await PDF.load(pdfBytes);

// Set passwords and permissions
await pdf.encrypt({
  userPassword: "user123", // Required to open PDF
  ownerPassword: "owner456", // Required to modify permissions
  permissions: {
    printing: "highResolution", // "none", "lowResolution", "highResolution"
    modifying: false,
    copying: false,
    annotating: true,
    fillingForms: true,
    contentAccessibility: true,
    documentAssembly: false,
  },
  algorithm: "V4", // V1, V2, V4, V5
});

const encryptedBytes = await pdf.save();
```

### Remove Encryption

```typescript
const pdf = await PDF.load(encryptedBytes, { password: "owner456" });

// Remove encryption
await pdf.removeEncryption();

const unencryptedBytes = await pdf.save();
```

---

## Digital Signatures

### Sign PDF

```typescript
import { P12Signer } from "@dvvebond/core";
import { readFileSync } from "fs";

// Load P12 certificate
const p12Bytes = readFileSync("certificate.p12");
const signer = await P12Signer.load(p12Bytes, "certificate-password");

// Load PDF
const pdf = await PDF.load(pdfBytes);

// Sign
const signedBytes = await pdf.sign({
  signer,
  reason: "I approve this document",
  location: "New York, USA",
  contactInfo: "signer@example.com",
  signatureFieldName: "Signature1",
  appearance: {
    page: 0,
    x: 50,
    y: 700,
    width: 200,
    height: 100,
    showDate: true,
    showName: true,
    showReason: true,
  },
});

writeFileSync("signed.pdf", signedBytes);
```

### Verify Signature

```typescript
const pdf = await PDF.load(signedBytes);

const signatures = pdf.getSignatures();

for (const sig of signatures) {
  const isValid = await sig.verify();

  console.log(`Signature: ${sig.getName()}`);
  console.log(`Valid: ${isValid}`);
  console.log(`Signer: ${sig.getSignerName()}`);
  console.log(`Date: ${sig.getSignDate()}`);
  console.log(`Reason: ${sig.getReason()}`);
  console.log(`Location: ${sig.getLocation()}`);
}
```

### Timestamp Authority

```typescript
import { HttpTimestampAuthority } from "@dvvebond/core";

// Add timestamp to signature
const tsa = new HttpTimestampAuthority({
  url: "https://freetsa.org/tsr",
  username: "optional-username",
  password: "optional-password",
});

const signedBytes = await pdf.sign({
  signer,
  timestampAuthority: tsa,
  reason: "Timestamped signature",
});
```

---

## Azure Document Intelligence

### Extract with Azure DI

```typescript
import { AzureDocumentIntelligence } from "@dvvebond/core";

const client = new AzureDocumentIntelligence({
  endpoint: "https://your-resource.cognitiveservices.azure.com/",
  apiKey: "your-api-key",
});

// Analyze document
const result = await client.analyzeDocument(pdfBytes, {
  modelId: "prebuilt-read", // prebuilt-read, prebuilt-layout, prebuilt-document, etc.
});

// Get text with bounding boxes
result.pages.forEach((page, pageIndex) => {
  console.log(`\nPage ${pageIndex + 1}:`);

  page.lines.forEach(line => {
    console.log(`Text: "${line.content}"`);
    console.log(`BBox: [${line.boundingBox.join(", ")}]`);
  });
});

// Get tables
result.tables?.forEach((table, i) => {
  console.log(`\nTable ${i + 1}:`);
  console.log(`Rows: ${table.rowCount}, Columns: ${table.columnCount}`);

  table.cells.forEach(cell => {
    console.log(`[${cell.rowIndex}, ${cell.columnIndex}]: ${cell.content}`);
  });
});
```

### Map Azure DI to PDF Coordinates

```typescript
import { transformBoundingBoxes } from "@dvvebond/core";

// Azure DI returns coordinates in normalized space [0,1]
// Transform to PDF coordinates
const pdfBoundingBoxes = transformBoundingBoxes(azureResults.pages[0].lines, pageWidth, pageHeight);

// Now use these coordinates for highlighting in PDF
pdfBoundingBoxes.forEach(bbox => {
  page.addHighlightAnnotation({
    rect: bbox,
    color: rgb(1, 1, 0),
    opacity: 0.3,
  });
});
```

---

## Advanced Features

### Metadata

```typescript
// Get metadata
const title = pdf.getTitle();
const author = pdf.getAuthor();
const subject = pdf.getSubject();
const keywords = pdf.getKeywords();
const creator = pdf.getCreator();
const producer = pdf.getProducer();
const creationDate = pdf.getCreationDate();
const modificationDate = pdf.getModificationDate();

// Set metadata
pdf.setTitle("My Document");
pdf.setAuthor("John Doe");
pdf.setSubject("Annual Report");
pdf.setKeywords(["report", "2024", "finance"]);
pdf.setCreator("MyApp v1.0");
pdf.setProducer("@dvvebond/core");
pdf.setCreationDate(new Date());
pdf.setModificationDate(new Date());
```

### Attachments

```typescript
import { readFileSync } from "fs";

// Attach file to PDF
const attachmentBytes = readFileSync("data.xlsx");
await pdf.attach(attachmentBytes, "data.xlsx", {
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  description: "Sales data for 2024",
  creationDate: new Date(),
});

// Get attachments
const attachments = pdf.getAttachments();

attachments.forEach(attachment => {
  console.log(`Name: ${attachment.name}`);
  console.log(`Size: ${attachment.size} bytes`);
  console.log(`Type: ${attachment.mimeType}`);

  // Extract attachment
  const data = attachment.getData();
  writeFileSync(`extracted_${attachment.name}`, data);
});
```

### Merging PDFs

```typescript
import { PDF } from "@dvvebond/core";

// Create new PDF
const mergedPdf = await PDF.create();

// Load PDFs to merge
const pdf1 = await PDF.load(bytes1);
const pdf2 = await PDF.load(bytes2);
const pdf3 = await PDF.load(bytes3);

// Copy all pages
const pages1 = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
const pages2 = await mergedPdf.copyPages(pdf2, pdf2.getPageIndices());
const pages3 = await mergedPdf.copyPages(pdf3, pdf3.getPageIndices());

// Add pages
pages1.forEach(page => mergedPdf.addPage(page));
pages2.forEach(page => mergedPdf.addPage(page));
pages3.forEach(page => mergedPdf.addPage(page));

// Save
const mergedBytes = await mergedPdf.save();
```

### Splitting PDFs

```typescript
import { PDF } from "@dvvebond/core";

const pdf = await PDF.load(pdfBytes);

// Extract pages 0-4 into new PDF
const extractedPdf = await PDF.create();
const pagesToExtract = await extractedPdf.copyPages(pdf, [0, 1, 2, 3, 4]);
pagesToExtract.forEach(page => extractedPdf.addPage(page));

const extractedBytes = await extractedPdf.save();
```

### Page Rotation

```typescript
const page = pdf.getPage(0);

// Rotate page
page.setRotation(degrees(90)); // 0, 90, 180, 270

// Get rotation
const rotation = page.getRotation();
```

### Layers (Optional Content Groups)

```typescript
// Create layer
const layer = pdf.createLayer("Watermark");

// Add content to layer
page.drawText("DRAFT", {
  x: 200,
  y: 400,
  size: 72,
  font: helveticaBold,
  color: rgb(1, 0, 0),
  opacity: 0.3,
  layer: layer,
});

// Hide layer by default
layer.setVisibility(false);

// Get layers
const layers = pdf.getLayers();

layers.forEach(layer => {
  console.log(`Layer: ${layer.getName()}`);
  console.log(`Visible: ${layer.isVisible()}`);
});
```

### Compression

```typescript
// Save with compression
const compressedBytes = await pdf.save({
  objectCompression: true, // Compress PDF objects
  addDefaultPage: false,
  objectsPerTick: 50,
});

// Save without compression (larger file)
const uncompressedBytes = await pdf.save({
  objectCompression: false,
});
```

### Incremental Save

```typescript
// Save incrementally (preserves existing content, adds changes)
const incrementalBytes = await pdf.save({
  useObjectStreams: false,
  addDefaultPage: false,
});
```

---

## API Reference

### Core Classes

#### PDF

Main document class.

```typescript
class PDF {
  static async create(): Promise<PDF>;
  static async load(bytes: Uint8Array, options?: LoadOptions): Promise<PDF>;

  // Pages
  getPageCount(): number;
  getPage(index: number): PDFPage;
  getPages(): PDFPage[];
  addPage(dimensions?: [number, number]): PDFPage;
  insertPage(index: number, dimensions?: [number, number]): PDFPage;
  removePage(index: number): void;
  async copyPages(donor: PDF, indices: number[]): Promise<PDFEmbeddedPage[]>;

  // Metadata
  getTitle(): string | undefined;
  getAuthor(): string | undefined;
  setTitle(title: string): void;
  setAuthor(author: string): void;

  // Forms
  getForm(): PDFForm;
  hasForm(): boolean;

  // Security
  isEncrypted(): boolean;
  async encrypt(options: ProtectionOptions): Promise<void>;
  async removeEncryption(): Promise<void>;

  // Save
  async save(options?: SaveOptions): Promise<Uint8Array>;
}
```

#### PDFPage

Page class.

```typescript
class PDFPage {
  // Properties
  readonly width: number;
  readonly height: number;

  // Drawing
  drawText(text: string, options?: DrawTextOptions): void;
  drawRectangle(options: DrawRectangleOptions): void;
  drawCircle(options: DrawCircleOptions): void;
  drawEllipse(options: DrawEllipseOptions): void;
  drawLine(options: DrawLineOptions): void;
  drawSvgPath(path: string, options?: DrawSvgPathOptions): void;
  drawImage(image: PDFImage, options: DrawImageOptions): void;

  // Annotations
  addTextAnnotation(options: TextAnnotationOptions): void;
  addLinkAnnotation(options: LinkAnnotationOptions): void;
  addHighlightAnnotation(options: HighlightAnnotationOptions): void;
  getAnnotations(): PDFAnnotation[];

  // Rotation
  getRotation(): Degrees;
  setRotation(angle: Degrees): void;

  // Content
  getTextContent(): Promise<string>;
}
```

#### PDFForm

Form class.

```typescript
class PDFForm {
  // Fields
  getFields(): FormField[];
  getTextField(name: string): TextField;
  getCheckBox(name: string): CheckboxField;
  getRadioGroup(name: string): RadioField;
  getDropdown(name: string): DropdownField;
  getListBox(name: string): ListBoxField;

  // Create fields
  createTextField(name: string): TextField;
  createCheckBox(name: string): CheckboxField;
  createRadioGroup(name: string): RadioField;
  createDropdown(name: string): DropdownField;
  createListBox(name: string): ListBoxField;

  // Flatten
  async flatten(): Promise<void>;
}
```

### PDF.js Integration Types

```typescript
interface PDFDocumentProxy {
  numPages: number;
  fingerprints: [string, string | null];
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  getMetadata(): Promise<{ info: any; metadata: any }>;
  destroy(): Promise<void>;
}

interface PDFPageProxy {
  pageNumber: number;
  rotate: number;
  view: [number, number, number, number];
  getViewport(params: { scale: number; rotation?: number }): PageViewport;
  render(params: RenderParameters): RenderTask;
  getTextContent(): Promise<TextContent>;
  cleanup(): void;
}

interface PageViewport {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  transform: number[];
}

interface VirtualScroller {
  readonly totalWidth: number;
  readonly totalHeight: number;

  setScale(scale: number): void;
  setViewportSize(width: number, height: number): void;
  scrollTo(x: number, y: number): void;
  getPageLayout(pageIndex: number): PageLayout | null;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

interface ViewportManager {
  initialize(): Promise<void>;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}
```

### Color Helpers

```typescript
// RGB color (0-1 range)
function rgb(r: number, g: number, b: number): RGB;

// CMYK color (0-1 range)
function cmyk(c: number, m: number, y: number, k: number): CMYK;

// Grayscale (0-1 range)
function grayscale(gray: number): Grayscale;

// Predefined colors
const black: RGB;
const white: RGB;
const red: RGB;
const green: RGB;
const blue: RGB;
```

### Rotation Helpers

```typescript
// Convert degrees to Degrees type
function degrees(angle: number): Degrees;
```

---

## Troubleshooting

### Common Issues

#### PDF fails to render in browser

**Problem**: PDF loads but doesn't display.

**Solution**: Ensure you call `viewportManager.initialize()`:

```typescript
await viewportManager.initialize(); // This triggers rendering!
```

#### Navigation not working

**Problem**: Page navigation buttons don't work.

**Solution**: Check that `virtualScrollerRef.current` is initialized and `getPageLayout()` returns a valid layout:

```typescript
const layout = virtualScrollerRef.current.getPageLayout(pageIndex);
if (layout) {
  containerElement.scrollTo({ top: layout.top });
}
```

#### NaN in page number

**Problem**: Page input shows "NaN".

**Solution**: Add safety check:

```typescript
value={isNaN(currentPage) || currentPage < 1 ? 1 : currentPage}
```

#### Text layer not showing

**Problem**: Can't select text in PDF.

**Solution**: Ensure you're calling `buildPDFJSTextLayer()`:

```typescript
await buildPDFJSTextLayer(page, {
  container: textLayerDiv,
  viewport: viewport,
});
```

#### CORS errors when loading PDF from URL

**Problem**: Can't load PDF from remote URL.

**Solution**: Add CORS headers to the PDF server, or proxy the request through your backend:

```typescript
// Backend proxy approach
const response = await fetch("/api/proxy-pdf?url=" + encodeURIComponent(pdfUrl));
const arrayBuffer = await response.arrayBuffer();
const bytes = new Uint8Array(arrayBuffer);
```

#### Memory issues with large PDFs

**Problem**: Browser crashes with large PDFs.

**Solution**: Increase buffer size in virtual scroller, reduce maxConcurrentRenders:

```typescript
const scroller = createVirtualScroller({
  // ...
  bufferSize: 2, // Render more pages outside viewport
});

const viewportManager = createViewportManager({
  // ...
  maxConcurrentRenders: 2, // Reduce concurrent renders
});
```

#### Forms not editable

**Problem**: Form fields are disabled.

**Solution**: The PDF may have been flattened. Load the original PDF or check field properties:

```typescript
const field = form.getTextField("name");
if (field.isReadOnly()) {
  field.enableReadOnly(); // Make editable
}
```

### Performance Tips

1. **Use PDF.js integration for viewing** - It's much faster than core library rendering
2. **Enable virtual scrolling** - Only renders visible pages
3. **Reduce concurrent renders** - Lower `maxConcurrentRenders` for slower devices
4. **Lazy load PDFs** - Don't load all PDFs at once
5. **Use Web Workers** - Offload PDF processing to workers
6. **Compress PDFs** - Enable `objectCompression` when saving

### Debug Mode

Enable debug logging:

```typescript
// In browser console
localStorage.setItem("DEBUG", "@dvvebond/core:*");

// In Node.js
process.env.DEBUG = "@dvvebond/core:*";
```

### Getting Help

- **Examples**: Check `examples/` directory for working code
- **GitHub Issues**: https://github.com/dvvebond/core/issues
- **Demos**: Run `bun run demo` to see working implementation

---

## License

Check the package.json for license information.

---

## Credits

Built on top of:

- **PDF.js** - Mozilla's PDF rendering engine
- **pdf-lib** - PDF generation API inspiration
- **PDFBox** - Feature coverage reference

---

**This is the complete documentation for @dvvebond/core. Everything you need to build PDF applications is here.**
