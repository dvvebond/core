import { afterEach, describe, expect, it, vi } from "vitest";

import { TextSelectionManager } from "./text-selection-manager";

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

class MockSpanElement {
  readonly firstChild = {} as Node;

  constructor(
    readonly textContent: string,
    private readonly bounds: DOMRect,
  ) {}

  getBoundingClientRect(): DOMRect {
    return this.bounds;
  }
}

class MockContainer {
  style: Record<string, string> = {};

  constructor(
    private readonly bounds: DOMRect,
    private readonly spans: MockSpanElement[] = [],
  ) {}

  addEventListener(): void {}

  removeEventListener(): void {}

  querySelectorAll(selector: string): MockSpanElement[] {
    if (selector === "span") {
      return this.spans;
    }
    return [];
  }

  getBoundingClientRect(): DOMRect {
    return this.bounds;
  }
}

function createMouseEvent(x: number, y: number, detail = 1): MouseEvent {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    detail,
    preventDefault(): void {},
  } as MouseEvent;
}

describe("TextSelectionManager blank-area drag behavior", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
  });

  it("holds the last valid text position while dragging through empty space", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("abcdef", createRect(300, 220, 120, 20)),
      new MockSpanElement("ghijkl", createRect(300, 260, 120, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as any).handleMouseDown(createMouseEvent(330, 270));
    (manager as any).handleMouseMove(createMouseEvent(390, 270));

    expect(manager.getState().dragState.lastTextPosition?.charOffset).toBe(11);

    (manager as any).handleMouseMove(createMouseEvent(250, 270));

    const state = manager.getState();
    expect(state.focus?.isInNonTextArea).toBe(true);
    expect(state.focus?.textPosition?.charOffset).toBe(11);
    expect(state.dragState.lastTextPosition?.charOffset).toBe(11);
    expect(state.pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 8,
        endOffset: 11,
      },
    ]);
  });

  it("does not jump to the next line until the cursor actually reaches it", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("abcdef", createRect(100, 100, 120, 20)),
      new MockSpanElement("ghijkl", createRect(100, 160, 120, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(220, 110),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 145),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBe(6);
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 6,
        endOffset: 6,
      },
    ]);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(120, 145),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBeLessThanOrEqual(6);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 165),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBeGreaterThan(6);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 145),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBe(12);
  });

  it("does not jump to the previous line until the cursor actually reaches it", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("abcdef", createRect(100, 100, 120, 20)),
      new MockSpanElement("ghijkl", createRect(100, 160, 120, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(220, 170),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 135),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBe(12);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(120, 135),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBeGreaterThanOrEqual(6);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 115),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBeLessThan(12);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 135),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBe(6);
  });

  it("keeps blank-space horizontal movement attached to the last line reached deep into a drag", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 1000));
    const page = new MockContainer(createRect(0, 0, 500, 900), [
      new MockSpanElement("line1__", createRect(100, 100, 120, 20)),
      new MockSpanElement("line2__", createRect(100, 160, 120, 20)),
      new MockSpanElement("line3__", createRect(100, 220, 120, 20)),
      new MockSpanElement("line4__", createRect(100, 280, 120, 20)),
      new MockSpanElement("line5__", createRect(100, 340, 120, 20)),
      new MockSpanElement("line6__", createRect(100, 400, 120, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(150, 110),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(150, 170),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(150, 230),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(150, 290),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(150, 350),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 390),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBe(35);
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 3,
        endOffset: 35,
      },
    ]);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(120, 390),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBe(29);
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 3,
        endOffset: 29,
      },
    ]);
  });

  it("keeps wrapped-line gap movement attached to the most recent visual line", () => {
    const viewer = new MockContainer(createRect(0, 0, 900, 800));
    const page = new MockContainer(createRect(0, 0, 700, 700), [
      new MockSpanElement("Internet access provided by ", createRect(140, 120, 260, 20)),
      new MockSpanElement("the company should be used", createRect(140, 136, 280, 20)),
      new MockSpanElement("for work-related purposes.", createRect(140, 152, 250, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(190, 130),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 146),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(410, 144),
    );

    expect(manager.getState().focus?.textPosition?.charOffset).toBeGreaterThanOrEqual(40);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(300, 144),
    );

    const state = manager.getState();
    expect(state.focus?.textPosition?.charOffset).toBeGreaterThanOrEqual(26);
    expect(state.focus?.textPosition?.charOffset).toBeLessThan(53);
    expect(state.pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 5,
        endOffset: state.focus?.textPosition?.charOffset,
      },
    ]);
  });

  it("clears an existing selection as soon as a new drag starts", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("abcdef", createRect(100, 100, 120, 20)),
      new MockSpanElement("ghijkl", createRect(100, 160, 120, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (globalThis as Record<string, unknown>).window = {
      getSelection: () => null,
    };

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(120, 110),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(220, 110),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseUp(
      createMouseEvent(220, 110),
    );

    expect(manager.hasSelection()).toBe(true);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(120, 170),
    );

    expect(manager.getSelectedText()).toBe("");
    expect(manager.getState().pageRanges).toEqual([]);
    expect(manager.getState().anchor?.point.textPosition?.charOffset).toBe(7);
  });

  it("clears the selection when clicking empty space", () => {
    const manager = new TextSelectionManager({
      container: new MockContainer(createRect(0, 0, 800, 800)) as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(
      0,
      new MockContainer(createRect(0, 0, 500, 500), [
        new MockSpanElement("abcdef", createRect(300, 260, 120, 20)),
      ]) as unknown as HTMLElement,
    );

    const clearSelection = vi.spyOn(manager, "clearSelection").mockImplementation(() => {});

    (manager as any).handleMouseDown(createMouseEvent(250, 270));

    expect(clearSelection).toHaveBeenCalledOnce();
  });

  it("hides the custom overlay once a native DOM selection is created", () => {
    const manager = new TextSelectionManager({
      container: new MockContainer(createRect(0, 0, 800, 800)) as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    const selection = {
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    };
    const domRange = {
      setStart: vi.fn(),
      setEnd: vi.fn(),
    };

    (globalThis as Record<string, unknown>).window = {
      getSelection: () => selection,
    };
    (globalThis as Record<string, unknown>).document = {
      createRange: () => domRange,
    };

    (manager as any).renderer = {
      deactivate: vi.fn(),
    };
    (manager as any).state.pageRanges = [{ pageIndex: 0, startOffset: 2, endOffset: 9 }];
    (manager as any).collectTextLayers = () => [
      {
        pageIndex: 0,
        isVisible: true,
        fullText: "abcdefghij",
        container: new MockContainer(createRect(0, 0, 500, 500)) as unknown as HTMLElement,
        spans: [
          {
            element: new MockSpanElement(
              "abcde",
              createRect(0, 0, 50, 10),
            ) as unknown as HTMLElement,
            text: "abcde",
            startOffset: 0,
            endOffset: 5,
            bounds: createRect(0, 0, 50, 10),
            pageIndex: 0,
          },
          {
            element: new MockSpanElement(
              "fghij",
              createRect(50, 0, 50, 10),
            ) as unknown as HTMLElement,
            text: "fghij",
            startOffset: 5,
            endOffset: 10,
            bounds: createRect(50, 0, 50, 10),
            pageIndex: 0,
          },
        ],
      },
    ];

    (manager as any).applyFinalSelection();

    expect(selection.removeAllRanges).toHaveBeenCalledOnce();
    expect(selection.addRange).toHaveBeenCalledOnce();
    expect(domRange.setStart).toHaveBeenCalledOnce();
    expect(domRange.setEnd).toHaveBeenCalledOnce();
    expect((manager as any).renderer.deactivate).toHaveBeenCalledOnce();
  });
});

describe("TextSelectionManager multi-click selection", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
  });

  it("double-click selects the current word", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("Alpha beta gamma", createRect(100, 100, 160, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(175, 110, 2),
    );

    expect(manager.getSelectedText()).toBe("beta");
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 6,
        endOffset: 10,
      },
    ]);
  });

  it("double-click drag expands selection word by word", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("Alpha beta gamma", createRect(100, 100, 160, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(175, 110, 2),
    );
    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(250, 110),
    );

    expect(manager.getSelectedText()).toBe("beta gamma");
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 6,
        endOffset: 16,
      },
    ]);
  });

  it("triple-click selects the current line and extends by full lines while dragging", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("Alpha beta", createRect(100, 100, 100, 20)),
      new MockSpanElement("Gamma delta", createRect(100, 140, 110, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(150, 110, 3),
    );

    expect(manager.getSelectedText()).toBe("Alpha beta");
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 0,
        endOffset: 10,
      },
    ]);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseMove(
      createMouseEvent(180, 150),
    );

    expect(manager.getSelectedText()).toBe("Alpha betaGamma delta");
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 0,
        endOffset: 21,
      },
    ]);
  });

  it("four clicks select the current paragraph block", () => {
    const viewer = new MockContainer(createRect(0, 0, 800, 800));
    const page = new MockContainer(createRect(0, 0, 500, 500), [
      new MockSpanElement("Alpha beta ", createRect(100, 100, 110, 20)),
      new MockSpanElement("Gamma delta", createRect(100, 130, 110, 20)),
      new MockSpanElement("Heading", createRect(100, 250, 70, 20)),
    ]);

    const manager = new TextSelectionManager({
      container: viewer as unknown as HTMLElement,
      preventDefaultSelection: false,
      useCustomRendering: false,
    });

    manager.registerTextLayer(0, page as unknown as HTMLElement);

    (manager as unknown as Record<string, (event: MouseEvent) => void>).handleMouseDown(
      createMouseEvent(160, 140, 4),
    );

    expect(manager.getSelectedText()).toBe("Alpha beta Gamma delta");
    expect(manager.getState().pageRanges).toEqual([
      {
        pageIndex: 0,
        startOffset: 0,
        endOffset: 22,
      },
    ]);
  });
});
