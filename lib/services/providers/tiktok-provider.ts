import type { IProviderConnectionRepository } from '@/lib/core/auth.types';
import { BaseProvider, createConnectionPayload } from './base-provider';
import { OauthStateService } from '@/lib/services/auth/oauth-state.service';
import { AuthError } from '@/lib/core/errors';
import { env, redirectUri } from '@/lib/config/env';

/**
 * TikTokProvider - Template Implementation
 *
 * This is a template for adding new providers to the system.
 * Copy this and implement the abstract methods.
 *
 * To activate:
 * 1. Implement TikTokProvider in factory.ts
 * 2. Add TIKTOK_CLIENT_ID and TIKTOK_CLIENT_SECRET to env.ts
 * 3. Register in service factory:
 *    registry.register('tiktok', new TikTokProvider(...));
 * 4. Users can immediately connect without UI changes!
 */
export class TikTokProvider extends BaseProvider {
  readonly type = 'tiktok';

  protected readonly scopes = ['user.info.basic', 'video.list', 'analytics.report.download'];

  protected readonly clientId = env.TIKTOK_CLIENT_ID || '';
  protected readonly clientSecret = env.TIKTOK_CLIENT_SECRET || '';
  protected readonly redirectUri = redirectUri.tiktok;

  constructor(
    connectionRepository: IProviderConnectionRepository,
    stateService: OauthStateService
  ) {
    super(connectionRepository, stateService);

    // Validate configuration
    if (!this.clientId || !this.clientSecret) {
      throw new Error('TikTok credentials not configured');
    }
  }

  /**
   * Build TikTok OAuth authorization URL
   */
  public buildAuthorizeUrl(state: string): string {
    const url = new URL('https://www.tiktok.com/v1/oauth/authorize');
    url.searchParams.set('client_key', this.clientId);
    url.searchParams.set('scope', this.scopes.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', state);

    return url.toString();
  }

  /**
   * Execute TikTok OAuth: exchange code, fetch user info
   */
  public async executeAuth(code: string, _redirectUri: string) {
    // Step 1: Exchange code for access token
    const tokenResponse = await this.exchangeCode(
      code,
      'https://open.tiktokapis.com/v1/oauth/token/',
      {
        // TikTok specific params if needed
      }
    );

    // Step 2: Fetch authenticated user info from TikTok API
    const user = await this.fetchTikTokUserInfo(tokenResponse.accessToken);

    // Step 3: Create connection payload
    return createConnectionPayload(
      this.type,
      user.open_id, // TikTok uses open_id as unique identifier
      tokenResponse.accessToken,
      tokenResponse.expiresIn,
      tokenResponse.refreshToken,
      {
        displayName: user.display_name,
        avatar: user.avatar_url,
      }
    );
  }

  /**
   * Refresh TikTok access token
   */
  public async refreshToken(connection: any): Promise<any> {
    if (!connection.refreshToken) {
      throw new AuthError('TikTok refresh token not available');
    }

    const response = await fetch('https://open.tiktokapis.com/v1/oauth/refresh_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new AuthError(`TikTok token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
    };

    return {
      ...connection,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Helper: Fetch user info from TikTok API
   */
  private async fetchTikTokUserInfo(accessToken: string): Promise<{
    open_id: string;
    display_name: string;
    avatar_url: string;
  }> {
    return this.apiCall(
      'https://open.tiktokapis.com/v1/user/info/?fields=open_id,display_name,avatar_url',
      accessToken
    );
  }
}
