import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services/factory";
import { withAuth } from "@/lib/services/auth-middleware";

/**
 * POST /api/providers/:type/connect
 * Initiate provider connection (Facebook, Notion, TikTok, etc.)
 * 
 * Body: { flowMode?: 'popup' | 'redirect' }
 */
async function handler(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  try {
    const services = getServices();
    // Extract provider type from URL path: /api/providers/:type/connect
    const pathSegments = request.nextUrl.pathname.split("/").filter(Boolean);
    const type = pathSegments[2]; // "notion", "facebook", etc.

    if (!type) {
      return NextResponse.json(
        { error: "Provider type missing" },
        { status: 400 },
      );
    }

    // Get provider from registry
    const provider = services.providerRegistry.getProvider(type);

    // Issue CSRF state
    const response = NextResponse.json({ ready: true });
    const state = provider.issueState({
      response,
      flowMode: "popup",
    });

    // Build authorize URL
    const authorizeUrl = provider.buildAuthorizeUrl(state);

    return NextResponse.json({
      provider: type,
      authorizeUrl,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to initiate provider connection",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
