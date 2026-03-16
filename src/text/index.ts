/**
 * Text extraction module for PDF documents.
 *
 * Provides functionality to extract text content with position information
 * from PDF pages, and search for text patterns.
 */

export { getPlainText, groupCharsIntoLines, type LineGrouperOptions } from "./line-grouper";
export { TextExtractor, type TextExtractorOptions } from "./text-extractor";
export { searchPage, searchPages } from "./text-search";
export { TextState } from "./text-state";
export * from "./types";

// Hierarchical text extraction module
export {
  // Types
  type Character,
  type Word,
  type Line,
  type Paragraph,
  type TextPage,
  type ExtractionOptions,
  type DocumentText,
  mergeBoundingBoxes,
  boxesOverlap,
  horizontalGap,
  verticalGap,
  // Content stream parser
  TextContentStreamParser,
  type TextOperation,
  type TextStateChange,
  type TextMatrixSet,
  type TextPositionChange,
  type TextShow,
  type TextShowItem,
  type FontChange,
  type GraphicsStateChange,
  type TextObjectBoundary,
  type TextParseResult,
  type TextStateOperator,
  type TextPositionOperator,
  type TextShowOperator,
  type GraphicsOperator,
  // Text positioning
  TextPositionCalculator,
  createDefaultTextParams,
  cloneTextParams,
  type GraphicsState,
  type TextParams,
  type CharacterBBox,
  // Text grouping
  groupCharactersIntoPage,
  // Main extractor
  HierarchicalTextExtractor,
  createHierarchicalTextExtractor,
  type HierarchicalTextExtractorOptions,
  type RawExtractionResult,
} from "./extraction";

// CMap (Character Map) support for international text
export {
  // Core CMap types
  CMap,
  parseCMapData,
  parseCMapText,
  type ICMap,
  type CMapOptions,
  type CMapType,
  type CIDSystemInfo,
  type CharacterMapping,
  type CharacterRangeMapping,
  type CIDMapping,
  type CIDRangeMapping,
  type CodespaceRange,
  type DecodeResult,
  type WritingMode,
  // CJK CMap loading
  CJKCMapLoader,
  BundledCMapProvider,
  CMapLoadError,
  createCJKCMapLoader,
  PREDEFINED_CMAPS,
  type CJKScript,
  type CMapDataProvider,
  type CMapLoadOptions,
  type PredefinedCMapInfo,
  // Legacy encoding support
  LegacyCMapSupport,
  createLegacyCMapSupport,
  createLegacyEncodingCMap,
  decodeLegacyByte,
  decodeLegacyBytes,
  glyphNameToUnicode,
  type DifferenceEntry,
  type LegacyEncodingOptions,
  type LegacyEncodingType,
  // CMap registry
  CMapRegistry,
  createCMapRegistry,
  getDefaultRegistry,
  setDefaultRegistry,
  type CMapRegistryEntry,
  type CMapRegistryOptions,
  type CMapRegistryStats,
} from "./cmap";
