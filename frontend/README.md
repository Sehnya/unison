# Discord Clone - Svelte Frontend MVP

A minimal Svelte frontend for visual verification of the Discord-like messaging backend.

## Prerequisites

- Node.js 18+
- Backend API running on `http://localhost:3000`
- A valid channel ID from your backend

## Installation

```bash
cd frontend
npm install
```

## Configuration

### Ably API Key (Required for Real-time Chat)

The frontend uses Ably for real-time messaging. You need to set up an Ably API key:

1. Sign up for a free account at [https://ably.com](https://ably.com)
2. Create a new app or use an existing one
3. Copy your API key from the dashboard
4. Create a `.env` file in the `frontend` directory:
   ```bash
   VITE_ABLY_API_KEY=your-ably-api-key-here
   ```
5. Restart the dev server after adding the key

**Note:** If the Ably API key is not set, the app will fall back to mock messages for demonstration purposes.

### Backend URL

The frontend proxies API requests to `http://localhost:3000` by default. To change this, edit `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/auth': 'http://localhost:YOUR_PORT',
    '/channels': 'http://localhost:YOUR_PORT'
  }
}
```

## Running the Frontend

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Example Test Flow

1. Start the backend API on port 3000
2. Create a user and channel via the backend API
3. Update `CHANNEL_ID` in `ChatView.svelte` with your channel ID
4. Run `npm run dev`
5. Open `http://localhost:5173` in your browser
6. Log in with your user credentials
7. Send messages and verify they appear in the message list
8. Open a second browser tab to test real-time polling

## Running Tests

```bash
npm test
```

## Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## Features

- **Real-time messaging** via Ably
- **Typing indicators** - see when others are typing
- **Presence** - see who's online in channels
- **Message history** - loads previous messages from Ably
- **Modern UI** - beautiful dark theme with glassmorphism effects

## Notes

- Real-time chat requires Ably API key (see Configuration above)
- If Ably is not configured, the app will show mock messages
- Token is stored in memory; page refresh requires re-login
- Messages are published to Ably channels for real-time sync
