-- Migration: Add username_font column to users table
-- This allows users to customize the font used to display their username

ALTER TABLE users ADD COLUMN IF NOT EXISTS username_font VARCHAR(100) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.username_font IS 'Google Font name for username display customization';
