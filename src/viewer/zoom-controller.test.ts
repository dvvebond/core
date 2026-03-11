import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { ZoomEvent } from "./interaction-events.ts";
import { easeLinear, easeOutCubic } from "./interaction-events.ts";
import { ZoomController, createZoomController } from "./zoom-controller.ts";

// Mock requestAnimationFrame and cancelAnimationFrame for Node.js environment
let rafId = 0;
const rafCallbacks = new Map<number, (time: number) => void>();

vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
  const id = ++rafId;
  rafCallbacks.set(id, callback);
  // Schedule the callback to run on next timer tick
  setTimeout(() => {
    const cb = rafCallbacks.get(id);
    if (cb) {
      rafCallbacks.delete(id);
      cb(performance.now());
    }
  }, 16);
  return id;
});

vi.stubGlobal("cancelAnimationFrame", (id: number) => {
  rafCallbacks.delete(id);
});

describe("ZoomController", () => {
  let controller: ZoomController;

  beforeEach(() => {
    vi.useFakeTimers();
    rafId = 0;
    rafCallbacks.clear();
    controller = new ZoomController();
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with default values", () => {
      expect(controller.getScale()).toBe(1.0);
      expect(controller.getMinScale()).toBe(0.1);
      expect(controller.getMaxScale()).toBe(10.0);
      expect(controller.isAnimating()).toBe(false);
    });

    it("should accept custom initial values", () => {
      const custom = new ZoomController({
        initialScale: 2.0,
        minScale: 0.5,
        maxScale: 5.0,
      });

      expect(custom.getScale()).toBe(2.0);
      expect(custom.getMinScale()).toBe(0.5);
      expect(custom.getMaxScale()).toBe(5.0);

      custom.dispose();
    });

    it("should clamp initial scale to min/max bounds", () => {
      const belowMin = new ZoomController({
        initialScale: 0.01,
        minScale: 0.5,
        maxScale: 5.0,
      });
      expect(belowMin.getScale()).toBe(0.5);
      belowMin.dispose();

      const aboveMax = new ZoomController({
        initialScale: 20.0,
        minScale: 0.5,
        maxScale: 5.0,
      });
      expect(aboveMax.getScale()).toBe(5.0);
      aboveMax.dispose();
    });
  });

  describe("setScale", () => {
    it("should set scale immediately without animation", () => {
      const result = controller.setScale(2.0);

      expect(result).toBe(true);
      expect(controller.getScale()).toBe(2.0);
      expect(controller.isAnimating()).toBe(false);
    });

    it("should emit zoom events when setting scale", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.setScale(2.0, { x: 100, y: 200 });

      expect(events).toHaveLength(3);
      expect(events[0]).toMatchObject({
        type: "zoom:start",
        scale: 1.0,
        targetScale: 2.0,
        focusPoint: { x: 100, y: 200 },
        animated: false,
      });
      expect(events[1]).toMatchObject({
        type: "zoom:update",
        previousScale: 1.0,
        currentScale: 2.0,
        focusPoint: { x: 100, y: 200 },
      });
      expect(events[2]).toMatchObject({
        type: "zoom:end",
        startScale: 1.0,
        endScale: 2.0,
        focusPoint: { x: 100, y: 200 },
        cancelled: false,
      });
    });

    it("should clamp scale to min/max bounds", () => {
      controller.setScale(0.01);
      expect(controller.getScale()).toBe(0.1);

      controller.setScale(100);
      expect(controller.getScale()).toBe(10.0);
    });

    it("should return false if scale doesn't change", () => {
      const result = controller.setScale(1.0);
      expect(result).toBe(false);
    });

    it("should not emit events if scale doesn't change", () => {
      const listener = vi.fn();
      controller.addListener(listener);

      controller.setScale(1.0);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("zoomTo", () => {
    it("should start animated zoom", () => {
      controller.zoomTo(2.0, { x: 100, y: 100 });

      expect(controller.isAnimating()).toBe(true);
    });

    it("should emit zoom:start event", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.zoomTo(2.0, { x: 100, y: 100 });

      expect(events[0]).toMatchObject({
        type: "zoom:start",
        scale: 1.0,
        targetScale: 2.0,
        focusPoint: { x: 100, y: 100 },
        animated: true,
      });
    });

    it("should emit zoom:update events during animation", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.zoomTo(2.0, { x: 0, y: 0 }, { duration: 100, easing: easeLinear });

      // Advance halfway through animation
      vi.advanceTimersByTime(50);
      vi.runOnlyPendingTimers();

      const updateEvents = events.filter(e => e.type === "zoom:update");
      expect(updateEvents.length).toBeGreaterThan(0);

      const lastUpdate = updateEvents[updateEvents.length - 1];
      if (lastUpdate.type === "zoom:update") {
        expect(lastUpdate.progress).toBeDefined();
      }
    });

    it("should complete animation and emit zoom:end", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.zoomTo(2.0, { x: 0, y: 0 }, { duration: 100, easing: easeLinear });

      // Advance past animation duration
      vi.advanceTimersByTime(200);
      vi.runOnlyPendingTimers();

      const endEvent = events.find(e => e.type === "zoom:end");
      expect(endEvent).toBeDefined();
      expect(endEvent).toMatchObject({
        type: "zoom:end",
        endScale: 2.0,
        cancelled: false,
      });
      expect(controller.isAnimating()).toBe(false);
      expect(controller.getScale()).toBe(2.0);
    });

    it("should not start animation if target equals current scale", () => {
      const listener = vi.fn();
      controller.addListener(listener);

      controller.zoomTo(1.0);

      expect(listener).not.toHaveBeenCalled();
      expect(controller.isAnimating()).toBe(false);
    });

    it("should clamp target scale to min/max", () => {
      controller.zoomTo(100, { x: 0, y: 0 }, { duration: 100 });
      vi.advanceTimersByTime(200);
      vi.runOnlyPendingTimers();

      expect(controller.getScale()).toBe(10.0);
    });

    it("should use custom easing function", () => {
      const customEasing = vi.fn((t: number) => t * t);

      controller.zoomTo(2.0, { x: 0, y: 0 }, { duration: 100, easing: customEasing });
      vi.advanceTimersByTime(50);
      vi.runOnlyPendingTimers();

      expect(customEasing).toHaveBeenCalled();
    });
  });

  describe("zoomIn/zoomOut", () => {
    it("should zoom in by default factor (1.25)", () => {
      controller.zoomIn({ x: 0, y: 0 }, false);

      expect(controller.getScale()).toBe(1.25);
    });

    it("should zoom out by default factor (1.25)", () => {
      controller.setScale(2.0);
      controller.zoomOut({ x: 0, y: 0 }, false);

      expect(controller.getScale()).toBe(2.0 / 1.25);
    });

    it("should animate zoom in when animated=true", () => {
      controller.zoomIn({ x: 0, y: 0 }, true);

      expect(controller.isAnimating()).toBe(true);
    });

    it("should use custom zoom factor", () => {
      const customController = new ZoomController({ zoomFactor: 2.0 });

      customController.zoomIn({ x: 0, y: 0 }, false);
      expect(customController.getScale()).toBe(2.0);

      customController.zoomOut({ x: 0, y: 0 }, false);
      expect(customController.getScale()).toBe(1.0);

      customController.dispose();
    });
  });

  describe("zoomToFit", () => {
    it("should calculate correct scale to fit content", () => {
      // Content 1000x500 into viewport 500x500 should scale to 0.5
      controller.zoomToFit(1000, 500, 500, 500, 0, false);

      expect(controller.getScale()).toBe(0.5);
    });

    it("should respect padding", () => {
      // Content 400x400 into viewport 500x500 with 50 padding
      // Available: 400x400, so scale = 1.0
      controller.zoomToFit(400, 400, 500, 500, 50, false);

      expect(controller.getScale()).toBe(1.0);
    });

    it("should fit height-constrained content", () => {
      // Content 200x1000 into viewport 500x500
      // scaleX = 500/200 = 2.5, scaleY = 500/1000 = 0.5
      // Should use 0.5
      controller.zoomToFit(200, 1000, 500, 500, 0, false);

      expect(controller.getScale()).toBe(0.5);
    });

    it("should animate by default", () => {
      controller.zoomToFit(1000, 500, 500, 500);

      expect(controller.isAnimating()).toBe(true);
    });
  });

  describe("resetZoom", () => {
    it("should reset to scale 1.0", () => {
      controller.setScale(3.0);
      controller.resetZoom(false);

      expect(controller.getScale()).toBe(1.0);
    });

    it("should animate by default", () => {
      controller.setScale(3.0);
      controller.resetZoom();

      expect(controller.isAnimating()).toBe(true);
    });
  });

  describe("cancelAnimation", () => {
    it("should cancel ongoing animation", () => {
      controller.zoomTo(2.0);
      expect(controller.isAnimating()).toBe(true);

      controller.cancelAnimation();
      expect(controller.isAnimating()).toBe(false);
    });

    it("should emit zoom:end with cancelled=true", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.zoomTo(2.0);
      controller.cancelAnimation();

      const endEvent = events.find(e => e.type === "zoom:end");
      expect(endEvent).toMatchObject({
        type: "zoom:end",
        cancelled: true,
      });
    });

    it("should preserve current scale when cancelled", () => {
      controller.zoomTo(2.0, { x: 0, y: 0 }, { duration: 100, easing: easeLinear });
      vi.advanceTimersByTime(50);
      vi.runOnlyPendingTimers();

      const scaleAtCancel = controller.getScale();
      controller.cancelAnimation();

      expect(controller.getScale()).toBe(scaleAtCancel);
    });

    it("should do nothing if no animation is active", () => {
      const listener = vi.fn();
      controller.addListener(listener);

      controller.cancelAnimation();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("focus point preservation", () => {
    it("should include focus point in all events", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      const focusPoint = { x: 250, y: 300 };
      controller.setScale(2.0, focusPoint);

      for (const event of events) {
        expect(event.focusPoint).toEqual(focusPoint);
      }
    });

    it("should use default focus point when not provided", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.setScale(2.0);

      expect(events[0].focusPoint).toEqual({ x: 0, y: 0 });
    });
  });

  describe("listeners", () => {
    it("should add and call listeners", () => {
      const listener = vi.fn();
      controller.addListener(listener);

      controller.setScale(2.0);

      expect(listener).toHaveBeenCalled();
    });

    it("should remove listeners via returned function", () => {
      const listener = vi.fn();
      const remove = controller.addListener(listener);

      remove();
      controller.setScale(2.0);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should remove listeners via removeListener", () => {
      const listener = vi.fn();
      controller.addListener(listener);

      controller.removeListener(listener);
      controller.setScale(2.0);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should remove all listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      controller.addListener(listener1);
      controller.addListener(listener2);

      controller.removeAllListeners();
      controller.setScale(2.0);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should cancel animation and remove listeners", () => {
      const listener = vi.fn();
      controller.addListener(listener);
      controller.zoomTo(2.0);

      // Note: listener will be called during zoomTo (zoom:start) and dispose (zoom:end cancelled)
      const callCountBeforeDispose = listener.mock.calls.length;
      controller.dispose();

      expect(controller.isAnimating()).toBe(false);

      // Clear the mock to only track calls after dispose
      listener.mockClear();
      controller.setScale(3.0);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("createZoomController factory", () => {
    it("should create a ZoomController instance", () => {
      const created = createZoomController({ initialScale: 1.5 });

      expect(created).toBeInstanceOf(ZoomController);
      expect(created.getScale()).toBe(1.5);

      created.dispose();
    });
  });

  describe("easing functions", () => {
    it("easeLinear should return input unchanged", () => {
      expect(easeLinear(0)).toBe(0);
      expect(easeLinear(0.5)).toBe(0.5);
      expect(easeLinear(1)).toBe(1);
    });

    it("easeOutCubic should ease out", () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
      // Ease out should be faster at start
      expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    });
  });

  describe("interrupting animations", () => {
    it("should cancel previous animation when starting new zoom", () => {
      const events: ZoomEvent[] = [];
      controller.addListener(event => events.push(event));

      controller.zoomTo(2.0);
      controller.zoomTo(3.0);

      const endEvents = events.filter(e => e.type === "zoom:end");
      expect(endEvents[0]).toMatchObject({ cancelled: true });
    });

    it("should cancel animation when setting scale directly", () => {
      controller.zoomTo(2.0);
      controller.setScale(1.5);

      expect(controller.isAnimating()).toBe(false);
      expect(controller.getScale()).toBe(1.5);
    });
  });
});
