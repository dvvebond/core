import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getTextContentMock, createTextSelectionManagerMock, getAttachedTextSelectionManagerMock } =
  vi.hoisted(() => ({
    getTextContentMock: vi.fn(),
    createTextSelectionManagerMock: vi.fn(),
    getAttachedTextSelectionManagerMock: vi.fn(),
  }));

vi.mock("./pdfjs-wrapper", () => ({
  getTextContent: getTextContentMock,
  isTextItem: (item: { str?: string }) => typeof item?.str === "string",
}));

vi.mock("../../frontend/text/text-selection-manager", () => ({
  createTextSelectionManager: createTextSelectionManagerMock,
  getAttachedTextSelectionManager: getAttachedTextSelectionManagerMock,
}));

import { buildPDFJSTextLayer } from "./pdfjs-text-layer";

function createRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
}

class MockElement {
  style: Record<string, string> = {};
  className = "";
  textContent = "";
  parentElement: MockElement | null = null;
  firstChild: MockElement | null = null;
  readonly children: MockElement[] = [];
  private readonly attributes = new Map<string, string>();

  constructor(private readonly tagName: string) {}

  appendChild(child: MockElement): MockElement {
    child.parentElement = this;
    this.children.push(child);
    this.firstChild = this.children[0] ?? null;
    return child;
  }

  removeChild(child: MockElement): MockElement {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parentElement = null;
    this.firstChild = this.children[0] ?? null;
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  getBoundingClientRect(): DOMRect {
    return createRect(Math.max(1, this.textContent.length * 10), 20);
  }

  closest(selector: string): MockElement | null {
    const selectors = selector.split(",").map(part => part.trim());
    return this.findClosest(selectors);
  }

  private matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.className.split(/\s+/).includes(selector.slice(1));
    }

    const attributeMatch = selector.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
    if (!attributeMatch) {
      return false;
    }

    const [, attributeName, attributeValue] = attributeMatch;
    const currentValue = this.attributes.get(attributeName);
    if (attributeValue === undefined) {
      return currentValue !== undefined;
    }

    return currentValue === attributeValue;
  }

  private findClosest(selectors: string[]): MockElement | null {
    if (selectors.some(entry => this.matches(entry))) {
      return this;
    }

    return this.parentElement?.findClosest(selectors) ?? null;
  }
}

function createMockDocument(): {
  body: MockElement;
  createElement: (tagName: string) => MockElement;
} {
  return {
    body: new MockElement("body"),
    createElement: (tagName: string) => new MockElement(tagName),
  };
}

describe("buildPDFJSTextLayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getTextContentMock.mockResolvedValue({
      items: [
        {
          str: "Hello world",
          width: 110,
          fontName: "Helvetica",
          transform: [1, 0, 0, 1, 10, 20],
        },
      ],
    });

    (globalThis as Record<string, unknown>).document = createMockDocument();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).document;
    vi.useRealTimers();
  });

  it("auto-registers built text layers with a shared selection manager for react-pdf roots", async () => {
    const manager = {
      enable: vi.fn(),
      registerTextLayer: vi.fn(),
    };

    getAttachedTextSelectionManagerMock.mockReturnValue(null);
    createTextSelectionManagerMock.mockReturnValue(manager);

    const documentRoot = new MockElement("div");
    documentRoot.className = "react-pdf__Document";
    const pageRoot = new MockElement("div");
    pageRoot.setAttribute("data-page-number", "3");
    const textLayer = new MockElement("div");

    (document as unknown as { body: MockElement }).body.appendChild(documentRoot);
    documentRoot.appendChild(pageRoot);
    pageRoot.appendChild(textLayer);

    await buildPDFJSTextLayer({} as never, {
      container: textLayer as unknown as HTMLElement,
      viewport: {
        scale: 1,
        convertToViewportPoint: (x: number, y: number) => [x, y],
      } as never,
    });

    expect(createTextSelectionManagerMock).toHaveBeenCalledWith({
      container: documentRoot,
    });
    expect(manager.enable).toHaveBeenCalledOnce();
    expect(manager.registerTextLayer).toHaveBeenCalledWith(2, textLayer);
  });

  it("reuses an attached selection manager when one already exists on the root", async () => {
    const attachedManager = {
      registerTextLayer: vi.fn(),
    };

    getAttachedTextSelectionManagerMock.mockReturnValue(attachedManager);

    const documentRoot = new MockElement("div");
    documentRoot.className = "react-pdf__Document";
    const pageRoot = new MockElement("div");
    pageRoot.setAttribute("data-page-number", "1");
    const textLayer = new MockElement("div");

    (document as unknown as { body: MockElement }).body.appendChild(documentRoot);
    documentRoot.appendChild(pageRoot);
    pageRoot.appendChild(textLayer);

    await buildPDFJSTextLayer({} as never, {
      container: textLayer as unknown as HTMLElement,
      viewport: {
        scale: 1,
        convertToViewportPoint: (x: number, y: number) => [x, y],
      } as never,
    });

    expect(createTextSelectionManagerMock).not.toHaveBeenCalled();
    expect(attachedManager.registerTextLayer).toHaveBeenCalledWith(0, textLayer);
  });

  it("registers after the text layer is appended later by a wrapper component", async () => {
    vi.useFakeTimers();

    const manager = {
      enable: vi.fn(),
      registerTextLayer: vi.fn(),
    };

    getAttachedTextSelectionManagerMock.mockReturnValue(null);
    createTextSelectionManagerMock.mockReturnValue(manager);

    const documentRoot = new MockElement("div");
    documentRoot.className = "react-pdf__Document";
    const pageRoot = new MockElement("div");
    pageRoot.setAttribute("data-page-number", "2");
    const textLayer = new MockElement("div");

    (document as unknown as { body: MockElement }).body.appendChild(documentRoot);
    documentRoot.appendChild(pageRoot);

    await buildPDFJSTextLayer({} as never, {
      container: textLayer as unknown as HTMLElement,
      viewport: {
        scale: 1,
        convertToViewportPoint: (x: number, y: number) => [x, y],
      } as never,
    });

    expect(manager.registerTextLayer).not.toHaveBeenCalled();

    pageRoot.appendChild(textLayer);
    await vi.runAllTimersAsync();

    expect(createTextSelectionManagerMock).toHaveBeenCalledWith({
      container: documentRoot,
    });
    expect(manager.enable).toHaveBeenCalledOnce();
    expect(manager.registerTextLayer).toHaveBeenCalledWith(1, textLayer);
  });
});
