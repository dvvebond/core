/**
 * HighlightRenderer for PDF viewing.
 *
 * Manages the rendering of highlight overlays for search results, user highlights,
 * and text selections. Uses the CoordinateTransformer to properly position
 * highlights during zoom and pan operations.
 */

import { CoordinateTransformer, type Rect2D } from "#src/coordinate-transformer";
import type { BoundingBox } from "#src/text/types";

import {
  createHighlightEvent,
  DEFAULT_HIGHLIGHT_STYLES,
  mergeHighlightStyles,
  type HighlightEvent,
  type HighlightEventListener,
  type HighlightEventType,
  type HighlightRegion,
  type HighlightRendererOptions,
  type HighlightStyle,
  type HighlightType,
  type RenderedHighlight,
} from "./types";

/**
 * Default options for the HighlightRenderer.
 */
const DEFAULT_OPTIONS: Required<HighlightRendererOptions> = {
  styles: {},
  classPrefix: "pdf-highlight",
  useCharBounds: true,
  zIndex: 10,
};

/**
 * HighlightRenderer creates and manages highlight overlay elements.
 *
 * This class is responsible for:
 * - Creating DOM elements for highlight regions
 * - Positioning highlights using coordinate transformation
 * - Updating positions during zoom/pan operations
 * - Managing highlight visibility and lifecycle
 *
 * @example
 * ```ts
 * const renderer = new HighlightRenderer(containerElement, {
 *   styles: {
 *     search: { backgroundColor: 'rgba(255, 255, 0, 0.5)' },
 *   },
 * });
 *
 * // Set the coordinate transformer for positioning
 * renderer.setTransformer(transformer);
 *
 * // Add search result highlights
 * renderer.addHighlights(searchResults.map(r => ({
 *   pageIndex: r.pageIndex,
 *   bounds: r.bounds,
 *   charBounds: r.charBounds,
 *   type: 'search',
 * })));
 *
 * // Update current search result
 * renderer.setCurrentHighlight('search-result-5');
 *
 * // Update positions after zoom/pan
 * renderer.updatePositions();
 * ```
 */
export class HighlightRenderer {
  private container: HTMLElement;
  private highlightLayer: HTMLElement;
  private options: Required<HighlightRendererOptions>;
  private transformer: CoordinateTransformer | null = null;

  private highlights: Map<string, HighlightRegion> = new Map();
  private renderedHighlights: Map<string, RenderedHighlight> = new Map();
  private currentHighlightId: string | null = null;

  private eventListeners: Map<HighlightEventType, Set<HighlightEventListener>> = new Map();
  private highlightIdCounter = 0;

  constructor(container: HTMLElement, options?: HighlightRendererOptions) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create the highlight layer
    this.highlightLayer = document.createElement("div");
    this.highlightLayer.className = `${this.options.classPrefix}-layer`;
    this.highlightLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${this.options.zIndex};
      overflow: hidden;
    `;

    this.container.appendChild(this.highlightLayer);
  }

  /**
   * Set the coordinate transformer for positioning highlights.
   */
  setTransformer(transformer: CoordinateTransformer): void {
    this.transformer = transformer;
    this.updatePositions();
  }

  /**
   * Get the current coordinate transformer.
   */
  getTransformer(): CoordinateTransformer | null {
    return this.transformer;
  }

  /**
   * Add a single highlight region.
   */
  addHighlight(region: HighlightRegion): string {
    const id = region.id ?? this.generateId();
    const highlightWithId = { ...region, id };
    this.highlights.set(id, highlightWithId);
    this.renderHighlight(highlightWithId);
    this.emitUpdatedEvent(1, 0);
    return id;
  }

  /**
   * Add multiple highlight regions.
   */
  addHighlights(regions: HighlightRegion[]): string[] {
    const ids: string[] = [];
    for (const region of regions) {
      const id = region.id ?? this.generateId();
      const highlightWithId = { ...region, id };
      this.highlights.set(id, highlightWithId);
      this.renderHighlight(highlightWithId);
      ids.push(id);
    }
    if (regions.length > 0) {
      this.emitUpdatedEvent(regions.length, 0);
    }
    return ids;
  }

  /**
   * Remove a highlight by ID.
   */
  removeHighlight(id: string): boolean {
    const highlight = this.highlights.get(id);
    if (!highlight) {
      return false;
    }

    this.highlights.delete(id);
    const rendered = this.renderedHighlights.get(id);
    if (rendered) {
      rendered.element.remove();
      this.renderedHighlights.delete(id);
    }

    if (this.currentHighlightId === id) {
      this.currentHighlightId = null;
    }

    this.emitUpdatedEvent(0, 1);
    return true;
  }

  /**
   * Remove all highlights of a specific type.
   */
  removeHighlightsByType(type: HighlightType): number {
    let removedCount = 0;
    const idsToRemove: string[] = [];

    for (const [id, highlight] of this.highlights) {
      if (highlight.type === type) {
        idsToRemove.push(id);
      }
    }

    for (const id of idsToRemove) {
      this.highlights.delete(id);
      const rendered = this.renderedHighlights.get(id);
      if (rendered) {
        rendered.element.remove();
        this.renderedHighlights.delete(id);
      }
      if (this.currentHighlightId === id) {
        this.currentHighlightId = null;
      }
      removedCount++;
    }

    if (removedCount > 0) {
      this.emitUpdatedEvent(0, removedCount);
    }

    return removedCount;
  }

  /**
   * Remove all highlights.
   */
  clearHighlights(): void {
    const count = this.highlights.size;
    this.highlights.clear();
    this.currentHighlightId = null;

    // Remove all rendered elements
    for (const rendered of this.renderedHighlights.values()) {
      rendered.element.remove();
    }
    this.renderedHighlights.clear();

    if (count > 0) {
      this.emitUpdatedEvent(0, count);
    }
  }

  /**
   * Get a highlight by ID.
   */
  getHighlight(id: string): HighlightRegion | undefined {
    return this.highlights.get(id);
  }

  /**
   * Get all highlights.
   */
  getAllHighlights(): HighlightRegion[] {
    return Array.from(this.highlights.values());
  }

  /**
   * Get highlights by type.
   */
  getHighlightsByType(type: HighlightType): HighlightRegion[] {
    return Array.from(this.highlights.values()).filter(h => h.type === type);
  }

  /**
   * Get highlights for a specific page.
   */
  getHighlightsForPage(pageIndex: number): HighlightRegion[] {
    return Array.from(this.highlights.values()).filter(h => h.pageIndex === pageIndex);
  }

  /**
   * Set the current highlighted item (e.g., current search result).
   * This applies the 'search-current' style to the specified highlight.
   */
  setCurrentHighlight(id: string | null): void {
    // Restore previous current highlight to normal style
    if (this.currentHighlightId !== null) {
      const prevHighlight = this.highlights.get(this.currentHighlightId);
      const prevRendered = this.renderedHighlights.get(this.currentHighlightId);
      if (prevHighlight && prevRendered && prevHighlight.type === "search") {
        this.applyStyle(prevRendered.element, "search");
      }
    }

    this.currentHighlightId = id;

    // Apply current style to new highlight
    if (id !== null) {
      const highlight = this.highlights.get(id);
      const rendered = this.renderedHighlights.get(id);
      if (highlight && rendered && highlight.type === "search") {
        this.applyStyle(rendered.element, "search-current");
      }
    }
  }

  /**
   * Get the current highlight ID.
   */
  getCurrentHighlightId(): string | null {
    return this.currentHighlightId;
  }

  /**
   * Update all highlight positions based on the current transformer state.
   * Call this after zoom, pan, or page changes.
   */
  updatePositions(): void {
    if (!this.transformer) {
      return;
    }

    for (const [id, rendered] of this.renderedHighlights) {
      const highlight = this.highlights.get(id);
      if (highlight) {
        this.positionElement(rendered.element, highlight);
      }
    }
  }

  /**
   * Update positions for a specific page only.
   */
  updatePositionsForPage(pageIndex: number): void {
    if (!this.transformer) {
      return;
    }

    for (const [id, rendered] of this.renderedHighlights) {
      const highlight = this.highlights.get(id);
      if (highlight && highlight.pageIndex === pageIndex) {
        this.positionElement(rendered.element, highlight);
      }
    }
  }

  /**
   * Set visibility of highlights by type.
   */
  setTypeVisibility(type: HighlightType, visible: boolean): void {
    for (const [id, rendered] of this.renderedHighlights) {
      const highlight = this.highlights.get(id);
      if (highlight && highlight.type === type) {
        rendered.element.style.display = visible ? "" : "none";
        rendered.visible = visible;
      }
    }
  }

  /**
   * Add an event listener.
   */
  addEventListener<T extends HighlightEventType>(
    type: T,
    listener: HighlightEventListener<Extract<HighlightEvent, { type: T }>>,
  ): void {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(type, listeners);
    }
    listeners.add(listener as HighlightEventListener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener<T extends HighlightEventType>(
    type: T,
    listener: HighlightEventListener<Extract<HighlightEvent, { type: T }>>,
  ): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener as HighlightEventListener);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.clearHighlights();
    this.highlightLayer.remove();
    this.eventListeners.clear();
  }

  /**
   * Get the total number of highlights.
   */
  get highlightCount(): number {
    return this.highlights.size;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateId(): string {
    return `highlight-${++this.highlightIdCounter}`;
  }

  private renderHighlight(region: HighlightRegion): void {
    const id = region.id!;

    // Use character bounds for precise highlighting if available
    if (this.options.useCharBounds && region.charBounds && region.charBounds.length > 0) {
      // Create a container for multiple character highlight elements
      const container = document.createElement("div");
      container.className = `${this.options.classPrefix}-container`;
      container.dataset.highlightId = id;
      container.style.cssText = "position: absolute; pointer-events: auto;";

      for (const charBounds of region.charBounds) {
        const charElement = this.createHighlightElement(region.type);
        charElement.className = `${this.options.classPrefix}-char`;
        this.positionElementForBounds(charElement, charBounds);
        container.appendChild(charElement);
      }

      this.setupEventHandlers(container, region);
      this.highlightLayer.appendChild(container);

      this.renderedHighlights.set(id, {
        element: container,
        region,
        visible: true,
      });
    } else {
      // Single element for the whole highlight
      const element = this.createHighlightElement(region.type);
      element.dataset.highlightId = id;
      this.positionElement(element, region);
      this.setupEventHandlers(element, region);
      this.highlightLayer.appendChild(element);

      this.renderedHighlights.set(id, {
        element,
        region,
        visible: true,
      });
    }
  }

  private createHighlightElement(type: HighlightType): HTMLElement {
    const element = document.createElement("div");
    element.className = `${this.options.classPrefix} ${this.options.classPrefix}-${type}`;
    element.style.cssText = "position: absolute; pointer-events: auto;";
    this.applyStyle(element, type);
    return element;
  }

  private applyStyle(element: HTMLElement, type: HighlightType): void {
    const customStyle = this.options.styles[type];
    const style = mergeHighlightStyles(type, customStyle);

    element.style.backgroundColor = style.backgroundColor;
    element.style.opacity = String(style.opacity ?? 1);

    if (style.borderColor && style.borderWidth) {
      element.style.border = `${style.borderWidth}px solid ${style.borderColor}`;
    } else {
      element.style.border = "none";
    }

    if (style.borderRadius) {
      element.style.borderRadius = `${style.borderRadius}px`;
    }

    if (style.mixBlendMode) {
      element.style.mixBlendMode = style.mixBlendMode;
    }
  }

  private positionElement(element: HTMLElement, region: HighlightRegion): void {
    if (!this.transformer) {
      return;
    }

    // If using character bounds, position each child element
    if (
      this.options.useCharBounds &&
      region.charBounds &&
      region.charBounds.length > 0 &&
      element.children.length > 0
    ) {
      // Position the container based on the overall bounds
      const screenRect = this.transformer.pdfRectToScreen(this.boundingBoxToRect(region.bounds));
      element.style.left = `${screenRect.x}px`;
      element.style.top = `${screenRect.y}px`;
      element.style.width = `${screenRect.width}px`;
      element.style.height = `${screenRect.height}px`;

      // Position each character highlight relative to the page
      const children = element.children;
      for (let i = 0; i < Math.min(children.length, region.charBounds.length); i++) {
        const charElement = children[i] as HTMLElement;
        this.positionElementForBounds(charElement, region.charBounds[i]);
      }
    } else {
      // Single element positioning
      this.positionElementForBounds(element, region.bounds);
    }
  }

  private positionElementForBounds(element: HTMLElement, bounds: BoundingBox): void {
    if (!this.transformer) {
      return;
    }

    const screenRect = this.transformer.pdfRectToScreen(this.boundingBoxToRect(bounds));

    element.style.left = `${screenRect.x}px`;
    element.style.top = `${screenRect.y}px`;
    element.style.width = `${screenRect.width}px`;
    element.style.height = `${screenRect.height}px`;
  }

  private boundingBoxToRect(bounds: BoundingBox): Rect2D {
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  private setupEventHandlers(element: HTMLElement, region: HighlightRegion): void {
    element.addEventListener("click", (e: MouseEvent) => {
      this.emitEvent(
        createHighlightEvent("highlight-click", {
          highlight: region,
          originalEvent: e,
        }),
      );
    });

    element.addEventListener("mouseenter", (e: MouseEvent) => {
      this.emitEvent(
        createHighlightEvent("highlight-hover", {
          highlight: region,
          originalEvent: e,
        }),
      );
    });

    element.addEventListener("mouseleave", (e: MouseEvent) => {
      this.emitEvent(
        createHighlightEvent("highlight-leave", {
          highlight: region,
          originalEvent: e,
        }),
      );
    });
  }

  private emitEvent(event: HighlightEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in highlight event listener for ${event.type}:`, error);
        }
      }
    }
  }

  private emitUpdatedEvent(addedCount: number, removedCount: number): void {
    this.emitEvent(
      createHighlightEvent("highlights-updated", {
        addedCount,
        removedCount,
        totalCount: this.highlights.size,
      }),
    );
  }
}

/**
 * Create a new HighlightRenderer instance.
 */
export function createHighlightRenderer(
  container: HTMLElement,
  options?: HighlightRendererOptions,
): HighlightRenderer {
  return new HighlightRenderer(container, options);
}
