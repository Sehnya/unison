# 🚂 Railway Deployment - Quick Start

This guide will help you deploy your Discord clone to Railway in minutes.

## Prerequisites

- Node.js 18+ installed
- Railway account (sign up at https://railway.app)
- GitHub account (for automatic deployments)

## Quick Deploy (5 minutes)

### Option 1: Automated Script

```bash
./railway-deploy.sh
```

This script will:
- Install Railway CLI if needed
- Login to Railway
- Create/initialize project
- Add PostgreSQL database
- Set environment variables
- Run database migrations
- Deploy your app

### Option 2: Manual Setup

#### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

#### 2. Login
```bash
railway login
```

#### 3. Initialize Project
```bash
railway init
```

#### 4. Add PostgreSQL
```bash
railway add postgresql
```

#### 5. Set Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway variables set JWT_EXPIRES_IN=15m
railway variables set REFRESH_TOKEN_EXPIRES_IN=7d
```

#### 6. Run Migrations
```bash
railway run npm run migrate:up -w @discord-clone/database
```

#### 7. Deploy
```bash
railway up
```

#### 8. Get Your URL
```bash
railway domain
```

## Frontend Deployment

After backend is deployed, deploy frontend:

### Option A: Railway Static Site
1. Create new service in Railway
2. Set root directory: `frontend`
3. Build command: `npm install && npm run build`
4. Output directory: `dist`
5. Environment variables:
   - `VITE_ABLY_API_KEY=your_key`
   - `VITE_API_URL=https://your-api.railway.app`

### Option B: Vercel (Recommended)
1. Go to https://vercel.com
2. Import your GitHub repo
3. Set root directory: `frontend`
4. Build command: `npm run build`
5. Output directory: `dist`
6. Environment variables:
   - `VITE_ABLY_API_KEY`
   - `VITE_API_URL` (your Railway API URL)

## Environment Variables

### Backend (Auto-configured)
- `DATABASE_URL` - Auto-set by Railway PostgreSQL service
- `NODE_ENV=production`
- `PORT=3001`
- `JWT_SECRET` - Set via CLI or dashboard

### Frontend
- `VITE_ABLY_API_KEY` - Your Ably API key
- `VITE_API_URL` - Your Railway API URL (e.g., `https://api.railway.app`)

## Verify Deployment

1. Check health endpoint: `https://your-api.railway.app/health`
2. Should return: `{"status":"ok"}`

## Useful Commands

```bash
# View logs
railway logs

# View logs in real-time
railway logs --follow

# Open Railway dashboard
railway open

# Check service status
railway status

# Connect to database
railway connect postgres
```

## Troubleshooting

**Build fails?**
- Check Node.js version (18+)
- Verify all dependencies in package.json
- Check logs: `railway logs`

**Database connection fails?**
- Verify `DATABASE_URL` is set (auto-set by Railway)
- Check database service is running
- Run migrations: `railway run npm run migrate:up -w @discord-clone/database`

**API not starting?**
- Check `PORT` is set to `3001`
- Verify `JWT_SECRET` is set
- Check logs: `railway logs`

## Next Steps

1. ✅ Deploy backend (you're here!)
2. ✅ Deploy frontend (Vercel recommended)
3. ✅ Set up custom domain
4. ✅ Configure monitoring
5. ✅ Set up backups

## Support

- Full guide: See `railway-setup.md`
- Railway docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

