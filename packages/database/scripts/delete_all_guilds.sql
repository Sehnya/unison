-- Delete all guilds from the database
-- This will cascade delete:
-- - guild_members
-- - guild_bans
-- - invites
-- - channels (and their messages)
-- - roles

-- First, show how many guilds exist
SELECT COUNT(*) as guild_count FROM guilds WHERE deleted_at IS NULL;

-- Delete all guilds (CASCADE will handle related tables)
DELETE FROM guilds;

-- Verify deletion
SELECT COUNT(*) as remaining_guilds FROM guilds;

