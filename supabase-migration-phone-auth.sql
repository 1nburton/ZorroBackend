-- Migration: Switch users table from email-based to phone-based auth
-- Run this in the Supabase SQL editor.
-- IMPORTANT: This drops the existing users table and recreates it.
-- Back up any data you want to keep first.

-- Drop old table
DROP TABLE IF EXISTS users;

-- Recreate with phone as primary key
CREATE TABLE users (
  phone         TEXT        PRIMARY KEY,
  password      TEXT        NOT NULL,
  plan          TEXT        NOT NULL DEFAULT 'free',
  pro_until     TIMESTAMPTZ,
  billing_email TEXT        UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write
CREATE POLICY "Service role only"
  ON users
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for billing_email lookups (used by webhook)
CREATE INDEX IF NOT EXISTS users_billing_email_idx ON users (billing_email);
