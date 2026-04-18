import { NextRequest } from 'next/server';

import { env } from '@/lib/config/env';
import { getServices } from '@/lib/services/factory';
import { fail, ok } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  try {
    const services = getServices();
    const sessionId = services.sessionService.getFromRequest(request);

    if (!sessionId) {
      return ok({
        authenticated: false,
        notionConnected: false,
        facebookConnected: false,
        remainingFreeSaves: env.APP_FREE_SAVE_LIMIT,
        accounts: [],
      });
    }

    const integration = await services.supabaseRepo.getIntegration(sessionId);
    const notionConnected = Boolean(integration?.notionAccessToken);
    const facebookConnected = Boolean(integration?.facebookAccessToken);

    let accounts: Array<{ id: string; username: string }> = [];
    if (facebookConnected && integration?.facebookAccessToken) {
      accounts = (
        await services.facebookGraphRepository.getInstagramAccounts(integration.facebookAccessToken)
      ).map((item) => ({ id: item.id, username: item.username }));
    }

    const usage = await services.supabaseRepo.countSnapshots(sessionId);

    return ok({
      authenticated: notionConnected,
      notionConnected,
      notionWorkspaceName: integration?.notionWorkspaceName ?? null,
      notionTargetPageId:
        integration?.notionTargetPageIds && integration.notionTargetPageIds.length > 0
          ? integration.notionTargetPageIds[0]
          : null,
      facebookConnected,
      remainingFreeSaves: Math.max(env.APP_FREE_SAVE_LIMIT - usage, 0),
      accounts,
    });
  } catch (error) {
    return fail(error);
  }
}
