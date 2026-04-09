import type {
  IntegrationRecord,
  SaveInsightPayload,
  SaveInsightResult,
} from "@/lib/core/domain";
import { AppError } from "@/lib/core/errors";
import type { INotionRepository, ISupabaseRepository } from "@/lib/repositories/interfaces";

export class SaveInsightsService {
  constructor(
    private readonly supabaseRepo: ISupabaseRepository,
    private readonly notionRepo: INotionRepository,
    private readonly freeLimit: number,
  ) {}

  public async save(args: {
    sessionId: string;
    integration: IntegrationRecord;
    payload: SaveInsightPayload;
  }): Promise<SaveInsightResult> {
    const usageCount = await this.supabaseRepo.countSnapshots(args.sessionId);

    if (usageCount >= this.freeLimit) {
      throw new AppError(
        "FREE_LIMIT_REACHED",
        `Free tier limit reached (${this.freeLimit} saves). Upgrade to continue saving.`,
        403,
      );
    }

    await this.supabaseRepo.saveSnapshot({
      sessionId: args.sessionId,
      sourceAccount: args.payload.sourceAccount,
      report: args.payload.report,
    });

    let notionMessage: string | undefined;
    let savedToNotion = false;

    if (args.payload.saveToNotion) {
      const pageId = args.payload.notionPageId || args.integration.notionTargetPageId || "";

      if (!args.integration.notionAccessToken) {
        throw new AppError("NOTION_NOT_CONNECTED", "Notion OAuth token is missing.", 401);
      }

      if (!pageId) {
        throw new AppError(
          "NOTION_PAGE_REQUIRED",
          "Please provide a Notion page ID before exporting report.",
          400,
        );
      }

      const notionResult = await this.notionRepo.appendInsightReport({
        accessToken: args.integration.notionAccessToken,
        pageId,
        report: args.payload.report,
      });

      savedToNotion = true;
      notionMessage = notionResult.message;

      await this.supabaseRepo.upsertIntegration(args.sessionId, {
        notionTargetPageId: pageId,
      });
    }

    const afterCount = usageCount + 1;

    return {
      savedToDatabase: true,
      savedToNotion,
      remainingFreeSaves: Math.max(this.freeLimit - afterCount, 0),
      notionMessage,
    };
  }
}
