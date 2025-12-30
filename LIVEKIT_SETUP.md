# LiveKit WebRTC Voice Calls Setup

This document explains how to set up LiveKit for multitenant voice calls in the application.

## Overview

The application uses LiveKit for WebRTC-based voice communication, providing Discord-like voice rooms where users can join voice channels and communicate in real-time.

## Prerequisites

1. **LiveKit Account**: Sign up at [livekit.io](https://livekit.io) or self-host LiveKit
2. **API Credentials**: Get your LiveKit API key and secret from your LiveKit dashboard

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# LiveKit Configuration
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_WS_URL=wss://your-livekit-server.livekit.cloud
```

### Getting LiveKit Credentials

1. **Cloud (Recommended for Beta)**:
   - Sign up at [livekit.io](https://livekit.io)
   - Create a new project
   - Copy the API Key and API Secret from the project settings
   - Use the WebSocket URL provided (e.g., `wss://your-project.livekit.cloud`)

2. **Self-Hosted**:
   - Follow [LiveKit's self-hosting guide](https://docs.livekit.io/home/self-hosting/)
   - Set `LIVEKIT_WS_URL` to your server's WebSocket URL
   - Generate API credentials using LiveKit's key generation tools

## Architecture

### Backend

- **LiveKit Service** (`services/api/src/services/livekit.ts`):
  - Generates access tokens for participants
  - Manages room permissions
  - Handles WebSocket URL configuration

- **LiveKit Routes** (`services/api/src/routes/livekit.ts`):
  - `POST /api/livekit/token`: Generates a token for joining a voice room
  - Requires authentication
  - Returns token and WebSocket URL

### Frontend

- **VoiceRoom Component** (`frontend/src/components/VoiceRoom.svelte`):
  - Discord-like UI for voice calls
  - Shows participant grid with avatars
  - Mute/unmute and deafen controls
  - Real-time speaking indicators
  - Automatic connection on mount

## How It Works

1. **User clicks a voice channel**:
   - Channel type is detected (`type === 'voice'`)
   - `VoiceRoom` component is rendered

2. **VoiceRoom connects**:
   - Requests LiveKit token from `/api/livekit/token`
   - Connects to LiveKit server using WebSocket
   - Enables microphone automatically

3. **Real-time communication**:
   - Participants see each other in a grid layout
   - Speaking indicators show who's talking
   - Mute/deafen controls work instantly
   - Participants join/leave in real-time

## Room Naming

Rooms are named using the pattern: `voice-{channelId}`

This ensures:
- Each voice channel has its own isolated room
- Room names are unique and predictable
- Easy to manage and debug

## Features

- ✅ Multitenant support (multiple voice channels)
- ✅ Real-time participant presence
- ✅ Speaking indicators
- ✅ Mute/unmute controls
- ✅ Deafen/undeafen controls
- ✅ Automatic microphone enablement
- ✅ Discord-like UI/UX
- ✅ Participant avatars and names
- ✅ Connection status indicators

## Troubleshooting

### "Failed to get LiveKit token"
- Check that `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are set
- Verify the API credentials are correct
- Check server logs for detailed error messages

### "Failed to connect to voice room"
- Verify `LIVEKIT_WS_URL` is correct
- Check network connectivity to LiveKit server
- Ensure LiveKit server is running (if self-hosted)

### Microphone not working
- Check browser permissions for microphone access
- Verify HTTPS is enabled (required for WebRTC)
- Check browser console for permission errors

### Participants not appearing
- Verify all participants have valid tokens
- Check that participants are in the same room
- Verify network connectivity

## Production Considerations

1. **HTTPS Required**: WebRTC requires HTTPS in production
2. **Firewall Rules**: Ensure WebSocket connections are allowed
3. **Scaling**: LiveKit Cloud handles scaling automatically; self-hosted requires load balancing
4. **Monitoring**: Monitor LiveKit server metrics and connection counts
5. **Rate Limiting**: Consider rate limiting token generation endpoints

## Next Steps

- Add video support (optional)
- Add screen sharing (optional)
- Add recording capabilities (optional)
- Add voice activity detection improvements
- Add participant volume controls

