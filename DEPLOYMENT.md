# Deployment Guide

## Architecture Overview

- **Frontend**: Svelte + Vite (static site)
- **Backend**: Express.js API (Node.js)
- **Database**: PostgreSQL
- **Real-time**: Ably
- **Event Bus**: NATS JetStream (for scalability)
- **Cache**: Redis (optional, for session/rate limiting)

---

## 🚀 Beta Production Deployment (Quick & Cost-Effective)

### Option 1: Railway (Recommended for Beta)
**Best for**: Quick deployment, managed services, easy scaling

**Pros**:
- One-click PostgreSQL deployment
- Automatic HTTPS
- Built-in CI/CD
- Free tier available
- Simple environment variable management

**Setup**:
1. **Frontend** (Static hosting):
   - Use Railway's static site hosting or Vercel/Netlify
   - Build command: `cd frontend && npm install && npm run build`
   - Output directory: `frontend/dist`
   - Environment variables: `VITE_ABLY_API_KEY`

2. **Backend** (API Server):
   - Deploy as Node.js service
   - Build command: `npm install && npm run build --workspaces --if-present`
   - Start command: `npm run start -w @discord-clone/api`
   - Environment variables:
     ```
     DATABASE_URL=postgresql://...
     PORT=3001
     JWT_SECRET=your-secret-key
     NODE_ENV=production
     ```

3. **Database**:
   - Railway PostgreSQL (managed)
   - Run migrations: `npm run migrate:up -w @discord-clone/database`

**Cost**: ~$5-20/month for beta

---

### Option 2: Render
**Best for**: Free tier, simple setup

**Setup**:
1. **Frontend**: Static site on Render
2. **Backend**: Web service on Render
3. **Database**: Render PostgreSQL (free tier available)

**Cost**: Free tier available, ~$7/month for production

---

### Option 3: DigitalOcean App Platform
**Best for**: Predictable pricing, good performance

**Setup**:
- Similar to Railway but with more control
- Managed PostgreSQL available
- Auto-scaling built-in

**Cost**: ~$12-25/month

---

## 📈 Production Scalability Options

### Option A: Containerized Deployment (Docker + Kubernetes)

#### Architecture:
```
┌─────────────┐
│   CDN       │ (Cloudflare/CloudFront)
│  (Static)   │
└──────┬──────┘
       │
┌──────▼─────────────────────────────────────┐
│         Load Balancer (Nginx/HAProxy)      │
└──────┬─────────────────────────────────────┘
       │
   ┌───┴───┬──────────┬──────────┐
   │       │          │          │
┌──▼──┐ ┌──▼──┐   ┌──▼──┐   ┌──▼──┐
│ API │ │ API │   │ API │   │ API │  (Horizontal scaling)
│ Pod │ │ Pod │   │ Pod │   │ Pod │
└──┬──┘ └──┬──┘   └──┬──┘   └──┬──┘
   │       │          │          │
   └───┬───┴──────────┴──────────┘
       │
   ┌───▼──────────────┐
   │  PostgreSQL      │  (Primary + Replicas)
   │  (Managed)       │
   └──────────────────┘
       │
   ┌───▼──────────────┐
   │  Redis Cluster   │  (Session/Cache)
   └──────────────────┘
       │
   ┌───▼──────────────┐
   │  NATS JetStream  │  (Event Bus)
   └──────────────────┘
```

#### Implementation Steps:

1. **Create Dockerfile for API**:
```dockerfile
# Dockerfile.api
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages packages/
COPY services services/
RUN npm ci
RUN npm run build --workspaces --if-present

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services ./services
COPY --from=builder /app/package*.json ./
EXPOSE 3001
CMD ["npm", "run", "start", "-w", "@discord-clone/api"]
```

2. **Create Dockerfile for Frontend**:
```dockerfile
# Dockerfile.frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

3. **Docker Compose for Local Testing**:
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: discord_clone
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nats:
    image: nats:latest
    ports:
      - "4222:4222"
      - "8222:8222"

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/discord_clone
      REDIS_URL: redis://redis:6379
      NATS_SERVERS: nats://nats:4222
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
      - nats

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - api
```

4. **Kubernetes Deployment** (for production):
   - Use managed Kubernetes (GKE, EKS, AKS)
   - Horizontal Pod Autoscaler for API scaling
   - Managed PostgreSQL (Cloud SQL, RDS, etc.)
   - Redis cluster for caching
   - NATS JetStream cluster for event bus

---

### Option B: Serverless Architecture

#### Architecture:
```
┌─────────────┐
│   CloudFront │ (CDN for static assets)
│   / Vercel   │
└──────┬──────┘
       │
┌──────▼─────────────────────────────────────┐
│         API Gateway (AWS/Cloudflare)        │
└──────┬─────────────────────────────────────┘
       │
   ┌───┴───┬──────────┬──────────┐
   │       │          │          │
┌──▼──┐ ┌──▼──┐   ┌──▼──┐   ┌──▼──┐
│Lambda│ │Lambda│   │Lambda│   │Lambda│  (Auto-scaling)
└──┬──┘ └──┬──┘   └──┬──┘   └──┬──┘
   │       │          │          │
   └───┬───┴──────────┴──────────┘
       │
   ┌───▼──────────────┐
   │  RDS PostgreSQL  │
   └──────────────────┘
```

**Note**: Requires refactoring API to serverless functions. Good for high-traffic, cost-effective at scale.

---

### Option C: Hybrid Approach (Recommended)

**Frontend**: Vercel/Netlify (static hosting, CDN, free SSL)
**Backend**: Railway/Render (containerized, easy scaling)
**Database**: Managed PostgreSQL (Railway, Supabase, Neon)
**Real-time**: Ably (already using)
**Cache**: Upstash Redis (serverless Redis)
**Monitoring**: Sentry, LogRocket

**Cost**: ~$30-50/month for moderate traffic

---

## 🔧 Production Checklist

### Environment Variables

**Frontend**:
```env
VITE_ABLY_API_KEY=your_ably_key
VITE_API_URL=https://api.yourdomain.com
```

**Backend**:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=strong-random-secret-min-32-chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
POSTGRES_MAX_CONNECTIONS=20
REDIS_URL=redis://... (optional)
NATS_SERVERS=nats://... (optional)
ABLY_API_KEY=your_ably_key (if needed server-side)
```

### Security

1. **HTTPS**: Always use HTTPS (automatic with most platforms)
2. **CORS**: Configure CORS properly in API
3. **Rate Limiting**: Add rate limiting middleware
4. **Secrets**: Use secret management (Railway secrets, AWS Secrets Manager)
5. **Database**: Use connection pooling, enable SSL
6. **JWT**: Use strong secrets, short expiration times

### Performance Optimizations

1. **Frontend**:
   - Enable Vite build optimizations
   - Code splitting
   - Lazy loading
   - CDN for static assets

2. **Backend**:
   - Connection pooling (already configured)
   - Response compression (add middleware)
   - Caching headers
   - Database query optimization
   - Indexes on frequently queried columns

3. **Database**:
   - Connection pooling (max 20 connections per service)
   - Read replicas for scaling reads
   - Proper indexes
   - Query optimization

### Monitoring & Logging

1. **Application Monitoring**: Sentry, Datadog, New Relic
2. **Uptime Monitoring**: UptimeRobot, Pingdom
3. **Logging**: Centralized logging (Logtail, Papertrail)
4. **Metrics**: Prometheus + Grafana (for Kubernetes)

### Scaling Strategy

1. **Horizontal Scaling**: Multiple API instances behind load balancer
2. **Database Scaling**: 
   - Read replicas for read-heavy operations
   - Connection pooling limits
   - Query optimization
3. **Caching**: Redis for:
   - Session storage
   - Frequently accessed data
   - Rate limiting
4. **CDN**: Cloudflare/CloudFront for static assets
5. **Message Queue**: NATS JetStream for async operations

---

## 🚢 Quick Deploy Scripts

### Railway Deployment

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Add PostgreSQL: `railway add postgresql`
5. Set environment variables
6. Deploy: `railway up`

### Render Deployment

1. Connect GitHub repo
2. Create Web Service (backend)
3. Create Static Site (frontend)
4. Create PostgreSQL database
5. Set environment variables
6. Deploy

---

## 📊 Cost Estimates

### Beta (Low Traffic):
- Railway/Render: $5-20/month
- Database: Included or $5/month
- Ably: Free tier (2M messages/month)
- **Total**: ~$10-25/month

### Production (Moderate Traffic):
- Hosting: $20-50/month
- Database: $15-30/month
- Ably: $10-50/month (based on usage)
- CDN: $5-20/month
- Monitoring: $0-20/month
- **Total**: ~$50-170/month

### High Scale:
- Kubernetes cluster: $100-500/month
- Managed PostgreSQL: $50-200/month
- Redis cluster: $30-100/month
- CDN: $50-200/month
- **Total**: ~$230-1000/month

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build --workspaces --if-present
      - run: npm run test
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci && npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🎯 Recommended Path

**For Beta**: Start with **Railway** or **Render**
- Quick setup
- Managed PostgreSQL
- Automatic HTTPS
- Easy environment variables
- Can scale later

**For Production**: Move to **Hybrid Approach**
- Frontend: Vercel (best performance, free)
- Backend: Railway/Render (easy scaling)
- Database: Managed PostgreSQL
- Add Redis for caching when needed
- Add monitoring (Sentry)

**For High Scale**: Move to **Kubernetes**
- Full control
- Auto-scaling
- Multi-region support
- Enterprise-grade reliability

---

## 📝 Next Steps

1. Choose deployment platform (Railway recommended for beta)
2. Set up environment variables
3. Run database migrations
4. Deploy backend API
5. Deploy frontend
6. Configure custom domain
7. Set up monitoring
8. Add rate limiting
9. Set up CI/CD
10. Configure backups

