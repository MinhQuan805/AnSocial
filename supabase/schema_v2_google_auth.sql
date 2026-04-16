-- Ana Social Schema v2 (Google Auth + Provider Registry)
-- Migration from Session-based auth to Google Auth + Multi-Provider
-- Canonical schema for this project (Google login + provider connections)

create extension if not exists pgcrypto;

-- ============================================================================
-- CORE TABLES - USER MANAGEMENT
-- ============================================================================

-- Users: Core user entity identified by Google ID
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_id text not null unique,
  google_email text not null,
  google_name text not null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Provider Connections: Unified table for all platform integrations
create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  
  -- Provider identification
  provider_type text not null,  -- 'facebook', 'notion', 'tiktok', 'instagram', 'youtube'
  provider_user_id text not null,  -- User ID on the provider platform
  
  -- Authentication tokens (encrypted at application layer)
  access_token text not null,
  refresh_token text,  -- Optional, only if provider supports refresh
  expires_at timestamptz,
  
  -- Provider-specific metadata (flexible schema)
  metadata jsonb default '{}',  -- facebook: {pages: [...], accounts: [...]}, notion: {workspace_id, workspace_name}
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  connected_at timestamptz not null default now(),
  
  -- Ensure one connection per user per provider type
  constraint unique_user_provider unique(user_id, provider_type)
);

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Auto Schedule Configuration: Stores scheduling preferences per user
create table if not exists public.auto_schedule_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  
  enabled boolean not null default false,
  frequency text not null default 'daily' check(frequency in ('daily', 'weekly', 'monthly')),
  time text not null default '09:00',  -- Format: HH:MM
  timezone text not null default 'UTC',
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unique_schedule_per_user unique(user_id)
);

-- ============================================================================
-- DATA TABLES
-- ============================================================================

-- Insight Snapshots: Stores historical insight reports for analysis
create table if not exists public.insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  
  -- Source platform identification
  provider_type text not null,  -- 'facebook', 'tiktok', 'youtube', 'instagram'
  provider_user_id text not null,  -- Which account on this platform
  
  -- Report data
  report_json jsonb not null,
  
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User lookups
create index if not exists idx_users_google_id
  on public.users(google_id);

-- Provider connection lookups
create index if not exists idx_provider_connections_user_id
  on public.provider_connections(user_id);

create index if not exists idx_provider_connections_user_provider
  on public.provider_connections(user_id, provider_type);

-- Auto schedule lookups
create index if not exists idx_auto_schedule_configs_user_id
  on public.auto_schedule_configs(user_id);

-- Insight snapshots lookups (optimized for common queries)
create index if not exists idx_insight_snapshots_user_id
  on public.insight_snapshots(user_id);

create index if not exists idx_insight_snapshots_user_provider_created
  on public.insight_snapshots(user_id, provider_type, created_at desc);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT AUTOMATION
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_provider_connections_updated_at on public.provider_connections;
create trigger trg_provider_connections_updated_at
before update on public.provider_connections
for each row
execute function public.set_updated_at();

drop trigger if exists trg_auto_schedule_configs_updated_at on public.auto_schedule_configs;
create trigger trg_auto_schedule_configs_updated_at
before update on public.auto_schedule_configs
for each row
execute function public.set_updated_at();

-- ============================================================================
-- AUTH SYNC: Sync better-auth users with public.users table
-- ============================================================================

-- Function to ensure public.users record exists for better-auth user
create or replace function public.ensure_user_exists()
returns trigger
language plpgsql
as $$
declare
  v_google_email text;
  v_google_name text;
begin
  -- Extract Google auth data from auth.users
  v_google_email := new.email;
  v_google_name := coalesce(new.raw_user_meta_data ->> 'name', new.email);

  -- Insert or update public.users with auth.users.id as the user_id
  -- This ensures foreign key references work correctly
  insert into public.users (id, google_id, google_email, google_name)
  values (new.id, new.id::text, v_google_email, v_google_name)
  on conflict (google_id) do update
  set google_email = excluded.google_email,
      google_name = excluded.google_name,
      updated_at = now();

  return new;
end;
$$;

-- Trigger to sync auth.users with public.users when auth user is created or updated
drop trigger if exists trg_auth_user_sync on auth.users;
create trigger trg_auth_user_sync
after insert or update on auth.users
for each row
execute function public.ensure_user_exists();

-- ============================================================================
-- LEGACY CLEANUP (Run after data migration)
-- ============================================================================

-- Remove old session-based tables (after migration)
-- drop table if exists sessions cascade;
-- drop table if exists notion_integrations cascade;
-- drop table if exists facebook_integrations cascade;
