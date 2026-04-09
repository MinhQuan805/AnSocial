import type {
  InsightBreakdown,
  InsightPeriod,
  InsightRangeDays,
  InsightTimeframe,
} from "@/lib/core/domain";
import { resolveInsightRequest } from "@/lib/insights/metric-rules";

export function buildGraphApiUrl(params: {
  accountId: string;
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
  const until = Math.floor(Date.now() / 1000);
  const since = until - resolved.rangeDays * 24 * 60 * 60;
  const url = new URL(`https://graph.facebook.com/v25.0/${params.accountId}/insights`);

  url.searchParams.set("metric", resolved.effectiveMetrics.join(","));
  url.searchParams.set("metric_type", resolved.metricType);
  url.searchParams.set("period", resolved.period);

  if (resolved.breakdown) {
    url.searchParams.set("breakdown", resolved.breakdown);
  }

  if (resolved.timeframe) {
    url.searchParams.set("timeframe", resolved.timeframe);
  }

  if (resolved.period === "day") {
    url.searchParams.set("since", String(since));
    url.searchParams.set("until", String(until));
  }

  return url.toString();
}

export function buildGraphMediaApiUrl(params: {
  accountId: string;
  fields: string[];
  limit: number;
  endpoint: "account_media" | "tagged_media";
}): string {
  const url = new URL(
    `https://graph.facebook.com/v25.0/${params.accountId}/${
      params.endpoint === "tagged_media" ? "tags" : "media"
    }`,
  );
  const fields = Array.from(
    new Set(params.fields.map((item) => item.trim()).filter((item) => item.length > 0)),
  );

  if (fields.length > 0) {
    url.searchParams.set("fields", fields.join(","));
  }

  url.searchParams.set("limit", String(params.limit));
  return url.toString();
}
