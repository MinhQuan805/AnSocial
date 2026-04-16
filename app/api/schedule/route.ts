import { z } from "zod";
import { NextRequest } from "next/server";

import { withAuth } from "@/lib/services/auth-middleware";
import { getServices } from "@/lib/services/factory";
import { fail, ok } from "@/lib/utils/response";
import { autoScheduleSchema } from "@/lib/validators/input";

const scheduleUpdateSchema = z.object({
  autoSchedule: autoScheduleSchema,
  notionTargetPageIds: z.array(z.string().min(1)).optional(),
});

async function handler(request: NextRequest, userId: string) {
  try {
    const services = getServices();

    const payload = scheduleUpdateSchema.parse(await request.json());

    // Update schedule config and notion target pages separately
    await Promise.all([
      services.supabaseRepo.upsertAutoScheduleConfig(userId, {
        enabled: payload.autoSchedule.enabled,
        frequency: payload.autoSchedule.frequency,
        time: payload.autoSchedule.time,
        timezone: payload.autoSchedule.timezone,
      }),
      payload.notionTargetPageIds
        ? services.supabaseRepo.upsertNotionIntegration(userId, {
            targetPageIds: payload.notionTargetPageIds,
          })
        : Promise.resolve(null),
    ]);

    return ok({
      updated: true,
      autoSchedule: payload.autoSchedule,
      notionTargetPageIds: payload.notionTargetPageIds ?? [],
    });
  } catch (error) {
    return fail(error);
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
