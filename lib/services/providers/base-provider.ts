import type { NextRequest, NextResponse } from "next/server";
import type { IProvider, ProviderConnectionPayload } from "@/lib/core/auth.types";
import type { IProviderConnectionRepository } from "@/lib/core/auth.types";
import { OauthStateService } from "../auth/oauth-state.service";
import { AuthError } from "@/lib/core/errors";

/**
 * Base class for provider implementations
 * Provides common OAuth flow logic and utilities
 * 
 * Extend this class to add new providers:
 * 
 * export class TikTokProvider extends BaseProvider {
 *   type = 'tiktok';
 *   
 *   buildAuthorizeUrl(state: string): string {
 *     const url = new URL('https://tiktok.com/oauth/authorize');
 *     url.searchParams.set('client_id', env.TIKTOK_CLIENT_ID);
 *     // ... other params
 *     return url.toString();
 *   }
 *   
 *   async executeAuth(code: string): Promise<ProviderConnectionPayload> {
 *     const tokens = await this.exchangeCode(code);
 *     const user = await this.getUserInfo(tokens.accessToken);
 *     return { providerUserId: user.id, accessToken: tokens.token, ... };
 *   }
 * }
 */
export abstract class BaseProvider implements IProvider {
  abstract readonly type: string;

  protected abstract readonly scopes: string[];
  protected abstract readonly clientId: string;
  protected abstract readonly clientSecret: string;
  protected abstract readonly redirectUri: string;

  constructor(
    protected readonly connectionRepository: IProviderConnectionRepository,
    protected readonly stateService: OauthStateService,
  ) {}

  /**
   * Issue CSRF state for OAuth flow
   */
  public issueState(args: {
    response: NextResponse;
    flowMode?: "redirect" | "popup";
  }): string {
    return this.stateService.issue(this.type, args.response, {
      flowMode: args.flowMode ?? "redirect",
    });
  }

  /**
   * Abstract method - each provider implements its authorize URL
   */
  abstract buildAuthorizeUrl(state: string): string;

  /**
   * Abstract method - each provider handles its OAuth completion
   */
  abstract executeAuth(
    code: string,
    redirectUri: string,
  ): Promise<ProviderConnectionPayload>;

  /**
   * Complete OAuth flow: validate state, exchange code, save connection
   */
  public async completeAuth(args: {
    request: NextRequest;
    code: string | null;
    state: string | null;
  }): Promise<{ userId: string; flowMode?: string }> {
    if (!args.code) {
      throw new AuthError(`Missing ${this.type} OAuth code.`);
    }

    // Validate CSRF state
    const consumed = this.stateService.consume(this.type, args.request, args.state);

    // Get user ID from session/JWT in request headers
    // This should be provided by auth middleware
    const userId = this.extractUserIdFromRequest(args.request);
    if (!userId) {
      throw new AuthError("User not authenticated. Google login required.");
    }

    // Execute provider-specific OAuth completion
    const connectionPayload = await this.executeAuth(args.code, this.redirectUri);

    // Save connection to database
    await this.connectionRepository.upsert(userId, connectionPayload);

    return { userId, flowMode: consumed.context.flowMode };
  }

  /**
   * Get connection status for user
   */
  public async getStatus(userId: string) {
    const connection = await this.connectionRepository.get(userId, this.type);
    if (!connection) {
      return null;
    }

    return {
      connected: true,
      providerUserId: connection.providerUserId,
      expiresAt: connection.expiresAt,
      metadata: connection.metadata,
    };
  }

  /**
   * Disconnect provider from user account
   */
  public async disconnect(userId: string): Promise<void> {
    await this.connectionRepository.delete(userId, this.type);
  }

  /**
   * Clear temporary OAuth state
   */
  public clearState(response: NextResponse): void {
    this.stateService.clear(this.type, response);
  }

  /**
   * Helper: Extract user ID from request (from JWT cookie)
   * This assumes Google auth middleware has validated and set user context
   */
  protected extractUserIdFromRequest(request: NextRequest): string | null {
    // The auth middleware will set this header/cookie
    // For now, return null and implement based on your auth middleware
    const userId = request.headers.get("x-user-id");
    return userId;
  }

  /**
   * Helper: Exchange authorization code for access token
   */
  protected async exchangeCode(
    code: string,
    authUrl: string,
    params: Record<string, string>,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
        ...params,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new AuthError(`${this.type} token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      [key: string]: any;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Helper: Make authenticated API request to provider
   */
  protected async apiCall<T>(
    url: string,
    accessToken: string,
    options?: RequestInit,
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new AuthError(
        `${this.type} API call failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }
}

/**
 * Helper: Create payload for provider connection
 */
export function createConnectionPayload(
  providerType: string,
  providerUserId: string,
  accessToken: string,
  expiresIn?: number,
  refreshToken?: string,
  metadata?: Record<string, any>,
): ProviderConnectionPayload {
  return {
    providerType,
    providerUserId,
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    metadata: metadata || {},
  };
}
