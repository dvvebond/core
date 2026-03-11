import { EventSystem } from "../EventSystem.ts";
import type { PageRenderedPayload, Subscription } from "../types.ts";
import { EventType } from "../types.ts";

/**
 * Controller for page rendering lifecycle events.
 * Tracks which pages have been rendered and emits events on render completion.
 */
export class PageController {
  private eventSystem: EventSystem;
  private renderedPages: Map<number, { renderTime: number; renderCount: number }> = new Map();

  constructor(eventSystem: EventSystem) {
    this.eventSystem = eventSystem;
  }

  /**
   * Notify that a page has finished rendering.
   * @param pageNumber 1-based page number
   * @param renderTime Time taken to render in milliseconds
   */
  pageRendered(pageNumber: number, renderTime: number): void {
    const existing = this.renderedPages.get(pageNumber);
    const isRerender = existing !== undefined;

    this.renderedPages.set(pageNumber, {
      renderTime,
      renderCount: (existing?.renderCount ?? 0) + 1,
    });

    this.eventSystem.emit(EventType.PageRendered, {
      pageNumber,
      renderTime,
      isRerender,
    });
  }

  /**
   * Check if a specific page has been rendered.
   * @param pageNumber 1-based page number
   */
  isPageRendered(pageNumber: number): boolean {
    return this.renderedPages.has(pageNumber);
  }

  /**
   * Get render statistics for a specific page.
   * @param pageNumber 1-based page number
   * @returns Render stats or undefined if page hasn't been rendered
   */
  getPageStats(pageNumber: number): { renderTime: number; renderCount: number } | undefined {
    return this.renderedPages.get(pageNumber);
  }

  /**
   * Get all rendered page numbers.
   */
  getRenderedPages(): number[] {
    return Array.from(this.renderedPages.keys());
  }

  /**
   * Clear the render state for a specific page.
   * @param pageNumber 1-based page number
   */
  invalidatePage(pageNumber: number): void {
    this.renderedPages.delete(pageNumber);
  }

  /**
   * Clear render state for all pages.
   */
  invalidateAll(): void {
    this.renderedPages.clear();
  }

  /**
   * Subscribe to page rendered events.
   * @param listener Callback for when a page finishes rendering
   * @returns Subscription handle
   */
  onPageRendered(listener: (payload: PageRenderedPayload) => void): Subscription {
    return this.eventSystem.subscribe(EventType.PageRendered, listener);
  }

  /**
   * Subscribe to page rendered events for a specific page.
   * @param pageNumber 1-based page number to listen for
   * @param listener Callback for when the specific page finishes rendering
   * @returns Subscription handle
   */
  onSpecificPageRendered(
    pageNumber: number,
    listener: (payload: PageRenderedPayload) => void,
  ): Subscription {
    return this.eventSystem.subscribe(EventType.PageRendered, payload => {
      if (payload.pageNumber === pageNumber) {
        listener(payload);
      }
    });
  }
}
