/**
 * Text positioning calculations for PDF text extraction.
 *
 * Handles the complex coordinate transformations involved in PDF text rendering:
 * - CTM (Current Transformation Matrix) for page-level transforms
 * - Text matrix (Tm) for text positioning within text objects
 * - Font metrics for glyph width and height calculations
 *
 * All calculations follow the PDF coordinate system (origin at bottom-left, units in points).
 */

import type { PdfFont } from "#src/fonts/pdf-font";
import { Matrix } from "#src/helpers/matrix";

import type { BoundingBox } from "../types";

/**
 * Graphics state for text positioning.
 */
export interface GraphicsState {
  /** Current transformation matrix */
  ctm: Matrix;
  /** Text state parameters */
  textParams: TextParams;
}

/**
 * Text state parameters that affect positioning.
 */
export interface TextParams {
  /** Character spacing (Tc) - extra space after each character */
  charSpacing: number;
  /** Word spacing (Tw) - extra space after space characters */
  wordSpacing: number;
  /** Horizontal scaling (Tz) - percentage, 100 = normal */
  horizontalScale: number;
  /** Leading (TL) - vertical distance between baselines */
  leading: number;
  /** Text rise (Ts) - superscript/subscript offset */
  rise: number;
  /** Text rendering mode (Tr) */
  renderMode: number;
}

/**
 * Result of calculating a character's bounding box.
 */
export interface CharacterBBox {
  /** Bounding box in user space */
  bbox: BoundingBox;
  /** Y coordinate of the baseline */
  baseline: number;
  /** Glyph width used for text position advancement */
  advanceWidth: number;
}

/**
 * Default text parameters.
 */
export function createDefaultTextParams(): TextParams {
  return {
    charSpacing: 0,
    wordSpacing: 0,
    horizontalScale: 100,
    leading: 0,
    rise: 0,
    renderMode: 0,
  };
}

/**
 * Clone text parameters.
 */
export function cloneTextParams(params: TextParams): TextParams {
  return {
    charSpacing: params.charSpacing,
    wordSpacing: params.wordSpacing,
    horizontalScale: params.horizontalScale,
    leading: params.leading,
    rise: params.rise,
    renderMode: params.renderMode,
  };
}

/**
 * Text positioning calculator.
 *
 * Tracks text state and calculates character bounding boxes
 * using PDF's coordinate transformation system.
 */
export class TextPositionCalculator {
  /** Current transformation matrix (graphics state) */
  private ctm: Matrix = Matrix.identity();

  /** Text matrix (Tm) - set by Tm operator, updated by text operations */
  private tm: Matrix = Matrix.identity();

  /** Text line matrix (Tlm) - set at start of each line */
  private tlm: Matrix = Matrix.identity();

  /** Current font */
  private font: PdfFont | null = null;

  /** Current font size in points */
  private fontSize: number = 0;

  /** Text state parameters */
  private textParams: TextParams = createDefaultTextParams();

  /** Graphics state stack for q/Q operators */
  private graphicsStack: GraphicsState[] = [];

  /**
   * Get the current position in user space.
   */
  get position(): { x: number; y: number } {
    return this.ctm.transformPoint(this.tm.e, this.tm.f + this.textParams.rise);
  }

  /**
   * Get the effective font size accounting for transforms.
   */
  get effectiveFontSize(): number {
    const tmScale = this.tm.getScaleY();
    const ctmScale = this.ctm.getScaleY();
    return Math.abs(this.fontSize * tmScale * ctmScale);
  }

  /**
   * Get the current font.
   */
  get currentFont(): PdfFont | null {
    return this.font;
  }

  /**
   * Get current font size.
   */
  get currentFontSize(): number {
    return this.fontSize;
  }

  /**
   * Get current text parameters.
   */
  get currentTextParams(): TextParams {
    return this.textParams;
  }

  /**
   * Save graphics state (q operator).
   */
  saveGraphicsState(): void {
    this.graphicsStack.push({
      ctm: this.ctm.clone(),
      textParams: cloneTextParams(this.textParams),
    });
  }

  /**
   * Restore graphics state (Q operator).
   */
  restoreGraphicsState(): void {
    const saved = this.graphicsStack.pop();
    if (saved) {
      this.ctm = saved.ctm;
      this.textParams = saved.textParams;
    }
  }

  /**
   * Concatenate matrix to CTM (cm operator).
   */
  concatMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const newMatrix = new Matrix(a, b, c, d, e, f);
    this.ctm = newMatrix.multiply(this.ctm);
  }

  /**
   * Begin text object (BT operator).
   */
  beginText(): void {
    this.tm = Matrix.identity();
    this.tlm = Matrix.identity();
  }

  /**
   * End text object (ET operator).
   */
  endText(): void {
    // Text matrices become undefined outside text objects
    // but we keep them for simplicity
  }

  /**
   * Set font and size (Tf operator).
   */
  setFont(font: PdfFont | null, size: number): void {
    this.font = font;
    this.fontSize = size;
  }

  /**
   * Set character spacing (Tc operator).
   */
  setCharSpacing(value: number): void {
    this.textParams.charSpacing = value;
  }

  /**
   * Set word spacing (Tw operator).
   */
  setWordSpacing(value: number): void {
    this.textParams.wordSpacing = value;
  }

  /**
   * Set horizontal scaling (Tz operator).
   */
  setHorizontalScale(value: number): void {
    this.textParams.horizontalScale = value;
  }

  /**
   * Set leading (TL operator).
   */
  setLeading(value: number): void {
    this.textParams.leading = value;
  }

  /**
   * Set text rise (Ts operator).
   */
  setTextRise(value: number): void {
    this.textParams.rise = value;
  }

  /**
   * Set render mode (Tr operator).
   */
  setRenderMode(value: number): void {
    this.textParams.renderMode = value;
  }

  /**
   * Set text matrix (Tm operator).
   */
  setTextMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.tm = new Matrix(a, b, c, d, e, f);
    this.tlm = this.tm.clone();
  }

  /**
   * Move text position (Td operator).
   */
  moveTextPosition(tx: number, ty: number): void {
    this.tlm = this.tlm.translate(tx, ty);
    this.tm = this.tlm.clone();
  }

  /**
   * Move text position and set leading (TD operator).
   */
  moveTextPositionAndSetLeading(tx: number, ty: number): void {
    this.textParams.leading = -ty;
    this.moveTextPosition(tx, ty);
  }

  /**
   * Move to next line (T* operator).
   */
  moveToNextLine(): void {
    this.moveTextPosition(0, -this.textParams.leading);
  }

  /**
   * Apply TJ position adjustment.
   *
   * @param adjustment - Adjustment in thousandths of an em (negative = move right)
   */
  applyTJAdjustment(adjustment: number): void {
    const tx = (-adjustment / 1000) * this.fontSize * (this.textParams.horizontalScale / 100);
    this.tm = this.tm.translate(tx, 0);
  }

  /**
   * Calculate the bounding box for a character.
   *
   * @param glyphWidth - Glyph width in font units (1000 = 1 em)
   * @returns Character bounding box and positioning information
   */
  calculateCharBBox(glyphWidth: number): CharacterBBox {
    // Get font metrics - use FontBBox as fallback
    let ascender = this.font?.descriptor?.ascent;
    let descender = this.font?.descriptor?.descent;

    if (!ascender && !descender && this.font?.descriptor?.fontBBox) {
      const bbox = this.font.descriptor.fontBBox;
      ascender = bbox[3]; // ury
      descender = bbox[1]; // lly
    }

    // Default values if metrics unavailable
    if (!ascender) {
      ascender = 800;
    }
    if (descender === undefined || descender === null) {
      descender = -200;
    }

    // Calculate dimensions in scaled text space
    const hScale = this.textParams.horizontalScale / 100;
    const glyphWidthScaled = (glyphWidth / 1000) * this.fontSize * hScale;
    const glyphHeightScaled = ((ascender - descender) / 1000) * this.fontSize;
    const descenderScaled = (descender / 1000) * this.fontSize;

    // Current text position
    const textX = this.tm.e;
    const textY = this.tm.f + this.textParams.rise;

    // Transform baseline point to user space
    const baselinePoint = this.ctm.transformPoint(textX, textY);

    // Define glyph corners in text rendering space
    const corners = [
      { x: 0, y: descenderScaled },
      { x: glyphWidthScaled, y: descenderScaled },
      { x: glyphWidthScaled, y: descenderScaled + glyphHeightScaled },
      { x: 0, y: descenderScaled + glyphHeightScaled },
    ];

    // Transform corners through Tm and CTM
    const transformedCorners = corners.map(corner => {
      const tmRotated = {
        x: this.tm.a * corner.x + this.tm.c * corner.y,
        y: this.tm.b * corner.x + this.tm.d * corner.y,
      };
      return {
        x: baselinePoint.x + (this.ctm.a * tmRotated.x + this.ctm.c * tmRotated.y),
        y: baselinePoint.y + (this.ctm.b * tmRotated.x + this.ctm.d * tmRotated.y),
      };
    });

    // Compute axis-aligned bounding box
    const xs = transformedCorners.map(c => c.x);
    const ys = transformedCorners.map(c => c.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Calculate advance width for text position update
    const advanceWidth = (glyphWidth / 1000) * this.fontSize * hScale + this.textParams.charSpacing;

    return {
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      baseline: baselinePoint.y,
      advanceWidth,
    };
  }

  /**
   * Advance text position after showing a character.
   *
   * @param glyphWidth - Glyph width in font units (1000 = 1 em)
   * @param isSpace - Whether this is a space character
   */
  advancePosition(glyphWidth: number, isSpace: boolean): void {
    const w0 = glyphWidth / 1000;
    const hScale = this.textParams.horizontalScale / 100;

    const tx =
      (w0 * this.fontSize +
        this.textParams.charSpacing +
        (isSpace ? this.textParams.wordSpacing : 0)) *
      hScale;

    this.tm = this.tm.translate(tx, 0);
  }

  /**
   * Clone this calculator's state.
   */
  clone(): TextPositionCalculator {
    const copy = new TextPositionCalculator();
    copy.ctm = this.ctm.clone();
    copy.tm = this.tm.clone();
    copy.tlm = this.tlm.clone();
    copy.font = this.font;
    copy.fontSize = this.fontSize;
    copy.textParams = cloneTextParams(this.textParams);
    return copy;
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.ctm = Matrix.identity();
    this.tm = Matrix.identity();
    this.tlm = Matrix.identity();
    this.font = null;
    this.fontSize = 0;
    this.textParams = createDefaultTextParams();
    this.graphicsStack = [];
  }
}
