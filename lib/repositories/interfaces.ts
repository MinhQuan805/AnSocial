import type {
  AccountMetricResult,
  AccountInsightsResult,
  GraphInsightsQuery,
  InstagramAccount,
  IntegrationRecord,
  MarketingInsightReport,
  NotionPageReference,
  NotionIntegration,
  FacebookIntegration,
  AutoScheduleConfig,
  SaveInsightPayload,
} from "@/lib/core/domain";

export interface IFacebookGraphRepository {
  exchangeCodeForShortToken(code: string, redirectUri: string): Promise<string>;
  exchangeShortForLongToken(shortToken: string): Promise<{ token: string; expiresIn: number }>;
  getAuthenticatedUser(accessToken: string): Promise<{ id: string; name?: string }>;
  getInstagramAccounts(accessToken: string): Promise<InstagramAccount[]>;
  getAccountInsights(
    query: GraphInsightsQuery,
    accessToken: string,
  ): Promise<AccountMetricResult[]>;
  getAccountMedia(args: {
    igAccountId: string;
    fields: string[];
    limit: number;
    endpoint: "account_media" | "tagged_media";
    accessToken: string;
  }): Promise<Array<Record<string, unknown>>>;
  getMediaPerformance(
    igAccountId: string,
    sinceUnix: number,
    mediaFormat: GraphInsightsQuery["mediaFormat"],
    accessToken: string,
  ): Promise<AccountInsightsResult["mediaPerformance"]>;
  getOnlineFollowers(
    igAccountId: string,
    accessToken: string,
  ): Promise<Record<string, number>>;
  getAudienceDemographics(
    igAccountId: string,
    accessToken: string,
  ): Promise<AccountInsightsResult["demographics"]>;
}

export interface INotionRepository {
  exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; workspaceId: string; workspaceName: string }>;
  listAvailablePages(accessToken: string): Promise<NotionPageReference[]>;
  appendInsightReport(args: {
    accessToken: string;
    pageId: string;
    report: MarketingInsightReport;
  }): Promise<{ message: string }>;
  createDatabase(args: {
    accessToken: string;
    parentPageId: string;
    databaseTitle: string;
    properties?: Record<string, unknown>;
    defaultFields?: string[];
  }): Promise<{ id: string; title: string }>;
  createPage(args: {
    accessToken: string;
    parentWorkspaceId: string;
    pageTitle: string;
  }): Promise<{ id: string; title: string }>;
  saveDatabasePage(args: {
    accessToken: string;
    databaseId: string;
    report: MarketingInsightReport;
  }): Promise<{ id: string; url: string }>;
  saveMediaDatabasePage(args: {
    accessToken: string;
    databaseId: string;
    report: NonNullable<SaveInsightPayload["mediaReport"]>;
  }): Promise<{ id: string; url: string }>;
  validateDatabaseProperties(args: {
    accessToken: string;
    databaseId: string;
  }): Promise<{ isValid: boolean; missingProperties: string[] }>;
}

// ============================================================================
// NEW NORMALIZED REPOSITORY INTERFACE
// ============================================================================

export interface ISupabaseRepository {
  // Notion integrations
  getNotionIntegration(userId: string): Promise<NotionIntegration | null>;
  upsertNotionIntegration(
    userId: string,
    patch: Partial<NotionIntegration>,
  ): Promise<NotionIntegration>;

  // Facebook integrations
  getFacebookIntegration(userId: string): Promise<FacebookIntegration | null>;
  upsertFacebookIntegration(
    userId: string,
    patch: Partial<FacebookIntegration>,
  ): Promise<FacebookIntegration>;

  // Auto schedule configs
  getAutoScheduleConfig(userId: string): Promise<AutoScheduleConfig | null>;
  upsertAutoScheduleConfig(
    userId: string,
    patch: Partial<AutoScheduleConfig>,
  ): Promise<AutoScheduleConfig>;

  // Insight snapshots
  countSnapshots(userId: string): Promise<number>;
  saveSnapshot(args: {
    userId: string;
    sourceAccount: string;
    report: MarketingInsightReport;
  }): Promise<void>;

  // @deprecated Use getNotionIntegration, getFacebookIntegration, getAutoScheduleConfig
  getIntegration(userId: string): Promise<IntegrationRecord | null>;

  // @deprecated Use upsertNotionIntegration, upsertFacebookIntegration, upsertAutoScheduleConfig
  upsertIntegration(
    userId: string,
    patch: Partial<IntegrationRecord>,
  ): Promise<IntegrationRecord>;
}
