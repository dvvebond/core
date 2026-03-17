# @dvvebond/core Examples

This directory contains two types of examples:

1. **CLI Examples** - Command-line scripts demonstrating core PDF functionality
2. **Interactive Examples App** - A Vite-based React app showcasing React components and hooks

## CLI Examples

Run the command-line examples that demonstrate core PDF operations:

```bash
# Run all CLI examples
bun run cli

# Run with suppressed output
bun run cli:quiet

# Run a specific category
bun run run-all.ts 01-basic
```

### CLI Example Categories

- `01-basic/` - Loading, saving, and inspecting PDFs
- `02-pages/` - Page manipulation (add, remove, reorder)
- `03-forms/` - Form field operations
- `04-drawing/` - Drawing shapes, text, and paths
- `05-images-and-fonts/` - Embedding images and fonts
- `06-metadata/` - Document metadata
- `07-signatures/` - Digital signatures
- `08-attachments/` - File attachments
- `09-merging-and-splitting/` - Combining and splitting PDFs
- `10-security/` - Encryption and permissions
- `11-advanced/` - Low-level operations
- `12-text-extraction/` - Text extraction and search

## Interactive Examples App

A comprehensive React application demonstrating all React components and hooks.

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Examples Included

#### Components

- **ReactPDFViewer** - Full-featured React component with all controls
- **Viewer Variants** - Comparison of different viewer implementations

#### Features

- **Search & Find** - Text search with regex support and highlighting
- **Highlighting** - Bounding box visualization at multiple levels
- **Interactive Coordinates** - Click-to-coordinate conversion
- **Viewport Management** - Zoom, pan, and rotation controls

#### Integrations

- **Azure Document Intelligence** - OCR coordinate mapping

#### Advanced

- **Performance Testing** - Benchmarks and optimization techniques

### Project Structure

```
examples/
├── 01-basic/              # CLI examples
├── 02-pages/
├── ...
├── src/                   # Interactive app
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Router setup
│   ├── styles.css         # Global styles
│   ├── components/        # Shared components
│   │   └── Layout.tsx
│   ├── examples/          # Example pages
│   │   ├── ReactPDFViewerExample.tsx
│   │   ├── AzureIntegrationExample.tsx
│   │   ├── SearchExample.tsx
│   │   ├── HighlightingExample.tsx
│   │   ├── ViewerVariantsExample.tsx
│   │   ├── InteractiveExample.tsx
│   │   ├── ViewportExample.tsx
│   │   └── PerformanceExample.tsx
│   └── utils/             # Utilities
│       ├── code-display.tsx
│       └── metrics.tsx
├── public/                # Static assets
│   └── assets/
│       └── sample.pdf
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── run-all.ts             # CLI example runner
```

### Adding New Interactive Examples

1. Create a new file in `src/examples/`
2. Add the route in `src/App.tsx`
3. Add navigation link in `src/components/Layout.tsx`

### Development

The interactive examples app uses Vite for fast development with HMR. The `@dvvebond/core` library is linked directly from the parent directory for real-time updates during development.

### Important: SimplePDFViewer Implementation

The `SimplePDFViewer` component (`src/components/SimplePDFViewer.tsx`) uses the **correct PDF.js integration pattern** from `demo/demo.ts`:

```typescript
// Initialize PDF.js with worker
await initializePDFJS({ workerSrc });

// Load PDF with retry/timeout support
const loader = createPDFResourceLoader({ workerSrc, maxRetries: 3, timeout: 30000 });
const { document } = await loader.load({ type: "url", url });

// Create PDF.js renderer
const renderer = createPDFJSRenderer();
await renderer.initialize();
await renderer.loadDocument(pdfBytes);

// Virtual scrolling for efficiency
const scroller = createVirtualScroller({ pageDimensions, scale, pageGap: 20 });

// Viewport manager for lazy rendering
const viewportManager = createViewportManager({
  scroller,
  renderer,
  pageSource,
  maxConcurrentRenders: 3,
});

// Text layer for selection
await buildPDFJSTextLayer(page, { container, viewport });
```

**Why not use ReactPDFViewer from @dvvebond/core/react?**

The library's `ReactPDFViewer` component doesn't work - it doesn't use the PDF.js integration APIs correctly. Our `SimplePDFViewer` follows the same proven pattern as the working demo.

See [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) for detailed technical explanation.
