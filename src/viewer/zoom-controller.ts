/**
 * ZoomController provides smooth zoom operations with focus point preservation.
 * Uses requestAnimationFrame for smooth animations and easing functions for
 * natural-feeling zoom transitions.
 */

import type {
  EasingFunction,
  Point,
  ZoomAnimationConfig,
  ZoomEndEvent,
  ZoomEvent,
  ZoomEventListener,
  ZoomStartEvent,
  ZoomUpdateEvent,
} from "./interaction-events.ts";
import { easeOutCubic } from "./interaction-events.ts";

/**
 * Options for creating a ZoomController.
 */
export interface ZoomControllerOptions {
  /** Initial scale factor (default: 1.0) */
  initialScale?: number;
  /** Minimum allowed scale (default: 0.1) */
  minScale?: number;
  /** Maximum allowed scale (default: 10.0) */
  maxScale?: number;
  /** Default animation duration in ms (default: 300) */
  animationDuration?: number;
  /** Default easing function (default: easeOutCubic) */
  easing?: EasingFunction;
  /** Factor for zoom in/out operations (default: 1.25) */
  zoomFactor?: number;
}

/**
 * Internal state for tracking an ongoing zoom animation.
 */
interface ZoomAnimation {
  startScale: number;
  targetScale: number;
  focusPoint: Point;
  startTime: number;
  duration: number;
  easing: EasingFunction;
  frameId: number;
}

/**
 * Controller for smooth zoom operations.
 * Handles animated zoom transitions with focus point preservation.
 */
export class ZoomController {
  private currentScale: number;
  private readonly minScale: number;
  private readonly maxScale: number;
  private readonly defaultDuration: number;
  private readonly defaultEasing: EasingFunction;
  private readonly zoomFactor: number;

  private animation: ZoomAnimation | null = null;
  private listeners: Set<ZoomEventListener> = new Set();

  constructor(options: ZoomControllerOptions = {}) {
    const {
      initialScale = 1.0,
      minScale = 0.1,
      maxScale = 10.0,
      animationDuration = 300,
      easing = easeOutCubic,
      zoomFactor = 1.25,
    } = options;

    this.currentScale = this.clampScale(initialScale, minScale, maxScale);
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.defaultDuration = animationDuration;
    this.defaultEasing = easing;
    this.zoomFactor = zoomFactor;
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
   * Check if a zoom animation is currently in progress.
   */
  isAnimating(): boolean {
    return this.animation !== null;
  }

  /**
   * Set the scale immediately without animation.
   * @param scale Target scale factor
   * @param focusPoint Focus point in screen coordinates
   * @returns true if scale changed, false if clamped to same value
   */
  setScale(scale: number, focusPoint: Point = { x: 0, y: 0 }): boolean {
    const clampedScale = this.clampScale(scale);
    if (clampedScale === this.currentScale) {
      return false;
    }

    this.cancelAnimation();

    const previousScale = this.currentScale;
    this.currentScale = clampedScale;

    this.emit({
      type: "zoom:start",
      scale: previousScale,
      targetScale: clampedScale,
      focusPoint,
      animated: false,
    });

    this.emit({
      type: "zoom:update",
      previousScale,
      currentScale: clampedScale,
      focusPoint,
    });

    this.emit({
      type: "zoom:end",
      startScale: previousScale,
      endScale: clampedScale,
      focusPoint,
      cancelled: false,
    });

    return true;
  }

  /**
   * Animate zoom to a target scale.
   * @param targetScale Target scale factor
   * @param focusPoint Focus point in screen coordinates (zoom origin)
   * @param config Optional animation configuration
   */
  zoomTo(
    targetScale: number,
    focusPoint: Point = { x: 0, y: 0 },
    config?: Partial<ZoomAnimationConfig>,
  ): void {
    const clampedTarget = this.clampScale(targetScale);
    if (clampedTarget === this.currentScale) {
      return;
    }

    this.cancelAnimation();

    const duration = config?.duration ?? this.defaultDuration;
    const easing = config?.easing ?? this.defaultEasing;

    const startEvent: ZoomStartEvent = {
      type: "zoom:start",
      scale: this.currentScale,
      targetScale: clampedTarget,
      focusPoint,
      animated: true,
    };
    this.emit(startEvent);

    this.animation = {
      startScale: this.currentScale,
      targetScale: clampedTarget,
      focusPoint,
      startTime: performance.now(),
      duration,
      easing,
      frameId: 0,
    };

    this.animation.frameId = requestAnimationFrame(time => this.animationFrame(time));
  }

  /**
   * Zoom in by the configured zoom factor.
   * @param focusPoint Focus point in screen coordinates
   * @param animated Whether to animate the zoom (default: true)
   */
  zoomIn(focusPoint: Point = { x: 0, y: 0 }, animated = true): void {
    const targetScale = this.currentScale * this.zoomFactor;
    if (animated) {
      this.zoomTo(targetScale, focusPoint);
    } else {
      this.setScale(targetScale, focusPoint);
    }
  }

  /**
   * Zoom out by the configured zoom factor.
   * @param focusPoint Focus point in screen coordinates
   * @param animated Whether to animate the zoom (default: true)
   */
  zoomOut(focusPoint: Point = { x: 0, y: 0 }, animated = true): void {
    const targetScale = this.currentScale / this.zoomFactor;
    if (animated) {
      this.zoomTo(targetScale, focusPoint);
    } else {
      this.setScale(targetScale, focusPoint);
    }
  }

  /**
   * Zoom to fit content within a viewport.
   * @param contentWidth Width of the content
   * @param contentHeight Height of the content
   * @param viewportWidth Width of the viewport
   * @param viewportHeight Height of the viewport
   * @param padding Optional padding around the content (default: 0)
   * @param animated Whether to animate the zoom (default: true)
   */
  zoomToFit(
    contentWidth: number,
    contentHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    padding = 0,
    animated = true,
  ): void {
    const availableWidth = viewportWidth - 2 * padding;
    const availableHeight = viewportHeight - 2 * padding;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const targetScale = Math.min(scaleX, scaleY);

    const focusPoint: Point = {
      x: viewportWidth / 2,
      y: viewportHeight / 2,
    };

    if (animated) {
      this.zoomTo(targetScale, focusPoint);
    } else {
      this.setScale(targetScale, focusPoint);
    }
  }

  /**
   * Reset zoom to 1.0 scale.
   * @param animated Whether to animate the zoom (default: true)
   */
  resetZoom(animated = true): void {
    const focusPoint: Point = { x: 0, y: 0 };
    if (animated) {
      this.zoomTo(1.0, focusPoint);
    } else {
      this.setScale(1.0, focusPoint);
    }
  }

  /**
   * Cancel any ongoing zoom animation.
   */
  cancelAnimation(): void {
    if (!this.animation) {
      return;
    }

    cancelAnimationFrame(this.animation.frameId);

    const endEvent: ZoomEndEvent = {
      type: "zoom:end",
      startScale: this.animation.startScale,
      endScale: this.currentScale,
      focusPoint: this.animation.focusPoint,
      cancelled: true,
    };

    this.animation = null;
    this.emit(endEvent);
  }

  /**
   * Add a listener for zoom events.
   * @param listener Callback function for zoom events
   * @returns Function to remove the listener
   */
  addListener(listener: ZoomEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a listener for zoom events.
   * @param listener The listener to remove
   */
  removeListener(listener: ZoomEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Dispose of the controller, cancelling any animations.
   */
  dispose(): void {
    this.cancelAnimation();
    this.removeAllListeners();
  }

  private animationFrame(currentTime: number): void {
    if (!this.animation) {
      return;
    }

    const elapsed = currentTime - this.animation.startTime;
    const progress = Math.min(elapsed / this.animation.duration, 1);
    const easedProgress = this.animation.easing(progress);

    const previousScale = this.currentScale;
    this.currentScale =
      this.animation.startScale +
      (this.animation.targetScale - this.animation.startScale) * easedProgress;

    const updateEvent: ZoomUpdateEvent = {
      type: "zoom:update",
      previousScale,
      currentScale: this.currentScale,
      focusPoint: this.animation.focusPoint,
      progress,
    };
    this.emit(updateEvent);

    if (progress < 1) {
      this.animation.frameId = requestAnimationFrame(time => this.animationFrame(time));
    } else {
      const endEvent: ZoomEndEvent = {
        type: "zoom:end",
        startScale: this.animation.startScale,
        endScale: this.currentScale,
        focusPoint: this.animation.focusPoint,
        cancelled: false,
      };
      this.animation = null;
      this.emit(endEvent);
    }
  }

  private clampScale(scale: number, min = this.minScale, max = this.maxScale): number {
    return Math.max(min, Math.min(max, scale));
  }

  private emit(event: ZoomEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/**
 * Create a new ZoomController with the given options.
 * @param options Configuration options
 * @returns New ZoomController instance
 */
export function createZoomController(options?: ZoomControllerOptions): ZoomController {
  return new ZoomController(options);
}
