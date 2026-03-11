/**
 * PDF Rendering Type Classification System.
 *
 * Provides enums and interfaces for detecting and classifying PDF content
 * to determine optimal rendering strategies. Different PDF types (vector,
 * image-based, OCR, flattened, hybrid) require different rendering approaches
 * for optimal quality and performance.
 */

/**
 * Primary classification of PDF content rendering type.
 *
 * This enum represents the dominant rendering approach needed for a page
 * based on analysis of its content stream operators and resources.
 */
export enum RenderingType {
  /**
   * Programmatic/vector content - primarily path and text operators.
   * Best rendered with native vector rendering (Canvas 2D or SVG).
   * Examples: Word documents, programmatically generated PDFs.
   */
  Vector = "vector",

  /**
   * Image-based content - primarily XObject image references.
   * May benefit from optimized image handling and caching.
   * Examples: Scanned documents, photo galleries.
   */
  ImageBased = "image-based",

  /**
   * OCR-processed content - invisible or very small text overlaid on images.
   * Requires special handling for text selection while displaying images.
   * Examples: Scanned documents with OCR layer.
   */
  OCR = "ocr",

  /**
   * Flattened content - previously interactive forms or annotations
   * that have been merged into the content stream.
   * May have complex layering and blending.
   */
  Flattened = "flattened",

  /**
   * Hybrid content - significant mix of multiple content types.
   * Requires balanced rendering approach.
   * Examples: Reports with charts and images, presentations.
   */
  Hybrid = "hybrid",

  /**
   * Unknown or unclassifiable content.
   * Falls back to default rendering strategy.
   */
  Unknown = "unknown",
}

/**
 * Detailed breakdown of content composition on a page.
 * Used to make rendering decisions and report page characteristics.
 */
export interface ContentComposition {
  /**
   * Estimated percentage of page covered by vector paths (0-100).
   */
  vectorPathPercent: number;

  /**
   * Estimated percentage of page covered by text (0-100).
   */
  textPercent: number;

  /**
   * Estimated percentage of page covered by images (0-100).
   */
  imagePercent: number;

  /**
   * Total number of path construction operators (m, l, c, v, y, re).
   */
  pathOperatorCount: number;

  /**
   * Total number of text operators (Tj, TJ, ', ").
   */
  textOperatorCount: number;

  /**
   * Total number of XObject references (Do operator).
   */
  xObjectCount: number;

  /**
   * Number of image XObjects referenced.
   */
  imageXObjectCount: number;

  /**
   * Number of form XObjects referenced.
   */
  formXObjectCount: number;

  /**
   * Total number of operators in the content stream.
   */
  totalOperatorCount: number;
}

/**
 * Text rendering characteristics detected on a page.
 * Helps identify OCR content and text rendering modes.
 */
export interface TextCharacteristics {
  /**
   * Whether text rendering mode 3 (invisible) is used.
   * Common indicator of OCR overlay text.
   */
  hasInvisibleText: boolean;

  /**
   * Count of text operations with invisible rendering mode.
   */
  invisibleTextCount: number;

  /**
   * Count of text operations with visible rendering modes.
   */
  visibleTextCount: number;

  /**
   * Whether very small fonts (< 2pt) are detected.
   * Another indicator of OCR or hidden text.
   */
  hasVerySmallText: boolean;

  /**
   * Number of unique fonts referenced.
   */
  uniqueFontCount: number;

  /**
   * Whether the page uses CID fonts (typically for CJK text).
   */
  hasCIDFonts: boolean;
}

/**
 * Image characteristics detected on a page.
 */
export interface ImageCharacteristics {
  /**
   * Total number of images on the page.
   */
  imageCount: number;

  /**
   * Whether a full-page background image is present.
   * Strong indicator of scanned/image-based PDF.
   */
  hasFullPageImage: boolean;

  /**
   * Whether inline images (BI/ID/EI operators) are used.
   */
  hasInlineImages: boolean;

  /**
   * Number of inline images.
   */
  inlineImageCount: number;
}

/**
 * Graphics state characteristics that may indicate special content.
 */
export interface GraphicsCharacteristics {
  /**
   * Whether transparency/blending is used (gs with ca/CA/BM).
   */
  hasTransparency: boolean;

  /**
   * Whether shading patterns are used.
   */
  hasShading: boolean;

  /**
   * Whether clipping paths are used.
   */
  hasClipping: boolean;

  /**
   * Maximum nesting depth of graphics state push/pop.
   */
  maxGraphicsStateDepth: number;
}

/**
 * Complete analysis result for a PDF page.
 */
export interface ContentAnalysisResult {
  /**
   * The classified rendering type for this page.
   */
  renderingType: RenderingType;

  /**
   * Confidence score for the classification (0-1).
   * Higher values indicate more certain classification.
   */
  confidence: number;

  /**
   * Detailed content composition breakdown.
   */
  composition: ContentComposition;

  /**
   * Text rendering characteristics.
   */
  textCharacteristics: TextCharacteristics;

  /**
   * Image characteristics.
   */
  imageCharacteristics: ImageCharacteristics;

  /**
   * Graphics state characteristics.
   */
  graphicsCharacteristics: GraphicsCharacteristics;

  /**
   * Whether this page would benefit from caching.
   */
  shouldCache: boolean;

  /**
   * Suggested rendering hints based on analysis.
   */
  hints: RenderingHints;
}

/**
 * Rendering hints derived from content analysis.
 * Used to configure renderers for optimal output.
 */
export interface RenderingHints {
  /**
   * Preferred renderer type for this content.
   */
  preferredRenderer: "canvas" | "svg";

  /**
   * Whether to enable sub-pixel text rendering.
   */
  enableSubpixelText: boolean;

  /**
   * Whether to enable image smoothing.
   */
  enableImageSmoothing: boolean;

  /**
   * Suggested scale factor for quality vs performance.
   * Higher values for vector, lower for image-heavy content.
   */
  suggestedScale: number;

  /**
   * Whether text layer should be generated for selection.
   */
  generateTextLayer: boolean;

  /**
   * Whether to prioritize text or image rendering.
   */
  renderPriority: "text" | "image" | "balanced";
}

/**
 * Configuration options for the content analyzer.
 */
export interface ContentAnalyzerOptions {
  /**
   * Whether to perform deep analysis of XObject contents.
   * More accurate but slower.
   * @default false
   */
  analyzeXObjects?: boolean;

  /**
   * Maximum operators to analyze before returning early estimate.
   * Set to 0 for unlimited analysis.
   * @default 10000
   */
  maxOperatorsToAnalyze?: number;

  /**
   * Page dimensions for calculating coverage percentages.
   */
  pageDimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Resource information used for content analysis.
 */
export interface PageResources {
  /**
   * Font resource names and types.
   */
  fonts?: Map<string, FontResourceInfo>;

  /**
   * XObject resource names and types.
   */
  xObjects?: Map<string, XObjectResourceInfo>;

  /**
   * ExtGState resource names.
   */
  extGStates?: Set<string>;

  /**
   * Pattern resource names.
   */
  patterns?: Set<string>;

  /**
   * Shading resource names.
   */
  shadings?: Set<string>;
}

/**
 * Font resource information.
 */
export interface FontResourceInfo {
  /**
   * Font subtype (Type0, Type1, TrueType, etc.).
   */
  subtype: string;

  /**
   * Whether this is a CID font.
   */
  isCID: boolean;

  /**
   * Base font name if available.
   */
  baseFont?: string;
}

/**
 * XObject resource information.
 */
export interface XObjectResourceInfo {
  /**
   * XObject subtype (Image, Form, PS).
   */
  subtype: "Image" | "Form" | "PS";

  /**
   * Image dimensions if applicable.
   */
  width?: number;
  height?: number;

  /**
   * Color space if applicable.
   */
  colorSpace?: string;

  /**
   * Bits per component for images.
   */
  bitsPerComponent?: number;
}

/**
 * Create default content analysis result for when analysis fails or is skipped.
 */
export function createDefaultAnalysisResult(): ContentAnalysisResult {
  return {
    renderingType: RenderingType.Unknown,
    confidence: 0,
    composition: {
      vectorPathPercent: 0,
      textPercent: 0,
      imagePercent: 0,
      pathOperatorCount: 0,
      textOperatorCount: 0,
      xObjectCount: 0,
      imageXObjectCount: 0,
      formXObjectCount: 0,
      totalOperatorCount: 0,
    },
    textCharacteristics: {
      hasInvisibleText: false,
      invisibleTextCount: 0,
      visibleTextCount: 0,
      hasVerySmallText: false,
      uniqueFontCount: 0,
      hasCIDFonts: false,
    },
    imageCharacteristics: {
      imageCount: 0,
      hasFullPageImage: false,
      hasInlineImages: false,
      inlineImageCount: 0,
    },
    graphicsCharacteristics: {
      hasTransparency: false,
      hasShading: false,
      hasClipping: false,
      maxGraphicsStateDepth: 0,
    },
    shouldCache: false,
    hints: createDefaultRenderingHints(),
  };
}

/**
 * Create default rendering hints.
 */
export function createDefaultRenderingHints(): RenderingHints {
  return {
    preferredRenderer: "canvas",
    enableSubpixelText: true,
    enableImageSmoothing: true,
    suggestedScale: 1,
    generateTextLayer: true,
    renderPriority: "balanced",
  };
}
