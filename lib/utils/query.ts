import {
  type InsightBreakdown,
  type InsightTimeframe,
  type GraphInsightsQuery,
  type InsightPeriod,
  type InsightRangeDays,
  type MediaFormatFilter,
} from '@/lib/core/domain';
import { resolveInsightRequest } from '@/lib/insights/metric-rules';

export function buildGraphInsightsUrlPreview(params: {
  igAccountId: string;
  metrics: string[];
  period: InsightPeriod;
  rangeDays: InsightRangeDays;
  breakdown?: InsightBreakdown;
  timeframe?: InsightTimeframe;
}): string {
  const resolved = resolveInsightRequest({
    metrics: params.metrics,
    period: params.period,
    rangeDays: params.rangeDays,
    breakdown: params.breakdown,
    timeframe: params.timeframe,
  });
  const range = unixRangeFromDays(resolved.rangeDays);
  const url = new URL(`https://graph.facebook.com/v25.0/${params.igAccountId}/insights`);

  url.searchParams.set('metric', resolved.effectiveMetrics.join(','));
  url.searchParams.set('period', resolved.period);
  url.searchParams.set('metric_type', resolved.metricType);

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

export function buildGraphMediaUrlPreview(params: {
  igAccountId: string;
  fields: string[];
  limit: number;
  endpoint: 'account_media' | 'tagged_media';
}): string {
  const url = new URL(
    `https://graph.facebook.com/v25.0/${params.igAccountId}/${
      params.endpoint === 'tagged_media' ? 'tags' : 'media'
    }`
  );
  const uniqueFields = Array.from(
    new Set(params.fields.map((item) => item.trim()).filter((item) => item.length > 0))
  );

  if (uniqueFields.length > 0) {
    url.searchParams.set('fields', uniqueFields.join(','));
  }

  url.searchParams.set('limit', String(params.limit));
  return url.toString();
}

export function normalizeAccountInput(value: string): string {
  return value.trim().replace(/^@/, '');
}

export function unixRangeFromDays(
  rangeDays: InsightRangeDays,
  customStartDate?: Date,
  customEndDate?: Date
): {
  sinceUnix: number;
  untilUnix: number;
} {
  const untilUnix =
    customEndDate && !Number.isNaN(customEndDate.getTime())
      ? Math.floor(customEndDate.getTime() / 1000)
      : Math.floor(Date.now() / 1000);
  const today = new Date();

  let sinceUnix: number;

  if (typeof rangeDays === 'number') {
    sinceUnix = untilUnix - rangeDays * 24 * 60 * 60;
  } else {
    switch (rangeDays) {
      case 'today': {
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        sinceUnix = Math.floor(startOfToday.getTime() / 1000);
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        sinceUnix = Math.floor(startOfYesterday.getTime() / 1000);
        break;
      }
      case 'this_month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        sinceUnix = Math.floor(startOfMonth.getTime() / 1000);
        break;
      }
      case 'last_month': {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        sinceUnix = Math.floor(startOfLastMonth.getTime() / 1000);
        break;
      }
      case 'custom': {
        if (!customStartDate) {
          sinceUnix = untilUnix - 30 * 24 * 60 * 60; // Default to last 30 days
        } else {
          sinceUnix = Math.floor(customStartDate.getTime() / 1000);
        }
        break;
      }
      default:
        sinceUnix = untilUnix - 7 * 24 * 60 * 60; // Default to 7 days
    }
  }

  return { sinceUnix, untilUnix };
}

export function toGraphQuery(args: {
  igAccountId: string;
  metrics: string[];
  period: InsightPeriod;
  rangeDays: InsightRangeDays;
  mediaFormat: MediaFormatFilter;
  breakdown?: InsightBreakdown;
  timeframe?: InsightTimeframe;
  customStartDate?: string;
  customEndDate?: string;
}): GraphInsightsQuery {
  const resolved = resolveInsightRequest({
    metrics: args.metrics,
    period: args.period,
    rangeDays: args.rangeDays,
    breakdown: args.breakdown,
    timeframe: args.timeframe,
  });

  let customStartDateObj: Date | undefined;
  let customEndDateObj: Date | undefined;

  if (args.customStartDate) {
    customStartDateObj = new Date(args.customStartDate);
  }

  if (args.customEndDate) {
    customEndDateObj = new Date(args.customEndDate);
  }

  const range = unixRangeFromDays(resolved.rangeDays, customStartDateObj, customEndDateObj);

  return {
    igAccountId: args.igAccountId,
    requestedMetrics: resolved.requestedMetrics,
    effectiveMetrics: resolved.effectiveMetrics,
    metricType: resolved.metricType,
    period: resolved.period,
    timeframe: resolved.timeframe,
    breakdown: resolved.breakdown,
    warnings: resolved.warnings,
    mediaFormat: args.mediaFormat,
    sinceUnix: resolved.period === 'day' ? range.sinceUnix : undefined,
    untilUnix: resolved.period === 'day' ? range.untilUnix : undefined,
  };
}
