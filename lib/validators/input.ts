import { z } from "zod";

export const freeTextAccountSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "Account is empty")
  .refine(
    (value) => /^(?:@?[A-Za-z0-9._]{1,30}|\d{5,})$/.test(value),
    "Account must be a username or numeric ID",
  );

export const insightRequestSchema = z.object({
  accountInputs: z.array(z.string()).default([]),
  selectedAccountIds: z.array(z.string().min(1)).default([]),
  metrics: z
    .array(z.string().min(1))
    .min(1)
    .default(["reach", "accounts_engaged"]),
  period: z.enum(["day", "week", "month"]).default("day"),
  rangeDays: z.union([z.literal(7), z.literal(30)]).default(7),
  breakdown: z
    .enum([
      "contact_button_type",
      "follow_type",
      "follower_type",
      "media_product_type",
      "age",
      "city",
      "country",
      "gender",
    ])
    .optional(),
  timeframe: z.enum(["this_week", "this_month"]).optional(),
  mediaFormat: z
    .enum(["ALL", "IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"])
    .default("ALL"),
});

export const mediaRequestSchema = z.object({
  accountInputs: z.array(z.string()).default([]),
  selectedAccountIds: z.array(z.string().min(1)).default([]),
  endpoint: z.enum(["account_media", "tagged_media"]),
  fields: z.array(z.string().min(1)).min(1),
  limit: z.number().int().min(1).max(100).default(25),
});

const metricPointSchema = z.object({
  endTime: z.string(),
  value: z.number(),
});

const recommendationSchema = z.object({
  title: z.string(),
  summary: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const audienceBucketSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const mediaPerformanceSchema = z.object({
  mediaId: z.string(),
  mediaType: z.string(),
  likeCount: z.number(),
  commentCount: z.number(),
  caption: z.string().optional(),
  timestamp: z.string().optional(),
  engagementScore: z.number(),
});

const metricBreakdownPointSchema = z.object({
  metric: z.string(),
  dimensionKeys: z.array(z.string()),
  dimensionValues: z.array(z.string()),
  value: z.number(),
  endTime: z.string().optional(),
});

const accountMetricResultSchema = z.object({
  metric: z.string(),
  period: z.string(),
  totalValue: z.number(),
  points: z.array(metricPointSchema),
  breakdowns: z.array(metricBreakdownPointSchema),
});

const accountInsightSchema = z.object({
  accountId: z.string(),
  accountHandle: z.string(),
  engagementRate: z.number(),
  reach: z.array(metricPointSchema),
  impressions: z.array(metricPointSchema),
  profileViews: z.array(metricPointSchema),
  accountsEngaged: z.array(metricPointSchema),
  demographics: z.object({
    ageGender: z.array(audienceBucketSchema),
    countries: z.array(audienceBucketSchema),
    cities: z.array(audienceBucketSchema),
  }),
  metricResults: z.array(accountMetricResultSchema),
  mediaPerformance: z.array(mediaPerformanceSchema),
  recommendations: z.array(recommendationSchema),
});

export const marketingInsightReportSchema = z.object({
  query: z.object({
    requestedMetrics: z.array(z.string()),
    period: z.enum(["day", "lifetime"]),
    rangeDays: z.union([z.literal(7), z.literal(30)]),
    metrics: z.array(z.string()),
    metricType: z.enum(["total_value", "time_series"]),
    timeframe: z.enum(["this_week", "this_month"]).optional(),
    breakdown: z
      .enum([
        "contact_button_type",
        "follow_type",
        "follower_type",
        "media_product_type",
        "age",
        "city",
        "country",
        "gender",
      ])
      .optional(),
    mediaFormat: z.enum(["ALL", "IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"]),
    urlPreview: z.string().url(),
    warnings: z.array(z.string()),
  }),
  invalidAccounts: z.array(z.string()),
  accounts: z.array(accountInsightSchema),
  generatedAt: z.string(),
});

export const saveInsightSchema = z.object({
  sourceAccount: z.string().min(1),
  report: marketingInsightReportSchema,
  saveToNotion: z.boolean().default(false),
  notionPageId: z.string().optional(),
});

export const exportN8nSchema = z.object({
  pageId: z.string().min(1),
  graphUrl: z.string().url(),
  metrics: z.array(z.string()).min(1),
  period: z.enum(["day", "week", "month", "lifetime"]),
  metricType: z.enum(["total_value", "time_series"]).optional(),
  timeframe: z.enum(["this_week", "this_month"]).optional(),
  breakdown: z
    .enum([
      "contact_button_type",
      "follow_type",
      "follower_type",
      "media_product_type",
      "age",
      "city",
      "country",
      "gender",
    ])
    .optional(),
  rangeDays: z.union([z.literal(7), z.literal(30)]),
});
