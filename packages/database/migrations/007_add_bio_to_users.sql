-- Migration: 007_add_bio_to_users
-- Description: Add bio field to users table for profile description
-- Created: 2024-01-02

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT;

