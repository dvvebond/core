/**
 * Text grouping for hierarchical text extraction.
 *
 * Organizes extracted characters into words, lines, and paragraphs
 * based on spatial relationships and text flow analysis.
 */

import type { Character, ExtractionOptions, Line, Paragraph, TextPage, Word } from "./types";
import { mergeBoundingBoxes, horizontalGap, verticalGap } from "./types";

/**
 * Default extraction options.
 */
const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  detectParagraphs: true,
  baselineTolerance: 2,
  wordSpacingThreshold: 0.3,
  paragraphSpacingThreshold: 1.5,
  indentThreshold: 15,
};

/**
 * Minimum fraction of decreasing x-positions to detect RTL placement.
 */
const RTL_PLACED_THRESHOLD = 0.8;

/**
 * Group extracted characters into a hierarchical TextPage structure.
 *
 * @param characters - Array of extracted characters
 * @param pageWidth - Page width in points
 * @param pageHeight - Page height in points
 * @param pageIndex - Page index (0-based)
 * @param options - Grouping options
 * @returns Complete text page with hierarchical structure
 */
export function groupCharactersIntoPage(
  characters: Character[],
  pageWidth: number,
  pageHeight: number,
  pageIndex: number,
  options: ExtractionOptions = {},
): TextPage {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (characters.length === 0) {
    return {
      pageIndex,
      width: pageWidth,
      height: pageHeight,
      paragraphs: [],
      lines: [],
      words: [],
      characters: [],
      text: "",
    };
  }

  // Step 1: Group characters into lines by baseline
  const lines = groupIntoLines(characters, opts);

  // Step 2: Group words within each line
  const linesWithWords = lines.map((lineChars, lineIndex) =>
    createLine(lineChars, lineIndex, opts),
  );

  // Step 3: Optionally group lines into paragraphs
  let paragraphs: Paragraph[];
  if (opts.detectParagraphs) {
    paragraphs = groupIntoParagraphs(linesWithWords, opts);
  } else {
    // Single paragraph containing all lines
    paragraphs = [createParagraph(linesWithWords, 0)];
  }

  // Collect all elements for flat access
  const allWords = linesWithWords.flatMap(l => l.words);
  const allChars = characters;

  // Build plain text
  const text = paragraphs.map(p => p.text).join("\n\n");

  return {
    pageIndex,
    width: pageWidth,
    height: pageHeight,
    paragraphs,
    lines: linesWithWords,
    words: allWords,
    characters: allChars,
    text,
  };
}

/**
 * Group characters into lines based on baseline proximity.
 */
function groupIntoLines(characters: Character[], opts: Required<ExtractionOptions>): Character[][] {
  if (characters.length === 0) {
    return [];
  }

  const groups: Character[][] = [];

  for (const char of characters) {
    let added = false;

    for (const group of groups) {
      const avgBaseline = calculateAverageBaseline(group);
      if (Math.abs(char.baseline - avgBaseline) <= opts.baselineTolerance) {
        group.push(char);
        added = true;
        break;
      }
    }

    if (!added) {
      groups.push([char]);
    }
  }

  // Sort lines top-to-bottom (higher Y = higher on page in PDF coords)
  groups.sort((a, b) => calculateAverageBaseline(b) - calculateAverageBaseline(a));

  return groups;
}

/**
 * Calculate average baseline of a character group.
 */
function calculateAverageBaseline(chars: Character[]): number {
  if (chars.length === 0) {
    return 0;
  }
  return chars.reduce((sum, c) => sum + c.baseline, 0) / chars.length;
}

/**
 * Create a Line from a group of characters.
 */
function createLine(
  characters: Character[],
  lineIndex: number,
  opts: Required<ExtractionOptions>,
): Line {
  // Order characters correctly (handle RTL placement)
  const orderedChars = orderLineCharacters(characters);

  // Group into words
  const words = groupIntoWords(orderedChars, lineIndex, opts);

  // Calculate line properties
  const baseline = calculateAverageBaseline(orderedChars);
  const bbox = mergeBoundingBoxes(orderedChars.map(c => c.bbox));
  const text = words.map(w => w.text).join(" ");

  // Determine primary font
  const fontName = getMostCommonFont(orderedChars);
  const fontSize = getAverageFontSize(orderedChars);

  return {
    text,
    bbox,
    words,
    characters: orderedChars,
    baseline,
    fontSize,
    fontName,
    indexInPage: lineIndex,
  };
}

/**
 * Order characters within a line, handling RTL-placed text.
 */
function orderLineCharacters(chars: Character[]): Character[] {
  if (chars.length <= 1) {
    return [...chars];
  }

  // Check if all have index for stream order
  const hasStreamOrder = chars.every(c => c.index != null);

  if (!hasStreamOrder) {
    return [...chars].sort((a, b) => a.bbox.x - b.bbox.x);
  }

  // Sort by stream index
  const streamOrder = [...chars].sort((a, b) => a.index - b.index);

  // Check for RTL placement
  if (isRtlPlaced(streamOrder)) {
    return streamOrder;
  }

  // Normal LTR: sort by x position
  return [...chars].sort((a, b) => a.bbox.x - b.bbox.x);
}

/**
 * Detect RTL-placed text (design tool pattern).
 */
function isRtlPlaced(streamOrder: Character[]): boolean {
  if (streamOrder.length < 2) {
    return false;
  }

  let decreasingCount = 0;
  for (let i = 1; i < streamOrder.length; i++) {
    if (streamOrder[i].bbox.x < streamOrder[i - 1].bbox.x) {
      decreasingCount++;
    }
  }

  const totalPairs = streamOrder.length - 1;
  return decreasingCount / totalPairs >= RTL_PLACED_THRESHOLD;
}

/**
 * Group characters into words based on spacing.
 */
function groupIntoWords(
  chars: Character[],
  lineIndex: number,
  opts: Required<ExtractionOptions>,
): Word[] {
  if (chars.length === 0) {
    return [];
  }

  const words: Word[] = [];
  let currentWord: Character[] = [chars[0]];
  let wordIndexInLine = 0;
  let wordIndexInPage = lineIndex * 100; // Rough estimate, will be corrected

  for (let i = 1; i < chars.length; i++) {
    const prevChar = chars[i - 1];
    const char = chars[i];

    // Check for word break
    const gap = horizontalGap(prevChar.bbox, char.bbox);
    const avgFontSize = (prevChar.fontSize + char.fontSize) / 2;
    const isWordBreak = gap > avgFontSize * opts.wordSpacingThreshold;

    // Also break on explicit space characters
    const isSpace = prevChar.text === " " || prevChar.text === "\u00A0";

    if (isWordBreak || isSpace) {
      // Complete current word (excluding trailing space)
      if (currentWord.length > 0) {
        const filtered = currentWord.filter(c => c.text !== " " && c.text !== "\u00A0");
        if (filtered.length > 0) {
          words.push(createWord(filtered, wordIndexInLine, wordIndexInPage));
          wordIndexInLine++;
          wordIndexInPage++;
        }
      }
      currentWord = isSpace ? [] : [char];
      if (!isSpace) {
        currentWord = [char];
      }
    } else {
      currentWord.push(char);
    }
  }

  // Complete final word
  if (currentWord.length > 0) {
    const filtered = currentWord.filter(c => c.text !== " " && c.text !== "\u00A0");
    if (filtered.length > 0) {
      words.push(createWord(filtered, wordIndexInLine, wordIndexInPage));
    }
  }

  return words;
}

/**
 * Create a Word from characters.
 */
function createWord(chars: Character[], indexInLine: number, indexInPage: number): Word {
  const text = chars.map(c => c.text).join("");
  const bbox = mergeBoundingBoxes(chars.map(c => c.bbox));
  const baseline = calculateAverageBaseline(chars);
  const fontSize = getAverageFontSize(chars);
  const fontName = getMostCommonFont(chars);

  return {
    text,
    bbox,
    characters: chars,
    baseline,
    fontSize,
    fontName,
    indexInLine,
    indexInPage,
  };
}

/**
 * Group lines into paragraphs based on spacing and indentation.
 */
function groupIntoParagraphs(lines: Line[], opts: Required<ExtractionOptions>): Paragraph[] {
  if (lines.length === 0) {
    return [];
  }

  const paragraphs: Paragraph[] = [];
  let currentParagraph: Line[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const line = lines[i];

    // Check for paragraph break
    const isParagraphBreak = detectParagraphBreak(prevLine, line, opts);

    if (isParagraphBreak) {
      paragraphs.push(createParagraph(currentParagraph, paragraphs.length));
      currentParagraph = [line];
    } else {
      currentParagraph.push(line);
    }
  }

  // Complete final paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push(createParagraph(currentParagraph, paragraphs.length));
  }

  return paragraphs;
}

/**
 * Detect if there's a paragraph break between two lines.
 */
function detectParagraphBreak(
  prevLine: Line,
  line: Line,
  opts: Required<ExtractionOptions>,
): boolean {
  // Check vertical spacing
  const gap = verticalGap(prevLine.bbox, line.bbox);
  const avgLineHeight = (prevLine.bbox.height + line.bbox.height) / 2;

  if (gap > avgLineHeight * opts.paragraphSpacingThreshold) {
    return true;
  }

  // Check indentation (current line indented relative to previous)
  const indent = line.bbox.x - prevLine.bbox.x;
  if (indent > opts.indentThreshold) {
    return true;
  }

  return false;
}

/**
 * Create a Paragraph from lines.
 */
function createParagraph(lines: Line[], indexInPage: number): Paragraph {
  // Update line indices within paragraph
  const updatedLines = lines.map((line, idx) => ({
    ...line,
    indexInParagraph: idx,
  }));

  const text = updatedLines.map(l => l.text).join("\n");
  const bbox = mergeBoundingBoxes(updatedLines.map(l => l.bbox));
  const words = updatedLines.flatMap(l => l.words);
  const chars = updatedLines.flatMap(l => l.characters);

  return {
    text,
    bbox,
    lines: updatedLines,
    words,
    characters: chars,
    indexInPage,
  };
}

/**
 * Get the most common font name in a character group.
 */
function getMostCommonFont(chars: Character[]): string {
  if (chars.length === 0) {
    return "";
  }

  const counts = new Map<string, number>();
  for (const char of chars) {
    counts.set(char.fontName, (counts.get(char.fontName) ?? 0) + 1);
  }

  let maxFont = chars[0].fontName;
  let maxCount = 0;

  for (const [font, count] of counts) {
    if (count > maxCount) {
      maxFont = font;
      maxCount = count;
    }
  }

  return maxFont;
}

/**
 * Get the average font size in a character group.
 */
function getAverageFontSize(chars: Character[]): number {
  if (chars.length === 0) {
    return 0;
  }
  return chars.reduce((sum, c) => sum + c.fontSize, 0) / chars.length;
}
