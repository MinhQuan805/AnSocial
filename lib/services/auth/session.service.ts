import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export class SessionService {
  public readonly cookieName = "ana_session";

  public getFromRequest(request: NextRequest): string | null {
    // Try get from cookie first
    const cookieSession = request.cookies.get(this.cookieName)?.value ?? null;
    const authHeader = request.headers.get("authorization");
    const bearerSession = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const explicitHeaderSession = request.headers.get("x-ana-session-id")?.trim() || null;
    const headerSession = bearerSession || explicitHeaderSession;

    // Prefer explicit header session when present (popup fallback path).
    if (headerSession) {
      if (
        cookieSession &&
        cookieSession !== headerSession &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn(
          `[SessionService] Cookie and Authorization session mismatch. Using Authorization header session.`
        );
      }

      return headerSession;
    }

    if (cookieSession) {
      return cookieSession;
    }

    // Debug logging for ngrok issues
    if (process.env.NODE_ENV === 'development') {
      const allCookies = request.cookies.getAll();
      console.warn(
        `[SessionService] Session not found (Cookie: "${this.cookieName}", Auth header). Available cookies:`,
        allCookies.map(c => c.name).join(', ')
      );
    }
    
    return null;
  }

  public attachToResponse(response: NextResponse, sessionId: string): void {
    // Always set as cookie (for standard browsers)
    response.cookies.set(this.cookieName, sessionId, {
      httpOnly: true,
      sameSite: "lax",  // Use lax - same-site requests should work fine
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });

    // Also return in response for client to store if cookies fail
    // Client can send back as Authorization header
    if (response.headers.has("content-type") && response.headers.get("content-type")?.includes("application/json")) {
      // We'll add session to response body in auth endpoints
    }
  }

  public createSessionId(): string {
    return randomUUID();
  }

  public getOrCreateFromRequest(request: NextRequest): string {
    return this.getFromRequest(request) ?? this.createSessionId();
  }

  public async requireFromServerComponent(): Promise<string> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(this.cookieName)?.value;

    return sessionId ?? this.createSessionId();
  }
}