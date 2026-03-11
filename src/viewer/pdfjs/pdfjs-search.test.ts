/**
 * Tests for PDF.js search functionality.
 */

import { describe, expect, it } from "vitest";

import { PDFJSSearchEngine, createPDFJSSearchEngine } from "./pdfjs-search";

describe("PDFJSSearchEngine", () => {
  describe("construction", () => {
    it("should create a search engine instance", () => {
      const engine = new PDFJSSearchEngine();
      expect(engine).toBeInstanceOf(PDFJSSearchEngine);
    });

    it("should create engine via factory function", () => {
      const engine = createPDFJSSearchEngine();
      expect(engine).toBeInstanceOf(PDFJSSearchEngine);
    });
  });

  describe("initial state", () => {
    it("should have empty initial state", () => {
      const engine = new PDFJSSearchEngine();
      const state = engine.state;

      expect(state.query).toBe("");
      expect(state.results).toEqual([]);
      expect(state.currentIndex).toBe(-1);
      expect(state.searching).toBe(false);
    });

    it("should report zero result count initially", () => {
      const engine = new PDFJSSearchEngine();
      expect(engine.resultCount).toBe(0);
    });

    it("should return null for current result initially", () => {
      const engine = new PDFJSSearchEngine();
      expect(engine.currentResult).toBeNull();
    });
  });

  describe("clear search", () => {
    it("should reset state when clearing", () => {
      const engine = new PDFJSSearchEngine();
      engine.clearSearch();

      const state = engine.state;
      expect(state.query).toBe("");
      expect(state.results).toEqual([]);
      expect(state.currentIndex).toBe(-1);
      expect(state.searching).toBe(false);
    });
  });

  describe("listeners", () => {
    it("should add and remove listeners", () => {
      const engine = new PDFJSSearchEngine();
      const listener = () => {};

      engine.addListener(listener);
      engine.removeListener(listener);

      // Should not throw
      engine.clearSearch();
    });

    it("should notify listeners on clear", () => {
      const engine = new PDFJSSearchEngine();
      let notified = false;

      engine.addListener(() => {
        notified = true;
      });

      engine.clearSearch();
      expect(notified).toBe(true);
    });
  });

  describe("search without document", () => {
    it("should throw when searching without document", async () => {
      const engine = new PDFJSSearchEngine();
      await expect(engine.search("test")).rejects.toThrow();
    });
  });

  describe("navigation", () => {
    it("should return null when navigating with no results", () => {
      const engine = new PDFJSSearchEngine();

      expect(engine.findNext()).toBeNull();
      expect(engine.findPrevious()).toBeNull();
      expect(engine.goToResult(0)).toBeNull();
    });
  });

  describe("page filtering", () => {
    it("should return empty array for page with no results", () => {
      const engine = new PDFJSSearchEngine();
      expect(engine.getResultsForPage(0)).toEqual([]);
      expect(engine.getResultsForPage(100)).toEqual([]);
    });
  });
});
