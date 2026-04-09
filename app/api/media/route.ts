import { NextRequest } from "next/server";

import { AuthError } from "@/lib/core/errors";
import { services } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";
import { mediaRequestSchema } from "@/lib/validators/input";

export async function POST(request: NextRequest) {
  try {
    const sessionId = services.sessionService.getFromRequest(request);
    if (!sessionId) {
      throw new AuthError("Please connect Notion first.");
    }

    const body = await request.json();
    const payload = mediaRequestSchema.parse(body);

    const report = await services.marketingInsightsService.generateMediaReport({
      sessionId,
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
