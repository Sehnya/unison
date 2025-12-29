-- Migration: 008_change_avatar_to_text
-- Description: Change avatar column from VARCHAR(255) to TEXT to support base64-encoded images
-- Created: 2024-01-02

ALTER TABLE users
  ALTER COLUMN avatar TYPE TEXT;

