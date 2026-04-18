# Ana Social

Ana Social is a Next.js App Router marketing analytics app with a Notion-like UI.
It supports Google login, Notion OAuth, Facebook Business OAuth for Instagram,
insights aggregation,
Supabase persistence, and n8n workflow JSON export.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript (strict)
- Tailwind CSS + Radix UI primitives + shadcn-style component patterns
- Zod request validation
- Supabase (`@supabase/supabase-js`)

## Implemented Features

- Google OAuth login gate
- Notion OAuth connection flow after Google login
- Facebook OAuth flow for account data access
- Input validation with normalized account IDs
- Graph API URL preview based on selected filters
- KPI reporting: reach, impressions, profile views, accounts engaged
- Derived metrics: engagement rate + recommendation generation
- Save report snapshots to Supabase
- Save summary report to Notion
- Free plan save cap (`APP_FREE_SAVE_LIMIT`, default `3`)
- Export n8n-compatible workflow JSON (nodes, connections, credential refs)

## Architecture

- `app/api/*`: thin route handlers (request/response orchestration)
- `lib/repositories/*`: external data providers (Facebook, Notion, Supabase)
- `lib/services/*`: business logic (auth, insights, save rules, export)
- `components/app/*`: feature UI
- `components/ui/*`: shared primitive components

The app follows repository and service layering so connectors can be extended
later (for example Google Analytics, Google Ads, YouTube Analytics) without
rewriting UI logic.

## Environment Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in real values.

3. Create database tables in Supabase:

- Open Supabase SQL Editor
- Run `supabase/schema_v2_google_auth.sql`

4. Start dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## OAuth Callback Paths

- Notion: `/api/auth/notion/callback`
- Facebook: `/api/auth/facebook/callback`

If `NOTION_REDIRECT_URI` or `META_CALLBACK_URL` are not provided, the app
builds callback URLs from `APP_BASE_URL`.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Public Notion Tutorials

The app now supports rendering public Notion pages directly via route slug using
`react-notion-x` (App Router):

- `http://localhost:3000/1-Daily-Weekly-To-Do-Lists-15172ef69052804a9e8fd382316d2e1f`

The route resolves page IDs from either:

- The route slug itself (must contain a valid Notion page ID)
- A configured mapping in `lib/config/public-tutorials.ts`

To add tutorials, edit one file only:

- `lib/config/public-tutorials.ts`

Each entry has:

- `slug`: URL path segment
- `title`: display name
- `notionTarget`: public Notion URL or page ID (leave empty to use `slug`)

## Security Notes

- Tokens are handled server-side only
- Google auth token is stored in HttpOnly cookies
- n8n export includes credential references, not secret tokens
