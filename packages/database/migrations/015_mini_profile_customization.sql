-- Migration: 015_mini_profile_customization
-- Description: Add mini-profile customization columns to users table
-- Created: 2026-01-01

-- Add mini-profile customization columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mini_profile_background TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mini_profile_font VARCHAR(100) DEFAULT 'Inter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mini_profile_text_color VARCHAR(7) DEFAULT '#ffffff';

-- Add comments for documentation
COMMENT ON COLUMN users.mini_profile_background IS 'Background image URL or base64 for mini-profile display';
COMMENT ON COLUMN users.mini_profile_font IS 'Google Font name for mini-profile username display';
COMMENT ON COLUMN users.mini_profile_text_color IS 'Hex color value for mini-profile text';
