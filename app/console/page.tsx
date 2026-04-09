import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ConsoleApp } from "@/components/app/console-app";
import { env } from "@/lib/config/env";
import { services } from "@/lib/services/factory";

export default async function ConsolePage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(services.sessionService.cookieName)?.value;

  if (!sessionId) {
    redirect("/");
  }

  const integration = await services.supabaseRepo.getIntegration(sessionId);
  if (!integration?.notionAccessToken) {
    redirect("/");
  }

  let accounts: Array<{ id: string; username: string }> = [];
  if (integration.facebookAccessToken) {
    try {
      accounts = (await services.facebookRepo.getInstagramAccounts(integration.facebookAccessToken)).map(
        (item) => ({ id: item.id, username: item.username }),
      );
    } catch {
      accounts = [];
    }
  }

  const saveCount = await services.supabaseRepo.countSnapshots(sessionId);

  return (
    <ConsoleApp
      session={{
        notionWorkspaceName: integration.notionWorkspaceName ?? null,
        notionTargetPageId: integration.notionTargetPageId ?? null,
        facebookConnected: Boolean(integration.facebookAccessToken),
        remainingFreeSaves: Math.max(env.APP_FREE_SAVE_LIMIT - saveCount, 0),
        accounts,
      }}
    />
  );
}
