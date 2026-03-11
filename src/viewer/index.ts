/**
 * PDF Viewer module.
 *
 * Provides components for building interactive PDF viewers including
 * highlight rendering, coordinate transformation integration, and
 * search result visualization.
 *
 * @example
 * ```ts
 * import {
 *   HighlightRenderer,
 *   createHighlightRenderer,
 * } from '@libpdf/core/viewer';
 *
 * // Create a highlight renderer attached to your viewer container
 * const highlightRenderer = createHighlightRenderer(containerElement);
 *
 * // Connect it to the coordinate transformer
 * highlightRenderer.setTransformer(coordinateTransformer);
 *
 * // Add search result highlights
 * highlightRenderer.addHighlights(searchResults.map(r => ({
 *   pageIndex: r.pageIndex,
 *   bounds: r.bounds,
 *   charBounds: r.charBounds,
 *   type: 'search',
 * })));
 *
 * // Update positions when viewport changes
 * highlightRenderer.updatePositions();
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Highlight Renderer
// ─────────────────────────────────────────────────────────────────────────────

export { HighlightRenderer, createHighlightRenderer } from "./highlight/HighlightRenderer";

// ─────────────────────────────────────────────────────────────────────────────
// Highlight Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Core types
  HighlightType,
  HighlightRegion,
  HighlightGroup,
  HighlightStyle,
  HighlightRendererOptions,
  RenderedHighlight,
  // Event types
  HighlightEventType,
  HighlightEvent,
  HighlightEventListener,
  BaseHighlightEvent,
  HighlightClickEvent,
  HighlightHoverEvent,
  HighlightLeaveEvent,
  HighlightsUpdatedEvent,
} from "./highlight/types";

export {
  DEFAULT_HIGHLIGHT_STYLES,
  createHighlightEvent,
  mergeHighlightStyles,
} from "./highlight/types";

// ─────────────────────────────────────────────────────────────────────────────
// Zoom Controller
// ─────────────────────────────────────────────────────────────────────────────

export { ZoomController, createZoomController } from "./zoom-controller.ts";
export type { ZoomControllerOptions } from "./zoom-controller.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Pan Handler
// ─────────────────────────────────────────────────────────────────────────────

export { PanHandler, createPanHandler } from "./pan-handler.ts";
export type { PanHandlerOptions } from "./pan-handler.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Events
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Common types
  Point,
  Velocity,
  EasingFunction,
  // Zoom events
  ZoomStartEvent,
  ZoomUpdateEvent,
  ZoomEndEvent,
  ZoomEvent,
  ZoomEventListener,
  ZoomAnimationConfig,
  // Pan events
  PanStartEvent,
  PanMoveEvent,
  PanEndEvent,
  PanMomentumEvent,
  PanMomentumEndEvent,
  PanEvent,
  PanEventListener,
  PanMomentumConfig,
  // Combined types
  InteractionEvent,
  InteractionEventListener,
} from "./interaction-events.ts";

export {
  easeLinear,
  easeOutCubic,
  easeOutQuart,
  easeInOutCubic,
  easeOutExpo,
} from "./interaction-events.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Content Stream Processing
// ─────────────────────────────────────────────────────────────────────────────

export {
  ContentStreamProcessor,
  createContentStreamProcessor,
  type TextArrayElement,
} from "./ContentStreamProcessor.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Font Management
// ─────────────────────────────────────────────────────────────────────────────

export {
  FontManager,
  createFontManager,
  getGlobalFontManager,
  type FontMetrics,
  type LoadedFont,
  type FontStyle,
} from "./FontManager.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Rendering Type Detection
// ─────────────────────────────────────────────────────────────────────────────

export {
  RenderingType,
  createDefaultAnalysisResult,
  createDefaultRenderingHints,
  type ContentAnalysisResult,
  type ContentAnalyzerOptions,
  type ContentComposition,
  type FontResourceInfo,
  type GraphicsCharacteristics,
  type ImageCharacteristics,
  type PageResources,
  type RenderingHints,
  type TextCharacteristics,
  type XObjectResourceInfo,
} from "./rendering-types.ts";

export { ContentAnalyzer, analyzeContent, createContentAnalyzer } from "./content-analyzer.ts";

export {
  RenderingStrategySelector,
  createRenderingStrategySelector,
  getDefaultStrategy,
  getStrategyForType,
  type CachingStrategy,
  type RenderingPriority,
  type RenderingStrategy,
  type RenderingStrategySelectorOptions,
} from "./rendering-strategy.ts";

export {
  IntelligentRenderer,
  createIntelligentRenderer,
  detectContentType,
  quickAnalyze,
  type IntelligentRenderResult,
  type IntelligentRendererOptions,
  type IntelligentRenderTask,
} from "./renderer.ts";

// ─────────────────────────────────────────────────────────────────────────────
// PDF.js Integration
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Initialization
  initializePDFJS,
  isPDFJSInitialized,
  getPDFJS,
  // Document loading
  loadDocument as loadPDFJSDocument,
  loadDocumentFromUrl as loadPDFJSDocumentFromUrl,
  getCurrentDocument as getCurrentPDFJSDocument,
  closeDocument as closePDFJSDocument,
  // Page operations
  getPage as getPDFJSPage,
  getPageCount as getPDFJSPageCount,
  createPageViewport as createPDFJSPageViewport,
  // Text content
  getTextContent as getPDFJSTextContent,
  isTextItem as isPDFJSTextItem,
  // Renderer
  PDFJSRenderer,
  createPDFJSRenderer,
  // Text layer
  buildPDFJSTextLayer,
  PDFJSTextLayerBuilder,
  createPDFJSTextLayerBuilder,
  // Search
  searchDocument as searchPDFJSDocument,
  PDFJSSearchEngine,
  createPDFJSSearchEngine,
  // Resource Loader
  PDFResourceLoader,
  createPDFResourceLoader,
  loadPDFFromUrl,
  loadPDFFromBytes,
  PDFLoadError,
  // Types
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
  type TextContent as PDFJSTextContent,
  type TextItem as PDFJSTextItem,
  type TextMarkedContent as PDFJSTextMarkedContent,
  type PDFJSWrapperOptions,
  type LoadDocumentOptions as PDFJSLoadDocumentOptions,
  type PDFJSRendererOptions,
  type PDFJSTextLayerOptions,
  type PDFJSTextLayerResult,
  type PDFJSSearchResult,
  type PDFJSSearchOptions,
  type PDFJSSearchState,
  type PDFSource,
  type AuthConfig,
  type AuthRefreshCallback,
  type UrlRefreshCallback,
  type ProgressCallback,
  type PDFResourceLoaderOptions,
  type PDFLoadResult,
} from "./pdfjs";
