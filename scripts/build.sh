#!/bin/bash
set -e

echo "Building packages in dependency order..."

# Build packages first (in dependency order)
echo "Building @discord-clone/types..."
npm run build -w @discord-clone/types

echo "Building @discord-clone/snowflake..."
npm run build -w @discord-clone/snowflake

echo "Building @discord-clone/events..."
npm run build -w @discord-clone/events

echo "Building @discord-clone/eventbus..."
npm run build -w @discord-clone/eventbus

echo "Building @discord-clone/database..."
npm run build -w @discord-clone/database

# Build services
echo "Building @discord-clone/auth..."
npm run build -w @discord-clone/auth

echo "Building @discord-clone/guild..."
npm run build -w @discord-clone/guild

echo "Building @discord-clone/channel..."
npm run build -w @discord-clone/channel

echo "Building @discord-clone/messaging..."
npm run build -w @discord-clone/messaging

echo "Building @discord-clone/permissions..."
npm run build -w @discord-clone/permissions

echo "Building @discord-clone/gateway..."
npm run build -w @discord-clone/gateway

echo "Building @discord-clone/api..."
npm run build -w @discord-clone/api

# Build frontend last
echo "Building frontend..."
npm run build -w frontend

echo "Build complete!"

