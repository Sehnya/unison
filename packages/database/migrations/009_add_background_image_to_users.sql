-- Migration: 009_add_background_image_to_users
-- Description: Add background_image column to users table to store profile background images as base64-encoded blobs
-- Created: 2024-01-08

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS background_image TEXT;

