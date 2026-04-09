import { env } from "@/lib/config/env";
import { ApiClient } from "@/lib/infra/http/api-client";
import { FacebookGraphRepository } from "@/lib/repositories/facebook-graph.repository";
import { NotionRepository } from "@/lib/repositories/notion.repository";
import { SupabaseRepository } from "@/lib/repositories/supabase.repository";
import { FacebookAuthService } from "@/lib/services/auth/facebook-auth.service";
import { NotionAuthService } from "@/lib/services/auth/notion-auth.service";
import { OauthStateService } from "@/lib/services/auth/oauth-state.service";
import { SessionService } from "@/lib/services/auth/session.service";
import { MarketingInsightsService } from "@/lib/services/insights/marketing-insights.service";
import { N8nWorkflowService } from "@/lib/services/n8n/n8n-workflow.service";
import { SaveInsightsService } from "@/lib/services/persistence/save-insights.service";

const apiClient = new ApiClient();
const stateService = new OauthStateService();
const sessionService = new SessionService();

const supabaseRepo = new SupabaseRepository(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const facebookRepo = new FacebookGraphRepository(apiClient);
const notionRepo = new NotionRepository(
  apiClient,
  env.NOTION_VERSION,
  env.NOTION_CLIENT_ID,
  env.NOTION_CLIENT_SECRET,
);

export const services = {
  sessionService,
  notionAuthService: new NotionAuthService(
    notionRepo,
    supabaseRepo,
    stateService,
    sessionService,
  ),
  facebookAuthService: new FacebookAuthService(
    facebookRepo,
    supabaseRepo,
    stateService,
    sessionService,
  ),
  marketingInsightsService: new MarketingInsightsService(facebookRepo, supabaseRepo),
  saveInsightsService: new SaveInsightsService(supabaseRepo, notionRepo, env.APP_FREE_SAVE_LIMIT),
  n8nWorkflowService: new N8nWorkflowService(),
  supabaseRepo,
  facebookRepo,
  notionRepo,
};
