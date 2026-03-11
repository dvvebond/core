export { EventSystem } from "./EventSystem.ts";
export {
  EventType,
  type PDFReadyPayload,
  type ScaleChangedPayload,
  type PageRenderedPayload,
  type EventPayloadMap,
  type EventListener,
  type EventHandler,
  type Subscription,
} from "./types.ts";
export { PDFController, ScaleController, PageController } from "./controllers/index.ts";

import { PageController } from "./controllers/PageController.ts";
import { PDFController } from "./controllers/PDFController.ts";
import { ScaleController } from "./controllers/ScaleController.ts";
import { EventSystem } from "./EventSystem.ts";

/**
 * Options for creating a viewer event context.
 */
export interface ViewerEventContextOptions {
  /** Initial scale factor (default: 1.0) */
  initialScale?: number;
  /** Minimum allowed scale (default: 0.1) */
  minScale?: number;
  /** Maximum allowed scale (default: 10.0) */
  maxScale?: number;
}

/**
 * Complete event context for a PDF viewer instance.
 * Contains the event system and all controllers.
 */
export interface ViewerEventContext {
  eventSystem: EventSystem;
  pdfController: PDFController;
  scaleController: ScaleController;
  pageController: PageController;
}

/**
 * Create a complete event context for a PDF viewer.
 * This factory function initializes all controllers with a shared event system.
 * @param options Configuration options
 * @returns Complete viewer event context
 */
export function createViewerEventContext(
  options: ViewerEventContextOptions = {},
): ViewerEventContext {
  const { initialScale = 1.0, minScale = 0.1, maxScale = 10.0 } = options;

  const eventSystem = new EventSystem();

  return {
    eventSystem,
    pdfController: new PDFController(eventSystem),
    scaleController: new ScaleController(eventSystem, initialScale, minScale, maxScale),
    pageController: new PageController(eventSystem),
  };
}
