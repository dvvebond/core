import { EventSystem } from "../EventSystem.ts";
import type { PDFReadyPayload, Subscription } from "../types.ts";
import { EventType } from "../types.ts";

/**
 * Controller for PDF document loading events.
 * Manages the lifecycle of PDF document readiness state.
 */
export class PDFController {
  private eventSystem: EventSystem;
  private isReady = false;
  private documentInfo: PDFReadyPayload | null = null;

  constructor(eventSystem: EventSystem) {
    this.eventSystem = eventSystem;
  }

  /**
   * Notify that a PDF document has been loaded and is ready.
   * @param payload Document information
   */
  documentLoaded(payload: PDFReadyPayload): void {
    this.isReady = true;
    this.documentInfo = payload;
    this.eventSystem.emit(EventType.PDFReady, payload);
  }

  /**
   * Reset the controller state (e.g., when loading a new document).
   */
  reset(): void {
    this.isReady = false;
    this.documentInfo = null;
  }

  /**
   * Check if a document is currently loaded.
   */
  getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Get the current document information, if available.
   */
  getDocumentInfo(): PDFReadyPayload | null {
    return this.documentInfo;
  }

  /**
   * Subscribe to PDF ready events.
   * If a document is already loaded, the listener is called immediately.
   * @param listener Callback for when a PDF becomes ready
   * @returns Subscription handle
   */
  onReady(listener: (payload: PDFReadyPayload) => void): Subscription {
    if (this.isReady && this.documentInfo) {
      listener(this.documentInfo);
    }
    return this.eventSystem.subscribe(EventType.PDFReady, listener);
  }
}
