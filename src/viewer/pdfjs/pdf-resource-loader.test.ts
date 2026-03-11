/**
 * Tests for PDF Resource Loader.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  PDFResourceLoader,
  createPDFResourceLoader,
  PDFLoadError,
  type AuthConfig,
} from "./pdf-resource-loader";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock PDF.js wrapper
vi.mock("./pdfjs-wrapper", () => ({
  initializePDFJS: vi.fn().mockResolvedValue(undefined),
  isPDFJSInitialized: vi.fn().mockReturnValue(true),
  loadDocument: vi.fn().mockResolvedValue({
    numPages: 1,
    getPage: vi.fn().mockResolvedValue({}),
  }),
}));

describe("PDFResourceLoader", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates a loader with default options", () => {
      const loader = new PDFResourceLoader();
      expect(loader).toBeInstanceOf(PDFResourceLoader);
    });

    it("creates a loader with custom options", () => {
      const loader = new PDFResourceLoader({
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 60000,
      });
      expect(loader).toBeInstanceOf(PDFResourceLoader);
    });

    it("accepts auth configuration", () => {
      const auth: AuthConfig = {
        authorization: "Bearer token123",
        headers: { "X-Custom": "value" },
      };
      const loader = new PDFResourceLoader({ auth });
      expect(loader.getAuth()).toEqual(auth);
    });
  });

  describe("createPDFResourceLoader", () => {
    it("creates a loader instance", () => {
      const loader = createPDFResourceLoader();
      expect(loader).toBeInstanceOf(PDFResourceLoader);
    });
  });

  describe("setAuth / getAuth", () => {
    it("updates auth configuration", () => {
      const loader = new PDFResourceLoader();
      const newAuth: AuthConfig = {
        authorization: "Bearer newtoken",
      };
      loader.setAuth(newAuth);
      expect(loader.getAuth()).toEqual(newAuth);
    });

    it("returns a copy of auth config", () => {
      const auth: AuthConfig = { authorization: "Bearer token" };
      const loader = new PDFResourceLoader({ auth });
      const retrieved = loader.getAuth();
      retrieved.authorization = "modified";
      expect(loader.getAuth().authorization).toBe("Bearer token");
    });
  });

  describe("load from bytes", () => {
    it("loads PDF from Uint8Array", async () => {
      const loader = new PDFResourceLoader();
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

      const result = await loader.load({ type: "bytes", data: bytes });

      expect(result.document).toBeDefined();
      expect(result.bytes).toBe(bytes);
      expect(result.sourceUrl).toBeUndefined();
    });
  });

  describe("load from base64", () => {
    it("loads PDF from base64 string", async () => {
      const loader = new PDFResourceLoader();
      // %PDF in base64
      const base64 = btoa("%PDF");

      const result = await loader.load({ type: "base64", data: base64 });

      expect(result.document).toBeDefined();
      expect(result.bytes).toBeDefined();
    });

    it("handles data URL prefix", async () => {
      const loader = new PDFResourceLoader();
      const base64 = `data:application/pdf;base64,${btoa("%PDF")}`;

      const result = await loader.load({ type: "base64", data: base64 });

      expect(result.document).toBeDefined();
    });
  });

  describe("load from URL", () => {
    it("fetches PDF from URL with auth headers", async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(pdfBytes.buffer),
      });

      const loader = new PDFResourceLoader({
        auth: {
          authorization: "Bearer mytoken",
          headers: { "X-Custom": "value" },
        },
      });

      const result = await loader.load({ type: "url", url: "https://example.com/doc.pdf" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/doc.pdf",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mytoken",
            "X-Custom": "value",
          }),
        }),
      );
      expect(result.document).toBeDefined();
      expect(result.sourceUrl).toBe("https://example.com/doc.pdf");
    });

    it("handles fetch errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const loader = new PDFResourceLoader({ maxRetries: 0 });

      await expect(
        loader.load({ type: "url", url: "https://example.com/doc.pdf" }),
      ).rejects.toThrow(PDFLoadError);
    });

    it("handles HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const loader = new PDFResourceLoader({ maxRetries: 0 });

      await expect(
        loader.load({ type: "url", url: "https://example.com/doc.pdf" }),
      ).rejects.toThrow("HTTP error 404");
    });
  });

  describe("403 error recovery", () => {
    it("calls onAuthRefresh on 403 error", async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      // First call returns 403, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(pdfBytes.buffer),
        });

      const onAuthRefresh = vi.fn().mockResolvedValue({
        authorization: "Bearer newtoken",
      });

      const loader = new PDFResourceLoader({
        auth: { authorization: "Bearer oldtoken" },
        onAuthRefresh,
      });

      const result = await loader.load({ type: "url", url: "https://example.com/doc.pdf" });

      expect(onAuthRefresh).toHaveBeenCalled();
      expect(result.document).toBeDefined();
      // Second call should have new token
      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://example.com/doc.pdf",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer newtoken",
          }),
        }),
      );
    });

    it("calls onUrlRefresh on 403 error for signed URLs", async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(pdfBytes.buffer),
        });

      const onUrlRefresh = vi.fn().mockResolvedValue("https://example.com/doc.pdf?newtoken=xyz");

      const loader = new PDFResourceLoader({ onUrlRefresh });

      const result = await loader.load({
        type: "url",
        url: "https://example.com/doc.pdf?token=abc",
      });

      expect(onUrlRefresh).toHaveBeenCalledWith("https://example.com/doc.pdf?token=abc");
      expect(result.document).toBeDefined();
      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://example.com/doc.pdf?newtoken=xyz",
        expect.anything(),
      );
    });

    it("fails if auth refresh returns null", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const onAuthRefresh = vi.fn().mockResolvedValue(null);

      const loader = new PDFResourceLoader({ onAuthRefresh, maxRetries: 0 });

      await expect(
        loader.load({ type: "url", url: "https://example.com/doc.pdf" }),
      ).rejects.toThrow("Authentication failed");
    });
  });

  describe("retry logic", () => {
    it("retries on network errors with exponential backoff", async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      // Fail twice, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(pdfBytes.buffer),
        });

      const loader = new PDFResourceLoader({
        maxRetries: 3,
        retryDelay: 10, // Short delay for tests
      });

      const result = await loader.load({ type: "url", url: "https://example.com/doc.pdf" });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.document).toBeDefined();
    });

    it("gives up after max retries", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const loader = new PDFResourceLoader({
        maxRetries: 2,
        retryDelay: 10,
      });

      await expect(
        loader.load({ type: "url", url: "https://example.com/doc.pdf" }),
      ).rejects.toThrow(PDFLoadError);

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("progress tracking", () => {
    it("calls onProgress during download", async () => {
      const chunks = [new Uint8Array([0x25, 0x50]), new Uint8Array([0x44, 0x46])];
      let chunkIndex = 0;

      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            const value = chunks[chunkIndex++];
            return Promise.resolve({ done: false, value });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-length", "4"]]),
        body: {
          getReader: () => mockReader,
        },
      });

      const onProgress = vi.fn();
      const loader = new PDFResourceLoader({ onProgress });

      await loader.load({ type: "url", url: "https://example.com/doc.pdf" });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe("PDFLoadError", () => {
    it("captures status code", () => {
      const error = new PDFLoadError("Test error", undefined, 403, true);
      expect(error.statusCode).toBe(403);
      expect(error.isAuthError).toBe(true);
      expect(error.name).toBe("PDFLoadError");
    });

    it("captures cause", () => {
      const cause = new Error("Original error");
      const error = new PDFLoadError("Wrapped error", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("dispose", () => {
    it("clears state", () => {
      const loader = new PDFResourceLoader({
        auth: { authorization: "Bearer token" },
      });

      loader.dispose();

      expect(loader.getAuth()).toEqual({});
    });
  });
});
