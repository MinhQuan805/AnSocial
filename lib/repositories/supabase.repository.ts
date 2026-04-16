import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  IntegrationRecord,
  MarketingInsightReport,
  NotionIntegration,
  FacebookIntegration,
  AutoScheduleConfig,
} from "@/lib/core/domain";
import { AppError } from "@/lib/core/errors";
import type { ISupabaseRepository } from "@/lib/repositories/interfaces";
import { TokenCryptoService } from "@/lib/services/security/token-crypto.service";

interface ProviderConnectionRow {
  id: string;
  user_id: string;
  provider_type: string;
  provider_user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
  connected_at: string;
  created_at: string;
  updated_at: string;
}

interface AutoScheduleConfigRow {
  id: string;
  user_id: string;
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

type ProviderMetadata = Record<string, unknown>;

export class SupabaseRepository implements ISupabaseRepository {
  private readonly client: SupabaseClient;
  private readonly tokenCrypto: TokenCryptoService;

  constructor(url: string, serviceRoleKey: string, tokenCrypto: TokenCryptoService) {
    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    this.tokenCrypto = tokenCrypto;
  }

  public async getNotionIntegration(userId: string): Promise<NotionIntegration | null> {
    const row = await this.getProviderConnectionRow(userId, "notion");
    return row ? this.mapNotionIntegrationRow(row) : null;
  }

  public async upsertNotionIntegration(
    userId: string,
    patch: Partial<NotionIntegration>,
  ): Promise<NotionIntegration> {
    const existing = await this.getProviderConnectionRow(userId, "notion");
    const existingMetadata = this.readMetadata(existing?.metadata);

    const metadata: ProviderMetadata = {
      ...existingMetadata,
      ...(patch.workspaceId !== undefined ? { workspaceId: patch.workspaceId } : {}),
      ...(patch.workspaceName !== undefined ? { workspaceName: patch.workspaceName } : {}),
      ...(patch.targetPageIds !== undefined ? { targetPageIds: patch.targetPageIds } : {}),
    };

    const providerUserId =
      patch.workspaceId ?? this.asString(metadata.workspaceId) ?? existing?.provider_user_id;

    let accessToken: string | null | undefined = existing?.access_token;
    if (patch.accessToken !== undefined) {
      if (!patch.accessToken) {
        throw new AppError(
          "NOTION_ACCESS_TOKEN_REQUIRED",
          "Notion access token is required to connect Notion.",
          400,
        );
      }

      accessToken = this.tokenCrypto.encryptIfNeeded(patch.accessToken);
    }

    if (!providerUserId || !accessToken) {
      throw new AppError(
        "NOTION_NOT_CONNECTED",
        "Notion connection not found. Connect Notion first.",
        401,
      );
    }

    const row = await this.upsertProviderConnectionRow({
      userId,
      providerType: "notion",
      providerUserId,
      accessToken,
      refreshToken: existing?.refresh_token ?? null,
      expiresAt: existing?.expires_at ?? null,
      metadata,
    });

    return this.mapNotionIntegrationRow(row);
  }

  public async getFacebookIntegration(userId: string): Promise<FacebookIntegration | null> {
    const row = await this.getProviderConnectionRow(userId, "facebook");
    return row ? this.mapFacebookIntegrationRow(row) : null;
  }

  public async upsertFacebookIntegration(
    userId: string,
    patch: Partial<FacebookIntegration>,
  ): Promise<FacebookIntegration> {
    const existing = await this.getProviderConnectionRow(userId, "facebook");
    const existingMetadata = this.readMetadata(existing?.metadata);

    const providerUserId = patch.providerUserId ?? existing?.provider_user_id;

    let accessToken: string | null | undefined = existing?.access_token;
    if (patch.accessToken !== undefined) {
      if (!patch.accessToken) {
        throw new AppError(
          "FACEBOOK_ACCESS_TOKEN_REQUIRED",
          "Facebook access token is required to connect Instagram/Facebook.",
          400,
        );
      }

      accessToken = this.tokenCrypto.encryptIfNeeded(patch.accessToken);
    }

    if (!providerUserId || !accessToken) {
      throw new AppError(
        "FACEBOOK_NOT_CONNECTED",
        "Instagram/Facebook connection not found. Connect Instagram first.",
        401,
      );
    }

    const row = await this.upsertProviderConnectionRow({
      userId,
      providerType: "facebook",
      providerUserId,
      accessToken,
      refreshToken: existing?.refresh_token ?? null,
      expiresAt:
        patch.tokenExpiresAt !== undefined
          ? patch.tokenExpiresAt
          : existing?.expires_at ?? null,
      metadata: existingMetadata,
    });

    return this.mapFacebookIntegrationRow(row);
  }

  public async getAutoScheduleConfig(userId: string): Promise<AutoScheduleConfig | null> {
    const { data, error } = await this.client
      .from("auto_schedule_configs")
      .select("id, user_id, enabled, frequency, time, timezone, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle<AutoScheduleConfigRow>();

    if (error) {
      throw new AppError("SUPABASE_READ_ERROR", error.message, 500);
    }

    return data ? this.mapAutoScheduleConfigRow(data) : null;
  }

  public async upsertAutoScheduleConfig(
    userId: string,
    patch: Partial<AutoScheduleConfig>,
  ): Promise<AutoScheduleConfig> {
    await this.ensureUserRow(userId);

    const payload: Record<string, unknown> = {
      user_id: userId,
    };

    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.frequency !== undefined) payload.frequency = patch.frequency;
    if (patch.time !== undefined) payload.time = patch.time;
    if (patch.timezone !== undefined) payload.timezone = patch.timezone;

    const { data, error } = await this.client
      .from("auto_schedule_configs")
      .upsert(payload, { onConflict: "user_id" })
      .select("id, user_id, enabled, frequency, time, timezone, created_at, updated_at")
      .single<AutoScheduleConfigRow>();

    if (error) {
      throw new AppError("SUPABASE_UPSERT_ERROR", error.message, 500);
    }

    return this.mapAutoScheduleConfigRow(data);
  }

  public async countSnapshots(userId: string): Promise<number> {
    const { count, error } = await this.client
      .from("insight_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      throw new AppError("SUPABASE_COUNT_ERROR", error.message, 500);
    }

    return count ?? 0;
  }

  public async saveSnapshot(args: {
    userId: string;
    sourceAccount: string;
    report: MarketingInsightReport;
  }): Promise<void> {
    await this.ensureUserRow(args.userId);

    const { providerType, providerUserId } = this.parseSourceAccount(args.sourceAccount);

    const { error } = await this.client.from("insight_snapshots").insert({
      user_id: args.userId,
      provider_type: providerType,
      provider_user_id: providerUserId,
      report_json: args.report,
    });

    if (error) {
      throw new AppError("SUPABASE_INSERT_ERROR", error.message, 500);
    }
  }

  public async getIntegration(userId: string): Promise<IntegrationRecord | null> {
    const [notion, facebook, schedule] = await Promise.all([
      this.getNotionIntegration(userId),
      this.getFacebookIntegration(userId),
      this.getAutoScheduleConfig(userId),
    ]);

    if (!notion && !facebook && !schedule) {
      return null;
    }

    return {
      userId,
      notionWorkspaceId: notion?.workspaceId,
      notionWorkspaceName: notion?.workspaceName,
      notionAccessToken: notion?.accessToken,
      notionTargetPageIds: notion?.targetPageIds,
      facebookProviderUserId: facebook?.providerUserId,
      facebookAccessToken: facebook?.accessToken,
      facebookTokenExpiresAt: facebook?.tokenExpiresAt,
      autoScheduleEnabled: schedule?.enabled,
      autoScheduleFrequency: schedule?.frequency,
      autoScheduleTime: schedule?.time,
      autoScheduleTimezone: schedule?.timezone,
    };
  }

  public async upsertIntegration(
    userId: string,
    patch: Partial<IntegrationRecord>,
  ): Promise<IntegrationRecord> {
    const updates = await Promise.all([
      patch.notionWorkspaceId !== undefined ||
      patch.notionWorkspaceName !== undefined ||
      patch.notionAccessToken !== undefined ||
      patch.notionTargetPageIds !== undefined
        ? this.upsertNotionIntegration(userId, {
            workspaceId: patch.notionWorkspaceId,
            workspaceName: patch.notionWorkspaceName,
            accessToken: patch.notionAccessToken,
            targetPageIds: patch.notionTargetPageIds,
          })
        : Promise.resolve(null),

      patch.facebookProviderUserId !== undefined ||
      patch.facebookAccessToken !== undefined ||
      patch.facebookTokenExpiresAt !== undefined
        ? this.upsertFacebookIntegration(userId, {
            providerUserId: patch.facebookProviderUserId,
            accessToken: patch.facebookAccessToken,
            tokenExpiresAt: patch.facebookTokenExpiresAt,
          })
        : Promise.resolve(null),

      patch.autoScheduleEnabled !== undefined ||
      patch.autoScheduleFrequency !== undefined ||
      patch.autoScheduleTime !== undefined ||
      patch.autoScheduleTimezone !== undefined
        ? this.upsertAutoScheduleConfig(userId, {
            ...(patch.autoScheduleEnabled !== undefined &&
              patch.autoScheduleEnabled !== null && { enabled: patch.autoScheduleEnabled }),
            ...(patch.autoScheduleFrequency !== undefined &&
              patch.autoScheduleFrequency !== null && {
                frequency: patch.autoScheduleFrequency,
              }),
            ...(patch.autoScheduleTime !== undefined &&
              patch.autoScheduleTime !== null && { time: patch.autoScheduleTime }),
            ...(patch.autoScheduleTimezone !== undefined &&
              patch.autoScheduleTimezone !== null && { timezone: patch.autoScheduleTimezone }),
          })
        : Promise.resolve(null),
    ]);

    const [notion, facebook, schedule] = updates;

    return {
      userId,
      notionWorkspaceId: notion?.workspaceId,
      notionWorkspaceName: notion?.workspaceName,
      notionAccessToken: notion?.accessToken,
      notionTargetPageIds: notion?.targetPageIds,
      facebookProviderUserId: facebook?.providerUserId,
      facebookAccessToken: facebook?.accessToken,
      facebookTokenExpiresAt: facebook?.tokenExpiresAt,
      autoScheduleEnabled: schedule?.enabled,
      autoScheduleFrequency: schedule?.frequency,
      autoScheduleTime: schedule?.time,
      autoScheduleTimezone: schedule?.timezone,
    };
  }

  private async getProviderConnectionRow(
    userId: string,
    providerType: string,
  ): Promise<ProviderConnectionRow | null> {
    const { data, error } = await this.client
      .from("provider_connections")
      .select(
        "id, user_id, provider_type, provider_user_id, access_token, refresh_token, expires_at, metadata, connected_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("provider_type", providerType)
      .maybeSingle<ProviderConnectionRow>();

    if (error) {
      throw new AppError("SUPABASE_READ_ERROR", error.message, 500);
    }

    return data;
  }

  private async upsertProviderConnectionRow(args: {
    userId: string;
    providerType: string;
    providerUserId: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: string | null;
    metadata?: ProviderMetadata;
  }): Promise<ProviderConnectionRow> {
    await this.ensureUserRow(args.userId);

    const { data, error } = await this.client
      .from("provider_connections")
      .upsert(
        {
          user_id: args.userId,
          provider_type: args.providerType,
          provider_user_id: args.providerUserId,
          access_token: args.accessToken,
          refresh_token: args.refreshToken ?? null,
          expires_at: args.expiresAt ?? null,
          metadata: args.metadata ?? {},
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider_type" },
      )
      .select(
        "id, user_id, provider_type, provider_user_id, access_token, refresh_token, expires_at, metadata, connected_at, created_at, updated_at",
      )
      .single<ProviderConnectionRow>();

    if (error) {
      throw new AppError("SUPABASE_UPSERT_ERROR", error.message, 500);
    }

    return data;
  }

  private async ensureUserRow(userId: string): Promise<void> {
    const sessionGoogleId = `session:${userId}`;

    const { error } = await this.client.from("users").upsert(
      {
        id: userId,
        google_id: sessionGoogleId,
        google_email: `${sessionGoogleId}@local.ana-social`,
        google_name: "Session User",
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new AppError("SUPABASE_UPSERT_ERROR", `Failed to ensure user row: ${error.message}`, 500);
    }
  }

  private mapNotionIntegrationRow(row: ProviderConnectionRow): NotionIntegration {
    const metadata = this.readMetadata(row.metadata);

    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: this.asString(metadata.workspaceId),
      workspaceName: this.asString(metadata.workspaceName),
      accessToken: this.tokenCrypto.decryptIfNeeded(row.access_token),
      targetPageIds: this.asStringArray(metadata.targetPageIds),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapFacebookIntegrationRow(row: ProviderConnectionRow): FacebookIntegration {
    return {
      id: row.id,
      userId: row.user_id,
      providerUserId: row.provider_user_id,
      accessToken: this.tokenCrypto.decryptIfNeeded(row.access_token),
      tokenExpiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAutoScheduleConfigRow(row: AutoScheduleConfigRow): AutoScheduleConfig {
    return {
      id: row.id,
      userId: row.user_id,
      enabled: row.enabled,
      frequency: row.frequency,
      time: row.time,
      timezone: row.timezone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseSourceAccount(sourceAccount: string): {
    providerType: string;
    providerUserId: string;
  } {
    const trimmed = sourceAccount.trim();
    if (!trimmed) {
      return {
        providerType: "instagram",
        providerUserId: "unknown",
      };
    }

    const [rawProviderType, ...rest] = trimmed.split(":");
    if (rest.length === 0) {
      return {
        providerType: "instagram",
        providerUserId: trimmed,
      };
    }

    const providerType = rawProviderType.trim() || "instagram";
    const providerUserId = rest.join(":").trim() || "unknown";

    return { providerType, providerUserId };
  }

  private readMetadata(value: unknown): ProviderMetadata {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as ProviderMetadata;
    }

    return {};
  }

  private asString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  private asStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const items = value.filter((item): item is string => typeof item === "string");
    return items.length > 0 ? items : [];
  }
}