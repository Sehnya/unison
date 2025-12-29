# Railway Deployment Setup Guide

## Quick Start

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```

### 3. Initialize Railway Project
```bash
railway init
```
This will create a new Railway project or link to an existing one.

### 4. Add PostgreSQL Database
```bash
railway add postgresql
```
This creates a PostgreSQL service and automatically sets `DATABASE_URL` environment variable.

### 5. Set Environment Variables

Set the following environment variables in Railway dashboard or via CLI:

```bash
# Required
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set JWT_SECRET=your-strong-random-secret-min-32-characters
railway variables set JWT_EXPIRES_IN=15m
railway variables set REFRESH_TOKEN_EXPIRES_IN=7d

# Optional (for future scaling)
railway variables set REDIS_URL=redis://... # If using Redis
railway variables set NATS_SERVERS=nats://... # If using NATS
```

**Note**: `DATABASE_URL` is automatically set when you add PostgreSQL service.

### 6. Run Database Migrations

Before first deployment, run migrations:

```bash
# Option 1: Run migrations via Railway CLI
railway run npm run migrate:up -w @discord-clone/database

# Option 2: Connect to Railway database and run manually
railway connect postgres
# Then run: npm run migrate:up -w @discord-clone/database
```

### 7. Deploy

```bash
# Deploy to Railway
railway up

# Or deploy from a specific branch
railway up --detach
```

### 8. Get Your Deployment URL

```bash
railway domain
```

Railway will provide a URL like: `your-app.railway.app`

---

## Frontend Deployment (Separate Service)

The frontend should be deployed separately. Options:

### Option A: Railway Static Site (Recommended for Beta)

1. Create a new service in Railway
2. Set build command: `cd frontend && npm install && npm run build`
3. Set output directory: `frontend/dist`
4. Set environment variable: `VITE_ABLY_API_KEY=your_ably_key`
5. Set environment variable: `VITE_API_URL=https://your-api.railway.app`

### Option B: Vercel (Recommended for Production)

1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables:
   - `VITE_ABLY_API_KEY`
   - `VITE_API_URL` (point to Railway API URL)

---

## Environment Variables Reference

### Backend (API Service)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | Auto-set by Railway |
| `NODE_ENV` | ✅ | Environment | `production` |
| `PORT` | ✅ | Server port | `3001` |
| `JWT_SECRET` | ✅ | JWT signing secret | `your-secret-key` |
| `JWT_EXPIRES_IN` | ❌ | JWT expiration | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | ❌ | Refresh token expiration | `7d` |
| `POSTGRES_MAX_CONNECTIONS` | ❌ | DB connection pool size | `20` |
| `REDIS_URL` | ❌ | Redis connection (if using) | `redis://...` |
| `NATS_SERVERS` | ❌ | NATS servers (if using) | `nats://...` |

### Frontend (Static Site)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_ABLY_API_KEY` | ✅ | Ably API key | `your-ably-key` |
| `VITE_API_URL` | ✅ | Backend API URL | `https://api.railway.app` |

---

## Railway Service Structure

```
Railway Project
├── API Service (Backend)
│   ├── Build: npm install && npm run build
│   ├── Start: npm run start -w @discord-clone/api
│   └── Health: /health endpoint
│
└── PostgreSQL Service
    └── Auto-configured DATABASE_URL
```

---

## Deployment Workflow

### First Time Setup

1. `railway login`
2. `railway init` (creates new project)
3. `railway add postgresql` (adds database)
4. Set environment variables
5. `railway run npm run migrate:up -w @discord-clone/database` (run migrations)
6. `railway up` (deploy)

### Subsequent Deployments

1. Make code changes
2. Commit and push to GitHub
3. Railway auto-deploys (if GitHub integration enabled)
   - OR manually: `railway up`

---

## Monitoring & Logs

### View Logs
```bash
railway logs
```

### View Logs in Real-time
```bash
railway logs --follow
```

### View Service Status
```bash
railway status
```

### Open Railway Dashboard
```bash
railway open
```

---

## Custom Domain Setup

1. In Railway dashboard, go to your service
2. Click "Settings" → "Networking"
3. Click "Generate Domain" or "Custom Domain"
4. Add your domain and configure DNS

---

## Troubleshooting

### Build Fails
- Check Node.js version (should be 18+)
- Verify all dependencies are in package.json
- Check build logs: `railway logs`

### Database Connection Fails
- Verify `DATABASE_URL` is set
- Check database service is running
- Verify migrations have run

### API Not Starting
- Check `PORT` environment variable
- Verify `JWT_SECRET` is set
- Check logs: `railway logs`

### Frontend Can't Connect to API
- Verify `VITE_API_URL` points to correct Railway URL
- Check CORS settings in API
- Verify API is deployed and healthy

---

## Scaling on Railway

### Vertical Scaling
- Upgrade service plan in Railway dashboard
- More CPU/RAM for better performance

### Horizontal Scaling
- Railway automatically handles load balancing
- Multiple instances can run behind Railway's load balancer

### Database Scaling
- Railway PostgreSQL can be upgraded
- Consider read replicas for high read traffic

---

## Cost Optimization

### Free Tier Limits
- $5 free credit monthly
- Good for beta/testing

### Production Recommendations
- Start with Hobby plan ($5/month)
- Scale up as traffic increases
- Monitor usage in Railway dashboard

---

## CI/CD Integration

Railway can auto-deploy from GitHub:

1. Connect GitHub repo in Railway dashboard
2. Select branch (usually `main` or `production`)
3. Railway auto-deploys on push

Or use Railway CLI in GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @railway/cli
      - run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Next Steps After Deployment

1. ✅ Test API health endpoint: `https://your-api.railway.app/health`
2. ✅ Test API endpoints
3. ✅ Deploy frontend (Vercel recommended)
4. ✅ Set up custom domain
5. ✅ Configure monitoring (Sentry, etc.)
6. ✅ Set up backups for database
7. ✅ Configure rate limiting
8. ✅ Set up SSL/HTTPS (automatic with Railway)

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

