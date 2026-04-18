import { NextRequest } from 'next/server';

import { withAuth } from '@/lib/services/auth-middleware';
import { getServices } from '@/lib/services/factory';
import { fail, ok } from '@/lib/utils/response';
import { insightRequestSchema } from '@/lib/validators/input';

async function handler(request: NextRequest, userId: string) {
  try {
    console.log('[DEBUG] 🔍 Insights request started for userId:', userId);
    const services = getServices();

    const body = await request.json();
    console.log('[DEBUG] 📦 Request body:', JSON.stringify(body));

    const payload = insightRequestSchema.parse(body);
    console.log('[DEBUG] ✅ Request validated');

    const report = await services.marketingInsightsService.generateReport({
      userId,
      accountInputs: payload.accountInputs,
      selectedAccountIds: payload.selectedAccountIds,
      metrics: payload.metrics,
      period: payload.period,
      rangeDays: payload.rangeDays,
      mediaFormat: payload.mediaFormat,
      breakdown: payload.breakdown,
      timeframe: payload.timeframe,
    });

    console.log('[DEBUG] 📊 Report generated successfully');
    return ok(report);
  } catch (error) {
    console.error('[ERROR] 🔴 Insights API error:', error);
    return fail(error);
  }
}

const services = getServices();
export const POST = withAuth(handler, services.authMiddleware);
