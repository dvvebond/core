import "server-only";
import { PDF } from "../../../dist/index.mjs";
import type {
  PageRenderPlan,
  RenderClipPath,
  RenderCommand,
  RenderImageCommand,
  RenderPathCommand,
  RenderShadingCommand,
} from "../../../dist/index.mjs";
import type {
  ViewerAnnotation,
  ViewerDocument,
  ViewerLine,
  ViewerPage,
  ViewerRenderClipPath,
  ViewerRenderCommand,
  ViewerRenderPlan,
  ViewerSpan,
} from "./no-pdfjs-viewer-types";

function mapSpan(span: {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  fontName: string;
  fontSize: number;
}): ViewerSpan {
  return {
    text: span.text,
    bbox: span.bbox,
    fontName: span.fontName,
    fontSize: span.fontSize,
  };
}

function mapLine(line: {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  baseline: number;
  spans: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
    fontName: string;
    fontSize: number;
  }>;
}): ViewerLine {
  return {
    text: line.text,
    bbox: line.bbox,
    baseline: line.baseline,
    spans: line.spans.map(mapSpan),
  };
}

function mapAnnotation(annotation: {
  type: string;
  rect: { x: number; y: number; width: number; height: number };
  contents: string | null;
}): ViewerAnnotation {
  const linkUri = "uri" in annotation && typeof annotation.uri === "string" ? annotation.uri : null;

  return {
    type: annotation.type,
    rect: annotation.rect,
    contents: annotation.contents,
    uri: linkUri,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function mapClipPath(clipPath: RenderClipPath): ViewerRenderClipPath {
  return {
    ctm: [...clipPath.ctm] as ViewerRenderClipPath["ctm"],
    path: clipPath.path.map(segment => ({ ...segment })) as ViewerRenderClipPath["path"],
    rule: clipPath.rule,
  };
}

function mapPathCommand(
  command: RenderPathCommand,
): Extract<ViewerRenderCommand, { kind: "path" }> {
  const clipPaths = command.clipPaths.map(mapClipPath);

  return {
    kind: "path",
    ctm: [...command.ctm] as Extract<ViewerRenderCommand, { kind: "path" }>["ctm"],
    path: command.path.map(segment => ({ ...segment })) as Extract<
      ViewerRenderCommand,
      { kind: "path" }
    >["path"],
    clipPaths,
    blendMode: command.blendMode,
    fill: command.fill
      ? {
          color: { ...command.fill.color },
          opacity: command.fill.opacity,
          rule: command.fill.rule,
        }
      : undefined,
    stroke: command.stroke
      ? {
          color: { ...command.stroke.color },
          opacity: command.stroke.opacity,
          lineWidth: command.stroke.lineWidth,
          lineCap: command.stroke.lineCap,
          lineJoin: command.stroke.lineJoin,
          miterLimit: command.stroke.miterLimit,
          dashArray: [...command.stroke.dashArray],
          dashPhase: command.stroke.dashPhase,
        }
      : undefined,
  };
}

function mapImageCommand(
  command: RenderImageCommand,
): Extract<ViewerRenderCommand, { kind: "image" }> {
  return {
    kind: "image",
    ctm: [...command.ctm] as Extract<ViewerRenderCommand, { kind: "image" }>["ctm"],
    clipPaths: command.clipPaths.map(mapClipPath),
    image:
      command.image.kind === "raw"
        ? {
            kind: "raw",
            width: command.image.width,
            height: command.image.height,
            dataBase64: bytesToBase64(command.image.data),
          }
        : {
            kind: "jpeg",
            width: command.image.width,
            height: command.image.height,
            dataBase64: bytesToBase64(command.image.data),
            alphaMaskBase64: command.image.alphaMask
              ? bytesToBase64(command.image.alphaMask)
              : undefined,
          },
    opacity: command.opacity,
    blendMode: command.blendMode,
  };
}

function mapShadingCommand(
  command: RenderShadingCommand,
): Extract<ViewerRenderCommand, { kind: "shading" }> {
  return {
    kind: "shading",
    ctm: [...command.ctm] as Extract<ViewerRenderCommand, { kind: "shading" }>["ctm"],
    clipPaths: command.clipPaths.map(mapClipPath),
    shading: {
      ...command.shading,
      stops: command.shading.stops.map(stop => ({
        offset: stop.offset,
        color: { ...stop.color },
      })),
    } as Extract<ViewerRenderCommand, { kind: "shading" }>["shading"],
    opacity: command.opacity,
    blendMode: command.blendMode,
  };
}

function mapRenderCommand(command: RenderCommand): ViewerRenderCommand {
  switch (command.kind) {
    case "path":
      return mapPathCommand(command);
    case "image":
      return mapImageCommand(command);
    case "shading":
      return mapShadingCommand(command);
  }
}

function mapRenderPlan(renderPlan: PageRenderPlan): ViewerRenderPlan {
  return {
    commands: renderPlan.commands.map(mapRenderCommand),
    warnings: [...renderPlan.warnings],
  };
}

function mapPage(page: ViewerPageSource): ViewerPage {
  const extracted = page.extractText();
  const renderPlan = page.buildRenderPlan();

  return {
    pageIndex: extracted.pageIndex,
    width: page.width,
    height: page.height,
    rotation: page.rotation,
    text: extracted.text,
    lines: extracted.lines.map(mapLine),
    annotations: page.getAnnotations().map(mapAnnotation),
    renderPlan: mapRenderPlan(renderPlan),
  };
}

type ViewerPageSource = ReturnType<PDF["getPages"]>[number];

export async function buildViewerDocument(
  bytes: Uint8Array,
  sourceLabel: string,
): Promise<ViewerDocument> {
  const pdf = await PDF.load(bytes);
  const pages = pdf.getPages().map(mapPage);

  return {
    sourceLabel,
    pageCount: pdf.getPageCount(),
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    keywords: pdf.getKeywords(),
    creator: pdf.getCreator(),
    producer: pdf.getProducer(),
    pages,
  };
}
