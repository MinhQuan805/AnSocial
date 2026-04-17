import type { SessionView } from "@/components/app/console/types";
import { env } from "@/lib/config/env";
import { getServices } from "@/lib/services/factory";

export async function loadConsoleSession(): Promise<SessionView> {
  const services = getServices();
  const userId = await services.sessionService.requireFromServerComponent();

  const [scheduleConfig, saveCount] = await Promise.all([
    services.supabaseRepo.getAutoScheduleConfig(userId),
    services.supabaseRepo.countSnapshots(userId),
  ]);

  return {
    sessionId: userId,
    notionWorkspaceName: null,
    notionTargetPageId: null,
    notionTargetPageIds: [],
    notionPages: [],
    notionDatabases: [],
    facebookConnected: false,
    facebookTokenExpired: false,
    autoSchedule: {
      enabled: scheduleConfig?.enabled ?? false,
      frequency: scheduleConfig?.frequency ?? "daily",
      time: scheduleConfig?.time ?? "09:00",
      timezone: scheduleConfig?.timezone ?? "UTC",
    },
    remainingFreeSaves: Math.max(env.APP_FREE_SAVE_LIMIT - saveCount, 0),
    accounts: [],
  };
}
