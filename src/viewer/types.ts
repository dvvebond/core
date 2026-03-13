import type { BlendMode } from "#src/drawing/resources/types";

export type RenderMatrix = [number, number, number, number, number, number];

export interface RenderColor {
  r: number;
  g: number;
  b: number;
}

export interface RenderPathMoveTo {
  op: "moveTo";
  x: number;
  y: number;
}

export interface RenderPathLineTo {
  op: "lineTo";
  x: number;
  y: number;
}

export interface RenderPathBezierCurveTo {
  op: "bezierCurveTo";
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
}

export interface RenderPathRect {
  op: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderPathClose {
  op: "closePath";
}

export type RenderPathSegment =
  | RenderPathMoveTo
  | RenderPathLineTo
  | RenderPathBezierCurveTo
  | RenderPathRect
  | RenderPathClose;

export type RenderFillRule = "nonzero" | "evenodd";
export type RenderLineCap = "butt" | "round" | "square";
export type RenderLineJoin = "miter" | "round" | "bevel";

export interface RenderClipPath {
  ctm: RenderMatrix;
  path: RenderPathSegment[];
  rule: RenderFillRule;
}

export interface RenderFillStyle {
  color: RenderColor;
  opacity: number;
  rule: RenderFillRule;
}

export interface RenderStrokeStyle {
  color: RenderColor;
  opacity: number;
  lineWidth: number;
  lineCap: RenderLineCap;
  lineJoin: RenderLineJoin;
  miterLimit: number;
  dashArray: number[];
  dashPhase: number;
}

export interface RenderPathCommand {
  kind: "path";
  ctm: RenderMatrix;
  path: RenderPathSegment[];
  clipPaths: RenderClipPath[];
  fill?: RenderFillStyle;
  stroke?: RenderStrokeStyle;
  blendMode: BlendMode | "Normal";
}

export interface RenderRawImage {
  kind: "raw";
  width: number;
  height: number;
  data: Uint8Array;
}

export interface RenderJpegImage {
  kind: "jpeg";
  width: number;
  height: number;
  data: Uint8Array;
  alphaMask?: Uint8Array;
}

export type RenderImage = RenderRawImage | RenderJpegImage;

export interface RenderImageCommand {
  kind: "image";
  ctm: RenderMatrix;
  clipPaths: RenderClipPath[];
  image: RenderImage;
  opacity: number;
  blendMode: BlendMode | "Normal";
}

export interface RenderGradientStop {
  offset: number;
  color: RenderColor;
}

export interface RenderAxialShading {
  kind: "axial";
  coords: [number, number, number, number];
  stops: RenderGradientStop[];
  extend: [boolean, boolean];
}

export interface RenderRadialShading {
  kind: "radial";
  coords: [number, number, number, number, number, number];
  stops: RenderGradientStop[];
  extend: [boolean, boolean];
}

export type RenderShading = RenderAxialShading | RenderRadialShading;

export interface RenderShadingCommand {
  kind: "shading";
  ctm: RenderMatrix;
  clipPaths: RenderClipPath[];
  shading: RenderShading;
  opacity: number;
  blendMode: BlendMode | "Normal";
}

export type RenderCommand = RenderPathCommand | RenderImageCommand | RenderShadingCommand;

export interface PageRenderPlan {
  pageIndex: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  commands: RenderCommand[];
  warnings: string[];
}
