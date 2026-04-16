import { NextRequest } from "next/server";

import { withAuth } from "@/lib/services/auth-middleware";
import { getServices } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";
import { saveInsightSchema } from "@/lib/validators/input";

async function handler(request: NextRequest, userId: string) {
  try {
    const services = getServices();

    const body = await request.json();
    const payload = saveInsightSchema.parse(body);

    const result = await services.saveInsightsService.save({
      userId,
      payload: {
        sourceAccount: payload.sourceAccount,
        report: payload.report,
        mediaReport: payload.mediaReport,
        saveToNotion: false,
        notionPageIds: [],
        notionDatabaseByPageId: {},
      },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
