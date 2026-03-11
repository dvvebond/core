import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthHandler,
  AuthenticationError,
  createTokenProvider,
  type TokenProvider,
} from "./auth-handler";

describe("AuthHandler", () => {
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

  describe("constructor", () => {
    it("should create with required options", () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      expect(handler).toBeInstanceOf(AuthHandler);
    });

    it("should use default values for optional options", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "test-token",
        refreshToken: async () => "refreshed-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      await handler.fetch("https://example.com");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-token");
    });
  });

  describe("fetch", () => {
    it("should add authorization header with token", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "my-token",
        refreshToken: async () => "refreshed",
      };

      const handler = new AuthHandler({ tokenProvider });
      await handler.fetch("https://example.com/api");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://example.com/api");
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("should use custom auth header and prefix", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "api-key",
        refreshToken: async () => "new-api-key",
      };

      const handler = new AuthHandler({
        tokenProvider,
        authHeader: "X-API-Key",
        tokenPrefix: "Key",
      });

      await handler.fetch("https://example.com");

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get("X-API-Key")).toBe("Key api-key");
    });

    it("should preserve existing headers", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      await handler.fetch("https://example.com", {
        headers: {
          "Content-Type": "application/json",
          "X-Custom": "value",
        },
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("X-Custom")).toBe("value");
      expect(headers.get("Authorization")).toBe("Bearer token");
    });

    it("should make request without auth header when token is null", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => null,
        refreshToken: async () => null,
      };

      const handler = new AuthHandler({ tokenProvider });
      await handler.fetch("https://example.com");

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBeNull();
    });

    it("should return response with metadata on success", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      const result = await handler.fetch("https://example.com");

      expect(result.response).toBeInstanceOf(Response);
      expect(result.tokenRefreshed).toBe(false);
      expect(result.refreshAttempts).toBe(0);
    });
  });

  describe("401 handling", () => {
    it("should refresh token and retry on 401", async () => {
      const getToken = vi.fn(() => Promise.resolve("old-token"));
      const refreshToken = vi.fn(() => Promise.resolve("new-token"));
      const tokenProvider: TokenProvider = { getToken, refreshToken };

      let callCount = 0;
      mockFetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(new Response("Unauthorized", { status: 401 }));
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const handler = new AuthHandler({ tokenProvider });
      const result = await handler.fetch("https://example.com");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(result.tokenRefreshed).toBe(true);
      expect(result.refreshAttempts).toBe(1);
      expect(result.response.status).toBe(200);
    });

    it("should throw AuthenticationError when refresh fails", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => null,
      };

      mockFetch = vi.fn(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const handler = new AuthHandler({ tokenProvider });

      await expect(handler.fetch("https://example.com")).rejects.toThrow(AuthenticationError);
    });

    it("should throw AuthenticationError with correct details", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => null,
      };

      mockFetch = vi.fn(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const handler = new AuthHandler({ tokenProvider });

      try {
        await handler.fetch("https://example.com");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        const authError = error as AuthenticationError;
        expect(authError.statusCode).toBe(401);
        expect(authError.refreshAttempts).toBe(1);
        expect(authError.message).toBe("Token refresh failed");
      }
    });
  });

  describe("403 handling", () => {
    it("should refresh token and retry on 403", async () => {
      let callCount = 0;
      const tokenProvider: TokenProvider = {
        getToken: async () => (callCount === 0 ? "old-token" : "new-token"),
        refreshToken: async () => "new-token",
      };

      mockFetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(new Response("Forbidden", { status: 403 }));
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const handler = new AuthHandler({ tokenProvider });
      const result = await handler.fetch("https://example.com");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.tokenRefreshed).toBe(true);
      expect(result.response.status).toBe(200);
    });

    it("should throw after max refresh attempts on persistent 403", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      mockFetch = vi.fn(() => Promise.resolve(new Response("Forbidden", { status: 403 })));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const handler = new AuthHandler({
        tokenProvider,
        maxRefreshAttempts: 2,
      });

      try {
        await handler.fetch("https://example.com");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        const authError = error as AuthenticationError;
        expect(authError.statusCode).toBe(403);
        expect(authError.refreshAttempts).toBe(2);
      }
    });
  });

  describe("token refresh deduplication", () => {
    it("should deduplicate concurrent refresh requests", async () => {
      let refreshCount = 0;
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => {
          refreshCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
          return "new-token-" + refreshCount;
        },
      };

      let callCount = 0;
      mockFetch = vi.fn(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(new Response("Unauthorized", { status: 401 }));
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const handler = new AuthHandler({ tokenProvider, maxRefreshAttempts: 2 });

      // Start two fetches concurrently that will both trigger refresh
      const [result1, result2] = await Promise.all([
        handler.fetch("https://example.com/1"),
        handler.fetch("https://example.com/2"),
      ]);

      // Both should succeed but refresh should only be called once per request
      expect(result1.response.status).toBe(200);
      expect(result2.response.status).toBe(200);
    });
  });

  describe("addAuthHeaders", () => {
    it("should add auth headers without making request", async () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "my-token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      const result = await handler.addAuthHeaders({
        method: "POST",
        body: "test",
      });

      expect(result.method).toBe("POST");
      expect(result.body).toBe("test");
      const headers = new Headers(result.headers);
      expect(headers.get("Authorization")).toBe("Bearer my-token");

      // Should not have made any fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });
  });

  describe("isAuthError", () => {
    it("should return true for 401", () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      const response = new Response("", { status: 401 });
      expect(handler.isAuthError(response)).toBe(true);
    });

    it("should return true for 403", () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });
      const response = new Response("", { status: 403 });
      expect(handler.isAuthError(response)).toBe(true);
    });

    it("should return false for other status codes", () => {
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken: async () => "new-token",
      };

      const handler = new AuthHandler({ tokenProvider });

      expect(handler.isAuthError(new Response("", { status: 200 }))).toBe(false);
      expect(handler.isAuthError(new Response("", { status: 404 }))).toBe(false);
      expect(handler.isAuthError(new Response("", { status: 500 }))).toBe(false);
    });
  });

  describe("refreshToken", () => {
    it("should manually trigger token refresh", async () => {
      const refreshToken = vi.fn(() => Promise.resolve("refreshed-token"));
      const tokenProvider: TokenProvider = {
        getToken: async () => "token",
        refreshToken,
      };

      const handler = new AuthHandler({ tokenProvider });
      const result = await handler.refreshToken();

      expect(result).toBe("refreshed-token");
      expect(refreshToken).toHaveBeenCalledTimes(1);
    });
  });
});

describe("createTokenProvider", () => {
  it("should create TokenProvider from sync functions", async () => {
    const provider = createTokenProvider(
      () => "sync-token",
      () => "sync-refreshed",
    );

    expect(await provider.getToken()).toBe("sync-token");
    expect(await provider.refreshToken()).toBe("sync-refreshed");
  });

  it("should create TokenProvider from async functions", async () => {
    const provider = createTokenProvider(
      async () => "async-token",
      async () => "async-refreshed",
    );

    expect(await provider.getToken()).toBe("async-token");
    expect(await provider.refreshToken()).toBe("async-refreshed");
  });

  it("should handle null returns", async () => {
    const provider = createTokenProvider(
      () => null,
      () => null,
    );

    expect(await provider.getToken()).toBeNull();
    expect(await provider.refreshToken()).toBeNull();
  });
});

describe("AuthenticationError", () => {
  it("should have correct properties", () => {
    const error = new AuthenticationError("Test error", 401, 2);

    expect(error.message).toBe("Test error");
    expect(error.name).toBe("AuthenticationError");
    expect(error.statusCode).toBe(401);
    expect(error.refreshAttempts).toBe(2);
  });

  it("should be an instance of Error", () => {
    const error = new AuthenticationError("Test", 403, 1);
    expect(error).toBeInstanceOf(Error);
  });
});
