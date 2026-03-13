export type ViewerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
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
