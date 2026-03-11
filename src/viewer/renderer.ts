/**
 * Intelligent PDF Renderer with Content-Aware Routing.
 *
 * Integrates content analysis with rendering to automatically select optimal
 * rendering strategies based on PDF page content. This provides a higher-level
 * abstraction over the Canvas and SVG renderers.
 */

import {
  type BaseRenderer,
  type FontResolver,
  type RendererOptions,
  type RenderResult,
  type RenderTask,
  type Viewport,
} from "#src/renderers/base-renderer";
import { CanvasRenderer, type CanvasRendererOptions } from "#src/renderers/canvas-renderer";
import { SVGRenderer, type SVGRendererOptions } from "#src/renderers/svg-renderer";

import { ContentAnalyzer, type analyzeContent } from "./content-analyzer";
import type { RenderingStrategy } from "./rendering-strategy";
import {
  createRenderingStrategySelector,
  getDefaultStrategy,
  type RenderingStrategySelectorOptions,
} from "./rendering-strategy";
import type {
  ContentAnalysisResult,
  ContentAnalyzerOptions,
  PageResources,
} from "./rendering-types";
import { RenderingType, createDefaultAnalysisResult } from "./rendering-types";

/**
 * Options for the intelligent renderer.
 */
export interface IntelligentRendererOptions extends RendererOptions {
  /**
   * Options for content analysis.
   */
  analyzerOptions?: ContentAnalyzerOptions;

  /**
   * Options for strategy selection.
   */
  strategyOptions?: RenderingStrategySelectorOptions;

  /**
   * Canvas-specific options when using canvas renderer.
   */
  canvasOptions?: CanvasRendererOptions;

  /**
   * SVG-specific options when using SVG renderer.
   */
  svgOptions?: SVGRendererOptions;

  /**
   * Whether to enable automatic content analysis.
   * @default true
   */
  enableAnalysis?: boolean;

  /**
   * Whether to cache analysis results.
   * @default true
   */
  cacheAnalysis?: boolean;

  /**
   * Whether to log rendering decisions for debugging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Result of rendering with analysis information.
 */
export interface IntelligentRenderResult extends RenderResult {
  /**
   * The analysis result for the rendered page.
   */
  analysis?: ContentAnalysisResult;

  /**
   * The strategy used for rendering.
   */
  strategy?: RenderingStrategy;

  /**
   * The renderer type that was used.
   */
  rendererUsed: "canvas" | "svg";
}

/**
 * Render task with extended result type.
 */
export interface IntelligentRenderTask {
  /**
   * Promise that resolves when rendering is complete.
   */
  promise: Promise<IntelligentRenderResult>;

  /**
   * Cancel the rendering operation.
   */
  cancel(): void;

  /**
   * Whether the task has been cancelled.
   */
  readonly cancelled: boolean;
}

/**
 * Intelligent PDF renderer that automatically selects optimal rendering strategies.
 *
 * This renderer analyzes page content before rendering to determine the best
 * approach, then routes to the appropriate underlying renderer (Canvas or SVG)
 * with optimized configuration.
 */
export class IntelligentRenderer implements BaseRenderer {
  readonly type = "canvas" as const; // Default type, may vary per-page

  private _initialized = false;
  private _options: Required<
    Pick<IntelligentRendererOptions, "enableAnalysis" | "cacheAnalysis" | "debug">
  > &
    IntelligentRendererOptions;

  private _canvasRenderer: CanvasRenderer | null = null;
  private _svgRenderer: SVGRenderer | null = null;
  private _contentAnalyzer: ContentAnalyzer;
  private _strategySelector: ReturnType<typeof createRenderingStrategySelector>;

  // Cache for analysis results per page
  private _analysisCache: Map<number, ContentAnalysisResult> = new Map();

  constructor(options: IntelligentRendererOptions = {}) {
    this._options = {
      enableAnalysis: options.enableAnalysis ?? true,
      cacheAnalysis: options.cacheAnalysis ?? true,
      debug: options.debug ?? false,
      ...options,
    };

    this._contentAnalyzer = new ContentAnalyzer(this._options.analyzerOptions);
    this._strategySelector = createRenderingStrategySelector(this._options.strategyOptions);
  }

  get initialized(): boolean {
    return this._initialized;
  }

  async initialize(options?: RendererOptions): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Merge options
    if (options) {
      this._options = { ...this._options, ...options };
    }

    // Initialize both renderers so we can switch between them
    this._canvasRenderer = new CanvasRenderer();
    await this._canvasRenderer.initialize({
      ...this._options,
      ...this._options.canvasOptions,
    });

    this._svgRenderer = new SVGRenderer();
    await this._svgRenderer.initialize({
      ...this._options,
      ...this._options.svgOptions,
    });

    this._initialized = true;
  }

  createViewport(
    pageWidth: number,
    pageHeight: number,
    pageRotation: number,
    scale = 1,
    rotation = 0,
  ): Viewport {
    if (!this._initialized || !this._canvasRenderer) {
      throw new Error("Renderer must be initialized before creating viewport");
    }

    // Use canvas renderer's viewport creation (both should produce same result)
    return this._canvasRenderer.createViewport(
      pageWidth,
      pageHeight,
      pageRotation,
      scale,
      rotation,
    );
  }

  /**
   * Analyze page content and return analysis result.
   *
   * @param contentBytes - Raw content stream bytes
   * @param pageIndex - Page index for caching
   * @param resources - Optional page resources for enhanced analysis
   * @returns Content analysis result
   */
  analyzeContent(
    contentBytes: Uint8Array,
    pageIndex: number,
    resources?: PageResources,
  ): ContentAnalysisResult {
    // Check cache first
    if (this._options.cacheAnalysis) {
      const cached = this._analysisCache.get(pageIndex);
      if (cached) {
        return cached;
      }
    }

    // Perform analysis
    const analysis = this._contentAnalyzer.analyze(contentBytes, resources);

    // Cache result
    if (this._options.cacheAnalysis) {
      this._analysisCache.set(pageIndex, analysis);
    }

    if (this._options.debug) {
      this.logAnalysis(pageIndex, analysis);
    }

    return analysis;
  }

  /**
   * Get the rendering strategy for a page based on its content.
   *
   * @param contentBytes - Raw content stream bytes
   * @param pageIndex - Page index
   * @param resources - Optional page resources
   * @returns Rendering strategy for the page
   */
  getStrategy(
    contentBytes: Uint8Array,
    pageIndex: number,
    resources?: PageResources,
  ): RenderingStrategy {
    if (!this._options.enableAnalysis) {
      return getDefaultStrategy();
    }

    const analysis = this.analyzeContent(contentBytes, pageIndex, resources);
    return this._strategySelector.selectStrategy(analysis, pageIndex);
  }

  /**
   * Render a page with automatic strategy selection.
   *
   * @param pageIndex - The page index
   * @param viewport - The viewport to render into
   * @param contentBytes - Raw content stream bytes
   * @param fontResolver - Optional font resolver
   * @param resources - Optional page resources for analysis
   * @returns Render task with extended result
   */
  render(
    pageIndex: number,
    viewport: Viewport,
    contentBytes?: Uint8Array | null,
    fontResolver?: FontResolver | null,
    resources?: PageResources,
  ): RenderTask {
    if (!this._initialized) {
      throw new Error("Renderer must be initialized before rendering");
    }

    let cancelled = false;
    let activeTask: RenderTask | null = null;

    const promise = new Promise<RenderResult>((resolve, reject) => {
      queueMicrotask(async () => {
        if (cancelled) {
          reject(new Error("Render task cancelled"));
          return;
        }

        try {
          // Determine strategy
          let analysis: ContentAnalysisResult | undefined;
          let strategy: RenderingStrategy;

          if (this._options.enableAnalysis && contentBytes && contentBytes.length > 0) {
            analysis = this.analyzeContent(contentBytes, pageIndex, resources);
            strategy = this._strategySelector.selectStrategy(analysis, pageIndex);
          } else {
            strategy = getDefaultStrategy();
          }

          // Select renderer based on strategy
          const renderer =
            strategy.rendererType === "svg" ? this._svgRenderer : this._canvasRenderer;

          if (!renderer) {
            throw new Error(`Renderer not available: ${strategy.rendererType}`);
          }

          // Apply strategy-specific viewport modifications
          const adjustedViewport = this.adjustViewport(viewport, strategy);

          // Render using selected renderer
          activeTask = renderer.render(pageIndex, adjustedViewport, contentBytes, fontResolver);

          if (cancelled) {
            activeTask.cancel();
            reject(new Error("Render task cancelled"));
            return;
          }

          const baseResult = await activeTask.promise;

          // Return extended result
          const result: IntelligentRenderResult = {
            ...baseResult,
            analysis,
            strategy,
            rendererUsed: strategy.rendererType,
          };

          if (this._options.debug) {
            this.logRenderComplete(pageIndex, strategy, baseResult);
          }

          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        if (activeTask) {
          activeTask.cancel();
        }
      },
      get cancelled() {
        return cancelled;
      },
    };
  }

  /**
   * Render with explicit strategy override.
   *
   * @param pageIndex - The page index
   * @param viewport - The viewport to render into
   * @param contentBytes - Raw content stream bytes
   * @param fontResolver - Optional font resolver
   * @param rendererType - Explicit renderer type to use
   * @returns Render task
   */
  renderWithType(
    pageIndex: number,
    viewport: Viewport,
    contentBytes?: Uint8Array | null,
    fontResolver?: FontResolver | null,
    rendererType: "canvas" | "svg" = "canvas",
  ): RenderTask {
    if (!this._initialized) {
      throw new Error("Renderer must be initialized before rendering");
    }

    const renderer = rendererType === "svg" ? this._svgRenderer : this._canvasRenderer;

    if (!renderer) {
      throw new Error(`Renderer not available: ${rendererType}`);
    }

    return renderer.render(pageIndex, viewport, contentBytes, fontResolver);
  }

  /**
   * Get the detected rendering type for a page.
   *
   * @param contentBytes - Raw content stream bytes
   * @param pageIndex - Page index for caching
   * @param resources - Optional page resources
   * @returns The rendering type
   */
  detectRenderingType(
    contentBytes: Uint8Array,
    pageIndex: number,
    resources?: PageResources,
  ): RenderingType {
    const analysis = this.analyzeContent(contentBytes, pageIndex, resources);
    return analysis.renderingType;
  }

  /**
   * Clear the analysis cache for all pages or a specific page.
   *
   * @param pageIndex - Optional specific page to clear
   */
  clearAnalysisCache(pageIndex?: number): void {
    if (pageIndex !== undefined) {
      this._analysisCache.delete(pageIndex);
    } else {
      this._analysisCache.clear();
    }
  }

  /**
   * Get the underlying canvas renderer.
   */
  getCanvasRenderer(): CanvasRenderer | null {
    return this._canvasRenderer;
  }

  /**
   * Get the underlying SVG renderer.
   */
  getSVGRenderer(): SVGRenderer | null {
    return this._svgRenderer;
  }

  destroy(): void {
    if (this._canvasRenderer) {
      this._canvasRenderer.destroy();
      this._canvasRenderer = null;
    }

    if (this._svgRenderer) {
      this._svgRenderer.destroy();
      this._svgRenderer = null;
    }

    this._analysisCache.clear();
    this._initialized = false;
  }

  /**
   * Adjust viewport based on rendering strategy.
   */
  private adjustViewport(viewport: Viewport, strategy: RenderingStrategy): Viewport {
    // If strategy suggests a different scale, we could adjust here
    // For now, we respect the provided viewport
    return viewport;
  }

  /**
   * Log analysis results for debugging.
   */
  private logAnalysis(pageIndex: number, analysis: ContentAnalysisResult): void {
    console.log(`[IntelligentRenderer] Page ${pageIndex + 1} analysis:`, {
      renderingType: analysis.renderingType,
      confidence: analysis.confidence.toFixed(2),
      composition: {
        text: `${analysis.composition.textPercent}%`,
        vector: `${analysis.composition.vectorPathPercent}%`,
        image: `${analysis.composition.imagePercent}%`,
      },
      operators: analysis.composition.totalOperatorCount,
      shouldCache: analysis.shouldCache,
    });
  }

  /**
   * Log render completion for debugging.
   */
  private logRenderComplete(
    pageIndex: number,
    strategy: RenderingStrategy,
    result: RenderResult,
  ): void {
    console.log(`[IntelligentRenderer] Page ${pageIndex + 1} rendered:`, {
      renderer: strategy.rendererType,
      size: `${result.width}x${result.height}`,
      textLayer: strategy.generateTextLayer,
      cached: strategy.caching.enabled,
    });
  }
}

/**
 * Create an intelligent renderer with the given options.
 */
export function createIntelligentRenderer(
  options?: IntelligentRendererOptions,
): IntelligentRenderer {
  return new IntelligentRenderer(options);
}

/**
 * Quick analysis of content bytes without full renderer initialization.
 * Useful for pre-analyzing pages before rendering.
 */
export function quickAnalyze(
  contentBytes: Uint8Array,
  options?: ContentAnalyzerOptions,
): ContentAnalysisResult {
  const analyzer = new ContentAnalyzer(options);
  return analyzer.analyze(contentBytes);
}

/**
 * Detect the rendering type for content bytes.
 * Convenience function for simple type detection.
 */
export function detectContentType(
  contentBytes: Uint8Array,
  options?: ContentAnalyzerOptions,
): RenderingType {
  const analysis = quickAnalyze(contentBytes, options);
  return analysis.renderingType;
}

// Re-export types for convenience
export type {
  ContentAnalysisResult,
  ContentAnalyzerOptions,
  PageResources,
} from "./rendering-types";
export { RenderingType } from "./rendering-types";
export type { RenderingStrategy } from "./rendering-strategy";
