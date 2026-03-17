import { useState, useCallback } from "react";

import { CodeDisplay } from "../utils/code-display";
import { MetricsPanel } from "../utils/metrics";

interface SearchResult {
  pageIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
  context: string;
}

// Mock search results for demonstration
const mockSearchResults: SearchResult[] = [
  {
    pageIndex: 0,
    text: "Lorem",
    startOffset: 0,
    endOffset: 5,
    context: "...Lorem ipsum dolor sit amet...",
  },
  {
    pageIndex: 0,
    text: "lorem",
    startOffset: 120,
    endOffset: 125,
    context: "...sed do eiusmod tempor lorem incididunt...",
  },
  {
    pageIndex: 1,
    text: "Lorem",
    startOffset: 45,
    endOffset: 50,
    context: "...consectetur Lorem adipiscing elit...",
  },
  {
    pageIndex: 2,
    text: "lorem",
    startOffset: 200,
    endOffset: 205,
    context: "...magna aliqua lorem ut enim ad...",
  },
];

export function SearchExample() {
  const [query, setQuery] = useState("Lorem");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(() => {
    setIsSearching(true);
    // Simulate search delay
    setTimeout(() => {
      const filtered = mockSearchResults.filter(r => {
        const searchText = caseSensitive ? r.text : r.text.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        return searchText.includes(searchQuery);
      });
      setResults(filtered);
      setCurrentIndex(filtered.length > 0 ? 0 : -1);
      setIsSearching(false);
    }, 300);
  }, [query, caseSensitive]);

  const handleFindNext = () => {
    if (results.length > 0) {
      setCurrentIndex((currentIndex + 1) % results.length);
    }
  };

  const handleFindPrevious = () => {
    if (results.length > 0) {
      setCurrentIndex((currentIndex - 1 + results.length) % results.length);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setCurrentIndex(-1);
  };

  const metricsData = [
    { label: "Results Found", value: results.length },
    {
      label: "Current Result",
      value: currentIndex >= 0 ? currentIndex + 1 : 0,
      unit: `/ ${results.length}`,
    },
    { label: "Pages with Results", value: new Set(results.map(r => r.pageIndex)).size },
  ];

  const basicSearchCode = `import { usePDFSearch } from "@dvvebond/core/react";

function SearchableViewer({ document }) {
  const { state, actions } = usePDFSearch({
    document,
    onSearchResults: (results) => {
      console.log(\`Found \${results.length} matches\`);
    },
    onCurrentResultChange: (result, index) => {
      // Scroll to result, highlight, etc.
    },
  });

  return (
    <div>
      <input
        type="text"
        value={state.query}
        onChange={(e) => actions.search(e.target.value)}
        placeholder="Search..."
      />
      <button onClick={actions.findPrevious}>Previous</button>
      <span>{state.currentIndex + 1} / {state.resultCount}</span>
      <button onClick={actions.findNext}>Next</button>
    </div>
  );
}`;

  const searchEngineCode = `import {
  SearchEngine,
  createSearchEngine,
  type SearchOptions,
  type SearchResult,
} from "@dvvebond/core";

// Create a text provider for the search engine
const textProvider = {
  getPageCount: () => pdf.getPageCount(),
  getPageText: async (pageIndex: number) => {
    const page = pdf.getPage(pageIndex);
    return page?.extractText().text ?? "";
  },
  getCharBounds: async (pageIndex, startOffset, endOffset) => {
    // Return bounding boxes for highlighting
    return extractCharacterBounds(pdf, pageIndex, startOffset, endOffset);
  },
};

// Create search engine
const searchEngine = createSearchEngine({ textProvider });

// Listen for events
searchEngine.addEventListener("search-start", (event) => {
  console.log("Search started:", event.query);
});

searchEngine.addEventListener("search-progress", (event) => {
  console.log(\`Searched \${event.pagesSearched} pages...\`);
});

searchEngine.addEventListener("search-complete", (event) => {
  console.log(\`Found \${event.totalResults} results\`);
});

// Execute search
const results = await searchEngine.search("hello world", {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
});

// Navigate results
searchEngine.findNext();    // Go to next result
searchEngine.findPrevious(); // Go to previous result
searchEngine.goToResult(5);  // Go to specific result
searchEngine.clearSearch();  // Clear search state`;

  const regexSearchCode = `import { searchPages, type TextMatch } from "@dvvebond/core";

// Search with regex pattern
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;

const matches = await searchPages(pdf, emailPattern, {
  // Search all pages
  startPage: 0,
  endPage: pdf.getPageCount(),
});

// Each match contains:
matches.forEach((match: TextMatch) => {
  console.log({
    pageIndex: match.pageIndex,
    text: match.text,           // The matched text
    startOffset: match.start,   // Character offset in page text
    endOffset: match.end,
    // If character bounds were requested:
    bounds: match.bounds,       // Array of character bounding boxes
  });
});

// Common regex patterns
const patterns = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g,
  phone: /\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}/g,
  date: /\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4}/g,
  currency: /\\$[\\d,]+\\.?\\d{0,2}/g,
  url: /https?:\\/\\/[^\\s]+/gi,
};`;

  const highlightingCode = `import { usePDFSnippetHighlight } from "@dvvebond/core/react";
import type { SearchResult } from "@dvvebond/core";

function SearchHighlighter({ results, currentIndex }) {
  const { highlightResults, clearHighlights, setCurrentHighlight } =
    usePDFSnippetHighlight();

  useEffect(() => {
    // Highlight all search results
    highlightResults(results, {
      backgroundColor: "rgba(255, 255, 0, 0.3)",
      borderColor: "rgba(255, 200, 0, 0.8)",
    });

    // Highlight current result differently
    if (currentIndex >= 0 && results[currentIndex]) {
      setCurrentHighlight(results[currentIndex], {
        backgroundColor: "rgba(255, 150, 0, 0.5)",
        borderColor: "rgba(255, 100, 0, 1)",
      });
    }

    return () => clearHighlights();
  }, [results, currentIndex]);

  return null; // Renders overlay via portal
}`;

  return (
    <>
      <div className="page-header">
        <h2>Search & Find</h2>
        <p>
          Search through PDF documents with support for plain text, case sensitivity, whole word
          matching, and regular expressions. Results include context and can be highlighted.
        </p>
      </div>

      <div className="page-content">
        {/* Live Demo */}
        <div className="card">
          <div className="card-header">
            <h3>Interactive Search Demo</h3>
          </div>
          <div className="card-body">
            {/* Search Input */}
            <div className="controls-bar">
              <div className="input-group" style={{ flex: 1 }}>
                <input
                  type="text"
                  className="input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Enter search query..."
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSearch}
                  disabled={isSearching || !query}
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            {/* Search Options */}
            <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={e => setCaseSensitive(e.target.checked)}
                />
                Case Sensitive
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={wholeWord}
                  onChange={e => setWholeWord(e.target.checked)}
                />
                Whole Word
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={e => setUseRegex(e.target.checked)}
                />
                Use Regex
              </label>
            </div>

            {/* Results Navigation */}
            {results.length > 0 && (
              <div className="controls-bar">
                <button className="btn btn-secondary" onClick={handleFindPrevious}>
                  Previous
                </button>
                <span style={{ fontFamily: "monospace" }}>
                  {currentIndex + 1} / {results.length}
                </span>
                <button className="btn btn-secondary" onClick={handleFindNext}>
                  Next
                </button>
                <div className="separator" />
                <button className="btn btn-secondary" onClick={handleClear}>
                  Clear
                </button>
              </div>
            )}

            {/* Results List */}
            {results.length > 0 && (
              <div className="scrollable" style={{ marginTop: 16 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Page</th>
                      <th style={{ width: 100 }}>Match</th>
                      <th>Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr
                        key={index}
                        style={{
                          backgroundColor:
                            index === currentIndex ? "rgba(59, 130, 246, 0.2)" : undefined,
                          cursor: "pointer",
                        }}
                        onClick={() => setCurrentIndex(index)}
                      >
                        <td>{result.pageIndex + 1}</td>
                        <td>
                          <span className="badge badge-info">{result.text}</span>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>
                          {result.context}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {query && results.length === 0 && !isSearching && (
              <div className="empty-state">
                <h3>No Results</h3>
                <p>No matches found for "{query}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        <MetricsPanel metrics={metricsData} />

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>Using usePDFSearch Hook</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              The <code>usePDFSearch</code> hook provides a React-friendly interface for searching
              PDF documents.
            </p>
            <CodeDisplay code={basicSearchCode} filename="SearchableViewer.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>SearchEngine API</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              For more control, use the <code>SearchEngine</code> class directly. It provides events
              for progress tracking and supports cancellation.
            </p>
            <CodeDisplay code={searchEngineCode} filename="searchEngine.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Regex Search Patterns</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Use regular expressions to find emails, phone numbers, dates, and other patterns.
            </p>
            <CodeDisplay code={regexSearchCode} filename="regexSearch.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Result Highlighting</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Highlight search results on the PDF pages with custom styling.
            </p>
            <CodeDisplay code={highlightingCode} filename="SearchHighlighter.tsx" />
          </div>
        </div>

        {/* Search Options Reference */}
        <div className="card">
          <div className="card-header">
            <h3>Search Options Reference</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>caseSensitive</code>
                  </td>
                  <td>boolean</td>
                  <td>false</td>
                  <td>Match exact case</td>
                </tr>
                <tr>
                  <td>
                    <code>wholeWord</code>
                  </td>
                  <td>boolean</td>
                  <td>false</td>
                  <td>Match complete words only</td>
                </tr>
                <tr>
                  <td>
                    <code>useRegex</code>
                  </td>
                  <td>boolean</td>
                  <td>false</td>
                  <td>Treat query as regex pattern</td>
                </tr>
                <tr>
                  <td>
                    <code>startPage</code>
                  </td>
                  <td>number</td>
                  <td>0</td>
                  <td>First page to search (0-indexed)</td>
                </tr>
                <tr>
                  <td>
                    <code>endPage</code>
                  </td>
                  <td>number</td>
                  <td>pageCount</td>
                  <td>Last page to search (exclusive)</td>
                </tr>
                <tr>
                  <td>
                    <code>maxResults</code>
                  </td>
                  <td>number</td>
                  <td>Infinity</td>
                  <td>Stop after finding N results</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
