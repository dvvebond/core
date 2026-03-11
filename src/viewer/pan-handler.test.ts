import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { PanEvent } from "./interaction-events.ts";
import { PanHandler, createPanHandler } from "./pan-handler.ts";

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

describe("PanHandler", () => {
  let handler: PanHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    rafId = 0;
    rafCallbacks.clear();
    handler = new PanHandler();
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with default values", () => {
      expect(handler.getOffset()).toEqual({ x: 0, y: 0 });
      expect(handler.isPanActive()).toBe(false);
      expect(handler.isMomentumActive()).toBe(false);
    });

    it("should accept custom initial offset", () => {
      const custom = new PanHandler({ initialOffset: { x: 100, y: 200 } });

      expect(custom.getOffset()).toEqual({ x: 100, y: 200 });

      custom.dispose();
    });

    it("should accept custom momentum config", () => {
      const custom = new PanHandler({
        deceleration: 3000,
        minMomentumVelocity: 200,
        maxMomentumDuration: 1000,
      });

      const config = custom.getMomentumConfig();
      expect(config.deceleration).toBe(3000);
      expect(config.minVelocity).toBe(200);
      expect(config.maxDuration).toBe(1000);

      custom.dispose();
    });
  });

  describe("setOffset", () => {
    it("should set offset directly", () => {
      handler.setOffset({ x: 50, y: 100 });

      expect(handler.getOffset()).toEqual({ x: 50, y: 100 });
    });

    it("should create a copy of the offset", () => {
      const offset = { x: 50, y: 100 };
      handler.setOffset(offset);

      offset.x = 999;
      expect(handler.getOffset().x).toBe(50);
    });
  });

  describe("startPan", () => {
    it("should start pan gesture with mouse", () => {
      handler.startPan({ x: 100, y: 100 }, "mouse");

      expect(handler.isPanActive()).toBe(true);
    });

    it("should start pan gesture with touch", () => {
      handler.startPan({ x: 100, y: 100 }, "touch");

      expect(handler.isPanActive()).toBe(true);
    });

    it("should emit pan:start event", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 100, y: 200 }, "mouse");

      expect(events[0]).toMatchObject({
        type: "pan:start",
        position: { x: 100, y: 200 },
        offset: { x: 0, y: 0 },
        source: "mouse",
      });
    });

    it("should stop active momentum when starting new pan", () => {
      handler.startPan({ x: 0, y: 0 }, "touch");
      handler.movePan({ x: 100, y: 100 });
      vi.advanceTimersByTime(50);
      handler.movePan({ x: 200, y: 200 });
      vi.advanceTimersByTime(50);
      handler.endPan({ x: 200, y: 200 });

      // Let momentum start
      vi.advanceTimersByTime(16);
      expect(handler.isMomentumActive()).toBe(true);

      // Start new pan should stop momentum
      handler.startPan({ x: 0, y: 0 }, "touch");
      expect(handler.isMomentumActive()).toBe(false);
    });
  });

  describe("movePan", () => {
    it("should update offset by delta", () => {
      handler.startPan({ x: 100, y: 100 }, "mouse");
      handler.movePan({ x: 150, y: 120 });

      expect(handler.getOffset()).toEqual({ x: 50, y: 20 });
    });

    it("should emit pan:move event", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 100, y: 100 }, "mouse");
      handler.movePan({ x: 150, y: 120 });

      const moveEvent = events.find(e => e.type === "pan:move");
      expect(moveEvent).toMatchObject({
        type: "pan:move",
        position: { x: 150, y: 120 },
        delta: { x: 50, y: 20 },
        offset: { x: 50, y: 20 },
        source: "mouse",
      });
    });

    it("should accumulate multiple moves", () => {
      handler.startPan({ x: 0, y: 0 }, "mouse");
      handler.movePan({ x: 10, y: 10 });
      handler.movePan({ x: 25, y: 30 });
      handler.movePan({ x: 50, y: 60 });

      expect(handler.getOffset()).toEqual({ x: 50, y: 60 });
    });

    it("should do nothing if pan not active", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.movePan({ x: 100, y: 100 });

      expect(listener).not.toHaveBeenCalled();
      expect(handler.getOffset()).toEqual({ x: 0, y: 0 });
    });

    it("should track velocity", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(100);
      handler.movePan({ x: 100, y: 0 });

      const moveEvent = events.find(e => e.type === "pan:move");
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === "pan:move") {
        expect(moveEvent.velocity).toBeDefined();
        // Velocity should be calculated (100px / 0.1s = 1000px/s approximately)
        expect(moveEvent.velocity.x).toBeGreaterThan(0);
      }
    });
  });

  describe("endPan", () => {
    it("should end pan gesture", () => {
      handler.startPan({ x: 100, y: 100 }, "mouse");
      handler.endPan({ x: 150, y: 150 });

      expect(handler.isPanActive()).toBe(false);
    });

    it("should emit pan:end event", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 100, y: 100 }, "mouse");
      handler.endPan({ x: 150, y: 150 });

      const endEvent = events.find(e => e.type === "pan:end");
      expect(endEvent).toMatchObject({
        type: "pan:end",
        position: { x: 150, y: 150 },
        source: "mouse",
      });
    });

    it("should do nothing if pan not active", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.endPan({ x: 100, y: 100 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("cancelPan", () => {
    it("should cancel active pan without momentum", () => {
      handler.startPan({ x: 0, y: 0 }, "mouse");
      handler.movePan({ x: 100, y: 100 });
      handler.cancelPan();

      expect(handler.isPanActive()).toBe(false);
      expect(handler.isMomentumActive()).toBe(false);
    });

    it("should emit pan:end with willMomentum=false", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 500, y: 500 });
      handler.cancelPan();

      const endEvent = events.find(e => e.type === "pan:end");
      expect(endEvent).toMatchObject({
        type: "pan:end",
        willMomentum: false,
      });
    });

    it("should do nothing if pan not active", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.cancelPan();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("momentum", () => {
    it("should trigger momentum when velocity exceeds threshold", () => {
      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 50, y: 0 });
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      handler.endPan({ x: 100, y: 0 });

      // Let animation frame run
      vi.advanceTimersByTime(16);

      expect(handler.isMomentumActive()).toBe(true);
    });

    it("should not trigger momentum when velocity is below threshold", () => {
      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(1000);
      handler.movePan({ x: 10, y: 0 });
      handler.endPan({ x: 10, y: 0 });

      expect(handler.isMomentumActive()).toBe(false);
    });

    it("should not trigger momentum when disabled", () => {
      const noMomentum = new PanHandler({ enableMomentum: false });

      noMomentum.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      noMomentum.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      noMomentum.endPan({ x: 100, y: 0 });

      expect(noMomentum.isMomentumActive()).toBe(false);

      noMomentum.dispose();
    });

    it("should emit pan:momentum events during animation", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 50, y: 0 });
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      handler.endPan({ x: 100, y: 0 });

      // Run several animation frames
      vi.advanceTimersByTime(100);
      vi.runOnlyPendingTimers();

      const momentumEvents = events.filter(e => e.type === "pan:momentum");
      expect(momentumEvents.length).toBeGreaterThan(0);
    });

    it("should emit pan:momentum-end when complete", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 50, y: 0 });
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      handler.endPan({ x: 100, y: 0 });

      // Run long enough for momentum to complete
      vi.advanceTimersByTime(3000);
      vi.runOnlyPendingTimers();

      const endEvent = events.find(e => e.type === "pan:momentum-end");
      expect(endEvent).toBeDefined();
      expect(handler.isMomentumActive()).toBe(false);
    });

    it("should decelerate over time", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 50, y: 0 });
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      handler.endPan({ x: 100, y: 0 });

      vi.advanceTimersByTime(200);
      vi.runOnlyPendingTimers();

      const momentumEvents = events.filter(e => e.type === "pan:momentum") as Array<{
        type: "pan:momentum";
        velocity: { x: number; y: number };
      }>;

      if (momentumEvents.length >= 2) {
        const first = momentumEvents[0];
        const last = momentumEvents[momentumEvents.length - 1];
        const firstSpeed = Math.sqrt(first.velocity.x ** 2 + first.velocity.y ** 2);
        const lastSpeed = Math.sqrt(last.velocity.x ** 2 + last.velocity.y ** 2);
        expect(lastSpeed).toBeLessThan(firstSpeed);
      }
    });
  });

  describe("stopMomentum", () => {
    it("should stop active momentum", () => {
      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 50, y: 0 });
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      handler.endPan({ x: 100, y: 0 });

      vi.advanceTimersByTime(16);
      expect(handler.isMomentumActive()).toBe(true);

      handler.stopMomentum();
      expect(handler.isMomentumActive()).toBe(false);
    });

    it("should emit pan:momentum-end with cancelled=true", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 50, y: 0 });
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });
      vi.advanceTimersByTime(10);
      handler.endPan({ x: 100, y: 0 });

      vi.advanceTimersByTime(16);
      handler.stopMomentum();

      const endEvent = events.find(e => e.type === "pan:momentum-end");
      expect(endEvent).toMatchObject({
        type: "pan:momentum-end",
        cancelled: true,
      });
    });

    it("should do nothing if no momentum active", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.stopMomentum();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("listeners", () => {
    it("should add and call listeners", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.startPan({ x: 0, y: 0 }, "mouse");

      expect(listener).toHaveBeenCalled();
    });

    it("should remove listeners via returned function", () => {
      const listener = vi.fn();
      const remove = handler.addListener(listener);

      remove();
      handler.startPan({ x: 0, y: 0 }, "mouse");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should remove listeners via removeListener", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.removeListener(listener);
      handler.startPan({ x: 0, y: 0 }, "mouse");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should remove all listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      handler.addListener(listener1);
      handler.addListener(listener2);

      handler.removeAllListeners();
      handler.startPan({ x: 0, y: 0 }, "mouse");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should clean up pan, momentum, and listeners", () => {
      const listener = vi.fn();
      handler.addListener(listener);

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(10);
      handler.movePan({ x: 100, y: 0 });

      handler.dispose();

      expect(handler.isPanActive()).toBe(false);
      expect(handler.isMomentumActive()).toBe(false);

      // Listener should have been removed
      listener.mockClear();
      handler.startPan({ x: 0, y: 0 }, "mouse");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("createPanHandler factory", () => {
    it("should create a PanHandler instance", () => {
      const created = createPanHandler({ initialOffset: { x: 50, y: 50 } });

      expect(created).toBeInstanceOf(PanHandler);
      expect(created.getOffset()).toEqual({ x: 50, y: 50 });

      created.dispose();
    });
  });

  describe("touch vs mouse source", () => {
    it("should track mouse source in events", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "mouse");
      handler.movePan({ x: 10, y: 10 });
      handler.endPan({ x: 10, y: 10 });

      for (const event of events) {
        if ("source" in event) {
          expect(event.source).toBe("mouse");
        }
      }
    });

    it("should track touch source in events", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      handler.movePan({ x: 10, y: 10 });
      handler.endPan({ x: 10, y: 10 });

      for (const event of events) {
        if ("source" in event) {
          expect(event.source).toBe("touch");
        }
      }
    });
  });

  describe("velocity calculation", () => {
    it("should calculate velocity from position samples", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      handler.startPan({ x: 0, y: 0 }, "touch");
      vi.advanceTimersByTime(100);
      handler.movePan({ x: 100, y: 50 });

      const moveEvent = events.find(e => e.type === "pan:move");
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === "pan:move") {
        // 100px over 100ms = 1000 px/s
        expect(moveEvent.velocity.x).toBeCloseTo(1000, -1);
        expect(moveEvent.velocity.y).toBeCloseTo(500, -1);
      }
    });

    it("should return zero velocity with insufficient samples", () => {
      const events: PanEvent[] = [];
      handler.addListener(event => events.push(event));

      // End immediately after start - should have zero velocity
      handler.startPan({ x: 0, y: 0 }, "touch");
      handler.endPan({ x: 0, y: 0 });

      const endEvent = events.find(e => e.type === "pan:end");
      expect(endEvent).toBeDefined();
      if (endEvent?.type === "pan:end") {
        expect(endEvent.velocity).toEqual({ x: 0, y: 0 });
      }
    });
  });
});
