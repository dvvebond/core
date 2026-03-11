/**
 * Viewer-level tests for SVGRenderer.
 *
 * These tests focus on SVGRenderer integration with viewer components,
 * including SVG-specific features like serialization, DOM structure,
 * and viewer-context rendering scenarios.
 */

import { Op, Operator } from "#src/content/operators";
import { PdfString } from "#src/objects/pdf-string";
import {
  SVGRenderer,
  createSVGRenderer,
  LineCap,
  LineJoin,
  TextRenderMode,
} from "#src/renderers/svg-renderer";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

// Standard page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

describe("SVGRenderer viewer integration", () => {
  let renderer: SVGRenderer;

  beforeEach(async () => {
    renderer = new SVGRenderer();
    await renderer.initialize({ headless: true });
  });

  afterEach(() => {
    renderer.destroy();
  });

  describe("multi-page rendering", () => {
    it("renders multiple pages with different dimensions", async () => {
      const pages = [
        { width: LETTER_WIDTH, height: LETTER_HEIGHT, rotation: 0 },
        { width: A4_WIDTH, height: A4_HEIGHT, rotation: 0 },
        { width: LETTER_WIDTH, height: LETTER_HEIGHT, rotation: 90 },
      ];

      const results = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const viewport = renderer.createViewport(page.width, page.height, page.rotation);
        const task = renderer.render(i, viewport);
        results.push(await task.promise);
      }

      expect(results).toHaveLength(3);
      expect(results[0].width).toBe(LETTER_WIDTH);
      expect(results[0].height).toBe(LETTER_HEIGHT);
      expect(results[1].width).toBe(A4_WIDTH);
      expect(results[1].height).toBe(A4_HEIGHT);
      expect(results[2].width).toBe(LETTER_HEIGHT); // Rotated
      expect(results[2].height).toBe(LETTER_WIDTH);
    });

    it("handles concurrent render requests for different pages", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);

      const tasks = [
        renderer.render(0, viewport),
        renderer.render(1, viewport),
        renderer.render(2, viewport),
      ];

      const results = await Promise.all(tasks.map(t => t.promise));

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.width).toBe(LETTER_WIDTH);
        expect(result.height).toBe(LETTER_HEIGHT);
      });
    });

    it("cancels pending render when page changes rapidly", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);

      const task1 = renderer.render(0, viewport);
      const task2 = renderer.render(1, viewport);
      const task3 = renderer.render(2, viewport);

      // Cancel earlier renders
      task1.cancel();
      task2.cancel();

      expect(task1.cancelled).toBe(true);
      expect(task2.cancelled).toBe(true);
      expect(task3.cancelled).toBe(false);

      // Handle the cancelled task rejections to avoid unhandled rejection errors
      task1.promise.catch(() => {});
      task2.promise.catch(() => {});

      const result = await task3.promise;
      expect(result.width).toBe(LETTER_WIDTH);
    });
  });

  describe("zoom level rendering", () => {
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

    for (const zoom of zoomLevels) {
      it(`renders correctly at ${zoom * 100}% zoom`, async () => {
        const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, zoom);

        expect(viewport.width).toBe(Math.round(LETTER_WIDTH * zoom));
        expect(viewport.height).toBe(Math.round(LETTER_HEIGHT * zoom));
        expect(viewport.scale).toBe(zoom);

        const task = renderer.render(0, viewport);
        const result = await task.promise;

        expect(result.width).toBe(Math.round(LETTER_WIDTH * zoom));
        expect(result.height).toBe(Math.round(LETTER_HEIGHT * zoom));
      });
    }

    it("maintains graphics state precision at high zoom", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 4);

      renderer.setLineWidth(0.5);
      renderer.setStrokingRGB(0.1, 0.2, 0.3);

      expect(renderer.graphicsState.lineWidth).toBe(0.5);
    });
  });

  describe("rotation rendering", () => {
    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

    for (const rotation of rotations) {
      it(`renders page with ${rotation}° rotation`, async () => {
        const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, rotation);

        if (rotation === 90 || rotation === 270) {
          expect(viewport.width).toBe(LETTER_HEIGHT);
          expect(viewport.height).toBe(LETTER_WIDTH);
        } else {
          expect(viewport.width).toBe(LETTER_WIDTH);
          expect(viewport.height).toBe(LETTER_HEIGHT);
        }

        const task = renderer.render(0, viewport);
        const result = await task.promise;

        expect(result.width).toBe(viewport.width);
        expect(result.height).toBe(viewport.height);
      });
    }

    it("combines rotation with zoom", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 90, 2);

      expect(viewport.width).toBe(LETTER_HEIGHT * 2);
      expect(viewport.height).toBe(LETTER_WIDTH * 2);
      expect(viewport.rotation).toBe(90);
      expect(viewport.scale).toBe(2);
    });
  });

  describe("coordinate transformation integration", () => {
    it("transforms click coordinates to PDF space", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      // Screen click at (200, 100) at 2x zoom
      const screenPoint = { x: 200, y: 100 };
      const pdfPoint = renderer.screenToPdf(screenPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      // At 2x zoom, screen coordinates should be halved in PDF space
      expect(pdfPoint.x).toBeCloseTo(100, 1);
    });

    it("transforms PDF coordinates to screen space for overlay", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 1.5);

      // PDF point near top-left
      const pdfPoint = { x: 100, y: LETTER_HEIGHT - 100 };
      const screenPoint = renderer.pdfToScreen(pdfPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      // At 1.5x zoom, coordinates should be scaled
      expect(screenPoint.x).toBeCloseTo(150, 1);
    });

    it("transforms selection rectangle from screen to PDF", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      const screenRect = { x: 100, y: 50, width: 200, height: 100 };
      const pdfRect = renderer.screenRectToPdf(screenRect, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      expect(pdfRect.width).toBeCloseTo(100, 1); // Half at 2x zoom
      expect(pdfRect.height).toBeCloseTo(50, 1);
    });

    it("handles coordinate transformation with rotation", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 90);

      const pdfPoint = { x: 100, y: 700 };
      const screenPoint = renderer.pdfToScreen(pdfPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);
      const roundTrip = renderer.screenToPdf(screenPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      expect(roundTrip.x).toBeCloseTo(pdfPoint.x, 1);
      expect(roundTrip.y).toBeCloseTo(pdfPoint.y, 1);
    });
  });

  describe("SVG-specific features", () => {
    it("returns null SVG element in headless mode", () => {
      expect(renderer.getSVG()).toBeNull();
    });

    it("throws when serializing in headless mode", () => {
      expect(() => renderer.serialize()).toThrow("Cannot serialize in headless mode");
    });

    it("identifies as SVG renderer type", () => {
      expect(renderer.type).toBe("svg");
    });

    it("begins path explicitly", () => {
      renderer.beginPath();
      renderer.moveTo(0, 0);
      renderer.lineTo(100, 100);
      renderer.stroke();
      // No errors indicates successful SVG path construction
    });
  });

  describe("graphics state in viewer context", () => {
    it("isolates graphics state between page renders", async () => {
      // Set up custom state within a push/pop pair
      renderer.pushGraphicsState();
      renderer.setLineWidth(5);
      renderer.setStrokingRGB(1, 0, 0);

      // Verify custom state is applied
      expect(renderer.graphicsState.lineWidth).toBe(5);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");

      // Pop state back to verify isolation
      renderer.popGraphicsState();

      expect(renderer.graphicsState.lineWidth).toBe(1);
      // Default stroke color may be in different formats
      expect(["rgb(0, 0, 0)", "#000000"]).toContain(renderer.graphicsState.strokeColor);
    });

    it("handles deeply nested graphics states", () => {
      const depths = 10;

      for (let i = 0; i < depths; i++) {
        renderer.pushGraphicsState();
        renderer.setLineWidth(i + 1);
      }

      expect(renderer.stateStackDepth).toBe(depths);
      expect(renderer.graphicsState.lineWidth).toBe(depths);

      for (let i = depths; i > 0; i--) {
        renderer.popGraphicsState();
        if (i > 1) {
          expect(renderer.graphicsState.lineWidth).toBe(i - 1);
        }
      }

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("resets graphics state for new page", () => {
      renderer.setLineWidth(5);
      renderer.setStrokingRGB(1, 0, 0);
      renderer.pushGraphicsState();

      renderer.resetGraphicsState();

      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });
  });

  describe("text rendering in viewer", () => {
    it("renders text at various positions", () => {
      renderer.executeOperators([
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, "/Helvetica", 12),
        Operator.of(Op.MoveText, 72, 720),
        Operator.of(Op.ShowText, PdfString.fromString("Page Header")),
        Operator.of(Op.MoveText, 0, -648),
        Operator.of(Op.ShowText, PdfString.fromString("Page Footer")),
        Operator.of(Op.EndText),
      ]);

      expect(renderer.inTextObject).toBe(false);
    });

    it("handles text with different render modes", () => {
      const modes = [
        TextRenderMode.Fill,
        TextRenderMode.Stroke,
        TextRenderMode.FillStroke,
        TextRenderMode.Invisible,
      ];

      for (const mode of modes) {
        renderer.beginText();
        renderer.setTextRenderMode(mode);
        expect(renderer.graphicsState.textRenderMode).toBe(mode);
        renderer.endText();
      }
    });

    it("preserves text state through graphics state operations", () => {
      renderer.setLeading(14);
      renderer.setCharSpacing(0.5);

      renderer.pushGraphicsState();
      renderer.setLeading(20);
      renderer.setCharSpacing(1);

      expect(renderer.graphicsState.leading).toBe(20);
      expect(renderer.graphicsState.charSpacing).toBe(1);

      renderer.popGraphicsState();

      expect(renderer.graphicsState.leading).toBe(14);
      expect(renderer.graphicsState.charSpacing).toBe(0.5);
    });
  });

  describe("path rendering in viewer", () => {
    it("renders complex paths", () => {
      // Draw a house shape
      renderer.executeOperators([
        Operator.of(Op.PushGraphicsState),
        Operator.of(Op.SetLineWidth, 2),
        Operator.of(Op.SetStrokingRGB, 0, 0, 0),

        // House body
        Operator.of(Op.MoveTo, 100, 100),
        Operator.of(Op.LineTo, 200, 100),
        Operator.of(Op.LineTo, 200, 180),
        Operator.of(Op.LineTo, 100, 180),
        Operator.of(Op.ClosePath),

        // Roof
        Operator.of(Op.MoveTo, 90, 180),
        Operator.of(Op.LineTo, 150, 230),
        Operator.of(Op.LineTo, 210, 180),
        Operator.of(Op.ClosePath),

        Operator.of(Op.Stroke),
        Operator.of(Op.PopGraphicsState),
      ]);

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("renders filled and stroked shapes", () => {
      renderer.setNonStrokingRGB(0.8, 0.8, 0.8);
      renderer.setStrokingRGB(0, 0, 0);
      renderer.setLineWidth(1);

      renderer.rectangle(100, 100, 200, 150);
      renderer.fillAndStroke();

      expect(renderer.graphicsState.fillColor).toBe("rgb(204, 204, 204)");
      expect(renderer.graphicsState.strokeColor).toBe("rgb(0, 0, 0)");
    });

    it("handles bezier curves", () => {
      renderer.moveTo(100, 100);
      renderer.curveTo(150, 200, 200, 200, 250, 100);
      renderer.stroke();
    });

    it("handles close and stroke operation", () => {
      renderer.moveTo(0, 0);
      renderer.lineTo(100, 0);
      renderer.lineTo(50, 50);
      renderer.closeAndStroke();
    });
  });

  describe("clipping in viewer context", () => {
    it("establishes clipping region", () => {
      renderer.pushGraphicsState();

      // Set up a clipping rectangle
      renderer.rectangle(100, 100, 400, 600);
      renderer.clip();

      // Content here would be clipped to the rectangle
      renderer.rectangle(0, 0, 612, 792);
      renderer.fill();

      renderer.popGraphicsState();
    });

    it("handles even-odd clipping", () => {
      renderer.pushGraphicsState();
      renderer.rectangle(100, 100, 400, 600);
      renderer.clipEvenOdd();

      renderer.rectangle(0, 0, 612, 792);
      renderer.fill();

      renderer.popGraphicsState();
    });

    it("handles nested clipping regions", () => {
      renderer.pushGraphicsState();
      renderer.rectangle(100, 100, 400, 600);
      renderer.clip();

      renderer.pushGraphicsState();
      renderer.rectangle(150, 150, 300, 500);
      renderer.clip();

      renderer.rectangle(0, 0, 612, 792);
      renderer.fill();

      renderer.popGraphicsState();
      renderer.popGraphicsState();

      expect(renderer.stateStackDepth).toBe(0);
    });
  });

  describe("path painting operations", () => {
    it("strokes path", () => {
      renderer.moveTo(0, 0);
      renderer.lineTo(100, 100);
      renderer.stroke();
    });

    it("fills path", () => {
      renderer.rectangle(10, 20, 100, 50);
      renderer.fill();
    });

    it("fills with even-odd rule", () => {
      renderer.rectangle(10, 20, 100, 50);
      renderer.fillEvenOdd();
    });

    it("fills and strokes path", () => {
      renderer.rectangle(10, 20, 100, 50);
      renderer.fillAndStroke();
    });
  });

  describe("color space handling", () => {
    it("handles grayscale colors", () => {
      const grayLevels = [0, 0.25, 0.5, 0.75, 1];

      for (const gray of grayLevels) {
        renderer.setStrokingGray(gray);
        renderer.setNonStrokingGray(gray);

        const expected = `rgb(${Math.round(gray * 255)}, ${Math.round(gray * 255)}, ${Math.round(gray * 255)})`;
        expect(renderer.graphicsState.strokeColor).toBe(expected);
        expect(renderer.graphicsState.fillColor).toBe(expected);
      }
    });

    it("handles RGB colors", () => {
      renderer.setStrokingRGB(1, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");

      renderer.setNonStrokingRGB(0, 1, 0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(0, 255, 0)");
    });

    it("handles CMYK colors", () => {
      // Pure cyan
      renderer.setStrokingCMYK(1, 0, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(0, 255, 255)");

      // Pure magenta
      renderer.setNonStrokingCMYK(0, 1, 0, 0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(255, 0, 255)");
    });

    it("handles alpha values", () => {
      renderer.setStrokingAlpha(0.5);
      renderer.setNonStrokingAlpha(0.75);

      expect(renderer.graphicsState.strokeAlpha).toBe(0.5);
      expect(renderer.graphicsState.fillAlpha).toBe(0.75);
    });
  });

  describe("line style handling", () => {
    it("handles all line cap styles", () => {
      renderer.setLineCap(LineCap.Butt);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Butt);

      renderer.setLineCap(LineCap.Round);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Round);

      renderer.setLineCap(LineCap.Square);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Square);
    });

    it("handles all line join styles", () => {
      renderer.setLineJoin(LineJoin.Miter);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Miter);

      renderer.setLineJoin(LineJoin.Round);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Round);

      renderer.setLineJoin(LineJoin.Bevel);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Bevel);
    });

    it("handles dash patterns", () => {
      // Solid line (no dash)
      renderer.setDashPattern([], 0);
      expect(renderer.graphicsState.dashPattern.array).toEqual([]);

      // Dash-dot pattern
      renderer.setDashPattern([4, 2, 1, 2], 0);
      expect(renderer.graphicsState.dashPattern.array).toEqual([4, 2, 1, 2]);

      // Dash with phase offset
      renderer.setDashPattern([5, 3], 2);
      expect(renderer.graphicsState.dashPattern.phase).toBe(2);
    });
  });

  describe("factory function", () => {
    it("creates renderer via factory function", async () => {
      const factoryRenderer = createSVGRenderer({ headless: true });
      await factoryRenderer.initialize({ headless: true });

      expect(factoryRenderer).toBeInstanceOf(SVGRenderer);
      expect(factoryRenderer.type).toBe("svg");
      expect(factoryRenderer.initialized).toBe(true);

      factoryRenderer.destroy();
    });
  });

  describe("error handling", () => {
    it("throws when creating viewport before initialization", () => {
      const uninitRenderer = new SVGRenderer();

      expect(() => uninitRenderer.createViewport(612, 792, 0)).toThrow(
        "Renderer must be initialized",
      );
    });

    it("handles pop on empty state stack gracefully", () => {
      expect(renderer.stateStackDepth).toBe(0);
      renderer.popGraphicsState();
      expect(renderer.stateStackDepth).toBe(0);
    });

    it("handles end text without begin text", () => {
      expect(renderer.inTextObject).toBe(false);
      renderer.endText();
      expect(renderer.inTextObject).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("properly destroys renderer", () => {
      renderer.pushGraphicsState();
      renderer.setLineWidth(5);

      renderer.destroy();

      expect(renderer.initialized).toBe(false);
    });

    it("can be reinitialized after destruction", async () => {
      renderer.destroy();
      expect(renderer.initialized).toBe(false);

      await renderer.initialize({ headless: true });
      expect(renderer.initialized).toBe(true);
    });
  });
});

describe("SVGRenderer vs CanvasRenderer parity", () => {
  let svgRenderer: SVGRenderer;

  beforeEach(async () => {
    svgRenderer = new SVGRenderer();
    await svgRenderer.initialize({ headless: true });
  });

  afterEach(() => {
    svgRenderer.destroy();
  });

  it("has the same interface as CanvasRenderer", () => {
    // Check all required methods exist
    expect(typeof svgRenderer.initialize).toBe("function");
    expect(typeof svgRenderer.createViewport).toBe("function");
    expect(typeof svgRenderer.render).toBe("function");
    expect(typeof svgRenderer.destroy).toBe("function");

    // Graphics state methods
    expect(typeof svgRenderer.pushGraphicsState).toBe("function");
    expect(typeof svgRenderer.popGraphicsState).toBe("function");
    expect(typeof svgRenderer.resetGraphicsState).toBe("function");

    // Line property methods
    expect(typeof svgRenderer.setLineWidth).toBe("function");
    expect(typeof svgRenderer.setLineCap).toBe("function");
    expect(typeof svgRenderer.setLineJoin).toBe("function");
    expect(typeof svgRenderer.setMiterLimit).toBe("function");
    expect(typeof svgRenderer.setDashPattern).toBe("function");

    // Color methods
    expect(typeof svgRenderer.setStrokingGray).toBe("function");
    expect(typeof svgRenderer.setNonStrokingGray).toBe("function");
    expect(typeof svgRenderer.setStrokingRGB).toBe("function");
    expect(typeof svgRenderer.setNonStrokingRGB).toBe("function");
    expect(typeof svgRenderer.setStrokingCMYK).toBe("function");
    expect(typeof svgRenderer.setNonStrokingCMYK).toBe("function");

    // Text methods
    expect(typeof svgRenderer.setFont).toBe("function");
    expect(typeof svgRenderer.setCharSpacing).toBe("function");
    expect(typeof svgRenderer.setWordSpacing).toBe("function");
    expect(typeof svgRenderer.beginText).toBe("function");
    expect(typeof svgRenderer.endText).toBe("function");
    expect(typeof svgRenderer.showText).toBe("function");

    // Path methods
    expect(typeof svgRenderer.moveTo).toBe("function");
    expect(typeof svgRenderer.lineTo).toBe("function");
    expect(typeof svgRenderer.curveTo).toBe("function");
    expect(typeof svgRenderer.closePath).toBe("function");
    expect(typeof svgRenderer.stroke).toBe("function");
    expect(typeof svgRenderer.fill).toBe("function");

    // Operator execution
    expect(typeof svgRenderer.executeOperator).toBe("function");
    expect(typeof svgRenderer.executeOperators).toBe("function");
  });

  it("produces same graphics state results as CanvasRenderer would", () => {
    // Test that graphics state management works identically
    svgRenderer.setLineWidth(2.5);
    svgRenderer.setLineCap(LineCap.Round);
    svgRenderer.setLineJoin(LineJoin.Bevel);
    svgRenderer.setStrokingRGB(1, 0, 0);
    svgRenderer.setNonStrokingRGB(0, 1, 0);

    expect(svgRenderer.graphicsState.lineWidth).toBe(2.5);
    expect(svgRenderer.graphicsState.lineCap).toBe(LineCap.Round);
    expect(svgRenderer.graphicsState.lineJoin).toBe(LineJoin.Bevel);
    expect(svgRenderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");
    expect(svgRenderer.graphicsState.fillColor).toBe("rgb(0, 255, 0)");
  });

  it("handles the same operator set as CanvasRenderer", () => {
    // Execute a complex series of operators
    svgRenderer.executeOperators([
      Operator.of(Op.PushGraphicsState),
      Operator.of(Op.SetLineWidth, 2),
      Operator.of(Op.SetStrokingRGB, 1, 0, 0),
      Operator.of(Op.MoveTo, 0, 0),
      Operator.of(Op.LineTo, 100, 100),
      Operator.of(Op.Stroke),
      Operator.of(Op.BeginText),
      Operator.of(Op.SetFont, "/Helvetica", 12),
      Operator.of(Op.MoveText, 50, 700),
      Operator.of(Op.ShowText, PdfString.fromString("Test")),
      Operator.of(Op.EndText),
      Operator.of(Op.PopGraphicsState),
    ]);

    expect(svgRenderer.stateStackDepth).toBe(0);
    expect(svgRenderer.graphicsState.lineWidth).toBe(1);
  });
});

describe("SVGRenderer performance scenarios", () => {
  let renderer: SVGRenderer;

  beforeEach(async () => {
    renderer = new SVGRenderer();
    await renderer.initialize({ headless: true });
  });

  afterEach(() => {
    renderer.destroy();
  });

  it("handles many operators efficiently", () => {
    const operators: Operator[] = [];

    // Generate 1000 rectangle operations
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 10; j++) {
        operators.push(Operator.of(Op.Rectangle, i * 6, j * 79, 5, 78), Operator.of(Op.Fill));
      }
    }

    const start = performance.now();
    renderer.executeOperators(operators);
    const duration = performance.now() - start;

    // Should complete in reasonable time
    expect(duration).toBeLessThan(1000);
  });

  it("handles rapid graphics state changes", () => {
    for (let i = 0; i < 100; i++) {
      renderer.pushGraphicsState();
      renderer.setLineWidth(i % 10);
      renderer.setStrokingRGB((i % 256) / 255, ((i * 2) % 256) / 255, ((i * 3) % 256) / 255);
      renderer.popGraphicsState();
    }

    expect(renderer.stateStackDepth).toBe(0);
  });
});
