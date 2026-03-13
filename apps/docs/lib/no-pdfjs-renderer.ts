"use client";

import type {
  ViewerPage,
  ViewerRenderClipPath,
  ViewerRenderColor,
  ViewerRenderImage,
  ViewerRenderMatrix,
  ViewerRenderPathCommand,
  ViewerRenderPathSegment,
  ViewerRenderShadingCommand,
} from "./no-pdfjs-viewer-types";

const renderImageCache = new Map<string, Promise<CanvasImageSource>>();

export async function renderViewerPageToCanvas(
  canvas: HTMLCanvasElement,
  page: ViewerPage,
  zoom: number,
): Promise<void> {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, Math.round(page.width * zoom));
  const cssHeight = Math.max(1, Math.round(page.height * zoom));

  canvas.width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
  canvas.height = Math.max(1, Math.round(cssHeight * devicePixelRatio));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(devicePixelRatio * zoom, devicePixelRatio * zoom);
  applyPageTransform(context, page);

  for (const command of page.renderPlan.commands) {
    context.save();
    applyClipPaths(context, command.clipPaths);
    context.globalCompositeOperation = resolveBlendMode(command.blendMode);

    if (command.kind === "path") {
      drawPathCommand(context, command);
    } else if (command.kind === "image") {
      const image = await loadRenderImage(command.image);

      context.globalAlpha = command.opacity;
      context.save();
      applyMatrix(context, command.ctm);
      context.drawImage(image, 0, 0, 1, 1);
      context.restore();
    } else {
      drawShadingCommand(context, command);
    }

    context.restore();
  }
}

function drawPathCommand(context: CanvasRenderingContext2D, command: ViewerRenderPathCommand) {
  context.beginPath();
  context.save();
  applyMatrix(context, command.ctm);
  buildPath(context, command.path);
  context.restore();

  if (command.fill) {
    context.globalAlpha = command.fill.opacity;
    context.fillStyle = colorToCss(command.fill.color);
    context.fill(command.fill.rule === "evenodd" ? "evenodd" : undefined);
  }

  if (command.stroke) {
    context.globalAlpha = command.stroke.opacity;
    context.strokeStyle = colorToCss(command.stroke.color);
    context.lineWidth = command.stroke.lineWidth;
    context.lineCap = command.stroke.lineCap;
    context.lineJoin = command.stroke.lineJoin;
    context.miterLimit = command.stroke.miterLimit;
    context.setLineDash(command.stroke.dashArray);
    context.lineDashOffset = command.stroke.dashPhase;
    context.stroke();
  }
}

function drawShadingCommand(
  context: CanvasRenderingContext2D,
  command: ViewerRenderShadingCommand,
) {
  context.globalAlpha = command.opacity;
  context.save();
  applyMatrix(context, command.ctm);

  const gradient =
    command.shading.kind === "axial"
      ? context.createLinearGradient(...command.shading.coords)
      : context.createRadialGradient(...command.shading.coords);

  for (const stop of command.shading.stops) {
    gradient.addColorStop(stop.offset, colorToCss(stop.color));
  }

  context.fillStyle = gradient;
  context.fillRect(-8192, -8192, 16384, 16384);
  context.restore();
}

function applyClipPaths(context: CanvasRenderingContext2D, clipPaths: ViewerRenderClipPath[]) {
  for (const clipPath of clipPaths) {
    context.beginPath();
    context.save();
    applyMatrix(context, clipPath.ctm);
    buildPath(context, clipPath.path);
    context.restore();
    context.clip(clipPath.rule === "evenodd" ? "evenodd" : undefined);
  }
}

function buildPath(context: CanvasRenderingContext2D, path: ViewerRenderPathSegment[]) {
  for (const segment of path) {
    switch (segment.op) {
      case "moveTo":
        context.moveTo(segment.x, segment.y);
        break;
      case "lineTo":
        context.lineTo(segment.x, segment.y);
        break;
      case "bezierCurveTo":
        context.bezierCurveTo(
          segment.cp1x,
          segment.cp1y,
          segment.cp2x,
          segment.cp2y,
          segment.x,
          segment.y,
        );
        break;
      case "rect":
        context.rect(segment.x, segment.y, segment.width, segment.height);
        break;
      case "closePath":
        context.closePath();
        break;
    }
  }
}

function applyMatrix(context: CanvasRenderingContext2D, matrix: ViewerRenderMatrix) {
  context.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
}

function colorToCss(color: ViewerRenderColor) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function getBaseDimensions(page: ViewerPage) {
  if (page.rotation === 90 || page.rotation === 270) {
    return {
      width: page.height,
      height: page.width,
    };
  }

  return {
    width: page.width,
    height: page.height,
  };
}

function applyPageTransform(context: CanvasRenderingContext2D, page: ViewerPage) {
  const base = getBaseDimensions(page);

  switch (page.rotation) {
    case 90:
      context.transform(0, 1, 1, 0, 0, 0);
      break;
    case 180:
      context.transform(-1, 0, 0, 1, base.width, 0);
      break;
    case 270:
      context.transform(0, -1, -1, 0, base.height, base.width);
      break;
    default:
      context.transform(1, 0, 0, -1, 0, base.height);
      break;
  }
}

async function loadRenderImage(image: ViewerRenderImage): Promise<CanvasImageSource> {
  const cacheKey =
    image.kind === "raw"
      ? `raw:${image.width}x${image.height}:${image.dataBase64}`
      : `jpeg:${image.width}x${image.height}:${image.dataBase64}:${image.alphaMaskBase64 ?? ""}`;

  const cached = renderImageCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = image.kind === "raw" ? buildRawImage(image) : buildJpegImage(image);

  renderImageCache.set(cacheKey, pending);

  return pending;
}

function buildRawImage(
  image: Extract<ViewerRenderImage, { kind: "raw" }>,
): Promise<CanvasImageSource> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");

  if (!context) {
    return Promise.resolve(canvas);
  }

  const bytes = base64ToBytes(image.dataBase64);
  const imageData = context.createImageData(image.width, image.height);
  imageData.data.set(bytes);
  context.putImageData(imageData, 0, 0);

  return Promise.resolve(canvas);
}

async function buildJpegImage(
  image: Extract<ViewerRenderImage, { kind: "jpeg" }>,
): Promise<CanvasImageSource> {
  const bytes = base64ToBytes(image.dataBase64);
  const blob = new Blob([toArrayBuffer(bytes)], { type: "image/jpeg" });
  const source = await loadCanvasImageSource(blob);

  if (!image.alphaMaskBase64) {
    return source;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return source;
  }

  context.drawImage(source, 0, 0, image.width, image.height);

  const imageData = context.getImageData(0, 0, image.width, image.height);
  const alphaMask = base64ToBytes(image.alphaMaskBase64);

  for (let index = 0; index < image.width * image.height; index++) {
    imageData.data[index * 4 + 3] = alphaMask[index] ?? 255;
  }

  context.putImageData(imageData, 0, 0);

  return canvas;
}

async function loadCanvasImageSource(blob: Blob): Promise<CanvasImageSource> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(blob);
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to decode image."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function resolveBlendMode(blendMode: string): GlobalCompositeOperation {
  switch (blendMode) {
    case "Multiply":
      return "multiply";
    case "Screen":
      return "screen";
    case "Overlay":
      return "overlay";
    case "Darken":
      return "darken";
    case "Lighten":
      return "lighten";
    case "ColorDodge":
      return "color-dodge";
    case "ColorBurn":
      return "color-burn";
    case "HardLight":
      return "hard-light";
    case "SoftLight":
      return "soft-light";
    case "Difference":
      return "difference";
    case "Exclusion":
      return "exclusion";
    case "Hue":
      return "hue";
    case "Saturation":
      return "saturation";
    case "Color":
      return "color";
    case "Luminosity":
      return "luminosity";
    default:
      return "source-over";
  }
}
