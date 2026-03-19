/**
 * Spatial positioning utilities for text selection.
 *
 * This module provides coordinate-to-text mapping logic that uses element
 * bounding boxes and page layout to find nearest text positions even when
 * the cursor is in non-text areas (margins, gutters, etc.).
 */

import type { Point2D } from "../coordinate-transformer";
import type { SelectionPoint, TextLayerInfo, TextPosition, TextSpanInfo } from "./selection-state";

/**
 * Options for spatial positioning calculations.
 */
export interface SpatialPositioningOptions {
  /**
   * Maximum distance (in pixels) to search for nearest text.
   * @default 100
   */
  maxSearchDistance?: number;

  /**
   * Whether to prefer horizontal proximity over vertical when finding nearest text.
   * @default true
   */
  preferHorizontal?: boolean;

  /**
   * Whether to snap to line boundaries when in non-text areas.
   * @default true
   */
  snapToLineBounds?: boolean;
}

const DEFAULT_OPTIONS: Required<SpatialPositioningOptions> = {
  maxSearchDistance: 100,
  preferHorizontal: true,
  snapToLineBounds: true,
};

/**
 * Result of finding the nearest text to a point.
 */
export interface NearestTextResult {
  /** The nearest text span, if found */
  span: TextSpanInfo | null;

  /** Character offset within the span */
  charOffset: number;

  /** Distance to the nearest text in pixels */
  distance: number;

  /** Whether the point is directly within a text span */
  isDirectHit: boolean;

  /** The page index where the text was found */
  pageIndex: number;
}

export interface TextLineInfo {
  spans: TextSpanInfo[];
  top: number;
  bottom: number;
  left: number;
  right: number;
  pageIndex: number;
}

export interface TextSelectionRange {
  start: TextPosition;
  end: TextPosition;
}

/**
 * Find the nearest text span and character position to a screen point.
 *
 * @param screenPoint - The point in screen coordinates
 * @param textLayers - Array of text layer information for all pages
 * @param options - Positioning options
 * @returns The nearest text result, or null if no text found within range
 */
export function findNearestText(
  screenPoint: Point2D,
  textLayers: TextLayerInfo[],
  options: SpatialPositioningOptions = {},
): NearestTextResult | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let bestResult: NearestTextResult | null = null;
  let bestDistance = Infinity;

  for (const layer of textLayers) {
    if (!layer.isVisible) {
      continue;
    }

    for (const span of layer.spans) {
      const result = findNearestPositionInSpan(screenPoint, span, layer.pageIndex);

      if (result.distance < bestDistance) {
        bestDistance = result.distance;
        bestResult = result;
      }

      // Early exit on direct hit
      if (result.isDirectHit) {
        return result;
      }
    }
  }

  // Check if result is within search distance
  if (bestResult && bestResult.distance <= opts.maxSearchDistance) {
    return bestResult;
  }

  return null;
}

/**
 * Find the nearest character position within a text span.
 */
function findNearestPositionInSpan(
  screenPoint: Point2D,
  span: TextSpanInfo,
  pageIndex: number,
): NearestTextResult {
  const bounds = span.bounds;

  // Check if point is directly within span bounds
  const isDirectHit =
    screenPoint.x >= bounds.left &&
    screenPoint.x <= bounds.right &&
    screenPoint.y >= bounds.top &&
    screenPoint.y <= bounds.bottom;

  if (isDirectHit) {
    // Calculate character position within span
    const charOffset = calculateCharOffsetFromX(screenPoint.x, span);
    return {
      span,
      charOffset: span.startOffset + charOffset,
      distance: 0,
      isDirectHit: true,
      pageIndex,
    };
  }

  // Calculate distance to span bounds
  const distance = distanceToRect(screenPoint, bounds);

  // For nearby spans, estimate the character position
  let charOffset = 0;
  if (screenPoint.x < bounds.left) {
    charOffset = 0;
  } else if (screenPoint.x > bounds.right) {
    charOffset = span.text.length;
  } else {
    charOffset = calculateCharOffsetFromX(screenPoint.x, span);
  }

  return {
    span,
    charOffset: span.startOffset + charOffset,
    distance,
    isDirectHit: false,
    pageIndex,
  };
}

/**
 * Calculate the character offset within a span from an x coordinate.
 */
function calculateCharOffsetFromX(x: number, span: TextSpanInfo): number {
  const bounds = span.bounds;
  const text = span.text;

  if (text.length === 0) {
    return 0;
  }

  // Calculate relative position within span
  const relativeX = x - bounds.left;
  const spanWidth = bounds.width;

  if (spanWidth === 0 || relativeX <= 0) {
    return 0;
  }
  if (relativeX >= spanWidth) {
    return text.length;
  }

  // Estimate character position assuming uniform character width
  const charWidth = spanWidth / text.length;
  const estimatedOffset = Math.round(relativeX / charWidth);

  return Math.min(Math.max(0, estimatedOffset), text.length);
}

/**
 * Calculate the minimum distance from a point to a rectangle.
 */
function distanceToRect(point: Point2D, rect: DOMRect): number {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the page that contains a screen point.
 *
 * @param screenPoint - The point in screen coordinates
 * @param textLayers - Array of text layer information
 * @returns The page index, or -1 if not within any page
 */
export function findPageAtPoint(screenPoint: Point2D, textLayers: TextLayerInfo[]): number {
  for (const layer of textLayers) {
    if (!layer.isVisible) {
      continue;
    }

    const containerRect = layer.container.getBoundingClientRect();
    if (
      screenPoint.x >= containerRect.left &&
      screenPoint.x <= containerRect.right &&
      screenPoint.y >= containerRect.top &&
      screenPoint.y <= containerRect.bottom
    ) {
      return layer.pageIndex;
    }
  }
  return -1;
}

/**
 * Create a selection point from a screen coordinate.
 *
 * @param screenPoint - The point in screen coordinates
 * @param textLayers - Array of text layer information
 * @param options - Positioning options
 * @returns A complete selection point with text position information
 */
export function createSelectionPointFromScreen(
  screenPoint: Point2D,
  textLayers: TextLayerInfo[],
  options: SpatialPositioningOptions = {},
): SelectionPoint {
  const pageIndex = findPageAtPoint(screenPoint, textLayers);
  const pageLayer = pageIndex >= 0 ? textLayers.find(l => l.pageIndex === pageIndex) : null;

  let nearestText: NearestTextResult | null = null;
  let isInText = false;

  if (pageLayer) {
    const pageNearestText = findNearestText(screenPoint, [pageLayer], options);

    if (pageNearestText?.isDirectHit) {
      nearestText = pageNearestText;
      isInText = true;
    } else if (pageLayer.spans.length > 0) {
      nearestText = findNearestTextWithLineAwareness(screenPoint, pageLayer) ?? pageNearestText;
    } else {
      nearestText = pageNearestText;
    }
  } else {
    nearestText = findNearestText(screenPoint, textLayers, options);
    isInText = nearestText?.isDirectHit ?? false;
  }

  const isInNonTextArea = pageIndex >= 0 && !isInText;

  let textPosition: TextPosition | undefined;
  if (nearestText) {
    textPosition = {
      pageIndex: nearestText.pageIndex,
      charOffset: nearestText.charOffset,
      element: nearestText.span?.element,
      elementOffset:
        nearestText.span && nearestText.charOffset >= nearestText.span.startOffset
          ? nearestText.charOffset - nearestText.span.startOffset
          : 0,
    };
  }

  return {
    screen: screenPoint,
    pageIndex: nearestText?.pageIndex ?? pageIndex,
    textPosition,
    isInText,
    isInNonTextArea,
  };
}

/**
 * Find nearest text with line-aware positioning for non-text areas.
 *
 * When the cursor is in a non-text area (margins, gutters, between lines),
 * this function finds the appropriate boundary position based on the cursor's
 * vertical and horizontal position relative to the text lines.
 */
function findNearestTextWithLineAwareness(
  screenPoint: Point2D,
  layer: TextLayerInfo,
): NearestTextResult | null {
  const nearestLine = findNearestLine(screenPoint, layer);
  if (!nearestLine || nearestLine.spans.length === 0) {
    return null;
  }

  const lineInfo = buildLineInfo(nearestLine.spans, layer.pageIndex);
  const textPosition = getTextPositionOnLine(screenPoint, lineInfo);
  const targetSpan =
    lineInfo.spans.find(span => span.element === textPosition.element) ?? lineInfo.spans[0];

  return {
    span: targetSpan,
    charOffset: textPosition.charOffset,
    distance: nearestLine.distance,
    isDirectHit: false,
    pageIndex: layer.pageIndex,
  };
}

/**
 * Calculate character offset from screen X coordinate within a span.
 */
function calculateCharOffsetFromScreenX(x: number, span: TextSpanInfo): number {
  const bounds = span.bounds;
  const text = span.text;

  if (text.length === 0) {
    return span.startOffset;
  }

  const relativeX = x - bounds.left;
  const spanWidth = bounds.width;

  if (spanWidth === 0 || relativeX <= 0) {
    return span.startOffset;
  }
  if (relativeX >= spanWidth) {
    return span.endOffset;
  }

  // Estimate character position assuming uniform character width
  const charWidth = spanWidth / text.length;
  const localOffset = Math.round(relativeX / charWidth);

  return span.startOffset + Math.min(Math.max(0, localOffset), text.length);
}

/**
 * Find the text span that contains a given character offset.
 *
 * @param charOffset - The character offset to find
 * @param spans - Array of text spans
 * @returns The span containing the offset, or null if not found
 */
export function findSpanAtOffset(charOffset: number, spans: TextSpanInfo[]): TextSpanInfo | null {
  for (const span of spans) {
    if (charOffset >= span.startOffset && charOffset < span.endOffset) {
      return span;
    }
  }
  // Check if at the end of the last span
  if (spans.length > 0) {
    const lastSpan = spans[spans.length - 1];
    if (charOffset === lastSpan.endOffset) {
      return lastSpan;
    }
  }
  return null;
}

/**
 * Get the screen position of a character within a text span.
 *
 * @param charOffset - The character offset within the page
 * @param layer - The text layer information
 * @returns The screen position, or null if not found
 */
export function getScreenPositionForChar(charOffset: number, layer: TextLayerInfo): Point2D | null {
  const span = findSpanAtOffset(charOffset, layer.spans);
  if (!span) {
    return null;
  }

  const localOffset = charOffset - span.startOffset;
  const bounds = span.bounds;

  // Estimate x position based on character offset
  const charWidth = span.text.length > 0 ? bounds.width / span.text.length : 0;
  const x = bounds.left + localOffset * charWidth;
  const y = bounds.top + bounds.height / 2;

  return { x, y };
}

/**
 * Find all text spans between two character offsets on the same page.
 *
 * @param startOffset - Start character offset
 * @param endOffset - End character offset
 * @param layer - The text layer information
 * @returns Array of spans that fall within the range
 */
export function findSpansInRange(
  startOffset: number,
  endOffset: number,
  layer: TextLayerInfo,
): TextSpanInfo[] {
  return layer.spans.filter(span => span.endOffset > startOffset && span.startOffset < endOffset);
}

/**
 * Collect text layer information from DOM elements.
 *
 * @param containers - Map of page index to text layer container elements
 * @returns Array of text layer information
 */
export function collectTextLayerInfo(containers: Map<number, HTMLElement>): TextLayerInfo[] {
  const layers: TextLayerInfo[] = [];

  for (const [pageIndex, container] of Array.from(containers)) {
    const spans = collectSpanInfo(container, pageIndex);
    const fullText = spans.map(s => s.text).join("");

    // Check visibility
    const rect = container.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;

    layers.push({
      container,
      pageIndex,
      spans,
      fullText,
      isVisible,
    });
  }

  return layers.sort((a, b) => a.pageIndex - b.pageIndex);
}

/**
 * Collect span information from a text layer container.
 *
 * @param container - The text layer container element
 * @param pageIndex - The page index
 * @returns Array of text span information
 */
export function collectSpanInfo(container: HTMLElement, pageIndex: number): TextSpanInfo[] {
  const spans: TextSpanInfo[] = [];
  const elements = container.querySelectorAll("span");
  let charOffset = 0;

  for (const element of Array.from(elements)) {
    const text = element.textContent ?? "";
    if (text.length === 0) {
      continue;
    }

    const bounds = element.getBoundingClientRect();

    spans.push({
      element: element as HTMLElement,
      text,
      startOffset: charOffset,
      endOffset: charOffset + text.length,
      bounds,
      pageIndex,
    });

    charOffset += text.length;
  }

  return spans;
}

/**
 * Refresh bounds for all spans in a text layer.
 * Call this after zoom or layout changes.
 *
 * @param layer - The text layer to refresh
 */
export function refreshSpanBounds(layer: TextLayerInfo): void {
  for (const span of layer.spans) {
    span.bounds = span.element.getBoundingClientRect();
  }
}

/**
 * Find the line (row of text) that a point is closest to.
 *
 * @param screenPoint - The point in screen coordinates
 * @param layer - The text layer information
 * @returns Object containing line spans and vertical distance
 */
export function findNearestLine(
  screenPoint: Point2D,
  layer: TextLayerInfo,
): { spans: TextSpanInfo[]; distance: number } | null {
  if (layer.spans.length === 0) {
    return null;
  }

  // Group spans by their vertical position (approximate line grouping)
  const lineGroups = groupSpansByLine(layer.spans);

  let nearestLine: TextSpanInfo[] | null = null;
  let nearestDistance = Infinity;

  for (const lineSpans of lineGroups) {
    // Get the vertical center of this line
    const lineTop = Math.min(...lineSpans.map(s => s.bounds.top));
    const lineBottom = Math.max(...lineSpans.map(s => s.bounds.bottom));
    const lineCenter = (lineTop + lineBottom) / 2;

    // Calculate vertical distance
    let distance: number;
    if (screenPoint.y < lineTop) {
      distance = lineTop - screenPoint.y;
    } else if (screenPoint.y > lineBottom) {
      distance = screenPoint.y - lineBottom;
    } else {
      distance = 0;
    }

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLine = lineSpans;
    }
  }

  if (nearestLine) {
    return { spans: nearestLine, distance: nearestDistance };
  }

  return null;
}

/**
 * Get the line information for a character offset within a text layer.
 */
export function getLineInfoForCharOffset(
  charOffset: number,
  layer: TextLayerInfo,
): TextLineInfo | null {
  const span =
    layer.spans.find(textSpan => textSpan.endOffset === charOffset) ??
    findSpanAtOffset(charOffset, layer.spans) ??
    layer.spans.find(textSpan => textSpan.startOffset === charOffset) ??
    null;
  if (!span) {
    return null;
  }

  const lineGroups = groupSpansByLine(layer.spans);
  for (const lineSpans of lineGroups) {
    if (lineSpans.includes(span)) {
      return buildLineInfo(lineSpans, layer.pageIndex);
    }
  }

  return null;
}

/**
 * Get the line information for a concrete text position.
 *
 * When an element reference is available, prefer it over the raw character
 * offset so line-end boundaries remain attached to the line the cursor
 * actually came from.
 */
export function getLineInfoForTextPosition(
  textPosition: Pick<TextPosition, "charOffset" | "element">,
  layer: TextLayerInfo,
): TextLineInfo | null {
  const span =
    layer.spans.find(textSpan => textSpan.element === textPosition.element) ??
    getSpanAtCharBoundary(textPosition.charOffset, layer.spans);

  if (!span) {
    return null;
  }

  const lineGroups = groupSpansByLine(layer.spans);
  for (const lineSpans of lineGroups) {
    if (lineSpans.includes(span)) {
      return buildLineInfo(lineSpans, layer.pageIndex);
    }
  }

  return null;
}

/**
 * Get all text lines in top-to-bottom order for a layer.
 */
export function getOrderedLineInfos(layer: TextLayerInfo): TextLineInfo[] {
  return groupSpansByLine(layer.spans).map(lineSpans => buildLineInfo(lineSpans, layer.pageIndex));
}

/**
 * Resolve a text position on a specific line based on the cursor x-position.
 */
export function getTextPositionOnLine(screenPoint: Point2D, line: TextLineInfo): TextPosition {
  const sortedSpans = [...line.spans].sort((a, b) => a.bounds.left - b.bounds.left);
  let targetSpan = sortedSpans[0];
  let charOffset = targetSpan.startOffset;

  if (screenPoint.x < line.left) {
    targetSpan = sortedSpans[0];
    charOffset = targetSpan.startOffset;
  } else if (screenPoint.x > line.right) {
    targetSpan = sortedSpans[sortedSpans.length - 1];
    charOffset = targetSpan.endOffset;
  } else {
    let bestSpan = sortedSpans[0];
    let bestDistance = Infinity;

    for (const span of sortedSpans) {
      const dx = Math.max(span.bounds.left - screenPoint.x, 0, screenPoint.x - span.bounds.right);
      if (dx < bestDistance) {
        bestDistance = dx;
        bestSpan = span;
      }
    }

    targetSpan = bestSpan;
    charOffset = calculateCharOffsetFromScreenX(screenPoint.x, bestSpan);
  }

  return {
    pageIndex: line.pageIndex,
    charOffset,
    element: targetSpan.element,
    elementOffset: Math.max(0, charOffset - targetSpan.startOffset),
  };
}

/**
 * Get the word range that contains the provided text position.
 *
 * PDFs do not expose semantic word boundaries, so this is inferred from the
 * visual line and contiguous non-whitespace tokens within that line.
 */
export function getWordRangeForTextPosition(
  textPosition: TextPosition,
  layer: TextLayerInfo,
): TextSelectionRange | null {
  const lineRange = getLineRangeForTextPosition(textPosition, layer);
  if (!lineRange) {
    return null;
  }

  const lineStart = lineRange.start.charOffset;
  const lineEnd = lineRange.end.charOffset;
  if (lineEnd <= lineStart) {
    return null;
  }

  const tokenIndex = resolveTokenIndex(layer.fullText, textPosition.charOffset, lineStart, lineEnd);
  if (tokenIndex === null) {
    return null;
  }

  const tokenKind = classifyTokenCharacter(layer.fullText[tokenIndex] ?? "");
  let startOffset = tokenIndex;
  let endOffset = tokenIndex + 1;

  while (
    startOffset > lineStart &&
    classifyTokenCharacter(layer.fullText[startOffset - 1] ?? "") === tokenKind
  ) {
    startOffset--;
  }

  while (
    endOffset < lineEnd &&
    classifyTokenCharacter(layer.fullText[endOffset] ?? "") === tokenKind
  ) {
    endOffset++;
  }

  const start = createTextPositionForOffset(startOffset, layer, "start");
  const end = createTextPositionForOffset(endOffset, layer, "end");
  if (!start || !end) {
    return null;
  }

  return { start, end };
}

/**
 * Get the visual line range that contains the provided text position.
 */
export function getLineRangeForTextPosition(
  textPosition: TextPosition,
  layer: TextLayerInfo,
): TextSelectionRange | null {
  const line = getLineInfoForTextPosition(textPosition, layer);
  if (!line || line.spans.length === 0) {
    return null;
  }

  const sortedSpans = [...line.spans].sort((a, b) => a.startOffset - b.startOffset);
  const firstSpan = sortedSpans[0];
  const lastSpan = sortedSpans[sortedSpans.length - 1];

  return {
    start: {
      pageIndex: layer.pageIndex,
      charOffset: firstSpan.startOffset,
      element: firstSpan.element,
      elementOffset: 0,
    },
    end: {
      pageIndex: layer.pageIndex,
      charOffset: lastSpan.endOffset,
      element: lastSpan.element,
      elementOffset: lastSpan.text.length,
    },
  };
}

/**
 * Get the visual paragraph block that contains the provided text position.
 *
 * PDF text layers usually do not carry semantic paragraph markup, so this uses
 * line spacing to infer a contiguous block of lines.
 */
export function getParagraphRangeForTextPosition(
  textPosition: TextPosition,
  layer: TextLayerInfo,
): TextSelectionRange | null {
  const targetLine = getLineInfoForTextPosition(textPosition, layer);
  if (!targetLine) {
    return null;
  }

  const orderedLines = getOrderedLineInfos(layer);
  const targetLineIndex = orderedLines.findIndex(line =>
    line.spans.some(span => targetLine.spans.includes(span)),
  );
  if (targetLineIndex < 0) {
    return null;
  }

  const paragraphBreakThreshold = getParagraphBreakThreshold(orderedLines);
  let startLineIndex = targetLineIndex;
  let endLineIndex = targetLineIndex;

  while (
    startLineIndex > 0 &&
    getLineGap(orderedLines[startLineIndex - 1], orderedLines[startLineIndex]) <=
      paragraphBreakThreshold
  ) {
    startLineIndex--;
  }

  while (
    endLineIndex < orderedLines.length - 1 &&
    getLineGap(orderedLines[endLineIndex], orderedLines[endLineIndex + 1]) <=
      paragraphBreakThreshold
  ) {
    endLineIndex++;
  }

  const startLine = orderedLines[startLineIndex];
  const endLine = orderedLines[endLineIndex];
  const startRange = getLineRangeForTextPosition(
    {
      pageIndex: layer.pageIndex,
      charOffset: startLine.spans[0].startOffset,
      element: startLine.spans[0].element,
      elementOffset: 0,
    },
    layer,
  );
  const endLineLastSpan = [...endLine.spans].sort((a, b) => a.startOffset - b.startOffset).pop();
  const endRange = endLineLastSpan
    ? getLineRangeForTextPosition(
        {
          pageIndex: layer.pageIndex,
          charOffset: endLineLastSpan.endOffset,
          element: endLineLastSpan.element,
          elementOffset: endLineLastSpan.text.length,
        },
        layer,
      )
    : null;

  if (!startRange || !endRange) {
    return null;
  }

  return {
    start: startRange.start,
    end: endRange.end,
  };
}

/**
 * Group spans into lines based on their vertical position.
 */
function groupSpansByLine(spans: TextSpanInfo[], tolerance = 5): TextSpanInfo[][] {
  if (spans.length === 0) {
    return [];
  }

  // Sort by vertical position and then by horizontal position for stability.
  const sorted = [...spans].sort((a, b) => {
    const centerDelta = getSpanCenterY(a) - getSpanCenterY(b);
    if (centerDelta !== 0) {
      return centerDelta;
    }

    return a.bounds.left - b.bounds.left;
  });

  const lines: TextSpanInfo[][] = [];
  let currentLine: TextSpanInfo[] = [sorted[0]];
  let currentLineCenterY = getSpanCenterY(sorted[0]);
  let currentLineHeight = getSpanHeight(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const span = sorted[i];
    const spanCenterY = getSpanCenterY(span);
    const spanHeight = getSpanHeight(span);
    const verticalThreshold = Math.max(tolerance, Math.min(currentLineHeight, spanHeight) * 0.6);

    // Group spans that share a similar vertical center. This avoids merging
    // wrapped lines whose bounding boxes overlap slightly in the text layer.
    if (Math.abs(spanCenterY - currentLineCenterY) <= verticalThreshold) {
      currentLine.push(span);
      currentLineCenterY =
        currentLine.reduce((sum, lineSpan) => sum + getSpanCenterY(lineSpan), 0) /
        currentLine.length;
      currentLineHeight = Math.max(currentLineHeight, spanHeight);
    } else {
      lines.push(currentLine);
      currentLine = [span];
      currentLineCenterY = spanCenterY;
      currentLineHeight = spanHeight;
    }
  }

  lines.push(currentLine);
  return lines;
}

function buildLineInfo(spans: TextSpanInfo[], pageIndex: number): TextLineInfo {
  return {
    spans,
    top: Math.min(...spans.map(span => span.bounds.top)),
    bottom: Math.max(...spans.map(span => span.bounds.bottom)),
    left: Math.min(...spans.map(span => span.bounds.left)),
    right: Math.max(...spans.map(span => span.bounds.right)),
    pageIndex,
  };
}

function getSpanAtCharBoundary(charOffset: number, spans: TextSpanInfo[]): TextSpanInfo | null {
  return (
    spans.find(textSpan => textSpan.endOffset === charOffset) ??
    findSpanAtOffset(charOffset, spans) ??
    spans.find(textSpan => textSpan.startOffset === charOffset) ??
    null
  );
}

function getSpanCenterY(span: TextSpanInfo): number {
  return (span.bounds.top + span.bounds.bottom) / 2;
}

function getSpanHeight(span: TextSpanInfo): number {
  return Math.max(1, span.bounds.bottom - span.bounds.top);
}

function createTextPositionForOffset(
  charOffset: number,
  layer: TextLayerInfo,
  edge: "start" | "end",
): TextPosition | null {
  if (layer.spans.length === 0) {
    return null;
  }

  const clampedOffset = Math.min(Math.max(0, charOffset), layer.fullText.length);
  const span =
    edge === "start"
      ? (layer.spans.find(textSpan => clampedOffset < textSpan.endOffset) ??
        layer.spans[layer.spans.length - 1])
      : (getSpanAtCharBoundary(clampedOffset, layer.spans) ?? layer.spans[layer.spans.length - 1]);

  if (!span) {
    return null;
  }

  return {
    pageIndex: layer.pageIndex,
    charOffset: clampedOffset,
    element: span.element,
    elementOffset: Math.min(span.text.length, Math.max(0, clampedOffset - span.startOffset)),
  };
}

function resolveTokenIndex(
  fullText: string,
  charOffset: number,
  lineStart: number,
  lineEnd: number,
): number | null {
  if (lineEnd <= lineStart) {
    return null;
  }

  const seen = new Set<number>();
  const candidates = [charOffset, charOffset - 1, charOffset + 1];

  for (const candidate of candidates) {
    const clamped = Math.min(lineEnd - 1, Math.max(lineStart, candidate));
    if (seen.has(clamped)) {
      continue;
    }
    seen.add(clamped);

    const character = fullText[clamped];
    if (character && classifyTokenCharacter(character) !== "whitespace") {
      return clamped;
    }
  }

  return null;
}

function classifyTokenCharacter(character: string): "word" | "symbol" | "whitespace" {
  if (/\s/u.test(character)) {
    return "whitespace";
  }

  if (/[\p{L}\p{N}\p{M}_'’-]/u.test(character)) {
    return "word";
  }

  return "symbol";
}

function getParagraphBreakThreshold(lines: TextLineInfo[]): number {
  if (lines.length <= 1) {
    return Infinity;
  }

  const positiveGaps: number[] = [];
  const lineHeights: number[] = [];

  for (let index = 0; index < lines.length; index++) {
    lineHeights.push(Math.max(1, lines[index].bottom - lines[index].top));

    if (index < lines.length - 1) {
      const gap = getLineGap(lines[index], lines[index + 1]);
      if (gap > 0) {
        positiveGaps.push(gap);
      }
    }
  }

  const typicalGap = getLowerQuartile(positiveGaps) ?? 0;
  const typicalHeight = getLowerQuartile(lineHeights) ?? 0;

  return Math.max(typicalGap * 1.8, typicalHeight * 1.25);
}

function getLineGap(currentLine: TextLineInfo, nextLine: TextLineInfo): number {
  return Math.max(0, nextLine.top - currentLine.bottom);
}

function getLowerQuartile(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.25)];
}

/**
 * Get the start of a line from a character position.
 */
export function getLineStart(charOffset: number, layer: TextLayerInfo): number {
  const span = findSpanAtOffset(charOffset, layer.spans);
  if (!span) {
    return charOffset;
  }

  const nearestLine = findNearestLine(
    { x: span.bounds.left, y: (span.bounds.top + span.bounds.bottom) / 2 },
    layer,
  );

  if (!nearestLine) {
    return charOffset;
  }

  // Find the leftmost span in this line
  const leftmostSpan = nearestLine.spans.reduce((left, s) =>
    s.bounds.left < left.bounds.left ? s : left,
  );

  return leftmostSpan.startOffset;
}

/**
 * Get the end of a line from a character position.
 */
export function getLineEnd(charOffset: number, layer: TextLayerInfo): number {
  const span = findSpanAtOffset(charOffset, layer.spans);
  if (!span) {
    return charOffset;
  }

  const nearestLine = findNearestLine(
    { x: span.bounds.left, y: (span.bounds.top + span.bounds.bottom) / 2 },
    layer,
  );

  if (!nearestLine) {
    return charOffset;
  }

  // Find the rightmost span in this line
  const rightmostSpan = nearestLine.spans.reduce((right, s) =>
    s.bounds.right > right.bounds.right ? s : right,
  );

  return rightmostSpan.endOffset;
}
