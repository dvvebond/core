import { useState } from "react";

import { CodeDisplay } from "../utils/code-display";
import { MetricsPanel } from "../utils/metrics";

interface MockAzureBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  type: "word" | "line" | "paragraph";
  confidence: number;
}

// Simulated Azure Document Intelligence response
const mockAzureResponse: MockAzureBoundingBox[] = [
  {
    x: 72,
    y: 720,
    width: 150,
    height: 14,
    text: "Invoice Number:",
    type: "word",
    confidence: 0.98,
  },
  { x: 230, y: 720, width: 80, height: 14, text: "INV-2024-001", type: "word", confidence: 0.99 },
  { x: 72, y: 700, width: 80, height: 14, text: "Date:", type: "word", confidence: 0.97 },
  {
    x: 160,
    y: 700,
    width: 100,
    height: 14,
    text: "March 17, 2024",
    type: "word",
    confidence: 0.96,
  },
  {
    x: 72,
    y: 660,
    width: 400,
    height: 14,
    text: "This is a sample invoice line item description",
    type: "line",
    confidence: 0.95,
  },
  {
    x: 72,
    y: 600,
    width: 450,
    height: 60,
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    type: "paragraph",
    confidence: 0.94,
  },
];

export function AzureIntegrationExample() {
  const [visibility, setVisibility] = useState({
    word: true,
    line: true,
    paragraph: true,
  });
  const [selectedBox, setSelectedBox] = useState<MockAzureBoundingBox | null>(null);

  const toggleVisibility = (type: "word" | "line" | "paragraph") => {
    setVisibility(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const visibleBoxes = mockAzureResponse.filter(box => visibility[box.type]);

  const metricsData = [
    { label: "Total Boxes", value: mockAzureResponse.length },
    { label: "Words", value: mockAzureResponse.filter(b => b.type === "word").length },
    { label: "Lines", value: mockAzureResponse.filter(b => b.type === "line").length },
    { label: "Paragraphs", value: mockAzureResponse.filter(b => b.type === "paragraph").length },
    {
      label: "Avg Confidence",
      value: `${((mockAzureResponse.reduce((s, b) => s + b.confidence, 0) / mockAzureResponse.length) * 100).toFixed(1)}%`,
    },
  ];

  const azureIntegrationCode = `import { usePDFBoundingBoxHighlight } from "@dvvebond/core/react";
import {
  transformBoundingBoxes,
  createTransformerForPageContainer,
} from "@dvvebond/core";

// Azure Document Intelligence returns coordinates in a different coordinate system
// We need to transform them to screen coordinates for display

interface AzureBoundingBox {
  polygon: number[];  // [x1, y1, x2, y2, x3, y3, x4, y4]
  content: string;
  confidence: number;
}

function useAzureBoundingBoxes(
  azureResult: AzureBoundingBox[],
  pageContainer: HTMLElement | null,
  scale: number,
  pageHeight: number
) {
  const { setBoundingBoxes } = usePDFBoundingBoxHighlight();

  useEffect(() => {
    if (!pageContainer || !azureResult.length) return;

    // Create transformer for the page
    const transformer = createTransformerForPageContainer({
      containerElement: pageContainer,
      pageWidth: 612,  // Letter width in points
      pageHeight,
      scale,
      rotation: 0,
    });

    // Transform Azure coordinates to screen coordinates
    const screenBoxes = azureResult.map(box => {
      // Azure uses polygon coordinates [x1,y1, x2,y2, x3,y3, x4,y4]
      const [x1, y1, x2, y2, x3, y3, x4, y4] = box.polygon;

      // Calculate bounding rectangle
      const minX = Math.min(x1, x2, x3, x4);
      const maxX = Math.max(x1, x2, x3, x4);
      const minY = Math.min(y1, y2, y3, y4);
      const maxY = Math.max(y1, y2, y3, y4);

      // Azure Y-axis is top-down, PDF is bottom-up
      const pdfBox = {
        x: minX,
        y: pageHeight - maxY,  // Flip Y coordinate
        width: maxX - minX,
        height: maxY - minY,
      };

      // Transform to screen coordinates
      return transformer.pdfToScreen(pdfBox);
    });

    setBoundingBoxes(0, screenBoxes.map((box, i) => ({
      ...box,
      type: "word" as const,
      text: azureResult[i].content,
    })));
  }, [azureResult, pageContainer, scale, pageHeight, setBoundingBoxes]);
}`;

  const coordinateConversionCode = `import {
  CoordinateTransformer,
  createCoordinateTransformer,
} from "@dvvebond/core";

// Create a coordinate transformer for a specific page
const transformer = createCoordinateTransformer({
  pageWidth: 612,      // PDF page width in points
  pageHeight: 792,     // PDF page height in points
  scale: 1.5,          // Current zoom level
  rotation: 0,         // Rotation in degrees (0, 90, 180, 270)
  offsetX: 0,          // Container offset X
  offsetY: 0,          // Container offset Y
});

// Azure Document Intelligence coordinate conversion
function azureToPdfCoordinates(
  azureBox: { x: number; y: number; width: number; height: number },
  pageHeightInches: number,
  dpi: number = 72  // PDF points per inch
): { x: number; y: number; width: number; height: number } {
  // Azure uses inches with origin at top-left
  // PDF uses points with origin at bottom-left
  return {
    x: azureBox.x * dpi,
    y: (pageHeightInches - azureBox.y - azureBox.height) * dpi,
    width: azureBox.width * dpi,
    height: azureBox.height * dpi,
  };
}

// Convert PDF coordinates to screen coordinates
function pdfToScreenCoordinates(
  pdfBox: { x: number; y: number; width: number; height: number },
  transformer: CoordinateTransformer
) {
  const topLeft = transformer.pdfToScreen({ x: pdfBox.x, y: pdfBox.y });
  const bottomRight = transformer.pdfToScreen({
    x: pdfBox.x + pdfBox.width,
    y: pdfBox.y + pdfBox.height
  });

  return {
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}`;

  const hierarchicalExtractionCode = `import {
  HierarchicalTextExtractor,
  createHierarchicalTextExtractor,
  type TextPage,
  type Character,
  type Word,
  type Line,
  type Paragraph,
} from "@dvvebond/core";

// Create the extractor
const extractor = createHierarchicalTextExtractor({
  wordGapThreshold: 0.3,     // Factor of character width
  lineGapThreshold: 1.5,     // Factor of line height
  paragraphGapThreshold: 2.0 // Factor of line height
});

// Extract hierarchical text structure
async function extractTextWithBoundingBoxes(pdfDocument: PDF) {
  const result: TextPage[] = [];

  for (let i = 0; i < pdfDocument.getPageCount(); i++) {
    const page = pdfDocument.getPage(i);
    const textPage = await extractor.extractPage(page);

    // textPage contains:
    // - characters: Character[] with individual character bounding boxes
    // - words: Word[] with word-level bounding boxes
    // - lines: Line[] with line-level bounding boxes
    // - paragraphs: Paragraph[] with paragraph-level bounding boxes

    result.push(textPage);
  }

  return result;
}

// Use the extracted data
const textPages = await extractTextWithBoundingBoxes(pdf);
const firstPage = textPages[0];

// Access characters
firstPage.characters.forEach(char => {
  console.log(char.text, char.boundingBox);
  // { text: "H", boundingBox: { x: 72, y: 720, width: 8, height: 12 } }
});

// Access words (grouped characters)
firstPage.words.forEach(word => {
  console.log(word.text, word.boundingBox);
  // { text: "Hello", boundingBox: { x: 72, y: 720, width: 40, height: 12 } }
});

// Access lines
firstPage.lines.forEach(line => {
  console.log(line.text, line.boundingBox);
  // { text: "Hello World", boundingBox: { x: 72, y: 720, width: 100, height: 12 } }
});`;

  return (
    <>
      <div className="page-header">
        <h2>Azure Document Intelligence Integration</h2>
        <p>
          Integrate Azure Document Intelligence (formerly Form Recognizer) OCR results with the PDF
          viewer. Transform Azure coordinates to PDF coordinates and display bounding boxes on the
          rendered pages.
        </p>
      </div>

      <div className="page-content">
        {/* Live Demo */}
        <div className="card">
          <div className="card-header">
            <h3>Live Coordinate Mapping Demo</h3>
          </div>
          <div className="card-body">
            <div className="info-box info">
              <p>
                This demo shows how Azure Document Intelligence bounding boxes can be mapped to PDF
                coordinates. Click on any box to see its details.
              </p>
            </div>

            {/* Toggle controls */}
            <div className="toggle-group">
              <button
                className={`toggle-btn ${visibility.word ? "active" : ""}`}
                onClick={() => toggleVisibility("word")}
              >
                Words ({mockAzureResponse.filter(b => b.type === "word").length})
              </button>
              <button
                className={`toggle-btn ${visibility.line ? "active" : ""}`}
                onClick={() => toggleVisibility("line")}
              >
                Lines ({mockAzureResponse.filter(b => b.type === "line").length})
              </button>
              <button
                className={`toggle-btn ${visibility.paragraph ? "active" : ""}`}
                onClick={() => toggleVisibility("paragraph")}
              >
                Paragraphs ({mockAzureResponse.filter(b => b.type === "paragraph").length})
              </button>
            </div>

            {/* Simulated PDF with bounding boxes */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 400,
                backgroundColor: "#fff",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {/* Simulated page content */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 40,
                  fontFamily: "Georgia, serif",
                  fontSize: 12,
                  color: "#333",
                }}
              >
                <div style={{ marginBottom: 20 }}>
                  <strong>Invoice Number:</strong> INV-2024-001
                </div>
                <div style={{ marginBottom: 20 }}>
                  <strong>Date:</strong> March 17, 2024
                </div>
                <div style={{ marginBottom: 20 }}>
                  This is a sample invoice line item description
                </div>
                <div style={{ marginBottom: 20 }}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua.
                </div>
              </div>

              {/* Bounding box overlays */}
              {visibleBoxes.map((box, index) => {
                const colors = {
                  word: "rgba(59, 130, 246, 0.3)",
                  line: "rgba(34, 197, 94, 0.3)",
                  paragraph: "rgba(168, 85, 247, 0.3)",
                };
                const borderColors = {
                  word: "rgba(59, 130, 246, 0.8)",
                  line: "rgba(34, 197, 94, 0.8)",
                  paragraph: "rgba(168, 85, 247, 0.8)",
                };

                // Simple mapping for demo (not real coordinate transform)
                const screenY = 400 - (box.y / 792) * 400;
                const screenX = (box.x / 612) * 500 + 20;
                const screenWidth = (box.width / 612) * 500;
                const screenHeight = (box.height / 792) * 400;

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedBox(box)}
                    style={{
                      position: "absolute",
                      left: screenX,
                      top: screenY,
                      width: screenWidth,
                      height: screenHeight,
                      backgroundColor: colors[box.type],
                      border: `1px solid ${borderColors[box.type]}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = borderColors[box.type];
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = colors[box.type];
                    }}
                  />
                );
              })}
            </div>

            {/* Selected box details */}
            {selectedBox && (
              <div style={{ marginTop: 16 }}>
                <div className="coordinate-display">
                  <div>
                    <span className="coord-label">Type:</span>
                    <span className="coord-value">{selectedBox.type}</span>
                  </div>
                  <div>
                    <span className="coord-label">Text:</span>
                    <span className="coord-value">"{selectedBox.text}"</span>
                  </div>
                  <div>
                    <span className="coord-label">PDF Coords:</span>
                    <span className="coord-value">
                      ({selectedBox.x}, {selectedBox.y}) {selectedBox.width}x{selectedBox.height}
                    </span>
                  </div>
                  <div>
                    <span className="coord-label">Confidence:</span>
                    <span className="coord-value">
                      {(selectedBox.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        <MetricsPanel metrics={metricsData} />

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>Azure Bounding Box Integration</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Use the <code>usePDFBoundingBoxHighlight</code> hook to display Azure OCR results as
              overlay boxes on your PDF.
            </p>
            <CodeDisplay code={azureIntegrationCode} filename="useAzureBoundingBoxes.tsx" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Coordinate Conversion Utilities</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              The library provides coordinate transformation utilities to convert between different
              coordinate systems (Azure, PDF, Screen).
            </p>
            <CodeDisplay code={coordinateConversionCode} filename="coordinates.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Hierarchical Text Extraction</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Extract text with character, word, line, and paragraph-level bounding boxes directly
              from PDFs without relying on external OCR services.
            </p>
            <CodeDisplay code={hierarchicalExtractionCode} filename="textExtraction.ts" />
          </div>
        </div>

        {/* Coordinate System Reference */}
        <div className="card">
          <div className="card-header">
            <h3>Coordinate System Reference</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Origin</th>
                  <th>Y Direction</th>
                  <th>Units</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>PDF</td>
                  <td>Bottom-left</td>
                  <td>Up (positive)</td>
                  <td>Points (1/72 inch)</td>
                </tr>
                <tr>
                  <td>Azure Document Intelligence</td>
                  <td>Top-left</td>
                  <td>Down (positive)</td>
                  <td>Inches</td>
                </tr>
                <tr>
                  <td>Screen/DOM</td>
                  <td>Top-left</td>
                  <td>Down (positive)</td>
                  <td>Pixels</td>
                </tr>
              </tbody>
            </table>

            <div className="info-box warning" style={{ marginTop: 16 }}>
              <p>
                <strong>Important:</strong> When converting Azure coordinates to PDF coordinates,
                you must flip the Y-axis and convert from inches to points (multiply by 72). The{" "}
                <code>CoordinateTransformer</code> class handles scale and rotation automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
