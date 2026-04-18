import { AuthError, ExternalApiError } from '@/lib/core/errors';
import type { MarketingInsightReport, SaveInsightPayload } from '@/lib/core/domain';
import { ApiClient } from '@/lib/infra/http/api-client';
import { INSIGHT_METRIC_OPTIONS } from '@/lib/insights/metric-rules';
import type { INotionRepository } from '@/lib/repositories/interfaces';

type NotionTextFragment = {
  plain_text?: string;
};

type NotionTitleProperty = {
  type?: string;
  title?: NotionTextFragment[];
};

type NotionParentReference = {
  type?: string;
  page_id?: string | null;
};

type NotionPageObject = {
  object?: string;
  id?: string;
  properties?: Record<string, NotionTitleProperty>;
};

type NotionDatabaseObject = {
  object?: string;
  id?: string;
  title?: NotionTextFragment[];
  parent?: NotionParentReference;
};

type NotionDatabaseProperty = {
  type?: string;
};

const INSIGHT_METRIC_KEYS = new Set(INSIGHT_METRIC_OPTIONS.map((option) => option.key));

const DEFAULT_NOTION_FIELD_PROPERTY_MAP: Record<string, Record<string, unknown>> = {
  // Media info fields
  id: { rich_text: {} },
  media_type: { select: { options: [] } },
  media_url: { url: {} },
  permalink: { url: {} },
  thumbnail_url: { url: {} },
  timestamp: { date: {} },
  username: { rich_text: {} },
  shortcode: { rich_text: {} },
  owner: { rich_text: {} },
  media_product_type: { select: { options: [] } },
  is_comment_enabled: { checkbox: {} },
  is_shared_to_feed: { checkbox: {} },
  comments_count: { number: {} },
  like_count: { number: {} },
  view_count: { number: {} },
  caption: { rich_text: {} },
  alt_text: { rich_text: {} },
  collaborators: { rich_text: {} },
  'copyright_check_information{status}': { rich_text: {} },
  boost_eligibility_info: { rich_text: {} },
  boost_ads_list: { rich_text: {} },
  legacy_instagram_media_id: { rich_text: {} },
  // IG User fields
  biography: { rich_text: {} },
  website: { url: {} },
  profile_picture_url: { url: {} },
  has_profile_pic: { checkbox: {} },
  is_published: { checkbox: {} },
  followers_count: { number: {} },
  follows_count: { number: {} },
  media_count: { number: {} },
  name: { rich_text: {} },
  legacy_instagram_user_id: { rich_text: {} },
  shopping_product_tag_eligibility: { checkbox: {} },
  // Insight fields
  metric: { rich_text: {} },
  period: { rich_text: {} },
  total_value: { number: {} },
  generated_at: { date: {} },
  end_time: { date: {} },
  account_handle: { rich_text: {} },
};

export class NotionRepository implements INotionRepository {
  private readonly oauthUrl = 'https://api.notion.com/v1/oauth/token';
  private readonly apiBase = 'https://api.notion.com/v1';

  constructor(
    private readonly client: ApiClient,
    private readonly notionVersion: string,
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  public async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; workspaceId: string; workspaceName: string }> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const payload = await this.client.requestJson<{
      access_token?: string;
      workspace_id?: string;
      workspace_name?: string;
    }>({
      url: this.oauthUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      timeoutMs: 15_000,
      retryCount: 1,
    });

    if (!payload.access_token || !payload.workspace_id) {
      throw new ExternalApiError('Invalid Notion OAuth response', 502);
    }

    return {
      accessToken: payload.access_token,
      workspaceId: payload.workspace_id,
      workspaceName: payload.workspace_name ?? 'Notion Workspace',
    };
  }

  public async listAvailablePages(
    accessToken: string
  ): Promise<Array<{ id: string; title: string }>> {
    const pages = new Map<string, { id: string; title: string }>();
    const databasesByPage = new Map<
      string,
      Array<{ id: string; title: string; parentPageId?: string | null }>
    >();
    let nextCursor: string | undefined;

    try {
      do {
        const payload = await this.client.requestJson<{
          results?: NotionPageObject[];
          has_more?: boolean;
          next_cursor?: string | null;
        }>({
          url: `${this.apiBase}/search`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': this.notionVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: { property: 'object', value: 'page' },
            page_size: 100,
            ...(nextCursor ? { start_cursor: nextCursor } : {}),
          }),
          timeoutMs: 20_000,
          retryCount: 1,
        });

        for (const page of payload.results ?? []) {
          if (page.object !== 'page' || !page.id) {
            continue;
          }

          const normalizedId = this.normalizePageId(page.id);
          pages.set(normalizedId, {
            id: normalizedId,
            title: this.extractPageTitle(page),
          });
        }

        nextCursor = payload.has_more ? (payload.next_cursor ?? undefined) : undefined;
      } while (nextCursor);

      let databaseCursor: string | undefined;
      do {
        const payload = await this.client.requestJson<{
          results?: NotionDatabaseObject[];
          has_more?: boolean;
          next_cursor?: string | null;
        }>({
          url: `${this.apiBase}/search`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': this.notionVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: { property: 'object', value: 'database' },
            page_size: 100,
            ...(databaseCursor ? { start_cursor: databaseCursor } : {}),
          }),
          timeoutMs: 20_000,
          retryCount: 1,
        });

        for (const database of payload.results ?? []) {
          if (database.object !== 'database' || !database.id) {
            continue;
          }

          const normalizedDatabaseId = this.normalizePageId(database.id);
          const parentPageId =
            database.parent?.type === 'page_id' && database.parent.page_id
              ? this.normalizePageId(database.parent.page_id)
              : null;

          if (!parentPageId || !pages.has(parentPageId)) {
            continue;
          }

          const existing = databasesByPage.get(parentPageId) ?? [];
          if (existing.some((item) => item.id === normalizedDatabaseId)) {
            continue;
          }

          existing.push({
            id: normalizedDatabaseId,
            title: this.extractDatabaseTitle(database),
            parentPageId,
          });
          databasesByPage.set(parentPageId, existing);
        }

        databaseCursor = payload.has_more ? (payload.next_cursor ?? undefined) : undefined;
      } while (databaseCursor);
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }

    return Array.from(pages.values())
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((page) => ({
        ...page,
        databases: (databasesByPage.get(page.id) ?? []).sort((a, b) =>
          a.title.localeCompare(b.title)
        ),
      }));
  }

  public async appendInsightReport(args: {
    accessToken: string;
    pageId: string;
    report: MarketingInsightReport;
  }): Promise<{ message: string }> {
    const pageId = this.normalizePageId(args.pageId);

    try {
      await this.client.requestJson<{ results?: unknown[] }>({
        url: `${this.apiBase}/blocks/${pageId}/children`,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ children: [] }),
        timeoutMs: 20_000,
        retryCount: 1,
      });
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }

    return { message: 'Insight report appended to Notion page' };
  }

  public async createDatabase(args: {
    accessToken: string;
    parentPageId: string;
    databaseTitle: string;
    properties?: Record<string, unknown>;
    defaultFields?: string[];
  }): Promise<{ id: string; title: string }> {
    const parentPageId = this.normalizePageId(args.parentPageId);

    // Generate properties from defaultFields if provided
    let properties = args.properties;
    if (!properties && args.defaultFields && args.defaultFields.length > 0) {
      properties = {
        Title: {
          title: {},
        },
      };

      const uniqueFields = Array.from(
        new Set(args.defaultFields.map((item) => item.trim()).filter((item) => item.length > 0))
      );
      const usedPropertyNames = new Set<string>(['Title']);

      for (const fieldKey of uniqueFields) {
        if (fieldKey === 'id' || fieldKey === 'Title' || fieldKey === 'title') {
          // Skip id and title as they're handled separately
          continue;
        }

        const propertyName = this.toHumanReadableFieldName(fieldKey);
        if (usedPropertyNames.has(propertyName)) {
          continue;
        }

        usedPropertyNames.add(propertyName);

        const propertyDef = this.resolveFieldPropertyDefinition(fieldKey);
        properties[propertyName] = propertyDef;
      }
    }

    try {
      const response = await this.client.requestJson<{
        id?: string;
        title?: NotionTextFragment[];
      }>({
        url: `${this.apiBase}/databases`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: {
            type: 'page_id',
            page_id: parentPageId,
          },
          title: [
            {
              type: 'text',
              text: {
                content: args.databaseTitle,
              },
            },
          ],
          properties: properties ?? {
            Title: {
              title: {},
            },
          },
        }),
        timeoutMs: 20_000,
        retryCount: 1,
      });

      if (!response.id) {
        throw new ExternalApiError('Failed to create Notion database', 500);
      }

      return {
        id: this.normalizePageId(response.id),
        title: args.databaseTitle,
      };
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }
  }

  public async createPage(args: {
    accessToken: string;
    parentWorkspaceId: string;
    pageTitle: string;
  }): Promise<{ id: string; title: string }> {
    try {
      const response = await this.client.requestJson<{
        id?: string;
        title?: NotionTextFragment[];
      }>({
        url: `${this.apiBase}/pages`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: {
            type: 'workspace',
            workspace: true,
          },
          properties: {
            title: [
              {
                type: 'text',
                text: {
                  content: args.pageTitle,
                },
              },
            ],
          },
        }),
        timeoutMs: 20_000,
        retryCount: 1,
      });

      if (!response.id) {
        throw new ExternalApiError('Failed to create Notion page', 500);
      }

      return {
        id: this.normalizePageId(response.id),
        title: args.pageTitle,
      };
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }
  }

  public async saveDatabasePage(args: {
    accessToken: string;
    databaseId: string;
    report: MarketingInsightReport;
  }): Promise<{ id: string; url: string }> {
    const databaseId = this.normalizePageId(args.databaseId);

    try {
      const database = await this.client.requestJson<{
        properties?: Record<string, NotionDatabaseProperty>;
      }>({
        url: `${this.apiBase}/databases/${databaseId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Notion-Version': this.notionVersion,
        },
        timeoutMs: 20_000,
        retryCount: 1,
      });

      const rows = this.buildInsightRows(args.report);
      const resolvedProperties = await this.ensureDatabaseProperties({
        accessToken: args.accessToken,
        databaseId,
        existingProperties: database.properties ?? {},
        rows,
      });
      const propertyIndex = this.buildDatabasePropertyIndex(resolvedProperties);

      let latestCreated: { id: string; url: string } | null = null;

      for (const row of rows) {
        const properties = this.buildNotionPageProperties({
          row,
          propertyIndex,
        });

        const response = await this.client.requestJson<{
          id?: string;
          url?: string;
        }>({
          url: `${this.apiBase}/pages`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
            'Notion-Version': this.notionVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: {
              type: 'database_id',
              database_id: databaseId,
            },
            properties,
          }),
          timeoutMs: 20_000,
          retryCount: 1,
        });

        if (!response.id) {
          throw new ExternalApiError('Failed to create database page in Notion', 500);
        }

        latestCreated = {
          id: response.id,
          url: response.url ?? '',
        };
      }

      if (!latestCreated) {
        throw new ExternalApiError('No insight rows were generated for Notion export', 400);
      }

      return latestCreated;
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }
  }

  public async saveMediaDatabasePage(args: {
    accessToken: string;
    databaseId: string;
    report: NonNullable<SaveInsightPayload['mediaReport']>;
  }): Promise<{ id: string; url: string }> {
    const databaseId = this.normalizePageId(args.databaseId);

    try {
      const database = await this.client.requestJson<{
        properties?: Record<string, NotionDatabaseProperty>;
      }>({
        url: `${this.apiBase}/databases/${databaseId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Notion-Version': this.notionVersion,
        },
        timeoutMs: 20_000,
        retryCount: 1,
      });

      const rows = this.buildMediaRows(args.report);
      const resolvedProperties = await this.ensureDatabaseProperties({
        accessToken: args.accessToken,
        databaseId,
        existingProperties: database.properties ?? {},
        rows,
      });
      const propertyIndex = this.buildDatabasePropertyIndex(resolvedProperties);

      let latestCreated: { id: string; url: string } | null = null;

      for (const row of rows) {
        const properties = this.buildNotionPageProperties({
          row,
          propertyIndex,
        });

        const response = await this.client.requestJson<{
          id?: string;
          url?: string;
        }>({
          url: `${this.apiBase}/pages`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
            'Notion-Version': this.notionVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: {
              type: 'database_id',
              database_id: databaseId,
            },
            properties,
          }),
          timeoutMs: 20_000,
          retryCount: 1,
        });

        if (!response.id) {
          throw new ExternalApiError('Failed to create database page in Notion', 500);
        }

        latestCreated = {
          id: response.id,
          url: response.url ?? '',
        };
      }

      if (!latestCreated) {
        throw new ExternalApiError('No media rows were generated for Notion export', 400);
      }

      return latestCreated;
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }
  }

  private buildInsightRows(report: MarketingInsightReport): Array<Record<string, unknown>> {
    if (report.accounts.length === 0) {
      return [
        {
          title: `Insight Report ${report.generatedAt}`,
          endTime: report.generatedAt,
          metric: report.query.metrics.join(', '),
          period: report.query.period,
          totalValue: 0,
          generatedAt: report.generatedAt,
        },
      ];
    }

    return report.accounts.map((account, index) => {
      const metricTotals = new Map<string, number>();

      for (const metric of report.query.metrics) {
        metricTotals.set(metric, 0);
      }

      for (const metricResult of account.metricResults) {
        const totalValue = Number.isFinite(metricResult.totalValue) ? metricResult.totalValue : 0;
        metricTotals.set(metricResult.metric, totalValue);
      }

      const totalValue = Array.from(metricTotals.values()).reduce((sum, value) => sum + value, 0);
      const endTime = this.resolveLatestEndTime(account.metricResults, report.generatedAt);
      const row: Record<string, unknown> = {
        title: account.accountHandle ? `@${account.accountHandle}` : `Account ${index + 1}`,
        accountHandle: account.accountHandle,
        endTime,
        metric: Array.from(metricTotals.keys()).join(', '),
        period: account.metricResults[0]?.period ?? report.query.period,
        totalValue,
        generatedAt: report.generatedAt,
      };

      for (const [metric, value] of metricTotals.entries()) {
        row[metric] = value;
      }

      return row;
    });
  }

  private buildMediaRows(
    report: NonNullable<SaveInsightPayload['mediaReport']>
  ): Array<Record<string, unknown>> {
    const hasItems = report.accounts.some((acc) => acc.items && acc.items.length > 0);

    if (report.accounts.length === 0 || !hasItems) {
      return [
        {
          title: `Media Report ${report.generatedAt}`,
          generatedAt: report.generatedAt,
        },
      ];
    }

    // Attempt to map each media item to a clear row
    return report.accounts.flatMap((account) =>
      account.items.map((item, index) => {
        const rowTitle = account.accountHandle
          ? `@${account.accountHandle} Media ${index + 1}`
          : `Media ${index + 1}`;

        return {
          title: rowTitle,
          accountHandle: account.accountHandle,
          generatedAt: report.generatedAt,
          ...item,
        };
      })
    );
  }

  private resolveLatestEndTime(
    metricResults: MarketingInsightReport['accounts'][number]['metricResults'],
    fallbackIso: string
  ): string {
    const latest = metricResults
      .flatMap((result) => result.points)
      .map((point) => this.toIsoDate(point.endTime))
      .filter((value): value is string => value !== null)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return latest ?? fallbackIso;
  }

  private async ensureDatabaseProperties(args: {
    accessToken: string;
    databaseId: string;
    existingProperties: Record<string, NotionDatabaseProperty>;
    rows: Array<Record<string, unknown>>;
  }): Promise<Record<string, NotionDatabaseProperty>> {
    const propertyIndex = this.buildDatabasePropertyIndex(args.existingProperties);
    const propertiesToCreate: Record<string, Record<string, unknown>> = {};
    const usedPropertyNames = new Set(Object.keys(args.existingProperties));

    for (const row of args.rows) {
      for (const fieldKey of Object.keys(row)) {
        const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
        if (!normalizedFieldKey || propertyIndex.has(normalizedFieldKey)) {
          continue;
        }

        const baseName = this.toHumanReadableFieldName(fieldKey) || fieldKey.trim();
        let propertyName = baseName;
        let suffix = 2;

        while (usedPropertyNames.has(propertyName)) {
          propertyName = `${baseName} ${suffix}`;
          suffix += 1;
        }

        const definition = this.resolveFieldPropertyDefinition(fieldKey);
        propertiesToCreate[propertyName] = definition;
        usedPropertyNames.add(propertyName);
        propertyIndex.set(normalizedFieldKey, {
          name: propertyName,
          type: this.extractPropertyType(definition),
        });
      }
    }

    if (Object.keys(propertiesToCreate).length === 0) {
      return args.existingProperties;
    }

    const updated = await this.client.requestJson<{
      properties?: Record<string, NotionDatabaseProperty>;
    }>({
      url: `${this.apiBase}/databases/${args.databaseId}`,
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Notion-Version': this.notionVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: propertiesToCreate,
      }),
      timeoutMs: 20_000,
      retryCount: 1,
    });

    return updated.properties ?? args.existingProperties;
  }

  private resolveFieldPropertyDefinition(fieldKey: string): Record<string, unknown> {
    const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
    const mapped = DEFAULT_NOTION_FIELD_PROPERTY_MAP[normalizedFieldKey];

    if (mapped) {
      return mapped;
    }

    if (INSIGHT_METRIC_KEYS.has(normalizedFieldKey)) {
      return { number: {} };
    }

    return { rich_text: {} };
  }

  private extractPropertyType(definition: Record<string, unknown>): string {
    return Object.keys(definition)[0] ?? 'rich_text';
  }

  private buildDatabasePropertyIndex(
    properties: Record<string, NotionDatabaseProperty>
  ): Map<string, { name: string; type: string }> {
    const index = new Map<string, { name: string; type: string }>();

    for (const [name, property] of Object.entries(properties)) {
      const normalizedKey = this.normalizeFieldKey(name);
      const type = property.type ?? 'rich_text';

      if (normalizedKey.length > 0 && !index.has(normalizedKey)) {
        index.set(normalizedKey, { name, type });
      }

      if (type === 'title') {
        index.set('title', { name, type });
      }
    }

    return index;
  }

  private buildNotionPageProperties(args: {
    row: Record<string, unknown>;
    propertyIndex: Map<string, { name: string; type: string }>;
  }): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    for (const [fieldKey, value] of Object.entries(args.row)) {
      const property = args.propertyIndex.get(this.normalizeFieldKey(fieldKey));
      if (!property) {
        continue;
      }

      const propertyValue = this.toNotionPropertyValue(property.type, value);
      if (propertyValue) {
        properties[property.name] = propertyValue;
      }
    }

    if (!Object.keys(properties).some((name) => args.propertyIndex.get('title')?.name === name)) {
      const titleProperty = args.propertyIndex.get('title');
      if (titleProperty) {
        const fallbackTitle =
          typeof args.row.title === 'string' && args.row.title.trim().length > 0
            ? args.row.title
            : `Insight ${new Date().toISOString()}`;

        const titleValue = this.toNotionPropertyValue('title', fallbackTitle);
        if (titleValue) {
          properties[titleProperty.name] = titleValue;
        }
      }
    }

    return properties;
  }

  private toNotionPropertyValue(type: string, value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (type === 'number') {
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(parsed) ? { number: parsed } : null;
    }

    if (type === 'date') {
      const isoDate = this.toIsoDate(value);
      return isoDate ? { date: { start: isoDate } } : null;
    }

    if (type === 'checkbox') {
      return { checkbox: Boolean(value) };
    }

    if (type === 'url') {
      const urlValue = this.toTextValue(value);
      return urlValue.length > 0 ? { url: urlValue } : null;
    }

    if (type === 'select') {
      const option = this.toTextValue(value);
      return option.length > 0 ? { select: { name: option.slice(0, 100) } } : null;
    }

    const text = this.toTextValue(value);
    if (text.length === 0) {
      return null;
    }

    if (type === 'title') {
      return {
        title: [
          {
            type: 'text',
            text: {
              content: text.slice(0, 1900),
            },
          },
        ],
      };
    }

    return {
      rich_text: [
        {
          type: 'text',
          text: {
            content: text.slice(0, 1900),
          },
        },
      ],
    };
  }

  private toIsoDate(value: unknown): string | null {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  private toTextValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.toTextValue(item))
        .filter((item) => item.length > 0)
        .join(', ');
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }

    return '';
  }

  private normalizeFieldKey(value: string): string {
    return value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  private toHumanReadableFieldName(fieldKey: string): string {
    return fieldKey
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .split(' ')
      .filter((item) => item.length > 0)
      .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
      .join(' ');
  }

  private normalizePageId(raw: string): string {
    return raw.trim().replace(/-/g, '');
  }

  private extractPageTitle(page: NotionPageObject): string {
    const properties = page.properties ?? {};

    for (const property of Object.values(properties)) {
      if (property?.type !== 'title') {
        continue;
      }

      const title = (property.title ?? [])
        .map((item) => item.plain_text ?? '')
        .join('')
        .trim();

      if (title.length > 0) {
        return title;
      }
    }

    return `Page ${this.normalizePageId(page.id ?? '')}`;
  }

  private extractDatabaseTitle(database: NotionDatabaseObject): string {
    const title = (database.title ?? [])
      .map((item) => item.plain_text ?? '')
      .join('')
      .trim();

    if (title.length > 0) {
      return title;
    }

    return `Database ${this.normalizePageId(database.id ?? '')}`;
  }

  public async validateDatabaseProperties(args: {
    accessToken: string;
    databaseId: string;
  }): Promise<{ isValid: boolean; missingProperties: string[] }> {
    const databaseId = this.normalizePageId(args.databaseId);
    const requiredProperties = ['Title'];

    try {
      const response = await this.client.requestJson<{
        properties?: Record<string, unknown>;
      }>({
        url: `${this.apiBase}/databases/${databaseId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Notion-Version': this.notionVersion,
        },
        timeoutMs: 15_000,
        retryCount: 1,
      });

      const existingProperties = Object.keys(response.properties ?? {});
      const missingProperties = requiredProperties.filter(
        (prop: string) => !existingProperties.includes(prop)
      );

      return {
        isValid: missingProperties.length === 0,
        missingProperties,
      };
    } catch (error) {
      if (error instanceof ExternalApiError && (error.status === 401 || error.status === 403)) {
        throw new AuthError('Notion token expired. Please connect Notion again.');
      }

      throw error;
    }
  }
}
