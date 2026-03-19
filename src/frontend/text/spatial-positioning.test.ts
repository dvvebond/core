import { describe, expect, it } from "vitest";

import type { TextLayerInfo, TextSpanInfo } from "./selection-state";
import { createSelectionPointFromScreen, getLineRangeForTextPosition } from "./spatial-positioning";

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function createSpan(
  text: string,
  startOffset: number,
  left: number,
  top: number,
  width: number,
  height: number,
  pageIndex: number,
): TextSpanInfo {
  return {
    element: {} as HTMLElement,
    text,
    startOffset,
    endOffset: startOffset + text.length,
    bounds: createRect(left, top, width, height),
    pageIndex,
  };
}

function createLayer(pageIndex: number, bounds: DOMRect, spans: TextSpanInfo[]): TextLayerInfo {
  return {
    container: {
      getBoundingClientRect: () => bounds,
    } as HTMLElement,
    pageIndex,
    spans,
    fullText: spans.map(span => span.text).join(""),
    isVisible: true,
  };
}

describe("createSelectionPointFromScreen", () => {
  it("keeps blank-area resolution on the page under the cursor", () => {
    const page0 = createLayer(0, createRect(0, 0, 400, 440), [
      createSpan("Intro", 0, 100, 400, 80, 20, 0),
    ]);
    const page1 = createLayer(1, createRect(0, 450, 400, 400), [
      createSpan("Later", 0, 100, 520, 120, 20, 1),
    ]);

    const point = createSelectionPointFromScreen({ x: 140, y: 455 }, [page0, page1]);

    expect(point.pageIndex).toBe(1);
    expect(point.textPosition?.pageIndex).toBe(1);
  });

  it("uses line-aware positioning instead of snapping to an earlier nearby span", () => {
    const page = createLayer(0, createRect(0, 0, 500, 500), [
      createSpan("Hello", 0, 100, 100, 100, 20, 0),
      createSpan("World", 5, 100, 190, 50, 20, 0),
    ]);

    const point = createSelectionPointFromScreen({ x: 180, y: 160 }, [page]);

    expect(point.isInText).toBe(false);
    expect(point.isInNonTextArea).toBe(true);
    expect(point.textPosition?.pageIndex).toBe(0);
    expect(point.textPosition?.charOffset).toBe(10);
  });

  it("keeps wrapped lines with overlapping bounds separate", () => {
    const page = createLayer(0, createRect(0, 0, 500, 500), [
      createSpan("First line", 0, 100, 100, 120, 20, 0),
      createSpan("Second line", 10, 100, 116, 140, 20, 0),
      createSpan("Third line", 21, 100, 132, 120, 20, 0),
    ]);

    const secondLineRange = getLineRangeForTextPosition(
      {
        pageIndex: 0,
        charOffset: 14,
        element: page.spans[1].element,
      },
      page,
    );

    expect(secondLineRange).toEqual({
      start: {
        pageIndex: 0,
        charOffset: 10,
        element: page.spans[1].element,
        elementOffset: 0,
      },
      end: {
        pageIndex: 0,
        charOffset: 21,
        element: page.spans[1].element,
        elementOffset: 11,
      },
    });
  });
});
