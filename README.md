# Unison - Discord Clone

A full-featured Discord-like chat application with real-time messaging, voice calls, guilds, channels, and direct messaging.

## 🚀 Features

### Core Features
- **User Authentication** - Registration, login, JWT tokens, session management
- **Guilds (Servers)** - Create, join, manage servers with invites
- **Channels** - Text and voice channels with categories
- **Real-time Messaging** - Instant message delivery via Ably
- **Voice Calls** - WebRTC voice rooms powered by LiveKit
- **Direct Messages** - Private 1:1 conversations with privacy controls
- **Friends System** - Friend requests, blocking, friend lists
- **Roles & Permissions** - Granular permission system with channel overwrites
- **Custom Emojis** - Guild-specific emoji support
- **User Profiles** - Customizable profiles with avatars, bios, backgrounds
- **Message Reactions** - React to messages with emojis
- **GIF Support** - Giphy integration for sending GIFs

### Frontend Features
- **Responsive UI** - Modern black/white themed interface
- **Voice Mini Player** - Persistent voice call controls while browsing
- **Music Player** - Background music playback
- **Emoji Picker** - Built-in emoji selection
- **Profile Customization** - Editable user profiles with cards
- **Notification Sounds** - Audio alerts for new messages
- **Desktop App** - Tauri-based native application

## 🛠 Technology Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **TypeScript** | Type-safe JavaScript |
| **Express.js** | REST API framework |
| **PostgreSQL** | Primary database (Neon) |
| **Redis** | Caching layer |
| **Ably** | Real-time messaging |
| **LiveKit** | WebRTC voice/video |
| **JWT** | Authentication tokens |

### Frontend
| Technology | Purpose |
|------------|---------|
| **Svelte** | UI framework |
| **Vite** | Build tool |
| **TypeScript** | Type safety |
| **Tauri** | Desktop app wrapper |
| **LiveKit Client** | Voice call SDK |
| **Ably SDK** | Real-time messaging |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Railway** | Deployment platform |
| **Neon** | Serverless PostgreSQL |
| **Upstash** | Serverless Redis |

## 📁 Project Structure

```
├── frontend/                 # Svelte frontend application
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── lib/             # Utilities and stores
│   │   └── types.ts         # TypeScript types
│   └── src-tauri/           # Tauri desktop app config
├── services/                 # Backend microservices
│   ├── api/                 # REST API server
│   ├── auth/                # Authentication service
│   ├── channel/             # Channel management
│   ├── friends/             # Friends & DM service
│   ├── gateway/             # WebSocket gateway
│   ├── guild/               # Guild management
│   ├── messaging/           # Message handling
│   └── permissions/         # Role & permission system
├── packages/                 # Shared packages
│   ├── cache/               # Redis cache utilities
│   ├── database/            # Database pool & migrations
│   ├── eventbus/            # Event bus abstraction
│   ├── events/              # Event type definitions
│   ├── snowflake/           # ID generation
│   └── types/               # Shared TypeScript types
└── scripts/                  # Build & deployment scripts
```

## 📡 API Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with credentials |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout current session |
| GET | `/auth/me` | Get current user |
| GET | `/auth/users/:user_id` | Get user profile |
| GET | `/auth/sessions` | List active sessions |
| DELETE | `/auth/sessions/:session_id` | Revoke session |
| POST | `/auth/accept-terms` | Accept terms of service |
| PATCH | `/auth/profile` | Update profile |
| GET | `/auth/profile-data` | Get profile customization |
| PUT | `/auth/profile-data` | Save profile customization |
| GET | `/auth/users/:user_id/profile-data` | Get user's profile data |

### Guilds (`/api/guilds`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/guilds` | List user's guilds |
| POST | `/guilds` | Create guild (admin only) |
| GET | `/guilds/:guild_id` | Get guild details |
| PATCH | `/guilds/:guild_id` | Update guild |
| DELETE | `/guilds/:guild_id` | Delete guild |
| GET | `/guilds/dashboard` | Dashboard with channel counts |
| GET | `/guilds/:guild_id/navigate` | Guild with channels & members |
| GET | `/guilds/:guild_id/members` | List guild members |
| POST | `/guilds/:guild_id/members` | Join via invite |
| DELETE | `/guilds/:guild_id/members/:user_id` | Leave/kick member |
| POST | `/guilds/:guild_id/invites` | Create invite |
| GET | `/guilds/:guild_id/invites` | List invites |
| DELETE | `/guilds/:guild_id/invites/:code` | Revoke invite |
| GET | `/guilds/:guild_id/bans` | List bans |
| POST | `/guilds/:guild_id/bans/:user_id` | Ban user |
| DELETE | `/guilds/:guild_id/bans/:user_id` | Unban user |

### Channels (`/api/channels`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/guilds/:guild_id/channels` | Create channel |
| GET | `/guilds/:guild_id/channels` | List guild channels |
| GET | `/channels/:channel_id` | Get channel |
| PATCH | `/channels/:channel_id` | Update channel |
| DELETE | `/channels/:channel_id` | Delete channel (admin) |

### Messages (`/api/channels/:channel_id/messages`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/channels/:channel_id/messages` | Send message |
| GET | `/channels/:channel_id/messages` | Get messages (paginated) |
| PATCH | `/channels/:channel_id/messages/:message_id` | Edit message |
| DELETE | `/channels/:channel_id/messages/:message_id` | Delete message |

### Roles (`/api/guilds/:guild_id/roles`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/guilds/:guild_id/roles` | Create role |
| GET | `/guilds/:guild_id/roles` | List roles |
| PATCH | `/guilds/:guild_id/roles/:role_id` | Update role |
| DELETE | `/guilds/:guild_id/roles/:role_id` | Delete role |
| PUT | `/guilds/:guild_id/members/:user_id/roles/:role_id` | Assign role |
| DELETE | `/guilds/:guild_id/members/:user_id/roles/:role_id` | Remove role |
| GET | `/guilds/:guild_id/members/:user_id/roles` | Get member roles |

### Channel Permissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/channels/:channel_id/overwrites/:target_id` | Set permission overwrite |
| DELETE | `/channels/:channel_id/overwrites/:target_id` | Delete overwrite |
| GET | `/channels/:channel_id/overwrites` | List overwrites |

### Emojis (`/api/guilds/:guild_id/emojis`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/guilds/:guild_id/emojis` | List guild emojis |
| POST | `/guilds/:guild_id/emojis` | Upload emoji |
| PATCH | `/guilds/:guild_id/emojis/:emoji_id` | Rename emoji |
| DELETE | `/guilds/:guild_id/emojis/:emoji_id` | Delete emoji |

### Friends & DMs (`/api/friends`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/friends` | List friends |
| DELETE | `/friends/:friendId` | Remove friend |
| GET | `/friends/privacy` | Get DM privacy setting |
| PUT | `/friends/privacy` | Update DM privacy |
| POST | `/friends/requests` | Send friend request |
| GET | `/friends/requests/incoming` | Incoming requests |
| GET | `/friends/requests/outgoing` | Outgoing requests |
| POST | `/friends/requests/:requestId/accept` | Accept request |
| POST | `/friends/requests/:requestId/decline` | Decline request |
| POST | `/friends/block/:userId` | Block user |
| DELETE | `/friends/block/:userId` | Unblock user |
| GET | `/friends/blocked` | List blocked users |
| GET | `/friends/dm` | List DM conversations |
| POST | `/friends/dm` | Start DM conversation |
| GET | `/friends/dm/:conversationId` | Get conversation |
| GET | `/friends/dm/:conversationId/messages` | Get DM messages |
| POST | `/friends/dm/:conversationId/messages` | Send DM |
| POST | `/friends/dm/:conversationId/read` | Mark as read |
| GET | `/friends/dm/check/:userId` | Check if can DM user |
| GET | `/friends/search` | Search users |

### Voice (`/api/livekit`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/livekit/token` | Get LiveKit access token |



## 🗄 Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with auth info |
| `sessions` | Active login sessions |
| `guilds` | Servers/communities |
| `guild_members` | Guild membership |
| `guild_bans` | Banned users per guild |
| `invites` | Guild invite codes |
| `channels` | Text/voice channels |
| `roles` | Permission roles |
| `member_roles` | Role assignments |
| `channel_overwrites` | Channel-specific permissions |
| `messages` | Chat messages (partitioned) |
| `guild_emojis` | Custom emojis |
| `message_reactions` | Emoji reactions |
| `channel_documents` | Channel attachments |
| `user_profiles` | Profile customization data |

### Friends & DM Tables

| Table | Description |
|-------|-------------|
| `friends` | Friend relationships & requests |
| `dm_conversations` | DM conversation metadata |
| `dm_participants` | Users in each conversation |
| `direct_messages` | DM messages (partitioned) |

## ⚙️ Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# LiveKit (Voice)
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_WS_URL=wss://your-livekit-server

# Ably (Real-time)
VITE_ABLY_API_KEY=your-ably-key

# Server
PORT=3001
WORKER_ID=1
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (or Neon account)
- Redis (or Upstash account)
- Ably account
- LiveKit account (for voice)

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Build all packages
npm run build

# Start development
npm run dev
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 📦 Deployment

The application is configured for Railway deployment:

```bash
# Deploy to Railway
railway up
```

See `DEPLOYMENT.md` and `railway-setup.md` for detailed deployment instructions.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📄 License

Private - All rights reserved.
