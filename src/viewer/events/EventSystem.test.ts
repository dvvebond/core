import { describe, it, expect, vi, beforeEach } from "vitest";

import { PageController } from "./controllers/PageController.ts";
import { PDFController } from "./controllers/PDFController.ts";
import { ScaleController } from "./controllers/ScaleController.ts";
import { EventSystem } from "./EventSystem.ts";
import { createViewerEventContext } from "./index.ts";
import { EventType } from "./types.ts";
import type { PDFReadyPayload, ScaleChangedPayload, PageRenderedPayload } from "./types.ts";

describe("EventSystem", () => {
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
  });

  describe("subscribe and emit", () => {
    it("should call listener when event is emitted", () => {
      const listener = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, listener);

      const payload: PDFReadyPayload = { pageCount: 10, title: "Test PDF" };
      eventSystem.emit(EventType.PDFReady, payload);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(payload);
    });

    it("should call multiple listeners for same event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, listener1);
      eventSystem.subscribe(EventType.PDFReady, listener2);

      const payload: PDFReadyPayload = { pageCount: 5 };
      eventSystem.emit(EventType.PDFReady, payload);

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it("should not call listeners for different event types", () => {
      const pdfListener = vi.fn();
      const scaleListener = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, pdfListener);
      eventSystem.subscribe(EventType.ScaleChanged, scaleListener);

      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });

      expect(pdfListener).toHaveBeenCalledOnce();
      expect(scaleListener).not.toHaveBeenCalled();
    });

    it("should handle emit with no listeners", () => {
      expect(() => {
        eventSystem.emit(EventType.PDFReady, { pageCount: 10 });
      }).not.toThrow();
    });
  });

  describe("unsubscribe", () => {
    it("should remove listener via returned subscription", () => {
      const listener = vi.fn();
      const subscription = eventSystem.subscribe(EventType.PDFReady, listener);

      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });
      expect(listener).toHaveBeenCalledOnce();

      subscription.unsubscribe();
      eventSystem.emit(EventType.PDFReady, { pageCount: 20 });
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should remove listener via unsubscribe method", () => {
      const listener = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, listener);

      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });
      expect(listener).toHaveBeenCalledOnce();

      eventSystem.unsubscribe(EventType.PDFReady, listener);
      eventSystem.emit(EventType.PDFReady, { pageCount: 20 });
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should handle unsubscribe for non-existent listener", () => {
      const listener = vi.fn();
      expect(() => {
        eventSystem.unsubscribe(EventType.PDFReady, listener);
      }).not.toThrow();
    });
  });

  describe("once", () => {
    it("should call listener only once", () => {
      const listener = vi.fn();
      eventSystem.once(EventType.PDFReady, listener);

      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });
      eventSystem.emit(EventType.PDFReady, { pageCount: 20 });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({ pageCount: 10 });
    });

    it("should allow unsubscribe before event fires", () => {
      const listener = vi.fn();
      const subscription = eventSystem.once(EventType.PDFReady, listener);

      subscription.unsubscribe();
      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should remove all listeners for specific event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, listener1);
      eventSystem.subscribe(EventType.PDFReady, listener2);

      eventSystem.clear(EventType.PDFReady);
      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("should not affect other event types", () => {
      const pdfListener = vi.fn();
      const scaleListener = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, pdfListener);
      eventSystem.subscribe(EventType.ScaleChanged, scaleListener);

      eventSystem.clear(EventType.PDFReady);
      eventSystem.emit(EventType.ScaleChanged, {
        previousScale: 1,
        currentScale: 2,
      });

      expect(scaleListener).toHaveBeenCalledOnce();
    });
  });

  describe("clearAll", () => {
    it("should remove all listeners for all events", () => {
      const pdfListener = vi.fn();
      const scaleListener = vi.fn();
      eventSystem.subscribe(EventType.PDFReady, pdfListener);
      eventSystem.subscribe(EventType.ScaleChanged, scaleListener);

      eventSystem.clearAll();

      eventSystem.emit(EventType.PDFReady, { pageCount: 10 });
      eventSystem.emit(EventType.ScaleChanged, {
        previousScale: 1,
        currentScale: 2,
      });

      expect(pdfListener).not.toHaveBeenCalled();
      expect(scaleListener).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    it("should return correct count", () => {
      expect(eventSystem.listenerCount(EventType.PDFReady)).toBe(0);

      eventSystem.subscribe(EventType.PDFReady, vi.fn());
      expect(eventSystem.listenerCount(EventType.PDFReady)).toBe(1);

      eventSystem.subscribe(EventType.PDFReady, vi.fn());
      expect(eventSystem.listenerCount(EventType.PDFReady)).toBe(2);
    });

    it("should decrease after unsubscribe", () => {
      const listener = vi.fn();
      const subscription = eventSystem.subscribe(EventType.PDFReady, listener);

      expect(eventSystem.listenerCount(EventType.PDFReady)).toBe(1);
      subscription.unsubscribe();
      expect(eventSystem.listenerCount(EventType.PDFReady)).toBe(0);
    });
  });

  describe("typed event payloads", () => {
    it("should enforce PDFReadyPayload type", () => {
      const listener = vi.fn<[PDFReadyPayload], void>();
      eventSystem.subscribe(EventType.PDFReady, listener);

      const payload: PDFReadyPayload = {
        pageCount: 100,
        title: "My Document",
        author: "Test Author",
      };
      eventSystem.emit(EventType.PDFReady, payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    it("should enforce ScaleChangedPayload type", () => {
      const listener = vi.fn<[ScaleChangedPayload], void>();
      eventSystem.subscribe(EventType.ScaleChanged, listener);

      const payload: ScaleChangedPayload = {
        previousScale: 1.0,
        currentScale: 1.5,
        origin: { x: 100, y: 200 },
      };
      eventSystem.emit(EventType.ScaleChanged, payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    it("should enforce PageRenderedPayload type", () => {
      const listener = vi.fn<[PageRenderedPayload], void>();
      eventSystem.subscribe(EventType.PageRendered, listener);

      const payload: PageRenderedPayload = {
        pageNumber: 1,
        renderTime: 50,
        isRerender: false,
      };
      eventSystem.emit(EventType.PageRendered, payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });
  });
});

describe("PDFController", () => {
  let eventSystem: EventSystem;
  let controller: PDFController;

  beforeEach(() => {
    eventSystem = new EventSystem();
    controller = new PDFController(eventSystem);
  });

  it("should emit PDFReady event when document is loaded", () => {
    const listener = vi.fn();
    eventSystem.subscribe(EventType.PDFReady, listener);

    controller.documentLoaded({ pageCount: 50, title: "Test" });

    expect(listener).toHaveBeenCalledWith({ pageCount: 50, title: "Test" });
  });

  it("should track ready state", () => {
    expect(controller.getIsReady()).toBe(false);

    controller.documentLoaded({ pageCount: 10 });

    expect(controller.getIsReady()).toBe(true);
  });

  it("should store document info", () => {
    expect(controller.getDocumentInfo()).toBeNull();

    const info = { pageCount: 25, title: "Doc", author: "Me" };
    controller.documentLoaded(info);

    expect(controller.getDocumentInfo()).toEqual(info);
  });

  it("should reset state", () => {
    controller.documentLoaded({ pageCount: 10 });
    controller.reset();

    expect(controller.getIsReady()).toBe(false);
    expect(controller.getDocumentInfo()).toBeNull();
  });

  it("should call onReady listener immediately if already ready", () => {
    controller.documentLoaded({ pageCount: 10 });

    const listener = vi.fn();
    controller.onReady(listener);

    expect(listener).toHaveBeenCalledWith({ pageCount: 10 });
  });

  it("should call onReady listener when document loads later", () => {
    const listener = vi.fn();
    controller.onReady(listener);

    expect(listener).not.toHaveBeenCalled();

    controller.documentLoaded({ pageCount: 10 });

    expect(listener).toHaveBeenCalledWith({ pageCount: 10 });
  });
});

describe("ScaleController", () => {
  let eventSystem: EventSystem;
  let controller: ScaleController;

  beforeEach(() => {
    eventSystem = new EventSystem();
    controller = new ScaleController(eventSystem, 1.0, 0.5, 3.0);
  });

  it("should emit ScaleChanged event when scale changes", () => {
    const listener = vi.fn();
    eventSystem.subscribe(EventType.ScaleChanged, listener);

    controller.setScale(2.0);

    expect(listener).toHaveBeenCalledWith({
      previousScale: 1.0,
      currentScale: 2.0,
      origin: undefined,
    });
  });

  it("should not emit when scale stays the same", () => {
    const listener = vi.fn();
    eventSystem.subscribe(EventType.ScaleChanged, listener);

    const result = controller.setScale(1.0);

    expect(result).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("should clamp scale to min/max", () => {
    controller.setScale(0.1);
    expect(controller.getScale()).toBe(0.5);

    controller.setScale(10.0);
    expect(controller.getScale()).toBe(3.0);
  });

  it("should zoom in by factor", () => {
    controller.zoomIn(2.0);
    expect(controller.getScale()).toBe(2.0);
  });

  it("should zoom out by factor", () => {
    controller.setScale(2.0);
    controller.zoomOut(2.0);
    expect(controller.getScale()).toBe(1.0);
  });

  it("should reset to 1.0", () => {
    controller.setScale(2.5);
    controller.resetScale();
    expect(controller.getScale()).toBe(1.0);
  });

  it("should include origin in event", () => {
    const listener = vi.fn();
    eventSystem.subscribe(EventType.ScaleChanged, listener);

    controller.setScale(2.0, { x: 50, y: 100 });

    expect(listener).toHaveBeenCalledWith({
      previousScale: 1.0,
      currentScale: 2.0,
      origin: { x: 50, y: 100 },
    });
  });

  it("should provide onScaleChanged subscription", () => {
    const listener = vi.fn();
    controller.onScaleChanged(listener);

    controller.setScale(1.5);

    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("PageController", () => {
  let eventSystem: EventSystem;
  let controller: PageController;

  beforeEach(() => {
    eventSystem = new EventSystem();
    controller = new PageController(eventSystem);
  });

  it("should emit PageRendered event", () => {
    const listener = vi.fn();
    eventSystem.subscribe(EventType.PageRendered, listener);

    controller.pageRendered(1, 100);

    expect(listener).toHaveBeenCalledWith({
      pageNumber: 1,
      renderTime: 100,
      isRerender: false,
    });
  });

  it("should track re-renders", () => {
    const listener = vi.fn();
    eventSystem.subscribe(EventType.PageRendered, listener);

    controller.pageRendered(1, 100);
    controller.pageRendered(1, 50);

    expect(listener).toHaveBeenLastCalledWith({
      pageNumber: 1,
      renderTime: 50,
      isRerender: true,
    });
  });

  it("should track rendered pages", () => {
    expect(controller.isPageRendered(1)).toBe(false);

    controller.pageRendered(1, 100);
    controller.pageRendered(3, 150);

    expect(controller.isPageRendered(1)).toBe(true);
    expect(controller.isPageRendered(2)).toBe(false);
    expect(controller.isPageRendered(3)).toBe(true);
  });

  it("should provide page stats", () => {
    controller.pageRendered(1, 100);
    controller.pageRendered(1, 50);

    const stats = controller.getPageStats(1);
    expect(stats).toEqual({ renderTime: 50, renderCount: 2 });
  });

  it("should return rendered page numbers", () => {
    controller.pageRendered(1, 100);
    controller.pageRendered(5, 100);
    controller.pageRendered(3, 100);

    expect(controller.getRenderedPages()).toEqual([1, 5, 3]);
  });

  it("should invalidate single page", () => {
    controller.pageRendered(1, 100);
    controller.pageRendered(2, 100);

    controller.invalidatePage(1);

    expect(controller.isPageRendered(1)).toBe(false);
    expect(controller.isPageRendered(2)).toBe(true);
  });

  it("should invalidate all pages", () => {
    controller.pageRendered(1, 100);
    controller.pageRendered(2, 100);

    controller.invalidateAll();

    expect(controller.getRenderedPages()).toEqual([]);
  });

  it("should filter events for specific page", () => {
    const listener = vi.fn();
    controller.onSpecificPageRendered(2, listener);

    controller.pageRendered(1, 100);
    controller.pageRendered(2, 100);
    controller.pageRendered(3, 100);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      pageNumber: 2,
      renderTime: 100,
      isRerender: false,
    });
  });
});

describe("createViewerEventContext", () => {
  it("should create all controllers with shared event system", () => {
    const context = createViewerEventContext();

    expect(context.eventSystem).toBeInstanceOf(EventSystem);
    expect(context.pdfController).toBeInstanceOf(PDFController);
    expect(context.scaleController).toBeInstanceOf(ScaleController);
    expect(context.pageController).toBeInstanceOf(PageController);
  });

  it("should apply options to scale controller", () => {
    const context = createViewerEventContext({
      initialScale: 2.0,
      minScale: 0.5,
      maxScale: 5.0,
    });

    expect(context.scaleController.getScale()).toBe(2.0);
    expect(context.scaleController.getMinScale()).toBe(0.5);
    expect(context.scaleController.getMaxScale()).toBe(5.0);
  });

  it("should share event system across controllers", () => {
    const context = createViewerEventContext();
    const listener = vi.fn();

    context.eventSystem.subscribe(EventType.PDFReady, listener);
    context.pdfController.documentLoaded({ pageCount: 10 });

    expect(listener).toHaveBeenCalledOnce();
  });
});
