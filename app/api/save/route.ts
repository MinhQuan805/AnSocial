import { NextRequest } from "next/server";

import { AuthError } from "@/lib/core/errors";
import { services } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";
import { saveInsightSchema } from "@/lib/validators/input";

export async function POST(request: NextRequest) {
  try {
    const sessionId = services.sessionService.getFromRequest(request);
    if (!sessionId) {
      throw new AuthError("Please connect Notion first.");
    }

    const integration = await services.supabaseRepo.getIntegration(sessionId);
    if (!integration) {
      throw new AuthError("No active integration session found.");
    }

    const body = await request.json();
    const payload = saveInsightSchema.parse(body);

    const result = await services.saveInsightsService.save({
      sessionId,
      integration,
      payload: {
        sourceAccount: payload.sourceAccount,
        report: payload.report,
        saveToNotion: payload.saveToNotion,
        notionPageId: payload.notionPageId,
      },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
