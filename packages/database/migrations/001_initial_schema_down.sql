-- Migration: 001_initial_schema (DOWN)
-- Description: Rollback initial database schema

DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS channel_overwrites;
DROP TABLE IF EXISTS member_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS guild_bans;
DROP TABLE IF EXISTS guild_members;
DROP TABLE IF EXISTS guilds;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
