import type {
  AutoScheduleSettings,
  InsightBreakdown,
  InsightRangeDays,
  InsightTimeframe,
} from '@/lib/core/domain';
import type { EndpointId, IdType } from '@/lib/insights/endpoint-registry';

export type { AutoScheduleSettings };

export type SessionView = {
  sessionId?: string | null;
  notionWorkspaceName: string | null;
  notionTargetPageId: string | null;
  notionTargetPageIds: string[];
  notionPages: Array<{
    id: string;
    title: string;
    databases?: Array<{ id: string; title: string; parentPageId?: string | null }>;
  }>;
  notionDatabases: Array<{ id: string; title: string; parentPageId?: string | null }>;
  facebookConnected: boolean;
  facebookTokenExpired?: boolean;
  autoSchedule: AutoScheduleSettings;
  remainingFreeSaves: number;
  accounts: Array<{ id: string; username: string }>;
};

export type InsightReport = {
  query: {
    requestedMetrics: string[];
    period: 'day' | 'lifetime';
    rangeDays: InsightRangeDays;
    metrics: string[];
    metricType: 'total_value' | 'time_series';
    timeframe?: InsightTimeframe;
    breakdown?: InsightBreakdown;
    warnings: string[];
    mediaFormat: 'ALL' | 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM';
    urlPreview: string;
  };
  invalidAccounts: string[];
  generatedAt: string;
  accounts: Array<{
    accountId: string;
    accountHandle: string;
    engagementRate: number;
    reach: Array<{ endTime: string; value: number }>;
    impressions: Array<{ endTime: string; value: number }>;
    accountsEngaged: Array<{ endTime: string; value: number }>;
    profileViews: Array<{ endTime: string; value: number }>;
    metricResults: Array<{
      metric: string;
      period: string;
      totalValue: number;
      points: Array<{ endTime: string; value: number }>;
      breakdowns: Array<{
        metric: string;
        dimensionKeys: string[];
        dimensionValues: string[];
        value: number;
        endTime?: string;
      }>;
    }>;
    recommendations: Array<{ title: string; summary: string; confidence: string }>;
  }>;
};

export type MediaReport = {
  query: {
    endpoint: string;
    fields: string[];
    limit: number;
    urlPreview: string;
  };
  invalidAccounts: string[];
  accounts: Array<{
    accountId: string;
    accountHandle: string;
    items: Array<Record<string, unknown>>;
  }>;
  generatedAt: string;
};

export type HttpRequestReport = {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    params?: Array<{ key: string; value: string }>;
    body?: string;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
  };
  generatedAt: string;
};

/** Legacy endpoint key — kept for backward compatibility with API routes */
export type EndpointKey = 'account_insights' | 'account_media' | 'tagged_media';

/** New endpoint selection state */
export type EndpointSelection = {
  idType: IdType;
  endpointId: EndpointId;
};

export type RequestParameterRow = {
  key: string;
  value: string;
  required: boolean;
};
