import { NextRequest } from "next/server";

import { AuthError } from "@/lib/core/errors";
import { services } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";
import { insightRequestSchema } from "@/lib/validators/input";

export async function POST(request: NextRequest) {
  try {
    const sessionId = services.sessionService.getFromRequest(request);
    if (!sessionId) {
      throw new AuthError("Please connect Notion first.");
    }

    const body = await request.json();
    const payload = insightRequestSchema.parse(body);

    const report = await services.marketingInsightsService.generateReport({
      sessionId,
      accountInputs: payload.accountInputs,
      selectedAccountIds: payload.selectedAccountIds,
      metrics: payload.metrics,
      period: payload.period,
      rangeDays: payload.rangeDays,
      mediaFormat: payload.mediaFormat,
      breakdown: payload.breakdown,
      timeframe: payload.timeframe,
    });

    return ok(report);
  } catch (error) {
    return fail(error);
  }
}
