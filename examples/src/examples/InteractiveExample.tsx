import { useState, useCallback, useRef } from "react";

import { CodeDisplay } from "../utils/code-display";
import { CoordinateDisplay } from "../utils/metrics";

interface ClickPosition {
  screenX: number;
  screenY: number;
  pdfX: number;
  pdfY: number;
  elementX: number;
  elementY: number;
}

export function InteractiveExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clickHistory, setClickHistory] = useState<ClickPosition[]>([]);
  const [currentPosition, setCurrentPosition] = useState<ClickPosition | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Simulated page dimensions (Letter size in points)
  const pageWidth = 612;
  const pageHeight = 792;

  // Container dimensions for demo
  const containerWidth = 500;
  const containerHeight = 650;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const elementX = e.clientX - rect.left;
      const elementY = e.clientY - rect.top;

      // Convert to PDF coordinates
      const scaleFactorX = pageWidth / (containerWidth * scale);
      const scaleFactorY = pageHeight / (containerHeight * scale);

      // PDF has origin at bottom-left, screen has origin at top-left
      const pdfX = elementX * scaleFactorX;
      const pdfY = pageHeight - elementY * scaleFactorY;

      setCurrentPosition({
        screenX: e.clientX,
        screenY: e.clientY,
        pdfX,
        pdfY,
        elementX,
        elementY,
      });
    },
    [scale],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (currentPosition) {
        setClickHistory(prev => [...prev.slice(-9), currentPosition]);
      }
    },
    [currentPosition],
  );

  const handleClearHistory = () => {
    setClickHistory([]);
  };

  const coordinateTransformCode = `import {
  CoordinateTransformer,
  createCoordinateTransformer,
  getMousePdfCoordinates,
  type Point2D,
} from "@dvvebond/core";

// Create a transformer for a page
const transformer = createCoordinateTransformer({
  pageWidth: 612,       // PDF width in points
  pageHeight: 792,      // PDF height in points
  scale: 1.5,           // Current zoom level
  rotation: 0,          // Rotation in degrees
  offsetX: 0,           // Container X offset
  offsetY: 0,           // Container Y offset
});

// Convert screen coordinates to PDF coordinates
function handleClick(event: MouseEvent, container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  const screenPoint: Point2D = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  const pdfPoint = transformer.screenToPdf(screenPoint);
  console.log(\`PDF coordinates: (\${pdfPoint.x}, \${pdfPoint.y})\`);
}

// Or use the convenience function
function handleMouseClick(event: MouseEvent, pageContainer: HTMLElement) {
  const result = getMousePdfCoordinates(event, {
    containerElement: pageContainer,
    pageWidth: 612,
    pageHeight: 792,
    scale: 1.5,
    rotation: 0,
  });

  console.log(\`
    Screen: (\${result.screenX}, \${result.screenY})
    PDF: (\${result.pdfX}, \${result.pdfY})
    Element: (\${result.elementX}, \${result.elementY})
  \`);
}`;

  const hitTestingCode = `import {
  hitTestBoundingBoxes,
  findAllBoxesAtPoint,
  type OverlayBoundingBox,
  type Point2D,
} from "@dvvebond/core";

// Check which bounding box contains a point
function handleClick(
  pdfPoint: Point2D,
  boundingBoxes: OverlayBoundingBox[]
) {
  // Find the topmost (smallest) box at this point
  const hitBox = hitTestBoundingBoxes(pdfPoint, boundingBoxes);

  if (hitBox) {
    console.log(\`Clicked on: \${hitBox.type} - "\${hitBox.text}"\`);
    return hitBox;
  }

  return null;
}

// Find ALL boxes containing this point (for nested boxes)
function findAllAtPoint(
  pdfPoint: Point2D,
  boundingBoxes: OverlayBoundingBox[]
) {
  // Returns array sorted from smallest to largest
  const allBoxes = findAllBoxesAtPoint(pdfPoint, boundingBoxes);

  allBoxes.forEach(box => {
    console.log(\`  - \${box.type}: "\${box.text}"\`);
  });

  return allBoxes;
}

// Example with hierarchy
const boxes: OverlayBoundingBox[] = [
  { x: 72, y: 720, width: 30, height: 12, type: "word", text: "Hello" },
  { x: 72, y: 720, width: 100, height: 12, type: "line", text: "Hello World" },
  { x: 72, y: 700, width: 200, height: 50, type: "paragraph", text: "..." },
];

// Click at (80, 725) might return:
// [
//   { type: "word", text: "Hello" },     // smallest
//   { type: "line", text: "Hello World" },
//   { type: "paragraph", text: "..." }   // largest
// ]`;

  const selectionCode = `import {
  createSelectionRect,
  findBoxesInSelection,
  type OverlayBoundingBox,
  type Rect2D,
} from "@dvvebond/core";

// Track selection rectangle
let selectionStart: Point2D | null = null;

function handleMouseDown(pdfPoint: Point2D) {
  selectionStart = pdfPoint;
}

function handleMouseUp(pdfPoint: Point2D, boxes: OverlayBoundingBox[]) {
  if (!selectionStart) return;

  // Create normalized rectangle (handles any drag direction)
  const selectionRect = createSelectionRect(selectionStart, pdfPoint);

  // Find all boxes that intersect the selection
  const selectedBoxes = findBoxesInSelection(selectionRect, boxes, {
    // Optional: require boxes to be fully contained
    requireFullContainment: false,
    // Optional: filter by type
    types: ["word", "character"],
  });

  console.log(\`Selected \${selectedBoxes.length} boxes\`);

  // Get the text from selected boxes
  const selectedText = selectedBoxes
    .filter(box => box.type === "word")
    .map(box => box.text)
    .join(" ");

  console.log(\`Selected text: "\${selectedText}"\`);

  selectionStart = null;
}`;

  const touchCoordinatesCode = `import {
  getTouchPdfCoordinates,
  type MouseCoordinateOptions,
} from "@dvvebond/core";

// Handle touch events for mobile devices
function handleTouchStart(
  event: TouchEvent,
  pageContainer: HTMLElement,
  options: MouseCoordinateOptions
) {
  // Get coordinates for the first touch point
  const result = getTouchPdfCoordinates(event, options);

  if (result) {
    console.log(\`Touch at PDF: (\${result.pdfX}, \${result.pdfY})\`);
  }
}

// Multi-touch handling
function handleMultiTouch(
  event: TouchEvent,
  pageContainer: HTMLElement,
  options: MouseCoordinateOptions
) {
  const touches = Array.from(event.touches);

  const coordinates = touches.map((touch, index) => {
    const result = getTouchPdfCoordinates(
      { touches: [touch] } as TouchEvent,
      options
    );
    return { index, ...result };
  });

  // Calculate pinch-to-zoom distance
  if (coordinates.length === 2) {
    const [p1, p2] = coordinates;
    const distance = Math.sqrt(
      Math.pow(p1.screenX - p2.screenX, 2) +
      Math.pow(p1.screenY - p2.screenY, 2)
    );
    console.log(\`Pinch distance: \${distance}px\`);
  }
}`;

  return (
    <>
      <div className="page-header">
        <h2>Interactive Coordinates</h2>
        <p>
          Click-to-coordinate conversion for building interactive PDF features like annotation
          placement, text selection, and hit testing.
        </p>
      </div>

      <div className="page-content">
        {/* Interactive Demo */}
        <div className="card">
          <div className="card-header">
            <h3>Click-to-Coordinates Demo</h3>
            <div className="btn-group">
              <button className="btn btn-secondary btn-sm" onClick={handleClearHistory}>
                Clear History
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="split-layout">
              {/* Interactive Canvas */}
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ marginRight: 16 }}>
                    Scale:
                    <select
                      value={scale}
                      onChange={e => setScale(Number(e.target.value))}
                      style={{ marginLeft: 8 }}
                      className="input"
                    >
                      <option value={0.5}>50%</option>
                      <option value={0.75}>75%</option>
                      <option value={1}>100%</option>
                      <option value={1.25}>125%</option>
                      <option value={1.5}>150%</option>
                      <option value={2}>200%</option>
                    </select>
                  </label>
                  <label>
                    Rotation:
                    <select
                      value={rotation}
                      onChange={e => setRotation(Number(e.target.value))}
                      style={{ marginLeft: 8 }}
                      className="input"
                    >
                      <option value={0}>0°</option>
                      <option value={90}>90°</option>
                      <option value={180}>180°</option>
                      <option value={270}>270°</option>
                    </select>
                  </label>
                </div>

                <div
                  ref={containerRef}
                  onMouseMove={handleMouseMove}
                  onClick={handleClick}
                  style={{
                    width: containerWidth,
                    height: containerHeight,
                    backgroundColor: "#fff",
                    borderRadius: 8,
                    cursor: "crosshair",
                    position: "relative",
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                    transformOrigin: "top left",
                  }}
                >
                  {/* Grid lines */}
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={`h-${i}`}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: `${(i + 1) * 10}%`,
                        height: 1,
                        backgroundColor: "rgba(0,0,0,0.1)",
                      }}
                    />
                  ))}
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={`v-${i}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${(i + 1) * 10}%`,
                        width: 1,
                        backgroundColor: "rgba(0,0,0,0.1)",
                      }}
                    />
                  ))}

                  {/* Page info */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      fontSize: 12,
                      color: "#666",
                    }}
                  >
                    {pageWidth} x {pageHeight} pt
                  </div>

                  {/* Click markers */}
                  {clickHistory.map((pos, index) => (
                    <div
                      key={index}
                      style={{
                        position: "absolute",
                        left: pos.elementX - 5,
                        top: pos.elementY - 5,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: `rgba(59, 130, 246, ${0.3 + (index / clickHistory.length) * 0.7})`,
                        border: "2px solid rgba(59, 130, 246, 0.8)",
                      }}
                    />
                  ))}

                  {/* Current position crosshair */}
                  {currentPosition && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: currentPosition.elementX,
                          top: 0,
                          width: 1,
                          height: "100%",
                          backgroundColor: "rgba(255, 100, 100, 0.5)",
                          pointerEvents: "none",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: currentPosition.elementY,
                          left: 0,
                          height: 1,
                          width: "100%",
                          backgroundColor: "rgba(255, 100, 100, 0.5)",
                          pointerEvents: "none",
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Coordinates Display */}
              <div>
                {currentPosition ? (
                  <CoordinateDisplay
                    screenX={currentPosition.screenX}
                    screenY={currentPosition.screenY}
                    pdfX={currentPosition.pdfX}
                    pdfY={currentPosition.pdfY}
                    scale={scale}
                    rotation={rotation}
                  />
                ) : (
                  <div className="empty-state">
                    <p>Move mouse over the page to see coordinates</p>
                  </div>
                )}

                {clickHistory.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ marginBottom: 8, fontSize: "0.875rem" }}>Click History</h4>
                    <div className="scrollable" style={{ maxHeight: 200 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>PDF X</th>
                            <th>PDF Y</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clickHistory.map((pos, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td style={{ fontFamily: "monospace" }}>{pos.pdfX.toFixed(2)}</td>
                              <td style={{ fontFamily: "monospace" }}>{pos.pdfY.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="card">
          <div className="card-header">
            <h3>Coordinate Transformation</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Convert between screen coordinates and PDF coordinates using the
              <code>CoordinateTransformer</code> class or convenience functions.
            </p>
            <CodeDisplay code={coordinateTransformCode} filename="coordinates.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Hit Testing</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Determine which bounding boxes contain a given point for click handling.
            </p>
            <CodeDisplay code={hitTestingCode} filename="hitTesting.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Selection Rectangle</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Implement click-and-drag selection to select multiple bounding boxes.
            </p>
            <CodeDisplay code={selectionCode} filename="selection.ts" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Touch Coordinates</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Handle touch events for mobile devices including pinch-to-zoom.
            </p>
            <CodeDisplay code={touchCoordinatesCode} filename="touch.ts" />
          </div>
        </div>

        {/* Coordinate Reference */}
        <div className="card">
          <div className="card-header">
            <h3>Coordinate System Reference</h3>
          </div>
          <div className="card-body">
            <div className="info-box info">
              <p>
                <strong>PDF Coordinates:</strong> Origin at bottom-left, Y increases upward. Units
                are points (1 point = 1/72 inch). Letter size is 612 x 792 points.
              </p>
            </div>
            <div className="info-box info">
              <p>
                <strong>Screen Coordinates:</strong> Origin at top-left of the container, Y
                increases downward. Units are pixels. Affected by scale and rotation.
              </p>
            </div>
            <table className="table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Page Size</th>
                  <th>Width (pt)</th>
                  <th>Height (pt)</th>
                  <th>Inches</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Letter</td>
                  <td>612</td>
                  <td>792</td>
                  <td>8.5 x 11</td>
                </tr>
                <tr>
                  <td>Legal</td>
                  <td>612</td>
                  <td>1008</td>
                  <td>8.5 x 14</td>
                </tr>
                <tr>
                  <td>A4</td>
                  <td>595</td>
                  <td>842</td>
                  <td>8.27 x 11.69</td>
                </tr>
                <tr>
                  <td>A3</td>
                  <td>842</td>
                  <td>1191</td>
                  <td>11.69 x 16.54</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
