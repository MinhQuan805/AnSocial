import type { SaveInsightPayload, SaveInsightResult } from '@/lib/core/domain';
import { AppError } from '@/lib/core/errors';
import type { INotionRepository, ISupabaseRepository } from '@/lib/repositories/interfaces';

export class SaveInsightsService {
  constructor(
    private readonly supabaseRepo: ISupabaseRepository,
    private readonly notionRepo: INotionRepository,
    private readonly freeLimit: number
  ) {}

  public async save(args: {
    userId: string;
    payload: SaveInsightPayload;
  }): Promise<SaveInsightResult> {
    if (!args.payload.report && !args.payload.mediaReport) {
      throw new AppError(
        'REPORT_REQUIRED',
        'No report payload was provided. Run analysis again before saving.',
        400
      );
    }

    const usageCount = await this.supabaseRepo.countSnapshots(args.userId);

    // TODO: Re-enable free limit check
    // if (usageCount >= this.freeLimit) {
    //   throw new AppError(
    //     "FREE_LIMIT_REACHED",
    //     `Free tier limit reached (${this.freeLimit} saves). Upgrade to continue saving.`,
    //     403,
    //   );
    // }

    // Save snapshot only for insight reports
    if (args.payload.report) {
      await this.supabaseRepo.saveSnapshot({
        userId: args.userId,
        sourceAccount: args.payload.sourceAccount,
        report: args.payload.report,
      });
    }

    let notionMessage: string | undefined;
    let savedToNotion = false;

    if (args.payload.saveToNotion) {
      // Fetch Notion integration for this session
      const notionIntegration = await this.supabaseRepo.getNotionIntegration(args.userId);

      const selectedPageIds =
        args.payload.notionPageIds?.filter((item) => item.trim().length > 0) ?? [];
      const fallbackIds = notionIntegration?.targetPageIds ?? [];
      const resolvedPageIds =
        selectedPageIds.length > 0 ? selectedPageIds : fallbackIds.length > 0 ? fallbackIds : [];

      if (!notionIntegration?.accessToken) {
        throw new AppError('NOTION_NOT_CONNECTED', 'Notion OAuth token is missing.', 401);
      }

      if (resolvedPageIds.length === 0) {
        throw new AppError(
          'NOTION_PAGE_REQUIRED',
          'Please provide a Notion page ID before exporting report.',
          400
        );
      }

      const notionResults = await Promise.all(
        resolvedPageIds.map(async (pageId) => {
          // Check if a database ID is specified for this page
          const databaseId = args.payload.notionDatabaseByPageId?.[pageId];

          if (databaseId && databaseId.trim()) {
            // TODO: Re-enable property validation when using fixed schema
            // const validation = await this.notionRepo.validateDatabaseProperties({
            //   accessToken: notionIntegration.accessToken as string,
            //   databaseId,
            // });

            // if (!validation.isValid) {
            //   throw new AppError(
            //     "INVALID_DATABASE_FORMAT",
            //     `Table is missing required properties: ${validation.missingProperties.join(", ")}. Required properties: Title`,
            //     400,
            //   );
            // }

            // Save to Notion database
            if (args.payload.report) {
              const result = await this.notionRepo.saveDatabasePage({
                accessToken: notionIntegration.accessToken as string,
                databaseId,
                report: args.payload.report,
              });
              return {
                message: `Insight saved to Notion database`,
                wroteToNotion: true,
                pageId,
                databaseId,
                resultId: result.id,
              };
            } else if (args.payload.mediaReport) {
              const result = await this.notionRepo.saveMediaDatabasePage({
                accessToken: notionIntegration.accessToken as string,
                databaseId,
                report: args.payload.mediaReport,
              });
              return {
                message: `Media data saved to Notion database`,
                wroteToNotion: true,
                pageId,
                databaseId,
                resultId: result.id,
              };
            }

            return {
              message: `No export data found for selected request`,
              wroteToNotion: false,
              pageId,
              databaseId,
            };
          } else {
            if (args.payload.report) {
              // Fallback to appending blocks to page
              const result = await this.notionRepo.appendInsightReport({
                accessToken: notionIntegration.accessToken as string,
                pageId,
                report: args.payload.report,
              });
              return {
                message: result.message,
                wroteToNotion: true,
                pageId,
              };
            }

            if (args.payload.mediaReport) {
              return {
                message:
                  'Media/profile/tag exports require selecting a Notion database table for each page.',
                wroteToNotion: false,
                pageId,
              };
            }

            return {
              message: `No export data found for selected request`,
              wroteToNotion: false,
              pageId,
            };
          }
        })
      );

      const writtenToNotionCount = notionResults.filter((item) => item.wroteToNotion).length;
      savedToNotion = writtenToNotionCount > 0;
      notionMessage = notionResults.map((item) => item.message).join(' | ');

      if (!savedToNotion) {
        throw new AppError(
          'NOTION_SAVE_NOOP',
          notionMessage ||
            'No data was written to Notion. Please select a valid Notion table and try again.',
          400
        );
      }

      // Update the target page IDs
      await this.supabaseRepo.upsertNotionIntegration(args.userId, {
        targetPageIds: resolvedPageIds,
      });
    }

    const afterCount = usageCount + 1;

    return {
      savedToDatabase: true,
      savedToNotion,
      // TODO: Re-enable remaining free saves calculation
      remainingFreeSaves: 3, // Math.max(this.freeLimit - afterCount, 0),
      notionMessage,
    };
  }
}
