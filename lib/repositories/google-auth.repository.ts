import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IProviderConnectionRepository,
  ProviderConnection,
  ProviderConnectionPayload,
} from "@/lib/core/auth.types";
import { AppError } from "@/lib/core/errors";
import type { TokenCryptoService } from "@/lib/services/security/token-crypto.service";

/**
 * Supabase implementation of Provider Connection Repository
 */
export class SupabaseProviderConnectionRepository
  implements IProviderConnectionRepository
{
  constructor(
    private readonly client: SupabaseClient,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  public async get(
    userId: string,
    providerType: string,
  ): Promise<ProviderConnection | null> {
    const { data, error } = await this.client
      .from("provider_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider_type", providerType)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError("SUPABASE_READ_ERROR", error.message, 500);
    }

    return data ? this.mapToConnection(data) : null;
  }

  public async list(userId: string): Promise<ProviderConnection[]> {
    const { data, error } = await this.client
      .from("provider_connections")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new AppError("SUPABASE_READ_ERROR", error.message, 500);
    }

    return data.map((d) => this.mapToConnection(d));
  }

  public async upsert(
    userId: string,
    payload: ProviderConnectionPayload,
  ): Promise<ProviderConnection> {
    const encryptedAccessToken = this.tokenCrypto.encryptIfNeeded(payload.accessToken);
    if (!encryptedAccessToken) {
      throw new AppError("TOKEN_ENCRYPT_FAILED", "Failed to encrypt access token", 500);
    }

    const encryptedRefreshToken = payload.refreshToken
      ? this.tokenCrypto.encryptIfNeeded(payload.refreshToken)
      : null;

    const { data, error } = await this.client
      .from("provider_connections")
      .upsert(
        {
          user_id: userId,
          provider_type: payload.providerType,
          provider_user_id: payload.providerUserId,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: payload.expiresAt?.toISOString(),
          metadata: payload.metadata || {},
        },
        { onConflict: "user_id,provider_type" },
      )
      .select()
      .single();

    if (error) {
      throw new AppError("SUPABASE_UPSERT_ERROR", error.message, 500);
    }

    return this.mapToConnection(data);
  }

  public async delete(userId: string, providerType: string): Promise<void> {
    const { error } = await this.client
      .from("provider_connections")
      .delete()
      .eq("user_id", userId)
      .eq("provider_type", providerType);

    if (error) {
      throw new AppError("SUPABASE_DELETE_ERROR", error.message, 500);
    }
  }

  private mapToConnection(data: any): ProviderConnection {
    const decryptedAccessToken = this.tokenCrypto.decryptIfNeeded(data.access_token);
    if (!decryptedAccessToken) {
      throw new AppError("TOKEN_DECRYPT_FAILED", "Failed to decrypt access token", 500);
    }

    const decryptedRefreshToken = this.tokenCrypto.decryptIfNeeded(data.refresh_token);

    return {
      id: data.id,
      userId: data.user_id,
      providerType: data.provider_type,
      providerUserId: data.provider_user_id,
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken ?? undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      connectedAt: new Date(data.connected_at),
    };
  }
}
