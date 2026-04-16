import {
  type AccountMetricResult,
  type AccountInsightsResult,
  type GraphInsightsQuery,
  type InstagramAccount,
} from "@/lib/core/domain";
import { ExternalApiError } from "@/lib/core/errors";
import { ApiClient } from "@/lib/infra/http/api-client";
import { filterFieldsForEndpoint } from "@/lib/insights/filter-media-fields";
import type { IFacebookGraphRepository } from "@/lib/repositories/interfaces";

interface GraphListResponse<T> {
  data?: T[];
}

export class FacebookGraphRepository implements IFacebookGraphRepository {
  private readonly baseUrl = "https://graph.facebook.com/v25.0";

  constructor(private readonly client: ApiClient) {}

  public async exchangeCodeForShortToken(code: string, redirectUri: string): Promise<string> {
    const url = new URL(`${this.baseUrl}/oauth/access_token`);
    url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
    url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    const payload = await this.client.requestJson<{ access_token?: string }>({
      url: url.toString(),
      timeoutMs: 15_000,
      retryCount: 1,
    });

    if (!payload.access_token) {
      throw new ExternalApiError("Facebook OAuth response does not include access_token", 502);
    }

    return payload.access_token;
  }

  public async exchangeShortForLongToken(
    shortToken: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const url = new URL(`${this.baseUrl}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
    url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
    url.searchParams.set("fb_exchange_token", shortToken);

    const payload = await this.client.requestJson<{
      access_token?: string;
      expires_in?: number;
    }>({
      url: url.toString(),
      timeoutMs: 15_000,
      retryCount: 2,
    });

    if (!payload.access_token) {
      throw new ExternalApiError("Unable to exchange long-lived Facebook token", 502);
    }

    return {
      token: payload.access_token,
      expiresIn: payload.expires_in ?? 60 * 24 * 60 * 60,
    };
  }

  public async getAuthenticatedUser(accessToken: string): Promise<{ id: string; name?: string }> {
    const url = new URL(`${this.baseUrl}/me`);
    url.searchParams.set("fields", "id,name");

    const payload = await this.client.requestJson<{ id?: string; name?: string }>({
      url: url.toString(),
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 10_000,
      retryCount: 1,
    });

    if (!payload.id) {
      throw new ExternalApiError("Unable to load authenticated Meta user", 502);
    }

    return { id: payload.id, name: payload.name };
  }

  public async getInstagramAccounts(accessToken: string): Promise<InstagramAccount[]> {
    const url = new URL(`${this.baseUrl}/me/accounts`);
    url.searchParams.set("fields", "id,name,instagram_business_account{id,username}");

    console.log("[FB API] 📡 Calling Graph API: /me/accounts");
    console.log("[FB API] Token preview:", accessToken.substring(0, 15) + "...");
    console.log("[FB API] Full URL:", url.toString());

    const payload = await this.client.requestJson<
      GraphListResponse<{
        id?: string;
        name?: string;
        instagram_business_account?: { id?: string; username?: string };
      }>
    >({
      url: url.toString(),
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 15_000,
      retryCount: 2,
    });

    console.log("[FB API] ✅ Response data:", payload.data?.length ?? 0, "items");

    return (payload.data ?? [])
      .flatMap((page) => {
        if (!page.instagram_business_account?.id) {
          return [];
        }

        return [
          {
            id: page.instagram_business_account.id,
            username:
              page.instagram_business_account.username ?? page.name ?? page.instagram_business_account.id,
            pageId: page.id,
            pageName: page.name,
          },
        ];
      })
      .filter((account) => account.id.length > 0);
  }

  public async getAccountInsights(
    query: GraphInsightsQuery,
    accessToken: string,
  ): Promise<AccountMetricResult[]> {
    const url = new URL(`${this.baseUrl}/${query.igAccountId}/insights`);
    url.searchParams.set("metric", query.effectiveMetrics.join(","));
    url.searchParams.set("period", query.period);
    url.searchParams.set("metric_type", query.metricType);

    if (query.breakdown) {
      url.searchParams.set("breakdown", query.breakdown);
    }

    if (query.timeframe) {
      url.searchParams.set("timeframe", query.timeframe);
    }

    if (query.period === "day" && query.sinceUnix && query.untilUnix) {
      url.searchParams.set("since", String(query.sinceUnix));
      url.searchParams.set("until", String(query.untilUnix));
    }

    const payload = await this.client.requestJson<
      GraphListResponse<{
        name?: string;
        period?: string;
        values?: Array<{ value?: unknown; end_time?: string }>;
        total_value?: {
          value?: unknown;
          breakdowns?: Array<{
            dimension_keys?: string[];
            results?: Array<{
              dimension_values?: string[];
              value?: unknown;
              end_time?: string;
            }>;
          }>;
        };
      }>
    >({
      url: url.toString(),
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 20_000,
      retryCount: 2,
    });

    return (payload.data ?? []).map((metric) => {
      const points = (metric.values ?? []).map((row) => ({
        value: this.asNumber(row.value),
        endTime: row.end_time ?? new Date().toISOString(),
      }));

      const breakdowns = (metric.total_value?.breakdowns ?? []).flatMap((part) => {
        const dimensionKeys = part.dimension_keys ?? [];

        return (part.results ?? []).map((result) => ({
          metric: metric.name ?? "unknown",
          dimensionKeys,
          dimensionValues: result.dimension_values ?? [],
          value: this.asNumber(result.value),
          endTime: result.end_time,
        }));
      });

      const totalFromPoints = points.reduce((sum, item) => sum + item.value, 0);

      return {
        metric: metric.name ?? "unknown",
        period: metric.period ?? query.period,
        points,
        totalValue: this.asNumber(metric.total_value?.value) || totalFromPoints,
        breakdowns,
      } satisfies AccountMetricResult;
    });
  }

  public async getAccountMedia(args: {
    igAccountId: string;
    fields: string[];
    limit: number;
    endpoint: "account_media" | "tagged_media";
    accessToken: string;
  }): Promise<Array<Record<string, unknown>>> {
    const path = args.endpoint === "tagged_media" ? "tags" : "media";
    const supportedFields = filterFieldsForEndpoint(args.fields, args.endpoint);
    const url = new URL(`${this.baseUrl}/${args.igAccountId}/${path}`);
    url.searchParams.set("fields", supportedFields.join(","));
    url.searchParams.set("limit", String(args.limit));

    const payload = await this.client.requestJson<GraphListResponse<Record<string, unknown>>>({
      url: url.toString(),
      headers: { Authorization: `Bearer ${args.accessToken}` },
      timeoutMs: 20_000,
      retryCount: 2,
    });

    return (payload.data ?? []).map((item) => {
      const selected: Record<string, unknown> = {};

      for (const field of supportedFields) {
        selected[field] = item[field];
      }

      if (typeof selected.id !== "string" && typeof item.id === "string") {
        selected.id = item.id;
      }

      return selected;
    });
  }

  public async getMediaPerformance(
    igAccountId: string,
    sinceUnix: number,
    mediaFormat: GraphInsightsQuery["mediaFormat"],
    accessToken: string,
  ): Promise<AccountInsightsResult["mediaPerformance"]> {
    const url = new URL(`${this.baseUrl}/${igAccountId}/media`);
    url.searchParams.set(
      "fields",
      "id,media_type,caption,timestamp,like_count,comments_count",
    );
    url.searchParams.set("limit", "50");

    const payload = await this.client.requestJson<
      GraphListResponse<{
        id?: string;
        media_type?: string;
        caption?: string;
        timestamp?: string;
        like_count?: number;
        comments_count?: number;
      }>
    >({
      url: url.toString(),
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 20_000,
      retryCount: 2,
    });

    const sinceIso = new Date(sinceUnix * 1000);

    return (payload.data ?? [])
      .filter((media) => {
        const mediaType = media.media_type ?? "";
        if (mediaFormat !== "ALL" && mediaType !== mediaFormat) {
          return false;
        }

        if (!media.timestamp) {
          return true;
        }

        return new Date(media.timestamp) >= sinceIso;
      })
      .map((media) => {
        const likeCount = Number(media.like_count ?? 0);
        const commentCount = Number(media.comments_count ?? 0);
        return {
          mediaId: media.id ?? "unknown",
          mediaType: media.media_type ?? "UNKNOWN",
          likeCount,
          commentCount,
          caption: media.caption,
          timestamp: media.timestamp,
          engagementScore: likeCount + commentCount,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 20);
  }

  public async getOnlineFollowers(
    igAccountId: string,
    accessToken: string,
  ): Promise<Record<string, number>> {
    const url = new URL(`${this.baseUrl}/${igAccountId}/insights`);
    url.searchParams.set("metric", "online_followers");
    url.searchParams.set("period", "lifetime");

    const payload = await this.client.requestJson<
      GraphListResponse<{ values?: Array<{ value?: Record<string, number> }> }>
    >({
      url: url.toString(),
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 20_000,
      retryCount: 1,
    });

    const first = payload.data?.[0]?.values?.[0]?.value;
    return first ?? {};
  }

  public async getAudienceDemographics(
    igAccountId: string,
    accessToken: string,
  ): Promise<AccountInsightsResult["demographics"]> {
    const url = new URL(`${this.baseUrl}/${igAccountId}/insights`);
    url.searchParams.set("metric", "follower_demographics");
    url.searchParams.set("period", "lifetime");
    url.searchParams.set("metric_type", "total_value");
    url.searchParams.set("breakdown", "age,gender,country,city");
    url.searchParams.set("timeframe", "this_month");

    try {
      const payload = await this.client.requestJson<
        GraphListResponse<{
          total_value?: {
            breakdowns?: Array<{
              dimension_values?: string[];
              results?: Array<{ dimension_values?: string[]; value?: number }>;
            }>;
          };
        }>
      >({
        url: url.toString(),
        headers: { Authorization: `Bearer ${accessToken}` },
        timeoutMs: 20_000,
        retryCount: 1,
      });

      const breakdowns = payload.data?.[0]?.total_value?.breakdowns ?? [];
      const results = breakdowns.flatMap((part) => part.results ?? []);

      const toBuckets = (index: number) =>
        results
          .map((item) => {
            const label = item.dimension_values?.[index] ?? "unknown";
            return {
              label,
              value: Number(item.value ?? 0),
            };
          })
          .filter((item) => item.value > 0)
          .slice(0, 45);

      return {
        ageGender: toBuckets(0),
        countries: toBuckets(1),
        cities: toBuckets(2),
      };
    } catch {
      return {
        ageGender: [],
        countries: [],
        cities: [],
      };
    }
  }

  private asNumber(value: unknown): number {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).reduce(
        (sum: number, item) => sum + this.asNumber(item),
        0,
      );
    }

    return 0;
  }
}
