/**
 * Integration tests for CanvasRenderer.
 *
 * These tests verify that the CanvasRenderer correctly processes
 * PDF content streams and produces the expected state changes.
 */

import { Op, Operator } from "#src/content/operators";
import { ContentStreamParser, type ContentToken } from "#src/content/parsing";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { CanvasRenderer, LineCap, LineJoin, TextRenderMode } from "#src/renderers/canvas-renderer";
import { stringToBytes } from "#src/test-utils";
import { describe, expect, it, beforeEach } from "vitest";

/**
 * Helper to convert parsed content stream operations to Operator objects.
 */
function parseToOperators(bytes: Uint8Array): Operator[] {
  const parser = new ContentStreamParser(bytes);
  const { operations } = parser.parse();

  return operations.map(op => {
    if ("operands" in op) {
      const operands: (number | string | PdfName | PdfString)[] = [];
      for (const token of op.operands) {
        switch (token.type) {
          case "number":
            operands.push(token.value);
            break;
          case "name":
            operands.push(PdfName.of(token.value));
            break;
          case "string":
            // Convert Uint8Array to PdfString
            operands.push(PdfString.fromBytes(token.value));
            break;
          // Skip other token types (array, dict, bool, null) for now
          default:
            break;
        }
      }
      return Operator.of(op.operator as Op, ...operands);
    }
    // Inline image - skip for now
    return Operator.of(Op.EndPath);
  });
}

describe("CanvasRenderer Integration", () => {
  let renderer: CanvasRenderer;

  beforeEach(async () => {
    renderer = new CanvasRenderer();
    await renderer.initialize({ headless: true });
  });

  describe("content stream parsing and execution", () => {
    it("executes a simple graphics state content stream", () => {
      const contentStream = stringToBytes("q 2 w 1 0 0 RG 0 0 m 100 100 l S Q");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      // After execution, state should be restored
      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });

    it("executes a text content stream", () => {
      const contentStream = stringToBytes("BT /F1 12 Tf 100 700 Td (Hello World) Tj ET");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      expect(renderer.inTextObject).toBe(false);
    });

    it("executes nested graphics states", () => {
      const contentStream = stringToBytes("q 1 w q 2 w q 3 w Q Q Q");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });

    it("executes rectangle drawing", () => {
      const contentStream = stringToBytes("q 0.9 g 50 50 100 80 re f 0 G 50 50 100 80 re S Q");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("executes color operators", () => {
      const contentStream = stringToBytes("1 0 0 RG 0 1 0 rg 0.5 G 0.8 g");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      expect(renderer.graphicsState.strokeColor).toBe("rgb(128, 128, 128)");
      expect(renderer.graphicsState.fillColor).toBe("rgb(204, 204, 204)");
    });

    it("executes line style operators", () => {
      const contentStream = stringToBytes("2.5 w 1 J 2 j 15 M");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      expect(renderer.graphicsState.lineWidth).toBe(2.5);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Round);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Bevel);
      expect(renderer.graphicsState.miterLimit).toBe(15);
    });

    it("executes transformation operators", () => {
      const contentStream = stringToBytes("1 0 0 1 50 100 cm");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      expect(renderer.graphicsState.ctm.e).toBe(50);
      expect(renderer.graphicsState.ctm.f).toBe(100);
    });

    it("executes path operators", () => {
      const contentStream = stringToBytes("0 0 m 100 0 l 100 100 l 0 100 l h S");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);

      // Path should be cleared after stroke
    });

    it("executes bezier curve operators", () => {
      const contentStream = stringToBytes("0 0 m 25 50 75 50 100 0 c S");
      const operators = parseToOperators(contentStream);

      renderer.executeOperators(operators);
    });
  });

  describe("complete page rendering simulation", () => {
    it("simulates rendering a simple PDF page", () => {
      // This simulates the content stream of a simple page with:
      // - A gray background rectangle
      // - A black border
      // - Some text

      renderer.executeOperators([
        // Save graphics state
        Operator.of(Op.PushGraphicsState),

        // Draw background
        Operator.of(Op.SetNonStrokingGray, 0.95),
        Operator.of(Op.Rectangle, 50, 50, 500, 700),
        Operator.of(Op.Fill),

        // Draw border
        Operator.of(Op.SetStrokingGray, 0),
        Operator.of(Op.SetLineWidth, 1),
        Operator.of(Op.Rectangle, 50, 50, 500, 700),
        Operator.of(Op.Stroke),

        // Draw title
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 24),
        Operator.of(Op.SetNonStrokingGray, 0),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 700),
        Operator.of(Op.ShowText, PdfString.fromString("Sample Document")),
        Operator.of(Op.EndText),

        // Draw body text
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Times-Roman"), 12),
        Operator.of(Op.SetLeading, 14),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 650),
        Operator.of(Op.ShowText, PdfString.fromString("This is sample body text.")),
        Operator.of(Op.NextLine),
        Operator.of(Op.ShowText, PdfString.fromString("It demonstrates text rendering.")),
        Operator.of(Op.EndText),

        // Draw a red line
        Operator.of(Op.SetStrokingRGB, 1, 0, 0),
        Operator.of(Op.SetLineWidth, 2),
        Operator.of(Op.MoveTo, 100, 600),
        Operator.of(Op.LineTo, 500, 600),
        Operator.of(Op.Stroke),

        // Draw a filled blue circle (approximated with bezier)
        Operator.of(Op.SetNonStrokingRGB, 0, 0, 1),
        Operator.of(Op.MoveTo, 350, 400),
        Operator.of(Op.CurveTo, 350, 427.6, 327.6, 450, 300, 450),
        Operator.of(Op.CurveTo, 272.4, 450, 250, 427.6, 250, 400),
        Operator.of(Op.CurveTo, 250, 372.4, 272.4, 350, 300, 350),
        Operator.of(Op.CurveTo, 327.6, 350, 350, 372.4, 350, 400),
        Operator.of(Op.Fill),

        // Restore graphics state
        Operator.of(Op.PopGraphicsState),
      ]);

      // Verify final state
      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.inTextObject).toBe(false);
    });

    it("handles text positioning with TJ arrays", () => {
      const textArray = new PdfArray([
        PdfString.fromString("K"),
        PdfNumber.of(-80),
        PdfString.fromString("erning"),
      ]);

      renderer.executeOperators([
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 700),
        Operator.of(Op.ShowTextArray, textArray),
        Operator.of(Op.EndText),
      ]);

      expect(renderer.inTextObject).toBe(false);
    });

    it("handles multiple text blocks", () => {
      renderer.executeOperators([
        // First text block
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica-Bold"), 18),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 750),
        Operator.of(Op.ShowText, PdfString.fromString("Header")),
        Operator.of(Op.EndText),

        // Second text block
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 700),
        Operator.of(Op.ShowText, PdfString.fromString("Body text line 1")),
        Operator.of(Op.EndText),

        // Third text block
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica-Oblique"), 10),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 680),
        Operator.of(Op.ShowText, PdfString.fromString("Footer")),
        Operator.of(Op.EndText),
      ]);

      expect(renderer.inTextObject).toBe(false);
    });

    it("handles clipping paths", () => {
      renderer.executeOperators([
        Operator.of(Op.PushGraphicsState),

        // Set up clipping rectangle
        Operator.of(Op.Rectangle, 100, 100, 200, 200),
        Operator.of(Op.Clip),
        Operator.of(Op.EndPath),

        // Draw something that would extend beyond clip
        Operator.of(Op.SetNonStrokingRGB, 1, 0, 0),
        Operator.of(Op.Rectangle, 50, 50, 300, 300),
        Operator.of(Op.Fill),

        Operator.of(Op.PopGraphicsState),
      ]);

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("handles fill and stroke operations", () => {
      renderer.executeOperators([
        // Filled rectangle
        Operator.of(Op.SetNonStrokingRGB, 1, 1, 0),
        Operator.of(Op.Rectangle, 50, 50, 100, 100),
        Operator.of(Op.Fill),

        // Stroked rectangle
        Operator.of(Op.SetStrokingRGB, 0, 0, 0),
        Operator.of(Op.SetLineWidth, 2),
        Operator.of(Op.Rectangle, 200, 50, 100, 100),
        Operator.of(Op.Stroke),

        // Fill and stroke
        Operator.of(Op.SetNonStrokingRGB, 0, 1, 0),
        Operator.of(Op.SetStrokingRGB, 0, 0, 1),
        Operator.of(Op.Rectangle, 350, 50, 100, 100),
        Operator.of(Op.FillAndStroke),

        // Close and stroke
        Operator.of(Op.MoveTo, 50, 200),
        Operator.of(Op.LineTo, 100, 250),
        Operator.of(Op.LineTo, 50, 300),
        Operator.of(Op.CloseAndStroke),
      ]);
    });

    it("handles even-odd fill rule", () => {
      renderer.executeOperators([
        // Outer rectangle
        Operator.of(Op.Rectangle, 50, 50, 200, 200),
        // Inner rectangle (creates a hole with even-odd rule)
        Operator.of(Op.Rectangle, 100, 100, 100, 100),
        Operator.of(Op.SetNonStrokingGray, 0.5),
        Operator.of(Op.FillEvenOdd),
      ]);
    });
  });

  describe("text rendering modes", () => {
    it("handles different text render modes", () => {
      renderer.executeOperators([
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 24),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 700),

        // Fill mode (default)
        Operator.of(Op.SetTextRenderMode, TextRenderMode.Fill),
        Operator.of(Op.ShowText, PdfString.fromString("Fill")),

        // Stroke mode
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 650),
        Operator.of(Op.SetTextRenderMode, TextRenderMode.Stroke),
        Operator.of(Op.ShowText, PdfString.fromString("Stroke")),

        // Fill and stroke
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 600),
        Operator.of(Op.SetTextRenderMode, TextRenderMode.FillStroke),
        Operator.of(Op.ShowText, PdfString.fromString("FillStroke")),

        Operator.of(Op.EndText),
      ]);

      expect(renderer.graphicsState.textRenderMode).toBe(TextRenderMode.FillStroke);
    });

    it("handles text spacing", () => {
      renderer.executeOperators([
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12),

        // Set character spacing
        Operator.of(Op.SetCharSpacing, 2),
      ]);
      expect(renderer.graphicsState.charSpacing).toBe(2);

      renderer.executeOperators([
        // Set word spacing
        Operator.of(Op.SetWordSpacing, 5),
      ]);
      expect(renderer.graphicsState.wordSpacing).toBe(5);

      renderer.executeOperators([
        // Set horizontal scale
        Operator.of(Op.SetHorizontalScale, 150),
      ]);
      expect(renderer.graphicsState.horizontalScale).toBe(150);

      renderer.executeOperators([Operator.of(Op.EndText)]);
    });

    it("handles text rise (superscript/subscript)", () => {
      renderer.executeOperators([
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12),
        Operator.of(Op.SetTextMatrix, 1, 0, 0, 1, 100, 700),

        // Normal text
        Operator.of(Op.ShowText, PdfString.fromString("E=mc")),

        // Superscript
        Operator.of(Op.SetTextRise, 4),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 8),
        Operator.of(Op.ShowText, PdfString.fromString("2")),

        // Reset
        Operator.of(Op.SetTextRise, 0),
        Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12),

        Operator.of(Op.EndText),
      ]);

      expect(renderer.graphicsState.textRise).toBe(0);
    });
  });

  describe("CMYK color handling", () => {
    it("converts CMYK to RGB correctly", () => {
      // Cyan
      renderer.setStrokingCMYK(1, 0, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(0, 255, 255)");

      // Magenta
      renderer.setStrokingCMYK(0, 1, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 255)");

      // Yellow
      renderer.setStrokingCMYK(0, 0, 1, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 255, 0)");

      // Black (100% K)
      renderer.setStrokingCMYK(0, 0, 0, 1);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(0, 0, 0)");

      // 50% gray via K
      renderer.setStrokingCMYK(0, 0, 0, 0.5);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(128, 128, 128)");
    });
  });

  describe("viewport and rendering", () => {
    it("creates viewport for letter-size page", () => {
      const viewport = renderer.createViewport(612, 792, 0);
      expect(viewport.width).toBe(612);
      expect(viewport.height).toBe(792);
    });

    it("creates viewport for A4-size page", () => {
      const viewport = renderer.createViewport(595, 842, 0);
      expect(viewport.width).toBe(595);
      expect(viewport.height).toBe(842);
    });

    it("renders with scale factor", async () => {
      const viewport = renderer.createViewport(612, 792, 0, 2);
      const task = renderer.render(0, viewport);
      const result = await task.promise;

      expect(result.width).toBe(1224);
      expect(result.height).toBe(1584);
    });
  });
});
