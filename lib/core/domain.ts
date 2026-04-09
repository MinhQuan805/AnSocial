export type InsightPeriod = "day" | "week" | "month" | "lifetime";

export type InsightMetricType = "total_value" | "time_series";

export type InsightTimeframe = "this_week" | "this_month";

export type InsightBreakdown =
  | "contact_button_type"
  | "follow_type"
  | "follower_type"
  | "media_product_type"
  | "age"
  | "city"
  | "country"
  | "gender";

export type InsightRangeDays = 7 | 30;

export type MediaFormatFilter =
  | "ALL"
  | "IMAGE"
  | "VIDEO"
  | "REEL"
  | "CAROUSEL_ALBUM";

export interface GraphInsightsQuery {
  igAccountId: string;
  requestedMetrics: string[];
  effectiveMetrics: string[];
  metricType: InsightMetricType;
  period: "day" | "lifetime";
  timeframe?: InsightTimeframe;
  breakdown?: InsightBreakdown;
  warnings: string[];
  sinceUnix?: number;
  untilUnix?: number;
  mediaFormat: MediaFormatFilter;
}

export interface InstagramAccount {
  id: string;
  username: string;
  pageId?: string;
  pageName?: string;
}

export interface TimeSeriesPoint {
  endTime: string;
  value: number;
}

export interface InsightBreakdownPoint {
  metric: string;
  dimensionKeys: string[];
  dimensionValues: string[];
  value: number;
  endTime?: string;
}

export interface AccountMetricResult {
  metric: string;
  period: string;
  totalValue: number;
  points: TimeSeriesPoint[];
  breakdowns: InsightBreakdownPoint[];
}

export interface AudienceBucket {
  label: string;
  value: number;
}

export interface AudienceDemographics {
  ageGender: AudienceBucket[];
  countries: AudienceBucket[];
  cities: AudienceBucket[];
}

export interface MediaPerformance {
  mediaId: string;
  mediaType: string;
  likeCount: number;
  commentCount: number;
  caption?: string;
  timestamp?: string;
  engagementScore: number;
}

export interface MarketingRecommendation {
  title: string;
  summary: string;
  confidence: "high" | "medium" | "low";
}

export interface AccountInsightsResult {
  accountId: string;
  accountHandle: string;
  reach: TimeSeriesPoint[];
  impressions: TimeSeriesPoint[];
  profileViews: TimeSeriesPoint[];
  accountsEngaged: TimeSeriesPoint[];
  engagementRate: number;
  demographics: AudienceDemographics;
  metricResults: AccountMetricResult[];
  mediaPerformance: MediaPerformance[];
  recommendations: MarketingRecommendation[];
}

export interface MarketingInsightReport {
  query: {
    requestedMetrics: string[];
    rangeDays: InsightRangeDays;
    metrics: string[];
    metricType: InsightMetricType;
    period: "day" | "lifetime";
    timeframe?: InsightTimeframe;
    breakdown?: InsightBreakdown;
    mediaFormat: MediaFormatFilter;
    urlPreview: string;
    warnings: string[];
  };
  invalidAccounts: string[];
  accounts: AccountInsightsResult[];
  generatedAt: string;
}

export interface IntegrationRecord {
  sessionId: string;
  notionWorkspaceId?: string | null;
  notionWorkspaceName?: string | null;
  notionAccessToken?: string | null;
  notionTargetPageId?: string | null;
  facebookUserId?: string | null;
  facebookAccessToken?: string | null;
  facebookTokenExpiresAt?: string | null;
}

export interface SaveInsightPayload {
  sourceAccount: string;
  report: MarketingInsightReport;
  saveToNotion: boolean;
  notionPageId?: string;
}

export interface SaveInsightResult {
  savedToDatabase: boolean;
  savedToNotion: boolean;
  remainingFreeSaves: number;
  notionMessage?: string;
}

export interface N8nExportInput {
  pageId: string;
  graphUrl: string;
  metrics: string[];
  period: InsightPeriod;
  metricType?: InsightMetricType;
  timeframe?: InsightTimeframe;
  breakdown?: InsightBreakdown;
  rangeDays: InsightRangeDays;
}
