/**
 * Rendering Types Detection Demo
 *
 * Demonstrates the PDF rendering type detection and classification system.
 * This demo analyzes PDF pages to detect their content type (Vector, ImageBased,
 * OCR, Flattened, Hybrid) and shows optimized rendering strategies for each.
 */

import { PDF } from "../src/api/pdf";
import {
  ContentAnalyzer,
  createContentAnalyzer,
  analyzeContent,
} from "../src/viewer/content-analyzer";
import {
  createIntelligentRenderer,
  detectContentType,
  quickAnalyze,
  IntelligentRenderer,
} from "../src/viewer/renderer";
import {
  createRenderingStrategySelector,
  getDefaultStrategy,
  getStrategyForType,
  type RenderingStrategy,
} from "../src/viewer/rendering-strategy";
import { RenderingType, type ContentAnalysisResult } from "../src/viewer/rendering-types";

// ─────────────────────────────────────────────────────────────────────────────
// Demo State
// ─────────────────────────────────────────────────────────────────────────────

interface DemoState {
  pdf: PDF | null;
  renderer: IntelligentRenderer | null;
  currentPage: number;
  pageAnalyses: Map<number, ContentAnalysisResult>;
}

const state: DemoState = {
  pdf: null,
  renderer: null,
  currentPage: 0,
  pageAnalyses: new Map(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Rendering Type Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a human-readable description of the rendering type.
 */
function getRenderingTypeDescription(type: RenderingType): string {
  switch (type) {
    case RenderingType.Vector:
      return "Vector/Programmatic - Contains primarily vector paths and text. Best for crisp rendering at any zoom level.";
    case RenderingType.ImageBased:
      return "Image-Based - Contains primarily raster images. May be a scanned document or photo gallery.";
    case RenderingType.OCR:
      return "OCR Document - Scanned document with invisible text overlay for selection. Contains background image with selectable text.";
    case RenderingType.Flattened:
      return "Flattened - Previously interactive content that has been merged into the page. May have complex layering.";
    case RenderingType.Hybrid:
      return "Hybrid/Mixed - Contains significant amounts of both vector and raster content.";
    case RenderingType.Unknown:
    default:
      return "Unknown - Could not determine content type. Using default rendering strategy.";
  }
}

/**
 * Get an emoji icon for the rendering type.
 */
function getRenderingTypeIcon(type: RenderingType): string {
  switch (type) {
    case RenderingType.Vector:
      return "📐";
    case RenderingType.ImageBased:
      return "🖼️";
    case RenderingType.OCR:
      return "📝";
    case RenderingType.Flattened:
      return "📋";
    case RenderingType.Hybrid:
      return "🎨";
    case RenderingType.Unknown:
    default:
      return "❓";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format analysis result for display.
 */
function formatAnalysisResult(analysis: ContentAnalysisResult): string {
  const lines: string[] = [];

  lines.push(
    `${getRenderingTypeIcon(analysis.renderingType)} Rendering Type: ${analysis.renderingType.toUpperCase()}`,
  );
  lines.push(`   ${getRenderingTypeDescription(analysis.renderingType)}`);
  lines.push("");
  lines.push(`📊 Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
  lines.push("");

  lines.push("📈 Content Composition:");
  lines.push(`   • Vector paths: ${analysis.composition.vectorPathPercent}%`);
  lines.push(`   • Text content: ${analysis.composition.textPercent}%`);
  lines.push(`   • Image content: ${analysis.composition.imagePercent}%`);
  lines.push(`   • Total operators: ${analysis.composition.totalOperatorCount}`);
  lines.push("");

  lines.push("✍️ Text Characteristics:");
  lines.push(`   • Unique fonts: ${analysis.textCharacteristics.uniqueFontCount}`);
  lines.push(`   • Visible text operations: ${analysis.textCharacteristics.visibleTextCount}`);
  lines.push(
    `   • Invisible text (OCR): ${analysis.textCharacteristics.hasInvisibleText ? "Yes" : "No"}`,
  );
  lines.push(
    `   • Very small text: ${analysis.textCharacteristics.hasVerySmallText ? "Yes" : "No"}`,
  );
  lines.push(`   • CID fonts (CJK): ${analysis.textCharacteristics.hasCIDFonts ? "Yes" : "No"}`);
  lines.push("");

  lines.push("🖼️ Image Characteristics:");
  lines.push(`   • Image count: ${analysis.imageCharacteristics.imageCount}`);
  lines.push(
    `   • Full-page image: ${analysis.imageCharacteristics.hasFullPageImage ? "Yes" : "No"}`,
  );
  lines.push(`   • Inline images: ${analysis.imageCharacteristics.hasInlineImages ? "Yes" : "No"}`);
  lines.push("");

  lines.push("🎭 Graphics Characteristics:");
  lines.push(
    `   • Transparency: ${analysis.graphicsCharacteristics.hasTransparency ? "Yes" : "No"}`,
  );
  lines.push(`   • Shading: ${analysis.graphicsCharacteristics.hasShading ? "Yes" : "No"}`);
  lines.push(`   • Clipping: ${analysis.graphicsCharacteristics.hasClipping ? "Yes" : "No"}`);
  lines.push(`   • Max state depth: ${analysis.graphicsCharacteristics.maxGraphicsStateDepth}`);
  lines.push("");

  lines.push("💡 Rendering Hints:");
  lines.push(`   • Preferred renderer: ${analysis.hints.preferredRenderer}`);
  lines.push(`   • Suggested scale: ${analysis.hints.suggestedScale}x`);
  lines.push(`   • Text layer: ${analysis.hints.generateTextLayer ? "Generate" : "Skip"}`);
  lines.push(`   • Render priority: ${analysis.hints.renderPriority}`);
  lines.push(`   • Should cache: ${analysis.shouldCache ? "Yes" : "No"}`);

  return lines.join("\n");
}

/**
 * Format strategy for display.
 */
function formatStrategy(strategy: RenderingStrategy): string {
  const lines: string[] = [];

  lines.push("🎯 Selected Rendering Strategy:");
  lines.push(`   • Renderer: ${strategy.rendererType.toUpperCase()}`);
  lines.push(`   • Scale: ${strategy.rendererOptions.scale}x`);
  lines.push(`   • Text layer: ${strategy.generateTextLayer ? "Enabled" : "Disabled"}`);
  lines.push(`   • Annotations: ${strategy.enableAnnotations ? "Enabled" : "Disabled"}`);
  lines.push("");

  lines.push("📦 Caching Strategy:");
  lines.push(`   • Enabled: ${strategy.caching.enabled ? "Yes" : "No"}`);
  if (strategy.caching.enabled) {
    lines.push(`   • TTL: ${strategy.caching.ttlMs / 1000}s`);
    lines.push(`   • Max versions: ${strategy.caching.maxVersions}`);
    lines.push(`   • Multi-scale: ${strategy.caching.cacheMultipleScales ? "Yes" : "No"}`);
  }
  lines.push("");

  lines.push("⚡ Priority:");
  lines.push(`   • Immediate: ${strategy.priority.immediate ? "Yes" : "No"}`);
  lines.push(`   • Level: ${strategy.priority.level}`);
  lines.push(`   • Prefetch adjacent: ${strategy.priority.prefetchAdjacent ? "Yes" : "No"}`);

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a PDF file and display results.
 */
async function analyzePDF(file: File): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📄 Analyzing: ${file.name}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    // Load PDF
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    state.pdf = await PDF.load(bytes);

    // Initialize intelligent renderer
    state.renderer = createIntelligentRenderer({ debug: true });
    await state.renderer.initialize();

    const pageCount = state.pdf.pageCount;
    console.log(`📚 Document has ${pageCount} page(s)\n`);

    // Analyze each page
    const strategySelector = createRenderingStrategySelector();

    for (let i = 0; i < pageCount; i++) {
      console.log(`\n${"─".repeat(50)}`);
      console.log(`📄 Page ${i + 1} of ${pageCount}`);
      console.log(`${"─".repeat(50)}\n`);

      const page = state.pdf.getPage(i);
      const contentStream = await page.getContentStream();
      const contentBytes = contentStream ? await contentStream.decode() : new Uint8Array(0);

      // Analyze content
      const analysis = state.renderer.analyzeContent(contentBytes, i);
      state.pageAnalyses.set(i, analysis);

      // Get strategy
      const strategy = strategySelector.selectStrategy(analysis, i);

      // Display results
      console.log(formatAnalysisResult(analysis));
      console.log("");
      console.log(formatStrategy(strategy));
    }

    // Summary
    printSummary();
  } catch (error) {
    console.error("❌ Error analyzing PDF:", error);
  }
}

/**
 * Print summary of all pages.
 */
function printSummary(): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 DOCUMENT SUMMARY");
  console.log(`${"=".repeat(60)}\n`);

  const typeCounts = new Map<RenderingType, number>();

  for (const [, analysis] of state.pageAnalyses) {
    const type = analysis.renderingType;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  console.log("Page Types Distribution:");
  for (const [type, count] of typeCounts) {
    const icon = getRenderingTypeIcon(type);
    console.log(`   ${icon} ${type}: ${count} page(s)`);
  }

  // Overall recommendation
  const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const mostCommonType = sortedTypes[0];
  if (mostCommonType) {
    console.log(`\n💡 Recommended global strategy: Optimize for ${mostCommonType[0]} content`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Demo Functions (No PDF required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Demo with synthetic content streams.
 */
function demoWithSyntheticContent(): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("🧪 SYNTHETIC CONTENT ANALYSIS DEMO");
  console.log(`${"=".repeat(60)}\n`);

  // 1. Vector content (typical Word document)
  console.log("1️⃣ Vector/Text Content (typical document):");
  const vectorContent = new TextEncoder().encode(`
    BT
    /F1 12 Tf
    100 700 Td
    (This is a heading) Tj
    0 -20 Td
    (This is paragraph text with multiple lines.) Tj
    0 -14 Td
    (More text content follows here.) Tj
    ET
    100 650 m 500 650 l S
  `);
  const vectorAnalysis = quickAnalyze(vectorContent);
  console.log(
    `   Type: ${getRenderingTypeIcon(vectorAnalysis.renderingType)} ${vectorAnalysis.renderingType}`,
  );
  console.log(`   Confidence: ${(vectorAnalysis.confidence * 100).toFixed(1)}%`);
  console.log(`   Text operators: ${vectorAnalysis.composition.textOperatorCount}`);
  console.log("");

  // 2. Path-heavy content (diagram or chart)
  console.log("2️⃣ Path-Heavy Content (diagram/chart):");
  const pathContent = new TextEncoder().encode(`
    q
    0.5 g
    100 100 m 200 100 l 200 200 l 100 200 l h f
    0 g
    100 100 m 200 100 l 200 200 l 100 200 l h S
    150 300 50 0 360 arc S
    Q
  `);
  const pathAnalysis = quickAnalyze(pathContent);
  console.log(
    `   Type: ${getRenderingTypeIcon(pathAnalysis.renderingType)} ${pathAnalysis.renderingType}`,
  );
  console.log(`   Confidence: ${(pathAnalysis.confidence * 100).toFixed(1)}%`);
  console.log(`   Path operators: ${pathAnalysis.composition.pathOperatorCount}`);
  console.log("");

  // 3. OCR-like content (invisible text)
  console.log("3️⃣ OCR-Like Content (invisible text overlay):");
  const ocrContent = new TextEncoder().encode(`
    BT
    3 Tr
    /F1 10 Tf
    100 700 Td
    (Invisible text for selection) Tj
    0 -12 Td
    (More invisible text here) Tj
    0 -12 Td
    (OCR extracted content) Tj
    ET
  `);
  const ocrAnalysis = quickAnalyze(ocrContent);
  console.log(
    `   Type: ${getRenderingTypeIcon(ocrAnalysis.renderingType)} ${ocrAnalysis.renderingType}`,
  );
  console.log(
    `   Invisible text: ${ocrAnalysis.textCharacteristics.hasInvisibleText ? "Yes" : "No"}`,
  );
  console.log(`   Invisible count: ${ocrAnalysis.textCharacteristics.invisibleTextCount}`);
  console.log("");

  // 4. Complex graphics state
  console.log("4️⃣ Complex Graphics State (flattened-like):");
  const complexContent = new TextEncoder().encode(`
    q
    q
    q
    /GS1 gs
    0.5 0 0 0.5 0 0 cm
    q
    q
    q
    100 100 m 200 200 l S
    Q Q Q Q Q Q
  `);
  const complexAnalysis = quickAnalyze(complexContent);
  console.log(
    `   Type: ${getRenderingTypeIcon(complexAnalysis.renderingType)} ${complexAnalysis.renderingType}`,
  );
  console.log(
    `   Max state depth: ${complexAnalysis.graphicsCharacteristics.maxGraphicsStateDepth}`,
  );
  console.log(
    `   Has transparency: ${complexAnalysis.graphicsCharacteristics.hasTransparency ? "Yes" : "No"}`,
  );
  console.log("");

  // Strategy comparison
  console.log("\n📋 Strategy Comparison for Different Types:\n");
  const types = [
    RenderingType.Vector,
    RenderingType.ImageBased,
    RenderingType.OCR,
    RenderingType.Hybrid,
  ];

  for (const type of types) {
    const strategy = getStrategyForType(type);
    console.log(`${getRenderingTypeIcon(type)} ${type}:`);
    console.log(
      `   Renderer: ${strategy.rendererType}, Scale: ${strategy.rendererOptions.scale}x, Cache: ${strategy.caching.enabled ? "Yes" : "No"}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the demo with a file input.
 */
export function runWithFile(file: File): Promise<void> {
  return analyzePDF(file);
}

/**
 * Run the synthetic demo (no file required).
 */
export function runSyntheticDemo(): void {
  demoWithSyntheticContent();
}

// Auto-run synthetic demo when loaded
console.log("🎯 PDF Rendering Types Detection Demo\n");
console.log("This demo shows how the content analyzer classifies PDF pages.");
console.log("Running synthetic content analysis...\n");
runSyntheticDemo();

// Export for use in HTML demo
export { analyzePDF, demoWithSyntheticContent, formatAnalysisResult, formatStrategy };
