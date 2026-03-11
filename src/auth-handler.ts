/**
 * Authentication handler for HTTP-level concerns in PDF operations.
 *
 * Manages token lifecycle with automatic refresh on 401/403 responses.
 * Designed for universal runtime support (Node.js, Bun, browsers).
 */

/**
 * Token provider interface for obtaining and refreshing authentication tokens.
 */
export interface TokenProvider {
  /**
   * Get the current access token.
   * @returns The current token, or null if no token is available.
   */
  getToken(): Promise<string | null>;

  /**
   * Refresh the token after an authentication failure.
   * @returns The new token, or null if refresh failed.
   */
  refreshToken(): Promise<string | null>;
}

/**
 * Options for configuring the AuthHandler.
 */
export interface AuthHandlerOptions {
  /**
   * The token provider for obtaining and refreshing tokens.
   */
  tokenProvider: TokenProvider;

  /**
   * Maximum number of token refresh attempts before giving up.
   * @default 1
   */
  maxRefreshAttempts?: number;

  /**
   * Custom header name for the authorization token.
   * @default "Authorization"
   */
  authHeader?: string;

  /**
   * Token prefix (e.g., "Bearer", "Token").
   * @default "Bearer"
   */
  tokenPrefix?: string;
}

/**
 * Result of an authenticated fetch operation.
 */
export interface AuthenticatedResponse {
  /**
   * The HTTP response.
   */
  response: Response;

  /**
   * Whether the token was refreshed during this request.
   */
  tokenRefreshed: boolean;

  /**
   * Number of refresh attempts made.
   */
  refreshAttempts: number;
}

/**
 * Error thrown when authentication fails after all retry attempts.
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly refreshAttempts: number,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Handles authentication for HTTP requests with automatic token refresh.
 *
 * @example
 * ```typescript
 * const authHandler = new AuthHandler({
 *   tokenProvider: {
 *     async getToken() { return localStorage.getItem('token'); },
 *     async refreshToken() {
 *       const res = await fetch('/refresh');
 *       const { token } = await res.json();
 *       localStorage.setItem('token', token);
 *       return token;
 *     }
 *   }
 * });
 *
 * const { response } = await authHandler.fetch('https://api.example.com/pdf');
 * ```
 */
export class AuthHandler {
  private readonly tokenProvider: TokenProvider;
  private readonly maxRefreshAttempts: number;
  private readonly authHeader: string;
  private readonly tokenPrefix: string;
  private refreshInProgress: Promise<string | null> | null = null;

  constructor(options: AuthHandlerOptions) {
    this.tokenProvider = options.tokenProvider;
    this.maxRefreshAttempts = options.maxRefreshAttempts ?? 1;
    this.authHeader = options.authHeader ?? "Authorization";
    this.tokenPrefix = options.tokenPrefix ?? "Bearer";
  }

  /**
   * Perform an authenticated fetch with automatic token refresh on 401/403.
   *
   * @param input - The URL or Request object.
   * @param init - Optional fetch init options.
   * @returns The response with metadata about token refresh.
   * @throws {AuthenticationError} When authentication fails after all attempts.
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<AuthenticatedResponse> {
    let refreshAttempts = 0;
    let tokenRefreshed = false;

    // Get initial token
    const initialToken = await this.tokenProvider.getToken();

    // Make the initial request
    let response = await this.makeRequest(input, init, initialToken);

    // Handle 401/403 responses with token refresh
    while (this.isAuthError(response) && refreshAttempts < this.maxRefreshAttempts) {
      refreshAttempts++;

      // Refresh the token (with deduplication)
      const newToken = await this.refreshTokenWithDedup();

      if (newToken === null) {
        throw new AuthenticationError("Token refresh failed", response.status, refreshAttempts);
      }

      tokenRefreshed = true;

      // Retry the request with the new token
      response = await this.makeRequest(input, init, newToken);
    }

    // If still an auth error after all attempts, throw
    if (this.isAuthError(response)) {
      throw new AuthenticationError(
        `Authentication failed with status ${response.status}`,
        response.status,
        refreshAttempts,
      );
    }

    return {
      response,
      tokenRefreshed,
      refreshAttempts,
    };
  }

  /**
   * Add authentication headers to a request without making the request.
   * Useful when you need to customize the request further.
   *
   * @param init - The request init options to augment.
   * @returns New request init with authentication headers added.
   */
  async addAuthHeaders(init?: RequestInit): Promise<RequestInit> {
    const token = await this.tokenProvider.getToken();
    return this.mergeHeaders(init, token);
  }

  /**
   * Check if a response indicates an authentication error.
   *
   * @param response - The HTTP response to check.
   * @returns True if the response is a 401 or 403 error.
   */
  isAuthError(response: Response): boolean {
    return response.status === 401 || response.status === 403;
  }

  /**
   * Manually trigger a token refresh.
   * Useful for proactive token refresh before expiration.
   *
   * @returns The new token, or null if refresh failed.
   */
  async refreshToken(): Promise<string | null> {
    return this.refreshTokenWithDedup();
  }

  private async makeRequest(
    input: string | URL | Request,
    init: RequestInit | undefined,
    token: string | null,
  ): Promise<Response> {
    const requestInit = this.mergeHeaders(init, token);
    return fetch(input, requestInit);
  }

  private mergeHeaders(init: RequestInit | undefined, token: string | null): RequestInit {
    const headers = new Headers(init?.headers);

    if (token) {
      headers.set(this.authHeader, `${this.tokenPrefix} ${token}`);
    }

    return {
      ...init,
      headers,
    };
  }

  /**
   * Refresh token with deduplication to prevent multiple concurrent refreshes.
   */
  private async refreshTokenWithDedup(): Promise<string | null> {
    // If a refresh is already in progress, wait for it
    if (this.refreshInProgress) {
      return this.refreshInProgress;
    }

    // Start a new refresh
    this.refreshInProgress = this.tokenProvider.refreshToken();

    try {
      const token = await this.refreshInProgress;
      return token;
    } finally {
      this.refreshInProgress = null;
    }
  }
}

/**
 * Create a simple token provider from static credentials.
 *
 * @param getToken - Function to get the current token.
 * @param refreshToken - Function to refresh the token.
 * @returns A TokenProvider implementation.
 */
export function createTokenProvider(
  getToken: () => Promise<string | null> | string | null,
  refreshToken: () => Promise<string | null> | string | null,
): TokenProvider {
  return {
    async getToken() {
      return getToken();
    },
    async refreshToken() {
      return refreshToken();
    },
  };
}
