/**
 * Viewport-aware bounding box overlay for PDF visualization.
 *
 * This class extends the base BoundingBoxOverlay with viewport integration,
 * providing automatic re-rendering when viewport changes (zoom/pan) occur
 * and efficient culling of off-screen bounding boxes.
 *
 * @module frontend/overlays/bounding-box-overlay
 */

import type { CoordinateTransformer, Point2D, Rect2D } from "../../coordinate-transformer";
import type { Viewport } from "../../renderers/base-renderer";
import type { ViewportManager, ViewportManagerEvent } from "../../viewport-manager";
import {
  BoundingBoxOverlay as BaseBoundingBoxOverlay,
  type BoundingBoxOverlayOptions,
  type BoundingBoxType,
  type BoundingBoxVisibility,
  type OverlayBoundingBox,
} from "../bounding-box-overlay";

/**
 * Viewport bounds in screen coordinates.
 */
export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Options for the viewport-aware bounding box overlay.
 */
export interface ViewportAwareBoundingBoxOverlayOptions extends BoundingBoxOverlayOptions {
  /**
   * Whether to automatically re-render when viewport changes.
   * @default true
   */
  autoRenderOnViewportChange?: boolean;

  /**
   * Whether to cull bounding boxes outside the visible viewport.
   * @default true
   */
  enableViewportCulling?: boolean;

  /**
   * Extra margin (in pixels) around viewport for culling.
   * Boxes within this margin of the viewport will still be rendered.
   * @default 50
   */
  cullingMargin?: number;
}

/**
 * Event types for viewport-aware overlay.
 */
export type ViewportOverlayEventType =
  | "viewportChange"
  | "render"
  | "visibilityChange"
  | "boxesChange";

/**
 * Event data for viewport-aware overlay events.
 */
export interface ViewportOverlayEvent {
  type: ViewportOverlayEventType;
  pageIndex?: number;
  viewport?: Viewport;
  scale?: number;
  visibility?: BoundingBoxVisibility;
  renderedBoxCount?: number;
  culledBoxCount?: number;
}

/**
 * Listener function for viewport overlay events.
 */
export type ViewportOverlayEventListener = (event: ViewportOverlayEvent) => void;

/**
 * Viewport-aware bounding box overlay that integrates with ViewportManager.
 *
 * This overlay automatically responds to viewport changes (zoom/pan) and
 * efficiently culls off-screen bounding boxes for better performance.
 *
 * @example
 * ```ts
 * const overlay = new ViewportAwareBoundingBoxOverlay({
 *   enableViewportCulling: true,
 *   cullingMargin: 100,
 * });
 *
 * // Connect to viewport manager
 * overlay.connectToViewportManager(viewportManager);
 *
 * // Set bounding boxes for pages
 * overlay.setBoundingBoxes(0, characterBoxes);
 *
 * // Enable word boxes
 * overlay.setVisibility("word", true);
 * ```
 */
export class ViewportAwareBoundingBoxOverlay {
  private _baseOverlay: BaseBoundingBoxOverlay;
  private _viewportManager: ViewportManager | null = null;
  private _autoRender: boolean;
  private _enableCulling: boolean;
  private _cullingMargin: number;
  private _listeners: Map<ViewportOverlayEventType, Set<ViewportOverlayEventListener>> = new Map();
  private _pageTransformers: Map<number, CoordinateTransformer> = new Map();
  private _currentViewport: Viewport | null = null;
  private _disposed = false;

  constructor(options: ViewportAwareBoundingBoxOverlayOptions = {}) {
    this._baseOverlay = new BaseBoundingBoxOverlay(options);
    this._autoRender = options.autoRenderOnViewportChange ?? true;
    this._enableCulling = options.enableViewportCulling ?? true;
    this._cullingMargin = options.cullingMargin ?? 50;

    // Forward base overlay events
    this._baseOverlay.addEventListener("visibilityChange", event => {
      this.emitEvent({
        type: "visibilityChange",
        visibility: event.visibility,
      });
    });

    this._baseOverlay.addEventListener("boxesChange", event => {
      this.emitEvent({
        type: "boxesChange",
        pageIndex: event.pageIndex,
      });
    });
  }

  /**
   * Get the current visibility state.
   */
  get visibility(): BoundingBoxVisibility {
    return this._baseOverlay.visibility;
  }

  /**
   * Whether the overlay is connected to a viewport manager.
   */
  get isConnected(): boolean {
    return this._viewportManager !== null;
  }

  /**
   * The current viewport if connected.
   */
  get currentViewport(): Viewport | null {
    return this._currentViewport;
  }

  /**
   * Connect to a ViewportManager to receive viewport change events.
   */
  connectToViewportManager(manager: ViewportManager): void {
    if (this._viewportManager) {
      this.disconnectFromViewportManager();
    }

    this._viewportManager = manager;

    // Listen for page rendered events to set up page rendering
    manager.addEventListener("pageRendered", this.handlePageRendered);
    manager.addEventListener("pageStateChange", this.handlePageStateChange);
  }

  /**
   * Disconnect from the current ViewportManager.
   */
  disconnectFromViewportManager(): void {
    if (!this._viewportManager) {
      return;
    }

    this._viewportManager.removeEventListener("pageRendered", this.handlePageRendered);
    this._viewportManager.removeEventListener("pageStateChange", this.handlePageStateChange);
    this._viewportManager = null;
    this._pageTransformers.clear();
  }

  /**
   * Handle viewport change events.
   */
  handleViewportChange(viewport: Viewport, pageWidth: number, pageHeight: number): void {
    this._currentViewport = viewport;

    this.emitEvent({
      type: "viewportChange",
      viewport,
      scale: viewport.scale,
    });

    if (this._autoRender) {
      this.rerenderAllPages();
    }
  }

  /**
   * Set up a coordinate transformer for a page.
   */
  setPageTransformer(pageIndex: number, transformer: CoordinateTransformer): void {
    this._pageTransformers.set(pageIndex, transformer);
  }

  /**
   * Get the coordinate transformer for a page.
   */
  getPageTransformer(pageIndex: number): CoordinateTransformer | undefined {
    return this._pageTransformers.get(pageIndex);
  }

  /**
   * Set the visibility of a specific bounding box type.
   */
  setVisibility(type: BoundingBoxType, visible: boolean): void {
    this._baseOverlay.setVisibility(type, visible);
  }

  /**
   * Toggle the visibility of a specific bounding box type.
   */
  toggleVisibility(type: BoundingBoxType): void {
    this._baseOverlay.toggleVisibility(type);
  }

  /**
   * Set visibility for all types at once.
   */
  setAllVisibility(visibility: Partial<BoundingBoxVisibility>): void {
    this._baseOverlay.setAllVisibility(visibility);
  }

  /**
   * Set bounding boxes for a specific page.
   */
  setBoundingBoxes(pageIndex: number, boxes: OverlayBoundingBox[]): void {
    this._baseOverlay.setBoundingBoxes(pageIndex, boxes);
  }

  /**
   * Get bounding boxes for a specific page.
   */
  getBoundingBoxes(pageIndex: number): OverlayBoundingBox[] {
    return this._baseOverlay.getBoundingBoxes(pageIndex);
  }

  /**
   * Get bounding boxes for a page with viewport culling applied.
   *
   * @param pageIndex - Page index
   * @param viewportBounds - The visible viewport bounds in screen coordinates
   * @param scale - Optional scale factor for fallback conversion
   * @param pageHeight - Optional page height for fallback conversion
   * @returns Bounding boxes that are within or near the visible viewport
   */
  getVisibleBoundingBoxes(
    pageIndex: number,
    viewportBounds: ViewportBounds,
    scale?: number,
    pageHeight?: number,
  ): OverlayBoundingBox[] {
    if (!this._enableCulling) {
      return this.getBoundingBoxes(pageIndex);
    }

    const boxes = this._baseOverlay.getBoundingBoxes(pageIndex);
    const transformer = this._pageTransformers.get(pageIndex);

    const margin = this._cullingMargin;
    const expandedBounds: ViewportBounds = {
      left: viewportBounds.left - margin,
      top: viewportBounds.top - margin,
      right: viewportBounds.right + margin,
      bottom: viewportBounds.bottom + margin,
    };

    return boxes.filter(box => {
      let screenRect: Rect2D;

      if (transformer) {
        // Use transformer for accurate conversion
        screenRect = transformer.pdfRectToScreen({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        });
      } else if (scale !== undefined && pageHeight !== undefined) {
        // Fallback: simple conversion based on scale and page height
        // PDF coordinates have origin at bottom-left, screen at top-left
        const screenY = pageHeight - box.y - box.height;
        screenRect = {
          x: box.x * scale,
          y: screenY * scale,
          width: box.width * scale,
          height: box.height * scale,
        };
      } else {
        // No conversion possible, include the box
        return true;
      }

      // Check if the box intersects with the expanded viewport bounds
      return this.rectIntersectsViewport(screenRect, expandedBounds);
    });
  }

  /**
   * Clear bounding boxes for a specific page.
   */
  clearBoundingBoxes(pageIndex: number): void {
    this._baseOverlay.clearBoundingBoxes(pageIndex);
    this._pageTransformers.delete(pageIndex);
  }

  /**
   * Clear all bounding boxes.
   */
  clearAllBoundingBoxes(): void {
    this._baseOverlay.clearAllBoundingBoxes();
    this._pageTransformers.clear();
  }

  /**
   * Render bounding boxes to a page container with viewport-aware culling.
   *
   * @param pageIndex - Page index
   * @param container - The page container element
   * @param scale - Current zoom scale
   * @param pageHeight - Height of the page in PDF points
   * @param viewportBounds - Optional viewport bounds for culling
   */
  renderToPage(
    pageIndex: number,
    container: HTMLElement,
    scale: number,
    pageHeight: number,
    viewportBounds?: ViewportBounds,
  ): HTMLElement {
    let renderedBoxCount = 0;
    let culledBoxCount = 0;

    // If viewport culling is enabled and we have bounds, apply culling
    if (this._enableCulling && viewportBounds) {
      const allBoxes = this._baseOverlay.getBoundingBoxes(pageIndex);
      const visibleBoxes = this.getVisibleBoundingBoxes(
        pageIndex,
        viewportBounds,
        scale,
        pageHeight,
      );

      culledBoxCount = allBoxes.length - visibleBoxes.length;
      renderedBoxCount = visibleBoxes.length;

      // Temporarily set only visible boxes for rendering
      // Note: This is an optimization - we could also just let the base overlay
      // render all boxes and rely on CSS overflow:hidden to clip them
      if (culledBoxCount > 0) {
        // Store original boxes, set visible ones, render, restore
        this._baseOverlay.setBoundingBoxes(pageIndex, visibleBoxes);
        const result = this._baseOverlay.renderToPage(pageIndex, container, scale, pageHeight);
        this._baseOverlay.setBoundingBoxes(pageIndex, allBoxes);

        this.emitEvent({
          type: "render",
          pageIndex,
          renderedBoxCount,
          culledBoxCount,
        });

        return result;
      }
    }

    const result = this._baseOverlay.renderToPage(pageIndex, container, scale, pageHeight);
    renderedBoxCount = this._baseOverlay.getBoundingBoxes(pageIndex).length;

    this.emitEvent({
      type: "render",
      pageIndex,
      renderedBoxCount,
      culledBoxCount,
    });

    return result;
  }

  /**
   * Remove the overlay for a specific page.
   */
  removeFromPage(pageIndex: number): void {
    this._baseOverlay.removeFromPage(pageIndex);
  }

  /**
   * Remove all overlays.
   */
  removeAllOverlays(): void {
    this._baseOverlay.removeAllOverlays();
  }

  /**
   * Update the scale for all existing overlays.
   */
  updateScale(scale: number): void {
    this._baseOverlay.updateScale(scale);
  }

  /**
   * Add an event listener.
   */
  addEventListener(type: ViewportOverlayEventType, listener: ViewportOverlayEventListener): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener(
    type: ViewportOverlayEventType,
    listener: ViewportOverlayEventListener,
  ): void {
    this._listeners.get(type)?.delete(listener);
  }

  /**
   * Dispose of the overlay and clean up resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this.disconnectFromViewportManager();
    this._baseOverlay.dispose();
    this._pageTransformers.clear();
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handlePageRendered = (event: ViewportManagerEvent): void => {
    // When a page is rendered, we may need to update our overlay
    if (this._autoRender && event.pageIndex !== undefined) {
      // The page has been rendered - if we have boxes for it, they'll be rendered
      // by the demo's pageRendered handler
    }
  };

  private handlePageStateChange = (event: ViewportManagerEvent): void => {
    // Handle page state changes if needed
    if (event.state === "idle" && event.pageIndex !== undefined) {
      // Page was cleaned up - remove our overlay too
      this.removeFromPage(event.pageIndex);
    }
  };

  private rerenderAllPages(): void {
    // This would be called when viewport changes
    // The actual re-rendering is handled by the demo's event handlers
    // We just need to update the scale on existing overlays
    if (this._currentViewport) {
      this.updateScale(this._currentViewport.scale);
    }
  }

  private rectIntersectsViewport(rect: Rect2D, viewport: ViewportBounds): boolean {
    return !(
      rect.x + rect.width < viewport.left ||
      rect.x > viewport.right ||
      rect.y + rect.height < viewport.top ||
      rect.y > viewport.bottom
    );
  }

  private emitEvent(event: ViewportOverlayEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in viewport overlay event listener:`, error);
        }
      }
    }
  }
}

/**
 * Create a new ViewportAwareBoundingBoxOverlay instance.
 */
export function createViewportAwareBoundingBoxOverlay(
  options?: ViewportAwareBoundingBoxOverlayOptions,
): ViewportAwareBoundingBoxOverlay {
  return new ViewportAwareBoundingBoxOverlay(options);
}

// Re-export base types for convenience
export type {
  OverlayBoundingBox,
  BoundingBoxType,
  BoundingBoxColors,
  BoundingBoxVisibility,
  BoundingBoxOverlayOptions,
} from "../bounding-box-overlay";
