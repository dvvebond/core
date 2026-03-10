/**
 * CMap Registry - Centralized management of CMaps.
 *
 * Provides a registry system for managing multiple CMaps with:
 * - Lazy loading and caching
 * - Support for predefined, embedded, and custom CMaps
 * - Integration with CJK CMap loading
 * - Legacy encoding support
 *
 * This is the main entry point for CMap operations in the library.
 */

import {
  CJKCMapLoader,
  type CMapDataProvider,
  type CMapLoadOptions,
  PREDEFINED_CMAPS,
} from "./CJKCMapLoader";
import { CMap, parseCMapData, type ICMap, type CMapOptions } from "./CMap";
import {
  LegacyCMapSupport,
  createLegacyEncodingCMap,
  type LegacyEncodingOptions,
  type LegacyEncodingType,
} from "./LegacyCMapSupport";

/**
 * Registry entry for a CMap.
 */
export interface CMapRegistryEntry {
  /** The CMap instance */
  cmap: ICMap;
  /** Source of the CMap */
  source: "predefined" | "embedded" | "custom" | "legacy";
  /** Whether the CMap was loaded asynchronously */
  async: boolean;
  /** Timestamp when the CMap was registered */
  registeredAt: number;
}

/**
 * Options for CMap registry operations.
 */
export interface CMapRegistryOptions {
  /** CMap data provider for async loading */
  provider?: CMapDataProvider;
  /** Default timeout for async loading */
  timeout?: number;
  /** Maximum cache size (number of entries) */
  maxCacheSize?: number;
  /** Enable automatic cache eviction */
  autoEvict?: boolean;
}

/**
 * Statistics about registry usage.
 */
export interface CMapRegistryStats {
  /** Number of cached CMaps */
  cacheSize: number;
  /** Number of predefined CMaps */
  predefinedCount: number;
  /** Number of embedded CMaps */
  embeddedCount: number;
  /** Number of custom CMaps */
  customCount: number;
  /** Number of legacy encoding CMaps */
  legacyCount: number;
  /** Cache hit count */
  cacheHits: number;
  /** Cache miss count */
  cacheMisses: number;
}

/**
 * CMap Registry - Central management for all CMap operations.
 *
 * Usage:
 * ```typescript
 * const registry = new CMapRegistry();
 *
 * // Get predefined CMap
 * const identityH = registry.get("Identity-H");
 *
 * // Load CJK CMap asynchronously
 * const cjkCMap = await registry.loadAsync("UniGB-UCS2-H");
 *
 * // Get legacy encoding
 * const winAnsi = registry.getLegacy("WinAnsiEncoding");
 *
 * // Register custom CMap
 * registry.register("MyCustomCMap", customCMap);
 * ```
 */
export class CMapRegistry {
  private cache: Map<string, CMapRegistryEntry> = new Map();
  private cjkLoader: CJKCMapLoader;
  private legacySupport: LegacyCMapSupport;
  private options: CMapRegistryOptions;
  private stats: CMapRegistryStats;

  constructor(options: CMapRegistryOptions = {}) {
    this.options = {
      maxCacheSize: options.maxCacheSize ?? 100,
      autoEvict: options.autoEvict ?? true,
      timeout: options.timeout ?? 10000,
      ...options,
    };

    this.cjkLoader = new CJKCMapLoader({
      provider: options.provider,
      timeout: options.timeout,
    });

    this.legacySupport = new LegacyCMapSupport();

    this.stats = {
      cacheSize: 0,
      predefinedCount: 0,
      embeddedCount: 0,
      customCount: 0,
      legacyCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Pre-register Identity CMaps
    this.registerPredefined("Identity-H", CMap.identityH());
    this.registerPredefined("Identity-V", CMap.identityV());
  }

  /**
   * Get a CMap by name (synchronous).
   * Returns cached CMap or null if not available.
   *
   * @param name - CMap name
   * @returns CMap or null if not cached
   */
  get(name: string): ICMap | null {
    const entry = this.cache.get(name);
    if (entry) {
      this.stats.cacheHits++;
      return entry.cmap;
    }

    this.stats.cacheMisses++;

    // Try to create identity CMaps synchronously
    if (name === "Identity-H") {
      return this.registerPredefined("Identity-H", CMap.identityH());
    }
    if (name === "Identity-V") {
      return this.registerPredefined("Identity-V", CMap.identityV());
    }

    return null;
  }

  /**
   * Get a CMap by name, with fallback to identity.
   *
   * @param name - CMap name
   * @returns CMap (Identity-H if not found)
   */
  getOrIdentity(name: string): ICMap {
    const cmap = this.get(name);
    if (cmap) {
      return cmap;
    }

    // Determine if we should use vertical identity
    const info = PREDEFINED_CMAPS[name];
    if (info?.writingMode === "vertical") {
      return this.get("Identity-V")!;
    }

    return this.get("Identity-H")!;
  }

  /**
   * Load a CMap asynchronously.
   * Returns cached CMap immediately if available.
   *
   * @param name - CMap name
   * @param options - Loading options
   * @returns Loaded CMap or null if not found
   */
  async loadAsync(name: string, options: CMapLoadOptions = {}): Promise<ICMap | null> {
    // Check cache first
    const cached = this.get(name);
    if (cached) {
      return cached;
    }

    // Load via CJK loader
    const cmap = await this.cjkLoader.load(name, options);
    if (cmap) {
      this.registerEntry(name, cmap, "predefined", true);
      return cmap;
    }

    return null;
  }

  /**
   * Load a CMap with fallback to identity mapping.
   *
   * @param name - CMap name
   * @param options - Loading options
   * @returns Loaded CMap or identity fallback
   */
  async loadWithFallback(name: string, options: CMapLoadOptions = {}): Promise<ICMap> {
    const cmap = await this.loadAsync(name, options);
    if (cmap) {
      return cmap;
    }

    return this.getOrIdentity(name);
  }

  /**
   * Get a legacy encoding CMap.
   *
   * @param encoding - Legacy encoding type
   * @returns CMap for the encoding
   */
  getLegacy(encoding: LegacyEncodingType): ICMap {
    const cacheKey = `legacy:${encoding}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached.cmap;
    }

    this.stats.cacheMisses++;
    const cmap = this.legacySupport.getEncodingCMap(encoding);
    this.registerEntry(cacheKey, cmap, "legacy", false);
    return cmap;
  }

  /**
   * Create a custom legacy encoding with differences.
   *
   * @param options - Legacy encoding options
   * @param name - Optional name for caching
   * @returns Custom CMap
   */
  createLegacyEncoding(options: LegacyEncodingOptions, name?: string): ICMap {
    const cmap = createLegacyEncodingCMap(options);
    if (name) {
      this.registerEntry(name, cmap, "custom", false);
    }
    return cmap;
  }

  /**
   * Register a custom CMap.
   *
   * @param name - CMap name
   * @param cmap - CMap instance
   */
  register(name: string, cmap: ICMap): void {
    this.registerEntry(name, cmap, "custom", false);
  }

  /**
   * Register a CMap from raw data.
   *
   * @param name - CMap name
   * @param data - Raw CMap data
   * @returns Parsed CMap
   */
  registerFromData(name: string, data: Uint8Array): ICMap {
    const cmap = parseCMapData(data, name);
    this.registerEntry(name, cmap, "embedded", false);
    return cmap;
  }

  /**
   * Register a CMap from options.
   *
   * @param options - CMap options
   * @returns Created CMap
   */
  registerFromOptions(options: CMapOptions): ICMap {
    const cmap = new CMap(options);
    this.registerEntry(options.name, cmap, "custom", false);
    return cmap;
  }

  /**
   * Check if a CMap is registered/cached.
   *
   * @param name - CMap name
   */
  has(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * Remove a CMap from the registry.
   *
   * @param name - CMap name
   * @returns true if removed, false if not found
   */
  remove(name: string): boolean {
    const entry = this.cache.get(name);
    if (entry) {
      this.cache.delete(name);
      this.stats.cacheSize--;
      this.updateSourceCount(entry.source, -1);
      return true;
    }
    return false;
  }

  /**
   * Clear all cached CMaps.
   * Optionally preserve predefined CMaps.
   *
   * @param preservePredefined - Keep predefined CMaps (default: true)
   */
  clear(preservePredefined = true): void {
    if (preservePredefined) {
      const predefined: [string, CMapRegistryEntry][] = [];
      for (const [name, entry] of this.cache) {
        if (entry.source === "predefined" && (name === "Identity-H" || name === "Identity-V")) {
          predefined.push([name, entry]);
        }
      }
      this.cache.clear();
      this.resetStats();
      for (const [name, entry] of predefined) {
        this.cache.set(name, entry);
        this.stats.cacheSize++;
        this.stats.predefinedCount++;
      }
    } else {
      this.cache.clear();
      this.resetStats();
    }

    this.cjkLoader.clearCache();
    this.legacySupport.clearCache();
  }

  /**
   * Get registry statistics.
   */
  getStats(): Readonly<CMapRegistryStats> {
    return { ...this.stats };
  }

  /**
   * Get all registered CMap names.
   */
  getNames(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get CMap entry information.
   *
   * @param name - CMap name
   */
  getEntry(name: string): Readonly<CMapRegistryEntry> | undefined {
    return this.cache.get(name);
  }

  /**
   * Check if a CMap name is a known predefined CMap.
   */
  isPredefined(name: string): boolean {
    return this.cjkLoader.isPredefined(name);
  }

  /**
   * Check if a legacy encoding is supported.
   */
  isLegacyEncoding(encoding: string): encoding is LegacyEncodingType {
    return this.legacySupport.isSupported(encoding);
  }

  /**
   * Get the CJK loader for advanced operations.
   */
  getCJKLoader(): CJKCMapLoader {
    return this.cjkLoader;
  }

  /**
   * Get the legacy support for advanced operations.
   */
  getLegacySupport(): LegacyCMapSupport {
    return this.legacySupport;
  }

  private registerPredefined(name: string, cmap: ICMap): ICMap {
    this.registerEntry(name, cmap, "predefined", false);
    return cmap;
  }

  private registerEntry(
    name: string,
    cmap: ICMap,
    source: CMapRegistryEntry["source"],
    async: boolean,
  ): void {
    // Check cache size limit
    if (this.options.autoEvict && this.cache.size >= this.options.maxCacheSize!) {
      this.evictOldest();
    }

    const existing = this.cache.get(name);
    if (existing) {
      this.updateSourceCount(existing.source, -1);
    } else {
      this.stats.cacheSize++;
    }

    this.cache.set(name, {
      cmap,
      source,
      async,
      registeredAt: Date.now(),
    });

    this.updateSourceCount(source, 1);
  }

  private updateSourceCount(source: CMapRegistryEntry["source"], delta: number): void {
    switch (source) {
      case "predefined":
        this.stats.predefinedCount += delta;
        break;
      case "embedded":
        this.stats.embeddedCount += delta;
        break;
      case "custom":
        this.stats.customCount += delta;
        break;
      case "legacy":
        this.stats.legacyCount += delta;
        break;
    }
  }

  private evictOldest(): void {
    let oldestName: string | null = null;
    let oldestTime = Infinity;

    for (const [name, entry] of this.cache) {
      // Don't evict identity CMaps
      if (name === "Identity-H" || name === "Identity-V") {
        continue;
      }

      if (entry.registeredAt < oldestTime) {
        oldestTime = entry.registeredAt;
        oldestName = name;
      }
    }

    if (oldestName) {
      this.remove(oldestName);
    }
  }

  private resetStats(): void {
    this.stats = {
      cacheSize: 0,
      predefinedCount: 0,
      embeddedCount: 0,
      customCount: 0,
      legacyCount: 0,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
    };
  }
}

/**
 * Default global CMap registry instance.
 */
let defaultRegistry: CMapRegistry | null = null;

/**
 * Get the default CMap registry.
 * Creates one if it doesn't exist.
 */
export function getDefaultRegistry(): CMapRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new CMapRegistry();
  }
  return defaultRegistry;
}

/**
 * Set the default CMap registry.
 *
 * @param registry - New default registry
 */
export function setDefaultRegistry(registry: CMapRegistry): void {
  defaultRegistry = registry;
}

/**
 * Create a new CMap registry.
 *
 * @param options - Registry options
 */
export function createCMapRegistry(options: CMapRegistryOptions = {}): CMapRegistry {
  return new CMapRegistry(options);
}
