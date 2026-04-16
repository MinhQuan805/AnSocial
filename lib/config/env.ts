import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("https://carolyne-privileged-michele.ngrok-free.dev"),

  // ============================================================================
  // SUPABASE CONFIG
  // ============================================================================
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ============================================================================
  // SECURITY CONFIG
  // ============================================================================
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),

  // ============================================================================
  // PROVIDER INTEGRATIONS
  // ============================================================================
  // Facebook/Meta
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_BUSINESS_CONFIG_ID: z.string().optional(),
  META_CALLBACK_URL: z.string().url().optional(),

  // Notion
  NOTION_CLIENT_ID: z.string().default(""),
  NOTION_CLIENT_SECRET: z.string().default(""),
  NOTION_REDIRECT_URI: z.string().url().optional(),
  NOTION_VERSION: z.string().default("2022-06-28"),

  // TikTok (Optional - add when ready)
  TIKTOK_CLIENT_ID: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),

  // Instagram (Optional - can use Facebook provider)
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // ============================================================================
  // APP CONFIG
  // ============================================================================
  APP_FREE_SAVE_LIMIT: z.coerce.number().int().positive().default(3),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  APP_BASE_URL: process.env.APP_BASE_URL,

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Security
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,

  // Facebook
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_BUSINESS_CONFIG_ID: process.env.META_BUSINESS_CONFIG_ID,
  META_CALLBACK_URL: process.env.META_CALLBACK_URL,

  // Notion
  NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
  NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET,
  NOTION_REDIRECT_URI: process.env.NOTION_REDIRECT_URI,
  NOTION_VERSION: process.env.NOTION_VERSION,

  // TikTok (optional)
  TIKTOK_CLIENT_ID: process.env.TIKTOK_CLIENT_ID,
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI: process.env.TIKTOK_REDIRECT_URI,

  // Instagram (optional)
  INSTAGRAM_BUSINESS_ACCOUNT_ID: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,

  // App config
  APP_FREE_SAVE_LIMIT: process.env.APP_FREE_SAVE_LIMIT,
});

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${formatted}`);
}

export const env = parsed.data;

// ============================================================================
// DERIVED CONFIGURATION
// ============================================================================

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Token encryption key (prefer explicit key, fallback to service role key)
export const TOKEN_ENCRYPTION_KEY = env.TOKEN_ENCRYPTION_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

// Base URL helper - define before use
export const getBaseUrl = () => {
  return env.APP_BASE_URL.replace(/\/$/, "");
};

// OAuth Redirect URIs
export const redirectUri = {
  facebook: env.META_CALLBACK_URL ?? `${getBaseUrl()}/api/providers/facebook/callback`,
  notion: env.NOTION_REDIRECT_URI ?? `${getBaseUrl()}/api/providers/notion/callback`,
  tiktok: env.TIKTOK_REDIRECT_URI ?? `${getBaseUrl()}/api/providers/tiktok/callback`,
};
