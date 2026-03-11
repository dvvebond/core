/**
 * PDF Resource Loader with authentication and error recovery.
 *
 * This module provides robust loading logic for PDF documents that handles:
 * - URL fetching with configurable headers
 * - Binary array (Uint8Array) loading
 * - 403 error recovery with token/URL refresh
 * - Retry logic with exponential backoff
 * - Progress tracking
 */

import {
  initializePDFJS,
  isPDFJSInitialized,
  loadDocument,
  type LoadDocumentOptions,
  type PDFDocumentProxy,
  type PDFJSWrapperOptions,
} from "./pdfjs-wrapper";

/**
 * Source types for PDF loading.
 */
export type PDFSource =
  | { type: "url"; url: string }
  | { type: "bytes"; data: Uint8Array }
  | { type: "base64"; data: string }
  | { type: "blob"; blob: Blob };

/**
 * Authentication configuration for URL fetching.
 */
export interface AuthConfig {
  /**
   * Authorization header value (e.g., "Bearer <token>").
   */
  authorization?: string;

  /**
   * Custom headers to include in requests.
   */
  headers?: Record<string, string>;

  /**
   * Whether to include credentials (cookies) in requests.
   * @default false
   */
  withCredentials?: boolean;
}

/**
 * Callback to refresh authentication when a 403 error occurs.
 * Should return new auth config, or null to abort.
 */
export type AuthRefreshCallback = () => Promise<AuthConfig | null>;

/**
 * Callback to refresh the URL when a 403 error occurs.
 * Useful for signed URLs that expire.
 * Should return the new URL, or null to abort.
 */
export type UrlRefreshCallback = (originalUrl: string) => Promise<string | null>;

/**
 * Progress callback for tracking load progress.
 */
export type ProgressCallback = (loaded: number, total: number) => void;

/**
 * Options for the PDF resource loader.
 */
export interface PDFResourceLoaderOptions extends PDFJSWrapperOptions {
  /**
   * Authentication configuration.
   */
  auth?: AuthConfig;

  /**
   * Callback to refresh authentication on 403 errors.
   */
  onAuthRefresh?: AuthRefreshCallback;

  /**
   * Callback to refresh URL on 403 errors (for signed URLs).
   */
  onUrlRefresh?: UrlRefreshCallback;

  /**
   * Progress callback for tracking download progress.
   */
  onProgress?: ProgressCallback;

  /**
   * Maximum number of retry attempts for failed requests.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds for retry backoff.
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * PDF loading options passed to PDF.js.
   */
  loadOptions?: LoadDocumentOptions;
}

/**
 * Error thrown when PDF loading fails.
 */
export class PDFLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly statusCode?: number,
    public readonly isAuthError: boolean = false,
  ) {
    super(message);
    this.name = "PDFLoadError";
  }
}

/**
 * Result of a successful PDF load.
 */
export interface PDFLoadResult {
  /**
   * The loaded PDF document.
   */
  document: PDFDocumentProxy;

  /**
   * The raw PDF bytes (if available).
   */
  bytes?: Uint8Array;

  /**
   * The source URL (if loaded from URL).
   */
  sourceUrl?: string;
}

/**
 * PDF Resource Loader class.
 *
 * Provides robust PDF loading with authentication, retry logic,
 * and 403 error recovery.
 *
 * @example
 * ```ts
 * const loader = new PDFResourceLoader({
 *   auth: {
 *     authorization: 'Bearer my-token',
 *   },
 *   onAuthRefresh: async () => {
 *     const newToken = await refreshMyToken();
 *     return { authorization: `Bearer ${newToken}` };
 *   },
 *   onProgress: (loaded, total) => {
 *     console.log(`Loading: ${Math.round(loaded / total * 100)}%`);
 *   },
 * });
 *
 * // Load from URL
 * const result = await loader.load({ type: 'url', url: 'https://example.com/doc.pdf' });
 *
 * // Load from bytes
 * const result = await loader.load({ type: 'bytes', data: myUint8Array });
 * ```
 */
export class PDFResourceLoader {
  private _options: PDFResourceLoaderOptions;
  private _auth: AuthConfig;
  private _initialized = false;

  constructor(options: PDFResourceLoaderOptions = {}) {
    this._options = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...options,
    };
    this._auth = options.auth ?? {};
  }

  /**
   * Initialize the loader (and PDF.js if needed).
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    if (!isPDFJSInitialized()) {
      await initializePDFJS(this._options);
    }

    this._initialized = true;
  }

  /**
   * Update authentication configuration.
   */
  setAuth(auth: AuthConfig): void {
    this._auth = auth;
  }

  /**
   * Get current authentication configuration.
   */
  getAuth(): AuthConfig {
    return { ...this._auth };
  }

  /**
   * Load a PDF document from various sources.
   *
   * @param source - The PDF source (URL, bytes, base64, or blob)
   * @returns The loaded PDF document and metadata
   */
  async load(source: PDFSource): Promise<PDFLoadResult> {
    await this.initialize();

    switch (source.type) {
      case "url":
        return this.loadFromUrl(source.url);

      case "bytes":
        return this.loadFromBytes(source.data);

      case "base64":
        return this.loadFromBase64(source.data);

      case "blob":
        return this.loadFromBlob(source.blob);

      default:
        throw new PDFLoadError(`Unknown source type: ${(source as PDFSource).type}`);
    }
  }

  /**
   * Load a PDF from a URL with authentication and retry logic.
   */
  private async loadFromUrl(url: string, retryCount = 0): Promise<PDFLoadResult> {
    try {
      const bytes = await this.fetchWithAuth(url);
      const document = await loadDocument(bytes, this._options.loadOptions);

      return {
        document,
        bytes,
        sourceUrl: url,
      };
    } catch (error) {
      const pdferror = error instanceof PDFLoadError ? error : null;

      // Handle 403 errors with refresh logic
      if (pdferror?.statusCode === 403 || pdferror?.isAuthError) {
        // Try URL refresh first (for signed URLs)
        if (this._options.onUrlRefresh) {
          const newUrl = await this._options.onUrlRefresh(url);
          if (newUrl) {
            return this.loadFromUrl(newUrl, 0); // Reset retry count for new URL
          }
        }

        // Try auth refresh
        if (this._options.onAuthRefresh) {
          const newAuth = await this._options.onAuthRefresh();
          if (newAuth) {
            this._auth = newAuth;
            return this.loadFromUrl(url, 0); // Reset retry count for new auth
          }
        }

        throw new PDFLoadError(
          "Authentication failed and refresh was not successful",
          pdferror,
          403,
          true,
        );
      }

      // Retry on other errors
      if (retryCount < (this._options.maxRetries ?? 3)) {
        const delay = (this._options.retryDelay ?? 1000) * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.loadFromUrl(url, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Fetch a URL with authentication headers.
   */
  private async fetchWithAuth(url: string): Promise<Uint8Array> {
    const headers: Record<string, string> = {
      ...this._auth.headers,
    };

    if (this._auth.authorization) {
      headers["Authorization"] = this._auth.authorization;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._options.timeout ?? 30000);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        credentials: this._auth.withCredentials ? "include" : "same-origin",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isAuthError = response.status === 401 || response.status === 403;
        throw new PDFLoadError(
          `HTTP error ${response.status}: ${response.statusText}`,
          undefined,
          response.status,
          isAuthError,
        );
      }

      // Track progress if callback provided
      if (this._options.onProgress && response.body) {
        return this.readWithProgress(response);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof PDFLoadError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new PDFLoadError("Request timed out", error as Error);
      }

      throw new PDFLoadError(
        `Failed to fetch PDF: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Read response body with progress tracking.
   */
  private async readWithProgress(response: Response): Promise<Uint8Array> {
    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      loaded += value.length;

      if (this._options.onProgress) {
        this._options.onProgress(loaded, total || loaded);
      }
    }

    // Combine chunks into single Uint8Array
    const result = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Load a PDF from a Uint8Array.
   */
  private async loadFromBytes(data: Uint8Array): Promise<PDFLoadResult> {
    try {
      const document = await loadDocument(data, this._options.loadOptions);
      return {
        document,
        bytes: data,
      };
    } catch (error) {
      throw new PDFLoadError(
        `Failed to load PDF from bytes: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Load a PDF from a base64 string.
   */
  private async loadFromBase64(base64: string): Promise<PDFLoadResult> {
    try {
      // Remove data URL prefix if present
      const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, "");

      // Decode base64 to bytes
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return this.loadFromBytes(bytes);
    } catch (error) {
      throw new PDFLoadError(
        `Failed to decode base64 PDF: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Load a PDF from a Blob.
   */
  private async loadFromBlob(blob: Blob): Promise<PDFLoadResult> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      return this.loadFromBytes(bytes);
    } catch (error) {
      throw new PDFLoadError(
        `Failed to load PDF from blob: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of the loader and release resources.
   */
  dispose(): void {
    this._initialized = false;
    this._auth = {};
  }
}

/**
 * Create a new PDF resource loader instance.
 */
export function createPDFResourceLoader(options?: PDFResourceLoaderOptions): PDFResourceLoader {
  return new PDFResourceLoader(options);
}

/**
 * Convenience function to load a PDF from a URL with default options.
 */
export async function loadPDFFromUrl(
  url: string,
  options?: PDFResourceLoaderOptions,
): Promise<PDFLoadResult> {
  const loader = createPDFResourceLoader(options);
  return loader.load({ type: "url", url });
}

/**
 * Convenience function to load a PDF from bytes with default options.
 */
export async function loadPDFFromBytes(
  data: Uint8Array,
  options?: PDFResourceLoaderOptions,
): Promise<PDFLoadResult> {
  const loader = createPDFResourceLoader(options);
  return loader.load({ type: "bytes", data });
}
