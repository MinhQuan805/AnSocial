import type {
  AccountMetricResult,
  AccountInsightsResult,
  GraphInsightsQuery,
  InstagramAccount,
  IntegrationRecord,
  MarketingInsightReport,
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
  appendInsightReport(args: {
    accessToken: string;
    pageId: string;
    report: MarketingInsightReport;
  }): Promise<{ message: string }>;
}

export interface ISupabaseRepository {
  getIntegration(sessionId: string): Promise<IntegrationRecord | null>;
  upsertIntegration(
    sessionId: string,
    patch: Partial<IntegrationRecord>,
  ): Promise<IntegrationRecord>;
  countSnapshots(sessionId: string): Promise<number>;
  saveSnapshot(args: {
    sessionId: string;
    sourceAccount: string;
    report: MarketingInsightReport;
  }): Promise<void>;
}
