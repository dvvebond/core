import type {
  EventHandler,
  EventListener,
  EventPayloadMap,
  EventType,
  Subscription,
} from "./types.ts";

/**
 * Centralized event system for the PDF viewer.
 * Provides type-safe event emission and subscription with support for
 * one-time listeners and automatic cleanup.
 */
export class EventSystem {
  private listeners: Map<EventType, Set<EventHandler<EventType>>> = new Map();

  /**
   * Subscribe to an event type.
   * @param type The event type to listen for
   * @param listener Callback function invoked when the event is emitted
   * @returns Subscription handle with unsubscribe method
   */
  subscribe<T extends EventType>(type: T, listener: EventListener<T>): Subscription {
    return this.addListener(type, listener, false);
  }

  /**
   * Subscribe to an event type for a single emission.
   * The listener is automatically removed after being called once.
   * @param type The event type to listen for
   * @param listener Callback function invoked when the event is emitted
   * @returns Subscription handle with unsubscribe method
   */
  once<T extends EventType>(type: T, listener: EventListener<T>): Subscription {
    return this.addListener(type, listener, true);
  }

  /**
   * Emit an event to all registered listeners.
   * @param type The event type to emit
   * @param payload The event payload
   */
  emit<T extends EventType>(type: T, payload: EventPayloadMap[T]): void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }

    const handlersToRemove: EventHandler<EventType>[] = [];

    for (const handler of handlers) {
      handler.listener(payload);
      if (handler.once) {
        handlersToRemove.push(handler);
      }
    }

    for (const handler of handlersToRemove) {
      handlers.delete(handler);
    }
  }

  /**
   * Remove a specific listener from an event type.
   * @param type The event type
   * @param listener The listener function to remove
   */
  unsubscribe<T extends EventType>(type: T, listener: EventListener<T>): void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      if (handler.listener === listener) {
        handlers.delete(handler);
        break;
      }
    }
  }

  /**
   * Remove all listeners for a specific event type.
   * @param type The event type to clear listeners for
   */
  clear(type: EventType): void {
    this.listeners.delete(type);
  }

  /**
   * Remove all listeners for all event types.
   */
  clearAll(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for a specific event type.
   * @param type The event type
   * @returns Number of registered listeners
   */
  listenerCount(type: EventType): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  private addListener<T extends EventType>(
    type: T,
    listener: EventListener<T>,
    once: boolean,
  ): Subscription {
    let handlers = this.listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(type, handlers);
    }

    const handler: EventHandler<T> = { listener, once };
    handlers.add(handler as EventHandler<EventType>);

    return {
      unsubscribe: () => {
        handlers.delete(handler as EventHandler<EventType>);
      },
    };
  }
}
