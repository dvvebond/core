/**
 * Retry logic with exponential backoff for HTTP requests.
 *
 * Provides configurable retry behavior for failed requests with
 * integration support for AuthHandler on 403 recovery scenarios.
 * Designed for universal runtime support (Node.js, Bun, browsers).
 */

import { AuthHandler, AuthenticationError } from "./auth-handler";

/**
 * Options for configuring retry behavior.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before the first retry.
   * @default 1000
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries.
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff.
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Whether to add jitter to delay times.
   * @default true
   */
  jitter?: boolean;

  /**
   * HTTP status codes that should trigger a retry.
   * @default [408, 429, 500, 502, 503, 504]
   */
  retryableStatusCodes?: number[];

  /**
   * Optional AuthHandler for automatic token refresh on 403 errors.
   */
  authHandler?: AuthHandler;

  /**
   * Custom function to determine if an error should be retried.
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Callback invoked before each retry attempt.
   */
  onRetry?: (attempt: number, delayMs: number, error: Error) => void;
}

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  /**
   * The successful result.
   */
  result: T;

  /**
   * Total number of attempts made (including the successful one).
   */
  attempts: number;

  /**
   * Total time spent on retries in milliseconds.
   */
  totalDelayMs: number;
}

/**
 * Error thrown when all retry attempts are exhausted.
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}

/**
 * Default retryable HTTP status codes.
 */
const DEFAULT_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Retry logic with exponential backoff strategy.
 *
 * @example
 * ```typescript
 * const retryLogic = new RetryLogic({
 *   maxAttempts: 3,
 *   initialDelayMs: 1000,
 *   onRetry: (attempt, delay) => console.log(`Retry ${attempt} in ${delay}ms`)
 * });
 *
 * const result = await retryLogic.execute(async () => {
 *   const response = await fetch('https://api.example.com/pdf');
 *   if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *   return response;
 * });
 * ```
 */
export class RetryLogic {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly backoffMultiplier: number;
  private readonly jitter: boolean;
  private readonly retryableStatusCodes: Set<number>;
  private readonly authHandler?: AuthHandler;
  private readonly shouldRetry?: (error: Error, attempt: number) => boolean;
  private readonly onRetry?: (attempt: number, delayMs: number, error: Error) => void;

  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.jitter = options.jitter ?? true;
    this.retryableStatusCodes = new Set(
      options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES,
    );
    this.authHandler = options.authHandler;
    this.shouldRetry = options.shouldRetry;
    this.onRetry = options.onRetry;
  }

  /**
   * Execute an operation with retry logic.
   *
   * @param operation - The async operation to execute.
   * @returns The result of the operation with retry metadata.
   * @throws {RetryExhaustedError} When all retry attempts are exhausted.
   */
  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    let attempt = 0;
    let totalDelayMs = 0;
    let lastError: Error | null = null;

    while (attempt < this.maxAttempts) {
      attempt++;

      try {
        const result = await operation();
        return {
          result,
          attempts: attempt,
          totalDelayMs,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (attempt >= this.maxAttempts || !this.isRetryable(lastError, attempt)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delayMs = this.calculateDelay(attempt);
        totalDelayMs += delayMs;

        // Notify about retry
        this.onRetry?.(attempt, delayMs, lastError);

        // Wait before retrying
        await this.delay(delayMs);
      }
    }

    throw new RetryExhaustedError(
      `Operation failed after ${attempt} attempts: ${lastError?.message}`,
      attempt,
      lastError!,
    );
  }

  /**
   * Execute an authenticated fetch with retry logic and token refresh.
   *
   * @param input - The URL or Request object.
   * @param init - Optional fetch init options.
   * @returns The response with retry metadata.
   * @throws {RetryExhaustedError} When all retry attempts are exhausted.
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<RetryResult<Response>> {
    return this.execute(async () => {
      // If we have an auth handler, use it for authenticated requests
      if (this.authHandler) {
        const { response } = await this.authHandler.fetch(input, init);

        // Check for retryable status codes
        if (this.retryableStatusCodes.has(response.status)) {
          throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }

        return response;
      }

      // Standard fetch without auth
      const response = await fetch(input, init);

      // Check for retryable status codes
      if (this.retryableStatusCodes.has(response.status)) {
        throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      return response;
    });
  }

  /**
   * Calculate the delay for a given attempt number.
   *
   * @param attempt - The current attempt number (1-based).
   * @returns The delay in milliseconds.
   */
  calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * multiplier^(attempt-1)
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter if enabled (±25%)
    if (this.jitter) {
      const jitterRange = cappedDelay * 0.25;
      const jitterOffset = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(0, Math.round(cappedDelay + jitterOffset));
    }

    return Math.round(cappedDelay);
  }

  /**
   * Check if an error is retryable.
   *
   * @param error - The error to check.
   * @param attempt - The current attempt number.
   * @returns True if the error should trigger a retry.
   */
  isRetryable(error: Error, attempt: number): boolean {
    // Custom retry logic takes precedence
    if (this.shouldRetry) {
      return this.shouldRetry(error, attempt);
    }

    // AuthenticationError after refresh attempts should not retry
    if (error instanceof AuthenticationError) {
      return false;
    }

    // HTTP errors with retryable status codes
    if (error instanceof HttpError) {
      return this.retryableStatusCodes.has(error.statusCode);
    }

    // Network errors (fetch failures) are retryable
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return true;
    }

    // AbortError (request aborted) should not retry
    if (error.name === "AbortError") {
      return false;
    }

    // Default: retry on generic errors
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * HTTP error with status code information.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Create a RetryLogic instance with common presets.
 */
export const RetryPresets = {
  /**
   * Aggressive retry strategy for critical operations.
   */
  aggressive(): RetryLogic {
    return new RetryLogic({
      maxAttempts: 5,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5,
    });
  },

  /**
   * Conservative retry strategy for non-critical operations.
   */
  conservative(): RetryLogic {
    return new RetryLogic({
      maxAttempts: 2,
      initialDelayMs: 2000,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    });
  },

  /**
   * Default retry strategy with balanced settings.
   */
  default(): RetryLogic {
    return new RetryLogic();
  },

  /**
   * No retry - single attempt only.
   */
  none(): RetryLogic {
    return new RetryLogic({
      maxAttempts: 1,
    });
  },
} as const;
