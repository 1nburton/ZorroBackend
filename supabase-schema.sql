-- Run this once in the Supabase SQL editor (supabase.com → your project → SQL Editor)

-- ── Users table (secure auth) ────────────────────────────────────────────────
create table if not exists users (
  email     text primary key,
  password  text not null,          -- bcrypt hash, never plain text
  phone     text,
  plan      text not null default 'free',
  pro_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (email);

alter table users enable row level security;
create policy "service role only" on users for all using (false);

-- ── Subscriptions table (Stripe webhook sync) ────────────────────────────────

create table if not exists subscriptions (
  email                  text primary key,
  status                 text not null default 'none',
  stripe_customer_id     text,
  stripe_subscription_id text,
  updated_at             timestamptz not null default now()
);

-- Index for fast lookups
create index if not exists subscriptions_email_idx on subscriptions (email);

-- Only the service role can read/write this table (no public access)
alter table subscriptions enable row level security;

create policy "service role only"
  on subscriptions
  for all
  using (false);   -- public requests blocked; service key bypasses RLS
