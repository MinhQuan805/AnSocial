import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { IntegrationRecord, MarketingInsightReport } from "@/lib/core/domain";
import { AppError } from "@/lib/core/errors";
import type { ISupabaseRepository } from "@/lib/repositories/interfaces";

interface IntegrationRow {
  session_id: string;
  notion_workspace_id: string | null;
  notion_workspace_name: string | null;
  notion_access_token: string | null;
  notion_target_page_id: string | null;
  facebook_user_id: string | null;
  facebook_access_token: string | null;
  facebook_token_expires_at: string | null;
}

export class SupabaseRepository implements ISupabaseRepository {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  public async getIntegration(sessionId: string): Promise<IntegrationRecord | null> {
    const { data, error } = await this.client
      .from("user_integrations")
      .select(
        "session_id, notion_workspace_id, notion_workspace_name, notion_access_token, notion_target_page_id, facebook_user_id, facebook_access_token, facebook_token_expires_at",
      )
      .eq("session_id", sessionId)
      .maybeSingle<IntegrationRow>();

    if (error) {
      throw new AppError("SUPABASE_READ_ERROR", error.message, 500);
    }

    if (!data) {
      return null;
    }

    return this.toDomain(data);
  }

  public async upsertIntegration(
    sessionId: string,
    patch: Partial<IntegrationRecord>,
  ): Promise<IntegrationRecord> {
    const payload: Partial<IntegrationRow> & { session_id: string } = {
      session_id: sessionId,
    };

    if (patch.notionWorkspaceId !== undefined) payload.notion_workspace_id = patch.notionWorkspaceId;
    if (patch.notionWorkspaceName !== undefined) payload.notion_workspace_name = patch.notionWorkspaceName;
    if (patch.notionAccessToken !== undefined) payload.notion_access_token = patch.notionAccessToken;
    if (patch.notionTargetPageId !== undefined) payload.notion_target_page_id = patch.notionTargetPageId;
    if (patch.facebookUserId !== undefined) payload.facebook_user_id = patch.facebookUserId;
    if (patch.facebookAccessToken !== undefined) payload.facebook_access_token = patch.facebookAccessToken;
    if (patch.facebookTokenExpiresAt !== undefined) payload.facebook_token_expires_at = patch.facebookTokenExpiresAt;

    const { data, error } = await this.client
      .from("user_integrations")
      .upsert(payload, { onConflict: "session_id" })
      .select(
        "session_id, notion_workspace_id, notion_workspace_name, notion_access_token, notion_target_page_id, facebook_user_id, facebook_access_token, facebook_token_expires_at",
      )
      .single<IntegrationRow>();

    if (error) {
      throw new AppError("SUPABASE_UPSERT_ERROR", error.message, 500);
    }

    return this.toDomain(data);
  }

  public async countSnapshots(sessionId: string): Promise<number> {
    const { count, error } = await this.client
      .from("insight_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (error) {
      throw new AppError("SUPABASE_COUNT_ERROR", error.message, 500);
    }

    return count ?? 0;
  }

  public async saveSnapshot(args: {
    sessionId: string;
    sourceAccount: string;
    report: MarketingInsightReport;
  }): Promise<void> {
    const { error } = await this.client.from("insight_snapshots").insert({
      session_id: args.sessionId,
      source_account: args.sourceAccount,
      report_json: args.report,
    });

    if (error) {
      throw new AppError("SUPABASE_INSERT_ERROR", error.message, 500);
    }
  }

  private toDomain(row: IntegrationRow): IntegrationRecord {
    return {
      sessionId: row.session_id,
      notionWorkspaceId: row.notion_workspace_id,
      notionWorkspaceName: row.notion_workspace_name,
      notionAccessToken: row.notion_access_token,
      notionTargetPageId: row.notion_target_page_id,
      facebookUserId: row.facebook_user_id,
      facebookAccessToken: row.facebook_access_token,
      facebookTokenExpiresAt: row.facebook_token_expires_at,
    };
  }
}
