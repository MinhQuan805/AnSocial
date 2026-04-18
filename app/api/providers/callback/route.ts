import { NextRequest, NextResponse } from 'next/server';
import { getServices } from '@/lib/services/factory';
import { AuthError } from '@/lib/core/errors';

/**
 * GET /api/providers/:type/callback
 * OAuth callback for any provider
 *
 * Params:
 *   - type: provider type (facebook, notion, tiktok, etc.)
 * Query:
 *   - code: OAuth authorization code
 *   - state: CSRF state
 */
export async function GET(request: NextRequest) {
  try {
    const services = getServices();
    // Extract provider type from URL path
    const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean);
    const providerType = pathSegments[2]; // /api/providers/:type/callback

    if (!providerType) {
      throw new AuthError('Provider type missing');
    }

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    // Get provider from registry
    const provider = services.providerRegistry.getProvider(providerType);

    // Complete provider OAuth
    const result = await provider.completeAuth({
      request,
      code,
      state,
    });

    // Get or create session ID for this user
    const sessionId = services.sessionService.getOrCreateFromRequest(request);

    // Return success response
    // If opened in popup, postMessage to opener
    const successPayload = JSON.stringify({
      source: 'ana-social-auth',
      provider: providerType,
      status: 'connected',
      sessionId, // Send sessionId for fallback auth
    });

    const popupResponse = new NextResponse(
      `<!doctype html><html><body><script>(function(){window.opener?.postMessage(${successPayload},"*");window.setTimeout(function(){window.close();},100);})();</script></body></html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );

    // Attach session to response
    services.sessionService.attachToResponse(popupResponse, sessionId);

    return popupResponse;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Provider authentication failed',
        provider: request.nextUrl.pathname.split('/')[2],
        details: String(error),
      },
      { status: 500 }
    );
  }
}
