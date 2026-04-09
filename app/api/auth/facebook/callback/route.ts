import { NextRequest, NextResponse } from "next/server";

import { getBaseUrl } from "@/lib/config/env";
import { services } from "@/lib/services/factory";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    const auth = await services.facebookAuthService.completeAuth({
      request,
      code,
      state,
    });

    const redirect = NextResponse.redirect(new URL(`${getBaseUrl()}/console?facebook=connected`));
    services.sessionService.attachToResponse(redirect, auth.sessionId);
    services.facebookAuthService.clearState(redirect);

    return redirect;
  } catch (error) {
    const failure = NextResponse.redirect(new URL(`${getBaseUrl()}/console?error=facebook_auth`));
    services.facebookAuthService.clearState(failure);

    const message = error instanceof Error ? error.message : "Unexpected Facebook OAuth error";
    failure.headers.set("x-auth-error", message);

    return failure;
  }
}
