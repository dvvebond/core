import "server-only";
import { PDF } from "../../../dist/index.mjs";
import type {
  ViewerAnnotation,
  ViewerDocument,
  ViewerLine,
  ViewerPage,
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

function mapPage(page: ViewerPageSource): ViewerPage {
  const extracted = page.extractText();

  return {
    pageIndex: extracted.pageIndex,
    width: page.width,
    height: page.height,
    rotation: page.rotation,
    text: extracted.text,
    lines: extracted.lines.map(mapLine),
    annotations: page.getAnnotations().map(mapAnnotation),
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
