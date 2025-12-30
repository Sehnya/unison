<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Room, RoomEvent, RemoteParticipant, LocalParticipant, TrackPublication, Track } from 'livekit-client';
  import type { User } from '../types';
  import { apiUrl } from '../lib/api';

  export let channelId: string;
  export let channelName: string;
  export let authToken: string;
  export let currentUser: User | null = null;

  let room: Room | null = null;
  let isConnected = false;
  let isConnecting = false;
  let participants: Map<string, RemoteParticipant | LocalParticipant> = new Map();
  let localParticipant: LocalParticipant | null = null;
  let error: string | null = null;
  let isMuted = false;
  let isDeafened = false;
  let localAudioTrack: any = null;

  // Participant display data
  interface ParticipantDisplay {
    id: string;
    name: string;
    avatar?: string;
    isSpeaking: boolean;
    isMuted: boolean;
    audioLevel: number;
  }

  let participantDisplays: ParticipantDisplay[] = [];

  async function connectToRoom() {
    if (isConnecting || isConnected) return;

    isConnecting = true;
    error = null;

    try {
      // Get LiveKit token from API
      const response = await fetch(apiUrl('/api/livekit/token'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: `voice-${channelId}`,
          participantName: currentUser?.username || 'User',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to get LiveKit token');
      }

      const { token, wsUrl } = await response.json();

      // Create room and connect
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners
      setupRoomListeners();

      // Connect to room
      await room.connect(wsUrl, token);
      isConnected = true;

      // Enable microphone
      await enableMicrophone();
    } catch (err) {
      console.error('Failed to connect to voice room:', err);
      error = err instanceof Error ? err.message : 'Failed to connect to voice room';
      isConnected = false;
    } finally {
      isConnecting = false;
    }
  }

  function setupRoomListeners() {
    if (!room) return;

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('Participant connected:', participant.identity);
      participants.set(participant.identity, participant);
      updateParticipantDisplays();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('Participant disconnected:', participant.identity);
      participants.delete(participant.identity);
      updateParticipantDisplays();
    });

    room.on(RoomEvent.TrackSubscribed, (track: Track, publication: TrackPublication, participant: RemoteParticipant | LocalParticipant) => {
      console.log('Track subscribed:', track.kind, participant.identity);
      if (track.kind === 'audio') {
        track.attach(document.createElement('audio') as HTMLAudioElement);
      }
      updateParticipantDisplays();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: Track, publication: TrackPublication, participant: RemoteParticipant | LocalParticipant) => {
      console.log('Track unsubscribed:', track.kind, participant.identity);
      track.detach();
      updateParticipantDisplays();
    });

    room.on(RoomEvent.LocalTrackPublished, (publication: TrackPublication, participant: LocalParticipant) => {
      console.log('Local track published:', publication.kind);
      localParticipant = participant;
      updateParticipantDisplays();
    });

    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      updateParticipantDisplays();
    });

    // Update speaking status periodically
    const speakingInterval = setInterval(() => {
      if (room && isConnected) {
        updateParticipantDisplays();
      }
    }, 100);
  }

  function updateParticipantDisplays() {
    if (!room) return;

    const displays: ParticipantDisplay[] = [];

    // Add local participant
    if (room.localParticipant) {
      const localPub = room.localParticipant.audioTrackPublications.values().next().value;
      displays.push({
        id: room.localParticipant.identity,
        name: currentUser?.username || 'You',
        avatar: currentUser?.avatar || null,
        isSpeaking: room.localParticipant.isSpeaking,
        isMuted: isMuted,
        audioLevel: room.localParticipant.isSpeaking ? 0.5 : 0,
      });
    }

    // Add remote participants
    room.remoteParticipants.forEach((participant) => {
      const audioPub = participant.audioTrackPublications.values().next().value;
      displays.push({
        id: participant.identity,
        name: participant.name || `User ${participant.identity}`,
        avatar: null, // Could be enhanced to fetch from API
        isSpeaking: participant.isSpeaking,
        isMuted: !audioPub || !audioPub.isSubscribed,
        audioLevel: participant.isSpeaking ? 0.5 : 0,
      });
    });

    participantDisplays = displays;
  }

  async function enableMicrophone() {
    if (!room) return;

    try {
      localAudioTrack = await room.localParticipant.setMicrophoneEnabled(true);
      isMuted = false;
      updateParticipantDisplays();
    } catch (err) {
      console.error('Failed to enable microphone:', err);
      error = 'Failed to enable microphone. Please check permissions.';
    }
  }

  async function toggleMute() {
    if (!room) return;

    try {
      isMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!isMuted);
      updateParticipantDisplays();
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  }

  async function toggleDeafen() {
    if (!room) return;

    try {
      isDeafened = !isDeafened;
      await room.localParticipant.setMicrophoneEnabled(!isDeafened && !isMuted);
      // Mute audio playback when deafened
      if (isDeafened) {
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((pub) => {
            if (pub.track) {
              (pub.track.attach(document.createElement('audio') as HTMLAudioElement) as HTMLAudioElement).muted = true;
            }
          });
        });
      }
    } catch (err) {
      console.error('Failed to toggle deafen:', err);
    }
  }

  async function disconnect() {
    if (room) {
      room.disconnect();
      room = null;
    }
    isConnected = false;
    participants.clear();
    participantDisplays = [];
    localAudioTrack = null;
  }

  onMount(() => {
    connectToRoom();
  });

  onDestroy(() => {
    disconnect();
  });
</script>

<div class="voice-room">
  <div class="voice-header">
    <div class="channel-info">
      <svg class="voice-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
      <h3>{channelName}</h3>
    </div>
    <button class="close-btn" on:click={disconnect}>×</button>
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if isConnecting}
    <div class="connecting">
      <div class="spinner"></div>
      <p>Connecting to voice channel...</p>
    </div>
  {:else if isConnected}
    <div class="voice-content">
      <div class="participants-grid">
        {#each participantDisplays as participant (participant.id)}
          <div class="participant-card" class:speaking={participant.isSpeaking} class:muted={participant.isMuted}>
            <div class="participant-avatar">
              {#if participant.avatar}
                <img src={participant.avatar} alt={participant.name} />
              {:else}
                <div class="avatar-placeholder">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
              {/if}
              {#if participant.isSpeaking}
                <div class="speaking-indicator"></div>
              {/if}
            </div>
            <div class="participant-info">
              <span class="participant-name">{participant.name}</span>
              {#if participant.isMuted}
                <svg class="mute-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="voice-controls">
        <button class="control-btn" class:muted={isMuted} on:click={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
          {#if isMuted}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          {/if}
        </button>
        <button class="control-btn" class:deafened={isDeafened} on:click={toggleDeafen} title={isDeafened ? 'Undeafen' : 'Deafen'}>
          {#if isDeafened}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2V6c0-1.1-.9-2-2-2zm8.78.28l-1.06 1.06c.84 1.18 1.28 2.57 1.28 4.06s-.44 2.88-1.28 4.06l1.06 1.06c1.17-1.54 1.78-3.36 1.78-5.12s-.61-3.58-1.78-5.12zM5.28 4.22l1.06 1.06C5.44 6.42 5 7.81 5 9.3s.44 2.88 1.28 4.06l-1.06 1.06C4.11 12.82 3.5 11 3.5 9.3s.61-3.58 1.78-5.08zm15.9 1.06l-1.06 1.06c.5.7.88 1.5 1.1 2.36l1.98-.4c-.3-1.1-.8-2.1-1.48-3.02zM4.28 5.28l1.06 1.06c-.7.92-1.18 1.92-1.48 3.02l1.98.4c.22-.86.6-1.66 1.1-2.36l-1.06-1.06zM12 16c-2.21 0-4-1.79-4-4v-1h8v1c0 2.21-1.79 4-4 4zm0 2c-1.1 0-2 .9-2 2v2h4v-2c0-1.1-.9-2-2-2z"/>
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          {/if}
        </button>
        <button class="control-btn disconnect" on:click={disconnect} title="Disconnect">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.5 7c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2-5c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm0 13c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4zm4.5-8c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-room {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a1a;
    color: #fff;
  }

  .voice-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #2a2a2a;
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .voice-icon {
    color: #7289da;
  }

  .voice-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #2a2a2a;
  }

  .error-message {
    padding: 1rem;
    background: #d32f2f;
    color: #fff;
    margin: 1rem;
    border-radius: 4px;
  }

  .connecting {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #2a2a2a;
    border-top-color: #7289da;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .voice-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .participants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .participant-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: #2a2a2a;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .participant-card.speaking {
    background: #7289da;
    box-shadow: 0 0 10px rgba(114, 137, 218, 0.5);
  }

  .participant-avatar {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .participant-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #7289da;
    font-size: 2rem;
    font-weight: bold;
  }

  .speaking-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    background: #43b581;
    border: 3px solid #2a2a2a;
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }

  .participant-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .participant-name {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .mute-icon {
    color: #f04747;
  }

  .voice-controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    border-top: 1px solid #2a2a2a;
  }

  .control-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: #2a2a2a;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .control-btn:hover {
    background: #3a3a3a;
  }

  .control-btn.muted {
    background: #f04747;
  }

  .control-btn.muted:hover {
    background: #d32f2f;
  }

  .control-btn.deafened {
    background: #f04747;
  }

  .control-btn.disconnect {
    background: #d32f2f;
  }

  .control-btn.disconnect:hover {
    background: #b71c1c;
  }
</style>

