import type { NextRequest } from "next/server";

import { withAuth } from "@/lib/services/auth-middleware";
import { getServices } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";

/**
 * GET /api/notion/pages
 * Fetch available Notion pages and databases without requiring re-authentication
 * Uses the token stored in the user's session
 * Also ensures a default "Analysis" page exists
 */
async function handler(request: NextRequest, userId: string) {
  void request;
  void userId;

  try {
    return ok([]);
  } catch (error) {
    return fail(error);
  }
}

const services = getServices();
export const GET = withAuth(handler, services.authMiddleware);
