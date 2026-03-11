/**
 * PanHandler manages pan gestures with mouse drag and touch support.
 * Includes momentum/inertia for natural-feeling pan operations on touch devices.
 */

import type {
  PanEndEvent,
  PanEvent,
  PanEventListener,
  PanMomentumConfig,
  PanMomentumEndEvent,
  PanMomentumEvent,
  PanMoveEvent,
  PanStartEvent,
  Point,
  Velocity,
} from "./interaction-events.ts";

/**
 * Options for creating a PanHandler.
 */
export interface PanHandlerOptions {
  /** Initial pan offset (default: { x: 0, y: 0 }) */
  initialOffset?: Point;
  /** Enable momentum after pan gestures (default: true) */
  enableMomentum?: boolean;
  /** Deceleration rate in px/s² (default: 2500) */
  deceleration?: number;
  /** Minimum velocity to trigger momentum (default: 100 px/s) */
  minMomentumVelocity?: number;
  /** Maximum momentum duration in ms (default: 2000) */
  maxMomentumDuration?: number;
  /** Number of velocity samples to average (default: 5) */
  velocitySamples?: number;
}

/**
 * Internal state for tracking velocity during drag.
 */
interface VelocitySample {
  position: Point;
  timestamp: number;
}

/**
 * Internal state for momentum animation.
 */
interface MomentumAnimation {
  startOffset: Point;
  startVelocity: Velocity;
  startTime: number;
  deceleration: number;
  frameId: number;
}

/**
 * Handler for pan gestures with momentum support.
 * Tracks mouse and touch input, calculates velocity, and applies
 * momentum deceleration after gesture release.
 */
export class PanHandler {
  private offset: Point;
  private readonly enableMomentum: boolean;
  private readonly deceleration: number;
  private readonly minMomentumVelocity: number;
  private readonly maxMomentumDuration: number;
  private readonly velocitySampleCount: number;

  private isPanning = false;
  private panSource: "mouse" | "touch" | null = null;
  private startPosition: Point = { x: 0, y: 0 };
  private lastPosition: Point = { x: 0, y: 0 };
  private velocitySamples: VelocitySample[] = [];
  private momentum: MomentumAnimation | null = null;
  private listeners: Set<PanEventListener> = new Set();

  constructor(options: PanHandlerOptions = {}) {
    const {
      initialOffset = { x: 0, y: 0 },
      enableMomentum = true,
      deceleration = 2500,
      minMomentumVelocity = 100,
      maxMomentumDuration = 2000,
      velocitySamples = 5,
    } = options;

    this.offset = { ...initialOffset };
    this.enableMomentum = enableMomentum;
    this.deceleration = deceleration;
    this.minMomentumVelocity = minMomentumVelocity;
    this.maxMomentumDuration = maxMomentumDuration;
    this.velocitySampleCount = velocitySamples;
  }

  /**
   * Get the current pan offset.
   */
  getOffset(): Point {
    return { ...this.offset };
  }

  /**
   * Set the pan offset directly.
   * @param offset New offset value
   */
  setOffset(offset: Point): void {
    this.offset = { ...offset };
  }

  /**
   * Check if a pan gesture is currently active.
   */
  isPanActive(): boolean {
    return this.isPanning;
  }

  /**
   * Check if momentum animation is currently active.
   */
  isMomentumActive(): boolean {
    return this.momentum !== null;
  }

  /**
   * Start a pan gesture (call on mousedown/touchstart).
   * @param position Starting position in screen coordinates
   * @param source Input source
   */
  startPan(position: Point, source: "mouse" | "touch"): void {
    this.stopMomentum();
    this.isPanning = true;
    this.panSource = source;
    this.startPosition = { ...position };
    this.lastPosition = { ...position };
    this.velocitySamples = [{ position: { ...position }, timestamp: performance.now() }];

    const startEvent: PanStartEvent = {
      type: "pan:start",
      position: { ...position },
      offset: { ...this.offset },
      source,
    };
    this.emit(startEvent);
  }

  /**
   * Update pan gesture (call on mousemove/touchmove).
   * @param position Current position in screen coordinates
   */
  movePan(position: Point): void {
    if (!this.isPanning || !this.panSource) {
      return;
    }

    const delta: Point = {
      x: position.x - this.lastPosition.x,
      y: position.y - this.lastPosition.y,
    };

    this.offset = {
      x: this.offset.x + delta.x,
      y: this.offset.y + delta.y,
    };

    const now = performance.now();
    this.velocitySamples.push({ position: { ...position }, timestamp: now });
    if (this.velocitySamples.length > this.velocitySampleCount) {
      this.velocitySamples.shift();
    }

    const velocity = this.calculateVelocity();

    const moveEvent: PanMoveEvent = {
      type: "pan:move",
      position: { ...position },
      delta,
      offset: { ...this.offset },
      velocity,
      source: this.panSource,
    };
    this.emit(moveEvent);

    this.lastPosition = { ...position };
  }

  /**
   * End pan gesture (call on mouseup/touchend).
   * @param position Final position in screen coordinates
   */
  endPan(position: Point): void {
    if (!this.isPanning || !this.panSource) {
      return;
    }

    const velocity = this.calculateVelocity();
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    const willMomentum = this.enableMomentum && speed >= this.minMomentumVelocity;

    const endEvent: PanEndEvent = {
      type: "pan:end",
      position: { ...position },
      offset: { ...this.offset },
      velocity,
      source: this.panSource,
      willMomentum,
    };

    const source = this.panSource;
    this.isPanning = false;
    this.panSource = null;
    this.velocitySamples = [];

    this.emit(endEvent);

    if (willMomentum) {
      this.startMomentum(velocity);
    }
  }

  /**
   * Cancel an active pan gesture without triggering momentum.
   */
  cancelPan(): void {
    if (!this.isPanning) {
      return;
    }

    const source = this.panSource ?? "mouse";
    this.isPanning = false;
    this.panSource = null;
    this.velocitySamples = [];

    const endEvent: PanEndEvent = {
      type: "pan:end",
      position: { ...this.lastPosition },
      offset: { ...this.offset },
      velocity: { x: 0, y: 0 },
      source,
      willMomentum: false,
    };
    this.emit(endEvent);
  }

  /**
   * Stop any active momentum animation.
   */
  stopMomentum(): void {
    if (!this.momentum) {
      return;
    }

    cancelAnimationFrame(this.momentum.frameId);

    const endEvent: PanMomentumEndEvent = {
      type: "pan:momentum-end",
      offset: { ...this.offset },
      cancelled: true,
    };

    this.momentum = null;
    this.emit(endEvent);
  }

  /**
   * Add a listener for pan events.
   * @param listener Callback function for pan events
   * @returns Function to remove the listener
   */
  addListener(listener: PanEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a listener for pan events.
   * @param listener The listener to remove
   */
  removeListener(listener: PanEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Dispose of the handler, stopping any animations.
   */
  dispose(): void {
    this.cancelPan();
    this.stopMomentum();
    this.removeAllListeners();
  }

  /**
   * Get the momentum configuration.
   */
  getMomentumConfig(): PanMomentumConfig {
    return {
      deceleration: this.deceleration,
      minVelocity: this.minMomentumVelocity,
      maxDuration: this.maxMomentumDuration,
    };
  }

  private startMomentum(velocity: Velocity): void {
    this.momentum = {
      startOffset: { ...this.offset },
      startVelocity: { ...velocity },
      startTime: performance.now(),
      deceleration: this.deceleration,
      frameId: 0,
    };

    this.momentum.frameId = requestAnimationFrame(time => this.momentumFrame(time));
  }

  private momentumFrame(currentTime: number): void {
    if (!this.momentum) {
      return;
    }

    const elapsed = (currentTime - this.momentum.startTime) / 1000;
    const { startVelocity, startOffset, deceleration } = this.momentum;

    const speed = Math.sqrt(startVelocity.x ** 2 + startVelocity.y ** 2);
    const duration = speed / deceleration;
    const maxDuration = this.maxMomentumDuration / 1000;
    const effectiveDuration = Math.min(duration, maxDuration);
    const progress = Math.min(elapsed / effectiveDuration, 1);

    const decayFactor = 1 - progress;
    const currentVelocity: Velocity = {
      x: startVelocity.x * decayFactor,
      y: startVelocity.y * decayFactor,
    };

    const distanceX =
      startVelocity.x * elapsed -
      0.5 * (startVelocity.x > 0 ? 1 : -1) * deceleration * elapsed ** 2;
    const distanceY =
      startVelocity.y * elapsed -
      0.5 * (startVelocity.y > 0 ? 1 : -1) * deceleration * elapsed ** 2;

    const normalizedVelocityX = speed > 0 ? startVelocity.x / speed : 0;
    const normalizedVelocityY = speed > 0 ? startVelocity.y / speed : 0;
    const travelDistance = speed * elapsed - 0.5 * deceleration * elapsed ** 2;
    const clampedDistance = Math.max(0, travelDistance);

    this.offset = {
      x: startOffset.x + normalizedVelocityX * clampedDistance,
      y: startOffset.y + normalizedVelocityY * clampedDistance,
    };

    const momentumEvent: PanMomentumEvent = {
      type: "pan:momentum",
      offset: { ...this.offset },
      velocity: currentVelocity,
      progress,
    };
    this.emit(momentumEvent);

    if (progress < 1) {
      this.momentum.frameId = requestAnimationFrame(time => this.momentumFrame(time));
    } else {
      const endEvent: PanMomentumEndEvent = {
        type: "pan:momentum-end",
        offset: { ...this.offset },
        cancelled: false,
      };
      this.momentum = null;
      this.emit(endEvent);
    }
  }

  private calculateVelocity(): Velocity {
    if (this.velocitySamples.length < 2) {
      return { x: 0, y: 0 };
    }

    const first = this.velocitySamples[0];
    const last = this.velocitySamples[this.velocitySamples.length - 1];
    const dt = (last.timestamp - first.timestamp) / 1000;

    if (dt <= 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: (last.position.x - first.position.x) / dt,
      y: (last.position.y - first.position.y) / dt,
    };
  }

  private emit(event: PanEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/**
 * Create a new PanHandler with the given options.
 * @param options Configuration options
 * @returns New PanHandler instance
 */
export function createPanHandler(options?: PanHandlerOptions): PanHandler {
  return new PanHandler(options);
}
