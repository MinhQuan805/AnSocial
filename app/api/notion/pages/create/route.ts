import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/services/auth-middleware";
import { getServices } from "@/lib/services/factory";

/**
 * POST /api/notion/pages/create
 * Create a new page in the Notion workspace
 */
async function handler(request: NextRequest, userId: string) {
  void request;
  void userId;

  return NextResponse.json(
    {
      error: "Notion page creation is disabled in this build.",
    },
    { status: 410 },
  );
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
