/**
 * Hierarchical text extraction module.
 *
 * Provides comprehensive text extraction with precise bounding boxes
 * at character, word, line, and paragraph levels.
 */

// Types
export type {
  Character,
  Word,
  Line,
  Paragraph,
  TextPage,
  ExtractionOptions,
  DocumentText,
} from "./types";

export { mergeBoundingBoxes, boxesOverlap, horizontalGap, verticalGap } from "./types";

// Content stream parser
export type {
  TextOperation,
  TextStateChange,
  TextMatrixSet,
  TextPositionChange,
  TextShow,
  TextShowItem,
  FontChange,
  GraphicsStateChange,
  TextObjectBoundary,
  TextParseResult,
  TextStateOperator,
  TextPositionOperator,
  TextShowOperator,
  GraphicsOperator,
} from "./content-stream-parser";

export { TextContentStreamParser } from "./content-stream-parser";

// Text positioning
export type { GraphicsState, TextParams, CharacterBBox } from "./text-positioning";

export {
  TextPositionCalculator,
  createDefaultTextParams,
  cloneTextParams,
} from "./text-positioning";

// Text grouping
export { groupCharactersIntoPage } from "./text-grouping";

// Main extractor
export type { HierarchicalTextExtractorOptions, RawExtractionResult } from "./text-extractor";

export { HierarchicalTextExtractor, createHierarchicalTextExtractor } from "./text-extractor";
