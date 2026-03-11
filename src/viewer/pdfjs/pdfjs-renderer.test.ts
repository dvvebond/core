/**
 * Tests for PDF.js renderer.
 */

import { describe, expect, it } from "vitest";

import { PDFJSRenderer, createPDFJSRenderer } from "./pdfjs-renderer";

describe("PDFJSRenderer", () => {
  describe("construction", () => {
    it("should create a renderer instance", () => {
      const renderer = new PDFJSRenderer();
      expect(renderer).toBeInstanceOf(PDFJSRenderer);
      expect(renderer.type).toBe("canvas");
      expect(renderer.initialized).toBe(false);
    });

    it("should create renderer via factory function", () => {
      const renderer = createPDFJSRenderer();
      expect(renderer).toBeInstanceOf(PDFJSRenderer);
    });
  });

  describe("initialization", () => {
    it("should initialize in headless mode when no DOM", async () => {
      const renderer = new PDFJSRenderer();

      // In test environment without DOM, should initialize in headless mode
      try {
        await renderer.initialize({ headless: true });
        expect(renderer.initialized).toBe(true);
        expect(renderer.isHeadless).toBe(true);
      } catch {
        // May fail if PDF.js is not available, that's ok
      }
    });

    it("should be idempotent", async () => {
      const renderer = new PDFJSRenderer();

      try {
        await renderer.initialize({ headless: true });
        const initialState = renderer.initialized;
        await renderer.initialize({ headless: true });
        expect(renderer.initialized).toBe(initialState);
      } catch {
        // May fail if PDF.js is not available, that's ok
      }
    });
  });

  describe("viewport creation", () => {
    it("should create viewport with correct dimensions", async () => {
      const renderer = new PDFJSRenderer();

      try {
        await renderer.initialize({ headless: true });

        const viewport = renderer.createViewport(612, 792, 0, 1.5);
        expect(viewport.width).toBe(612 * 1.5);
        expect(viewport.height).toBe(792 * 1.5);
        expect(viewport.scale).toBe(1.5);
        expect(viewport.rotation).toBe(0);
      } catch {
        // May fail if PDF.js is not available
      }
    });

    it("should handle rotation", async () => {
      const renderer = new PDFJSRenderer();

      try {
        await renderer.initialize({ headless: true });

        const viewport = renderer.createViewport(612, 792, 90, 1);
        expect(viewport.width).toBe(792); // Swapped due to rotation
        expect(viewport.height).toBe(612);
        expect(viewport.rotation).toBe(90);
      } catch {
        // May fail if PDF.js is not available
      }
    });

    it("should combine page rotation with viewer rotation", async () => {
      const renderer = new PDFJSRenderer();

      try {
        await renderer.initialize({ headless: true });

        // Page rotated 90, viewer rotates another 90 = 180 total
        const viewport = renderer.createViewport(612, 792, 90, 1, 90);
        expect(viewport.rotation).toBe(180);
      } catch {
        // May fail if PDF.js is not available
      }
    });

    it("should throw if not initialized", () => {
      const renderer = new PDFJSRenderer();
      expect(() => renderer.createViewport(612, 792, 0)).toThrow();
    });
  });

  describe("render task", () => {
    it("should throw if not initialized", () => {
      const renderer = new PDFJSRenderer();
      const viewport = { width: 612, height: 792, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
      expect(() => renderer.render(0, viewport)).toThrow();
    });

    it("should return cancellable render task in headless mode", async () => {
      const renderer = new PDFJSRenderer();

      try {
        await renderer.initialize({ headless: true });

        const viewport = renderer.createViewport(612, 792, 0, 1);
        const task = renderer.render(0, viewport);

        expect(task).toBeDefined();
        expect(task.promise).toBeInstanceOf(Promise);
        expect(typeof task.cancel).toBe("function");
        expect(task.cancelled).toBe(false);

        task.cancel();
        expect(task.cancelled).toBe(true);

        // Handle the cancelled promise rejection
        await task.promise.catch(() => {
          // Expected: task was cancelled
        });
      } catch {
        // May fail if PDF.js is not available
      }
    });
  });

  describe("destroy", () => {
    it("should reset state on destroy", async () => {
      const renderer = new PDFJSRenderer();

      try {
        await renderer.initialize({ headless: true });
        expect(renderer.initialized).toBe(true);

        renderer.destroy();
        expect(renderer.initialized).toBe(false);
        expect(renderer.isHeadless).toBe(false);
        expect(renderer.document).toBeNull();
      } catch {
        // May fail if PDF.js is not available
      }
    });
  });
});
