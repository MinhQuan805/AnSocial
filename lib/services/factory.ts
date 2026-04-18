/**
 * Service Factory - Initialization of all services
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/config/env';
import { TokenCryptoService } from '@/lib/services/security/token-crypto.service';
import { OauthStateService } from '@/lib/services/auth/oauth-state.service';
import { SessionService } from '@/lib/services/auth/session.service';
import { AuthMiddleware } from '@/lib/services/auth-middleware';
import { ProviderRegistryImpl } from '@/lib/services/provider-registry';
import { TikTokProvider } from '@/lib/services/providers/tiktok-provider';

import { FacebookGraphRepository } from '@/lib/repositories/facebook-graph.repository';
import { NotionRepository } from '@/lib/repositories/notion.repository';
import { SupabaseRepository } from '@/lib/repositories/supabase.repository';
import { SupabaseProviderConnectionRepository } from '@/lib/repositories/google-auth.repository';
import { ApiClient } from '@/lib/infra/http/api-client';
import { MarketingInsightsService } from '@/lib/services/insights/marketing-insights.service';
import { SaveInsightsService } from '@/lib/services/persistence/save-insights.service';
import { N8nWorkflowService } from '@/lib/services/n8n/n8n-workflow.service';

/**
 * Lazy-loaded singleton instance
 */
let servicesInstance: Services | null = null;

export interface Services {
  // Auth Services
  sessionService: SessionService;
  authMiddleware: AuthMiddleware;
  providerRegistry: ProviderRegistryImpl;

  // Repositories
  providerConnectionRepository: SupabaseProviderConnectionRepository;
  facebookGraphRepository: FacebookGraphRepository;
  notionRepository: NotionRepository;
  supabaseRepo: SupabaseRepository;

  // Business Logic Services
  marketingInsightsService: MarketingInsightsService;
  saveInsightsService: SaveInsightsService;
  n8nWorkflowService: N8nWorkflowService;
}

/**
 * Initialize and return all services
 * Called once on app startup
 */
export function initializeServices(): Services {
  if (servicesInstance) {
    return servicesInstance;
  }

  // ============================================================================
  // INFRASTRUCTURE SETUP
  // ============================================================================

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Encryption key handling
  let encryptionKey = env.TOKEN_ENCRYPTION_KEY || '';
  if (!encryptionKey && env.NODE_ENV === 'production') {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is required in production. ' +
        'Set it to a strong random string (min 32 characters).'
    );
  }
  if (!encryptionKey) {
    console.warn(
      '[TokenCryptoService] TOKEN_ENCRYPTION_KEY not set - tokens will use empty key. ' +
        'Set TOKEN_ENCRYPTION_KEY in .env for proper encryption.'
    );
    encryptionKey = '';
  }

  const tokenCrypto = new TokenCryptoService(encryptionKey);

  // Create API client for external services
  const apiClient = new ApiClient();

  // Create Supabase repository first (needed by other services)
  const supabaseRepo = new SupabaseRepository(supabaseUrl, supabaseServiceRoleKey, tokenCrypto);

  // ============================================================================
  // AUTHENTICATION SETUP
  // ============================================================================

  // Create repositories
  const providerConnectionRepository = new SupabaseProviderConnectionRepository(
    supabase,
    tokenCrypto
  );

  // Create auth services
  const stateService = new OauthStateService();
  const sessionService = new SessionService();
  const authMiddleware = new AuthMiddleware(sessionService);

  // ============================================================================
  // PROVIDER REPOSITORIES
  // ============================================================================

  // Create and initialize Facebook Graph Repository with ApiClient
  const facebookGraphRepository = new FacebookGraphRepository(apiClient);

  // Create and initialize Notion Repository with all required parameters
  const notionRepository = new NotionRepository(
    apiClient,
    env.NOTION_VERSION,
    env.NOTION_CLIENT_ID,
    env.NOTION_CLIENT_SECRET
  );

  // ============================================================================
  // PROVIDER REGISTRY SETUP
  // ============================================================================

  const providerRegistry = new ProviderRegistryImpl();

  // Create and register TikTok provider (if credentials exist)
  if (env.TIKTOK_CLIENT_ID && env.TIKTOK_CLIENT_SECRET) {
    const tiktokProvider = new TikTokProvider(providerConnectionRepository, stateService);
    providerRegistry.register('tiktok', tiktokProvider);
  }

  // Extensibility: Additional providers can be registered here
  // Example:
  // const instagramProvider = new InstagramProvider(...);
  // providerRegistry.register('instagram', instagramProvider);

  // ============================================================================
  // BUSINESS LOGIC SERVICES
  // ============================================================================

  const marketingInsightsService = new MarketingInsightsService(
    facebookGraphRepository,
    supabaseRepo
  );

  const saveInsightsService = new SaveInsightsService(
    supabaseRepo,
    notionRepository,
    env.APP_FREE_SAVE_LIMIT
  );

  const n8nWorkflowService = new N8nWorkflowService();

  // ============================================================================
  // CREATE SERVICES OBJECT
  // ============================================================================

  servicesInstance = {
    sessionService,
    authMiddleware,
    providerRegistry,

    providerConnectionRepository,
    facebookGraphRepository,
    notionRepository,
    supabaseRepo,

    marketingInsightsService,
    saveInsightsService,
    n8nWorkflowService,
  };

  return servicesInstance;
}

/**
 * Get singleton services instance
 * Auto-initializes on first call if not already initialized
 */
export function getServices(): Services {
  if (!servicesInstance) {
    return initializeServices();
  }
  return servicesInstance;
}
