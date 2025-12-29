#!/bin/bash
# Railway Deployment Script
# This script helps set up and deploy to Railway

set -e

echo "🚂 Railway Deployment Setup"
echo "============================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
    echo "✅ Railway CLI installed"
else
    echo "✅ Railway CLI found"
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway..."
    railway login
fi

echo ""
echo "📦 Setting up Railway project..."
echo ""

# Initialize project if not already initialized
if [ ! -f ".railway/project.json" ]; then
    echo "Creating new Railway project..."
    railway init
else
    echo "✅ Railway project already initialized"
fi

echo ""
echo "🗄️  Setting up PostgreSQL database..."
echo ""

# Check if PostgreSQL service exists
if railway service list 2>/dev/null | grep -q postgresql; then
    echo "✅ PostgreSQL service already exists"
else
    echo "Adding PostgreSQL service..."
    railway add postgresql
    echo "✅ PostgreSQL service added"
fi

echo ""
echo "🔧 Setting environment variables..."
echo ""

# Set required environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3001

# Generate JWT secret if not set
if ! railway variables get JWT_SECRET &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
    railway variables set JWT_SECRET="$JWT_SECRET"
    echo "✅ Generated and set JWT_SECRET"
else
    echo "✅ JWT_SECRET already set"
fi

# Set optional variables with defaults
railway variables set JWT_EXPIRES_IN=15m
railway variables set REFRESH_TOKEN_EXPIRES_IN=7d
railway variables set POSTGRES_MAX_CONNECTIONS=20

echo ""
echo "📊 Running database migrations..."
echo ""

# Run migrations
railway run npm run migrate:up -w @discord-clone/database

echo ""
echo "🚀 Deploying to Railway..."
echo ""

# Deploy
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get your deployment URL: railway domain"
echo "2. Set up frontend deployment (see railway-setup.md)"
echo "3. Configure custom domain (optional)"
echo "4. Set up monitoring"
echo ""
echo "View logs: railway logs"
echo "Open dashboard: railway open"
echo ""

