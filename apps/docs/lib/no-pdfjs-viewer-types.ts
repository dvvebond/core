export type ViewerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewerRenderMatrix = [number, number, number, number, number, number];

export type ViewerRenderColor = {
  r: number;
  g: number;
  b: number;
};

export type ViewerRenderPathSegment =
  | {
      op: "moveTo";
      x: number;
      y: number;
    }
  | {
      op: "lineTo";
      x: number;
      y: number;
    }
  | {
      op: "bezierCurveTo";
      cp1x: number;
      cp1y: number;
      cp2x: number;
      cp2y: number;
      x: number;
      y: number;
    }
  | {
      op: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      op: "closePath";
    };

export type ViewerRenderClipPath = {
  ctm: ViewerRenderMatrix;
  path: ViewerRenderPathSegment[];
  rule: "nonzero" | "evenodd";
};

export type ViewerRenderPathCommand = {
  kind: "path";
  ctm: ViewerRenderMatrix;
  path: ViewerRenderPathSegment[];
  clipPaths: ViewerRenderClipPath[];
  blendMode: string;
  fill?: {
    color: ViewerRenderColor;
    opacity: number;
    rule: "nonzero" | "evenodd";
  };
  stroke?: {
    color: ViewerRenderColor;
    opacity: number;
    lineWidth: number;
    lineCap: "butt" | "round" | "square";
    lineJoin: "miter" | "round" | "bevel";
    miterLimit: number;
    dashArray: number[];
    dashPhase: number;
  };
};

export type ViewerRenderImage =
  | {
      kind: "raw";
      width: number;
      height: number;
      dataBase64: string;
    }
  | {
      kind: "jpeg";
      width: number;
      height: number;
      dataBase64: string;
      alphaMaskBase64?: string;
    };

export type ViewerRenderImageCommand = {
  kind: "image";
  ctm: ViewerRenderMatrix;
  clipPaths: ViewerRenderClipPath[];
  image: ViewerRenderImage;
  opacity: number;
  blendMode: string;
};

export type ViewerRenderShading =
  | {
      kind: "axial";
      coords: [number, number, number, number];
      stops: Array<{ offset: number; color: ViewerRenderColor }>;
      extend: [boolean, boolean];
    }
  | {
      kind: "radial";
      coords: [number, number, number, number, number, number];
      stops: Array<{ offset: number; color: ViewerRenderColor }>;
      extend: [boolean, boolean];
    };

export type ViewerRenderShadingCommand = {
  kind: "shading";
  ctm: ViewerRenderMatrix;
  clipPaths: ViewerRenderClipPath[];
  shading: ViewerRenderShading;
  opacity: number;
  blendMode: string;
};

export type ViewerRenderCommand =
  | ViewerRenderPathCommand
  | ViewerRenderImageCommand
  | ViewerRenderShadingCommand;

export type ViewerRenderPlan = {
  commands: ViewerRenderCommand[];
  warnings: string[];
};

export type ViewerSpan = {
  text: string;
  bbox: ViewerRect;
  fontName: string;
  fontSize: number;
};

export type ViewerLine = {
  text: string;
  bbox: ViewerRect;
  baseline: number;
  spans: ViewerSpan[];
};

export type ViewerAnnotation = {
  type: string;
  rect: ViewerRect;
  contents: string | null;
  uri: string | null;
};

export type ViewerPage = {
  pageIndex: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  text: string;
  lines: ViewerLine[];
  annotations: ViewerAnnotation[];
  renderPlan: ViewerRenderPlan;
};

export type ViewerDocument = {
  sourceLabel: string;
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  pages: ViewerPage[];
};
