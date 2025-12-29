-- Migration: 002_used_refresh_tokens (down)
-- Description: Remove used refresh tokens table

DROP TABLE IF EXISTS used_refresh_tokens;
