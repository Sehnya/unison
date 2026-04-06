-- Migration: 017_add_username_effect_to_users
-- Description: Add username_effect column for 3D text rendering effects
-- Valid values: none, chrome, neon, holographic, fire, ice, gold, glitch

ALTER TABLE users ADD COLUMN IF NOT EXISTS username_effect VARCHAR(20) DEFAULT 'none';

COMMENT ON COLUMN users.username_effect IS '3D text effect for username rendering (none, chrome, neon, holographic, fire, ice, gold, glitch)';
