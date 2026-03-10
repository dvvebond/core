/**
 * CMap (Character Map) module for handling international character mappings.
 *
 * Provides support for:
 * - CJK (Chinese, Japanese, Korean) character sets
 * - Legacy PDF encodings (WinAnsiEncoding, MacRomanEncoding, etc.)
 * - Custom character mappings
 *
 * @module text/cmap
 */

// Core CMap types and implementation
export {
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
} from "./CMap";

// CJK CMap loading
export {
  CJKCMapLoader,
  BundledCMapProvider,
  CMapLoadError,
  createCJKCMapLoader,
  PREDEFINED_CMAPS,
  type CJKScript,
  type CMapDataProvider,
  type CMapLoadOptions,
  type PredefinedCMapInfo,
} from "./CJKCMapLoader";

// Legacy encoding support
export {
  LegacyCMapSupport,
  createLegacyCMapSupport,
  createLegacyEncodingCMap,
  decodeLegacyByte,
  decodeLegacyBytes,
  glyphNameToUnicode,
  type DifferenceEntry,
  type LegacyEncodingOptions,
  type LegacyEncodingType,
} from "./LegacyCMapSupport";

// CMap registry
export {
  CMapRegistry,
  createCMapRegistry,
  getDefaultRegistry,
  setDefaultRegistry,
  type CMapRegistryEntry,
  type CMapRegistryOptions,
  type CMapRegistryStats,
} from "./CMapRegistry";
