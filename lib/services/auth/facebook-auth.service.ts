import type { NextRequest } from "next/server";

import { env, redirectUri } from "@/lib/config/env";
import { AuthError } from "@/lib/core/errors";
import type { IFacebookGraphRepository, ISupabaseRepository } from "@/lib/repositories/interfaces";
import { OauthStateService } from "@/lib/services/auth/oauth-state.service";
import { SessionService } from "@/lib/services/auth/session.service";

export class FacebookAuthService {
  private readonly scopes = [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_show_list",
    "business_management",
  ];

  constructor(
    private readonly facebookRepo: IFacebookGraphRepository,
    private readonly supabaseRepo: ISupabaseRepository,
    private readonly stateService: OauthStateService,
    private readonly sessionService: SessionService,
  ) {}

  public buildAuthorizeUrl(state: string): string {
    const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
    url.searchParams.set("client_id", env.META_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri.facebook);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", this.scopes.join(","));
    url.searchParams.set("state", state);

    if (env.META_BUSINESS_CONFIG_ID) {
      url.searchParams.set("config_id", env.META_BUSINESS_CONFIG_ID);
    }

    return url.toString();
  }

  public issueState(response: import("next/server").NextResponse): string {
    return this.stateService.issue("facebook", response);
  }

  public async completeAuth(args: {
    request: NextRequest;
    code: string | null;
    state: string | null;
  }): Promise<{ sessionId: string }> {
    if (!args.code) {
      throw new AuthError("Missing Facebook OAuth code.");
    }

    this.stateService.consume("facebook", args.request, args.state);

    const sessionId = this.sessionService.getOrCreateFromRequest(args.request);

    const shortToken = await this.facebookRepo.exchangeCodeForShortToken(
      args.code,
      redirectUri.facebook,
    );
    const longToken = await this.facebookRepo.exchangeShortForLongToken(shortToken);
    const user = await this.facebookRepo.getAuthenticatedUser(longToken.token);

    const tokenExpire = new Date(Date.now() + longToken.expiresIn * 1000).toISOString();

    await this.supabaseRepo.upsertIntegration(sessionId, {
      sessionId,
      facebookUserId: user.id,
      facebookAccessToken: longToken.token,
      facebookTokenExpiresAt: tokenExpire,
    });

    return { sessionId };
  }

  public clearState(response: import("next/server").NextResponse): void {
    this.stateService.clear("facebook", response);
  }
}
