import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services/factory";
import { AuthError } from "@/lib/core/errors";

/**
 * GET /api/providers/:type/callback
 * OAuth callback for any provider
 * 
 * Params:
 *   - type: provider type (facebook, notion, tiktok, etc.)
 * 
 * Query:
 *   - code: OAuth authorization code
 *   - state: CSRF state
 * 
 * Response:
 * - Success: HTML page that postMessages to window.opener and closes
 * - Error: JSON error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const { type: rawType } = await params;
    const type = rawType?.toLowerCase();

    if (!type) {
      throw new AuthError("Provider type missing");
    }

    if (["notion", "facebook", "google", "youtube"].includes(type)) {
      throw new AuthError(`${type} OAuth callback is disabled in this build.`);
    }

    const services = getServices();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    // Get provider from registry
    const provider = services.providerRegistry.getProvider(type);

    // Complete provider OAuth
    const result = await provider.completeAuth({
      request,
      code,
      state,
    });

    // Get or create session ID for this user
    const sessionId = services.sessionService.getOrCreateFromRequest(request);

    // Return HTML that postMessages to opener window and closes popup
    const successPayload = JSON.stringify({
      source: "ana-social-auth",
      provider: type,
      status: "connected",
      sessionId,  // Send sessionId for fallback auth
      flowMode: result.flowMode,
    });

    const popupResponse = new NextResponse(
      `<!doctype html><html><body><script>(function(){window.opener?.postMessage(${successPayload},"*");window.setTimeout(function(){window.close();},100);})();</script></body></html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );

    // Attach session to response
    services.sessionService.attachToResponse(popupResponse, sessionId);

    return popupResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const resolvedParams = await params.catch(() => ({ type: "unknown" }));
    const providerType = resolvedParams.type || "unknown";

    console.error(`[Provider Callback] Error for ${providerType}:`, errorMessage);

    if (error instanceof AuthError) {
      // Return error HTML that postMessages to opener
      const errorPayload = JSON.stringify({
        source: "ana-social-auth",
        provider: providerType,
        status: "error",
        reason: errorMessage,
      });

      return new NextResponse(
        `<!doctype html><html><body><script>(function(){window.opener?.postMessage(${errorPayload},"*");window.setTimeout(function(){window.close();},100);})();</script></body></html>`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error: "Provider authentication failed",
        provider: providerType,
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
