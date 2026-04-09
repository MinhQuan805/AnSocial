import { ExternalApiError } from "@/lib/core/errors";
import { ApiClient } from "@/lib/infra/http/api-client";
import type { INotionRepository } from "@/lib/repositories/interfaces";

export class NotionRepository implements INotionRepository {
  private readonly oauthUrl = "https://api.notion.com/v1/oauth/token";
  private readonly apiBase = "https://api.notion.com/v1";

  constructor(
    private readonly client: ApiClient,
    private readonly notionVersion: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  public async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; workspaceId: string; workspaceName: string }> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const payload = await this.client.requestJson<{
      access_token?: string;
      workspace_id?: string;
      workspace_name?: string;
    }>({
      url: this.oauthUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      timeoutMs: 15_000,
      retryCount: 1,
    });

    if (!payload.access_token || !payload.workspace_id) {
      throw new ExternalApiError("Invalid Notion OAuth response", 502);
    }

    return {
      accessToken: payload.access_token,
      workspaceId: payload.workspace_id,
      workspaceName: payload.workspace_name ?? "Notion Workspace",
    };
  }

  public async appendInsightReport(args: {
    accessToken: string;
    pageId: string;
    report: import("@/lib/core/domain").MarketingInsightReport;
  }): Promise<{ message: string }> {
    const pageId = this.normalizePageId(args.pageId);

    const blocks = this.buildBlocks(args.report);

    await this.client.requestJson<{ results?: unknown[] }>({
      url: `${this.apiBase}/blocks/${pageId}/children`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Notion-Version": this.notionVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ children: blocks }),
      timeoutMs: 20_000,
      retryCount: 1,
    });

    return { message: "Insight report appended to Notion page" };
  }

  private normalizePageId(raw: string): string {
    return raw.trim().replace(/-/g, "");
  }

  private buildBlocks(report: import("@/lib/core/domain").MarketingInsightReport): unknown[] {
    const topAccount = report.accounts[0];

    return [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `Marketing Insight Snapshot • ${new Date(report.generatedAt).toLocaleString()}`,
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `Query: ${report.query.metrics.join(", ")} | ${report.query.period} | ${report.query.rangeDays} days`,
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: topAccount
                  ? `Top account: @${topAccount.accountHandle} | Engagement rate: ${(topAccount.engagementRate * 100).toFixed(2)}%`
                  : "No account insights returned.",
              },
            },
          ],
        },
      },
      ...report.accounts
        .flatMap((account) => account.recommendations)
        .slice(0, 5)
        .map((item) => ({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `${item.title}: ${item.summary}`,
                },
              },
            ],
          },
        })),
    ];
  }
}
