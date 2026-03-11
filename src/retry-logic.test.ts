import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthHandler, AuthenticationError } from "./auth-handler";
import { HttpError, RetryExhaustedError, RetryLogic, RetryPresets } from "./retry-logic";

describe("RetryLogic", () => {
  describe("constructor", () => {
    it("should create with default options", () => {
      const retry = new RetryLogic();
      expect(retry).toBeInstanceOf(RetryLogic);
    });

    it("should create with custom options", () => {
      const retry = new RetryLogic({
        maxAttempts: 5,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        backoffMultiplier: 3,
        jitter: false,
      });
      expect(retry).toBeInstanceOf(RetryLogic);
    });
  });

  describe("execute", () => {
    it("should return result on first success", async () => {
      const retry = new RetryLogic();
      const operation = vi.fn(() => Promise.resolve("success"));

      const result = await retry.execute(operation);

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(1);
      expect(result.totalDelayMs).toBe(0);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed", async () => {
      const retry = new RetryLogic({
        initialDelayMs: 10,
        jitter: false,
      });

      let callCount = 0;
      const operation = vi.fn(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve("success");
      });

      const result = await retry.execute(operation);

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(3);
      expect(result.totalDelayMs).toBe(30); // 10 + 20
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should throw RetryExhaustedError after max attempts", async () => {
      const retry = new RetryLogic({
        maxAttempts: 3,
        initialDelayMs: 10,
        jitter: false,
      });

      const operation = vi.fn(() => Promise.reject(new Error("Persistent failure")));

      await expect(retry.execute(operation)).rejects.toThrow(RetryExhaustedError);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should include last error in RetryExhaustedError", async () => {
      const retry = new RetryLogic({
        maxAttempts: 2,
        initialDelayMs: 10,
      });

      const operation = vi.fn(() => Promise.reject(new Error("Specific error message")));

      try {
        await retry.execute(operation);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        const retryError = error as RetryExhaustedError;
        expect(retryError.attempts).toBe(2);
        expect(retryError.lastError.message).toBe("Specific error message");
      }
    });

    it("should call onRetry callback before each retry", async () => {
      const onRetry = vi.fn();
      const retry = new RetryLogic({
        maxAttempts: 3,
        initialDelayMs: 10,
        jitter: false,
        onRetry,
      });

      let callCount = 0;
      const operation = vi.fn(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("Failure " + callCount));
        }
        return Promise.resolve("success");
      });

      await retry.execute(operation);

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry.mock.calls[0]).toEqual([
        1,
        10,
        expect.objectContaining({ message: "Failure 1" }),
      ]);
      expect(onRetry.mock.calls[1]).toEqual([
        2,
        20,
        expect.objectContaining({ message: "Failure 2" }),
      ]);
    });

    it("should use custom shouldRetry function", async () => {
      const shouldRetry = vi.fn((error: Error) => {
        return error.message.includes("RETRYABLE");
      });

      const retry = new RetryLogic({
        maxAttempts: 3,
        initialDelayMs: 10,
        shouldRetry,
      });

      // This error should not be retried (message doesn't contain "RETRYABLE")
      const operation = vi.fn(() => Promise.reject(new Error("Non-recoverable error")));

      await expect(retry.execute(operation)).rejects.toThrow(RetryExhaustedError);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it("should not retry AbortError", async () => {
      const retry = new RetryLogic({
        maxAttempts: 3,
        initialDelayMs: 10,
      });

      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      const operation = vi.fn(() => Promise.reject(abortError));

      await expect(retry.execute(operation)).rejects.toThrow(RetryExhaustedError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should not retry AuthenticationError", async () => {
      const retry = new RetryLogic({
        maxAttempts: 3,
        initialDelayMs: 10,
      });

      const authError = new AuthenticationError("Auth failed", 401, 1);
      const operation = vi.fn(() => Promise.reject(authError));

      await expect(retry.execute(operation)).rejects.toThrow(RetryExhaustedError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("calculateDelay", () => {
    it("should calculate exponential backoff without jitter", () => {
      const retry = new RetryLogic({
        initialDelayMs: 100,
        backoffMultiplier: 2,
        maxDelayMs: 10000,
        jitter: false,
      });

      expect(retry.calculateDelay(1)).toBe(100);
      expect(retry.calculateDelay(2)).toBe(200);
      expect(retry.calculateDelay(3)).toBe(400);
      expect(retry.calculateDelay(4)).toBe(800);
    });

    it("should cap delay at maxDelayMs", () => {
      const retry = new RetryLogic({
        initialDelayMs: 1000,
        backoffMultiplier: 10,
        maxDelayMs: 5000,
        jitter: false,
      });

      expect(retry.calculateDelay(1)).toBe(1000);
      expect(retry.calculateDelay(2)).toBe(5000); // Capped
      expect(retry.calculateDelay(3)).toBe(5000); // Capped
    });

    it("should add jitter when enabled", () => {
      const retry = new RetryLogic({
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 10000,
        jitter: true,
      });

      // Run multiple times to verify jitter produces varying results
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(retry.calculateDelay(1));
      }

      // With jitter, we should get different values
      // The delay should be around 1000 ± 250 (25% jitter)
      const delayArray = Array.from(delays);
      expect(delayArray.every(d => d >= 750 && d <= 1250)).toBe(true);
    });
  });

  describe("isRetryable", () => {
    it("should retry HttpError with retryable status codes", () => {
      const retry = new RetryLogic();

      expect(retry.isRetryable(new HttpError("", 500), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 502), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 503), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 504), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 429), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 408), 1)).toBe(true);
    });

    it("should not retry HttpError with non-retryable status codes", () => {
      const retry = new RetryLogic();

      expect(retry.isRetryable(new HttpError("", 400), 1)).toBe(false);
      expect(retry.isRetryable(new HttpError("", 401), 1)).toBe(false);
      expect(retry.isRetryable(new HttpError("", 403), 1)).toBe(false);
      expect(retry.isRetryable(new HttpError("", 404), 1)).toBe(false);
    });

    it("should use custom retryable status codes", () => {
      const retry = new RetryLogic({
        retryableStatusCodes: [418, 451],
      });

      expect(retry.isRetryable(new HttpError("", 418), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 451), 1)).toBe(true);
      expect(retry.isRetryable(new HttpError("", 500), 1)).toBe(false);
    });

    it("should not retry AuthenticationError", () => {
      const retry = new RetryLogic();
      const error = new AuthenticationError("Auth failed", 401, 1);

      expect(retry.isRetryable(error, 1)).toBe(false);
    });

    it("should retry generic errors by default", () => {
      const retry = new RetryLogic();

      expect(retry.isRetryable(new Error("Generic error"), 1)).toBe(true);
    });
  });

  describe("fetch", () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      mockFetch = vi.fn(() => Promise.resolve(new Response("OK", { status: 200 })));
      globalThis.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should make successful fetch request", async () => {
      const retry = new RetryLogic();
      const result = await retry.fetch("https://example.com");

      expect(result.result).toBeInstanceOf(Response);
      expect(result.result.status).toBe(200);
      expect(result.attempts).toBe(1);
    });

    it("should retry on retryable HTTP status codes", async () => {
      let callCount = 0;
      mockFetch = vi.fn(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(
            new Response("Error", {
              status: 503,
              statusText: "Service Unavailable",
            }),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const retry = new RetryLogic({
        initialDelayMs: 10,
        jitter: false,
      });

      const result = await retry.fetch("https://example.com");

      expect(result.result.status).toBe(200);
      expect(result.attempts).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should pass request init options", async () => {
      const retry = new RetryLogic();
      await retry.fetch("https://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://example.com");
      expect(init.method).toBe("POST");
      expect(init.body).toBe('{"test":true}');
    });

    it("should use AuthHandler when provided", async () => {
      const tokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };
      const authHandler = new AuthHandler({ tokenProvider });

      const retry = new RetryLogic({
        authHandler,
      });

      await retry.fetch("https://example.com");

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer token");
    });

    it("should handle auth refresh through AuthHandler on 401", async () => {
      let callCount = 0;
      mockFetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(new Response("Unauthorized", { status: 401 }));
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const tokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };
      const authHandler = new AuthHandler({ tokenProvider });

      const retry = new RetryLogic({
        authHandler,
      });

      const result = await retry.fetch("https://example.com");

      expect(result.result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe("HttpError", () => {
  it("should have correct properties", () => {
    const error = new HttpError("Not Found", 404);

    expect(error.message).toBe("Not Found");
    expect(error.name).toBe("HttpError");
    expect(error.statusCode).toBe(404);
  });

  it("should be an instance of Error", () => {
    const error = new HttpError("Error", 500);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("RetryExhaustedError", () => {
  it("should have correct properties", () => {
    const lastError = new Error("Last failure");
    const error = new RetryExhaustedError("All retries failed", 3, lastError);

    expect(error.message).toBe("All retries failed");
    expect(error.name).toBe("RetryExhaustedError");
    expect(error.attempts).toBe(3);
    expect(error.lastError).toBe(lastError);
  });

  it("should be an instance of Error", () => {
    const error = new RetryExhaustedError("Failed", 1, new Error("Last"));
    expect(error).toBeInstanceOf(Error);
  });
});

describe("RetryPresets", () => {
  describe("aggressive", () => {
    it("should create aggressive retry strategy", () => {
      const retry = RetryPresets.aggressive();
      expect(retry).toBeInstanceOf(RetryLogic);
      // Verify through calculateDelay behavior
      expect(retry.calculateDelay(1)).toBeGreaterThanOrEqual(375); // 500 * 0.75 with jitter
      expect(retry.calculateDelay(1)).toBeLessThanOrEqual(625); // 500 * 1.25 with jitter
    });
  });

  describe("conservative", () => {
    it("should create conservative retry strategy", () => {
      const retry = RetryPresets.conservative();
      expect(retry).toBeInstanceOf(RetryLogic);
      expect(retry.calculateDelay(1)).toBeGreaterThanOrEqual(1500); // 2000 * 0.75 with jitter
      expect(retry.calculateDelay(1)).toBeLessThanOrEqual(2500); // 2000 * 1.25 with jitter
    });
  });

  describe("default", () => {
    it("should create default retry strategy", () => {
      const retry = RetryPresets.default();
      expect(retry).toBeInstanceOf(RetryLogic);
      expect(retry.calculateDelay(1)).toBeGreaterThanOrEqual(750); // 1000 * 0.75 with jitter
      expect(retry.calculateDelay(1)).toBeLessThanOrEqual(1250); // 1000 * 1.25 with jitter
    });
  });

  describe("none", () => {
    it("should create no-retry strategy", async () => {
      const retry = RetryPresets.none();
      const operation = vi.fn(() => Promise.reject(new Error("Failure")));

      await expect(retry.execute(operation)).rejects.toThrow(RetryExhaustedError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
