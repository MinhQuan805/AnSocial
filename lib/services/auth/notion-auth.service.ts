import type { NextRequest } from "next/server";

import { env, redirectUri } from "@/lib/config/env";
import { AuthError } from "@/lib/core/errors";
import type { INotionRepository, ISupabaseRepository } from "@/lib/repositories/interfaces";
import { OauthStateService } from "@/lib/services/auth/oauth-state.service";
import { SessionService } from "@/lib/services/auth/session.service";

export class NotionAuthService {
  constructor(
    private readonly notionRepo: INotionRepository,
    private readonly supabaseRepo: ISupabaseRepository,
    private readonly stateService: OauthStateService,
    private readonly sessionService: SessionService,
  ) {}

  public buildAuthorizeUrl(state: string): string {
    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.searchParams.set("client_id", env.NOTION_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("redirect_uri", redirectUri.notion);
    url.searchParams.set("state", state);

    return url.toString();
  }

  public issueState(args: {
    response: import("next/server").NextResponse;
    targetPageId?: string;
  }): string {
    return this.stateService.issue("notion", args.response, {
      targetPageId: args.targetPageId ?? "",
    });
  }

  public async completeAuth(args: {
    request: NextRequest;
    code: string | null;
    state: string | null;
  }): Promise<{ sessionId: string; targetPageId?: string }> {
    if (!args.code) {
      throw new AuthError("Missing Notion OAuth code.");
    }

    const consumed = this.stateService.consume("notion", args.request, args.state);

    const tokenPayload = await this.notionRepo.exchangeCodeForToken(args.code, redirectUri.notion);

    const sessionId = this.sessionService.getOrCreateFromRequest(args.request);

    await this.supabaseRepo.upsertIntegration(sessionId, {
      sessionId,
      notionWorkspaceId: tokenPayload.workspaceId,
      notionWorkspaceName: tokenPayload.workspaceName,
      notionAccessToken: tokenPayload.accessToken,
      notionTargetPageId: consumed.context.targetPageId || null,
    });

    return {
      sessionId,
      targetPageId: consumed.context.targetPageId,
    };
  }

  public clearState(response: import("next/server").NextResponse): void {
    this.stateService.clear("notion", response);
  }
}
