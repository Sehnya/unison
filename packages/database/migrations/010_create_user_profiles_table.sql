-- Migration: 010_create_user_profiles_table
-- Description: Create user_profiles table to store profile customization data (cards, layout, widgets, etc.)
-- Created: 2024-01-09

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_data JSONB,
  background_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
