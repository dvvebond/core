/**
 * Event types and interfaces for zoom and pan interactions.
 * These events are emitted by ZoomController and PanHandler to communicate
 * viewport changes to other viewer components.
 */

/**
 * 2D point in screen coordinates.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 2D velocity vector (pixels per second).
 */
export interface Velocity {
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoom Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event emitted when a zoom animation starts.
 */
export interface ZoomStartEvent {
  type: "zoom:start";
  /** Current scale at start of zoom */
  scale: number;
  /** Target scale to zoom to */
  targetScale: number;
  /** Focus point in screen coordinates (zoom origin) */
  focusPoint: Point;
  /** Whether this is an animated zoom */
  animated: boolean;
}

/**
 * Event emitted during an animated zoom (each frame).
 */
export interface ZoomUpdateEvent {
  type: "zoom:update";
  /** Previous scale value */
  previousScale: number;
  /** Current scale value */
  currentScale: number;
  /** Focus point in screen coordinates */
  focusPoint: Point;
  /** Animation progress (0-1), undefined for instant zooms */
  progress?: number;
}

/**
 * Event emitted when a zoom operation completes.
 */
export interface ZoomEndEvent {
  type: "zoom:end";
  /** Scale before zoom started */
  startScale: number;
  /** Final scale after zoom */
  endScale: number;
  /** Focus point in screen coordinates */
  focusPoint: Point;
  /** Whether the zoom was cancelled or completed */
  cancelled: boolean;
}

/**
 * All zoom event types.
 */
export type ZoomEvent = ZoomStartEvent | ZoomUpdateEvent | ZoomEndEvent;

/**
 * Listener function for zoom events.
 */
export type ZoomEventListener = (event: ZoomEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Pan Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event emitted when a pan gesture starts.
 */
export interface PanStartEvent {
  type: "pan:start";
  /** Starting position of the pan gesture */
  position: Point;
  /** Current pan offset */
  offset: Point;
  /** Source of the pan gesture */
  source: "mouse" | "touch";
}

/**
 * Event emitted during a pan gesture (on move).
 */
export interface PanMoveEvent {
  type: "pan:move";
  /** Current position of the pan gesture */
  position: Point;
  /** Delta from last position */
  delta: Point;
  /** Total pan offset */
  offset: Point;
  /** Current velocity (pixels per second) */
  velocity: Velocity;
  /** Source of the pan gesture */
  source: "mouse" | "touch";
}

/**
 * Event emitted when a pan gesture ends.
 */
export interface PanEndEvent {
  type: "pan:end";
  /** Final position of the pan gesture */
  position: Point;
  /** Final pan offset */
  offset: Point;
  /** Velocity at release (for momentum) */
  velocity: Velocity;
  /** Source of the pan gesture */
  source: "mouse" | "touch";
  /** Whether momentum animation will follow */
  willMomentum: boolean;
}

/**
 * Event emitted during momentum animation.
 */
export interface PanMomentumEvent {
  type: "pan:momentum";
  /** Current position during momentum */
  offset: Point;
  /** Current velocity during deceleration */
  velocity: Velocity;
  /** Progress through momentum (0-1) */
  progress: number;
}

/**
 * Event emitted when momentum animation completes.
 */
export interface PanMomentumEndEvent {
  type: "pan:momentum-end";
  /** Final pan offset after momentum */
  offset: Point;
  /** Whether momentum was cancelled by user interaction */
  cancelled: boolean;
}

/**
 * All pan event types.
 */
export type PanEvent =
  | PanStartEvent
  | PanMoveEvent
  | PanEndEvent
  | PanMomentumEvent
  | PanMomentumEndEvent;

/**
 * Listener function for pan events.
 */
export type PanEventListener = (event: PanEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Combined Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All interaction event types.
 */
export type InteractionEvent = ZoomEvent | PanEvent;

/**
 * Listener function for any interaction event.
 */
export type InteractionEventListener = (event: InteractionEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Easing function signature.
 * @param t Progress value from 0 to 1
 * @returns Eased value from 0 to 1
 */
export type EasingFunction = (t: number) => number;

/**
 * Configuration options for zoom animations.
 */
export interface ZoomAnimationConfig {
  /** Animation duration in milliseconds (default: 300) */
  duration: number;
  /** Easing function for the animation */
  easing: EasingFunction;
}

/**
 * Configuration options for pan momentum.
 */
export interface PanMomentumConfig {
  /** Deceleration rate in pixels per second squared (default: 2500) */
  deceleration: number;
  /** Minimum velocity threshold to start momentum (default: 100) */
  minVelocity: number;
  /** Maximum momentum duration in milliseconds (default: 2000) */
  maxDuration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Easing Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linear easing (no easing).
 */
export const easeLinear: EasingFunction = t => t;

/**
 * Ease out cubic - decelerating to zero velocity.
 */
export const easeOutCubic: EasingFunction = t => 1 - (1 - t) ** 3;

/**
 * Ease out quart - stronger deceleration.
 */
export const easeOutQuart: EasingFunction = t => 1 - (1 - t) ** 4;

/**
 * Ease in out cubic - smooth acceleration and deceleration.
 */
export const easeInOutCubic: EasingFunction = t =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * Ease out expo - exponential deceleration.
 */
export const easeOutExpo: EasingFunction = t => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
