import { useState } from "react";

import { CodeDisplay } from "../utils/code-display";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "character" | "word" | "line" | "paragraph";
  text?: string;
}

// Sample bounding boxes for demonstration
const sampleBoxes: BoundingBox[] = [
  // Characters
  { x: 72, y: 720, width: 8, height: 12, type: "character", text: "H" },
  { x: 80, y: 720, width: 6, height: 12, type: "character", text: "e" },
  { x: 86, y: 720, width: 4, height: 12, type: "character", text: "l" },
  { x: 90, y: 720, width: 4, height: 12, type: "character", text: "l" },
  { x: 94, y: 720, width: 6, height: 12, type: "character", text: "o" },
  // Words
  { x: 72, y: 720, width: 28, height: 12, type: "word", text: "Hello" },
  { x: 106, y: 720, width: 35, height: 12, type: "word", text: "World" },
  { x: 150, y: 720, width: 25, height: 12, type: "word", text: "from" },
  { x: 180, y: 720, width: 35, height: 12, type: "word", text: "PDF!" },
  // Lines
  { x: 72, y: 720, width: 143, height: 12, type: "line", text: "Hello World from PDF!" },
  { x: 72, y: 700, width: 280, height: 12, type: "line", text: "This is a second line of text." },
  // Paragraphs
  {
    x: 72,
    y: 700,
    width: 280,
    height: 32,
    type: "paragraph",
    text: "Hello World from PDF!\nThis is a second line of text.",
  },
];

const typeColors = {
  character: { bg: "rgba(239, 68, 68, 0.3)", border: "rgba(239, 68, 68, 0.8)" },
  word: { bg: "rgba(59, 130, 246, 0.3)", border: "rgba(59, 130, 246, 0.8)" },
  line: { bg: "rgba(34, 197, 94, 0.3)", border: "rgba(34, 197, 94, 0.8)" },
  paragraph: { bg: "rgba(168, 85, 247, 0.3)", border: "rgba(168, 85, 247, 0.8)" },
};

export function HighlightingExample() {
  const [visibility, setVisibility] = useState({
    character: false,
    word: true,
    line: false,
    paragraph: false,
  });
  const [hoveredBox, setHoveredBox] = useState<BoundingBox | null>(null);

  const toggleVisibility = (type: BoundingBox["type"]) => {
    setVisibility(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const visibleBoxes = sampleBoxes.filter(box => visibility[box.type]);

  const boundingBoxHookCode = `import { useBoundingBoxOverlay } from "@dvvebond/core/react";
import type { BoundingBoxType, OverlayBoundingBox } from "@dvvebond/core";

function BoundingBoxViewer({ pageIndex, boundingBoxes }) {
  const { state, actions, overlay } = useBoundingBoxOverlay({
    enabled: true,
    initialVisibility: {
      character: false,
      word: true,
      line: true,
      paragraph: false,
    },
    onVisibilityChange: (visibility) => {
      console.log("Visibility changed:", visibility);
    },
  });

  // Set bounding boxes for the page
  useEffect(() => {
    actions.setBoundingBoxes(pageIndex, boundingBoxes);

    return () => {
      actions.clearBoundingBoxes(pageIndex);
    };
  }, [pageIndex, boundingBoxes]);

  // Toggle controls
  const handleToggle = (type: BoundingBoxType) => {
    actions.toggleVisibility(type);
  };

  return (
    <div>
      <button onClick={() => handleToggle("character")}>
        Characters {state.visibility.character ? "ON" : "OFF"}
      </button>
      <button onClick={() => handleToggle("word")}>
        Words {state.visibility.word ? "ON" : "OFF"}
      </button>
      <button onClick={() => handleToggle("line")}>
        Lines {state.visibility.line ? "ON" : "OFF"}
      </button>
      <button onClick={() => handleToggle("paragraph")}>
        Paragraphs {state.visibility.paragraph ? "ON" : "OFF"}
      </button>
    </div>
  );
}`;

  const snippetHighlightCode = `import { usePDFSnippetHighlight } from "@dvvebond/core/react";

// Highlight snippets from search results or text selection
function TextHighlighter({ searchResults, selectedText }) {
  const {
    highlights,
    addHighlight,
    removeHighlight,
    clearHighlights,
    setHighlightStyle,
  } = usePDFSnippetHighlight();

  // Highlight search results
  useEffect(() => {
    clearHighlights();

    searchResults.forEach((result, index) => {
      addHighlight({
        id: \`search-\${index}\`,
        pageIndex: result.pageIndex,
        startOffset: result.startOffset,
        endOffset: result.endOffset,
        style: {
          backgroundColor: "rgba(255, 255, 0, 0.4)",
          borderRadius: "2px",
        },
      });
    });
  }, [searchResults]);

  // Highlight selected text differently
  useEffect(() => {
    if (selectedText) {
      addHighlight({
        id: "selection",
        pageIndex: selectedText.pageIndex,
        startOffset: selectedText.startOffset,
        endOffset: selectedText.endOffset,
        style: {
          backgroundColor: "rgba(100, 150, 255, 0.4)",
          border: "1px solid rgba(100, 150, 255, 0.8)",
        },
      });
    }

    return () => removeHighlight("selection");
  }, [selectedText]);

  return null;
}`;

  const customColorsCode = `import {
  BoundingBoxOverlay,
  createBoundingBoxOverlay,
  DEFAULT_BOUNDING_BOX_COLORS,
  type BoundingBoxColors,
} from "@dvvebond/core";

// Custom color configuration
const customColors: BoundingBoxColors = {
  character: "rgba(255, 0, 0, 0.2)",   // Red tint
  word: "rgba(0, 100, 255, 0.2)",       // Blue tint
  line: "rgba(0, 200, 100, 0.2)",       // Green tint
  paragraph: "rgba(150, 0, 255, 0.2)",  // Purple tint
};

const customBorderColors: BoundingBoxColors = {
  character: "rgba(255, 0, 0, 0.8)",
  word: "rgba(0, 100, 255, 0.8)",
  line: "rgba(0, 200, 100, 0.8)",
  paragraph: "rgba(150, 0, 255, 0.8)",
};

// Create overlay with custom colors
const overlay = createBoundingBoxOverlay({
  colors: customColors,
  borderColors: customBorderColors,
  borderWidth: 1,
  showLabels: true,  // Show type labels on hover
});

// Or update colors dynamically
overlay.setColors({
  word: "rgba(255, 200, 0, 0.3)",  // Change word color to yellow
});`;

  const extractionCode = `import {
  HierarchicalTextExtractor,
  createHierarchicalTextExtractor,
  groupCharactersIntoPage,
  type TextPage,
} from "@dvvebond/core";

// Extract text with hierarchical bounding boxes
async function extractBoundingBoxes(pdf: PDF, pageIndex: number): Promise<TextPage> {
  const extractor = createHierarchicalTextExtractor({
    // Grouping thresholds (as fractions of character/line metrics)
    wordGapThreshold: 0.3,      // Gap > 30% of char width = new word
    lineGapThreshold: 1.5,      // Gap > 150% of line height = new line
    paragraphGapThreshold: 2.0, // Gap > 200% of line height = new paragraph
  });

  const page = pdf.getPage(pageIndex);
  const textPage = await extractor.extractPage(page);

  // textPage structure:
  // {
  //   pageIndex: number,
  //   width: number,
  //   height: number,
  //   characters: Character[],
  //   words: Word[],
  //   lines: Line[],
  //   paragraphs: Paragraph[],
  // }

  return textPage;
}

// Convert to overlay format
function toOverlayBoxes(textPage: TextPage): OverlayBoundingBox[] {
  return [
    ...textPage.characters.map(c => ({
      ...c.boundingBox,
      type: "character" as const,
      text: c.text,
    })),
    ...textPage.words.map(w => ({
      ...w.boundingBox,
      type: "word" as const,
      text: w.text,
    })),
    ...textPage.lines.map(l => ({
      ...l.boundingBox,
      type: "line" as const,
      text: l.text,
    })),
    ...textPage.paragraphs.map(p => ({
      ...p.boundingBox,
      type: "paragraph" as const,
      text: p.text,
    })),
  ];
}`;

  return (
    <>
      <div className="page-header">
        <h2>Bounding Box Highlighting</h2>
        <p>
          Visualize text structure with bounding boxes at character, word, line, and paragraph
          levels. Useful for debugging, text extraction verification, and building interactive text
          selection features.
        </p>
      </div>

      <div className="page-content">
        {/* Interactive Demo */}
        <div className="card">
          <div className="card-header">
            <h3>Interactive Bounding Box Demo</h3>
          </div>
          <div className="card-body">
            {/* Toggle Controls */}
            <div className="toggle-group">
              <button
                className={`toggle-btn ${visibility.character ? "active" : ""}`}
                onClick={() => toggleVisibility("character")}
                style={{ borderColor: typeColors.character.border }}
              >
                Characters
              </button>
              <button
                className={`toggle-btn ${visibility.word ? "active" : ""}`}
                onClick={() => toggleVisibility("word")}
                style={{ borderColor: typeColors.word.border }}
              >
                Words
              </button>
              <button
                className={`toggle-btn ${visibility.line ? "active" : ""}`}
                onClick={() => toggleVisibility("line")}
                style={{ borderColor: typeColors.line.border }}
              >
                Lines
              </button>
              <button
                className={`toggle-btn ${visibility.paragraph ? "active" : ""}`}
                onClick={() => toggleVisibility("paragraph")}
                style={{ borderColor: typeColors.paragraph.border }}
              >
                Paragraphs
              </button>
            </div>

            {/* Simulated Page with Bounding Boxes */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 300,
                backgroundColor: "#fff",
                borderRadius: 8,
                overflow: "hidden",
                fontFamily: "Georgia, serif",
              }}
            >
              {/* Text content */}
              <div style={{ padding: 40, color: "#333" }}>
                <div style={{ marginBottom: 16, fontSize: 16 }}>Hello World from PDF!</div>
                <div style={{ fontSize: 16 }}>This is a second line of text.</div>
              </div>

              {/* Bounding box overlays */}
              {visibleBoxes.map((box, index) => {
                const colors = typeColors[box.type];
                // Simple coordinate mapping for demo
                const screenX = (box.x / 612) * 500 + 20;
                const screenY = 300 - (box.y / 792) * 300;
                const screenWidth = (box.width / 612) * 500;
                const screenHeight = (box.height / 792) * 300;

                return (
                  <div
                    key={`${box.type}-${index}`}
                    style={{
                      position: "absolute",
                      left: screenX,
                      top: screenY,
                      width: screenWidth,
                      height: screenHeight,
                      backgroundColor: colors.bg,
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={() => setHoveredBox(box)}
                    onMouseLeave={() => setHoveredBox(null)}
                  />
                );
              })}
            </div>

            {/* Hovered box info */}
            {hoveredBox && (
              <div className="coordinate-display" style={{ marginTop: 16 }}>
                <div>
                  <span className="coord-label">Type:</span>
                  <span className="coord-value">{hoveredBox.type}</span>
                </div>
                <div>
                  <span className="coord-label">Text:</span>
                  <span className="coord-value">"{hoveredBox.text}"</span>
                </div>
                <div>
                  <span className="coord-label">Position:</span>
                  <span className="coord-value">
                    ({hoveredBox.x}, {hoveredBox.y})
                  </span>
                </div>
                <div>
                  <span className="coord-label">Size:</span>
                  <span className="coord-value">
                    {hoveredBox.width} x {hoveredBox.height}
                  </span>
                </div>
              </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
              {(
                Object.entries(typeColors) as Array<
                  [BoundingBox["type"], typeof typeColors.character]
                >
              ).map(([type, colors]) => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 2,
                    }}
                  />
                  <span style={{ fontSize: "0.875rem", textTransform: "capitalize" }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>Using useBoundingBoxOverlay Hook</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              The <code>useBoundingBoxOverlay</code> hook manages bounding box visibility and
              provides methods for setting boxes on each page.
            </p>
            <CodeDisplay code={boundingBoxHookCode} filename="BoundingBoxViewer.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Snippet Highlighting</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Use <code>usePDFSnippetHighlight</code> for highlighting specific text ranges, such as
              search results or user selections.
            </p>
            <CodeDisplay code={snippetHighlightCode} filename="TextHighlighter.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Custom Colors</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Customize the colors for each bounding box type to match your application's theme.
            </p>
            <CodeDisplay code={customColorsCode} filename="customColors.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Text Extraction with Bounding Boxes</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Extract hierarchical text structure with bounding boxes at each level.
            </p>
            <CodeDisplay code={extractionCode} filename="textExtraction.ts" />
          </div>
        </div>

        {/* Box Types Reference */}
        <div className="card">
          <div className="card-header">
            <h3>Bounding Box Types</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Use Case</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: typeColors.character.bg,
                        color: typeColors.character.border,
                      }}
                    >
                      Character
                    </span>
                  </td>
                  <td>Individual character bounding boxes</td>
                  <td>Precise text selection, OCR verification</td>
                </tr>
                <tr>
                  <td>
                    <span
                      className="badge"
                      style={{ backgroundColor: typeColors.word.bg, color: typeColors.word.border }}
                    >
                      Word
                    </span>
                  </td>
                  <td>Word-level groupings based on spacing</td>
                  <td>Search highlighting, click-to-select</td>
                </tr>
                <tr>
                  <td>
                    <span
                      className="badge"
                      style={{ backgroundColor: typeColors.line.bg, color: typeColors.line.border }}
                    >
                      Line
                    </span>
                  </td>
                  <td>Lines of text based on vertical position</td>
                  <td>Line-by-line reading, table row detection</td>
                </tr>
                <tr>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: typeColors.paragraph.bg,
                        color: typeColors.paragraph.border,
                      }}
                    >
                      Paragraph
                    </span>
                  </td>
                  <td>Groups of lines separated by larger gaps</td>
                  <td>Content blocks, section detection</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
