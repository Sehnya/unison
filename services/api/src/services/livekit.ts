/**
 * LiveKit Service
 * 
 * Handles LiveKit token generation for WebRTC voice calls
 */

import { AccessToken } from 'livekit-server-sdk';

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  wsUrl?: string;
}

export interface TokenOptions {
  roomName: string;
  participantName: string;
  participantIdentity: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
}

export class LiveKitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly wsUrl: string;

  constructor(config: LiveKitConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.wsUrl = config.wsUrl || 'wss://unison-livekit.livekit.cloud';
  }

  /**
   * Generate an access token for a participant to join a room
   */
  generateToken(options: TokenOptions): string {
    const { roomName, participantName, participantIdentity, canPublish = true, canSubscribe = true, canPublishData = true } = options;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    // Grant permissions
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe,
      canPublishData,
    });

    return at.toJwt();
  }

  /**
   * Get the WebSocket URL for LiveKit
   */
  getWsUrl(): string {
    return this.wsUrl;
  }
}

