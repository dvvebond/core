/**
 * Selection renderer for custom text selection highlighting.
 *
 * This module provides a custom highlighting overlay system that renders
 * selection visuals when the cursor is in non-text areas. It maintains
 * selection appearance even when browser native selection might fail.
 */

import type { Point2D } from "../coordinate-transformer";
import type { PageSelectionRange, TextLayerInfo } from "./selection-state";
import { findSpansInRange } from "./spatial-positioning";

/**
 * Options for the selection renderer.
 */
export interface SelectionRendererOptions {
  /**
   * Background color for selected text.
   * @default "rgba(0, 100, 255, 0.3)"
   */
  selectionColor?: string;

  /**
   * Background color when selection is in a non-text area.
   * @default "rgba(0, 100, 255, 0.15)"
   */
  nonTextSelectionColor?: string;

  /**
   * Whether to show visual feedback for drag position.
   * @default true
   */
  showDragIndicator?: boolean;

  /**
   * Color for the drag position indicator.
   * @default "rgba(0, 100, 255, 0.8)"
   */
  dragIndicatorColor?: string;

  /**
   * Z-index for the overlay elements.
   * @default 10
   */
  zIndex?: number;
}

const DEFAULT_OPTIONS: Required<SelectionRendererOptions> = {
  selectionColor: "rgba(0, 100, 255, 0.3)",
  nonTextSelectionColor: "rgba(0, 100, 255, 0.15)",
  showDragIndicator: true,
  dragIndicatorColor: "rgba(0, 100, 255, 0.8)",
  zIndex: 10,
};

/**
 * A rendered highlight rectangle.
 */
interface HighlightRect {
  element: HTMLElement;
  pageIndex: number;
  startOffset: number;
  endOffset: number;
}

/**
 * SelectionRenderer manages custom selection highlighting overlays.
 *
 * It creates DOM elements to visualize text selection, particularly useful
 * when selection extends into non-text areas where browser native selection
 * would normally fail.
 */
export class SelectionRenderer {
  private readonly options: Required<SelectionRendererOptions>;
  private readonly overlayContainer: HTMLElement;
  private readonly highlightRects: Map<number, HighlightRect[]> = new Map();
  private dragIndicator: HTMLElement | null = null;
  private isActive = false;

  constructor(
    container: HTMLElement,
    options: SelectionRendererOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create overlay container
    this.overlayContainer = document.createElement("div");
    this.overlayContainer.className = "text-selection-overlay";
    this.overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: ${this.options.zIndex};
      overflow: hidden;
    `;

    container.style.position = container.style.position || "relative";
    container.appendChild(this.overlayContainer);
  }

  /**
   * Activate the custom selection rendering.
   * Call this when starting a selection that might cross non-text areas.
   */
  activate(): void {
    this.isActive = true;
    this.overlayContainer.style.display = "block";
  }

  /**
   * Deactivate the custom selection rendering.
   * Call this when selection ends or when browser native selection should take over.
   */
  deactivate(): void {
    this.isActive = false;
    this.clear();
  }

  /**
   * Check if the renderer is currently active.
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Render selection highlights for the given page ranges.
   *
   * @param ranges - Array of page selection ranges to highlight
   * @param textLayers - Text layer information for calculating positions
   */
  render(ranges: PageSelectionRange[], textLayers: TextLayerInfo[]): void {
    if (!this.isActive) {return;}

    // Clear existing highlights for pages not in the new ranges
    const pageIndices = new Set(ranges.map(r => r.pageIndex));
    for (const [pageIndex] of Array.from(this.highlightRects)) {
      if (!pageIndices.has(pageIndex)) {
        this.clearPage(pageIndex);
      }
    }

    // Render highlights for each range
    for (const range of ranges) {
      this.renderPageRange(range, textLayers);
    }
  }

  /**
   * Render selection highlight for a single page range.
   */
  private renderPageRange(range: PageSelectionRange, textLayers: TextLayerInfo[]): void {
    const layer = textLayers.find(l => l.pageIndex === range.pageIndex);
    if (!layer) {return;}

    // Clear existing highlights for this page
    this.clearPage(range.pageIndex);

    // Find spans in the selection range
    const spans = findSpansInRange(range.startOffset, range.endOffset, layer);

    const rects: HighlightRect[] = [];

    for (const span of spans) {
      // Calculate the portion of this span that's selected
      const spanStart = Math.max(span.startOffset, range.startOffset);
      const spanEnd = Math.min(span.endOffset, range.endOffset);

      if (spanEnd <= spanStart) {continue;}

      // Calculate highlight bounds
      const bounds = this.calculateHighlightBounds(span, spanStart, spanEnd, layer);

      // Create highlight element
      const element = this.createHighlightElement(bounds, false);
      this.overlayContainer.appendChild(element);

      rects.push({
        element,
        pageIndex: range.pageIndex,
        startOffset: spanStart,
        endOffset: spanEnd,
      });
    }

    this.highlightRects.set(range.pageIndex, rects);
  }

  /**
   * Calculate the bounding rectangle for a portion of a span.
   */
  private calculateHighlightBounds(
    span: { bounds: DOMRect; text: string; startOffset: number },
    startOffset: number,
    endOffset: number,
    layer: TextLayerInfo,
  ): DOMRect {
    const localStart = startOffset - span.startOffset;
    const localEnd = endOffset - span.startOffset;
    const textLength = span.text.length;

    if (textLength === 0) {
      return span.bounds;
    }

    // Calculate character width (assuming uniform width)
    const charWidth = span.bounds.width / textLength;

    // Calculate highlight bounds relative to span
    const startX = span.bounds.left + localStart * charWidth;
    const endX = span.bounds.left + localEnd * charWidth;

    // Get container offset to make coordinates relative to overlay container
    const containerRect = this.overlayContainer.getBoundingClientRect();

    return new DOMRect(
      startX - containerRect.left,
      span.bounds.top - containerRect.top,
      endX - startX,
      span.bounds.height,
    );
  }

  /**
   * Create a highlight element with the given bounds.
   */
  private createHighlightElement(bounds: DOMRect, isNonTextArea: boolean): HTMLElement {
    const element = document.createElement("div");
    element.className = "selection-highlight";
    element.style.cssText = `
      position: absolute;
      left: ${bounds.left}px;
      top: ${bounds.top}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      background-color: ${isNonTextArea ? this.options.nonTextSelectionColor : this.options.selectionColor};
      pointer-events: none;
      border-radius: 2px;
    `;
    return element;
  }

  /**
   * Show drag indicator at a specific position.
   *
   * @param position - Screen position for the indicator
   * @param isInNonTextArea - Whether the position is in a non-text area
   */
  showDragIndicator(position: Point2D, isInNonTextArea: boolean): void {
    if (!this.options.showDragIndicator) {return;}

    if (!this.dragIndicator) {
      this.dragIndicator = document.createElement("div");
      this.dragIndicator.className = "selection-drag-indicator";
      this.overlayContainer.appendChild(this.dragIndicator);
    }

    const containerRect = this.overlayContainer.getBoundingClientRect();

    this.dragIndicator.style.cssText = `
      position: absolute;
      left: ${position.x - containerRect.left - 1}px;
      top: ${position.y - containerRect.top - 8}px;
      width: 2px;
      height: 16px;
      background-color: ${this.options.dragIndicatorColor};
      pointer-events: none;
      opacity: ${isInNonTextArea ? 0.5 : 1};
      transition: opacity 0.1s ease;
    `;
  }

  /**
   * Hide the drag indicator.
   */
  hideDragIndicator(): void {
    if (this.dragIndicator) {
      this.dragIndicator.remove();
      this.dragIndicator = null;
    }
  }

  /**
   * Update highlight positions after zoom or scroll changes.
   *
   * @param textLayers - Updated text layer information
   */
  updatePositions(textLayers: TextLayerInfo[]): void {
    if (!this.isActive) {return;}

    for (const [pageIndex, rects] of Array.from(this.highlightRects)) {
      const layer = textLayers.find(l => l.pageIndex === pageIndex);
      if (!layer) {continue;}

      for (const rect of rects) {
        const span = layer.spans.find(
          s => s.startOffset <= rect.startOffset && s.endOffset >= rect.endOffset,
        );
        if (!span) {continue;}

        const bounds = this.calculateHighlightBounds(
          span,
          rect.startOffset,
          rect.endOffset,
          layer,
        );

        rect.element.style.left = `${bounds.left}px`;
        rect.element.style.top = `${bounds.top}px`;
        rect.element.style.width = `${bounds.width}px`;
        rect.element.style.height = `${bounds.height}px`;
      }
    }
  }

  /**
   * Clear highlights for a specific page.
   */
  private clearPage(pageIndex: number): void {
    const rects = this.highlightRects.get(pageIndex);
    if (rects) {
      for (const rect of rects) {
        rect.element.remove();
      }
      this.highlightRects.delete(pageIndex);
    }
  }

  /**
   * Clear all highlights and indicators.
   */
  clear(): void {
    for (const [pageIndex] of Array.from(this.highlightRects)) {
      this.clearPage(pageIndex);
    }
    this.highlightRects.clear();
    this.hideDragIndicator();
  }

  /**
   * Dispose of the renderer and clean up resources.
   */
  dispose(): void {
    this.clear();
    this.overlayContainer.remove();
  }

  /**
   * Get the overlay container element.
   */
  get container(): HTMLElement {
    return this.overlayContainer;
  }

  /**
   * Set the selection color.
   */
  setSelectionColor(color: string): void {
    this.options.selectionColor = color;
    // Update existing highlights
    for (const rects of Array.from(this.highlightRects.values())) {
      for (const rect of rects) {
        rect.element.style.backgroundColor = color;
      }
    }
  }

  /**
   * Set the non-text area selection color.
   */
  setNonTextSelectionColor(color: string): void {
    this.options.nonTextSelectionColor = color;
  }
}

/**
 * Create a new selection renderer.
 *
 * @param container - The container element to render into
 * @param options - Configuration options
 * @returns A new SelectionRenderer instance
 */
export function createSelectionRenderer(
  container: HTMLElement,
  options?: SelectionRendererOptions,
): SelectionRenderer {
  return new SelectionRenderer(container, options);
}
