-- Migration: 006_add_terms_accepted_to_users
-- Description: Add terms_accepted_at field to track if user has accepted beta terms
-- Created: 2024-01-02

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

