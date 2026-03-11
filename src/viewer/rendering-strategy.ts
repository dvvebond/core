/**
 * Rendering Strategy Selection.
 *
 * Provides a factory pattern for selecting appropriate rendering approaches
 * based on content analysis results. Returns optimized renderer configurations
 * for each PDF content type.
 */

import type { RendererOptions, RendererType } from "#src/renderers/base-renderer";

import type { ContentAnalysisResult, RenderingHints } from "./rendering-types";
import { RenderingType } from "./rendering-types";

/**
 * Complete rendering strategy for a page.
 */
export interface RenderingStrategy {
  /**
   * The renderer type to use.
   */
  rendererType: RendererType;

  /**
   * Configuration options for the renderer.
   */
  rendererOptions: RendererOptions;

  /**
   * Whether to generate a text selection layer.
   */
  generateTextLayer: boolean;

  /**
   * Whether to enable annotation rendering.
   */
  enableAnnotations: boolean;

  /**
   * Caching strategy for this page.
   */
  caching: CachingStrategy;

  /**
   * Priority hints for rendering order.
   */
  priority: RenderingPriority;
}

/**
 * Caching strategy for rendered content.
 */
export interface CachingStrategy {
  /**
   * Whether to cache the rendered output.
   */
  enabled: boolean;

  /**
   * Time-to-live for cached content in milliseconds.
   * 0 means no expiration.
   */
  ttlMs: number;

  /**
   * Maximum number of cached versions (for different scales).
   */
  maxVersions: number;

  /**
   * Whether to cache at multiple scale levels.
   */
  cacheMultipleScales: boolean;
}

/**
 * Rendering priority configuration.
 */
export interface RenderingPriority {
  /**
   * Whether this page should be rendered immediately when visible.
   */
  immediate: boolean;

  /**
   * Priority level (lower = higher priority).
   */
  level: number;

  /**
   * Whether to prefetch adjacent pages.
   */
  prefetchAdjacent: boolean;
}

/**
 * Options for the rendering strategy selector.
 */
export interface RenderingStrategySelectorOptions {
  /**
   * Default renderer type when no preference is determined.
   * @default "canvas"
   */
  defaultRenderer?: RendererType;

  /**
   * Default scale factor.
   * @default 1
   */
  defaultScale?: number;

  /**
   * Whether text layer is enabled globally.
   * @default true
   */
  textLayerEnabled?: boolean;

  /**
   * Whether annotations are enabled globally.
   * @default true
   */
  annotationsEnabled?: boolean;

  /**
   * Maximum cache TTL in milliseconds.
   * @default 300000 (5 minutes)
   */
  maxCacheTtl?: number;

  /**
   * Force a specific renderer type regardless of analysis.
   */
  forceRenderer?: RendererType;
}

/**
 * Selects rendering strategies based on content analysis.
 */
export class RenderingStrategySelector {
  private readonly options: Required<Omit<RenderingStrategySelectorOptions, "forceRenderer">> & {
    forceRenderer?: RendererType;
  };

  constructor(options: RenderingStrategySelectorOptions = {}) {
    this.options = {
      defaultRenderer: options.defaultRenderer ?? "canvas",
      defaultScale: options.defaultScale ?? 1,
      textLayerEnabled: options.textLayerEnabled ?? true,
      annotationsEnabled: options.annotationsEnabled ?? true,
      maxCacheTtl: options.maxCacheTtl ?? 300000,
      forceRenderer: options.forceRenderer,
    };
  }

  /**
   * Select the optimal rendering strategy for a page based on analysis.
   *
   * @param analysis - Content analysis result for the page
   * @param pageIndex - The page index (used for priority calculations)
   * @returns Complete rendering strategy
   */
  selectStrategy(analysis: ContentAnalysisResult, pageIndex: number = 0): RenderingStrategy {
    const hints = analysis.hints;

    // Determine renderer type
    const rendererType = this.options.forceRenderer ?? this.selectRenderer(analysis, hints);

    // Build renderer options
    const rendererOptions = this.buildRendererOptions(analysis, hints);

    // Determine text layer generation
    const generateTextLayer = this.shouldGenerateTextLayer(analysis, hints);

    // Determine caching strategy
    const caching = this.buildCachingStrategy(analysis);

    // Determine priority
    const priority = this.buildPriority(analysis, pageIndex);

    return {
      rendererType,
      rendererOptions,
      generateTextLayer,
      enableAnnotations: this.options.annotationsEnabled,
      caching,
      priority,
    };
  }

  /**
   * Select the appropriate renderer type.
   */
  private selectRenderer(analysis: ContentAnalysisResult, hints: RenderingHints): RendererType {
    // Use hint preference if available
    if (hints.preferredRenderer) {
      return hints.preferredRenderer;
    }

    // SVG is better for vector-heavy content with few operators
    if (
      analysis.renderingType === RenderingType.Vector &&
      analysis.composition.totalOperatorCount < 500 &&
      analysis.composition.imageXObjectCount === 0
    ) {
      return "svg";
    }

    // Canvas is better for everything else
    return this.options.defaultRenderer;
  }

  /**
   * Build renderer options based on analysis.
   */
  private buildRendererOptions(
    analysis: ContentAnalysisResult,
    hints: RenderingHints,
  ): RendererOptions {
    const scale = this.calculateScale(analysis, hints);

    return {
      scale,
      textLayer: this.shouldGenerateTextLayer(analysis, hints),
      annotationLayer: this.options.annotationsEnabled,
    };
  }

  /**
   * Calculate the optimal scale factor.
   */
  private calculateScale(analysis: ContentAnalysisResult, hints: RenderingHints): number {
    // Start with suggested scale from hints
    let scale = hints.suggestedScale ?? this.options.defaultScale;

    // Adjust based on content type
    switch (analysis.renderingType) {
      case RenderingType.Vector:
        // Higher scale for crisp vector content
        scale = Math.max(scale, 1.5);
        break;

      case RenderingType.ImageBased:
        // Native resolution is usually fine
        scale = Math.min(scale, 1);
        break;

      case RenderingType.OCR:
        // Match image resolution
        scale = 1;
        break;

      default:
        // Keep calculated scale
        break;
    }

    // Cap scale to reasonable range
    return Math.max(0.5, Math.min(3, scale));
  }

  /**
   * Determine if text layer should be generated.
   */
  private shouldGenerateTextLayer(analysis: ContentAnalysisResult, hints: RenderingHints): boolean {
    // Respect global setting
    if (!this.options.textLayerEnabled) {
      return false;
    }

    // Use hint if available
    if (!hints.generateTextLayer) {
      return false;
    }

    // No text layer for pure image content
    if (
      analysis.renderingType === RenderingType.ImageBased &&
      analysis.textCharacteristics.visibleTextCount === 0 &&
      !analysis.textCharacteristics.hasInvisibleText
    ) {
      return false;
    }

    return true;
  }

  /**
   * Build caching strategy based on analysis.
   */
  private buildCachingStrategy(analysis: ContentAnalysisResult): CachingStrategy {
    const enabled = analysis.shouldCache;

    // More aggressive caching for complex/image-heavy pages
    let ttlMs = 60000; // 1 minute default
    let maxVersions = 2;
    let cacheMultipleScales = false;

    if (analysis.renderingType === RenderingType.ImageBased) {
      // Images are expensive to decode
      ttlMs = this.options.maxCacheTtl;
      maxVersions = 3;
      cacheMultipleScales = true;
    } else if (analysis.composition.totalOperatorCount > 1000) {
      // Complex pages benefit from caching
      ttlMs = 180000; // 3 minutes
      maxVersions = 2;
    }

    return {
      enabled,
      ttlMs: Math.min(ttlMs, this.options.maxCacheTtl),
      maxVersions,
      cacheMultipleScales,
    };
  }

  /**
   * Build rendering priority configuration.
   */
  private buildPriority(analysis: ContentAnalysisResult, pageIndex: number): RenderingPriority {
    // Simple pages render fast, can be lower priority
    const isSimple =
      analysis.composition.totalOperatorCount < 100 &&
      analysis.imageCharacteristics.imageCount === 0;

    // First few pages are always high priority
    const isInitialPage = pageIndex < 3;

    return {
      immediate: isInitialPage || !analysis.shouldCache,
      level: isInitialPage ? 0 : isSimple ? 2 : 1,
      prefetchAdjacent: !isSimple,
    };
  }
}

/**
 * Create a rendering strategy selector with the given options.
 */
export function createRenderingStrategySelector(
  options?: RenderingStrategySelectorOptions,
): RenderingStrategySelector {
  return new RenderingStrategySelector(options);
}

/**
 * Get the default rendering strategy for unknown content.
 */
export function getDefaultStrategy(): RenderingStrategy {
  return {
    rendererType: "canvas",
    rendererOptions: {
      scale: 1,
      textLayer: true,
      annotationLayer: true,
    },
    generateTextLayer: true,
    enableAnnotations: true,
    caching: {
      enabled: false,
      ttlMs: 60000,
      maxVersions: 1,
      cacheMultipleScales: false,
    },
    priority: {
      immediate: true,
      level: 1,
      prefetchAdjacent: true,
    },
  };
}

/**
 * Quick strategy selection based on rendering type only.
 * Use when full analysis result is not available.
 */
export function getStrategyForType(renderingType: RenderingType): RenderingStrategy {
  const strategy = getDefaultStrategy();

  switch (renderingType) {
    case RenderingType.Vector:
      strategy.rendererOptions.scale = 1.5;
      break;

    case RenderingType.ImageBased:
      strategy.generateTextLayer = false;
      strategy.caching.enabled = true;
      strategy.caching.ttlMs = 300000;
      break;

    case RenderingType.OCR:
      strategy.generateTextLayer = true;
      strategy.caching.enabled = true;
      break;

    case RenderingType.Flattened:
      strategy.rendererOptions.scale = 1.25;
      break;

    case RenderingType.Hybrid:
      strategy.caching.enabled = true;
      strategy.caching.ttlMs = 120000;
      break;

    default:
      // Keep defaults
      break;
  }

  return strategy;
}
