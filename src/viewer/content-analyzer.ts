/**
 * PDF Content Analyzer.
 *
 * Analyzes PDF page content streams and resources to detect rendering patterns
 * and classify pages by content type. This enables intelligent routing to
 * appropriate rendering pipelines for optimal quality and performance.
 */

import { Op, type Operator } from "#src/content/operators";

import { ContentStreamProcessor } from "./ContentStreamProcessor";
import {
  type ContentAnalysisResult,
  type ContentAnalyzerOptions,
  type ContentComposition,
  type GraphicsCharacteristics,
  type ImageCharacteristics,
  type PageResources,
  type RenderingHints,
  RenderingType,
  type TextCharacteristics,
  createDefaultAnalysisResult,
} from "./rendering-types";

/**
 * Operators that construct paths.
 */
const PATH_CONSTRUCTION_OPS = new Set<string>([
  Op.MoveTo,
  Op.LineTo,
  Op.CurveTo,
  Op.CurveToInitial,
  Op.CurveToFinal,
  Op.Rectangle,
  Op.ClosePath,
]);

/**
 * Operators that show text.
 */
const TEXT_SHOWING_OPS = new Set<string>([
  Op.ShowText,
  Op.ShowTextArray,
  Op.MoveAndShowText,
  Op.MoveSetSpacingShowText,
]);

/**
 * Operators that paint paths.
 */
const PATH_PAINTING_OPS = new Set<string>([
  Op.Stroke,
  Op.CloseAndStroke,
  Op.Fill,
  Op.FillCompat,
  Op.FillEvenOdd,
  Op.FillAndStroke,
  Op.FillAndStrokeEvenOdd,
  Op.CloseFillAndStroke,
  Op.CloseFillAndStrokeEvenOdd,
]);

/**
 * Content analyzer for PDF pages.
 *
 * Examines content stream operators and page resources to classify
 * the rendering approach needed for optimal output.
 */
export class ContentAnalyzer {
  private readonly options: Required<ContentAnalyzerOptions>;

  constructor(options: ContentAnalyzerOptions = {}) {
    this.options = {
      analyzeXObjects: options.analyzeXObjects ?? false,
      maxOperatorsToAnalyze: options.maxOperatorsToAnalyze ?? 10000,
      pageDimensions: options.pageDimensions ?? { width: 612, height: 792 },
    };
  }

  /**
   * Analyze content stream bytes and classify the rendering type.
   *
   * @param contentBytes - Raw content stream bytes
   * @param resources - Optional page resources for enhanced analysis
   * @returns Complete content analysis result
   */
  analyze(contentBytes: Uint8Array, resources?: PageResources): ContentAnalysisResult {
    if (contentBytes.length === 0) {
      return createDefaultAnalysisResult();
    }

    let operators: Operator[];
    try {
      operators = ContentStreamProcessor.parseToOperators(contentBytes);
    } catch {
      // If parsing fails, return default result
      return createDefaultAnalysisResult();
    }

    if (operators.length === 0) {
      return createDefaultAnalysisResult();
    }

    // Limit operators analyzed if configured
    const opsToAnalyze =
      this.options.maxOperatorsToAnalyze > 0
        ? operators.slice(0, this.options.maxOperatorsToAnalyze)
        : operators;

    // Collect statistics
    const composition = this.analyzeComposition(opsToAnalyze, resources);
    const textCharacteristics = this.analyzeTextCharacteristics(opsToAnalyze, resources);
    const imageCharacteristics = this.analyzeImageCharacteristics(opsToAnalyze, resources);
    const graphicsCharacteristics = this.analyzeGraphicsCharacteristics(opsToAnalyze);

    // Classify rendering type
    const { renderingType, confidence } = this.classifyRenderingType(
      composition,
      textCharacteristics,
      imageCharacteristics,
      graphicsCharacteristics,
    );

    // Generate rendering hints
    const hints = this.generateHints(
      renderingType,
      composition,
      textCharacteristics,
      imageCharacteristics,
    );

    // Determine caching recommendation
    const shouldCache = this.shouldCachePage(renderingType, composition, imageCharacteristics);

    return {
      renderingType,
      confidence,
      composition,
      textCharacteristics,
      imageCharacteristics,
      graphicsCharacteristics,
      shouldCache,
      hints,
    };
  }

  /**
   * Analyze content composition statistics.
   */
  private analyzeComposition(operators: Operator[], resources?: PageResources): ContentComposition {
    let pathOperatorCount = 0;
    let textOperatorCount = 0;
    let xObjectCount = 0;
    let imageXObjectCount = 0;
    let formXObjectCount = 0;
    let pathPaintCount = 0;

    for (const op of operators) {
      if (PATH_CONSTRUCTION_OPS.has(op.op)) {
        pathOperatorCount++;
      } else if (TEXT_SHOWING_OPS.has(op.op)) {
        textOperatorCount++;
      } else if (PATH_PAINTING_OPS.has(op.op)) {
        pathPaintCount++;
      } else if (op.op === Op.DrawXObject) {
        xObjectCount++;
        // Check XObject type from resources if available
        const xObjName = this.extractName(op.operands[0]);
        if (resources?.xObjects && xObjName) {
          const info = resources.xObjects.get(xObjName);
          if (info) {
            if (info.subtype === "Image") {
              imageXObjectCount++;
            } else if (info.subtype === "Form") {
              formXObjectCount++;
            }
          }
        }
      }
    }

    // Estimate coverage percentages based on operator counts
    const totalContent = pathPaintCount + textOperatorCount + xObjectCount;
    const vectorPathPercent =
      totalContent > 0 ? Math.round((pathPaintCount / totalContent) * 100) : 0;
    const textPercent = totalContent > 0 ? Math.round((textOperatorCount / totalContent) * 100) : 0;
    const imagePercent =
      totalContent > 0 ? Math.round((imageXObjectCount / totalContent) * 100) : 0;

    return {
      vectorPathPercent,
      textPercent,
      imagePercent,
      pathOperatorCount,
      textOperatorCount,
      xObjectCount,
      imageXObjectCount,
      formXObjectCount,
      totalOperatorCount: operators.length,
    };
  }

  /**
   * Analyze text rendering characteristics.
   */
  private analyzeTextCharacteristics(
    operators: Operator[],
    resources?: PageResources,
  ): TextCharacteristics {
    let currentTextRenderMode = 0;
    let currentFontSize = 12;
    let invisibleTextCount = 0;
    let visibleTextCount = 0;
    let hasVerySmallText = false;
    const usedFonts = new Set<string>();

    for (const op of operators) {
      if (op.op === Op.SetTextRenderMode) {
        const mode = typeof op.operands[0] === "number" ? op.operands[0] : 0;
        currentTextRenderMode = mode;
      } else if (op.op === Op.SetFont) {
        const fontName = this.extractName(op.operands[0]);
        const fontSize = typeof op.operands[1] === "number" ? op.operands[1] : 12;
        currentFontSize = fontSize;
        if (fontName) {
          usedFonts.add(fontName);
        }
        if (fontSize < 2) {
          hasVerySmallText = true;
        }
      } else if (TEXT_SHOWING_OPS.has(op.op)) {
        // Text render mode 3 = invisible
        if (currentTextRenderMode === 3) {
          invisibleTextCount++;
        } else {
          visibleTextCount++;
        }
        if (currentFontSize < 2) {
          hasVerySmallText = true;
        }
      }
    }

    // Check for CID fonts from resources
    let hasCIDFonts = false;
    if (resources?.fonts) {
      for (const [name, info] of resources.fonts) {
        if (usedFonts.has(name) && info.isCID) {
          hasCIDFonts = true;
          break;
        }
      }
    }

    return {
      hasInvisibleText: invisibleTextCount > 0,
      invisibleTextCount,
      visibleTextCount,
      hasVerySmallText,
      uniqueFontCount: usedFonts.size,
      hasCIDFonts,
    };
  }

  /**
   * Analyze image characteristics.
   */
  private analyzeImageCharacteristics(
    operators: Operator[],
    resources?: PageResources,
  ): ImageCharacteristics {
    let imageCount = 0;
    let hasFullPageImage = false;
    let hasInlineImages = false;
    let inlineImageCount = 0;

    for (const op of operators) {
      if (op.op === Op.DrawXObject) {
        const xObjName = this.extractName(op.operands[0]);
        if (resources?.xObjects && xObjName) {
          const info = resources.xObjects.get(xObjName);
          if (info?.subtype === "Image") {
            imageCount++;
            // Check for full-page image
            if (info.width && info.height) {
              const pageArea =
                this.options.pageDimensions.width * this.options.pageDimensions.height;
              const imageArea = info.width * info.height;
              // Consider it full-page if image area is > 80% of page
              if (imageArea > pageArea * 0.8) {
                hasFullPageImage = true;
              }
            }
          }
        }
      } else if (op.op === Op.BeginInlineImage) {
        hasInlineImages = true;
        inlineImageCount++;
      }
    }

    return {
      imageCount,
      hasFullPageImage,
      hasInlineImages,
      inlineImageCount,
    };
  }

  /**
   * Analyze graphics state characteristics.
   */
  private analyzeGraphicsCharacteristics(operators: Operator[]): GraphicsCharacteristics {
    let hasTransparency = false;
    let hasShading = false;
    let hasClipping = false;
    let graphicsStateDepth = 0;
    let maxGraphicsStateDepth = 0;

    for (const op of operators) {
      if (op.op === Op.PushGraphicsState) {
        graphicsStateDepth++;
        maxGraphicsStateDepth = Math.max(maxGraphicsStateDepth, graphicsStateDepth);
      } else if (op.op === Op.PopGraphicsState) {
        graphicsStateDepth = Math.max(0, graphicsStateDepth - 1);
      } else if (op.op === Op.SetGraphicsState) {
        // ExtGState may contain transparency settings
        // Without deep analysis, assume potential transparency
        hasTransparency = true;
      } else if (op.op === Op.PaintShading) {
        hasShading = true;
      } else if (op.op === Op.Clip || op.op === Op.ClipEvenOdd) {
        hasClipping = true;
      }
    }

    return {
      hasTransparency,
      hasShading,
      hasClipping,
      maxGraphicsStateDepth,
    };
  }

  /**
   * Classify the rendering type based on collected statistics.
   */
  private classifyRenderingType(
    composition: ContentComposition,
    text: TextCharacteristics,
    image: ImageCharacteristics,
    graphics: GraphicsCharacteristics,
  ): { renderingType: RenderingType; confidence: number } {
    // OCR detection: invisible text + full page image
    if (text.hasInvisibleText && image.hasFullPageImage) {
      const ratio = text.invisibleTextCount / (text.visibleTextCount + text.invisibleTextCount);
      if (ratio > 0.5) {
        return { renderingType: RenderingType.OCR, confidence: 0.9 };
      }
    }

    // Pure image-based: dominated by images with little/no text
    if (image.hasFullPageImage && composition.textOperatorCount === 0) {
      return { renderingType: RenderingType.ImageBased, confidence: 0.95 };
    }

    // Image-heavy content
    if (composition.imagePercent > 70) {
      return { renderingType: RenderingType.ImageBased, confidence: 0.8 };
    }

    // Flattened detection: complex graphics state with high depth
    if (graphics.maxGraphicsStateDepth > 5 && graphics.hasTransparency) {
      return { renderingType: RenderingType.Flattened, confidence: 0.6 };
    }

    // Pure vector: mostly paths and text, no/few images
    if (
      composition.imagePercent < 10 &&
      (composition.vectorPathPercent > 40 || composition.textPercent > 50)
    ) {
      return { renderingType: RenderingType.Vector, confidence: 0.85 };
    }

    // Hybrid: significant mix of content types
    if (
      composition.imagePercent >= 20 &&
      composition.imagePercent <= 70 &&
      (composition.textPercent >= 20 || composition.vectorPathPercent >= 20)
    ) {
      return { renderingType: RenderingType.Hybrid, confidence: 0.7 };
    }

    // Default to vector for typical document content
    if (composition.textOperatorCount > 0 || composition.pathOperatorCount > 0) {
      return { renderingType: RenderingType.Vector, confidence: 0.5 };
    }

    return { renderingType: RenderingType.Unknown, confidence: 0 };
  }

  /**
   * Generate rendering hints based on analysis results.
   */
  private generateHints(
    renderingType: RenderingType,
    composition: ContentComposition,
    text: TextCharacteristics,
    image: ImageCharacteristics,
  ): RenderingHints {
    const hints: RenderingHints = {
      preferredRenderer: "canvas",
      enableSubpixelText: true,
      enableImageSmoothing: true,
      suggestedScale: 1,
      generateTextLayer: true,
      renderPriority: "balanced",
    };

    switch (renderingType) {
      case RenderingType.Vector:
        // Vector content benefits from SVG for scalability
        hints.preferredRenderer = composition.pathOperatorCount > 100 ? "svg" : "canvas";
        hints.enableSubpixelText = true;
        hints.suggestedScale = 1.5; // Higher scale for crisp vectors
        hints.renderPriority = "text";
        break;

      case RenderingType.ImageBased:
        hints.preferredRenderer = "canvas";
        hints.enableImageSmoothing = true;
        hints.suggestedScale = 1; // Native resolution is fine
        hints.generateTextLayer = false; // No text to select
        hints.renderPriority = "image";
        break;

      case RenderingType.OCR:
        hints.preferredRenderer = "canvas";
        hints.enableImageSmoothing = true;
        hints.suggestedScale = 1;
        hints.generateTextLayer = true; // Need text layer for selection
        hints.renderPriority = "image"; // Show image, but enable text selection
        break;

      case RenderingType.Flattened:
        hints.preferredRenderer = "canvas";
        hints.enableSubpixelText = false; // May cause artifacts
        hints.suggestedScale = 1.25;
        hints.renderPriority = "balanced";
        break;

      case RenderingType.Hybrid:
        hints.preferredRenderer = "canvas";
        hints.suggestedScale = 1.25;
        hints.renderPriority = "balanced";
        break;

      default:
        // Keep defaults
        break;
    }

    // Adjust for CID fonts (CJK text)
    if (text.hasCIDFonts) {
      hints.enableSubpixelText = false; // Can cause rendering issues
    }

    return hints;
  }

  /**
   * Determine if the page should be cached.
   */
  private shouldCachePage(
    renderingType: RenderingType,
    composition: ContentComposition,
    image: ImageCharacteristics,
  ): boolean {
    // Cache image-heavy pages as they're expensive to decode
    if (renderingType === RenderingType.ImageBased || renderingType === RenderingType.OCR) {
      return true;
    }

    // Cache complex vector pages
    if (composition.totalOperatorCount > 1000) {
      return true;
    }

    // Cache pages with many images
    if (image.imageCount > 5) {
      return true;
    }

    return false;
  }

  /**
   * Extract a name value from an operand.
   */
  private extractName(operand: unknown): string | null {
    if (typeof operand === "string") {
      return operand.startsWith("/") ? operand.slice(1) : operand;
    }
    if (operand && typeof operand === "object" && "value" in operand) {
      const value = (operand as { value: unknown }).value;
      if (typeof value === "string") {
        return value;
      }
    }
    return null;
  }
}

/**
 * Create a content analyzer with the given options.
 */
export function createContentAnalyzer(options?: ContentAnalyzerOptions): ContentAnalyzer {
  return new ContentAnalyzer(options);
}

/**
 * Analyze content bytes with default options.
 * Convenience function for simple use cases.
 */
export function analyzeContent(
  contentBytes: Uint8Array,
  resources?: PageResources,
): ContentAnalysisResult {
  const analyzer = new ContentAnalyzer();
  return analyzer.analyze(contentBytes, resources);
}
