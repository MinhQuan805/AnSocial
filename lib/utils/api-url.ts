import type {
  InsightBreakdown,
  InsightPeriod,
  InsightRangeDays,
  InsightTimeframe,
} from '@/lib/core/domain';
import { resolveInsightRequest } from '@/lib/insights/metric-rules';
import { unixRangeFromDays } from '@/lib/utils/query';

export function buildGraphApiUrl(params: {
  accountId: string;
  metrics: string[];
  period: InsightPeriod;
  rangeDays: InsightRangeDays;
  breakdown?: InsightBreakdown;
  timeframe?: InsightTimeframe;
  customStartDate?: Date;
  customEndDate?: Date;
}): string {
  const resolved = resolveInsightRequest({
    metrics: params.metrics,
    period: params.period,
    rangeDays: params.rangeDays,
    breakdown: params.breakdown,
    timeframe: params.timeframe,
  });
  const range = unixRangeFromDays(resolved.rangeDays, params.customStartDate, params.customEndDate);
  const url = new URL(`https://graph.facebook.com/v25.0/${params.accountId}/insights`);

  url.searchParams.set('metric', resolved.effectiveMetrics.join(','));
  url.searchParams.set('metric_type', resolved.metricType);
  url.searchParams.set('period', resolved.period);

  if (resolved.breakdown) {
    url.searchParams.set('breakdown', resolved.breakdown);
  }

  if (resolved.timeframe) {
    url.searchParams.set('timeframe', resolved.timeframe);
  }

  if (resolved.period === 'day') {
    url.searchParams.set('since', String(range.sinceUnix));
    url.searchParams.set('until', String(range.untilUnix));
  }

  return url.toString();
}

export function buildGraphMediaApiUrl(params: {
  accountId: string;
  fields: string[];
  limit: number;
  endpoint: 'account_media' | 'tagged_media';
}): string {
  const url = new URL(
    `https://graph.facebook.com/v25.0/${params.accountId}/${
      params.endpoint === 'tagged_media' ? 'tags' : 'media'
    }`
  );
  const fields = Array.from(
    new Set(params.fields.map((item) => item.trim()).filter((item) => item.length > 0))
  );

  if (fields.length > 0) {
    url.searchParams.set('fields', fields.join(','));
  }

  url.searchParams.set('limit', String(params.limit));
  return url.toString();
}

/**
 * Build a Graph API URL for /{ig_media_id} endpoints.
 * Covers: /{media_id}, /{media_id}/insights, /{media_id}/children,
 *         /{media_id}/comments, /{media_id}/collaborators, /{media_id}/product_tags
 */
export function buildGraphMediaIdApiUrl(params: {
  mediaId: string;
  edge: string; // "" | "insights" | "children" | "comments" | "collaborators" | "product_tags"
  fields?: string[];
  metrics?: string[];
  metricType?: string;
  period?: string;
}): string {
  const pathSuffix = params.edge ? `/${params.edge}` : '';
  const url = new URL(`https://graph.facebook.com/v25.0/${params.mediaId}${pathSuffix}`);

  if (params.edge === 'insights' && params.metrics && params.metrics.length > 0) {
    url.searchParams.set('metric', params.metrics.join(','));
    if (params.metricType) {
      url.searchParams.set('metric_type', params.metricType);
    }
    if (params.period) {
      url.searchParams.set('period', params.period);
    }
  } else if (params.fields && params.fields.length > 0) {
    const uniqueFields = Array.from(
      new Set(params.fields.map((f) => f.trim()).filter((f) => f.length > 0))
    );
    if (uniqueFields.length > 0) {
      url.searchParams.set('fields', uniqueFields.join(','));
    }
  }

  return url.toString();
}
