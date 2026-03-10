/**
 * CJK CMap Loader - Async loading for CJK character mapping files.
 *
 * Provides functionality to load and parse standard Adobe CMap files
 * for CJK (Chinese, Japanese, Korean) character sets. Supports:
 * - UTF-16 encodings (UTF16-H, UTF16-V)
 * - Simplified Chinese (GB-EUC-H, GBK-EUC-H, UniGB-UCS2-H, etc.)
 * - Traditional Chinese (B5pc-H, ETen-B5-H, UniCNS-UCS2-H, etc.)
 * - Japanese (90ms-RKSJ-H, EUC-H, UniJIS-UCS2-H, etc.)
 * - Korean (KSC-EUC-H, KSCms-UHC-H, UniKS-UCS2-H, etc.)
 *
 * References:
 * - Adobe CMap Resource Specification
 * - PDF Reference 1.7, Section 5.6.4
 */

import { CMap, parseCMapData, type CIDSystemInfo, type WritingMode } from "./CMap";

/**
 * Supported CJK script systems.
 */
export type CJKScript = "simplified-chinese" | "traditional-chinese" | "japanese" | "korean";

/**
 * CMap loading options.
 */
export interface CMapLoadOptions {
  /** Custom CMap data provider (for bundled/cached CMaps) */
  provider?: CMapDataProvider;
  /** Timeout in milliseconds for loading operations */
  timeout?: number;
  /** Whether to cache loaded CMaps */
  cache?: boolean;
}

/**
 * Interface for providing CMap data.
 * Implement this to provide custom CMap data sources (bundled, URL, etc.)
 */
export interface CMapDataProvider {
  /**
   * Load CMap data by name.
   * @param name - CMap name (e.g., "UniGB-UCS2-H")
   * @returns CMap data as Uint8Array, or null if not found
   */
  load(name: string): Promise<Uint8Array | null>;

  /**
   * Check if a CMap is available.
   * @param name - CMap name
   */
  has(name: string): boolean;
}

/**
 * Information about a predefined CMap.
 */
export interface PredefinedCMapInfo {
  /** CMap name */
  name: string;
  /** CJK script system */
  script: CJKScript;
  /** Writing mode */
  writingMode: WritingMode;
  /** CID system info */
  cidSystemInfo: CIDSystemInfo;
  /** Whether this CMap maps to Unicode directly */
  toUnicode: boolean;
}

/**
 * Predefined CMap definitions for CJK character sets.
 */
export const PREDEFINED_CMAPS: Record<string, PredefinedCMapInfo> = {
  // Identity CMaps
  "Identity-H": {
    name: "Identity-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Identity", supplement: 0 },
    toUnicode: true,
  },
  "Identity-V": {
    name: "Identity-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Identity", supplement: 0 },
    toUnicode: true,
  },

  // Simplified Chinese (Adobe-GB1)
  "UniGB-UCS2-H": {
    name: "UniGB-UCS2-H",
    script: "simplified-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 5 },
    toUnicode: true,
  },
  "UniGB-UCS2-V": {
    name: "UniGB-UCS2-V",
    script: "simplified-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 5 },
    toUnicode: true,
  },
  "UniGB-UTF16-H": {
    name: "UniGB-UTF16-H",
    script: "simplified-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 5 },
    toUnicode: true,
  },
  "UniGB-UTF16-V": {
    name: "UniGB-UTF16-V",
    script: "simplified-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 5 },
    toUnicode: true,
  },
  "GB-EUC-H": {
    name: "GB-EUC-H",
    script: "simplified-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 0 },
    toUnicode: false,
  },
  "GB-EUC-V": {
    name: "GB-EUC-V",
    script: "simplified-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 0 },
    toUnicode: false,
  },
  "GBK-EUC-H": {
    name: "GBK-EUC-H",
    script: "simplified-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 2 },
    toUnicode: false,
  },
  "GBK-EUC-V": {
    name: "GBK-EUC-V",
    script: "simplified-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 2 },
    toUnicode: false,
  },
  "GBKp-EUC-H": {
    name: "GBKp-EUC-H",
    script: "simplified-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 4 },
    toUnicode: false,
  },
  "GBKp-EUC-V": {
    name: "GBKp-EUC-V",
    script: "simplified-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 4 },
    toUnicode: false,
  },
  "GBK2K-H": {
    name: "GBK2K-H",
    script: "simplified-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 5 },
    toUnicode: false,
  },
  "GBK2K-V": {
    name: "GBK2K-V",
    script: "simplified-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "GB1", supplement: 5 },
    toUnicode: false,
  },

  // Traditional Chinese (Adobe-CNS1)
  "UniCNS-UCS2-H": {
    name: "UniCNS-UCS2-H",
    script: "traditional-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 6 },
    toUnicode: true,
  },
  "UniCNS-UCS2-V": {
    name: "UniCNS-UCS2-V",
    script: "traditional-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 6 },
    toUnicode: true,
  },
  "UniCNS-UTF16-H": {
    name: "UniCNS-UTF16-H",
    script: "traditional-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 6 },
    toUnicode: true,
  },
  "UniCNS-UTF16-V": {
    name: "UniCNS-UTF16-V",
    script: "traditional-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 6 },
    toUnicode: true,
  },
  "B5pc-H": {
    name: "B5pc-H",
    script: "traditional-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 0 },
    toUnicode: false,
  },
  "B5pc-V": {
    name: "B5pc-V",
    script: "traditional-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 0 },
    toUnicode: false,
  },
  "ETen-B5-H": {
    name: "ETen-B5-H",
    script: "traditional-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 1 },
    toUnicode: false,
  },
  "ETen-B5-V": {
    name: "ETen-B5-V",
    script: "traditional-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 1 },
    toUnicode: false,
  },
  "CNS-EUC-H": {
    name: "CNS-EUC-H",
    script: "traditional-chinese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 0 },
    toUnicode: false,
  },
  "CNS-EUC-V": {
    name: "CNS-EUC-V",
    script: "traditional-chinese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "CNS1", supplement: 0 },
    toUnicode: false,
  },

  // Japanese (Adobe-Japan1)
  "UniJIS-UCS2-H": {
    name: "UniJIS-UCS2-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 6 },
    toUnicode: true,
  },
  "UniJIS-UCS2-V": {
    name: "UniJIS-UCS2-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 6 },
    toUnicode: true,
  },
  "UniJIS-UCS2-HW-H": {
    name: "UniJIS-UCS2-HW-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 6 },
    toUnicode: true,
  },
  "UniJIS-UCS2-HW-V": {
    name: "UniJIS-UCS2-HW-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 6 },
    toUnicode: true,
  },
  "UniJIS-UTF16-H": {
    name: "UniJIS-UTF16-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 6 },
    toUnicode: true,
  },
  "UniJIS-UTF16-V": {
    name: "UniJIS-UTF16-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 6 },
    toUnicode: true,
  },
  "90ms-RKSJ-H": {
    name: "90ms-RKSJ-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 2 },
    toUnicode: false,
  },
  "90ms-RKSJ-V": {
    name: "90ms-RKSJ-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 2 },
    toUnicode: false,
  },
  "90msp-RKSJ-H": {
    name: "90msp-RKSJ-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 2 },
    toUnicode: false,
  },
  "90msp-RKSJ-V": {
    name: "90msp-RKSJ-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 2 },
    toUnicode: false,
  },
  "90pv-RKSJ-H": {
    name: "90pv-RKSJ-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 1 },
    toUnicode: false,
  },
  "83pv-RKSJ-H": {
    name: "83pv-RKSJ-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 1 },
    toUnicode: false,
  },
  "Add-RKSJ-H": {
    name: "Add-RKSJ-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 1 },
    toUnicode: false,
  },
  "Add-RKSJ-V": {
    name: "Add-RKSJ-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 1 },
    toUnicode: false,
  },
  "EUC-H": {
    name: "EUC-H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 1 },
    toUnicode: false,
  },
  "EUC-V": {
    name: "EUC-V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 1 },
    toUnicode: false,
  },
  H: {
    name: "H",
    script: "japanese",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 0 },
    toUnicode: false,
  },
  V: {
    name: "V",
    script: "japanese",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Japan1", supplement: 0 },
    toUnicode: false,
  },

  // Korean (Adobe-Korea1)
  "UniKS-UCS2-H": {
    name: "UniKS-UCS2-H",
    script: "korean",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 2 },
    toUnicode: true,
  },
  "UniKS-UCS2-V": {
    name: "UniKS-UCS2-V",
    script: "korean",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 2 },
    toUnicode: true,
  },
  "UniKS-UTF16-H": {
    name: "UniKS-UTF16-H",
    script: "korean",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 2 },
    toUnicode: true,
  },
  "UniKS-UTF16-V": {
    name: "UniKS-UTF16-V",
    script: "korean",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 2 },
    toUnicode: true,
  },
  "KSC-EUC-H": {
    name: "KSC-EUC-H",
    script: "korean",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 0 },
    toUnicode: false,
  },
  "KSC-EUC-V": {
    name: "KSC-EUC-V",
    script: "korean",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 0 },
    toUnicode: false,
  },
  "KSCms-UHC-H": {
    name: "KSCms-UHC-H",
    script: "korean",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 1 },
    toUnicode: false,
  },
  "KSCms-UHC-V": {
    name: "KSCms-UHC-V",
    script: "korean",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 1 },
    toUnicode: false,
  },
  "KSCms-UHC-HW-H": {
    name: "KSCms-UHC-HW-H",
    script: "korean",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 1 },
    toUnicode: false,
  },
  "KSCms-UHC-HW-V": {
    name: "KSCms-UHC-HW-V",
    script: "korean",
    writingMode: "vertical",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 1 },
    toUnicode: false,
  },
  "KSCpc-EUC-H": {
    name: "KSCpc-EUC-H",
    script: "korean",
    writingMode: "horizontal",
    cidSystemInfo: { registry: "Adobe", ordering: "Korea1", supplement: 0 },
    toUnicode: false,
  },
};

/**
 * CJK CMap Loader with async loading capabilities.
 *
 * Handles loading and caching of CJK CMaps from various sources.
 * Falls back to identity mapping when CMaps are unavailable.
 */
export class CJKCMapLoader {
  private cache: Map<string, CMap> = new Map();
  private loadingPromises: Map<string, Promise<CMap | null>> = new Map();
  private provider: CMapDataProvider | null;
  private defaultTimeout: number;

  constructor(options: CMapLoadOptions = {}) {
    this.provider = options.provider ?? null;
    this.defaultTimeout = options.timeout ?? 10000;
  }

  /**
   * Load a CMap by name.
   *
   * @param name - CMap name (e.g., "UniGB-UCS2-H")
   * @param options - Loading options
   * @returns Loaded CMap, or null if not found and no fallback available
   */
  async load(name: string, options: CMapLoadOptions = {}): Promise<CMap | null> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    // Check if already loading
    const loading = this.loadingPromises.get(name);
    if (loading) {
      return loading;
    }

    // Handle Identity CMaps
    if (name === "Identity-H") {
      const cmap = CMap.identityH();
      this.cache.set(name, cmap);
      return cmap;
    }
    if (name === "Identity-V") {
      const cmap = CMap.identityV();
      this.cache.set(name, cmap);
      return cmap;
    }

    // Start loading
    const loadPromise = this.loadFromProvider(name, options);
    this.loadingPromises.set(name, loadPromise);

    try {
      const cmap = await loadPromise;
      if (cmap && (options.cache ?? true)) {
        this.cache.set(name, cmap);
      }
      return cmap;
    } finally {
      this.loadingPromises.delete(name);
    }
  }

  /**
   * Load a CMap with fallback to identity mapping.
   *
   * @param name - CMap name
   * @param options - Loading options
   * @returns Loaded CMap, or Identity-H as fallback
   */
  async loadWithFallback(name: string, options: CMapLoadOptions = {}): Promise<CMap> {
    const cmap = await this.load(name, options);
    if (cmap) {
      return cmap;
    }

    // Determine fallback based on writing mode
    const info = PREDEFINED_CMAPS[name];
    if (info?.writingMode === "vertical") {
      return CMap.identityV();
    }

    return CMap.identityH();
  }

  /**
   * Get information about a predefined CMap.
   *
   * @param name - CMap name
   * @returns CMap info, or undefined if not a known predefined CMap
   */
  getInfo(name: string): PredefinedCMapInfo | undefined {
    return PREDEFINED_CMAPS[name];
  }

  /**
   * Check if a CMap is a known predefined CMap.
   */
  isPredefined(name: string): boolean {
    return name in PREDEFINED_CMAPS;
  }

  /**
   * Get all predefined CMap names for a specific script.
   */
  getCMapsForScript(script: CJKScript): string[] {
    return Object.entries(PREDEFINED_CMAPS)
      .filter(([_, info]) => info.script === script)
      .map(([name]) => name);
  }

  /**
   * Check if a CMap is cached.
   */
  isCached(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * Clear the CMap cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Parse CMap from data.
   */
  parseFromData(data: Uint8Array, name?: string): CMap {
    return parseCMapData(data, name);
  }

  private async loadFromProvider(name: string, options: CMapLoadOptions): Promise<CMap | null> {
    const provider = options.provider ?? this.provider;
    if (!provider) {
      return null;
    }

    const timeout = options.timeout ?? this.defaultTimeout;

    try {
      const data = await withTimeout(provider.load(name), timeout);
      if (!data) {
        return null;
      }

      return parseCMapData(data, name);
    } catch (error) {
      // Handle timeout or other errors gracefully
      if (error instanceof CMapLoadError) {
        throw error;
      }
      return null;
    }
  }
}

/**
 * Error thrown when CMap loading fails.
 */
export class CMapLoadError extends Error {
  constructor(
    message: string,
    public readonly cmapName: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "CMapLoadError";
  }
}

/**
 * Helper to add timeout to a promise.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new CMapLoadError(`CMap loading timed out after ${ms}ms`, ""));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Built-in CMap data provider that uses bundled CMap data.
 * This is a stub - implementations would provide actual CMap data.
 */
export class BundledCMapProvider implements CMapDataProvider {
  private bundledCMaps: Map<string, Uint8Array> = new Map();

  /**
   * Register bundled CMap data.
   */
  register(name: string, data: Uint8Array): void {
    this.bundledCMaps.set(name, data);
  }

  load(name: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.bundledCMaps.get(name) ?? null);
  }

  has(name: string): boolean {
    return this.bundledCMaps.has(name);
  }
}

/**
 * Create a default CJK CMap loader.
 */
export function createCJKCMapLoader(options: CMapLoadOptions = {}): CJKCMapLoader {
  return new CJKCMapLoader(options);
}
