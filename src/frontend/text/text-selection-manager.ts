/**
 * Text Selection Manager for PDF documents.
 *
 * This module provides a custom text selection system that bypasses browser
 * native selection for drag-across-non-text scenarios. It intercepts mouse
 * events during selection, uses spatial positioning to map coordinates to
 * logical text positions, and maintains complete control over selection state.
 *
 * The key problem this solves: when users drag-select text in a PDF and their
 * mouse moves into non-text areas (margins, gutters, between lines), browser
 * native selection often resets or behaves unexpectedly. This manager maintains
 * selection state throughout the entire drag operation.
 */

import type { Point2D } from "../coordinate-transformer";
import {
  createSelectionRenderer,
  SelectionRenderer,
  type SelectionRendererOptions,
} from "./selection-renderer";
import type {
  DragState,
  PageSelectionRange,
  SelectionAnchor,
  SelectionEvent,
  SelectionEventListener,
  SelectionEventType,
  SelectionPoint,
  SelectionState,
  TextLayerInfo,
  TextPosition,
} from "./selection-state";
import {
  compareTextPositions,
  createInitialDragState,
  createInitialSelectionState,
  createSelectionAnchor,
  createSelectionEvent,
  getOrderedPositions,
} from "./selection-state";
import {
  collectTextLayerInfo,
  createSelectionPointFromScreen,
  getLineRangeForTextPosition,
  getOrderedLineInfos,
  getLineInfoForTextPosition,
  getParagraphRangeForTextPosition,
  getTextPositionOnLine,
  getWordRangeForTextPosition,
  refreshSpanBounds,
  type TextSelectionRange,
} from "./spatial-positioning";

/**
 * Options for the TextSelectionManager.
 */
export interface TextSelectionManagerOptions {
  /**
   * The container element that holds all page containers.
   */
  container: HTMLElement;

  /**
   * Whether to prevent default browser selection behavior.
   * @default true
   */
  preventDefaultSelection?: boolean;

  /**
   * Whether to use custom rendering for selection highlights.
   * @default true
   */
  useCustomRendering?: boolean;

  /**
   * Options for the selection renderer.
   */
  rendererOptions?: SelectionRendererOptions;

  /**
   * Maximum distance to search for nearest text when in non-text areas.
   * @default 100
   */
  maxTextSearchDistance?: number;

  /**
   * Debounce interval for selection change events in milliseconds.
   * @default 16
   */
  debounceInterval?: number;
}

const DEFAULT_OPTIONS: Required<
  Omit<TextSelectionManagerOptions, "container" | "rendererOptions">
> = {
  preventDefaultSelection: true,
  useCustomRendering: true,
  maxTextSearchDistance: 100,
  debounceInterval: 16,
};

type SelectionGranularity = "character" | "word" | "line" | "paragraph";

/**
 * TextSelectionManager handles text selection across PDF pages.
 *
 * It intercepts mouse events to maintain selection state when the cursor
 * moves into non-text areas, preventing the common issue of selection
 * resetting to the document beginning.
 *
 * @example
 * ```ts
 * const manager = createTextSelectionManager({
 *   container: viewerContainer,
 * });
 *
 * // Register text layer containers for each page
 * manager.registerTextLayer(0, page1TextLayer);
 * manager.registerTextLayer(1, page2TextLayer);
 *
 * // Listen for selection changes
 * manager.on("selection-change", (event) => {
 *   console.log("Selected text:", event.newText);
 * });
 *
 * // Enable the manager
 * manager.enable();
 * ```
 */
export class TextSelectionManager {
  private readonly container: HTMLElement;
  private readonly options: Required<
    Omit<TextSelectionManagerOptions, "container" | "rendererOptions">
  >;
  private readonly textLayerContainers: Map<number, HTMLElement> = new Map();
  private readonly eventListeners: Map<SelectionEventType, Set<SelectionEventListener>> = new Map();

  private state: SelectionState;
  private renderer: SelectionRenderer | null = null;
  private enabled = false;
  private isIntercepting = false;
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private selectionGranularity: SelectionGranularity = "character";
  private granularAnchorRange: TextSelectionRange | null = null;

  // Bound event handlers
  private readonly boundMouseDown: (e: MouseEvent) => void;
  private readonly boundMouseMove: (e: MouseEvent) => void;
  private readonly boundMouseUp: (e: MouseEvent) => void;
  private readonly boundSelectStart: (e: Event) => void;

  constructor(options: TextSelectionManagerOptions) {
    this.container = options.container;
    this.options = {
      preventDefaultSelection:
        options.preventDefaultSelection ?? DEFAULT_OPTIONS.preventDefaultSelection,
      useCustomRendering: options.useCustomRendering ?? DEFAULT_OPTIONS.useCustomRendering,
      maxTextSearchDistance: options.maxTextSearchDistance ?? DEFAULT_OPTIONS.maxTextSearchDistance,
      debounceInterval: options.debounceInterval ?? DEFAULT_OPTIONS.debounceInterval,
    };

    this.state = createInitialSelectionState();

    // Create renderer if enabled
    if (this.options.useCustomRendering) {
      this.renderer = createSelectionRenderer(this.container, options.rendererOptions);
    }

    // Bind event handlers
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundSelectStart = this.handleSelectStart.bind(this);
  }

  /**
   * Enable the text selection manager.
   */
  enable(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;

    // Add event listeners to container
    this.container.addEventListener("mousedown", this.boundMouseDown, true);
    document.addEventListener("mousemove", this.boundMouseMove, true);
    document.addEventListener("mouseup", this.boundMouseUp, true);

    if (this.options.preventDefaultSelection) {
      this.container.addEventListener("selectstart", this.boundSelectStart, true);
    }
  }

  /**
   * Disable the text selection manager.
   */
  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;

    // Remove event listeners
    this.container.removeEventListener("mousedown", this.boundMouseDown, true);
    document.removeEventListener("mousemove", this.boundMouseMove, true);
    document.removeEventListener("mouseup", this.boundMouseUp, true);

    if (this.options.preventDefaultSelection) {
      this.container.removeEventListener("selectstart", this.boundSelectStart, true);
    }

    // Clear state
    this.clearSelection();
  }

  /**
   * Register a text layer container for a specific page.
   *
   * @param pageIndex - The page index (0-based)
   * @param container - The text layer container element
   */
  registerTextLayer(pageIndex: number, container: HTMLElement): void {
    this.textLayerContainers.set(pageIndex, container);
  }

  /**
   * Unregister a text layer container.
   *
   * @param pageIndex - The page index to unregister
   */
  unregisterTextLayer(pageIndex: number): void {
    this.textLayerContainers.delete(pageIndex);
  }

  /**
   * Get the current selection state.
   */
  getState(): SelectionState {
    return { ...this.state };
  }

  /**
   * Get the currently selected text.
   */
  getSelectedText(): string {
    return this.state.selectedText;
  }

  /**
   * Check if there is an active selection.
   */
  hasSelection(): boolean {
    return this.state.hasSelection;
  }

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    const hadSelection = this.state.hasSelection;
    const previousText = this.state.selectedText;

    this.state = createInitialSelectionState();
    this.selectionGranularity = "character";
    this.granularAnchorRange = null;
    this.renderer?.clear();
    this.renderer?.deactivate();
    this.isIntercepting = false;

    // Clear browser selection
    window.getSelection()?.removeAllRanges();

    if (hadSelection) {
      this.emitEvent("selection-end", {
        state: this.state,
        source: "blur",
      });
      this.emitEvent("selection-change", {
        state: this.state,
        previousText,
        newText: "",
      });
    }
  }

  /**
   * Add an event listener.
   *
   * @param type - The event type to listen for
   * @param listener - The listener callback
   */
  on<T extends SelectionEventType>(
    type: T,
    listener: SelectionEventListener<Extract<SelectionEvent, { type: T }>>,
  ): void {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(type, listeners);
    }
    listeners.add(listener as SelectionEventListener);
  }

  /**
   * Remove an event listener.
   *
   * @param type - The event type
   * @param listener - The listener to remove
   */
  off<T extends SelectionEventType>(
    type: T,
    listener: SelectionEventListener<Extract<SelectionEvent, { type: T }>>,
  ): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener as SelectionEventListener);
    }
  }

  /**
   * Update positions after zoom or scroll changes.
   */
  updatePositions(): void {
    if (!this.state.hasSelection) {
      return;
    }

    const textLayers = this.collectTextLayers();
    for (const layer of textLayers) {
      refreshSpanBounds(layer);
    }

    this.renderer?.updatePositions(textLayers);
  }

  /**
   * Dispose of the manager and clean up resources.
   */
  dispose(): void {
    this.disable();
    this.renderer?.dispose();
    this.textLayerContainers.clear();
    this.eventListeners.clear();

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle mousedown event.
   */
  private handleMouseDown(event: MouseEvent): void {
    // Only handle primary button (left click)
    if (event.button !== 0) {
      return;
    }

    const screenPoint = this.getScreenPoint(event);
    const textLayers = this.collectTextLayers();
    const granularity = this.getGranularityForClickCount(event.detail);
    const selectionPoint = createSelectionPointFromScreen(screenPoint, textLayers, {
      maxSearchDistance: this.options.maxTextSearchDistance,
    });

    // Clicking blank space should clear any existing selection instead of
    // snapping to nearby text and starting a new drag.
    if (selectionPoint.pageIndex < 0 || !selectionPoint.isInText || !selectionPoint.textPosition) {
      this.clearSelection();
      return;
    }

    if (this.state.hasSelection) {
      this.clearSelection();
    }

    this.selectionGranularity = granularity;
    this.granularAnchorRange =
      granularity === "character" || !selectionPoint.textPosition
        ? null
        : this.resolveGranularRange(selectionPoint.textPosition, granularity, textLayers);

    if (granularity !== "character" && !this.granularAnchorRange) {
      this.selectionGranularity = "character";
    }

    // Start drag
    this.isIntercepting = true;
    const anchor = createSelectionAnchor(selectionPoint, true);

    this.state.dragState = {
      isDragging: true,
      anchor,
      focus: selectionPoint,
      hasLeftTextLayer: !selectionPoint.isInText,
      lastTextPosition: selectionPoint.textPosition ?? null,
      nonTextCrossings: selectionPoint.isInNonTextArea ? 1 : 0,
    };

    this.state.anchor = anchor;
    this.state.focus = selectionPoint;

    // Activate custom renderer
    this.renderer?.activate();

    if (this.selectionGranularity !== "character") {
      this.updateSelection();
    }

    this.emitEvent("drag-start", {
      anchor,
      screenPosition: screenPoint,
    });

    this.emitEvent("selection-start", {
      anchor,
      source: "mouse",
    });

    // Prevent default to stop browser selection
    if (this.options.preventDefaultSelection) {
      event.preventDefault();
    }
  }

  /**
   * Handle mousemove event.
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isIntercepting || !this.state.dragState.isDragging) {
      return;
    }

    const screenPoint = this.getScreenPoint(event);
    const textLayers = this.collectTextLayers();
    let selectionPoint = createSelectionPointFromScreen(screenPoint, textLayers, {
      maxSearchDistance: this.options.maxTextSearchDistance,
    });

    selectionPoint = this.stabilizeNonTextSelectionPoint(selectionPoint, textLayers);

    // Track non-text crossings
    const wasInText = this.state.focus?.isInText ?? false;
    const isNowInText = selectionPoint.isInText;

    if (wasInText && !isNowInText) {
      this.state.dragState.nonTextCrossings++;
      this.state.dragState.hasLeftTextLayer = true;
      this.state.dragState.lastTextPosition = this.state.focus?.textPosition ?? null;

      this.emitEvent("non-text-crossing", {
        direction: "entering",
        screenPosition: screenPoint,
        lastTextPosition: this.state.dragState.lastTextPosition,
      });
    } else if (!wasInText && isNowInText) {
      this.emitEvent("non-text-crossing", {
        direction: "leaving",
        screenPosition: screenPoint,
        lastTextPosition: selectionPoint.textPosition ?? null,
      });
    }

    // Update last known text position
    if (selectionPoint.textPosition) {
      this.state.dragState.lastTextPosition = selectionPoint.textPosition;
    }

    // Update focus
    this.state.focus = selectionPoint;
    this.state.dragState.focus = selectionPoint;

    // Update selection
    this.updateSelection();

    // Show drag indicator
    this.renderer?.showDragIndicator(screenPoint, selectionPoint.isInNonTextArea);

    this.emitEvent("drag-move", {
      focus: selectionPoint,
      screenPosition: screenPoint,
      isInTextArea: !selectionPoint.isInNonTextArea,
    });

    // Prevent default
    if (this.options.preventDefaultSelection) {
      event.preventDefault();
    }
  }

  /**
   * Handle mouseup event.
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.isIntercepting) {
      return;
    }

    const wasInNonTextArea = this.state.dragState.hasLeftTextLayer;

    // Finalize selection
    this.state.dragState.isDragging = false;
    this.isIntercepting = false;

    // Hide drag indicator
    this.renderer?.hideDragIndicator();

    // Apply final selection
    this.applyFinalSelection();

    this.emitEvent("drag-end", {
      state: this.state,
      wasInNonTextArea,
    });

    this.emitEvent("selection-end", {
      state: this.state,
      source: "mouse",
    });
  }

  /**
   * Handle selectstart event.
   */
  private handleSelectStart(event: Event): void {
    if (this.isIntercepting) {
      event.preventDefault();
    }
  }

  /**
   * Get screen point from mouse event.
   */
  private getScreenPoint(event: MouseEvent): Point2D {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  /**
   * Keep non-text drags pinned to the last confirmed text position when
   * heuristic blank-area resolution would move the selection backwards.
   */
  private stabilizeNonTextSelectionPoint(
    selectionPoint: SelectionPoint,
    textLayers: TextLayerInfo[],
  ): SelectionPoint {
    if (!selectionPoint.isInNonTextArea || !selectionPoint.textPosition) {
      return selectionPoint;
    }

    const lastTextPosition = this.state.dragState.lastTextPosition;
    const anchorPosition = this.state.anchor?.point.textPosition;
    if (!lastTextPosition || !anchorPosition) {
      return selectionPoint;
    }

    const gapPinnedPoint = this.resolveGapPinnedSelectionPoint(
      selectionPoint,
      lastTextPosition,
      textLayers,
    );
    if (gapPinnedPoint) {
      return gapPinnedPoint;
    }

    const establishedDirection = compareTextPositions(lastTextPosition, anchorPosition);
    if (establishedDirection === 0) {
      return selectionPoint;
    }

    const candidateDelta = compareTextPositions(selectionPoint.textPosition, lastTextPosition);
    const movesBackward =
      (establishedDirection > 0 && candidateDelta < 0) ||
      (establishedDirection < 0 && candidateDelta > 0);

    if (!movesBackward) {
      return selectionPoint;
    }

    return this.pinSelectionPointToTextPosition(selectionPoint, lastTextPosition);
  }

  /**
   * In the empty gap between two lines, keep the selection on the most recent
   * line the cursor actually touched. A different line only becomes active once
   * the cursor enters that line's text bounds.
   */
  private resolveGapPinnedSelectionPoint(
    selectionPoint: SelectionPoint,
    referencePosition: TextPosition,
    textLayers: TextLayerInfo[],
  ): SelectionPoint | null {
    if (
      !selectionPoint.textPosition ||
      selectionPoint.textPosition.pageIndex !== referencePosition.pageIndex
    ) {
      return null;
    }

    const layer = textLayers.find(textLayer => textLayer.pageIndex === referencePosition.pageIndex);
    if (!layer) {
      return null;
    }

    const referenceLine = getLineInfoForTextPosition(referencePosition, layer);
    const candidateLine = getLineInfoForTextPosition(selectionPoint.textPosition, layer);
    if (!referenceLine || !candidateLine) {
      return null;
    }

    const orderedLines = getOrderedLineInfos(layer);
    const referenceIndex = orderedLines.findIndex(line =>
      line.spans.some(span => referenceLine.spans.includes(span)),
    );
    const candidateIndex = orderedLines.findIndex(line =>
      line.spans.some(span => candidateLine.spans.includes(span)),
    );

    if (referenceIndex < 0 || candidateIndex < 0 || referenceIndex === candidateIndex) {
      return null;
    }

    let targetLineIndex: number | null = null;

    if (referenceIndex < candidateIndex && selectionPoint.screen.y < candidateLine.top) {
      targetLineIndex = candidateIndex - 1;
    }

    if (referenceIndex > candidateIndex && selectionPoint.screen.y > candidateLine.bottom) {
      targetLineIndex = candidateIndex + 1;
    }

    if (targetLineIndex === null) {
      return null;
    }

    const targetLine = orderedLines[targetLineIndex];
    if (!targetLine) {
      return null;
    }

    return this.pinSelectionPointToTextPosition(
      selectionPoint,
      getTextPositionOnLine(selectionPoint.screen, targetLine),
    );
  }

  private pinSelectionPointToTextPosition(
    selectionPoint: SelectionPoint,
    textPosition: TextPosition,
  ): SelectionPoint {
    return {
      ...selectionPoint,
      pageIndex: textPosition.pageIndex,
      textPosition,
    };
  }

  /**
   * Collect text layer information from registered containers.
   */
  private collectTextLayers(): TextLayerInfo[] {
    return collectTextLayerInfo(this.textLayerContainers);
  }

  /**
   * Update the selection based on current anchor and focus.
   */
  private updateSelection(): void {
    const { anchor, focus, dragState } = this.state;
    if (!anchor || !focus) {
      return;
    }

    const anchorPos = anchor.point.textPosition;
    let focusPos = focus.textPosition;

    // When in non-text areas, use the last known text position to maintain selection continuity
    if (!focusPos && dragState.lastTextPosition) {
      focusPos = dragState.lastTextPosition;
    }

    if (!anchorPos || !focusPos) {
      // Can't determine selection without text positions
      this.state.hasSelection = false;
      this.state.pageRanges = [];
      this.state.selectedText = "";
      return;
    }

    const textLayers = this.collectTextLayers();
    const selectionRange = this.resolveSelectionRange(anchorPos, focusPos, textLayers);
    if (!selectionRange) {
      this.state.hasSelection = false;
      this.state.pageRanges = [];
      this.state.selectedText = "";
      return;
    }

    const pageRanges = this.buildPageRanges(selectionRange.start, selectionRange.end, textLayers);
    this.state.pageRanges = pageRanges;
    this.state.hasSelection = pageRanges.length > 0;
    this.state.isMultiPage = pageRanges.length > 1;

    // Extract selected text
    this.state.selectedText = this.extractSelectedText(pageRanges, textLayers);

    // Render highlights
    this.renderer?.render(pageRanges, textLayers);

    // Debounced selection change event
    this.debouncedSelectionChange();
  }

  /**
   * Extract selected text from page ranges.
   */
  private extractSelectedText(ranges: PageSelectionRange[], textLayers: TextLayerInfo[]): string {
    const parts: string[] = [];

    for (const range of ranges) {
      const layer = textLayers.find(l => l.pageIndex === range.pageIndex);
      if (layer) {
        const text = layer.fullText.substring(range.startOffset, range.endOffset);
        parts.push(text);
      }
    }

    return parts.join("\n");
  }

  private getGranularityForClickCount(clickCount: number): SelectionGranularity {
    if (clickCount >= 4) {
      return "paragraph";
    }

    if (clickCount === 3) {
      return "line";
    }

    if (clickCount === 2) {
      return "word";
    }

    return "character";
  }

  private resolveSelectionRange(
    anchorPosition: TextPosition,
    focusPosition: TextPosition,
    textLayers: TextLayerInfo[],
  ): TextSelectionRange | null {
    if (this.selectionGranularity === "character" || !this.granularAnchorRange) {
      const { start, end } = getOrderedPositions(anchorPosition, focusPosition);
      return { start, end };
    }

    if (compareTextPositions(focusPosition, this.granularAnchorRange.start) < 0) {
      const focusRange = this.resolveGranularRange(
        focusPosition,
        this.selectionGranularity,
        textLayers,
      ) ?? {
        start: focusPosition,
        end: focusPosition,
      };

      return {
        start: focusRange.start,
        end: this.granularAnchorRange.end,
      };
    }

    if (compareTextPositions(focusPosition, this.granularAnchorRange.end) > 0) {
      const focusRange = this.resolveGranularRange(
        focusPosition,
        this.selectionGranularity,
        textLayers,
      ) ?? {
        start: focusPosition,
        end: focusPosition,
      };

      return {
        start: this.granularAnchorRange.start,
        end: focusRange.end,
      };
    }

    return this.granularAnchorRange;
  }

  private buildPageRanges(
    start: TextPosition,
    end: TextPosition,
    textLayers: TextLayerInfo[],
  ): PageSelectionRange[] {
    const pageRanges: PageSelectionRange[] = [];

    if (start.pageIndex === end.pageIndex) {
      pageRanges.push({
        pageIndex: start.pageIndex,
        startOffset: start.charOffset,
        endOffset: end.charOffset,
      });
      return pageRanges;
    }

    const firstLayer = textLayers.find(layer => layer.pageIndex === start.pageIndex);
    if (firstLayer) {
      pageRanges.push({
        pageIndex: start.pageIndex,
        startOffset: start.charOffset,
        endOffset: firstLayer.fullText.length,
      });
    }

    for (const layer of textLayers) {
      if (layer.pageIndex > start.pageIndex && layer.pageIndex < end.pageIndex) {
        pageRanges.push({
          pageIndex: layer.pageIndex,
          startOffset: 0,
          endOffset: layer.fullText.length,
        });
      }
    }

    pageRanges.push({
      pageIndex: end.pageIndex,
      startOffset: 0,
      endOffset: end.charOffset,
    });

    return pageRanges;
  }

  private resolveGranularRange(
    textPosition: TextPosition,
    granularity: Exclude<SelectionGranularity, "character">,
    textLayers: TextLayerInfo[],
  ): TextSelectionRange | null {
    const layer = textLayers.find(textLayer => textLayer.pageIndex === textPosition.pageIndex);
    if (!layer) {
      return null;
    }

    if (granularity === "word") {
      return getWordRangeForTextPosition(textPosition, layer);
    }

    if (granularity === "line") {
      return getLineRangeForTextPosition(textPosition, layer);
    }

    return getParagraphRangeForTextPosition(textPosition, layer);
  }

  /**
   * Apply the final selection to the browser.
   */
  private applyFinalSelection(): void {
    const textLayers = this.collectTextLayers();
    let createdNativeSelection = false;

    if (this.state.pageRanges.length > 0) {
      createdNativeSelection = this.createNativeSelection(this.state.pageRanges, textLayers);
    }

    if (createdNativeSelection) {
      this.renderer?.deactivate();
    }

    // Keep custom rendering only when native DOM selection could not be created.
    this.state.lastUpdated = Date.now();
  }

  /**
   * Try to create a native browser selection across the current page ranges.
   */
  private createNativeSelection(
    ranges: PageSelectionRange[],
    textLayers: TextLayerInfo[],
  ): boolean {
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const startRange = ranges[0];
    const endRange = ranges[ranges.length - 1];
    if (!startRange || !endRange) {
      return false;
    }

    const startLayer = textLayers.find(layer => layer.pageIndex === startRange.pageIndex);
    const endLayer = textLayers.find(layer => layer.pageIndex === endRange.pageIndex);
    if (!startLayer || !endLayer) {
      return false;
    }

    const startBoundary = this.resolveNativeSelectionBoundary(
      startRange.startOffset,
      startLayer,
      "start",
    );
    const endBoundary = this.resolveNativeSelectionBoundary(endRange.endOffset, endLayer, "end");

    if (!startBoundary || !endBoundary) {
      return false;
    }

    try {
      const domRange = document.createRange();
      domRange.setStart(startBoundary.node, startBoundary.offset);
      domRange.setEnd(endBoundary.node, endBoundary.offset);

      selection.removeAllRanges();
      selection.addRange(domRange);
      return true;
    } catch {
      // Native selection failed, keep custom rendering
      return false;
    }
  }

  /**
   * Resolve a DOM text node and offset for a page-relative character offset.
   */
  private resolveNativeSelectionBoundary(
    targetOffset: number,
    layer: TextLayerInfo,
    edge: "start" | "end",
  ): { node: Node; offset: number } | null {
    if (layer.spans.length === 0) {
      return null;
    }

    const spans = layer.spans;
    const lastSpan = spans[spans.length - 1];

    for (const span of spans) {
      const matchesStart = edge === "start" && targetOffset < span.endOffset;
      const matchesEnd = edge === "end" && targetOffset <= span.endOffset;
      const matchesFinalEnd =
        edge === "end" && span === lastSpan && targetOffset === lastSpan.endOffset;

      if (!matchesStart && !matchesEnd && !matchesFinalEnd) {
        continue;
      }

      const node = span.element.firstChild;
      if (!node) {
        return null;
      }

      const localOffset = Math.min(span.text.length, Math.max(0, targetOffset - span.startOffset));

      return {
        node,
        offset: localOffset,
      };
    }

    return null;
  }

  /**
   * Emit a debounced selection change event.
   */
  private debouncedSelectionChange(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.emitEvent("selection-change", {
        state: this.state,
        previousText: "", // Not tracked for debounced events
        newText: this.state.selectedText,
      });
    }, this.options.debounceInterval);
  }

  /**
   * Emit an event to listeners.
   */
  private emitEvent<T extends SelectionEventType>(
    type: T,
    data: Omit<Extract<SelectionEvent, { type: T }>, "type" | "timestamp">,
  ): void {
    const event = createSelectionEvent(type, data);
    const listeners = this.eventListeners.get(type);

    if (listeners) {
      for (const listener of Array.from(listeners)) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in selection event listener for ${type}:`, error);
        }
      }
    }
  }
}

/**
 * Create a new TextSelectionManager.
 *
 * @param options - Configuration options
 * @returns A new TextSelectionManager instance
 */
export function createTextSelectionManager(
  options: TextSelectionManagerOptions,
): TextSelectionManager {
  return new TextSelectionManager(options);
}
