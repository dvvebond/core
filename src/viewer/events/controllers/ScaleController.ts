import { EventSystem } from "../EventSystem.ts";
import type { ScaleChangedPayload, Subscription } from "../types.ts";
import { EventType } from "../types.ts";

/**
 * Controller for zoom/scale state changes.
 * Manages the current scale factor and emits events on changes.
 */
export class ScaleController {
  private eventSystem: EventSystem;
  private currentScale: number;
  private minScale: number;
  private maxScale: number;

  constructor(eventSystem: EventSystem, initialScale = 1.0, minScale = 0.1, maxScale = 10.0) {
    this.eventSystem = eventSystem;
    this.currentScale = initialScale;
    this.minScale = minScale;
    this.maxScale = maxScale;
  }

  /**
   * Set a new scale value.
   * @param scale The new scale factor
   * @param origin Optional origin point for the scale change
   * @returns true if the scale was changed, false if clamped to same value
   */
  setScale(scale: number, origin?: { x: number; y: number }): boolean {
    const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, scale));
    if (clampedScale === this.currentScale) {
      return false;
    }

    const previousScale = this.currentScale;
    this.currentScale = clampedScale;

    this.eventSystem.emit(EventType.ScaleChanged, {
      previousScale,
      currentScale: clampedScale,
      origin,
    });

    return true;
  }

  /**
   * Increase scale by a multiplier.
   * @param factor Multiplier (default 1.25 for 25% increase)
   * @param origin Optional origin point
   */
  zoomIn(factor = 1.25, origin?: { x: number; y: number }): boolean {
    return this.setScale(this.currentScale * factor, origin);
  }

  /**
   * Decrease scale by a multiplier.
   * @param factor Divisor (default 1.25 for 20% decrease)
   * @param origin Optional origin point
   */
  zoomOut(factor = 1.25, origin?: { x: number; y: number }): boolean {
    return this.setScale(this.currentScale / factor, origin);
  }

  /**
   * Reset scale to 1.0.
   */
  resetScale(): boolean {
    return this.setScale(1.0);
  }

  /**
   * Get the current scale factor.
   */
  getScale(): number {
    return this.currentScale;
  }

  /**
   * Get the minimum allowed scale.
   */
  getMinScale(): number {
    return this.minScale;
  }

  /**
   * Get the maximum allowed scale.
   */
  getMaxScale(): number {
    return this.maxScale;
  }

  /**
   * Subscribe to scale change events.
   * @param listener Callback for when scale changes
   * @returns Subscription handle
   */
  onScaleChanged(listener: (payload: ScaleChangedPayload) => void): Subscription {
    return this.eventSystem.subscribe(EventType.ScaleChanged, listener);
  }
}
