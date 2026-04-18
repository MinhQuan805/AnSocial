import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/services/auth-middleware';
import { getServices } from '@/lib/services/factory';
import { fail } from '@/lib/utils/response';
import { exportN8nSchema } from '@/lib/validators/input';

async function handler(request: NextRequest, _userId: string) {
  try {
    const services = getServices();
    const body = await request.json();
    const payload = exportN8nSchema.parse(body);

    const workflow = services.n8nWorkflowService.createWorkflow(payload);
    const fileName = `ana-social-workflow-${Date.now()}.json`;

    return new NextResponse(JSON.stringify(workflow, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=\"${fileName}\"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
