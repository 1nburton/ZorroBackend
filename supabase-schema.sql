-- Run this once in the Supabase SQL editor (supabase.com → your project → SQL Editor)

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
