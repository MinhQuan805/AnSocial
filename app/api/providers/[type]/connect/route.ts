import { NextRequest, NextResponse } from 'next/server';
import { getServices } from '@/lib/services/factory';
import { withAuth } from '@/lib/services/auth-middleware';

/**
 * POST /api/providers/:type/connect
 * Initiate provider connection (Facebook, Notion, TikTok, etc.)
 *
 * Params:
 *   - type: provider type (notion, facebook, tiktok, etc.)
 *
 * Body: { flowMode?: 'popup' | 'redirect' }
 *
 * Response:
 * {
 *   provider: "notion",
 *   authorizeUrl: "https://api.notion.com/v1/oauth/authorize?...",
 *   state: "csrf_token_xxx"
 * }
 */
async function handler(request: NextRequest, userId: string): Promise<NextResponse> {
  try {
    const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean);
    const type = pathSegments[2]?.toLowerCase();

    if (!type) {
      return NextResponse.json({ error: 'Provider type missing' }, { status: 400 });
    }

    if (['notion', 'facebook', 'google', 'youtube'].includes(type)) {
      return NextResponse.json(
        {
          error: `${type} OAuth is disabled in this build.`,
        },
        { status: 410 }
      );
    }

    const services = getServices();

    // Get provider from registry
    const provider = services.providerRegistry.getProvider(type);

    // Issue CSRF state
    const response = NextResponse.json({ ready: true });
    const state = provider.issueState({
      response,
      flowMode: 'popup',
    });

    // Build authorize URL
    const authorizeUrl = provider.buildAuthorizeUrl(state);

    return NextResponse.json({
      provider: type,
      authorizeUrl,
      state,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Provider Connect] Error:`, errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to initiate provider connection',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
