import { describe, expect, it, beforeEach } from "vitest";

import {
  LegacyCMapSupport,
  createLegacyCMapSupport,
  createLegacyEncodingCMap,
  decodeLegacyByte,
  decodeLegacyBytes,
  glyphNameToUnicode,
  type LegacyEncodingType,
} from "./LegacyCMapSupport";

describe("glyphNameToUnicode", () => {
  describe("standard glyph names", () => {
    it("should map basic ASCII glyphs", () => {
      expect(glyphNameToUnicode("A")).toBe(0x0041);
      expect(glyphNameToUnicode("a")).toBe(0x0061);
      expect(glyphNameToUnicode("zero")).toBe(0x0030);
      expect(glyphNameToUnicode("space")).toBe(0x0020);
    });

    it("should map punctuation glyphs", () => {
      expect(glyphNameToUnicode("period")).toBe(0x002e);
      expect(glyphNameToUnicode("comma")).toBe(0x002c);
      expect(glyphNameToUnicode("semicolon")).toBe(0x003b);
      expect(glyphNameToUnicode("colon")).toBe(0x003a);
    });

    it("should map Latin extended glyphs", () => {
      expect(glyphNameToUnicode("Agrave")).toBe(0x00c0);
      expect(glyphNameToUnicode("eacute")).toBe(0x00e9);
      expect(glyphNameToUnicode("ntilde")).toBe(0x00f1);
      expect(glyphNameToUnicode("germandbls")).toBe(0x00df);
    });

    it("should map typographic glyphs", () => {
      expect(glyphNameToUnicode("endash")).toBe(0x2013);
      expect(glyphNameToUnicode("emdash")).toBe(0x2014);
      expect(glyphNameToUnicode("bullet")).toBe(0x2022);
      expect(glyphNameToUnicode("ellipsis")).toBe(0x2026);
    });

    it("should map ligatures", () => {
      expect(glyphNameToUnicode("fi")).toBe(0xfb01);
      expect(glyphNameToUnicode("fl")).toBe(0xfb02);
    });

    it("should map currency symbols", () => {
      expect(glyphNameToUnicode("Euro")).toBe(0x20ac);
      expect(glyphNameToUnicode("yen")).toBe(0x00a5);
      expect(glyphNameToUnicode("sterling")).toBe(0x00a3);
    });
  });

  describe("uniXXXX format", () => {
    it("should parse uni prefix format", () => {
      expect(glyphNameToUnicode("uni0041")).toBe(0x0041);
      expect(glyphNameToUnicode("uni4E00")).toBe(0x4e00);
      expect(glyphNameToUnicode("uniFFFF")).toBe(0xffff);
    });
  });

  describe("uXXXX format", () => {
    it("should parse u prefix format", () => {
      expect(glyphNameToUnicode("u0041")).toBe(0x0041);
      expect(glyphNameToUnicode("u4E00")).toBe(0x4e00);
    });

    it("should parse 5-digit u format", () => {
      expect(glyphNameToUnicode("u1F600")).toBe(0x1f600);
    });
  });

  describe("unknown glyphs", () => {
    it("should return undefined for unknown glyphs", () => {
      expect(glyphNameToUnicode("unknownglyph")).toBeUndefined();
      expect(glyphNameToUnicode("notavalidname")).toBeUndefined();
    });
  });
});

describe("decodeLegacyByte", () => {
  describe("WinAnsiEncoding", () => {
    it("should decode ASCII characters", () => {
      expect(decodeLegacyByte(0x41, "WinAnsiEncoding")).toBe("A");
      expect(decodeLegacyByte(0x61, "WinAnsiEncoding")).toBe("a");
      expect(decodeLegacyByte(0x20, "WinAnsiEncoding")).toBe(" ");
    });

    it("should decode extended characters", () => {
      expect(decodeLegacyByte(0x80, "WinAnsiEncoding")).toBe("\u20ac"); // €
      expect(decodeLegacyByte(0x93, "WinAnsiEncoding")).toBe("\u201c"); // "
      expect(decodeLegacyByte(0x94, "WinAnsiEncoding")).toBe("\u201d"); // "
    });

    it("should decode Latin-1 characters", () => {
      expect(decodeLegacyByte(0xe9, "WinAnsiEncoding")).toBe("é");
      expect(decodeLegacyByte(0xf1, "WinAnsiEncoding")).toBe("ñ");
      expect(decodeLegacyByte(0xfc, "WinAnsiEncoding")).toBe("ü");
    });
  });

  describe("MacRomanEncoding", () => {
    it("should decode Mac-specific characters", () => {
      expect(decodeLegacyByte(0x80, "MacRomanEncoding")).toBe("Ä");
      expect(decodeLegacyByte(0x81, "MacRomanEncoding")).toBe("Å");
      expect(decodeLegacyByte(0xa0, "MacRomanEncoding")).toBe("†");
    });
  });

  describe("StandardEncoding", () => {
    it("should decode standard encoding characters", () => {
      expect(decodeLegacyByte(0x41, "StandardEncoding")).toBe("A");
      expect(decodeLegacyByte(0x27, "StandardEncoding")).toBe("\u2019"); // quoteright
    });
  });

  describe("PDFDocEncoding", () => {
    it("should decode PDF document encoding", () => {
      expect(decodeLegacyByte(0x41, "PDFDocEncoding")).toBe("A");
      expect(decodeLegacyByte(0xa0, "PDFDocEncoding")).toBe("€");
    });
  });
});

describe("decodeLegacyBytes", () => {
  it("should decode multiple bytes", () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    expect(decodeLegacyBytes(bytes, "WinAnsiEncoding")).toBe("Hello");
  });

  it("should handle extended characters", () => {
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]); // "café"
    expect(decodeLegacyBytes(bytes, "WinAnsiEncoding")).toBe("café");
  });

  it("should skip undefined mappings", () => {
    const bytes = new Uint8Array([0x41, 0x00, 0x42]); // A, null, B
    // Null (0x00) is undefined in WinAnsiEncoding
    expect(decodeLegacyBytes(bytes, "WinAnsiEncoding")).toBe("AB");
  });
});

describe("createLegacyEncodingCMap", () => {
  describe("base encodings", () => {
    it("should create WinAnsiEncoding CMap", () => {
      const cmap = createLegacyEncodingCMap({ baseEncoding: "WinAnsiEncoding" });

      expect(cmap.name).toBe("WinAnsiEncoding");
      expect(cmap.decodeToUnicode(0x41)).toBe("A");
      expect(cmap.decodeToUnicode(0x80)).toBe("€");
    });

    it("should create MacRomanEncoding CMap", () => {
      const cmap = createLegacyEncodingCMap({ baseEncoding: "MacRomanEncoding" });

      expect(cmap.name).toBe("MacRomanEncoding");
      expect(cmap.decodeToUnicode(0x41)).toBe("A");
      expect(cmap.decodeToUnicode(0x80)).toBe("Ä");
    });

    it("should create StandardEncoding CMap", () => {
      const cmap = createLegacyEncodingCMap({ baseEncoding: "StandardEncoding" });

      expect(cmap.name).toBe("StandardEncoding");
    });

    it("should create PDFDocEncoding CMap", () => {
      const cmap = createLegacyEncodingCMap({ baseEncoding: "PDFDocEncoding" });

      expect(cmap.name).toBe("PDFDocEncoding");
    });
  });

  describe("with differences", () => {
    it("should apply differences to base encoding", () => {
      const cmap = createLegacyEncodingCMap({
        baseEncoding: "WinAnsiEncoding",
        differences: [0x41, "B", "C", "D"], // Replace A, B, C with B, C, D
        name: "CustomEncoding",
      });

      expect(cmap.name).toBe("CustomEncoding");
      expect(cmap.decodeToUnicode(0x41)).toBe("B");
      expect(cmap.decodeToUnicode(0x42)).toBe("C");
      expect(cmap.decodeToUnicode(0x43)).toBe("D");
    });

    it("should handle multiple difference ranges", () => {
      const cmap = createLegacyEncodingCMap({
        baseEncoding: "WinAnsiEncoding",
        differences: [
          0x41,
          "X", // A -> X
          0x61,
          "Y",
          "Z", // a -> Y, b -> Z
        ],
      });

      expect(cmap.decodeToUnicode(0x41)).toBe("X");
      expect(cmap.decodeToUnicode(0x61)).toBe("Y");
      expect(cmap.decodeToUnicode(0x62)).toBe("Z");
    });

    it("should handle glyph names in differences", () => {
      const cmap = createLegacyEncodingCMap({
        baseEncoding: "WinAnsiEncoding",
        differences: [0x41, "Agrave", "Aacute"],
      });

      expect(cmap.decodeToUnicode(0x41)).toBe("À");
      expect(cmap.decodeToUnicode(0x42)).toBe("Á");
    });

    it("should handle uni format in differences", () => {
      const cmap = createLegacyEncodingCMap({
        baseEncoding: "WinAnsiEncoding",
        differences: [0x41, "uni4E00"],
      });

      expect(cmap.decodeToUnicode(0x41)).toBe("一");
    });
  });
});

describe("LegacyCMapSupport", () => {
  let support: LegacyCMapSupport;

  beforeEach(() => {
    support = new LegacyCMapSupport();
  });

  describe("getEncodingCMap", () => {
    it("should return CMap for WinAnsiEncoding", () => {
      const cmap = support.getEncodingCMap("WinAnsiEncoding");

      expect(cmap.decodeToUnicode(0x41)).toBe("A");
    });

    it("should cache encoding CMaps", () => {
      const cmap1 = support.getEncodingCMap("WinAnsiEncoding");
      const cmap2 = support.getEncodingCMap("WinAnsiEncoding");

      expect(cmap1).toBe(cmap2);
    });

    it("should return different CMaps for different encodings", () => {
      const winAnsi = support.getEncodingCMap("WinAnsiEncoding");
      const macRoman = support.getEncodingCMap("MacRomanEncoding");

      expect(winAnsi).not.toBe(macRoman);
      expect(winAnsi.decodeToUnicode(0x80)).toBe("€");
      expect(macRoman.decodeToUnicode(0x80)).toBe("Ä");
    });
  });

  describe("createCustomEncoding", () => {
    it("should create custom encoding with differences", () => {
      const cmap = support.createCustomEncoding({
        baseEncoding: "WinAnsiEncoding",
        differences: [0x41, "bullet"],
      });

      expect(cmap.decodeToUnicode(0x41)).toBe("•");
    });
  });

  describe("glyphToUnicode", () => {
    it("should convert glyph names to Unicode", () => {
      expect(support.glyphToUnicode("A")).toBe(0x0041);
      expect(support.glyphToUnicode("bullet")).toBe(0x2022);
    });
  });

  describe("decode", () => {
    it("should decode bytes using specified encoding", () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(support.decode(bytes, "WinAnsiEncoding")).toBe("Hello");
    });
  });

  describe("isSupported", () => {
    it("should return true for supported encodings", () => {
      expect(support.isSupported("WinAnsiEncoding")).toBe(true);
      expect(support.isSupported("MacRomanEncoding")).toBe(true);
      expect(support.isSupported("StandardEncoding")).toBe(true);
      expect(support.isSupported("PDFDocEncoding")).toBe(true);
      expect(support.isSupported("MacExpertEncoding")).toBe(true);
      expect(support.isSupported("custom")).toBe(true);
    });

    it("should return false for unsupported encodings", () => {
      expect(support.isSupported("UnknownEncoding")).toBe(false);
    });
  });

  describe("clearCache", () => {
    it("should clear cached CMaps", () => {
      const cmap1 = support.getEncodingCMap("WinAnsiEncoding");
      support.clearCache();
      const cmap2 = support.getEncodingCMap("WinAnsiEncoding");

      expect(cmap1).not.toBe(cmap2);
    });
  });
});

describe("createLegacyCMapSupport", () => {
  it("should create a new instance", () => {
    const support = createLegacyCMapSupport();

    expect(support).toBeInstanceOf(LegacyCMapSupport);
  });
});

describe("Legacy encoding integration", () => {
  it("should decode mixed content correctly", () => {
    const cmap = createLegacyEncodingCMap({ baseEncoding: "WinAnsiEncoding" });

    // Test a string with ASCII and extended characters
    const bytes = new Uint8Array([
      0x52,
      0xe9,
      0x73,
      0x75,
      0x6d,
      0xe9, // "Résumé"
    ]);

    expect(cmap.decodeString(bytes)).toBe("Résumé");
  });

  it("should handle typographic quotes", () => {
    const cmap = createLegacyEncodingCMap({ baseEncoding: "WinAnsiEncoding" });

    const bytes = new Uint8Array([
      0x93, // "
      0x48,
      0x65,
      0x6c,
      0x6c,
      0x6f, // Hello
      0x94, // "
    ]);

    expect(cmap.decodeString(bytes)).toBe("\u201cHello\u201d");
  });
});
