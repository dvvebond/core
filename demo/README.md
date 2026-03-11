# LibPDF Viewer Demo

A comprehensive demonstration of the @libpdf/core PDF viewing capabilities.

## Features

- **PDF Loading**: Open PDF files via file picker or drag-and-drop
- **Page Navigation**: First, previous, next, last page controls with keyboard shortcuts
- **Zoom**: Preset zoom levels (50%-200%), fit-to-width, fit-to-page, and manual zoom
- **Rotation**: 90-degree clockwise and counter-clockwise rotation
- **Text Search**: Case-sensitive and whole-word search with result navigation
- **Text Selection**: Select and copy text from rendered pages
- **Virtual Scrolling**: Efficient rendering of large documents
- **Responsive Layout**: Works on desktop and mobile devices

## Running the Demo

### Using Bun (recommended)

```bash
# From the core directory
bun run demo
```

This starts a development server with hot reloading at `http://localhost:3000`.

### Using a Static Server

```bash
# Build and serve
bun run demo:serve
```

Then open `http://localhost:3000` in your browser.

## Keyboard Shortcuts

| Key                         | Action                 |
| --------------------------- | ---------------------- |
| `Left Arrow` / `Page Up`    | Previous page          |
| `Right Arrow` / `Page Down` | Next page              |
| `Home`                      | First page             |
| `End`                       | Last page              |
| `Ctrl/Cmd + =`              | Zoom in                |
| `Ctrl/Cmd + -`              | Zoom out               |
| `Ctrl/Cmd + F`              | Focus search           |
| `Enter`                     | Next search result     |
| `Shift + Enter`             | Previous search result |

## Architecture

The demo integrates these @libpdf/core components:

- `PDF` - Document loading and parsing
- `VirtualScroller` - Efficient page virtualization
- `ViewportManager` - Visible page management
- `CanvasRenderer` - Canvas-based page rendering
- `TextLayerBuilder` - Text selection overlay
- `SearchEngine` - Full-text search

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

## File Structure

```
demo/
  index.html   - Main HTML entry point
  demo.ts      - TypeScript application code
  styles.css   - Demo-specific styles
  README.md    - This file
```
