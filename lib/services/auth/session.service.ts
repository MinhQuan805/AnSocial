import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { AuthError } from "@/lib/core/errors";

export class SessionService {
  public readonly cookieName = "ana_session";

  public getFromRequest(request: NextRequest): string | null {
    return request.cookies.get(this.cookieName)?.value ?? null;
  }

  public attachToResponse(response: NextResponse, sessionId: string): void {
    response.cookies.set(this.cookieName, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
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

    if (!sessionId) {
      throw new AuthError("Not authenticated. Connect Notion first.");
    }

    return sessionId;
  }
}
