import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/core/errors";
import { SessionService } from "@/lib/services/auth/session.service";

/**
 * Authentication Middleware
 * 
 * Enforces authentication on protected routes using session cookies
 */
export class AuthMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Verify request has valid auth session
   * Returns session ID if valid, throws AuthError if not
   */
  public async requireAuth(request: NextRequest): Promise<string> {
    // 1. Lấy từ SessionService (nếu có)
    let sessionId = this.sessionService.getFromRequest(request);

    // 2. Fallback cơ bản: Lấy trực tiếp từ cookie nếu SessionService chưa hoạt động
    if (!sessionId) {
      sessionId =
        request.cookies.get("ana_user_id")?.value ?? null;
    }

    if (!sessionId) {
      // Debug: Log missing auth for ngrok troubleshooting
      const method = request.method;
      const url = request.url;
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");
      
      console.error(
        `[AuthMiddleware] Missing session for ${method} ${url}`,
        { origin, referer, cookieHeader: request.headers.get("cookie") ? "present" : "missing" }
      );
      
      throw new AuthError("Missing session. Please reload and try again.");
    }

    return sessionId;
  }

  /**
   * Clear auth cookies from response
   */
  public clearAuthToken(response: NextResponse): void {
    response.cookies.delete(this.sessionService.cookieName);
    response.cookies.delete("ana_user_id");
  }

  /**
   * Create 401 Unauthorized response
   */
  public unauthorized(message: string = "Authentication required"): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message,
        },
      },
      { status: 401 },
    );
  }

  /**
   * Create 403 Forbidden response
   */
  public forbidden(message: string = "Access denied"): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message,
        },
      },
      { status: 403 },
    );
  }
}

/**
 * Higher-order function to wrap API routes with auth
 * 
 * Usage:
 * ```ts
 * const handler = withAuth(async (req, userId) => {
 *   console.log(`Session ${userId} is calling this API`);
 *   return NextResponse.json({ data: 'protected' });
 * });
 * ```
 */
export function withAuth(
  handler: (
    request: NextRequest,
    userId: string,
  ) => Promise<NextResponse>,
  middleware: AuthMiddleware,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const userId = await middleware.requireAuth(request);

      // Attach userId to request headers for handler to use
      const headers = new Headers(request.headers);
      headers.set("x-user-id", userId);

      // Create modified request
      const modifiedRequest = new NextRequest(request, { headers });

      return await handler(modifiedRequest, userId);
    } catch (error) {
      if (error instanceof AuthError) {
        return middleware.unauthorized(error.message);
      }

      return middleware.unauthorized("Authentication failed");
    }
  };
}

/**
 * Middleware function for Next.js middleware.ts
 * Protects routes requiring authentication
 */
export function createAuthMiddleware(
  middleware: AuthMiddleware,
  protectedRoutes: RegExp,
) {
  return async (request: NextRequest): Promise<NextResponse | void> => {
    // Skip auth check for public routes
    if (!protectedRoutes.test(request.nextUrl.pathname)) {
      return;
    }

    try {
      await middleware.requireAuth(request);
      // Allow request to proceed
    } catch (error) {
      if (error instanceof AuthError) {
        // Redirect to login or return 401
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  };
}
