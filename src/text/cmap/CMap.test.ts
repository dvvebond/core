import { describe, expect, it } from "vitest";

import { CMap, parseCMapData, parseCMapText } from "./CMap";

/**
 * Helper to create a CMap stream for testing.
 */
function makeCMapStream(content: string): Uint8Array {
  const cmap = `%!PS-Adobe-3.0 Resource-CMap
%%DocumentNeededResources: ProcSet (CIDInit)
%%IncludeResource: ProcSet (CIDInit)
%%BeginResource: CMap (TestCMap)
%%Title: (TestCMap)
%%Version: 1
%%EndComments

/CIDInit /ProcSet findresource begin

12 dict begin

begincmap

/CIDSystemInfo 3 dict dup begin
  /Registry (Test) def
  /Ordering (Test) def
  /Supplement 0 def
end def

/CMapName /TestCMap def
/CMapType 1 def

${content}

endcmap
CMapName currentdict /CMap defineresource pop
end
end

%%EndResource
%%EOF`;

  return new TextEncoder().encode(cmap);
}

describe("CMap", () => {
  describe("Identity-H", () => {
    it("should create horizontal identity CMap", () => {
      const cmap = CMap.identityH();

      expect(cmap.name).toBe("Identity-H");
      expect(cmap.type).toBe("identity");
      expect(cmap.writingMode).toBe("horizontal");
    });

    it("should decode codes as-is for identity mapping", () => {
      const cmap = CMap.identityH();

      expect(cmap.decodeToUnicode(0x0041)).toBe("A");
      expect(cmap.decodeToUnicode(0x4e00)).toBe("一");
      expect(cmap.decodeToUnicode(0x0000)).toBe("\0");
    });

    it("should return CID equal to code for identity mapping", () => {
      const cmap = CMap.identityH();

      expect(cmap.decodeToCID(0)).toBe(0);
      expect(cmap.decodeToCID(100)).toBe(100);
      expect(cmap.decodeToCID(0xffff)).toBe(0xffff);
    });

    it("should read 2-byte character codes", () => {
      const cmap = CMap.identityH();
      const bytes = new Uint8Array([0x00, 0x41, 0x00, 0x42]);

      const first = cmap.readCharCode(bytes, 0);
      expect(first.code).toBe(0x0041);
      expect(first.length).toBe(2);

      const second = cmap.readCharCode(bytes, 2);
      expect(second.code).toBe(0x0042);
      expect(second.length).toBe(2);
    });

    it("should decode string from bytes", () => {
      const cmap = CMap.identityH();
      const bytes = new Uint8Array([0x00, 0x48, 0x00, 0x69]); // "Hi"

      expect(cmap.decodeString(bytes)).toBe("Hi");
    });
  });

  describe("Identity-V", () => {
    it("should create vertical identity CMap", () => {
      const cmap = CMap.identityV();

      expect(cmap.name).toBe("Identity-V");
      expect(cmap.type).toBe("identity");
      expect(cmap.writingMode).toBe("vertical");
    });
  });

  describe("Custom CMap", () => {
    it("should handle direct character mappings", () => {
      const cmap = new CMap({
        name: "TestCMap",
        type: "embedded",
        charMappings: [
          { code: 0x01, unicode: "A" },
          { code: 0x02, unicode: "B" },
          { code: 0x03, unicode: "C" },
        ],
      });

      expect(cmap.decodeToUnicode(0x01)).toBe("A");
      expect(cmap.decodeToUnicode(0x02)).toBe("B");
      expect(cmap.decodeToUnicode(0x03)).toBe("C");
      expect(cmap.decodeToUnicode(0x04)).toBeUndefined();
    });

    it("should handle range character mappings", () => {
      const cmap = new CMap({
        name: "TestCMap",
        type: "embedded",
        rangeMappings: [{ start: 0x10, end: 0x1f, baseUnicode: "A" }],
      });

      expect(cmap.decodeToUnicode(0x10)).toBe("A");
      expect(cmap.decodeToUnicode(0x11)).toBe("B");
      expect(cmap.decodeToUnicode(0x1f)).toBe("P");
      expect(cmap.decodeToUnicode(0x20)).toBeUndefined();
    });

    it("should handle CID mappings", () => {
      const cmap = new CMap({
        name: "TestCMap",
        type: "embedded",
        cidCharMappings: [
          { code: 0x0001, cid: 100 },
          { code: 0x0002, cid: 200 },
        ],
        cidRangeMappings: [{ start: 0x0100, end: 0x01ff, baseCID: 1000 }],
      });

      expect(cmap.decodeToCID(0x0001)).toBe(100);
      expect(cmap.decodeToCID(0x0002)).toBe(200);
      expect(cmap.decodeToCID(0x0100)).toBe(1000);
      expect(cmap.decodeToCID(0x0101)).toBe(1001);
      expect(cmap.decodeToCID(0x0003)).toBe(0); // Not mapped
    });

    it("should validate codes against codespace", () => {
      const cmap = new CMap({
        name: "TestCMap",
        type: "embedded",
        codespaceRanges: [
          { low: 0x00, high: 0x7f, numBytes: 1 },
          { low: 0x8000, high: 0xffff, numBytes: 2 },
        ],
      });

      expect(cmap.isValidCode(0x00)).toBe(true);
      expect(cmap.isValidCode(0x7f)).toBe(true);
      expect(cmap.isValidCode(0x80)).toBe(false);
      expect(cmap.isValidCode(0x8000)).toBe(true);
      expect(cmap.isValidCode(0xffff)).toBe(true);
    });

    it("should read multi-byte character codes", () => {
      const cmap = new CMap({
        name: "TestCMap",
        type: "embedded",
        codespaceRanges: [
          { low: 0x00, high: 0x7f, numBytes: 1 },
          { low: 0x8000, high: 0xffff, numBytes: 2 },
        ],
      });

      // Single byte
      const bytes1 = new Uint8Array([0x41]);
      expect(cmap.readCharCode(bytes1, 0)).toEqual({ code: 0x41, length: 1 });

      // Two bytes
      const bytes2 = new Uint8Array([0x80, 0x00]);
      expect(cmap.readCharCode(bytes2, 0)).toEqual({ code: 0x8000, length: 2 });
    });
  });
});

describe("parseCMapData", () => {
  describe("codespace ranges", () => {
    it("should parse single codespace range", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
`);

      const cmap = parseCMapData(data);
      const ranges = cmap.getCodespaceRanges();

      expect(ranges.length).toBe(1);
      expect(ranges[0].low).toBe(0x0000);
      expect(ranges[0].high).toBe(0xffff);
      expect(ranges[0].numBytes).toBe(2);
    });

    it("should parse multiple codespace ranges", () => {
      const data = makeCMapStream(`
2 begincodespacerange
<00> <7F>
<8000> <FFFF>
endcodespacerange
`);

      const cmap = parseCMapData(data);
      const ranges = cmap.getCodespaceRanges();

      expect(ranges.length).toBe(2);
      expect(ranges[0].numBytes).toBe(1);
      expect(ranges[1].numBytes).toBe(2);
    });
  });

  describe("bfchar mappings", () => {
    it("should parse bfchar entries", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
3 beginbfchar
<0001> <0041>
<0002> <0042>
<0003> <0043>
endbfchar
`);

      const cmap = parseCMapData(data);

      expect(cmap.decodeToUnicode(0x0001)).toBe("A");
      expect(cmap.decodeToUnicode(0x0002)).toBe("B");
      expect(cmap.decodeToUnicode(0x0003)).toBe("C");
    });

    it("should parse multi-byte Unicode values", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfchar
<0001> <4E00>
endbfchar
`);

      const cmap = parseCMapData(data);

      expect(cmap.decodeToUnicode(0x0001)).toBe("一"); // CJK character
    });
  });

  describe("bfrange mappings", () => {
    it("should parse bfrange with base Unicode", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfrange
<0001> <0003> <0041>
endbfrange
`);

      const cmap = parseCMapData(data);

      expect(cmap.decodeToUnicode(0x0001)).toBe("A");
      expect(cmap.decodeToUnicode(0x0002)).toBe("B");
      expect(cmap.decodeToUnicode(0x0003)).toBe("C");
    });

    it("should parse bfrange with array", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfrange
<0001> <0003> [<0058> <0059> <005A>]
endbfrange
`);

      const cmap = parseCMapData(data);

      expect(cmap.decodeToUnicode(0x0001)).toBe("X");
      expect(cmap.decodeToUnicode(0x0002)).toBe("Y");
      expect(cmap.decodeToUnicode(0x0003)).toBe("Z");
    });
  });

  describe("cidchar mappings", () => {
    it("should parse cidchar entries", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
3 begincidchar
<0001> 100
<0002> 200
<0003> 300
endcidchar
`);

      const cmap = parseCMapData(data);

      expect(cmap.decodeToCID(0x0001)).toBe(100);
      expect(cmap.decodeToCID(0x0002)).toBe(200);
      expect(cmap.decodeToCID(0x0003)).toBe(300);
    });
  });

  describe("cidrange mappings", () => {
    it("should parse cidrange entries", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 begincidrange
<0100> <01FF> 1000
endcidrange
`);

      const cmap = parseCMapData(data);

      expect(cmap.decodeToCID(0x0100)).toBe(1000);
      expect(cmap.decodeToCID(0x0101)).toBe(1001);
      expect(cmap.decodeToCID(0x01ff)).toBe(1255);
    });
  });

  describe("CMap metadata", () => {
    it("should parse CMap name", () => {
      const data = makeCMapStream("");
      const cmap = parseCMapData(data);

      expect(cmap.name).toBe("TestCMap");
    });

    it("should use provided name as fallback", () => {
      const data = new TextEncoder().encode("begincmap endcmap");
      const cmap = parseCMapData(data, "FallbackName");

      expect(cmap.name).toBe("FallbackName");
    });

    it("should parse WMode for vertical writing", () => {
      const data = makeCMapStream("/WMode 1 def");
      const cmap = parseCMapData(data);

      expect(cmap.writingMode).toBe("vertical");
    });

    it("should parse CIDSystemInfo", () => {
      const text = `
/CIDSystemInfo 3 dict dup begin
  /Registry (Adobe) def
  /Ordering (Japan1) def
  /Supplement 6 def
end def
begincmap endcmap
`;
      const cmap = parseCMapText(text);

      expect(cmap.cidSystemInfo).toEqual({
        registry: "Adobe",
        ordering: "Japan1",
        supplement: 6,
      });
    });
  });
});

describe("CMap string decoding", () => {
  it("should decode CJK characters", () => {
    const cmap = new CMap({
      name: "CJKTest",
      type: "embedded",
      codespaceRanges: [{ low: 0x0000, high: 0xffff, numBytes: 2 }],
      charMappings: [
        { code: 0x0001, unicode: "中" },
        { code: 0x0002, unicode: "文" },
        { code: 0x0003, unicode: "字" },
      ],
    });

    const bytes = new Uint8Array([0x00, 0x01, 0x00, 0x02, 0x00, 0x03]);
    expect(cmap.decodeString(bytes)).toBe("中文字");
  });

  it("should handle mixed width encodings", () => {
    const cmap = new CMap({
      name: "MixedTest",
      type: "embedded",
      codespaceRanges: [
        { low: 0x00, high: 0x7f, numBytes: 1 },
        { low: 0x8000, high: 0xffff, numBytes: 2 },
      ],
      charMappings: [
        { code: 0x41, unicode: "A" },
        { code: 0x8001, unicode: "日" },
        { code: 0x42, unicode: "B" },
      ],
    });

    // A (1 byte) + 日 (2 bytes) + B (1 byte)
    const bytes = new Uint8Array([0x41, 0x80, 0x01, 0x42]);
    expect(cmap.decodeString(bytes)).toBe("A日B");
  });
});
