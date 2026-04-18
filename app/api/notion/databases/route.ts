import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/services/auth-middleware';
import { getServices } from '@/lib/services/factory';

/**
 * POST /api/notion/databases
 * Create a new Notion database in a specified page
 */
async function handler(request: NextRequest, userId: string) {
  void request;
  void userId;

  return NextResponse.json(
    {
      error: 'Notion database creation is disabled in this build.',
    },
    { status: 410 }
  );
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
