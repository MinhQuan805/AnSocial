-- Ana Social schema
-- Run this SQL in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,

  notion_workspace_id text,
  notion_workspace_name text,
  notion_access_token text,
  notion_target_page_id text,

  facebook_user_id text,
  facebook_access_token text,
  facebook_token_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  source_account text not null,
  report_json jsonb not null,
  created_at timestamptz not null default now(),

  constraint fk_insight_session
    foreign key (session_id)
    references public.user_integrations(session_id)
    on delete cascade
);

create index if not exists idx_user_integrations_session_id
  on public.user_integrations(session_id);

create index if not exists idx_insight_snapshots_session_id
  on public.insight_snapshots(session_id);

create index if not exists idx_insight_snapshots_created_at
  on public.insight_snapshots(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_integrations_updated_at on public.user_integrations;
create trigger trg_user_integrations_updated_at
before update on public.user_integrations
for each row
execute function public.set_updated_at();
