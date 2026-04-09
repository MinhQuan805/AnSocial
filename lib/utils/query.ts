import {
  type InsightBreakdown,
  type InsightTimeframe,
  type GraphInsightsQuery,
  type InsightPeriod,
  type InsightRangeDays,
  type MediaFormatFilter,
} from "@/lib/core/domain";
import { resolveInsightRequest } from "@/lib/insights/metric-rules";

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

  url.searchParams.set("metric", resolved.effectiveMetrics.join(","));
  url.searchParams.set("period", resolved.period);
  url.searchParams.set("metric_type", resolved.metricType);

  if (resolved.breakdown) {
    url.searchParams.set("breakdown", resolved.breakdown);
  }

  if (resolved.timeframe) {
    url.searchParams.set("timeframe", resolved.timeframe);
  }

  if (resolved.period === "day") {
    url.searchParams.set("since", String(range.sinceUnix));
    url.searchParams.set("until", String(range.untilUnix));
  }

  return url.toString();
}

export function buildGraphMediaUrlPreview(params: {
  igAccountId: string;
  fields: string[];
  limit: number;
  endpoint: "account_media" | "tagged_media";
}): string {
  const url = new URL(
    `https://graph.facebook.com/v25.0/${params.igAccountId}/${
      params.endpoint === "tagged_media" ? "tags" : "media"
    }`,
  );
  const uniqueFields = Array.from(
    new Set(params.fields.map((item) => item.trim()).filter((item) => item.length > 0)),
  );

  if (uniqueFields.length > 0) {
    url.searchParams.set("fields", uniqueFields.join(","));
  }

  url.searchParams.set("limit", String(params.limit));
  return url.toString();
}

export function normalizeAccountInput(value: string): string {
  return value.trim().replace(/^@/, "");
}

export function unixRangeFromDays(rangeDays: InsightRangeDays): {
  sinceUnix: number;
  untilUnix: number;
} {
  const untilUnix = Math.floor(Date.now() / 1000);
  const sinceUnix = untilUnix - rangeDays * 24 * 60 * 60;
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
}): GraphInsightsQuery {
  const resolved = resolveInsightRequest({
    metrics: args.metrics,
    period: args.period,
    rangeDays: args.rangeDays,
    breakdown: args.breakdown,
    timeframe: args.timeframe,
  });
  const range = unixRangeFromDays(resolved.rangeDays);

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
    sinceUnix: resolved.period === "day" ? range.sinceUnix : undefined,
    untilUnix: resolved.period === "day" ? range.untilUnix : undefined,
  };
}
