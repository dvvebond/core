/**
 * Tests for CanvasRenderer.
 */

import { Op, Operator } from "#src/content/operators";
import { Matrix } from "#src/helpers/matrix";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it, beforeEach } from "vitest";

import {
  CanvasRenderer,
  createCanvasRenderer,
  LineCap,
  LineJoin,
  TextRenderMode,
} from "./canvas-renderer";

describe("CanvasRenderer", () => {
  let renderer: CanvasRenderer;

  beforeEach(async () => {
    renderer = new CanvasRenderer();
    await renderer.initialize({ headless: true });
  });

  describe("initialization", () => {
    it("creates a renderer", () => {
      expect(renderer).toBeInstanceOf(CanvasRenderer);
      expect(renderer.type).toBe("canvas");
    });

    it("initializes in headless mode", () => {
      expect(renderer.initialized).toBe(true);
      expect(renderer.isHeadless).toBe(true);
    });

    it("returns null canvas in headless mode", () => {
      expect(renderer.getCanvas()).toBeNull();
      expect(renderer.getContext()).toBeNull();
    });

    it("can be created via factory function", async () => {
      const factoryRenderer = createCanvasRenderer({ headless: true });
      await factoryRenderer.initialize({ headless: true });
      expect(factoryRenderer).toBeInstanceOf(CanvasRenderer);
    });
  });

  describe("viewport creation", () => {
    it("creates viewport with correct dimensions", () => {
      const viewport = renderer.createViewport(612, 792, 0);
      expect(viewport.width).toBe(612);
      expect(viewport.height).toBe(792);
      expect(viewport.scale).toBe(1);
      expect(viewport.rotation).toBe(0);
    });

    it("applies scale factor", () => {
      const viewport = renderer.createViewport(612, 792, 0, 2);
      expect(viewport.width).toBe(1224);
      expect(viewport.height).toBe(1584);
      expect(viewport.scale).toBe(2);
    });

    it("handles 90 degree rotation", () => {
      const viewport = renderer.createViewport(612, 792, 90);
      expect(viewport.width).toBe(792);
      expect(viewport.height).toBe(612);
      expect(viewport.rotation).toBe(90);
    });

    it("handles 270 degree rotation", () => {
      const viewport = renderer.createViewport(612, 792, 270);
      expect(viewport.width).toBe(792);
      expect(viewport.height).toBe(612);
      expect(viewport.rotation).toBe(270);
    });

    it("throws if not initialized", async () => {
      const uninitRenderer = new CanvasRenderer();
      expect(() => uninitRenderer.createViewport(612, 792, 0)).toThrow(
        "Renderer must be initialized",
      );
    });
  });

  describe("render task", () => {
    it("renders in headless mode", async () => {
      const viewport = renderer.createViewport(612, 792, 0);
      const task = renderer.render(0, viewport);

      const result = await task.promise;
      expect(result.width).toBe(612);
      expect(result.height).toBe(792);
      expect(result.element).toBeNull();
    });

    it("can be cancelled", async () => {
      const viewport = renderer.createViewport(612, 792, 0);
      const task = renderer.render(0, viewport);
      task.cancel();

      expect(task.cancelled).toBe(true);
      await expect(task.promise).rejects.toThrow("cancelled");
    });
  });

  describe("graphics state management", () => {
    it("starts with empty state stack", () => {
      expect(renderer.stateStackDepth).toBe(0);
    });

    it("pushes and pops graphics state", () => {
      renderer.pushGraphicsState();
      expect(renderer.stateStackDepth).toBe(1);

      renderer.pushGraphicsState();
      expect(renderer.stateStackDepth).toBe(2);

      renderer.popGraphicsState();
      expect(renderer.stateStackDepth).toBe(1);

      renderer.popGraphicsState();
      expect(renderer.stateStackDepth).toBe(0);
    });

    it("preserves state through push/pop", () => {
      renderer.setLineWidth(5);
      expect(renderer.graphicsState.lineWidth).toBe(5);

      renderer.pushGraphicsState();
      renderer.setLineWidth(10);
      expect(renderer.graphicsState.lineWidth).toBe(10);

      renderer.popGraphicsState();
      expect(renderer.graphicsState.lineWidth).toBe(5);
    });

    it("resets graphics state", () => {
      renderer.pushGraphicsState();
      renderer.setLineWidth(10);
      renderer.resetGraphicsState();

      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });
  });

  describe("line properties", () => {
    it("sets line width", () => {
      renderer.setLineWidth(2.5);
      expect(renderer.graphicsState.lineWidth).toBe(2.5);
    });

    it("sets line cap", () => {
      renderer.setLineCap(LineCap.Round);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Round);
    });

    it("sets line join", () => {
      renderer.setLineJoin(LineJoin.Bevel);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Bevel);
    });

    it("sets miter limit", () => {
      renderer.setMiterLimit(15);
      expect(renderer.graphicsState.miterLimit).toBe(15);
    });

    it("sets dash pattern", () => {
      renderer.setDashPattern([3, 2], 1);
      expect(renderer.graphicsState.dashPattern.array).toEqual([3, 2]);
      expect(renderer.graphicsState.dashPattern.phase).toBe(1);
    });
  });

  describe("color operations", () => {
    it("sets stroking gray", () => {
      renderer.setStrokingGray(0.5);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(128, 128, 128)");
    });

    it("sets non-stroking gray", () => {
      renderer.setNonStrokingGray(0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(0, 0, 0)");
    });

    it("sets stroking RGB", () => {
      renderer.setStrokingRGB(1, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");
    });

    it("sets non-stroking RGB", () => {
      renderer.setNonStrokingRGB(0, 1, 0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(0, 255, 0)");
    });

    it("sets stroking CMYK", () => {
      renderer.setStrokingCMYK(0, 1, 1, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");
    });

    it("sets non-stroking CMYK", () => {
      renderer.setNonStrokingCMYK(1, 0, 1, 0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(0, 255, 0)");
    });

    it("sets alpha values", () => {
      renderer.setStrokingAlpha(0.5);
      expect(renderer.graphicsState.strokeAlpha).toBe(0.5);

      renderer.setNonStrokingAlpha(0.75);
      expect(renderer.graphicsState.fillAlpha).toBe(0.75);
    });
  });

  describe("transformation", () => {
    it("concatenates matrix", () => {
      renderer.concatMatrix(1, 0, 0, 1, 10, 20);
      const ctm = renderer.graphicsState.ctm;
      expect(ctm.e).toBe(10);
      expect(ctm.f).toBe(20);
    });

    it("concatenates multiple matrices", () => {
      renderer.concatMatrix(1, 0, 0, 1, 10, 20);
      renderer.concatMatrix(2, 0, 0, 2, 0, 0);
      const ctm = renderer.graphicsState.ctm;
      expect(ctm.a).toBe(2);
      expect(ctm.d).toBe(2);
      expect(ctm.e).toBe(20);
      expect(ctm.f).toBe(40);
    });
  });

  describe("text state", () => {
    it("sets character spacing", () => {
      renderer.setCharSpacing(0.5);
      expect(renderer.graphicsState.charSpacing).toBe(0.5);
    });

    it("sets word spacing", () => {
      renderer.setWordSpacing(1.5);
      expect(renderer.graphicsState.wordSpacing).toBe(1.5);
    });

    it("sets horizontal scale", () => {
      renderer.setHorizontalScale(150);
      expect(renderer.graphicsState.horizontalScale).toBe(150);
    });

    it("sets leading", () => {
      renderer.setLeading(14);
      expect(renderer.graphicsState.leading).toBe(14);
    });

    it("sets font", () => {
      renderer.setFont("/Helvetica", 12);
      expect(renderer.graphicsState.fontName).toBe("/Helvetica");
      expect(renderer.graphicsState.fontSize).toBe(12);
    });

    it("sets text render mode", () => {
      renderer.setTextRenderMode(TextRenderMode.Stroke);
      expect(renderer.graphicsState.textRenderMode).toBe(TextRenderMode.Stroke);
    });

    it("sets text rise", () => {
      renderer.setTextRise(5);
      expect(renderer.graphicsState.textRise).toBe(5);
    });
  });

  describe("text object", () => {
    it("begins and ends text object", () => {
      expect(renderer.inTextObject).toBe(false);

      renderer.beginText();
      expect(renderer.inTextObject).toBe(true);

      renderer.endText();
      expect(renderer.inTextObject).toBe(false);
    });

    it("resets text state on begin text", () => {
      renderer.beginText();
      renderer.setTextMatrix(1, 0, 0, 1, 100, 200);
      renderer.endText();

      renderer.beginText();
      const { textMatrix } = renderer.textState;
      expect(textMatrix.e).toBe(0);
      expect(textMatrix.f).toBe(0);
    });

    it("moves text position", () => {
      renderer.beginText();
      renderer.moveText(10, 20);

      const { textMatrix, textLineMatrix } = renderer.textState;
      expect(textMatrix.e).toBe(10);
      expect(textMatrix.f).toBe(20);
      expect(textLineMatrix.e).toBe(10);
      expect(textLineMatrix.f).toBe(20);
    });

    it("sets text matrix", () => {
      renderer.beginText();
      renderer.setTextMatrix(2, 0, 0, 2, 50, 100);

      const { textMatrix } = renderer.textState;
      expect(textMatrix.a).toBe(2);
      expect(textMatrix.d).toBe(2);
      expect(textMatrix.e).toBe(50);
      expect(textMatrix.f).toBe(100);
    });

    it("moves to next line", () => {
      renderer.setLeading(14);
      renderer.beginText();
      renderer.nextLine();

      const { textMatrix } = renderer.textState;
      expect(textMatrix.f).toBe(-14);
    });

    it("move text set leading sets leading", () => {
      renderer.beginText();
      renderer.moveTextSetLeading(0, -14);

      expect(renderer.graphicsState.leading).toBe(14);
      expect(renderer.textState.textMatrix.f).toBe(-14);
    });
  });

  describe("path operations", () => {
    it("begins path implicitly on moveTo", () => {
      renderer.moveTo(0, 0);
      // Path is created, no error
    });

    it("constructs path with multiple operations", () => {
      renderer.moveTo(0, 0);
      renderer.lineTo(100, 0);
      renderer.lineTo(100, 100);
      renderer.lineTo(0, 100);
      renderer.closePath();
      // No errors means path construction works
    });

    it("draws rectangle", () => {
      renderer.rectangle(10, 20, 100, 50);
      // No errors in headless mode
    });

    it("draws bezier curves", () => {
      renderer.moveTo(0, 0);
      renderer.curveTo(10, 20, 30, 40, 50, 60);
      renderer.curveToInitial(70, 80, 90, 100);
      renderer.curveToFinal(110, 120, 130, 140);
      // No errors in headless mode
    });

    it("ends path without painting", () => {
      renderer.moveTo(0, 0);
      renderer.lineTo(100, 100);
      renderer.endPath();
      // Path should be discarded
    });
  });

  describe("operator execution", () => {
    it("executes push/pop graphics state", () => {
      renderer.executeOperator(Operator.of(Op.PushGraphicsState));
      expect(renderer.stateStackDepth).toBe(1);

      renderer.executeOperator(Operator.of(Op.PopGraphicsState));
      expect(renderer.stateStackDepth).toBe(0);
    });

    it("executes line width", () => {
      renderer.executeOperator(Operator.of(Op.SetLineWidth, 3));
      expect(renderer.graphicsState.lineWidth).toBe(3);
    });

    it("executes concat matrix", () => {
      renderer.executeOperator(Operator.of(Op.ConcatMatrix, 1, 0, 0, 1, 50, 100));
      expect(renderer.graphicsState.ctm.e).toBe(50);
      expect(renderer.graphicsState.ctm.f).toBe(100);
    });

    it("executes path operators", () => {
      renderer.executeOperator(Operator.of(Op.MoveTo, 0, 0));
      renderer.executeOperator(Operator.of(Op.LineTo, 100, 100));
      renderer.executeOperator(Operator.of(Op.ClosePath));
      renderer.executeOperator(Operator.of(Op.Stroke));
      // No errors in headless mode
    });

    it("executes color operators", () => {
      renderer.executeOperator(Operator.of(Op.SetStrokingRGB, 1, 0, 0));
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");

      renderer.executeOperator(Operator.of(Op.SetNonStrokingGray, 0.5));
      expect(renderer.graphicsState.fillColor).toBe("rgb(128, 128, 128)");
    });

    it("executes text operators", () => {
      renderer.executeOperator(Operator.of(Op.BeginText));
      expect(renderer.inTextObject).toBe(true);

      renderer.executeOperator(Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12));
      expect(renderer.graphicsState.fontName).toBe("Helvetica");
      expect(renderer.graphicsState.fontSize).toBe(12);

      renderer.executeOperator(Operator.of(Op.MoveText, 50, 700));
      expect(renderer.textState.textMatrix.e).toBe(50);
      expect(renderer.textState.textMatrix.f).toBe(700);

      renderer.executeOperator(Operator.of(Op.EndText));
      expect(renderer.inTextObject).toBe(false);
    });

    it("executes show text", () => {
      renderer.executeOperator(Operator.of(Op.BeginText));
      renderer.executeOperator(Operator.of(Op.SetFont, "/Helvetica", 12));
      renderer.executeOperator(Operator.of(Op.MoveText, 50, 700));
      renderer.executeOperator(Operator.of(Op.ShowText, PdfString.fromString("Hello")));
      renderer.executeOperator(Operator.of(Op.EndText));
      // No errors in headless mode
    });

    it("executes show text array", () => {
      renderer.executeOperator(Operator.of(Op.BeginText));
      renderer.executeOperator(Operator.of(Op.SetFont, "/Helvetica", 12));

      const textArray = new PdfArray([
        PdfString.fromString("H"),
        PdfNumber.of(-10),
        PdfString.fromString("ello"),
      ]);
      renderer.executeOperator(Operator.of(Op.ShowTextArray, textArray));

      renderer.executeOperator(Operator.of(Op.EndText));
      // No errors in headless mode
    });

    it("executes multiple operators", () => {
      renderer.executeOperators([
        Operator.of(Op.PushGraphicsState),
        Operator.of(Op.SetLineWidth, 2),
        Operator.of(Op.SetStrokingRGB, 1, 0, 0),
        Operator.of(Op.MoveTo, 0, 0),
        Operator.of(Op.LineTo, 100, 100),
        Operator.of(Op.Stroke),
        Operator.of(Op.PopGraphicsState),
      ]);

      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });

    it("ignores unknown operators", () => {
      // Should not throw for unimplemented operators
      renderer.executeOperator(Operator.of(Op.DrawXObject, "/Im0"));
      renderer.executeOperator(Operator.of(Op.PaintShading, "/Sh0"));
    });
  });

  describe("complex scenarios", () => {
    it("renders a simple page structure", () => {
      // Simulate a simple PDF page with graphics and text
      renderer.executeOperators([
        // Save state
        Operator.of(Op.PushGraphicsState),

        // Draw a filled rectangle
        Operator.of(Op.SetNonStrokingRGB, 0.9, 0.9, 0.9),
        Operator.of(Op.Rectangle, 50, 50, 200, 100),
        Operator.of(Op.Fill),

        // Draw a stroked rectangle border
        Operator.of(Op.SetStrokingRGB, 0, 0, 0),
        Operator.of(Op.SetLineWidth, 2),
        Operator.of(Op.Rectangle, 50, 50, 200, 100),
        Operator.of(Op.Stroke),

        // Add text
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, "/Helvetica", 14),
        Operator.of(Op.SetNonStrokingGray, 0),
        Operator.of(Op.MoveText, 70, 90),
        Operator.of(Op.ShowText, PdfString.fromString("Hello World")),
        Operator.of(Op.EndText),

        // Restore state
        Operator.of(Op.PopGraphicsState),
      ]);

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("handles nested graphics states", () => {
      renderer.setLineWidth(1);

      renderer.pushGraphicsState();
      renderer.setLineWidth(2);

      renderer.pushGraphicsState();
      renderer.setLineWidth(3);

      renderer.pushGraphicsState();
      renderer.setLineWidth(4);
      expect(renderer.graphicsState.lineWidth).toBe(4);
      expect(renderer.stateStackDepth).toBe(3);

      renderer.popGraphicsState();
      expect(renderer.graphicsState.lineWidth).toBe(3);

      renderer.popGraphicsState();
      expect(renderer.graphicsState.lineWidth).toBe(2);

      renderer.popGraphicsState();
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });

    it("preserves text state independently of graphics state", () => {
      renderer.setLeading(14);

      renderer.pushGraphicsState();
      renderer.setLeading(20);
      expect(renderer.graphicsState.leading).toBe(20);

      renderer.popGraphicsState();
      expect(renderer.graphicsState.leading).toBe(14);
    });
  });

  describe("cleanup", () => {
    it("destroys renderer", () => {
      renderer.destroy();
      expect(renderer.initialized).toBe(false);
    });
  });
});

describe("LineCap constants", () => {
  it("has correct values", () => {
    expect(LineCap.Butt).toBe(0);
    expect(LineCap.Round).toBe(1);
    expect(LineCap.Square).toBe(2);
  });
});

describe("LineJoin constants", () => {
  it("has correct values", () => {
    expect(LineJoin.Miter).toBe(0);
    expect(LineJoin.Round).toBe(1);
    expect(LineJoin.Bevel).toBe(2);
  });
});

describe("TextRenderMode constants", () => {
  it("has correct values", () => {
    expect(TextRenderMode.Fill).toBe(0);
    expect(TextRenderMode.Stroke).toBe(1);
    expect(TextRenderMode.FillStroke).toBe(2);
    expect(TextRenderMode.Invisible).toBe(3);
    expect(TextRenderMode.FillClip).toBe(4);
    expect(TextRenderMode.StrokeClip).toBe(5);
    expect(TextRenderMode.FillStrokeClip).toBe(6);
    expect(TextRenderMode.Clip).toBe(7);
  });
});
