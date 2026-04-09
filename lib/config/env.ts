import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("https://carolyne-privileged-michele.ngrok-free.dev "),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_BUSINESS_CONFIG_ID: z.string().optional(),
  META_CALLBACK_URL: z.string().url().optional(),

  NOTION_CLIENT_ID: z.string().min(1),
  NOTION_CLIENT_SECRET: z.string().min(1),
  NOTION_REDIRECT_URI: z.string().url().optional(),
  NOTION_VERSION: z.string().default("2022-06-28"),

  APP_FREE_SAVE_LIMIT: z.coerce.number().int().positive().default(3),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  APP_BASE_URL: process.env.APP_BASE_URL,

  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_BUSINESS_CONFIG_ID: process.env.META_BUSINESS_CONFIG_ID,
  META_CALLBACK_URL: process.env.META_CALLBACK_URL,

  NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
  NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET,
  NOTION_REDIRECT_URI: process.env.NOTION_REDIRECT_URI,
  NOTION_VERSION: process.env.NOTION_VERSION,

  APP_FREE_SAVE_LIMIT: process.env.APP_FREE_SAVE_LIMIT,
});

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${formatted}`);
}

export const env = parsed.data;

export const redirectUri = {
  notion:
    env.NOTION_REDIRECT_URI ??
    `${env.APP_BASE_URL.replace(/\/$/, "")}/api/auth/notion/callback`,
  facebook:
    env.META_CALLBACK_URL ??
    `${env.APP_BASE_URL.replace(/\/$/, "")}/api/auth/facebook/callback`,
};

export const getBaseUrl = () => {
  return env.APP_BASE_URL.replace(/\/$/, "");
};
