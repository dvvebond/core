import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  FontManager,
  createFontManager,
  getGlobalFontManager,
  type FontMetrics,
  type FontStyle,
} from "./FontManager";

describe("FontManager", () => {
  let fontManager: FontManager;

  beforeEach(async () => {
    fontManager = new FontManager();
    await fontManager.initialize();
  });

  afterEach(() => {
    fontManager.destroy();
  });

  describe("initialization", () => {
    it("starts uninitialized", () => {
      const fm = new FontManager();
      expect(fm.initialized).toBe(false);
    });

    it("becomes initialized after initialize()", async () => {
      const fm = new FontManager();
      await fm.initialize();
      expect(fm.initialized).toBe(true);
      fm.destroy();
    });

    it("does not re-initialize if already initialized", async () => {
      const fm = new FontManager();
      await fm.initialize();
      await fm.initialize(); // Should not throw
      expect(fm.initialized).toBe(true);
      fm.destroy();
    });
  });

  describe("getFont", () => {
    it("returns font info for Helvetica", () => {
      const font = fontManager.getFont("Helvetica");
      expect(font.family).toContain("Helvetica");
      expect(font.isStandard).toBe(true);
    });

    it("returns font info for Times-Roman", () => {
      const font = fontManager.getFont("Times-Roman");
      expect(font.family).toContain("Times");
      expect(font.isStandard).toBe(true);
    });

    it("returns font info for Courier", () => {
      const font = fontManager.getFont("Courier");
      expect(font.family).toContain("Courier");
      expect(font.isStandard).toBe(true);
    });

    it("handles font name with leading slash", () => {
      const font = fontManager.getFont("/Helvetica");
      expect(font.family).toContain("Helvetica");
    });

    it("returns sans-serif fallback for unknown fonts", () => {
      const font = fontManager.getFont("UnknownFont");
      expect(font.family).toBe("sans-serif");
      expect(font.isStandard).toBe(false);
    });

    it("caches font lookups", () => {
      const font1 = fontManager.getFont("Helvetica");
      const font2 = fontManager.getFont("Helvetica");
      expect(font1).toBe(font2);
    });
  });

  describe("getFontFamily", () => {
    it("returns font family for standard fonts", () => {
      expect(fontManager.getFontFamily("Helvetica")).toContain("Helvetica");
      expect(fontManager.getFontFamily("Times-Roman")).toContain("Times");
      expect(fontManager.getFontFamily("Courier")).toContain("Courier");
    });

    it("returns sans-serif for unknown fonts", () => {
      expect(fontManager.getFontFamily("UnknownFont")).toBe("sans-serif");
    });
  });

  describe("getFontStyle", () => {
    it("returns normal style for base fonts", () => {
      const style = fontManager.getFontStyle("Helvetica");
      expect(style.weight).toBe("normal");
      expect(style.style).toBe("normal");
    });

    it("detects bold from font name", () => {
      const style = fontManager.getFontStyle("Helvetica-Bold");
      expect(style.weight).toBe("bold");
    });

    it("detects italic from font name", () => {
      const style = fontManager.getFontStyle("Times-Italic");
      expect(style.style).toBe("italic");
    });

    it("detects oblique from font name", () => {
      const style = fontManager.getFontStyle("Helvetica-Oblique");
      expect(style.style).toBe("oblique");
    });

    it("detects bold italic from font name", () => {
      const style = fontManager.getFontStyle("Times-BoldItalic");
      expect(style.weight).toBe("bold");
      expect(style.style).toBe("italic");
    });
  });

  describe("buildFontString", () => {
    it("builds basic font string", () => {
      const fontString = fontManager.buildFontString("Helvetica", 12);
      expect(fontString).toContain("12px");
      expect(fontString).toContain("Helvetica");
    });

    it("builds font string with bold", () => {
      const fontString = fontManager.buildFontString("Helvetica-Bold", 14);
      expect(fontString).toContain("bold");
      expect(fontString).toContain("14px");
    });

    it("builds font string with italic", () => {
      const fontString = fontManager.buildFontString("Times-Italic", 16);
      expect(fontString).toContain("italic");
      expect(fontString).toContain("16px");
    });
  });

  describe("getFontMetrics", () => {
    it("returns metrics for fonts", () => {
      const metrics = fontManager.getFontMetrics("Helvetica");
      expect(metrics).toHaveProperty("ascender");
      expect(metrics).toHaveProperty("descender");
      expect(metrics).toHaveProperty("lineHeight");
      expect(metrics).toHaveProperty("avgCharWidth");
    });
  });

  describe("clearCache", () => {
    it("clears cached fonts", () => {
      const font1 = fontManager.getFont("Helvetica");
      fontManager.clearCache();
      const font2 = fontManager.getFont("Helvetica");
      // After clearing, a new object is created
      expect(font1).not.toBe(font2);
    });
  });

  describe("destroy", () => {
    it("resets initialization state", () => {
      fontManager.destroy();
      expect(fontManager.initialized).toBe(false);
    });
  });

  describe("createFontManager", () => {
    it("creates a new FontManager instance", () => {
      const fm = createFontManager();
      expect(fm).toBeInstanceOf(FontManager);
      fm.destroy();
    });
  });

  describe("getGlobalFontManager", () => {
    it("returns initialized global instance", async () => {
      const global1 = await getGlobalFontManager();
      expect(global1.initialized).toBe(true);

      const global2 = await getGlobalFontManager();
      expect(global1).toBe(global2);
    });
  });
});
