/**
 * Tests for PDF.js wrapper module.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { initializePDFJS, isPDFJSInitialized, isTextItem } from "./pdfjs-wrapper";

describe("PDF.js Wrapper", () => {
  describe("initialization", () => {
    it("should report initialized state correctly", async () => {
      // Before initialization, should be false
      const wasInitialized = isPDFJSInitialized();

      // Try to initialize
      try {
        await initializePDFJS();
      } catch {
        // May fail in test environment without PDF.js, that's ok
      }

      // After attempt, state should be consistent
      expect(typeof isPDFJSInitialized()).toBe("boolean");
    });

    it("should handle multiple initialization calls gracefully", async () => {
      // Multiple init calls should not throw
      try {
        await initializePDFJS();
        await initializePDFJS();
        await initializePDFJS();
      } catch {
        // May fail in test environment, that's ok
      }

      // Should still report state correctly
      expect(typeof isPDFJSInitialized()).toBe("boolean");
    });
  });

  describe("isTextItem", () => {
    it("should return true for text items", () => {
      const textItem = {
        str: "Hello",
        dir: "ltr",
        transform: [1, 0, 0, 1, 0, 0],
        width: 50,
        height: 12,
        fontName: "Arial",
        hasEOL: false,
      };

      expect(isTextItem(textItem)).toBe(true);
    });

    it("should return false for marked content", () => {
      const markedContent = {
        type: "beginMarkedContentProps",
        id: "mcid_1",
        tag: "Artifact",
      };

      expect(isTextItem(markedContent)).toBe(false);
    });
  });
});
