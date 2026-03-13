import { ops, PDF, rgb } from "#src/index";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Viewer Render Plan", () => {
  it("builds a LibPDF-native render plan with paths, images, gradients, clips, and form XObjects", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 420, height: 320 });

    page.drawOperators([
      ops.setNonStrokingRGB(0.2, 0.35, 0.7),
      ops.rectangle(24, 24, 92, 56),
      ops.fill(),
      ops.setStrokingRGB(0.9, 0.15, 0.15),
      ops.setLineWidth(3),
      ops.moveTo(18, 18),
      ops.lineTo(402, 18),
      ops.stroke(),
    ]);

    const shading = pdf.createAxialShading({
      coords: [0, 0, 140, 0],
      stops: [
        { offset: 0, color: rgb(1, 0.2, 0.2) },
        { offset: 1, color: rgb(0.2, 0.3, 1) },
      ],
    });
    const shadingName = page.registerShading(shading);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.rectangle(140, 190, 150, 60),
      ops.clip(),
      ops.endPath(),
      ops.paintShading(shadingName),
      ops.popGraphicsState(),
    ]);

    const stamp = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 42, height: 42 },
      operators: [ops.setNonStrokingRGB(0.1, 0.8, 0.35), ops.rectangle(0, 0, 42, 42), ops.fill()],
    });
    const stampName = page.registerXObject(stamp);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.concatMatrix(1, 0, 0, 1, 320, 212),
      ops.paintXObject(stampName),
      ops.popGraphicsState(),
    ]);

    const imageBytes = await loadFixture("images", "red-square.png");
    const image = pdf.embedImage(imageBytes);
    page.drawImage(image, { x: 248, y: 38, width: 56, height: 56 });

    const saved = await pdf.save();
    const loaded = await PDF.load(saved);
    const loadedPage = loaded.getPage(0);

    expect(loadedPage).not.toBeNull();

    const renderPlan = loadedPage!.buildRenderPlan();

    expect(renderPlan.commands.some(command => command.kind === "path")).toBe(true);
    expect(renderPlan.commands.some(command => command.kind === "image")).toBe(true);
    expect(renderPlan.commands.some(command => command.kind === "shading")).toBe(true);

    const shadingCommand = renderPlan.commands.find(command => command.kind === "shading");

    expect(shadingCommand?.clipPaths.length).toBe(1);

    const imageCommand = renderPlan.commands.find(command => command.kind === "image");

    expect(imageCommand?.image.kind).toBe("raw");

    const greenFormPath = renderPlan.commands.find(
      command =>
        command.kind === "path" &&
        command.fill?.color.r === 26 &&
        command.fill?.color.g === 204 &&
        command.fill?.color.b === 89,
    );

    expect(greenFormPath).toBeDefined();
    expect(renderPlan.warnings).toHaveLength(0);
  });
});
