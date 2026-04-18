import type {
  AccountInsightsResult,
  InsightBreakdown,
  InsightPeriod,
  InsightRangeDays,
  InsightTimeframe,
  InstagramAccount,
  MarketingInsightReport,
  MediaFormatFilter,
  TimeSeriesPoint,
} from '@/lib/core/domain';
import { AppError, AuthError, ExternalApiError, ValidationError } from '@/lib/core/errors';
import {
  DEFAULT_ACCOUNT_MEDIA_FIELDS,
  DEFAULT_TAGGED_MEDIA_FIELDS,
} from '@/lib/insights/media-fields';
import type { IFacebookGraphRepository, ISupabaseRepository } from '@/lib/repositories/interfaces';
import {
  buildGraphMediaUrlPreview,
  buildGraphInsightsUrlPreview,
  normalizeAccountInput,
  toGraphQuery,
  unixRangeFromDays,
} from '@/lib/utils/query';
import { freeTextAccountSchema } from '@/lib/validators/input';

export class MarketingInsightsService {
  constructor(
    private readonly facebookRepo: IFacebookGraphRepository,
    private readonly supabaseRepo: ISupabaseRepository
  ) {}

  public async generateReport(args: {
    userId: string;
    accountInputs: string[];
    selectedAccountIds: string[];
    metrics: string[];
    period: InsightPeriod;
    rangeDays: InsightRangeDays;
    mediaFormat: MediaFormatFilter;
    breakdown?: InsightBreakdown;
    timeframe?: InsightTimeframe;
    customStartDate?: string;
    customEndDate?: string;
  }): Promise<MarketingInsightReport> {
    const { token, accountMapById, invalidAccounts, resolvedIds } = await this.resolveAccounts({
      userId: args.userId,
      accountInputs: args.accountInputs,
      selectedAccountIds: args.selectedAccountIds,
    });

    const normalizedForReport = toGraphQuery({
      igAccountId: '<ig_account_id>',
      metrics: args.metrics,
      period: args.period,
      rangeDays: args.rangeDays,
      mediaFormat: args.mediaFormat,
      breakdown: args.breakdown,
      timeframe: args.timeframe,
      customStartDate: args.customStartDate,
      customEndDate: args.customEndDate,
    });

    let accountReports: AccountInsightsResult[];

    try {
      accountReports = await Promise.all(
        Array.from(resolvedIds).map(async (accountId) => {
          const query = toGraphQuery({
            igAccountId: accountId,
            metrics: args.metrics,
            period: args.period,
            rangeDays: args.rangeDays,
            mediaFormat: args.mediaFormat,
            breakdown: args.breakdown,
            timeframe: args.timeframe,
            customStartDate: args.customStartDate,
            customEndDate: args.customEndDate,
          });

          const metricResults = await this.facebookRepo.getAccountInsights(query, token);
          const reach = this.metricToSeries(metricResults, 'reach');
          const impressions = this.metricToSeries(metricResults, 'impressions');
          const profileViews = this.metricToSeries(metricResults, 'profile_views');
          const accountsEngaged = this.metricToSeries(metricResults, 'accounts_engaged');
          const demographics = this.extractDemographics(metricResults);

          const fallbackRange = unixRangeFromDays(args.rangeDays);
          const media = await this.facebookRepo.getMediaPerformance(
            accountId,
            query.sinceUnix ?? fallbackRange.sinceUnix,
            args.mediaFormat,
            token
          );
          const onlineFollowers = await this.facebookRepo
            .getOnlineFollowers(accountId, token)
            .catch(() => ({}));

          const reachTotal = reach.reduce((sum, item) => sum + item.value, 0);
          const engagedTotal = accountsEngaged.reduce((sum, item) => sum + item.value, 0);
          const engagementRate = reachTotal > 0 ? engagedTotal / reachTotal : 0;

          const account = accountMapById.get(accountId);

          return {
            accountId,
            accountHandle: account?.username ?? accountId,
            reach,
            impressions,
            profileViews,
            accountsEngaged,
            engagementRate,
            demographics,
            metricResults,
            mediaPerformance: media,
            recommendations: this.generateRecommendations({
              engagementRate,
              media,
              onlineFollowers,
            }),
          } satisfies AccountInsightsResult;
        })
      );
    } catch (error) {
      if (
        error instanceof ExternalApiError &&
        /OAuthException|Error validating access token|Invalid OAuth/i.test(error.message)
      ) {
        throw new AuthError('Facebook token is no longer valid. Please connect again.');
      }

      throw error;
    }

    const primary = accountReports[0]?.accountId ?? '<ig_account_id>';

    return {
      query: {
        requestedMetrics: normalizedForReport.requestedMetrics,
        period: normalizedForReport.period,
        rangeDays:
          normalizedForReport.period === 'lifetime'
            ? normalizedForReport.timeframe === 'this_week'
              ? 7
              : 30
            : args.rangeDays,
        metrics: normalizedForReport.effectiveMetrics,
        metricType: normalizedForReport.metricType,
        timeframe: normalizedForReport.timeframe,
        breakdown: normalizedForReport.breakdown,
        mediaFormat: args.mediaFormat,
        urlPreview: buildGraphInsightsUrlPreview({
          igAccountId: primary,
          metrics: args.metrics,
          period: args.period,
          rangeDays: args.rangeDays,
          breakdown: args.breakdown,
          timeframe: args.timeframe,
        }),
        warnings: normalizedForReport.warnings,
      },
      invalidAccounts,
      accounts: accountReports,
      generatedAt: new Date().toISOString(),
    };
  }

  public async generateMediaReport(args: {
    userId: string;
    accountInputs: string[];
    selectedAccountIds: string[];
    fields: string[];
    limit: number;
    endpoint: 'account_media' | 'tagged_media';
  }): Promise<{
    query: {
      endpoint: 'account_media' | 'tagged_media';
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
  }> {
    const { token, accountMapById, invalidAccounts, resolvedIds } = await this.resolveAccounts({
      userId: args.userId,
      accountInputs: args.accountInputs,
      selectedAccountIds: args.selectedAccountIds,
    });

    const fields = Array.from(
      new Set(args.fields.map((item) => item.trim()).filter((item) => item.length > 0))
    );
    const selectedFields =
      fields.length > 0
        ? fields
        : args.endpoint === 'tagged_media'
          ? DEFAULT_TAGGED_MEDIA_FIELDS
          : DEFAULT_ACCOUNT_MEDIA_FIELDS;

    let accounts: Array<{
      accountId: string;
      accountHandle: string;
      items: Array<Record<string, unknown>>;
    }>;

    try {
      accounts = await Promise.all(
        Array.from(resolvedIds).map(async (accountId) => {
          const items = await this.facebookRepo.getAccountMedia({
            igAccountId: accountId,
            fields: selectedFields,
            limit: args.limit,
            endpoint: args.endpoint,
            accessToken: token,
          });

          return {
            accountId,
            accountHandle: accountMapById.get(accountId)?.username ?? accountId,
            items,
          };
        })
      );
    } catch (error) {
      if (
        error instanceof ExternalApiError &&
        /OAuthException|Error validating access token|Invalid OAuth/i.test(error.message)
      ) {
        throw new AuthError('Facebook token is no longer valid. Please connect again.');
      }

      throw error;
    }

    const primary = accounts[0]?.accountId ?? '<ig_account_id>';

    return {
      query: {
        endpoint: args.endpoint,
        fields: selectedFields,
        limit: args.limit,
        urlPreview: buildGraphMediaUrlPreview({
          igAccountId: primary,
          fields: selectedFields,
          limit: args.limit,
          endpoint: args.endpoint,
        }),
      },
      invalidAccounts,
      accounts,
      generatedAt: new Date().toISOString(),
    };
  }

  private async resolveAccounts(args: {
    userId: string;
    accountInputs: string[];
    selectedAccountIds: string[];
  }): Promise<{
    token: string;
    accountMapById: Map<string, InstagramAccount>;
    invalidAccounts: string[];
    resolvedIds: Set<string>;
  }> {
    const facebookIntegration = await this.supabaseRepo.getFacebookIntegration(args.userId);

    if (!facebookIntegration?.accessToken) {
      throw new AppError(
        'FACEBOOK_NOT_CONNECTED',
        'Instagram/Facebook OAuth is required before fetching insights.',
        401
      );
    }

    console.log('[Check] ✅ ACCESS TOKEN EXISTS - Length:', facebookIntegration.accessToken.length);
    console.log('[Check] Token expiry:', facebookIntegration.tokenExpiresAt);

    if (
      facebookIntegration.tokenExpiresAt &&
      new Date(facebookIntegration.tokenExpiresAt).getTime() <= Date.now()
    ) {
      throw new AuthError('Facebook token expired. Please reconnect from Authorization tab.');
    }

    const token = facebookIntegration.accessToken;
    let accounts: InstagramAccount[];

    try {
      accounts = await this.facebookRepo.getInstagramAccounts(token);
    } catch (error) {
      if (
        error instanceof ExternalApiError &&
        /OAuthException|Error validating access token|Invalid OAuth/i.test(error.message)
      ) {
        throw new AuthError('Facebook token is no longer valid. Please connect again.');
      }

      throw error;
    }
    const accountMapById = new Map(accounts.map((account) => [account.id, account]));
    const accountMapByUsername = new Map(
      accounts.map((account) => [account.username.toLowerCase(), account])
    );
    const cleaned = args.accountInputs.map((item) => item.trim()).filter((item) => item.length > 0);
    const invalidAccounts: string[] = [];
    const resolvedIds = new Set<string>();

    for (const raw of cleaned) {
      const normalized = normalizeAccountInput(raw);
      const validPattern = freeTextAccountSchema.safeParse(normalized);

      if (!validPattern.success) {
        invalidAccounts.push(raw);
        continue;
      }

      if (/^\d+$/.test(normalized) && accountMapById.has(normalized)) {
        resolvedIds.add(normalized);
        continue;
      }

      const mapped = accountMapByUsername.get(normalized.toLowerCase());
      if (mapped) {
        resolvedIds.add(mapped.id);
      } else {
        invalidAccounts.push(raw);
      }
    }

    for (const accountId of args.selectedAccountIds) {
      if (accountMapById.has(accountId)) {
        resolvedIds.add(accountId);
      }
    }

    if (resolvedIds.size === 0 && accounts[0]) {
      resolvedIds.add(accounts[0].id);
    }

    if (resolvedIds.size === 0) {
      throw new ValidationError(
        'No valid Instagram account found. Connect Facebook and select at least one available account.'
      );
    }

    return {
      token,
      accountMapById,
      invalidAccounts,
      resolvedIds,
    };
  }

  private metricToSeries(
    metricResults: AccountInsightsResult['metricResults'],
    metric: string
  ): TimeSeriesPoint[] {
    const matched = metricResults.find((item) => item.metric === metric);
    if (!matched) {
      return [];
    }

    if (matched.points.length > 0) {
      return matched.points;
    }

    return [
      {
        endTime: new Date().toISOString(),
        value: matched.totalValue,
      },
    ];
  }

  private extractDemographics(
    metricResults: AccountInsightsResult['metricResults']
  ): AccountInsightsResult['demographics'] {
    const rows = metricResults.flatMap((metric) => metric.breakdowns);

    return {
      ageGender: this.toBuckets(rows, ['age', 'gender']),
      countries: this.toBuckets(rows, ['country']),
      cities: this.toBuckets(rows, ['city']),
    };
  }

  private toBuckets(
    rows: AccountInsightsResult['metricResults'][number]['breakdowns'],
    dimensionKeys: string[]
  ): AccountInsightsResult['demographics']['ageGender'] {
    const aggregate = new Map<string, number>();

    for (const row of rows) {
      for (const key of dimensionKeys) {
        const index = row.dimensionKeys.indexOf(key);
        if (index < 0) {
          continue;
        }

        const label = row.dimensionValues[index] ?? 'unknown';
        aggregate.set(label, (aggregate.get(label) ?? 0) + row.value);
      }
    }

    return Array.from(aggregate.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 45);
  }

  private generateRecommendations(args: {
    engagementRate: number;
    media: AccountInsightsResult['mediaPerformance'];
    onlineFollowers: Record<string, number>;
  }): AccountInsightsResult['recommendations'] {
    const output: AccountInsightsResult['recommendations'] = [];

    if (args.engagementRate < 0.03) {
      output.push({
        title: 'Increase engagement rate',
        summary:
          'Engagement is below expectations. Prioritize content that addresses specific problems and features clearer CTAs.',
        confidence: 'high',
      });
    } else {
      output.push({
        title: 'Maintain effective content pacing',
        summary:
          'Engagement rate is stable. Keep the current content structure and A/B test headlines to increase Reach.',
        confidence: 'medium',
      });
    }

    if (args.media.length > 0) {
      const byType = args.media.reduce<Record<string, { count: number; score: number }>>(
        (acc, item) => {
          const prev = acc[item.mediaType] ?? { count: 0, score: 0 };
          acc[item.mediaType] = {
            count: prev.count + 1,
            score: prev.score + item.engagementScore,
          };
          return acc;
        },
        {}
      );

      const best = Object.entries(byType)
        .map(([key, value]) => ({ key, avg: value.score / value.count }))
        .sort((a, b) => b.avg - a.avg)[0];

      if (best) {
        output.push({
          title: 'Preferred content format',
          summary: `Currently, the ${best.key} format yields the highest average engagement score.`,
          confidence: 'medium',
        });
      }
    }

    const bestHour = Object.entries(args.onlineFollowers).sort((a, b) => b[1] - a[1])[0];
    if (bestHour) {
      output.push({
        title: 'Recommended golden hour',
        summary: `The time slot with the most followers online is around ${bestHour[0]}:00, prioritize scheduling posts during this period.`,
        confidence: 'high',
      });
    }

    return output;
  }
}
