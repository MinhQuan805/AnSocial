import { NextRequest, NextResponse } from "next/server";

import { services } from "@/lib/services/factory";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/console", request.url));
  const state = services.facebookAuthService.issueState(response);
  const authorizeUrl = services.facebookAuthService.buildAuthorizeUrl(state);

  response.headers.set("Location", authorizeUrl);
  return response;
}
