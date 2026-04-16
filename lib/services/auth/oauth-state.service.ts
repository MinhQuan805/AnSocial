import { randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { AuthError } from "@/lib/core/errors";

export class OauthStateService {
  private stateCookie(provider: string): string {
    return `oauth_state_${provider}`;
  }

  private contextCookie(provider: string): string {
    return `oauth_ctx_${provider}`;
  }

  public issue(
    provider: string,
    response: NextResponse,
    context?: Record<string, string>,
  ): string {
    const state = randomUUID();
    response.cookies.set(this.stateCookie(provider), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    if (context) {
      response.cookies.set(this.contextCookie(provider), JSON.stringify(context), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 10,
      });
    }

    return state;
  }

  public consume(provider: string, request: NextRequest, state: string | null): {
    context: Record<string, string>;
  } {
    const expected = request.cookies.get(this.stateCookie(provider))?.value;

    if (!state || !expected || expected !== state) {
      throw new AuthError("Invalid OAuth state. Please retry login.");
    }

    const rawCtx = request.cookies.get(this.contextCookie(provider))?.value;
    const context: Record<string, string> = rawCtx ? this.safeParse(rawCtx) : {};

    return { context };
  }

  public clear(provider: string, response: NextResponse): void {
    response.cookies.set(this.stateCookie(provider), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set(this.contextCookie(provider), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  private safeParse(value: string): Record<string, string> {
    try {
      const parsed = JSON.parse(value) as Record<string, string>;
      return parsed;
    } catch {
      return {};
    }
  }
}
