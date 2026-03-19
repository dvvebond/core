/**
 * Spatial positioning utilities for text selection.
 *
 * This module provides coordinate-to-text mapping logic that uses element
 * bounding boxes and page layout to find nearest text positions even when
 * the cursor is in non-text areas (margins, gutters, etc.).
 */

import type { Point2D } from "../coordinate-transformer";
import type {
  SelectionPoint,
  TextLayerInfo,
  TextPosition,
  TextSpanInfo,
} from "./selection-state";

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
    if (!layer.isVisible) {continue;}

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

  if (text.length === 0) {return 0;}

  // Calculate relative position within span
  const relativeX = x - bounds.left;
  const spanWidth = bounds.width;

  if (spanWidth === 0 || relativeX <= 0) {return 0;}
  if (relativeX >= spanWidth) {return text.length;}

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
    if (!layer.isVisible) {continue;}

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
  const nearestText = findNearestText(screenPoint, textLayers, options);

  const isInText = nearestText?.isDirectHit ?? false;
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
export function getScreenPositionForChar(
  charOffset: number,
  layer: TextLayerInfo,
): Point2D | null {
  const span = findSpanAtOffset(charOffset, layer.spans);
  if (!span) {return null;}

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
  return layer.spans.filter(
    span => span.endOffset > startOffset && span.startOffset < endOffset,
  );
}

/**
 * Collect text layer information from DOM elements.
 *
 * @param containers - Map of page index to text layer container elements
 * @returns Array of text layer information
 */
export function collectTextLayerInfo(
  containers: Map<number, HTMLElement>,
): TextLayerInfo[] {
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
    if (text.length === 0) {continue;}

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
  if (layer.spans.length === 0) {return null;}

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
 * Group spans into lines based on their vertical position.
 */
function groupSpansByLine(spans: TextSpanInfo[], tolerance = 5): TextSpanInfo[][] {
  if (spans.length === 0) {return [];}

  // Sort by vertical position
  const sorted = [...spans].sort((a, b) => {
    const aCenterY = (a.bounds.top + a.bounds.bottom) / 2;
    const bCenterY = (b.bounds.top + b.bounds.bottom) / 2;
    return aCenterY - bCenterY;
  });

  const lines: TextSpanInfo[][] = [];
  let currentLine: TextSpanInfo[] = [sorted[0]];
  let currentLineBottom = sorted[0].bounds.bottom;

  for (let i = 1; i < sorted.length; i++) {
    const span = sorted[i];
    const spanTop = span.bounds.top;

    // If span overlaps with current line or is within tolerance
    if (spanTop <= currentLineBottom + tolerance) {
      currentLine.push(span);
      currentLineBottom = Math.max(currentLineBottom, span.bounds.bottom);
    } else {
      lines.push(currentLine);
      currentLine = [span];
      currentLineBottom = span.bounds.bottom;
    }
  }

  lines.push(currentLine);
  return lines;
}

/**
 * Get the start of a line from a character position.
 */
export function getLineStart(charOffset: number, layer: TextLayerInfo): number {
  const span = findSpanAtOffset(charOffset, layer.spans);
  if (!span) {return charOffset;}

  const nearestLine = findNearestLine(
    { x: span.bounds.left, y: (span.bounds.top + span.bounds.bottom) / 2 },
    layer,
  );

  if (!nearestLine) {return charOffset;}

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
  if (!span) {return charOffset;}

  const nearestLine = findNearestLine(
    { x: span.bounds.left, y: (span.bounds.top + span.bounds.bottom) / 2 },
    layer,
  );

  if (!nearestLine) {return charOffset;}

  // Find the rightmost span in this line
  const rightmostSpan = nearestLine.spans.reduce((right, s) =>
    s.bounds.right > right.bounds.right ? s : right,
  );

  return rightmostSpan.endOffset;
}
