/**
 * Legacy CMap Support - Handling legacy PDF encodings.
 *
 * Provides support for converting legacy PDF encodings to Unicode.
 * Handles:
 * - MacRomanEncoding
 * - WinAnsiEncoding
 * - StandardEncoding
 * - MacExpertEncoding
 * - Custom PDF encodings with /Differences arrays
 *
 * References:
 * - PDF Reference 1.7, Section 5.5.5 (Character Encoding)
 * - Adobe Glyph List Specification
 */

import { CMap, type CMapOptions, type CharacterMapping, type CodespaceRange } from "./CMap";

/**
 * Supported legacy encoding types.
 */
export type LegacyEncodingType =
  | "MacRomanEncoding"
  | "WinAnsiEncoding"
  | "StandardEncoding"
  | "MacExpertEncoding"
  | "PDFDocEncoding"
  | "custom";

/**
 * Difference entry for custom encodings.
 * Format: [startCode, glyphName1, glyphName2, ...]
 */
export type DifferenceEntry = number | string;

/**
 * Options for creating a legacy encoding CMap.
 */
export interface LegacyEncodingOptions {
  /** Base encoding type */
  baseEncoding?: LegacyEncodingType;
  /** Differences array for custom modifications */
  differences?: DifferenceEntry[];
  /** Custom name for the encoding */
  name?: string;
}

/**
 * Standard encoding tables for legacy PDF encodings.
 * Maps character code (0-255) to Unicode code point.
 */

// WinAnsiEncoding (based on Windows code page 1252)
const WIN_ANSI_TO_UNICODE: (number | undefined)[] = [
  // 0x00-0x1F: Control characters (undefined in PDF)
  ...Array(32).fill(undefined),
  // 0x20-0x7F: ASCII
  0x0020,
  0x0021,
  0x0022,
  0x0023,
  0x0024,
  0x0025,
  0x0026,
  0x0027,
  0x0028,
  0x0029,
  0x002a,
  0x002b,
  0x002c,
  0x002d,
  0x002e,
  0x002f,
  0x0030,
  0x0031,
  0x0032,
  0x0033,
  0x0034,
  0x0035,
  0x0036,
  0x0037,
  0x0038,
  0x0039,
  0x003a,
  0x003b,
  0x003c,
  0x003d,
  0x003e,
  0x003f,
  0x0040,
  0x0041,
  0x0042,
  0x0043,
  0x0044,
  0x0045,
  0x0046,
  0x0047,
  0x0048,
  0x0049,
  0x004a,
  0x004b,
  0x004c,
  0x004d,
  0x004e,
  0x004f,
  0x0050,
  0x0051,
  0x0052,
  0x0053,
  0x0054,
  0x0055,
  0x0056,
  0x0057,
  0x0058,
  0x0059,
  0x005a,
  0x005b,
  0x005c,
  0x005d,
  0x005e,
  0x005f,
  0x0060,
  0x0061,
  0x0062,
  0x0063,
  0x0064,
  0x0065,
  0x0066,
  0x0067,
  0x0068,
  0x0069,
  0x006a,
  0x006b,
  0x006c,
  0x006d,
  0x006e,
  0x006f,
  0x0070,
  0x0071,
  0x0072,
  0x0073,
  0x0074,
  0x0075,
  0x0076,
  0x0077,
  0x0078,
  0x0079,
  0x007a,
  0x007b,
  0x007c,
  0x007d,
  0x007e,
  0x2022,
  // 0x80-0x9F: Special PDF mappings
  0x20ac,
  0x2022,
  0x201a,
  0x0192,
  0x201e,
  0x2026,
  0x2020,
  0x2021,
  0x02c6,
  0x2030,
  0x0160,
  0x2039,
  0x0152,
  0x2022,
  0x017d,
  0x2022,
  0x2022,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2022,
  0x2013,
  0x2014,
  0x02dc,
  0x2122,
  0x0161,
  0x203a,
  0x0153,
  0x2022,
  0x017e,
  0x0178,
  // 0xA0-0xFF: Latin-1 Supplement
  0x00a0,
  0x00a1,
  0x00a2,
  0x00a3,
  0x00a4,
  0x00a5,
  0x00a6,
  0x00a7,
  0x00a8,
  0x00a9,
  0x00aa,
  0x00ab,
  0x00ac,
  0x00ad,
  0x00ae,
  0x00af,
  0x00b0,
  0x00b1,
  0x00b2,
  0x00b3,
  0x00b4,
  0x00b5,
  0x00b6,
  0x00b7,
  0x00b8,
  0x00b9,
  0x00ba,
  0x00bb,
  0x00bc,
  0x00bd,
  0x00be,
  0x00bf,
  0x00c0,
  0x00c1,
  0x00c2,
  0x00c3,
  0x00c4,
  0x00c5,
  0x00c6,
  0x00c7,
  0x00c8,
  0x00c9,
  0x00ca,
  0x00cb,
  0x00cc,
  0x00cd,
  0x00ce,
  0x00cf,
  0x00d0,
  0x00d1,
  0x00d2,
  0x00d3,
  0x00d4,
  0x00d5,
  0x00d6,
  0x00d7,
  0x00d8,
  0x00d9,
  0x00da,
  0x00db,
  0x00dc,
  0x00dd,
  0x00de,
  0x00df,
  0x00e0,
  0x00e1,
  0x00e2,
  0x00e3,
  0x00e4,
  0x00e5,
  0x00e6,
  0x00e7,
  0x00e8,
  0x00e9,
  0x00ea,
  0x00eb,
  0x00ec,
  0x00ed,
  0x00ee,
  0x00ef,
  0x00f0,
  0x00f1,
  0x00f2,
  0x00f3,
  0x00f4,
  0x00f5,
  0x00f6,
  0x00f7,
  0x00f8,
  0x00f9,
  0x00fa,
  0x00fb,
  0x00fc,
  0x00fd,
  0x00fe,
  0x00ff,
];

// MacRomanEncoding (classic Mac OS encoding)
const MAC_ROMAN_TO_UNICODE: (number | undefined)[] = [
  // 0x00-0x1F: Control characters
  ...Array(32).fill(undefined),
  // 0x20-0x7E: ASCII
  0x0020,
  0x0021,
  0x0022,
  0x0023,
  0x0024,
  0x0025,
  0x0026,
  0x0027,
  0x0028,
  0x0029,
  0x002a,
  0x002b,
  0x002c,
  0x002d,
  0x002e,
  0x002f,
  0x0030,
  0x0031,
  0x0032,
  0x0033,
  0x0034,
  0x0035,
  0x0036,
  0x0037,
  0x0038,
  0x0039,
  0x003a,
  0x003b,
  0x003c,
  0x003d,
  0x003e,
  0x003f,
  0x0040,
  0x0041,
  0x0042,
  0x0043,
  0x0044,
  0x0045,
  0x0046,
  0x0047,
  0x0048,
  0x0049,
  0x004a,
  0x004b,
  0x004c,
  0x004d,
  0x004e,
  0x004f,
  0x0050,
  0x0051,
  0x0052,
  0x0053,
  0x0054,
  0x0055,
  0x0056,
  0x0057,
  0x0058,
  0x0059,
  0x005a,
  0x005b,
  0x005c,
  0x005d,
  0x005e,
  0x005f,
  0x0060,
  0x0061,
  0x0062,
  0x0063,
  0x0064,
  0x0065,
  0x0066,
  0x0067,
  0x0068,
  0x0069,
  0x006a,
  0x006b,
  0x006c,
  0x006d,
  0x006e,
  0x006f,
  0x0070,
  0x0071,
  0x0072,
  0x0073,
  0x0074,
  0x0075,
  0x0076,
  0x0077,
  0x0078,
  0x0079,
  0x007a,
  0x007b,
  0x007c,
  0x007d,
  0x007e,
  undefined,
  // 0x80-0xFF: MacRoman high characters
  0x00c4,
  0x00c5,
  0x00c7,
  0x00c9,
  0x00d1,
  0x00d6,
  0x00dc,
  0x00e1,
  0x00e0,
  0x00e2,
  0x00e4,
  0x00e3,
  0x00e5,
  0x00e7,
  0x00e9,
  0x00e8,
  0x00ea,
  0x00eb,
  0x00ed,
  0x00ec,
  0x00ee,
  0x00ef,
  0x00f1,
  0x00f3,
  0x00f2,
  0x00f4,
  0x00f6,
  0x00f5,
  0x00fa,
  0x00f9,
  0x00fb,
  0x00fc,
  0x2020,
  0x00b0,
  0x00a2,
  0x00a3,
  0x00a7,
  0x2022,
  0x00b6,
  0x00df,
  0x00ae,
  0x00a9,
  0x2122,
  0x00b4,
  0x00a8,
  0x2260,
  0x00c6,
  0x00d8,
  0x221e,
  0x00b1,
  0x2264,
  0x2265,
  0x00a5,
  0x00b5,
  0x2202,
  0x2211,
  0x220f,
  0x03c0,
  0x222b,
  0x00aa,
  0x00ba,
  0x03a9,
  0x00e6,
  0x00f8,
  0x00bf,
  0x00a1,
  0x00ac,
  0x221a,
  0x0192,
  0x2248,
  0x2206,
  0x00ab,
  0x00bb,
  0x2026,
  0x00a0,
  0x00c0,
  0x00c3,
  0x00d5,
  0x0152,
  0x0153,
  0x2013,
  0x2014,
  0x201c,
  0x201d,
  0x2018,
  0x2019,
  0x00f7,
  0x25ca,
  0x00ff,
  0x0178,
  0x2044,
  0x20ac,
  0x2039,
  0x203a,
  0xfb01,
  0xfb02,
  0x2021,
  0x00b7,
  0x201a,
  0x201e,
  0x2030,
  0x00c2,
  0x00ca,
  0x00c1,
  0x00cb,
  0x00c8,
  0x00cd,
  0x00ce,
  0x00cf,
  0x00cc,
  0x00d3,
  0x00d4,
  0xf8ff,
  0x00d2,
  0x00da,
  0x00db,
  0x00d9,
  0x0131,
  0x02c6,
  0x02dc,
  0x00af,
  0x02d8,
  0x02d9,
  0x02da,
  0x00b8,
  0x02dd,
  0x02db,
  0x02c7,
];

// StandardEncoding (Adobe Standard Encoding)
const STANDARD_TO_UNICODE: (number | undefined)[] = [
  // 0x00-0x1F: Control characters
  ...Array(32).fill(undefined),
  // 0x20-0x7F: Mixed ASCII and special characters
  0x0020,
  0x0021,
  0x0022,
  0x0023,
  0x0024,
  0x0025,
  0x0026,
  0x2019,
  0x0028,
  0x0029,
  0x002a,
  0x002b,
  0x002c,
  0x002d,
  0x002e,
  0x002f,
  0x0030,
  0x0031,
  0x0032,
  0x0033,
  0x0034,
  0x0035,
  0x0036,
  0x0037,
  0x0038,
  0x0039,
  0x003a,
  0x003b,
  0x003c,
  0x003d,
  0x003e,
  0x003f,
  0x0040,
  0x0041,
  0x0042,
  0x0043,
  0x0044,
  0x0045,
  0x0046,
  0x0047,
  0x0048,
  0x0049,
  0x004a,
  0x004b,
  0x004c,
  0x004d,
  0x004e,
  0x004f,
  0x0050,
  0x0051,
  0x0052,
  0x0053,
  0x0054,
  0x0055,
  0x0056,
  0x0057,
  0x0058,
  0x0059,
  0x005a,
  0x005b,
  0x005c,
  0x005d,
  0x005e,
  0x005f,
  0x2018,
  0x0061,
  0x0062,
  0x0063,
  0x0064,
  0x0065,
  0x0066,
  0x0067,
  0x0068,
  0x0069,
  0x006a,
  0x006b,
  0x006c,
  0x006d,
  0x006e,
  0x006f,
  0x0070,
  0x0071,
  0x0072,
  0x0073,
  0x0074,
  0x0075,
  0x0076,
  0x0077,
  0x0078,
  0x0079,
  0x007a,
  0x007b,
  0x007c,
  0x007d,
  0x007e,
  undefined,
  // 0x80-0xFF: Special characters
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  0x00a1,
  0x00a2,
  0x00a3,
  0x2044,
  0x00a5,
  0x0192,
  0x00a7,
  0x00a4,
  0x0027,
  0x201c,
  0x00ab,
  0x2039,
  0x203a,
  0xfb01,
  0xfb02,
  undefined,
  0x2013,
  0x2020,
  0x2021,
  0x00b7,
  undefined,
  0x00b6,
  0x2022,
  0x201a,
  0x201e,
  0x201d,
  0x00bb,
  0x2026,
  0x2030,
  undefined,
  0x00bf,
  undefined,
  0x0060,
  0x00b4,
  0x02c6,
  0x02dc,
  0x00af,
  0x02d8,
  0x02d9,
  0x00a8,
  undefined,
  0x02da,
  0x00b8,
  undefined,
  0x02dd,
  0x02db,
  0x02c7,
  0x2014,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  0x00c6,
  undefined,
  0x00aa,
  undefined,
  undefined,
  undefined,
  undefined,
  0x0141,
  0x00d8,
  0x0152,
  0x00ba,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  0x00e6,
  undefined,
  undefined,
  undefined,
  0x0131,
  undefined,
  undefined,
  0x0142,
  0x00f8,
  0x0153,
  0x00df,
  undefined,
  undefined,
  undefined,
  undefined,
];

// PDFDocEncoding (for PDF document info strings)
const PDF_DOC_TO_UNICODE: (number | undefined)[] = [
  // 0x00-0x17: Control characters
  ...Array(24).fill(undefined),
  // 0x18-0x1F: Special characters
  0x02d8,
  0x02c7,
  0x02c6,
  0x02d9,
  0x02dd,
  0x02db,
  0x02da,
  0x02dc,
  // 0x20-0x7F: ASCII
  0x0020,
  0x0021,
  0x0022,
  0x0023,
  0x0024,
  0x0025,
  0x0026,
  0x0027,
  0x0028,
  0x0029,
  0x002a,
  0x002b,
  0x002c,
  0x002d,
  0x002e,
  0x002f,
  0x0030,
  0x0031,
  0x0032,
  0x0033,
  0x0034,
  0x0035,
  0x0036,
  0x0037,
  0x0038,
  0x0039,
  0x003a,
  0x003b,
  0x003c,
  0x003d,
  0x003e,
  0x003f,
  0x0040,
  0x0041,
  0x0042,
  0x0043,
  0x0044,
  0x0045,
  0x0046,
  0x0047,
  0x0048,
  0x0049,
  0x004a,
  0x004b,
  0x004c,
  0x004d,
  0x004e,
  0x004f,
  0x0050,
  0x0051,
  0x0052,
  0x0053,
  0x0054,
  0x0055,
  0x0056,
  0x0057,
  0x0058,
  0x0059,
  0x005a,
  0x005b,
  0x005c,
  0x005d,
  0x005e,
  0x005f,
  0x0060,
  0x0061,
  0x0062,
  0x0063,
  0x0064,
  0x0065,
  0x0066,
  0x0067,
  0x0068,
  0x0069,
  0x006a,
  0x006b,
  0x006c,
  0x006d,
  0x006e,
  0x006f,
  0x0070,
  0x0071,
  0x0072,
  0x0073,
  0x0074,
  0x0075,
  0x0076,
  0x0077,
  0x0078,
  0x0079,
  0x007a,
  0x007b,
  0x007c,
  0x007d,
  0x007e,
  undefined,
  // 0x80-0x9F: PDF-specific characters
  0x2022,
  0x2020,
  0x2021,
  0x2026,
  0x2014,
  0x2013,
  0x0192,
  0x2044,
  0x2039,
  0x203a,
  0x2212,
  0x2030,
  0x201e,
  0x201c,
  0x201d,
  0x2018,
  0x2019,
  0x201a,
  0x2122,
  0xfb01,
  0xfb02,
  0x0141,
  0x0152,
  0x0160,
  0x0178,
  0x017d,
  0x0131,
  0x0142,
  0x0153,
  0x0161,
  0x017e,
  undefined,
  // 0xA0-0xFF: Latin-1 Supplement (same as Unicode)
  0x20ac,
  0x00a1,
  0x00a2,
  0x00a3,
  0x00a4,
  0x00a5,
  0x00a6,
  0x00a7,
  0x00a8,
  0x00a9,
  0x00aa,
  0x00ab,
  0x00ac,
  undefined,
  0x00ae,
  0x00af,
  0x00b0,
  0x00b1,
  0x00b2,
  0x00b3,
  0x00b4,
  0x00b5,
  0x00b6,
  0x00b7,
  0x00b8,
  0x00b9,
  0x00ba,
  0x00bb,
  0x00bc,
  0x00bd,
  0x00be,
  0x00bf,
  0x00c0,
  0x00c1,
  0x00c2,
  0x00c3,
  0x00c4,
  0x00c5,
  0x00c6,
  0x00c7,
  0x00c8,
  0x00c9,
  0x00ca,
  0x00cb,
  0x00cc,
  0x00cd,
  0x00ce,
  0x00cf,
  0x00d0,
  0x00d1,
  0x00d2,
  0x00d3,
  0x00d4,
  0x00d5,
  0x00d6,
  0x00d7,
  0x00d8,
  0x00d9,
  0x00da,
  0x00db,
  0x00dc,
  0x00dd,
  0x00de,
  0x00df,
  0x00e0,
  0x00e1,
  0x00e2,
  0x00e3,
  0x00e4,
  0x00e5,
  0x00e6,
  0x00e7,
  0x00e8,
  0x00e9,
  0x00ea,
  0x00eb,
  0x00ec,
  0x00ed,
  0x00ee,
  0x00ef,
  0x00f0,
  0x00f1,
  0x00f2,
  0x00f3,
  0x00f4,
  0x00f5,
  0x00f6,
  0x00f7,
  0x00f8,
  0x00f9,
  0x00fa,
  0x00fb,
  0x00fc,
  0x00fd,
  0x00fe,
  0x00ff,
];

/**
 * Common glyph name to Unicode mappings.
 * Subset of the Adobe Glyph List for frequently used glyphs.
 */
const GLYPH_TO_UNICODE: Record<string, number> = {
  // Basic Latin
  space: 0x0020,
  exclam: 0x0021,
  quotedbl: 0x0022,
  numbersign: 0x0023,
  dollar: 0x0024,
  percent: 0x0025,
  ampersand: 0x0026,
  quotesingle: 0x0027,
  parenleft: 0x0028,
  parenright: 0x0029,
  asterisk: 0x002a,
  plus: 0x002b,
  comma: 0x002c,
  hyphen: 0x002d,
  period: 0x002e,
  slash: 0x002f,
  zero: 0x0030,
  one: 0x0031,
  two: 0x0032,
  three: 0x0033,
  four: 0x0034,
  five: 0x0035,
  six: 0x0036,
  seven: 0x0037,
  eight: 0x0038,
  nine: 0x0039,
  colon: 0x003a,
  semicolon: 0x003b,
  less: 0x003c,
  equal: 0x003d,
  greater: 0x003e,
  question: 0x003f,
  at: 0x0040,
  A: 0x0041,
  B: 0x0042,
  C: 0x0043,
  D: 0x0044,
  E: 0x0045,
  F: 0x0046,
  G: 0x0047,
  H: 0x0048,
  I: 0x0049,
  J: 0x004a,
  K: 0x004b,
  L: 0x004c,
  M: 0x004d,
  N: 0x004e,
  O: 0x004f,
  P: 0x0050,
  Q: 0x0051,
  R: 0x0052,
  S: 0x0053,
  T: 0x0054,
  U: 0x0055,
  V: 0x0056,
  W: 0x0057,
  X: 0x0058,
  Y: 0x0059,
  Z: 0x005a,
  bracketleft: 0x005b,
  backslash: 0x005c,
  bracketright: 0x005d,
  asciicircum: 0x005e,
  underscore: 0x005f,
  grave: 0x0060,
  a: 0x0061,
  b: 0x0062,
  c: 0x0063,
  d: 0x0064,
  e: 0x0065,
  f: 0x0066,
  g: 0x0067,
  h: 0x0068,
  i: 0x0069,
  j: 0x006a,
  k: 0x006b,
  l: 0x006c,
  m: 0x006d,
  n: 0x006e,
  o: 0x006f,
  p: 0x0070,
  q: 0x0071,
  r: 0x0072,
  s: 0x0073,
  t: 0x0074,
  u: 0x0075,
  v: 0x0076,
  w: 0x0077,
  x: 0x0078,
  y: 0x0079,
  z: 0x007a,
  braceleft: 0x007b,
  bar: 0x007c,
  braceright: 0x007d,
  asciitilde: 0x007e,

  // Latin-1 Supplement
  exclamdown: 0x00a1,
  cent: 0x00a2,
  sterling: 0x00a3,
  currency: 0x00a4,
  yen: 0x00a5,
  brokenbar: 0x00a6,
  section: 0x00a7,
  dieresis: 0x00a8,
  copyright: 0x00a9,
  ordfeminine: 0x00aa,
  guillemotleft: 0x00ab,
  logicalnot: 0x00ac,
  registered: 0x00ae,
  macron: 0x00af,
  degree: 0x00b0,
  plusminus: 0x00b1,
  twosuperior: 0x00b2,
  threesuperior: 0x00b3,
  acute: 0x00b4,
  mu: 0x00b5,
  paragraph: 0x00b6,
  periodcentered: 0x00b7,
  cedilla: 0x00b8,
  onesuperior: 0x00b9,
  ordmasculine: 0x00ba,
  guillemotright: 0x00bb,
  onequarter: 0x00bc,
  onehalf: 0x00bd,
  threequarters: 0x00be,
  questiondown: 0x00bf,

  // Latin Extended-A
  Agrave: 0x00c0,
  Aacute: 0x00c1,
  Acircumflex: 0x00c2,
  Atilde: 0x00c3,
  Adieresis: 0x00c4,
  Aring: 0x00c5,
  AE: 0x00c6,
  Ccedilla: 0x00c7,
  Egrave: 0x00c8,
  Eacute: 0x00c9,
  Ecircumflex: 0x00ca,
  Edieresis: 0x00cb,
  Igrave: 0x00cc,
  Iacute: 0x00cd,
  Icircumflex: 0x00ce,
  Idieresis: 0x00cf,
  Eth: 0x00d0,
  Ntilde: 0x00d1,
  Ograve: 0x00d2,
  Oacute: 0x00d3,
  Ocircumflex: 0x00d4,
  Otilde: 0x00d5,
  Odieresis: 0x00d6,
  multiply: 0x00d7,
  Oslash: 0x00d8,
  Ugrave: 0x00d9,
  Uacute: 0x00da,
  Ucircumflex: 0x00db,
  Udieresis: 0x00dc,
  Yacute: 0x00dd,
  Thorn: 0x00de,
  germandbls: 0x00df,
  agrave: 0x00e0,
  aacute: 0x00e1,
  acircumflex: 0x00e2,
  atilde: 0x00e3,
  adieresis: 0x00e4,
  aring: 0x00e5,
  ae: 0x00e6,
  ccedilla: 0x00e7,
  egrave: 0x00e8,
  eacute: 0x00e9,
  ecircumflex: 0x00ea,
  edieresis: 0x00eb,
  igrave: 0x00ec,
  iacute: 0x00ed,
  icircumflex: 0x00ee,
  idieresis: 0x00ef,
  eth: 0x00f0,
  ntilde: 0x00f1,
  ograve: 0x00f2,
  oacute: 0x00f3,
  ocircumflex: 0x00f4,
  otilde: 0x00f5,
  odieresis: 0x00f6,
  divide: 0x00f7,
  oslash: 0x00f8,
  ugrave: 0x00f9,
  uacute: 0x00fa,
  ucircumflex: 0x00fb,
  udieresis: 0x00fc,
  yacute: 0x00fd,
  thorn: 0x00fe,
  ydieresis: 0x00ff,

  // Latin Extended
  OE: 0x0152,
  oe: 0x0153,
  Scaron: 0x0160,
  scaron: 0x0161,
  Ydieresis: 0x0178,
  Zcaron: 0x017d,
  zcaron: 0x017e,
  florin: 0x0192,

  // Spacing Modifier Letters
  circumflex: 0x02c6,
  caron: 0x02c7,
  breve: 0x02d8,
  dotaccent: 0x02d9,
  ring: 0x02da,
  ogonek: 0x02db,
  tilde: 0x02dc,
  hungarumlaut: 0x02dd,

  // General Punctuation
  endash: 0x2013,
  emdash: 0x2014,
  quoteleft: 0x2018,
  quoteright: 0x2019,
  quotesinglbase: 0x201a,
  quotedblleft: 0x201c,
  quotedblright: 0x201d,
  quotedblbase: 0x201e,
  dagger: 0x2020,
  daggerdbl: 0x2021,
  bullet: 0x2022,
  ellipsis: 0x2026,
  perthousand: 0x2030,
  guilsinglleft: 0x2039,
  guilsinglright: 0x203a,
  fraction: 0x2044,
  Euro: 0x20ac,
  trademark: 0x2122,
  minus: 0x2212,

  // Ligatures
  fi: 0xfb01,
  fl: 0xfb02,

  // Mathematical symbols
  infinity: 0x221e,
  partialdiff: 0x2202,
  summation: 0x2211,
  product: 0x220f,
  radical: 0x221a,
  integral: 0x222b,
  approxequal: 0x2248,
  notequal: 0x2260,
  lessequal: 0x2264,
  greaterequal: 0x2265,
  lozenge: 0x25ca,

  // Greek letters commonly used
  pi: 0x03c0,
  Omega: 0x03a9,

  // Special notdef
  ".notdef": 0xfffd,
};

/**
 * Get the Unicode code point for a glyph name.
 *
 * @param glyphName - Adobe glyph name
 * @returns Unicode code point, or undefined if not found
 */
export function glyphNameToUnicode(glyphName: string): number | undefined {
  // Direct lookup
  const direct = GLYPH_TO_UNICODE[glyphName];
  if (direct !== undefined) {
    return direct;
  }

  // Handle uniXXXX format
  if (glyphName.startsWith("uni") && glyphName.length === 7) {
    const hex = glyphName.slice(3);
    const codePoint = parseInt(hex, 16);
    if (!isNaN(codePoint)) {
      return codePoint;
    }
  }

  // Handle uXXXX or uXXXXX format
  if (glyphName.startsWith("u") && glyphName.length >= 5 && glyphName.length <= 6) {
    const hex = glyphName.slice(1);
    const codePoint = parseInt(hex, 16);
    if (!isNaN(codePoint)) {
      return codePoint;
    }
  }

  return undefined;
}

/**
 * Get the base encoding table for a legacy encoding type.
 */
function getBaseEncodingTable(type: LegacyEncodingType): (number | undefined)[] {
  switch (type) {
    case "WinAnsiEncoding":
      return WIN_ANSI_TO_UNICODE;
    case "MacRomanEncoding":
      return MAC_ROMAN_TO_UNICODE;
    case "StandardEncoding":
      return STANDARD_TO_UNICODE;
    case "PDFDocEncoding":
      return PDF_DOC_TO_UNICODE;
    case "MacExpertEncoding":
      // MacExpertEncoding is similar to StandardEncoding with expert glyphs
      // For simplicity, fall back to StandardEncoding
      return STANDARD_TO_UNICODE;
    default:
      return WIN_ANSI_TO_UNICODE;
  }
}

/**
 * Create a CMap from a legacy encoding.
 *
 * @param options - Legacy encoding options
 * @returns CMap representing the encoding
 */
export function createLegacyEncodingCMap(options: LegacyEncodingOptions): CMap {
  const baseType = options.baseEncoding ?? "WinAnsiEncoding";
  const name = options.name ?? baseType;

  // Start with the base encoding table
  const encodingTable = [...getBaseEncodingTable(baseType)];

  // Apply differences if provided
  if (options.differences) {
    let currentCode = 0;
    for (const entry of options.differences) {
      if (typeof entry === "number") {
        currentCode = entry;
      } else {
        // entry is a glyph name
        const unicode = glyphNameToUnicode(entry);
        if (unicode !== undefined && currentCode < 256) {
          encodingTable[currentCode] = unicode;
        }
        currentCode++;
      }
    }
  }

  // Build character mappings
  const charMappings: CharacterMapping[] = [];
  for (let code = 0; code < 256; code++) {
    const unicode = encodingTable[code];
    if (unicode !== undefined) {
      charMappings.push({
        code,
        unicode: String.fromCodePoint(unicode),
      });
    }
  }

  // Single-byte codespace
  const codespaceRanges: CodespaceRange[] = [{ low: 0x00, high: 0xff, numBytes: 1 }];

  return new CMap({
    name,
    type: "embedded",
    writingMode: "horizontal",
    codespaceRanges,
    charMappings,
  });
}

/**
 * Decode a byte using a legacy encoding.
 *
 * @param byte - Byte value (0-255)
 * @param encoding - Encoding type
 * @returns Unicode string
 */
export function decodeLegacyByte(byte: number, encoding: LegacyEncodingType): string {
  const table = getBaseEncodingTable(encoding);
  const unicode = table[byte];
  return unicode !== undefined ? String.fromCodePoint(unicode) : "";
}

/**
 * Decode a byte array using a legacy encoding.
 *
 * @param bytes - Byte array
 * @param encoding - Encoding type
 * @returns Decoded Unicode string
 */
export function decodeLegacyBytes(bytes: Uint8Array, encoding: LegacyEncodingType): string {
  const table = getBaseEncodingTable(encoding);
  let result = "";

  for (let i = 0; i < bytes.length; i++) {
    const unicode = table[bytes[i]];
    if (unicode !== undefined) {
      result += String.fromCodePoint(unicode);
    }
  }

  return result;
}

/**
 * LegacyCMapSupport - Helper class for working with legacy PDF encodings.
 */
export class LegacyCMapSupport {
  private cache: Map<string, CMap> = new Map();

  /**
   * Get a CMap for a legacy encoding.
   *
   * @param encoding - Encoding type
   * @returns CMap for the encoding
   */
  getEncodingCMap(encoding: LegacyEncodingType): CMap {
    const cached = this.cache.get(encoding);
    if (cached) {
      return cached;
    }

    const cmap = createLegacyEncodingCMap({ baseEncoding: encoding });
    this.cache.set(encoding, cmap);
    return cmap;
  }

  /**
   * Create a custom encoding CMap with differences.
   *
   * @param options - Legacy encoding options
   * @returns Custom CMap
   */
  createCustomEncoding(options: LegacyEncodingOptions): CMap {
    return createLegacyEncodingCMap(options);
  }

  /**
   * Convert a glyph name to Unicode.
   */
  glyphToUnicode(glyphName: string): number | undefined {
    return glyphNameToUnicode(glyphName);
  }

  /**
   * Decode bytes using a specific encoding.
   */
  decode(bytes: Uint8Array, encoding: LegacyEncodingType): string {
    return decodeLegacyBytes(bytes, encoding);
  }

  /**
   * Check if an encoding type is supported.
   */
  isSupported(encoding: string): encoding is LegacyEncodingType {
    return [
      "MacRomanEncoding",
      "WinAnsiEncoding",
      "StandardEncoding",
      "MacExpertEncoding",
      "PDFDocEncoding",
      "custom",
    ].includes(encoding);
  }

  /**
   * Clear the encoding cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create a default LegacyCMapSupport instance.
 */
export function createLegacyCMapSupport(): LegacyCMapSupport {
  return new LegacyCMapSupport();
}
