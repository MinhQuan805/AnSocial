import type { IFacebookGraphRepository } from '@/lib/repositories/interfaces';
import type {
  IProviderConnectionRepository,
  ProviderConnectionPayload,
} from '@/lib/core/auth.types';
import { BaseProvider, createConnectionPayload } from './base-provider';
import { OauthStateService } from '@/lib/services/auth/oauth-state.service';
import { env, redirectUri } from '@/lib/config/env';

/**
 * FacebookProvider - Implementation for Facebook OAuth + Graph API
 *
 * Handles:
 * - Facebook login & authorization
 * - Pages and accounts listing
 * - Insights data fetching
 * - Token refresh for long-lived tokens
 */
export class FacebookProvider extends BaseProvider {
  readonly type = 'facebook';

  protected readonly scopes = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ];

  protected readonly clientId = env.META_APP_ID;
  protected readonly clientSecret = env.META_APP_SECRET;
  protected readonly redirectUri = redirectUri.facebook;

  constructor(
    private readonly facebookRepo: IFacebookGraphRepository,
    connectionRepository: IProviderConnectionRepository,
    stateService: OauthStateService
  ) {
    super(connectionRepository, stateService);
  }

  /**
   * Build Facebook OAuth authorization URL
   */
  public buildAuthorizeUrl(state: string): string {
    const url = new URL('https://www.facebook.com/v25.0/dialog/oauth');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.scopes.join(','));
    url.searchParams.set('state', state);

    if (env.META_BUSINESS_CONFIG_ID) {
      url.searchParams.set('config_id', env.META_BUSINESS_CONFIG_ID);
    }

    return url.toString();
  }

  /**
   * Execute Facebook OAuth: exchange code, get long-lived token, fetch user info
   */
  public async executeAuth(code: string): Promise<ProviderConnectionPayload> {
    // Exchange short-lived token for long-lived token
    const shortToken = await this.facebookRepo.exchangeCodeForShortToken(code, this.redirectUri);

    const longToken = await this.facebookRepo.exchangeShortForLongToken(shortToken);
    const user = await this.facebookRepo.getAuthenticatedUser(longToken.token);

    const expiresAt = new Date(Date.now() + longToken.expiresIn * 1000).toISOString();

    return createConnectionPayload(
      this.type,
      user.id,
      longToken.token,
      undefined, // Facebook doesn't provide refresh tokens for long-lived tokens
      expiresAt,
      undefined // No metadata for now
    );
  }

  /**
   * Refresh Facebook long-lived access token
   */
  public async refreshToken(connection: any): Promise<any> {
    const newToken = await this.facebookRepo.exchangeShortForLongToken(connection.accessToken);

    return {
      ...connection,
      accessToken: newToken.token,
      expiresAt: new Date(Date.now() + newToken.expiresIn * 1000),
    };
  }
}
