import { NextRequest, NextResponse } from "next/server";

import { services } from "@/lib/services/factory";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const targetPageId = request.nextUrl.searchParams.get("targetPageId") ?? undefined;

  const response = NextResponse.redirect(new URL("/", request.url));
  const state = services.notionAuthService.issueState({
    response,
    targetPageId,
  });

  const url = services.notionAuthService.buildAuthorizeUrl(state);
  response.headers.set("Location", url);
  return response;
}
