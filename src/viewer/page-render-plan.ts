import { ContentStreamParser } from "#src/content/parsing/content-stream-parser";
import type {
  AnyOperation,
  ContentToken,
  InlineImageOperation,
  ParsedOperation,
} from "#src/content/parsing/types";
import type { BlendMode } from "#src/drawing/resources/types";
import { Matrix } from "#src/helpers/matrix";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNull } from "#src/objects/pdf-null";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";

import type {
  PageRenderPlan,
  RenderClipPath,
  RenderColor,
  RenderCommand,
  RenderFillRule,
  RenderImage,
  RenderImageCommand,
  RenderLineCap,
  RenderLineJoin,
  RenderPathCommand,
  RenderPathSegment,
  RenderShading,
  RenderShadingCommand,
  RenderStrokeStyle,
} from "./types";

export interface PageRenderPlanSource {
  pageIndex: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  contentBytes: Uint8Array;
  resources: PdfDict | null;
  resolve: (ref: PdfRef) => PdfObject | null;
}

type GraphicsColorSpace = "gray" | "rgb" | "cmyk" | "pattern" | "unsupported";

type DirectImageColorSpace = { kind: "gray" } | { kind: "rgb" } | { kind: "cmyk" };

type ImageColorSpace =
  | DirectImageColorSpace
  | { kind: "indexed"; base: DirectImageColorSpace; hiVal: number; lookup: Uint8Array }
  | { kind: "unsupported"; label: string; components: number };

interface PlannerState {
  ctm: Matrix;
  strokeColorSpace: GraphicsColorSpace;
  fillColorSpace: GraphicsColorSpace;
  strokeColor: RenderColor;
  fillColor: RenderColor;
  strokeOpacity: number;
  fillOpacity: number;
  blendMode: BlendMode | "Normal";
  lineWidth: number;
  lineCap: RenderLineCap;
  lineJoin: RenderLineJoin;
  miterLimit: number;
  dashArray: number[];
  dashPhase: number;
  clipPaths: RenderClipPath[];
}

interface ImageDescriptor {
  width: number;
  height: number;
  bitsPerComponent: number;
  colorSpace: ImageColorSpace | null;
  imageMask: boolean;
  decode: number[] | null;
}

const BLACK: RenderColor = { r: 0, g: 0, b: 0 };
const INLINE_IMAGE_KEY_MAP: Record<string, string> = {
  BPC: "BitsPerComponent",
  CS: "ColorSpace",
  D: "Decode",
  DP: "DecodeParms",
  F: "Filter",
  H: "Height",
  I: "Interpolate",
  IM: "ImageMask",
  W: "Width",
};
const INLINE_FILTER_NAME_MAP: Record<string, string> = {
  A85: "ASCII85Decode",
  AHx: "ASCIIHexDecode",
  CCF: "CCITTFaxDecode",
  DCT: "DCTDecode",
  Fl: "FlateDecode",
  LZW: "LZWDecode",
  RL: "RunLengthDecode",
};
const INLINE_COLOR_SPACE_NAME_MAP: Record<string, string> = {
  CMYK: "DeviceCMYK",
  G: "DeviceGray",
  I: "Indexed",
  RGB: "DeviceRGB",
};

export function buildPageRenderPlan(source: PageRenderPlanSource): PageRenderPlan {
  const warnings: string[] = [];
  const warningSet = new Set<string>();
  const warn = (message: string) => {
    if (warningSet.has(message)) {
      return;
    }

    warningSet.add(message);
    warnings.push(message);
  };

  const interpreter = new RenderPlanInterpreter(source.resolve, warn);
  const commands = interpreter.processContent(
    source.contentBytes,
    source.resources,
    createDefaultState(),
  );

  return {
    pageIndex: source.pageIndex,
    width: source.width,
    height: source.height,
    rotation: source.rotation,
    commands,
    warnings,
  };
}

class RenderPlanInterpreter {
  private readonly commands: RenderCommand[] = [];

  constructor(
    private readonly resolve: (ref: PdfRef) => PdfObject | null,
    private readonly warn: (message: string) => void,
  ) {}

  processContent(
    contentBytes: Uint8Array,
    resources: PdfDict | null,
    initialState: PlannerState,
  ): RenderCommand[] {
    this.walkContent(contentBytes, resources, initialState);

    return this.commands;
  }

  private walkContent(
    contentBytes: Uint8Array,
    resources: PdfDict | null,
    state: PlannerState,
  ): void {
    const parser = new ContentStreamParser(contentBytes);
    const { operations, warnings } = parser.parse();

    for (const warning of warnings) {
      this.warn(`Render planner: ${warning}`);
    }

    const stack: PlannerState[] = [];
    const currentPath = new MutablePath();
    let pendingClipRule: RenderFillRule | null = null;

    for (const operation of operations) {
      if (operation.operator === "BI") {
        this.handleInlineImage(operation as InlineImageOperation, state, resources);
        continue;
      }

      switch (operation.operator) {
        case "q":
          stack.push(cloneState(state));
          break;

        case "Q": {
          const restored = stack.pop();

          if (!restored) {
            this.warn("Render planner: encountered Q with an empty graphics stack.");
            break;
          }

          Object.assign(state, restored);
          break;
        }

        case "cm":
          state.ctm = state.ctm.multiply(readMatrix(operation.operands));
          break;

        case "w":
          state.lineWidth = getNumber(operation.operands[0], 1);
          break;

        case "J":
          state.lineCap = mapLineCap(getNumber(operation.operands[0], 0));
          break;

        case "j":
          state.lineJoin = mapLineJoin(getNumber(operation.operands[0], 0));
          break;

        case "M":
          state.miterLimit = getNumber(operation.operands[0], 10);
          break;

        case "d": {
          const { pattern, phase } = readDashPattern(operation.operands);
          state.dashArray = pattern;
          state.dashPhase = phase;
          break;
        }

        case "gs":
          this.applyGraphicsState(operation.operands[0], state, resources);
          break;

        case "m": {
          const point = state.ctm.transformPoint(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
          );
          currentPath.moveTo(point.x, point.y);
          break;
        }

        case "l": {
          const point = state.ctm.transformPoint(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
          );
          currentPath.lineTo(point.x, point.y);
          break;
        }

        case "c": {
          const cp1 = state.ctm.transformPoint(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
          );
          const cp2 = state.ctm.transformPoint(
            getNumber(operation.operands[2]),
            getNumber(operation.operands[3]),
          );
          const end = state.ctm.transformPoint(
            getNumber(operation.operands[4]),
            getNumber(operation.operands[5]),
          );
          currentPath.curveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
          break;
        }

        case "v": {
          const current = currentPath.currentPoint;
          const cp2 = state.ctm.transformPoint(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
          );
          const end = state.ctm.transformPoint(
            getNumber(operation.operands[2]),
            getNumber(operation.operands[3]),
          );

          if (!current) {
            this.warn("Render planner: encountered v without a current point.");
            break;
          }

          currentPath.curveTo(current.x, current.y, cp2.x, cp2.y, end.x, end.y);
          break;
        }

        case "y": {
          const cp1 = state.ctm.transformPoint(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
          );
          const end = state.ctm.transformPoint(
            getNumber(operation.operands[2]),
            getNumber(operation.operands[3]),
          );

          currentPath.curveTo(cp1.x, cp1.y, end.x, end.y, end.x, end.y);
          break;
        }

        case "h":
          currentPath.closePath();
          break;

        case "re": {
          const x = getNumber(operation.operands[0]);
          const y = getNumber(operation.operands[1]);
          const width = getNumber(operation.operands[2]);
          const height = getNumber(operation.operands[3]);
          const p1 = state.ctm.transformPoint(x, y);
          const p2 = state.ctm.transformPoint(x + width, y);
          const p3 = state.ctm.transformPoint(x + width, y + height);
          const p4 = state.ctm.transformPoint(x, y + height);

          currentPath.moveTo(p1.x, p1.y);
          currentPath.lineTo(p2.x, p2.y);
          currentPath.lineTo(p3.x, p3.y);
          currentPath.lineTo(p4.x, p4.y);
          currentPath.closePath();
          break;
        }

        case "W":
          pendingClipRule = "nonzero";
          break;

        case "W*":
          pendingClipRule = "evenodd";
          break;

        case "S":
          this.paintCurrentPath(state, currentPath, pendingClipRule, { stroke: true });
          pendingClipRule = null;
          break;

        case "s":
          this.paintCurrentPath(state, currentPath, pendingClipRule, {
            closePath: true,
            stroke: true,
          });
          pendingClipRule = null;
          break;

        case "f":
        case "F":
          this.paintCurrentPath(state, currentPath, pendingClipRule, { fillRule: "nonzero" });
          pendingClipRule = null;
          break;

        case "f*":
          this.paintCurrentPath(state, currentPath, pendingClipRule, { fillRule: "evenodd" });
          pendingClipRule = null;
          break;

        case "B":
          this.paintCurrentPath(state, currentPath, pendingClipRule, {
            fillRule: "nonzero",
            stroke: true,
          });
          pendingClipRule = null;
          break;

        case "B*":
          this.paintCurrentPath(state, currentPath, pendingClipRule, {
            fillRule: "evenodd",
            stroke: true,
          });
          pendingClipRule = null;
          break;

        case "b":
          this.paintCurrentPath(state, currentPath, pendingClipRule, {
            closePath: true,
            fillRule: "nonzero",
            stroke: true,
          });
          pendingClipRule = null;
          break;

        case "b*":
          this.paintCurrentPath(state, currentPath, pendingClipRule, {
            closePath: true,
            fillRule: "evenodd",
            stroke: true,
          });
          pendingClipRule = null;
          break;

        case "n":
          this.finishPathWithoutPaint(state, currentPath, pendingClipRule);
          pendingClipRule = null;
          break;

        case "G":
          state.strokeColorSpace = "gray";
          state.strokeColor = grayToColor(getNumber(operation.operands[0]));
          break;

        case "g":
          state.fillColorSpace = "gray";
          state.fillColor = grayToColor(getNumber(operation.operands[0]));
          break;

        case "RG":
          state.strokeColorSpace = "rgb";
          state.strokeColor = rgbToColor(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
            getNumber(operation.operands[2]),
          );
          break;

        case "rg":
          state.fillColorSpace = "rgb";
          state.fillColor = rgbToColor(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
            getNumber(operation.operands[2]),
          );
          break;

        case "K":
          state.strokeColorSpace = "cmyk";
          state.strokeColor = cmykToColor(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
            getNumber(operation.operands[2]),
            getNumber(operation.operands[3]),
          );
          break;

        case "k":
          state.fillColorSpace = "cmyk";
          state.fillColor = cmykToColor(
            getNumber(operation.operands[0]),
            getNumber(operation.operands[1]),
            getNumber(operation.operands[2]),
            getNumber(operation.operands[3]),
          );
          break;

        case "CS":
          state.strokeColorSpace = resolveGraphicsColorSpace(
            operation.operands[0],
            resources,
            this.resolve,
          );
          break;

        case "cs":
          state.fillColorSpace = resolveGraphicsColorSpace(
            operation.operands[0],
            resources,
            this.resolve,
          );
          break;

        case "SC":
        case "SCN":
          this.applyStrokeColor(state, operation, resources);
          break;

        case "sc":
        case "scn":
          this.applyFillColor(state, operation, resources);
          break;

        case "Do":
          this.paintXObject(operation.operands[0], state, resources);
          break;

        case "sh":
          this.paintShading(operation.operands[0], state, resources);
          break;

        default:
          break;
      }
    }
  }

  private applyGraphicsState(
    resourceToken: ContentToken | undefined,
    state: PlannerState,
    resources: PdfDict | null,
  ): void {
    const name = getName(resourceToken);

    if (!name) {
      return;
    }

    const object = resolveNamedResource(resources, "ExtGState", name, this.resolve);

    if (!(object instanceof PdfDict)) {
      this.warn(`Render planner: ExtGState "${name}" was not found.`);
      return;
    }

    const fillOpacity = object.getNumber("ca", this.resolve)?.value;
    const strokeOpacity = object.getNumber("CA", this.resolve)?.value;
    const lineWidth = object.getNumber("LW", this.resolve)?.value;
    const lineCap = object.getNumber("LC", this.resolve)?.value;
    const lineJoin = object.getNumber("LJ", this.resolve)?.value;
    const miterLimit = object.getNumber("ML", this.resolve)?.value;
    const dash = object.getArray("D", this.resolve);
    const blendMode = readBlendMode(object.get("BM", this.resolve));

    if (fillOpacity !== undefined) {
      state.fillOpacity = clamp(fillOpacity, 0, 1);
    }

    if (strokeOpacity !== undefined) {
      state.strokeOpacity = clamp(strokeOpacity, 0, 1);
    }

    if (lineWidth !== undefined) {
      state.lineWidth = lineWidth;
    }

    if (lineCap !== undefined) {
      state.lineCap = mapLineCap(lineCap);
    }

    if (lineJoin !== undefined) {
      state.lineJoin = mapLineJoin(lineJoin);
    }

    if (miterLimit !== undefined) {
      state.miterLimit = miterLimit;
    }

    if (dash instanceof PdfArray) {
      const patternArray = dash.at(0, this.resolve);
      const phaseNumber = dash.at(1, this.resolve);

      if (patternArray instanceof PdfArray) {
        state.dashArray = readNumberArray(patternArray, this.resolve);
      }

      if (phaseNumber instanceof PdfNumber) {
        state.dashPhase = phaseNumber.value;
      }
    }

    if (blendMode) {
      state.blendMode = blendMode;
    }
  }

  private paintCurrentPath(
    state: PlannerState,
    currentPath: MutablePath,
    pendingClipRule: RenderFillRule | null,
    options: {
      closePath?: boolean;
      fillRule?: RenderFillRule;
      stroke?: boolean;
    },
  ): void {
    if (!currentPath.hasGeometry()) {
      if (pendingClipRule) {
        this.warn("Render planner: clipping path was requested without path geometry.");
      }

      return;
    }

    const path = currentPath.snapshot(options.closePath ?? false);
    const clipPaths = resolveClipPaths(state, path, pendingClipRule);
    const fill =
      options.fillRule && state.fillOpacity > 0
        ? {
            color: cloneColor(state.fillColor),
            opacity: state.fillOpacity,
            rule: options.fillRule,
          }
        : undefined;
    const stroke =
      options.stroke && state.strokeOpacity > 0 && state.lineWidth > 0
        ? createStrokeStyle(state)
        : undefined;

    if (fill || stroke) {
      const command: RenderPathCommand = {
        kind: "path",
        ctm: Matrix.identity().toArray(),
        path,
        clipPaths,
        fill,
        stroke,
        blendMode: state.blendMode,
      };

      this.commands.push(command);
    }

    if (pendingClipRule) {
      state.clipPaths = clipPaths;
    }

    currentPath.clear();
  }

  private finishPathWithoutPaint(
    state: PlannerState,
    currentPath: MutablePath,
    pendingClipRule: RenderFillRule | null,
  ): void {
    if (pendingClipRule && currentPath.hasGeometry()) {
      state.clipPaths = resolveClipPaths(state, currentPath.snapshot(false), pendingClipRule);
    }

    currentPath.clear();
  }

  private applyStrokeColor(
    state: PlannerState,
    operation: ParsedOperation,
    resources: PdfDict | null,
  ): void {
    state.strokeColor = interpretGraphicsColor(
      state.strokeColorSpace,
      operation.operands,
      resources,
      this.resolve,
      this.warn,
      "stroking",
    );
  }

  private applyFillColor(
    state: PlannerState,
    operation: ParsedOperation,
    resources: PdfDict | null,
  ): void {
    state.fillColor = interpretGraphicsColor(
      state.fillColorSpace,
      operation.operands,
      resources,
      this.resolve,
      this.warn,
      "non-stroking",
    );
  }

  private paintXObject(
    nameToken: ContentToken | undefined,
    state: PlannerState,
    resources: PdfDict | null,
  ): void {
    const name = getName(nameToken);

    if (!name) {
      return;
    }

    const object = resolveNamedResource(resources, "XObject", name, this.resolve);

    if (!(object instanceof PdfStream)) {
      this.warn(`Render planner: XObject "${name}" was not found.`);
      return;
    }

    const subtype = object.getName("Subtype", this.resolve)?.value;

    if (subtype === "Image") {
      const image = decodeImageStream(object, resources, state.fillColor, this.resolve, this.warn);

      if (!image || state.fillOpacity <= 0) {
        return;
      }

      const command: RenderImageCommand = {
        kind: "image",
        ctm: state.ctm.toArray(),
        clipPaths: cloneClipPaths(state.clipPaths),
        image,
        opacity: state.fillOpacity,
        blendMode: state.blendMode,
      };

      this.commands.push(command);
      return;
    }

    if (subtype === "Form") {
      const formMatrix = readPdfMatrix(object.getArray("Matrix", this.resolve), this.resolve);
      const nestedState = cloneState(state);
      const formResources = mergeResourceDictionaries(
        resources,
        object.getDict("Resources", this.resolve) ?? null,
        this.resolve,
      );

      if (formMatrix) {
        nestedState.ctm = nestedState.ctm.multiply(formMatrix);
      }

      this.walkContent(object.getDecodedData(), formResources, nestedState);
      return;
    }

    this.warn(`Render planner: XObject subtype "${subtype ?? "unknown"}" is not supported.`);
  }

  private handleInlineImage(
    operation: InlineImageOperation,
    state: PlannerState,
    resources: PdfDict | null,
  ): void {
    const stream = buildInlineImageStream(operation);
    const image = decodeImageStream(stream, resources, state.fillColor, this.resolve, this.warn);

    if (!image || state.fillOpacity <= 0) {
      return;
    }

    const command: RenderImageCommand = {
      kind: "image",
      ctm: state.ctm.toArray(),
      clipPaths: cloneClipPaths(state.clipPaths),
      image,
      opacity: state.fillOpacity,
      blendMode: state.blendMode,
    };

    this.commands.push(command);
  }

  private paintShading(
    nameToken: ContentToken | undefined,
    state: PlannerState,
    resources: PdfDict | null,
  ): void {
    const name = getName(nameToken);

    if (!name) {
      return;
    }

    const object = resolveNamedResource(resources, "Shading", name, this.resolve);

    if (!(object instanceof PdfDict)) {
      this.warn(`Render planner: shading "${name}" was not found.`);
      return;
    }

    const shading = parseShading(object, resources, this.resolve, this.warn);

    if (!shading || state.fillOpacity <= 0) {
      return;
    }

    const command: RenderShadingCommand = {
      kind: "shading",
      ctm: state.ctm.toArray(),
      clipPaths: cloneClipPaths(state.clipPaths),
      shading,
      opacity: state.fillOpacity,
      blendMode: state.blendMode,
    };

    this.commands.push(command);
  }
}

class MutablePath {
  private readonly segments: RenderPathSegment[] = [];
  currentPoint: { x: number; y: number } | null = null;
  private subpathStart: { x: number; y: number } | null = null;

  moveTo(x: number, y: number): void {
    this.segments.push({ op: "moveTo", x, y });
    this.currentPoint = { x, y };
    this.subpathStart = { x, y };
  }

  lineTo(x: number, y: number): void {
    if (!this.currentPoint) {
      this.moveTo(x, y);
      return;
    }

    this.segments.push({ op: "lineTo", x, y });
    this.currentPoint = { x, y };
  }

  curveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    if (!this.currentPoint) {
      this.moveTo(x, y);
      return;
    }

    this.segments.push({
      op: "bezierCurveTo",
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x,
      y,
    });
    this.currentPoint = { x, y };
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.segments.push({ op: "rect", x, y, width, height });
    this.currentPoint = { x, y };
    this.subpathStart = { x, y };
  }

  closePath(): void {
    if (!this.currentPoint || !this.subpathStart) {
      return;
    }

    this.segments.push({ op: "closePath" });
    this.currentPoint = { ...this.subpathStart };
  }

  hasGeometry(): boolean {
    return this.segments.length > 0;
  }

  snapshot(closeCurrentSubpath: boolean): RenderPathSegment[] {
    const next = clonePath(this.segments);

    if (closeCurrentSubpath && next.at(-1)?.op !== "closePath") {
      next.push({ op: "closePath" });
    }

    return next;
  }

  clear(): void {
    this.segments.length = 0;
    this.currentPoint = null;
    this.subpathStart = null;
  }
}

function createDefaultState(): PlannerState {
  return {
    ctm: Matrix.identity(),
    strokeColorSpace: "gray",
    fillColorSpace: "gray",
    strokeColor: cloneColor(BLACK),
    fillColor: cloneColor(BLACK),
    strokeOpacity: 1,
    fillOpacity: 1,
    blendMode: "Normal",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    dashArray: [],
    dashPhase: 0,
    clipPaths: [],
  };
}

function cloneState(state: PlannerState): PlannerState {
  return {
    ctm: state.ctm.clone(),
    strokeColorSpace: state.strokeColorSpace,
    fillColorSpace: state.fillColorSpace,
    strokeColor: cloneColor(state.strokeColor),
    fillColor: cloneColor(state.fillColor),
    strokeOpacity: state.strokeOpacity,
    fillOpacity: state.fillOpacity,
    blendMode: state.blendMode,
    lineWidth: state.lineWidth,
    lineCap: state.lineCap,
    lineJoin: state.lineJoin,
    miterLimit: state.miterLimit,
    dashArray: [...state.dashArray],
    dashPhase: state.dashPhase,
    clipPaths: cloneClipPaths(state.clipPaths),
  };
}

function createStrokeStyle(state: PlannerState): RenderStrokeStyle {
  const scale = averageScale(state.ctm);

  return {
    color: cloneColor(state.strokeColor),
    opacity: state.strokeOpacity,
    lineWidth: state.lineWidth * scale,
    lineCap: state.lineCap,
    lineJoin: state.lineJoin,
    miterLimit: state.miterLimit,
    dashArray: state.dashArray.map(value => value * scale),
    dashPhase: state.dashPhase * scale,
  };
}

function resolveClipPaths(
  state: PlannerState,
  path: RenderPathSegment[],
  pendingClipRule: RenderFillRule | null,
): RenderClipPath[] {
  const clipPaths = cloneClipPaths(state.clipPaths);

  if (!pendingClipRule) {
    return clipPaths;
  }

  clipPaths.push({
    ctm: Matrix.identity().toArray(),
    path: clonePath(path),
    rule: pendingClipRule,
  });

  return clipPaths;
}

function cloneClipPaths(paths: RenderClipPath[]): RenderClipPath[] {
  return paths.map(path => ({
    ctm: [...path.ctm],
    path: clonePath(path.path),
    rule: path.rule,
  }));
}

function clonePath(path: RenderPathSegment[]): RenderPathSegment[] {
  return path.map(segment => ({ ...segment }));
}

function readMatrix(tokens: ContentToken[]): Matrix {
  return new Matrix(
    getNumber(tokens[0], 1),
    getNumber(tokens[1]),
    getNumber(tokens[2]),
    getNumber(tokens[3], 1),
    getNumber(tokens[4]),
    getNumber(tokens[5]),
  );
}

function readPdfMatrix(
  value: PdfArray | undefined,
  resolve: (ref: PdfRef) => PdfObject | null,
): Matrix | null {
  if (!(value instanceof PdfArray) || value.length < 6) {
    return null;
  }

  return new Matrix(
    getPdfNumber(value.at(0, resolve), 1),
    getPdfNumber(value.at(1, resolve)),
    getPdfNumber(value.at(2, resolve)),
    getPdfNumber(value.at(3, resolve), 1),
    getPdfNumber(value.at(4, resolve)),
    getPdfNumber(value.at(5, resolve)),
  );
}

function readDashPattern(tokens: ContentToken[]): { pattern: number[]; phase: number } {
  const patternToken = tokens[0];
  const phaseToken = tokens[1];

  if (patternToken?.type !== "array") {
    return { pattern: [], phase: 0 };
  }

  return {
    pattern: patternToken.items.map(item => (item.type === "number" ? item.value : 0)),
    phase: phaseToken?.type === "number" ? phaseToken.value : 0,
  };
}

function resolveGraphicsColorSpace(
  token: ContentToken | undefined,
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
): GraphicsColorSpace {
  const name = getName(token);

  if (!name) {
    return "unsupported";
  }

  return resolveGraphicsColorSpaceObject(resolveColorSpaceObjectByName(name, resources, resolve));
}

function resolveGraphicsColorSpaceObject(object: PdfObject | null): GraphicsColorSpace {
  if (object instanceof PdfName) {
    return mapColorSpaceName(object.value);
  }

  if (object instanceof PdfArray) {
    const type = getPdfName(object.at(0));

    switch (type) {
      case "CalGray":
        return "gray";
      case "CalRGB":
      case "Lab":
        return "rgb";
      case "ICCBased": {
        const stream = object.at(1);

        if (stream instanceof PdfStream) {
          const alt = stream.get("Alternate");

          if (alt) {
            return resolveGraphicsColorSpaceObject(alt);
          }

          const components = stream.getNumber("N")?.value ?? 3;

          if (components === 1) {
            return "gray";
          }

          if (components === 4) {
            return "cmyk";
          }
        }

        return "rgb";
      }
      case "Pattern":
        return "pattern";
      default:
        return "unsupported";
    }
  }

  return "unsupported";
}

function interpretGraphicsColor(
  colorSpace: GraphicsColorSpace,
  operands: ContentToken[],
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
  label: "stroking" | "non-stroking",
): RenderColor {
  switch (colorSpace) {
    case "gray":
      return grayToColor(getNumber(operands[0]));
    case "rgb":
      return rgbToColor(getNumber(operands[0]), getNumber(operands[1]), getNumber(operands[2]));
    case "cmyk":
      return cmykToColor(
        getNumber(operands[0]),
        getNumber(operands[1]),
        getNumber(operands[2]),
        getNumber(operands[3]),
      );
    case "pattern": {
      const patternName = getName(operands.at(-1));

      if (patternName) {
        const pattern = resolveNamedResource(resources, "Pattern", patternName, resolve);

        if (pattern) {
          warn(`Render planner: ${label} pattern color "${patternName}" is not rendered yet.`);
        }
      }

      return BLACK;
    }
    default:
      warn(`Render planner: unsupported ${label} color space encountered.`);
      return BLACK;
  }
}

function resolveNamedResource(
  resources: PdfDict | null,
  category: string,
  name: string,
  resolve: (ref: PdfRef) => PdfObject | null,
): PdfObject | null {
  const categoryDict = resources?.getDict(category, resolve);

  if (!categoryDict) {
    return null;
  }

  const object = categoryDict.get(name, resolve);

  return object ?? null;
}

function resolveColorSpaceObjectByName(
  name: string,
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
): PdfObject | null {
  switch (name) {
    case "DeviceGray":
      return PdfName.of("DeviceGray");
    case "DeviceRGB":
      return PdfName.of("DeviceRGB");
    case "DeviceCMYK":
      return PdfName.of("DeviceCMYK");
    case "Pattern":
      return PdfName.of("Pattern");
    default:
      return resolveNamedResource(resources, "ColorSpace", name, resolve);
  }
}

function mergeResourceDictionaries(
  base: PdfDict | null,
  override: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
): PdfDict | null {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  const merged = base.clone();

  for (const [key, value] of override) {
    const resolvedValue = value instanceof PdfRef ? (resolve(value) ?? value) : value;
    const existing = merged.get(key, resolve);

    if (existing instanceof PdfDict && resolvedValue instanceof PdfDict) {
      const nested = existing.clone();

      for (const [nestedKey, nestedValue] of resolvedValue) {
        nested.set(nestedKey, nestedValue);
      }

      merged.set(key, nested);
      continue;
    }

    merged.set(key, resolvedValue);
  }

  return merged;
}

function buildInlineImageStream(operation: InlineImageOperation): PdfStream {
  const dict = new PdfDict([["Subtype", PdfName.of("Image")]]);

  for (const [key, value] of operation.params) {
    const normalizedKey = INLINE_IMAGE_KEY_MAP[key] ?? key;

    dict.set(normalizedKey, inlineTokenToPdfObject(normalizedKey, value));
  }

  return new PdfStream(dict, operation.data);
}

function inlineTokenToPdfObject(key: string, token: ContentToken): PdfObject {
  switch (token.type) {
    case "number":
      return PdfNumber.of(token.value);
    case "name":
      return PdfName.of(normalizeInlineNameValue(key, token.value));
    case "string":
      return PdfString.fromBytes(token.value);
    case "bool":
      return PdfBool.of(token.value);
    case "null":
      return PdfNull.instance;
    case "array":
      return new PdfArray(token.items.map(item => inlineTokenToPdfObject(key, item)));
    case "dict": {
      const dict = new PdfDict();

      for (const [entryKey, entryValue] of token.entries) {
        dict.set(entryKey, inlineTokenToPdfObject(entryKey, entryValue));
      }

      return dict;
    }
  }
}

function normalizeInlineNameValue(key: string, value: string): string {
  if (key === "ColorSpace") {
    return INLINE_COLOR_SPACE_NAME_MAP[value] ?? value;
  }

  if (key === "Filter") {
    return INLINE_FILTER_NAME_MAP[value] ?? value;
  }

  return value;
}

function decodeImageStream(
  stream: PdfStream,
  resources: PdfDict | null,
  fillColor: RenderColor,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
): RenderImage | null {
  const descriptor = readImageDescriptor(stream, resources, resolve, warn);

  if (!descriptor) {
    return null;
  }

  let data: Uint8Array;

  try {
    data = stream.getDecodedData();
  } catch (error) {
    warn(
      `Render planner: failed to decode image stream (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return null;
  }

  const alphaMaskStream = stream.get("SMask", resolve);
  const alphaMask =
    alphaMaskStream instanceof PdfStream
      ? decodeSoftMask(alphaMaskStream, resources, resolve, warn)
      : null;

  if (isLikelyJpeg(data)) {
    if (alphaMask && alphaMask.length !== descriptor.width * descriptor.height) {
      warn("Render planner: JPEG soft mask dimensions did not match the image dimensions.");
    }

    return {
      kind: "jpeg",
      width: descriptor.width,
      height: descriptor.height,
      data,
      alphaMask:
        alphaMask && alphaMask.length === descriptor.width * descriptor.height
          ? alphaMask
          : undefined,
    };
  }

  const rgba = decodeSampledImageToRgba(data, descriptor, fillColor, warn);

  if (!rgba) {
    return null;
  }

  if (alphaMask) {
    if (alphaMask.length !== descriptor.width * descriptor.height) {
      warn("Render planner: soft mask dimensions did not match the image dimensions.");
    } else {
      applyAlphaMask(rgba, alphaMask);
    }
  }

  return {
    kind: "raw",
    width: descriptor.width,
    height: descriptor.height,
    data: rgba,
  };
}

function readImageDescriptor(
  stream: PdfStream,
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
): ImageDescriptor | null {
  const width = stream.getNumber("Width", resolve)?.value ?? 0;
  const height = stream.getNumber("Height", resolve)?.value ?? 0;
  const imageMask = stream.getBool("ImageMask", resolve)?.value ?? false;
  const bitsPerComponent = imageMask
    ? (stream.getNumber("BitsPerComponent", resolve)?.value ?? 1)
    : (stream.getNumber("BitsPerComponent", resolve)?.value ?? 8);
  const colorSpaceObject = imageMask
    ? null
    : (stream.get("ColorSpace", resolve) ?? stream.get("CS", resolve) ?? null);
  const colorSpace = imageMask
    ? null
    : resolveImageColorSpace(colorSpaceObject, resources, resolve, warn);
  const decodeArray = stream.getArray("Decode", resolve);
  const decode = decodeArray ? readNumberArray(decodeArray, resolve) : null;

  if (width <= 0 || height <= 0) {
    warn("Render planner: encountered an image stream with invalid dimensions.");
    return null;
  }

  if (!imageMask && !colorSpace) {
    warn("Render planner: encountered an image stream without a supported color space.");
    return null;
  }

  return {
    width,
    height,
    bitsPerComponent,
    colorSpace,
    imageMask,
    decode,
  };
}

function resolveImageColorSpace(
  object: PdfObject | null,
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
): ImageColorSpace | null {
  if (!object) {
    return null;
  }

  if (object instanceof PdfName) {
    switch (object.value) {
      case "DeviceGray":
        return { kind: "gray" };
      case "DeviceRGB":
        return { kind: "rgb" };
      case "DeviceCMYK":
        return { kind: "cmyk" };
      default: {
        const named = resolveColorSpaceObjectByName(object.value, resources, resolve);

        if (named && named !== object) {
          return resolveImageColorSpace(named, resources, resolve, warn);
        }

        return {
          kind: "unsupported",
          label: object.value,
          components: 3,
        };
      }
    }
  }

  if (object instanceof PdfArray) {
    const type = getPdfName(object.at(0, resolve));

    switch (type) {
      case "Indexed": {
        const base = resolveImageColorSpace(
          object.at(1, resolve) ?? null,
          resources,
          resolve,
          warn,
        );
        const hiVal = getPdfNumber(object.at(2, resolve));
        const lookup = readLookupBytes(object.at(3, resolve));

        if (!base || !lookup) {
          return null;
        }

        if (base.kind === "unsupported" || base.kind === "indexed") {
          return {
            kind: "unsupported",
            label: "Indexed",
            components: 3,
          };
        }

        return {
          kind: "indexed",
          base,
          hiVal,
          lookup,
        };
      }

      case "ICCBased": {
        const profile = object.at(1, resolve);

        if (!(profile instanceof PdfStream)) {
          return null;
        }

        const alternate = profile.get("Alternate", resolve);

        if (alternate) {
          return resolveImageColorSpace(alternate, resources, resolve, warn);
        }

        const components = profile.getNumber("N", resolve)?.value ?? 3;

        if (components === 1) {
          return { kind: "gray" };
        }

        if (components === 4) {
          return { kind: "cmyk" };
        }

        return { kind: "rgb" };
      }

      case "CalGray":
        return { kind: "gray" };

      case "CalRGB":
      case "Lab":
        return { kind: "rgb" };

      case "Pattern":
        warn("Render planner: pattern image color spaces are not rendered yet.");
        return {
          kind: "unsupported",
          label: "Pattern",
          components: 3,
        };

      default:
        return {
          kind: "unsupported",
          label: type ?? "unknown",
          components: 3,
        };
    }
  }

  return null;
}

function decodeSampledImageToRgba(
  data: Uint8Array,
  descriptor: ImageDescriptor,
  fillColor: RenderColor,
  warn: (message: string) => void,
): Uint8Array | null {
  const pixelCount = descriptor.width * descriptor.height;

  if (descriptor.imageMask) {
    const samples = unpackSamples(data, pixelCount, descriptor.bitsPerComponent);
    const rgba = new Uint8Array(pixelCount * 4);
    const decode0 = descriptor.decode?.[0] ?? 0;
    const decode1 = descriptor.decode?.[1] ?? 1;
    const maxValue = maxSampleValue(descriptor.bitsPerComponent);

    for (let i = 0; i < pixelCount; i++) {
      const sample = samples[i] ?? 0;
      const alpha = Math.round(clamp(mapSample(sample, maxValue, decode0, decode1), 0, 1) * 255);

      rgba[i * 4] = fillColor.r;
      rgba[i * 4 + 1] = fillColor.g;
      rgba[i * 4 + 2] = fillColor.b;
      rgba[i * 4 + 3] = alpha;
    }

    return rgba;
  }

  if (!descriptor.colorSpace) {
    return null;
  }

  if (descriptor.colorSpace.kind === "unsupported") {
    warn(`Render planner: image color space "${descriptor.colorSpace.label}" is not rendered yet.`);
    return null;
  }

  const components = getColorComponentCount(descriptor.colorSpace);
  const sampleCount = pixelCount * components;
  const samples = unpackSamples(data, sampleCount, descriptor.bitsPerComponent);
  const rgba = new Uint8Array(pixelCount * 4);
  const maxValue = maxSampleValue(descriptor.bitsPerComponent);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const rgb =
      descriptor.colorSpace.kind === "indexed"
        ? indexedSampleToColor(
            descriptor.colorSpace,
            samples[pixelIndex] ?? 0,
            maxValue,
            descriptor.decode,
          )
        : directSamplesToColor(
            descriptor.colorSpace,
            samples,
            pixelIndex * components,
            maxValue,
            descriptor.decode,
          );

    rgba[pixelIndex * 4] = rgb.r;
    rgba[pixelIndex * 4 + 1] = rgb.g;
    rgba[pixelIndex * 4 + 2] = rgb.b;
    rgba[pixelIndex * 4 + 3] = 255;
  }

  return rgba;
}

function decodeSoftMask(
  stream: PdfStream,
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
): Uint8Array | null {
  const descriptor = readImageDescriptor(stream, resources, resolve, warn);

  if (!descriptor) {
    return null;
  }

  let data: Uint8Array;

  try {
    data = stream.getDecodedData();
  } catch (error) {
    warn(
      `Render planner: failed to decode soft mask (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return null;
  }

  const rgba = decodeSampledImageToRgba(data, descriptor, BLACK, warn);

  if (!rgba) {
    return null;
  }

  const alpha = new Uint8Array(descriptor.width * descriptor.height);

  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = rgba[i * 4];
  }

  return alpha;
}

function unpackSamples(data: Uint8Array, sampleCount: number, bitsPerComponent: number): number[] {
  const samples = new Array<number>(sampleCount);

  if (bitsPerComponent === 8) {
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = data[i] ?? 0;
    }

    return samples;
  }

  if (bitsPerComponent === 16) {
    for (let i = 0; i < sampleCount; i++) {
      const offset = i * 2;
      samples[i] = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
    }

    return samples;
  }

  const mask = (1 << bitsPerComponent) - 1;
  let bitOffset = 0;

  for (let i = 0; i < sampleCount; i++) {
    let value = 0;

    for (let bitIndex = 0; bitIndex < bitsPerComponent; bitIndex++) {
      const byteIndex = Math.floor((bitOffset + bitIndex) / 8);
      const shift = 7 - ((bitOffset + bitIndex) % 8);
      value = (value << 1) | (((data[byteIndex] ?? 0) >> shift) & 1);
    }

    samples[i] = value & mask;
    bitOffset += bitsPerComponent;
  }

  return samples;
}

function getColorComponentCount(colorSpace: ImageColorSpace): number {
  switch (colorSpace.kind) {
    case "gray":
      return 1;
    case "rgb":
      return 3;
    case "cmyk":
      return 4;
    case "indexed":
      return 1;
    case "unsupported":
      return colorSpace.components;
  }
}

function directSamplesToColor(
  colorSpace: DirectImageColorSpace,
  samples: number[],
  offset: number,
  maxValue: number,
  decode: number[] | null,
): RenderColor {
  if (colorSpace.kind === "gray") {
    const gray = mapComponent(samples[offset] ?? 0, maxValue, decode, 0);
    return grayToColor(gray);
  }

  if (colorSpace.kind === "rgb") {
    return rgbToColor(
      mapComponent(samples[offset] ?? 0, maxValue, decode, 0),
      mapComponent(samples[offset + 1] ?? 0, maxValue, decode, 1),
      mapComponent(samples[offset + 2] ?? 0, maxValue, decode, 2),
    );
  }

  return cmykToColor(
    mapComponent(samples[offset] ?? 0, maxValue, decode, 0),
    mapComponent(samples[offset + 1] ?? 0, maxValue, decode, 1),
    mapComponent(samples[offset + 2] ?? 0, maxValue, decode, 2),
    mapComponent(samples[offset + 3] ?? 0, maxValue, decode, 3),
  );
}

function indexedSampleToColor(
  colorSpace: Extract<ImageColorSpace, { kind: "indexed" }>,
  sample: number,
  maxValue: number,
  decode: number[] | null,
): RenderColor {
  const decode0 = decode?.[0] ?? 0;
  const decode1 = decode?.[1] ?? colorSpace.hiVal;
  const mapped = Math.round(
    clamp(mapSample(sample, maxValue, decode0, decode1), 0, colorSpace.hiVal),
  );
  const baseComponents = getColorComponentCount(colorSpace.base);
  const lookupOffset = mapped * baseComponents;
  const lookupSamples = new Array<number>(baseComponents);

  for (let i = 0; i < baseComponents; i++) {
    lookupSamples[i] = colorSpace.lookup[lookupOffset + i] ?? 0;
  }

  return directSamplesToColor(colorSpace.base, lookupSamples, 0, 255, null);
}

function mapComponent(
  sample: number,
  maxValue: number,
  decode: number[] | null,
  componentIndex: number,
): number {
  const decode0 = decode?.[componentIndex * 2] ?? 0;
  const decode1 = decode?.[componentIndex * 2 + 1] ?? 1;

  return clamp(mapSample(sample, maxValue, decode0, decode1), 0, 1);
}

function mapSample(sample: number, maxValue: number, decode0: number, decode1: number): number {
  if (maxValue <= 0) {
    return decode0;
  }

  return decode0 + (sample / maxValue) * (decode1 - decode0);
}

function maxSampleValue(bitsPerComponent: number): number {
  if (bitsPerComponent === 16) {
    return 65535;
  }

  return (1 << bitsPerComponent) - 1;
}

function applyAlphaMask(rgba: Uint8Array, alphaMask: Uint8Array): void {
  for (let i = 0; i < alphaMask.length; i++) {
    rgba[i * 4 + 3] = alphaMask[i] ?? 255;
  }
}

function isLikelyJpeg(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0xff && data[1] === 0xd8;
}

function readLookupBytes(object: PdfObject | undefined): Uint8Array | null {
  if (object instanceof PdfString) {
    return object.bytes;
  }

  if (object instanceof PdfStream) {
    return object.getDecodedData();
  }

  return null;
}

function parseShading(
  object: PdfDict,
  resources: PdfDict | null,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
): RenderShading | null {
  const shadingType = object.getNumber("ShadingType", resolve)?.value;
  const colorSpace = resolveImageColorSpace(
    object.get("ColorSpace", resolve) ?? null,
    resources,
    resolve,
    warn,
  );
  const extendArray = object.getArray("Extend", resolve);
  const extendStart = extendArray?.at(0, resolve);
  const extendEnd = extendArray?.at(1, resolve);
  const extend: [boolean, boolean] = [
    extendStart instanceof PdfBool ? extendStart.value : false,
    extendEnd instanceof PdfBool ? extendEnd.value : false,
  ];
  const coords = object.getArray("Coords", resolve);
  const functionObject = object.get("Function", resolve);
  const stops = parseShadingStops(functionObject, colorSpace, resolve, warn);

  if (!coords || !stops || stops.length < 2) {
    return null;
  }

  if (shadingType === 2) {
    const values = readNumberArray(coords, resolve);

    if (values.length < 4) {
      return null;
    }

    return {
      kind: "axial",
      coords: [values[0], values[1], values[2], values[3]],
      stops,
      extend,
    };
  }

  if (shadingType === 3) {
    const values = readNumberArray(coords, resolve);

    if (values.length < 6) {
      return null;
    }

    return {
      kind: "radial",
      coords: [values[0], values[1], values[2], values[3], values[4], values[5]],
      stops,
      extend,
    };
  }

  warn(`Render planner: shading type "${shadingType ?? "unknown"}" is not rendered yet.`);
  return null;
}

function parseShadingStops(
  object: PdfObject | undefined,
  colorSpace: ImageColorSpace | null,
  resolve: (ref: PdfRef) => PdfObject | null,
  warn: (message: string) => void,
): Array<{ offset: number; color: RenderColor }> | null {
  if (!(object instanceof PdfDict) || !colorSpace) {
    return null;
  }

  const functionType = object.getNumber("FunctionType", resolve)?.value;

  if (functionType === 2) {
    return sampleType2Function(object, colorSpace, resolve);
  }

  if (functionType === 3) {
    const functions = object.getArray("Functions", resolve);
    const bounds = object.getArray("Bounds", resolve);

    if (!(functions instanceof PdfArray)) {
      return null;
    }

    const boundValues = bounds ? readNumberArray(bounds, resolve) : [];
    const stops: Array<{ offset: number; color: RenderColor }> = [];

    for (let index = 0; index < functions.length; index++) {
      const functionObject = functions.at(index, resolve);

      if (!(functionObject instanceof PdfDict)) {
        continue;
      }

      const segmentStops = sampleType2Function(functionObject, colorSpace, resolve);

      if (!segmentStops || segmentStops.length < 2) {
        continue;
      }

      const start = index === 0 ? 0 : (boundValues[index - 1] ?? 0);
      const end = boundValues[index] ?? 1;

      for (let stopIndex = 0; stopIndex < segmentStops.length; stopIndex++) {
        const stop = segmentStops[stopIndex];
        const offset = start + (end - start) * stop.offset;

        if (stops.length > 0 && stopIndex === 0) {
          continue;
        }

        stops.push({
          offset,
          color: stop.color,
        });
      }
    }

    return stops;
  }

  warn(`Render planner: shading function type "${functionType ?? "unknown"}" is not rendered yet.`);
  return null;
}

function sampleType2Function(
  object: PdfDict,
  colorSpace: ImageColorSpace,
  resolve: (ref: PdfRef) => PdfObject | null,
): Array<{ offset: number; color: RenderColor }> | null {
  const c0 = object.getArray("C0", resolve);
  const c1 = object.getArray("C1", resolve);
  const exponent = object.getNumber("N", resolve)?.value ?? 1;
  const start = c0 ? readNumberArray(c0, resolve) : [];
  const end = c1 ? readNumberArray(c1, resolve) : [];
  const sampleCount = exponent === 1 ? 2 : 12;
  const stops: Array<{ offset: number; color: RenderColor }> = [];

  for (let index = 0; index < sampleCount; index++) {
    const offset = index / (sampleCount - 1);
    const values = new Array<number>(
      Math.max(start.length, end.length, getColorComponentCount(colorSpace)),
    );

    for (let componentIndex = 0; componentIndex < values.length; componentIndex++) {
      const from = start[componentIndex] ?? 0;
      const to = end[componentIndex] ?? 1;
      values[componentIndex] = from + (to - from) * Math.pow(offset, exponent);
    }

    stops.push({
      offset,
      color: colorComponentsToColor(colorSpace, values),
    });
  }

  return stops;
}

function colorComponentsToColor(colorSpace: ImageColorSpace, values: number[]): RenderColor {
  if (colorSpace.kind === "gray") {
    return grayToColor(values[0] ?? 0);
  }

  if (colorSpace.kind === "rgb") {
    return rgbToColor(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
  }

  if (colorSpace.kind === "cmyk") {
    return cmykToColor(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0);
  }

  if (colorSpace.kind === "indexed") {
    return colorComponentsToColor(colorSpace.base, values);
  }

  return BLACK;
}

function readBlendMode(object: PdfObject | undefined): BlendMode | "Normal" | null {
  if (object instanceof PdfName) {
    return object.value as BlendMode | "Normal";
  }

  if (object instanceof PdfArray) {
    const first = object.at(0);

    if (first instanceof PdfName) {
      return first.value as BlendMode | "Normal";
    }
  }

  return null;
}

function readNumberArray(array: PdfArray, resolve: (ref: PdfRef) => PdfObject | null): number[] {
  const values: number[] = [];

  for (let index = 0; index < array.length; index++) {
    values.push(getPdfNumber(array.at(index, resolve)));
  }

  return values;
}

function getNumber(token: ContentToken | undefined, fallback = 0): number {
  return token?.type === "number" ? token.value : fallback;
}

function getName(token: ContentToken | undefined): string | null {
  return token?.type === "name" ? token.value : null;
}

function getPdfName(object: PdfObject | undefined): string | null {
  return object instanceof PdfName ? object.value : null;
}

function getPdfNumber(object: PdfObject | undefined, fallback = 0): number {
  return object instanceof PdfNumber ? object.value : fallback;
}

function grayToColor(gray: number): RenderColor {
  const value = normalizeChannel(gray);

  return {
    r: value,
    g: value,
    b: value,
  };
}

function rgbToColor(red: number, green: number, blue: number): RenderColor {
  return {
    r: normalizeChannel(red),
    g: normalizeChannel(green),
    b: normalizeChannel(blue),
  };
}

function cmykToColor(cyan: number, magenta: number, yellow: number, black: number): RenderColor {
  const c = clamp(cyan, 0, 1);
  const m = clamp(magenta, 0, 1);
  const y = clamp(yellow, 0, 1);
  const k = clamp(black, 0, 1);

  return {
    r: normalizeChannel((1 - c) * (1 - k)),
    g: normalizeChannel((1 - m) * (1 - k)),
    b: normalizeChannel((1 - y) * (1 - k)),
  };
}

function cloneColor(color: RenderColor): RenderColor {
  return { ...color };
}

function normalizeChannel(value: number): number {
  return Math.round(clamp(value, 0, 1) * 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mapColorSpaceName(name: string): GraphicsColorSpace {
  switch (name) {
    case "DeviceGray":
      return "gray";
    case "DeviceRGB":
      return "rgb";
    case "DeviceCMYK":
      return "cmyk";
    case "Pattern":
      return "pattern";
    default:
      return "unsupported";
  }
}

function mapLineCap(value: number): RenderLineCap {
  switch (value) {
    case 1:
      return "round";
    case 2:
      return "square";
    default:
      return "butt";
  }
}

function mapLineJoin(value: number): RenderLineJoin {
  switch (value) {
    case 1:
      return "round";
    case 2:
      return "bevel";
    default:
      return "miter";
  }
}

function averageScale(matrix: Matrix): number {
  const scaleX = matrix.getScaleX();
  const scaleY = matrix.getScaleY();

  return (Math.abs(scaleX) + Math.abs(scaleY)) / 2 || 1;
}
