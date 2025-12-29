-- Migration: 004_increase_guild_icon_banner_size
-- Description: Increase icon and banner column sizes to support longer values (e.g., base64 images)
-- Created: 2024-01-02

-- Change icon from VARCHAR(255) to TEXT to support longer values
ALTER TABLE guilds
  ALTER COLUMN icon TYPE TEXT;

-- Change banner from VARCHAR(255) to TEXT to support longer values
ALTER TABLE guilds
  ALTER COLUMN banner TYPE TEXT;

