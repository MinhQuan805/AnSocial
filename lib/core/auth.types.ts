/**
 * Auth Types and Interfaces
 * Core types for Provider Registry system
 */

// ============================================================================
// PROVIDER CONNECTION TYPES
// ============================================================================

export interface ProviderConnection {
  id: string; // UUID
  userId: string;
  providerType: string; // 'facebook', 'notion', 'tiktok', etc.
  providerUserId: string;
  accessToken: string; // Encrypted by TokenCryptoService
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>; // Provider-specific data
  createdAt: Date;
  updatedAt: Date;
  connectedAt: Date;
}

export interface ProviderConnectionPayload {
  providerType: string;
  providerUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// PROVIDER INTERFACE (Factory Pattern)
// ============================================================================

export interface IProvider {
  /** Unique identifier for this provider type */
  readonly type: string;

  /**
   * Initiate connection flow (returns state for CSRF protection)
   */
  issueState(args: {
    response: import('next/server').NextResponse;
    flowMode?: 'redirect' | 'popup';
  }): string;

  /**
   * Build OAuth authorize URL
   */
  buildAuthorizeUrl(state: string): string;

  /**
   * Complete OAuth flow and save connection
   */
  completeAuth(args: {
    request: import('next/server').NextRequest;
    code: string | null;
    state: string | null;
  }): Promise<{ userId: string; flowMode?: string }>;

  /**
   * Get connection status for a user
   */
  getStatus(userId: string): Promise<ConnectionStatus | null>;

  /**
   * Disconnect a provider from user account
   */
  disconnect(userId: string): Promise<void>;

  /**
   * Refresh access token if provider supports it
   */
  refreshToken?(connection: ProviderConnection): Promise<ProviderConnection>;

  /**
   * Clear any temporary state
   */
  clearState(response: import('next/server').NextResponse): void;
}

export interface ConnectionStatus {
  connected: boolean;
  providerUserId?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// OAUTH STATE TYPES
// ============================================================================

export interface OAuthStatePayload {
  provider: string;
  flowMode: 'redirect' | 'popup';
  context?: Record<string, any>; // Additional context per provider
  issuedAt: number;
  expiresAt: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AutoScheduleConfig {
  id: string;
  userId: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REPOSITORY INTERFACES
// ============================================================================

export interface IProviderConnectionRepository {
  get(userId: string, providerType: string): Promise<ProviderConnection | null>;
  list(userId: string): Promise<ProviderConnection[]>;
  upsert(userId: string, payload: ProviderConnectionPayload): Promise<ProviderConnection>;
  delete(userId: string, providerType: string): Promise<void>;
}

export interface IAutoScheduleRepository {
  get(userId: string): Promise<AutoScheduleConfig | null>;
  upsert(userId: string, config: Partial<AutoScheduleConfig>): Promise<AutoScheduleConfig>;
  delete(userId: string): Promise<void>;
}

// ============================================================================
// SERVICE REGISTRY TYPES
// ============================================================================

export interface ProviderRegistry {
  register(type: string, provider: IProvider): void;
  getProvider(type: string): IProvider;
  listProviders(): string[];
}
