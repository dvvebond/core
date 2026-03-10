/**
 * CMap (Character Map) interfaces and base types for CJK character mappings.
 *
 * CMaps define how character codes map to Unicode code points and CIDs.
 * This module provides types for handling international text, particularly
 * CJK (Chinese, Japanese, Korean) characters in PDF documents.
 *
 * References:
 * - PDF Reference 1.7, Section 5.6.4 (CMaps)
 * - Adobe CMap Specification
 */

/**
 * Codespace range defines the valid range for character codes in a CMap.
 * Each range specifies the byte length and valid code boundaries.
 */
export interface CodespaceRange {
  /** Start of the range (inclusive) */
  low: number;
  /** End of the range (inclusive) */
  high: number;
  /** Number of bytes for codes in this range */
  numBytes: number;
}

/**
 * Mapping from a character code to a Unicode string.
 * Used for both single character mappings and range mappings.
 */
export interface CharacterMapping {
  /** Source character code */
  code: number;
  /** Target Unicode string (can be multiple code points) */
  unicode: string;
}

/**
 * Range mapping for consecutive character codes to Unicode.
 * Maps codes [start, end] to Unicode strings starting at baseUnicode.
 */
export interface CharacterRangeMapping {
  /** Start of the code range (inclusive) */
  start: number;
  /** End of the code range (inclusive) */
  end: number;
  /** Base Unicode code point or string for the range start */
  baseUnicode: string;
}

/**
 * CID (Character ID) mapping for a single code.
 */
export interface CIDMapping {
  /** Source character code */
  code: number;
  /** Target CID */
  cid: number;
}

/**
 * CID range mapping for consecutive character codes.
 */
export interface CIDRangeMapping {
  /** Start of the code range (inclusive) */
  start: number;
  /** End of the code range (inclusive) */
  end: number;
  /** Base CID for the range start */
  baseCID: number;
}

/**
 * Writing mode for the CMap.
 */
export type WritingMode = "horizontal" | "vertical";

/**
 * CMap types based on the encoding system.
 */
export type CMapType =
  | "identity" // Identity-H, Identity-V (direct mapping)
  | "predefined" // Standard Adobe CMaps (UniGB-UCS2-H, etc.)
  | "embedded"; // CMap embedded in the PDF

/**
 * CID system information identifying the character collection.
 */
export interface CIDSystemInfo {
  /** Registry name (e.g., "Adobe") */
  registry: string;
  /** Ordering name (e.g., "GB1", "Japan1", "Korea1", "CNS1") */
  ordering: string;
  /** Supplement number */
  supplement: number;
}

/**
 * Options for creating a CMap instance.
 */
export interface CMapOptions {
  /** CMap name (e.g., "Identity-H", "UniGB-UCS2-H") */
  name: string;
  /** CMap type */
  type: CMapType;
  /** Writing mode */
  writingMode?: WritingMode;
  /** CID system information */
  cidSystemInfo?: CIDSystemInfo;
  /** Codespace ranges */
  codespaceRanges?: CodespaceRange[];
  /** Direct character to Unicode mappings */
  charMappings?: CharacterMapping[];
  /** Range character to Unicode mappings */
  rangeMappings?: CharacterRangeMapping[];
  /** Direct character to CID mappings */
  cidCharMappings?: CIDMapping[];
  /** Range character to CID mappings */
  cidRangeMappings?: CIDRangeMapping[];
}

/**
 * Result of decoding a character code.
 */
export interface DecodeResult {
  /** Decoded Unicode string */
  unicode: string;
  /** Number of bytes consumed */
  bytesConsumed: number;
}

/**
 * Interface for CMap implementations.
 * Provides methods for character code to Unicode/CID conversion.
 */
export interface ICMap {
  /** CMap name */
  readonly name: string;
  /** CMap type */
  readonly type: CMapType;
  /** Writing mode (horizontal or vertical) */
  readonly writingMode: WritingMode;
  /** CID system information (if available) */
  readonly cidSystemInfo: CIDSystemInfo | undefined;

  /**
   * Decode a character code to Unicode.
   * @param code - Character code
   * @returns Unicode string or undefined if no mapping exists
   */
  decodeToUnicode(code: number): string | undefined;

  /**
   * Decode a character code to CID.
   * @param code - Character code
   * @returns CID or 0 if no mapping exists
   */
  decodeToCID(code: number): number;

  /**
   * Read a character code from bytes.
   * @param bytes - Byte array
   * @param offset - Starting offset
   * @returns Character code and number of bytes consumed
   */
  readCharCode(bytes: Uint8Array, offset: number): { code: number; length: number };

  /**
   * Decode a byte string to Unicode.
   * @param bytes - Byte array containing encoded text
   * @returns Decoded Unicode string
   */
  decodeString(bytes: Uint8Array): string;

  /**
   * Check if a character code is valid in this CMap's codespace.
   * @param code - Character code to check
   * @returns true if the code is valid
   */
  isValidCode(code: number): boolean;
}

/**
 * CMap implementation for handling character mappings.
 */
export class CMap implements ICMap {
  readonly name: string;
  readonly type: CMapType;
  readonly writingMode: WritingMode;
  readonly cidSystemInfo: CIDSystemInfo | undefined;

  private readonly codespaceRanges: CodespaceRange[];
  private readonly charToUnicode: Map<number, string>;
  private readonly rangeToUnicode: CharacterRangeMapping[];
  private readonly charToCID: Map<number, number>;
  private readonly rangeToCID: CIDRangeMapping[];

  constructor(options: CMapOptions) {
    this.name = options.name;
    this.type = options.type;
    this.writingMode = options.writingMode ?? "horizontal";
    this.cidSystemInfo = options.cidSystemInfo;
    this.codespaceRanges = options.codespaceRanges ?? [];

    // Build character to Unicode map
    this.charToUnicode = new Map();
    for (const mapping of options.charMappings ?? []) {
      this.charToUnicode.set(mapping.code, mapping.unicode);
    }

    this.rangeToUnicode = options.rangeMappings ?? [];

    // Build character to CID map
    this.charToCID = new Map();
    for (const mapping of options.cidCharMappings ?? []) {
      this.charToCID.set(mapping.code, mapping.cid);
    }

    this.rangeToCID = options.cidRangeMappings ?? [];
  }

  decodeToUnicode(code: number): string | undefined {
    // For identity CMaps, the code is the Unicode code point
    if (this.type === "identity") {
      return String.fromCodePoint(code);
    }

    // Check direct mappings first
    const direct = this.charToUnicode.get(code);
    if (direct !== undefined) {
      return direct;
    }

    // Check range mappings
    for (const range of this.rangeToUnicode) {
      if (code >= range.start && code <= range.end) {
        const offset = code - range.start;
        const baseCodePoint = range.baseUnicode.codePointAt(0) ?? 0;
        return String.fromCodePoint(baseCodePoint + offset);
      }
    }

    return undefined;
  }

  decodeToCID(code: number): number {
    // For identity CMaps, code = CID
    if (this.type === "identity") {
      return code;
    }

    // Check direct mappings first
    const direct = this.charToCID.get(code);
    if (direct !== undefined) {
      return direct;
    }

    // Check range mappings
    for (const range of this.rangeToCID) {
      if (code >= range.start && code <= range.end) {
        return range.baseCID + (code - range.start);
      }
    }

    return 0;
  }

  readCharCode(bytes: Uint8Array, offset: number): { code: number; length: number } {
    // For identity CMaps, always read 2 bytes
    if (this.type === "identity") {
      if (offset + 1 >= bytes.length) {
        return { code: bytes[offset] ?? 0, length: 1 };
      }
      const code = (bytes[offset] << 8) | bytes[offset + 1];
      return { code, length: 2 };
    }

    // Try each codespace range to find matching length
    for (let numBytes = 1; numBytes <= 4 && offset + numBytes <= bytes.length; numBytes++) {
      let code = 0;
      for (let i = 0; i < numBytes; i++) {
        code = (code << 8) | bytes[offset + i];
      }

      for (const range of this.codespaceRanges) {
        if (range.numBytes === numBytes && code >= range.low && code <= range.high) {
          return { code, length: numBytes };
        }
      }
    }

    // Default to 1 byte
    return { code: bytes[offset] ?? 0, length: 1 };
  }

  decodeString(bytes: Uint8Array): string {
    let result = "";
    let offset = 0;

    while (offset < bytes.length) {
      const { code, length } = this.readCharCode(bytes, offset);
      const unicode = this.decodeToUnicode(code);
      if (unicode !== undefined) {
        result += unicode;
      }
      offset += length;
    }

    return result;
  }

  isValidCode(code: number): boolean {
    if (this.codespaceRanges.length === 0) {
      return true;
    }

    for (const range of this.codespaceRanges) {
      if (code >= range.low && code <= range.high) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all codespace ranges.
   */
  getCodespaceRanges(): readonly CodespaceRange[] {
    return this.codespaceRanges;
  }

  /**
   * Create an Identity-H CMap (horizontal writing, identity mapping).
   */
  static identityH(): CMap {
    return new CMap({
      name: "Identity-H",
      type: "identity",
      writingMode: "horizontal",
      codespaceRanges: [{ low: 0x0000, high: 0xffff, numBytes: 2 }],
    });
  }

  /**
   * Create an Identity-V CMap (vertical writing, identity mapping).
   */
  static identityV(): CMap {
    return new CMap({
      name: "Identity-V",
      type: "identity",
      writingMode: "vertical",
      codespaceRanges: [{ low: 0x0000, high: 0xffff, numBytes: 2 }],
    });
  }
}

/**
 * Parse CMap data from a byte array.
 * Handles both inline CMaps and CMap streams.
 *
 * @param data - Raw CMap data
 * @param name - Optional name for the CMap
 * @returns Parsed CMap instance
 */
export function parseCMapData(data: Uint8Array, name?: string): CMap {
  const text = bytesToLatin1(data);
  return parseCMapText(text, name);
}

/**
 * Parse CMap from text content.
 *
 * @param text - CMap text content
 * @param name - Optional name for the CMap
 * @returns Parsed CMap instance
 */
export function parseCMapText(text: string, name?: string): CMap {
  const codespaceRanges: CodespaceRange[] = [];
  const charMappings: CharacterMapping[] = [];
  const rangeMappings: CharacterRangeMapping[] = [];
  const cidCharMappings: CIDMapping[] = [];
  const cidRangeMappings: CIDRangeMapping[] = [];

  let cmapName = name ?? "";
  let writingMode: WritingMode = "horizontal";
  let cidSystemInfo: CIDSystemInfo | undefined;

  // Parse CMap name
  const nameMatch = text.match(/\/CMapName\s+\/(\S+)/);
  if (nameMatch) {
    cmapName = nameMatch[1];
  }

  // Parse WMode (writing mode)
  const wmodeMatch = text.match(/\/WMode\s+(\d)/);
  if (wmodeMatch) {
    writingMode = wmodeMatch[1] === "1" ? "vertical" : "horizontal";
  }

  // Parse CIDSystemInfo
  const registryMatch = text.match(/\/Registry\s+\(([^)]+)\)/);
  const orderingMatch = text.match(/\/Ordering\s+\(([^)]+)\)/);
  const supplementMatch = text.match(/\/Supplement\s+(\d+)/);
  if (registryMatch && orderingMatch) {
    cidSystemInfo = {
      registry: registryMatch[1],
      ordering: orderingMatch[1],
      supplement: supplementMatch ? parseInt(supplementMatch[1], 10) : 0,
    };
  }

  // Determine CMap type
  const isIdentity = cmapName === "Identity-H" || cmapName === "Identity-V";
  const type: CMapType = isIdentity ? "identity" : "embedded";

  // Parse codespace ranges
  parseCodespaceRanges(text, codespaceRanges);

  // Parse bfchar (character to Unicode mappings)
  parseBfCharSections(text, charMappings);

  // Parse bfrange (range to Unicode mappings)
  parseBfRangeSections(text, rangeMappings);

  // Parse cidchar (character to CID mappings)
  parseCidCharSections(text, cidCharMappings);

  // Parse cidrange (range to CID mappings)
  parseCidRangeSections(text, cidRangeMappings);

  return new CMap({
    name: cmapName,
    type,
    writingMode,
    cidSystemInfo,
    codespaceRanges,
    charMappings,
    rangeMappings,
    cidCharMappings,
    cidRangeMappings,
  });
}

/**
 * Parse codespace ranges from CMap text.
 */
function parseCodespaceRanges(text: string, ranges: CodespaceRange[]): void {
  const sectionRegex = /begincodespacerange\s*([\s\S]*?)\s*endcodespacerange/g;

  for (const match of text.matchAll(sectionRegex)) {
    const content = match[1];
    const pairRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;

    for (const pairMatch of content.matchAll(pairRegex)) {
      const low = parseInt(pairMatch[1], 16);
      const high = parseInt(pairMatch[2], 16);
      const numBytes = Math.ceil(Math.max(pairMatch[1].length, pairMatch[2].length) / 2);
      ranges.push({ low, high, numBytes });
    }
  }
}

/**
 * Parse bfchar sections (character to Unicode mappings).
 */
function parseBfCharSections(text: string, mappings: CharacterMapping[]): void {
  const sectionRegex = /beginbfchar\s*([\s\S]*?)\s*endbfchar/g;

  for (const match of text.matchAll(sectionRegex)) {
    const content = match[1];
    const pairRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;

    for (const pairMatch of content.matchAll(pairRegex)) {
      const code = parseInt(pairMatch[1], 16);
      const unicode = hexToUnicodeString(pairMatch[2]);
      mappings.push({ code, unicode });
    }
  }
}

/**
 * Parse bfrange sections (range to Unicode mappings).
 */
function parseBfRangeSections(text: string, mappings: CharacterRangeMapping[]): void {
  const sectionRegex = /beginbfrange\s*([\s\S]*?)\s*endbfrange/g;

  for (const match of text.matchAll(sectionRegex)) {
    const content = match[1];
    // Match both <start> <end> <baseUnicode> and <start> <end> [array] formats
    const rangeRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g;

    for (const rangeMatch of content.matchAll(rangeRegex)) {
      const start = parseInt(rangeMatch[1], 16);
      const end = parseInt(rangeMatch[2], 16);

      if (rangeMatch[3]) {
        // Single base Unicode value
        const baseUnicode = hexToUnicodeString(rangeMatch[3]);
        mappings.push({ start, end, baseUnicode });
      } else if (rangeMatch[4]) {
        // Array of Unicode values - expand to individual mappings
        const arrayContent = rangeMatch[4];
        const valueRegex = /<([0-9A-Fa-f]+)>/g;
        let code = start;
        for (const valueMatch of arrayContent.matchAll(valueRegex)) {
          if (code <= end) {
            const unicode = hexToUnicodeString(valueMatch[1]);
            // For arrays, each code maps to a specific value
            mappings.push({ start: code, end: code, baseUnicode: unicode });
            code++;
          }
        }
      }
    }
  }
}

/**
 * Parse cidchar sections (character to CID mappings).
 */
function parseCidCharSections(text: string, mappings: CIDMapping[]): void {
  const sectionRegex = /begincidchar\s*([\s\S]*?)\s*endcidchar/g;

  for (const match of text.matchAll(sectionRegex)) {
    const content = match[1];
    const pairRegex = /<([0-9A-Fa-f]+)>\s+(\d+)/g;

    for (const pairMatch of content.matchAll(pairRegex)) {
      const code = parseInt(pairMatch[1], 16);
      const cid = parseInt(pairMatch[2], 10);
      mappings.push({ code, cid });
    }
  }
}

/**
 * Parse cidrange sections (range to CID mappings).
 */
function parseCidRangeSections(text: string, mappings: CIDRangeMapping[]): void {
  const sectionRegex = /begincidrange\s*([\s\S]*?)\s*endcidrange/g;

  for (const match of text.matchAll(sectionRegex)) {
    const content = match[1];
    const rangeRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s+(\d+)/g;

    for (const rangeMatch of content.matchAll(rangeRegex)) {
      const start = parseInt(rangeMatch[1], 16);
      const end = parseInt(rangeMatch[2], 16);
      const baseCID = parseInt(rangeMatch[3], 10);
      mappings.push({ start, end, baseCID });
    }
  }
}

/**
 * Convert hex string to Unicode string.
 * Handles both single-byte and multi-byte encodings.
 */
function hexToUnicodeString(hex: string): string {
  // Pad to even length
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }

  // For 2-byte values, interpret as single code point
  if (hex.length <= 4) {
    const codePoint = parseInt(hex, 16);
    return String.fromCodePoint(codePoint);
  }

  // For longer values, interpret as sequence of 2-byte code points
  let result = "";
  for (let i = 0; i < hex.length; i += 4) {
    const chunk = hex.slice(i, i + 4).padStart(4, "0");
    const codePoint = parseInt(chunk, 16);
    result += String.fromCodePoint(codePoint);
  }

  return result;
}

/**
 * Convert bytes to Latin-1 string.
 */
function bytesToLatin1(data: Uint8Array): string {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data[i]);
  }
  return result;
}
