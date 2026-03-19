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
  findNearestText,
  refreshSpanBounds,
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
    const selectionPoint = createSelectionPointFromScreen(screenPoint, textLayers, {
      maxSearchDistance: this.options.maxTextSearchDistance,
    });

    // Check if click is in a text layer
    if (selectionPoint.pageIndex < 0) {
      return;
    }

    // Start intercepting if we're in or near text
    const nearestText = findNearestText(screenPoint, textLayers, {
      maxSearchDistance: this.options.maxTextSearchDistance,
    });

    if (!nearestText) {
      return;
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
    const selectionPoint = createSelectionPointFromScreen(screenPoint, textLayers, {
      maxSearchDistance: this.options.maxTextSearchDistance,
    });

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

    // Get ordered positions
    const { start, end } = getOrderedPositions(anchorPos, focusPos);

    // Build page ranges
    const pageRanges: PageSelectionRange[] = [];
    const textLayers = this.collectTextLayers();

    if (start.pageIndex === end.pageIndex) {
      // Single page selection
      pageRanges.push({
        pageIndex: start.pageIndex,
        startOffset: start.charOffset,
        endOffset: end.charOffset,
      });
    } else {
      // Multi-page selection
      this.state.isMultiPage = true;

      // First page: from start to end of page
      const firstLayer = textLayers.find(l => l.pageIndex === start.pageIndex);
      if (firstLayer) {
        pageRanges.push({
          pageIndex: start.pageIndex,
          startOffset: start.charOffset,
          endOffset: firstLayer.fullText.length,
        });
      }

      // Middle pages: entire page
      for (const layer of textLayers) {
        if (layer.pageIndex > start.pageIndex && layer.pageIndex < end.pageIndex) {
          pageRanges.push({
            pageIndex: layer.pageIndex,
            startOffset: 0,
            endOffset: layer.fullText.length,
          });
        }
      }

      // Last page: from start of page to end
      pageRanges.push({
        pageIndex: end.pageIndex,
        startOffset: 0,
        endOffset: end.charOffset,
      });
    }

    this.state.pageRanges = pageRanges;
    this.state.hasSelection = pageRanges.length > 0;

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

  /**
   * Apply the final selection to the browser.
   */
  private applyFinalSelection(): void {
    const textLayers = this.collectTextLayers();

    // Try to create a native browser selection if possible
    if (this.state.pageRanges.length === 1) {
      const range = this.state.pageRanges[0];
      const layer = textLayers.find(l => l.pageIndex === range.pageIndex);

      if (layer) {
        this.createNativeSelection(range, layer);
      }
    }

    // Keep custom rendering for multi-page or complex selections
    this.state.lastUpdated = Date.now();
  }

  /**
   * Try to create a native browser selection for a single page range.
   */
  private createNativeSelection(range: PageSelectionRange, layer: TextLayerInfo): void {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    // Find start and end nodes
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    for (const span of layer.spans) {
      // Find start
      if (!startNode && span.endOffset > range.startOffset) {
        startNode = span.element.firstChild;
        startOffset = Math.max(0, range.startOffset - span.startOffset);
      }

      // Find end
      if (span.endOffset >= range.endOffset) {
        endNode = span.element.firstChild;
        endOffset = Math.min(span.text.length, range.endOffset - span.startOffset);
        break;
      }
    }

    if (startNode && endNode) {
      try {
        const domRange = document.createRange();
        domRange.setStart(startNode, startOffset);
        domRange.setEnd(endNode, endOffset);

        selection.removeAllRanges();
        selection.addRange(domRange);
      } catch {
        // Native selection failed, keep custom rendering
      }
    }
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
