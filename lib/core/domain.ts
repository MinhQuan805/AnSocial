export type InsightPeriod = 'day' | 'week' | 'month' | 'lifetime';

export type InsightMetricType = 'total_value' | 'time_series';

export type InsightTimeframe =
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'prev_month';

export type InsightBreakdown =
  | 'contact_button_type'
  | 'follow_type'
  | 'follower_type'
  | 'media_product_type'
  | 'age'
  | 'city'
  | 'country'
  | 'gender';

export type InsightRangeDays =
  | 1
  | 7
  | 14
  | 30
  | 'today'
  | 'yesterday'
  | 'this_month'
  | 'last_month'
  | 'custom';

export type MediaFormatFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM';

export type AutoScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface AutoScheduleSettings {
  enabled: boolean;
  frequency: AutoScheduleFrequency;
  time: string;
  timezone: string;
}

export interface NotionDatabaseReference {
  id: string;
  title: string;
  parentPageId?: string | null;
}

export interface NotionPageReference {
  id: string;
  title: string;
  databases?: NotionDatabaseReference[];
}

export interface GraphInsightsQuery {
  igAccountId: string;
  requestedMetrics: string[];
  effectiveMetrics: string[];
  metricType: InsightMetricType;
  period: 'day' | 'lifetime';
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
  confidence: 'high' | 'medium' | 'low';
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
    period: 'day' | 'lifetime';
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

// ============================================================================
// NORMALIZED INTEGRATION TYPES
// ============================================================================

export interface NotionIntegration {
  id: string;
  userId: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  accessToken?: string | null;
  targetPageIds?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacebookIntegration {
  id: string;
  userId: string;
  providerUserId?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoScheduleConfig {
  id: string;
  userId: string;
  enabled: boolean;
  frequency: AutoScheduleFrequency;
  time: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * @deprecated Use NotionIntegration, FacebookIntegration, AutoScheduleConfig separately
 * Keeping for backwards compatibility during migration
 */
export interface IntegrationRecord {
  userId: string;
  notionWorkspaceId?: string | null;
  notionWorkspaceName?: string | null;
  notionAccessToken?: string | null;
  notionTargetPageId?: string | null;
  notionTargetPageIds?: string[] | null;
  facebookProviderUserId?: string | null;
  facebookAccessToken?: string | null;
  facebookTokenExpiresAt?: string | null;
  autoScheduleEnabled?: boolean | null;
  autoScheduleFrequency?: AutoScheduleFrequency | null;
  autoScheduleTime?: string | null;
  autoScheduleTimezone?: string | null;
}

export interface SaveInsightPayload {
  sourceAccount: string;
  report?: MarketingInsightReport;
  mediaReport?: {
    query?: {
      endpoint: string;
      fields: string[];
      limit?: number;
      urlPreview?: string;
    };
    invalidAccounts?: string[];
    accounts: Array<{
      accountId?: string;
      accountHandle: string;
      items: Array<Record<string, unknown>>;
    }>;
    generatedAt: string;
  };
  saveToNotion: boolean;
  notionPageIds?: string[];
  notionDatabaseByPageId?: Record<string, string>;
}

export interface SaveInsightResult {
  savedToDatabase: boolean;
  savedToNotion: boolean;
  remainingFreeSaves: number;
  notionMessage?: string;
}

export interface N8nExportInput {
  pageIds: string[];
  graphUrl: string;
  metrics: string[];
  period: InsightPeriod;
  metricType?: InsightMetricType;
  timeframe?: InsightTimeframe;
  breakdown?: InsightBreakdown;
  rangeDays: InsightRangeDays;
  autoSchedule?: AutoScheduleSettings;
}
