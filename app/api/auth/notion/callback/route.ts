import { NextRequest, NextResponse } from "next/server";

import { getBaseUrl } from "@/lib/config/env";
import { services } from "@/lib/services/factory";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    const auth = await services.notionAuthService.completeAuth({
      request,
      code,
      state,
    });

    const redirect = NextResponse.redirect(new URL(`${getBaseUrl()}/console?notion=connected`));
    services.sessionService.attachToResponse(redirect, auth.sessionId);
    services.notionAuthService.clearState(redirect);

    return redirect;
  } catch (error) {
    const failure = NextResponse.redirect(new URL(`${getBaseUrl()}/?error=notion_auth`));
    services.notionAuthService.clearState(failure);

    const message = error instanceof Error ? error.message : "Unexpected Notion OAuth error";
    console.error("[Notion OAuth Error]", message);
    console.error("[Error Details]", error);
    failure.headers.set("x-auth-error", message);

    return failure;
  }
}
