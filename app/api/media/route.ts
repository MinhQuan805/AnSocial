import { NextRequest } from "next/server";

import { withAuth } from "@/lib/services/auth-middleware";
import { getServices } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";
import { mediaRequestSchema } from "@/lib/validators/input";

async function handler(request: NextRequest, userId: string) {
  try {
    const services = getServices();

    const body = await request.json();
    const payload = mediaRequestSchema.parse(body);

    const report = await services.marketingInsightsService.generateMediaReport({
      userId,
      accountInputs: payload.accountInputs,
      selectedAccountIds: payload.selectedAccountIds,
      endpoint: payload.endpoint,
      fields: payload.fields,
      limit: payload.limit,
    });

    return ok(report);
  } catch (error) {
    return fail(error);
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
