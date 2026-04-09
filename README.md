# Ana Social

Ana Social is a Next.js App Router marketing analytics app with a Notion-like UI.
It supports Notion OAuth gate, Facebook Business OAuth, insights aggregation,
Supabase persistence, and n8n workflow JSON export.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript (strict)
- Tailwind CSS + Radix UI primitives + shadcn-style component patterns
- Zod request validation
- Supabase (`@supabase/supabase-js`)

## Implemented Features

- Notion OAuth gate before entering the analytics console
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
- Run `supabase/schema.sql`

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

## Security Notes

- Tokens are handled server-side only
- Session state is stored in HttpOnly cookies
- n8n export includes credential references, not secret tokens
