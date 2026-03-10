import { describe, expect, it, beforeEach } from "vitest";

import {
  CJKCMapLoader,
  BundledCMapProvider,
  CMapLoadError,
  createCJKCMapLoader,
  PREDEFINED_CMAPS,
  type CMapDataProvider,
} from "./CJKCMapLoader";
import { CMap } from "./CMap";

describe("CJKCMapLoader", () => {
  let loader: CJKCMapLoader;

  beforeEach(() => {
    loader = new CJKCMapLoader();
  });

  describe("Identity CMaps", () => {
    it("should load Identity-H", async () => {
      const cmap = await loader.load("Identity-H");

      expect(cmap).not.toBeNull();
      expect(cmap?.name).toBe("Identity-H");
      expect(cmap?.type).toBe("identity");
      expect(cmap?.writingMode).toBe("horizontal");
    });

    it("should load Identity-V", async () => {
      const cmap = await loader.load("Identity-V");

      expect(cmap).not.toBeNull();
      expect(cmap?.name).toBe("Identity-V");
      expect(cmap?.writingMode).toBe("vertical");
    });

    it("should cache loaded CMaps", async () => {
      const cmap1 = await loader.load("Identity-H");
      const cmap2 = await loader.load("Identity-H");

      expect(cmap1).toBe(cmap2);
    });
  });

  describe("Predefined CMap info", () => {
    it("should return info for known predefined CMaps", () => {
      const info = loader.getInfo("UniGB-UCS2-H");

      expect(info).toBeDefined();
      expect(info?.script).toBe("simplified-chinese");
      expect(info?.cidSystemInfo.ordering).toBe("GB1");
    });

    it("should return undefined for unknown CMaps", () => {
      const info = loader.getInfo("Unknown-CMap");

      expect(info).toBeUndefined();
    });

    it("should identify predefined CMaps", () => {
      expect(loader.isPredefined("UniJIS-UCS2-H")).toBe(true);
      expect(loader.isPredefined("Identity-H")).toBe(true);
      expect(loader.isPredefined("Custom-CMap")).toBe(false);
    });
  });

  describe("CMap filtering by script", () => {
    it("should list simplified Chinese CMaps", () => {
      const cmaps = loader.getCMapsForScript("simplified-chinese");

      expect(cmaps).toContain("UniGB-UCS2-H");
      expect(cmaps).toContain("GB-EUC-H");
      expect(cmaps).not.toContain("UniJIS-UCS2-H");
    });

    it("should list Japanese CMaps", () => {
      const cmaps = loader.getCMapsForScript("japanese");

      expect(cmaps).toContain("UniJIS-UCS2-H");
      expect(cmaps).toContain("90ms-RKSJ-H");
      expect(cmaps).not.toContain("UniKS-UCS2-H");
    });

    it("should list Korean CMaps", () => {
      const cmaps = loader.getCMapsForScript("korean");

      expect(cmaps).toContain("UniKS-UCS2-H");
      expect(cmaps).toContain("KSC-EUC-H");
    });

    it("should list traditional Chinese CMaps", () => {
      const cmaps = loader.getCMapsForScript("traditional-chinese");

      expect(cmaps).toContain("UniCNS-UCS2-H");
      expect(cmaps).toContain("B5pc-H");
    });
  });

  describe("Loading with fallback", () => {
    it("should fallback to Identity-H for unknown horizontal CMaps", async () => {
      const cmap = await loader.loadWithFallback("Unknown-H");

      expect(cmap.name).toBe("Identity-H");
    });

    it("should fallback to Identity-V for known vertical CMaps", async () => {
      const cmap = await loader.loadWithFallback("UniGB-UCS2-V");

      // Without a provider, falls back to Identity-V for vertical CMaps
      expect(cmap.writingMode).toBe("vertical");
    });
  });

  describe("Cache management", () => {
    it("should report cached CMaps", async () => {
      await loader.load("Identity-H");

      expect(loader.isCached("Identity-H")).toBe(true);
      expect(loader.isCached("Unknown")).toBe(false);
    });

    it("should clear cache", async () => {
      await loader.load("Identity-H");
      loader.clearCache();

      expect(loader.isCached("Identity-H")).toBe(false);
    });
  });

  describe("Custom provider", () => {
    it("should load from custom provider", async () => {
      const testCMapData = new TextEncoder().encode(`
/CMapName /TestCMap def
begincmap
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfchar
<0001> <4E2D>
endbfchar
endcmap
`);

      const provider: CMapDataProvider = {
        load: async name => (name === "TestCMap" ? testCMapData : null),
        has: name => name === "TestCMap",
      };

      const customLoader = new CJKCMapLoader({ provider });
      const cmap = await customLoader.load("TestCMap");

      expect(cmap).not.toBeNull();
      expect(cmap?.decodeToUnicode(0x0001)).toBe("中");
    });

    it("should return null for unavailable CMaps", async () => {
      const cmap = await loader.load("UniGB-UCS2-H");

      // Without a provider, should return null
      expect(cmap).toBeNull();
    });
  });
});

describe("BundledCMapProvider", () => {
  it("should register and load bundled CMaps", async () => {
    const provider = new BundledCMapProvider();
    const testData = new TextEncoder().encode("test cmap data");

    provider.register("TestCMap", testData);

    expect(provider.has("TestCMap")).toBe(true);
    expect(await provider.load("TestCMap")).toEqual(testData);
  });

  it("should return null for unregistered CMaps", async () => {
    const provider = new BundledCMapProvider();

    expect(provider.has("Unknown")).toBe(false);
    expect(await provider.load("Unknown")).toBeNull();
  });
});

describe("createCJKCMapLoader", () => {
  it("should create a loader with default options", () => {
    const loader = createCJKCMapLoader();

    expect(loader).toBeInstanceOf(CJKCMapLoader);
  });

  it("should create a loader with custom options", () => {
    const provider = new BundledCMapProvider();
    const loader = createCJKCMapLoader({
      provider,
      timeout: 5000,
    });

    expect(loader).toBeInstanceOf(CJKCMapLoader);
  });
});

describe("PREDEFINED_CMAPS", () => {
  it("should contain all major CJK CMap families", () => {
    // Simplified Chinese
    expect(PREDEFINED_CMAPS["UniGB-UCS2-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["GB-EUC-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["GBK-EUC-H"]).toBeDefined();

    // Traditional Chinese
    expect(PREDEFINED_CMAPS["UniCNS-UCS2-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["B5pc-H"]).toBeDefined();

    // Japanese
    expect(PREDEFINED_CMAPS["UniJIS-UCS2-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["90ms-RKSJ-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["EUC-H"]).toBeDefined();

    // Korean
    expect(PREDEFINED_CMAPS["UniKS-UCS2-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["KSC-EUC-H"]).toBeDefined();

    // Identity
    expect(PREDEFINED_CMAPS["Identity-H"]).toBeDefined();
    expect(PREDEFINED_CMAPS["Identity-V"]).toBeDefined();
  });

  it("should have correct CID system info", () => {
    expect(PREDEFINED_CMAPS["UniGB-UCS2-H"].cidSystemInfo.ordering).toBe("GB1");
    expect(PREDEFINED_CMAPS["UniJIS-UCS2-H"].cidSystemInfo.ordering).toBe("Japan1");
    expect(PREDEFINED_CMAPS["UniKS-UCS2-H"].cidSystemInfo.ordering).toBe("Korea1");
    expect(PREDEFINED_CMAPS["UniCNS-UCS2-H"].cidSystemInfo.ordering).toBe("CNS1");
  });

  it("should distinguish vertical and horizontal CMaps", () => {
    expect(PREDEFINED_CMAPS["UniGB-UCS2-H"].writingMode).toBe("horizontal");
    expect(PREDEFINED_CMAPS["UniGB-UCS2-V"].writingMode).toBe("vertical");
  });

  it("should identify Unicode-direct CMaps", () => {
    expect(PREDEFINED_CMAPS["UniGB-UCS2-H"].toUnicode).toBe(true);
    expect(PREDEFINED_CMAPS["GB-EUC-H"].toUnicode).toBe(false);
  });
});

describe("CJKCMapLoader parseFromData", () => {
  it("should parse CMap from raw data", () => {
    const loader = new CJKCMapLoader();
    const data = new TextEncoder().encode(`
/CMapName /ParseTest def
begincmap
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfchar
<0001> <0041>
endbfchar
endcmap
`);

    const cmap = loader.parseFromData(data, "ParseTest");

    expect(cmap.name).toBe("ParseTest");
    expect(cmap.decodeToUnicode(0x0001)).toBe("A");
  });
});
