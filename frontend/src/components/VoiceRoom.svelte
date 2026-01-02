<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Room, RoomEvent, RemoteParticipant, LocalParticipant, TrackPublication, Track, ConnectionQuality, VideoPresets, type ScreenShareCaptureOptions } from 'livekit-client';
  import { KrispNoiseFilter } from '@livekit/krisp-noise-filter';
  import type { User } from '../types';
  import { apiUrl } from '../lib/api';
  import { getAblyClient } from '../lib/ably';
  import Avatar from './Avatar.svelte';

  export let channelId: string;
  export let channelName: string;
  export let authToken: string;
  export let currentUser: User | null = null;
  export let onDisconnect: () => void = () => {};
  export let hidden: boolean = false; // When true, component is mounted but not visible

  const dispatch = createEventDispatcher<{
    muteChange: { isMuted: boolean };
    deafenChange: { isDeafened: boolean };
    videoChange: { isVideoEnabled: boolean };
    screenShareChange: { isScreenSharing: boolean };
  }>();

  let room: Room | null = null;
  let isConnected = false;
  let isConnecting = false;
  let error: string | null = null;
  
  // Audio/Video state
  let isMuted = false;
  let isDeafened = false;
  let isVideoEnabled = false;
  let isScreenSharing = false;
  let outputVolume = 100;
  let inputVolume = 100;
  
  // Krisp noise cancellation
  let isKrispEnabled = true;
  let krispFilter: ReturnType<typeof KrispNoiseFilter> | null = null;
  
  // UI state
  let showSettings = false;
  let showParticipantList = true;
  let connectionQuality: ConnectionQuality = ConnectionQuality.Unknown;
  let localVideoElement: HTMLVideoElement | null = null;
  let screenShareElement: HTMLVideoElement | null = null;
  
  // Stage view state
  let focusedParticipantId: string | null = null;
  let speakersCollapsed = false;
  
  // Stream watching state - user must click to watch a stream and hear its audio
  let watchingStreamId: string | null = null;
  let streamAudioElements: Map<string, HTMLAudioElement> = new Map();
  
  // Video resolution options - defaults to 4K for highest quality, fallback to 1080p
  type VideoResolution = '4k' | '1080p' | '720p';
  let selectedResolution: VideoResolution = '4k';
  
  const resolutionPresets: Record<VideoResolution, { width: number; height: number; frameRate: number; bitrate: number }> = {
    '4k': { width: 3840, height: 2160, frameRate: 30, bitrate: 20_000_000 },   // 20 Mbps for pristine 4K
    '1080p': { width: 1920, height: 1080, frameRate: 30, bitrate: 8_000_000 }, // 8 Mbps for high quality 1080p fallback
    '720p': { width: 1280, height: 720, frameRate: 30, bitrate: 4_000_000 },   // 4 Mbps for 720p
  };
  
  // Ably presence channel
  let ablyPresenceChannel: any = null;
  
  // Presence sounds - play when users join/leave
  let joinSound: HTMLAudioElement | null = null;
  let leaveSound: HTMLAudioElement | null = null;
  
  // Initialize presence sounds
  function initPresenceSounds() {
    if (typeof window !== 'undefined') {
      joinSound = new Audio('/sounds/chat_in.wav');
      leaveSound = new Audio('/sounds/chat_out.wav');
      joinSound.volume = 0.5;
      leaveSound.volume = 0.5;
    }
  }
  
  // Play join sound (when someone enters the voice channel)
  function playJoinSound() {
    if (joinSound && !isDeafened) {
      joinSound.currentTime = 0;
      joinSound.play().catch(err => console.warn('Failed to play join sound:', err));
    }
  }
  
  // Play leave sound (when someone exits the voice channel)
  function playLeaveSound() {
    if (leaveSound && !isDeafened) {
      leaveSound.currentTime = 0;
      leaveSound.play().catch(err => console.warn('Failed to play leave sound:', err));
    }
  }
  
  // Expose methods for external control
  export function setMuted(muted: boolean) {
    if (muted !== isMuted) {
      toggleMute();
    }
  }
  
  export function setDeafened(deafened: boolean) {
    if (deafened !== isDeafened) {
      toggleDeafen();
    }
  }
  
  export function getState() {
    return { isMuted, isDeafened, isConnected };
  }
  
  // Expose stream state for popout view
  export function getStreamState() {
    const focused = focusedParticipant;
    const hasStream = participantDisplays.some(p => p.isVideoEnabled || p.isScreenSharing);
    
    return {
      hasActiveStream: hasStream,
      focusedParticipantId: focused?.id || null,
      focusedParticipantName: focused?.name || null,
      focusedParticipantAvatar: focused?.avatar || null,
      isScreenSharing: focused?.isScreenSharing || false,
      isVideoEnabled: focused?.isVideoEnabled || false,
      videoTrack: focused?.videoTrack || null,
      participantCount: participantDisplays.length,
    };
  }
  
  // Expose full state for mini panel controls
  export function getFullState() {
    return {
      isMuted,
      isDeafened,
      isVideoEnabled,
      isScreenSharing,
      isConnected,
      isKrispEnabled,
      participantCount: participantDisplays.length,
    };
  }
  
  // External control methods for mini panel
  export function setVideoEnabled(enabled: boolean) {
    if (enabled !== isVideoEnabled) {
      toggleVideo();
    }
  }
  
  export function setScreenSharing(enabled: boolean) {
    if (enabled !== isScreenSharing) {
      toggleScreenShare();
    }
  }

  // Participant display data
  interface ParticipantDisplay {
    id: string;
    name: string;
    avatar?: string | null;
    isSpeaking: boolean;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    hasScreenShareAudio: boolean;
    audioLevel: number;
    connectionQuality: ConnectionQuality;
    videoTrack?: Track;
    screenShareAudioTrack?: Track;
  }

  let participantDisplays: ParticipantDisplay[] = [];
  let speakingInterval: ReturnType<typeof setInterval> | null = null;
  
  // Computed: Get the focused participant (or auto-focus on screen sharer/speaker)
  $: focusedParticipant = (() => {
    // If someone is screen sharing, focus them
    const screenSharer = participantDisplays.find(p => p.isScreenSharing);
    if (screenSharer) return screenSharer;
    
    // If manually focused, use that
    if (focusedParticipantId) {
      const focused = participantDisplays.find(p => p.id === focusedParticipantId);
      if (focused) return focused;
    }
    
    // Otherwise focus on the first participant with video, or first participant
    const withVideo = participantDisplays.find(p => p.isVideoEnabled);
    if (withVideo) return withVideo;
    
    return participantDisplays[0] || null;
  })();
  
  // Computed: Get other participants (not focused)
  $: otherParticipants = participantDisplays.filter(p => p.id !== focusedParticipant?.id);
  
  // Computed: Check if anyone has video/screen share active (stage mode)
  $: hasActiveStream = participantDisplays.some(p => p.isVideoEnabled || p.isScreenSharing);
  
  // Focus on a specific participant
  function focusParticipant(participantId: string) {
    focusedParticipantId = participantId;
  }
  
  // Watch a stream (enables screen share audio)
  function watchStream(participantId: string) {
    // If already watching this stream, stop watching
    if (watchingStreamId === participantId) {
      stopWatchingStream();
      return;
    }
    
    // Stop watching previous stream
    if (watchingStreamId) {
      const prevAudio = streamAudioElements.get(watchingStreamId);
      if (prevAudio) {
        prevAudio.muted = true;
        prevAudio.pause();
      }
    }
    
    // Start watching new stream
    watchingStreamId = participantId;
    focusedParticipantId = participantId; // Also focus on them
    
    const audioElement = streamAudioElements.get(participantId);
    if (audioElement) {
      audioElement.muted = false;
      audioElement.play().catch(console.warn);
    }
    
    console.log(`🎬 Now watching stream from: ${participantId}`);
  }
  
  // Stop watching any stream
  function stopWatchingStream() {
    if (watchingStreamId) {
      const audioElement = streamAudioElements.get(watchingStreamId);
      if (audioElement) {
        audioElement.muted = true;
        audioElement.pause();
      }
    }
    watchingStreamId = null;
    console.log('🎬 Stopped watching stream');
  }
  
  // Enter Ably presence when connected
  async function enterAblyPresence() {
    const client = getAblyClient();
    if (!client || !currentUser) return;
    
    ablyPresenceChannel = client.channels.get(`voice:${channelId}`);
    try {
      await ablyPresenceChannel.presence.enter({
        username: currentUser.username,
        avatar: currentUser.avatar || null,
      });
    } catch (err) {
      console.warn('Failed to enter Ably presence:', err);
    }
  }
  
  // Leave Ably presence when disconnecting
  async function leaveAblyPresence() {
    if (!ablyPresenceChannel) return;
    try {
      await ablyPresenceChannel.presence.leave();
    } catch (err) {
      console.warn('Failed to leave Ably presence:', err);
    }
  }

  async function connectToRoom() {
    if (isConnecting || isConnected) return;

    isConnecting = true;
    error = null;
    
    // Initialize presence sounds
    initPresenceSounds();

    try {
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

      const currentPreset = resolutionPresets[selectedResolution];
      
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,        // Studio-quality 48kHz
          channelCount: 2,          // Stereo audio
        },
        audioOutput: {
          deviceId: 'default',
        },
        videoCaptureDefaults: {
          resolution: {
            width: currentPreset.width,
            height: currentPreset.height,
            frameRate: currentPreset.frameRate,
          },
        },
        publishDefaults: {
          audioPreset: {
            maxBitrate: 320_000, // 320 kbps - highest quality Opus audio for crystal-clear voice
          },
          videoCodec: 'vp9', // Better quality codec with superior compression
          videoSimulcastLayers: [
            { width: 640, height: 360, bitrate: 1_000_000, suffix: 'q' },    // Low quality layer
            { width: 1280, height: 720, bitrate: 4_000_000, suffix: 'h' },   // Medium quality layer (1080p fallback-ready)
            { width: 1920, height: 1080, bitrate: 8_000_000, suffix: 'm' },  // High quality 1080p layer
            { width: currentPreset.width, height: currentPreset.height, bitrate: currentPreset.bitrate, suffix: 'f' }, // Full quality layer (4K when selected)
          ],
          dtx: true, // Discontinuous transmission - saves bandwidth when not speaking
          red: true, // Redundant encoding for packet loss resilience
          screenShareEncoding: {
            maxBitrate: 15_000_000, // 15 Mbps for high-fidelity screen sharing
            maxFramerate: 30,
          },
          screenShareSimulcastLayers: [
            { width: 1280, height: 720, bitrate: 3_000_000, suffix: 'q' },
            { width: 1920, height: 1080, bitrate: 6_000_000, suffix: 'h' },
            { width: 3840, height: 2160, bitrate: 15_000_000, suffix: 'f' }, // 4K screen sharing
          ],
          // Screen share audio settings - highest quality for streaming games, music, videos
          screenShareAudioPreset: {
            maxBitrate: 320_000, // 320 kbps - highest quality stereo audio for streams
          },
        },
      });

      setupRoomListeners();
      await room.connect(wsUrl, token);
      isConnected = true;
      
      // Enter Ably presence so other users can see us in the channel list
      await enterAblyPresence();
      
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

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log(`🔊 ${participant.name || participant.identity} joined the voice channel`);
      playJoinSound();
      updateParticipantDisplays();
    });
    
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log(`🔇 ${participant.name || participant.identity} left the voice channel`);
      playLeaveSound();
      updateParticipantDisplays();
    });
    
    room.on(RoomEvent.TrackSubscribed, (track: Track, publication: TrackPublication, participant: RemoteParticipant | LocalParticipant) => {
      if (track.kind === 'audio') {
        // Check if this is screen share audio (from screen share source)
        const isScreenShareAudio = (publication as any).source === Track.Source.ScreenShareAudio;
        
        if (isScreenShareAudio) {
          // Screen share audio - auto-play for all participants in the voice channel
          // This allows everyone to hear the stream audio (games, music, videos, etc.)
          const audioElement = document.createElement('audio');
          audioElement.autoplay = true; // Auto-play stream audio for all participants
          (audioElement as any).playsInline = true;
          audioElement.volume = outputVolume / 100;
          audioElement.muted = isDeafened; // Only mute if user is deafened
          audioElement.dataset.participantId = participant.identity;
          audioElement.dataset.isScreenShare = 'true';
          track.attach(audioElement);
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          streamAudioElements.set(participant.identity, audioElement);
          
          // Attempt to play (may be blocked by browser autoplay policy)
          audioElement.play().catch((err) => {
            console.warn('Screen share audio autoplay blocked, will play on user interaction:', err);
            // If autoplay is blocked, try to play on next user interaction
            const playOnInteraction = () => {
              audioElement.play().catch(console.warn);
              document.removeEventListener('click', playOnInteraction);
              document.removeEventListener('keydown', playOnInteraction);
            };
            document.addEventListener('click', playOnInteraction, { once: true });
            document.addEventListener('keydown', playOnInteraction, { once: true });
          });
          
          console.log(`🔊 Screen share audio from ${participant.identity} is now playing`);
        } else {
          // Regular microphone audio - auto-play as normal
          const audioElement = document.createElement('audio');
          audioElement.autoplay = true;
          (audioElement as any).playsInline = true;
          audioElement.volume = outputVolume / 100;
          audioElement.muted = isDeafened; // Respect deafen state
          audioElement.dataset.participantId = participant.identity;
          track.attach(audioElement);
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
        }
      }
      updateParticipantDisplays();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
      const elements = track.detach();
      elements.forEach((el: any) => el.parentNode?.removeChild(el));
      updateParticipantDisplays();
    });

    room.on(RoomEvent.LocalTrackPublished, () => updateParticipantDisplays());
    room.on(RoomEvent.LocalTrackUnpublished, () => updateParticipantDisplays());
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => updateParticipantDisplays());
    
    room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality) => {
      connectionQuality = quality;
      updateParticipantDisplays();
    });

    room.on(RoomEvent.Disconnected, () => {
      isConnected = false;
      participantDisplays = [];
    });

    speakingInterval = setInterval(() => {
      if (room && isConnected) updateParticipantDisplays();
    }, 100);
  }

  function updateParticipantDisplays() {
    if (!room) return;

    const displays: ParticipantDisplay[] = [];

    if (room.localParticipant) {
      const lp = room.localParticipant;
      const videoPub = Array.from(lp.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.Camera);
      const screenPub = Array.from(lp.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.ScreenShare);
      const videoTrack = (videoPub as any)?.track;
      const screenTrack = (screenPub as any)?.track;
      
      displays.push({
        id: lp.identity,
        name: currentUser?.username || 'You',
        avatar: currentUser?.avatar || null,
        isSpeaking: lp.isSpeaking,
        isMuted: isMuted,
        isVideoEnabled: isVideoEnabled,
        isScreenSharing: isScreenSharing,
        hasScreenShareAudio: false, // Local user's screen share audio handled differently
        audioLevel: lp.isSpeaking ? 0.5 : 0,
        connectionQuality: lp.connectionQuality,
        videoTrack: videoTrack || screenTrack,
      });
    }

    room.remoteParticipants.forEach((participant: any) => {
      const videoPub = Array.from(participant.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.Camera);
      const screenPub = Array.from(participant.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.ScreenShare);
      const screenShareAudioPub = Array.from(participant.audioTrackPublications.values()).find((p: any) => p.source === Track.Source.ScreenShareAudio);
      const videoTrack = (videoPub as any)?.track;
      const screenTrack = (screenPub as any)?.track;
      const audioPub = participant.audioTrackPublications.values().next().value;
      
      displays.push({
        id: participant.identity,
        name: participant.name || `User ${participant.identity.slice(0, 8)}`,
        avatar: null,
        isSpeaking: participant.isSpeaking,
        isMuted: !audioPub || audioPub.isMuted,
        isVideoEnabled: !!videoTrack,
        isScreenSharing: !!screenTrack,
        hasScreenShareAudio: !!screenShareAudioPub,
        audioLevel: participant.isSpeaking ? 0.5 : 0,
        connectionQuality: participant.connectionQuality,
        videoTrack: videoTrack || screenTrack,
        screenShareAudioTrack: (screenShareAudioPub as any)?.track,
      });
    });

    participantDisplays = displays;
  }

  async function enableMicrophone() {
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      isMuted = false;
      
      // Apply Krisp noise cancellation to the audio track
      if (isKrispEnabled) {
        await applyKrispFilter();
      }
      
      updateParticipantDisplays();
    } catch (err) {
      console.error('Failed to enable microphone:', err);
      error = 'Failed to enable microphone. Please check permissions.';
    }
  }

  // Apply Krisp noise filter to local audio track
  async function applyKrispFilter() {
    if (!room) return;
    
    try {
      const audioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;
      if (audioTrack) {
        krispFilter = KrispNoiseFilter();
        await audioTrack.setProcessor(krispFilter as any);
        console.log('✓ Krisp noise cancellation enabled');
      }
    } catch (err) {
      console.warn('Failed to enable Krisp noise cancellation:', err);
      // Continue without Krisp - not a critical error
    }
  }

  // Toggle Krisp noise cancellation
  async function toggleKrisp() {
    if (!room) return;
    
    isKrispEnabled = !isKrispEnabled;
    
    try {
      const audioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;
      if (!audioTrack) return;
      
      if (isKrispEnabled) {
        krispFilter = KrispNoiseFilter();
        await audioTrack.setProcessor(krispFilter as any);
        console.log('✓ Krisp noise cancellation enabled');
      } else {
        await audioTrack.setProcessor(undefined as any);
        krispFilter = null;
        console.log('✗ Krisp noise cancellation disabled');
      }
    } catch (err) {
      console.error('Failed to toggle Krisp:', err);
      isKrispEnabled = !isKrispEnabled; // Revert on failure
    }
  }

  async function toggleMute() {
    if (!room) return;
    try {
      isMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!isMuted);
      dispatch('muteChange', { isMuted });
      updateParticipantDisplays();
    } catch (err) {
      console.error('Failed to toggle mute:', err);
      isMuted = !isMuted;
    }
  }

  async function toggleDeafen() {
    if (!room) return;
    try {
      isDeafened = !isDeafened;
      if (isDeafened) {
        await room.localParticipant.setMicrophoneEnabled(false);
        isMuted = true;
        dispatch('muteChange', { isMuted });
      }
      document.querySelectorAll('audio').forEach((el) => {
        el.muted = isDeafened;
      });
      dispatch('deafenChange', { isDeafened });
      updateParticipantDisplays();
    } catch (err) {
      console.error('Failed to toggle deafen:', err);
      isDeafened = !isDeafened;
    }
  }

  async function toggleVideo() {
    if (!room) return;
    try {
      isVideoEnabled = !isVideoEnabled;
      if (isVideoEnabled) {
        const currentPreset = resolutionPresets[selectedResolution];
        await room.localParticipant.setCameraEnabled(true, {
          resolution: {
            width: currentPreset.width,
            height: currentPreset.height,
            frameRate: currentPreset.frameRate,
          },
        });
        
        // Only update local participant's video track
        const lp = room.localParticipant;
        const videoPub = Array.from(lp.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.Camera);
        const newVideoTrack = (videoPub as any)?.track;
        
        participantDisplays = participantDisplays.map(p => {
          if (p.id === lp.identity) {
            return { ...p, videoTrack: newVideoTrack, isVideoEnabled: true };
          }
          return p;
        });
      } else {
        await room.localParticipant.setCameraEnabled(false);
        
        // Only update local participant
        const lp = room.localParticipant;
        participantDisplays = participantDisplays.map(p => {
          if (p.id === lp.identity) {
            return { ...p, videoTrack: undefined, isVideoEnabled: false };
          }
          return p;
        });
      }
      dispatch('videoChange', { isVideoEnabled });
    } catch (err) {
      console.error('Failed to toggle video:', err);
      isVideoEnabled = !isVideoEnabled;
      error = 'Failed to enable camera. Please check permissions.';
    }
  }

  async function changeResolution(newResolution: VideoResolution) {
    if (selectedResolution === newResolution) return;
    selectedResolution = newResolution;
    
    // If video is currently enabled, restart with new resolution
    if (room && isVideoEnabled) {
      try {
        const currentPreset = resolutionPresets[selectedResolution];
        
        // Disable and re-enable camera with new resolution
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setCameraEnabled(true, {
          resolution: {
            width: currentPreset.width,
            height: currentPreset.height,
            frameRate: currentPreset.frameRate,
          },
        });
        
        // Only update the local participant's video track, not all participants
        const lp = room.localParticipant;
        const videoPub = Array.from(lp.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.Camera);
        const newVideoTrack = (videoPub as any)?.track;
        
        // Update only the local participant in the displays array
        participantDisplays = participantDisplays.map(p => {
          if (p.id === lp.identity) {
            return { ...p, videoTrack: newVideoTrack };
          }
          return p;
        });
        
        console.log(`✓ Video resolution changed to ${newResolution}`);
      } catch (err) {
        console.error('Failed to change resolution:', err);
      }
    }
  }

  async function toggleScreenShare() {
    if (!room) return;
    try {
      isScreenSharing = !isScreenSharing;
      
      if (isScreenSharing) {
        // Enable screen share with system audio for highest quality streaming
        const screenShareOptions: ScreenShareCaptureOptions = {
          audio: {
            // Capture system audio (tab/window audio) - highest quality settings
            autoGainControl: false, // Disable AGC for authentic audio
            echoCancellation: false, // Disable echo cancellation for stream audio
            noiseSuppression: false, // Disable noise suppression for full audio fidelity
            sampleRate: 48000, // Studio-quality 48kHz sample rate
            channelCount: 2, // Stereo audio
          },
          video: {
            displaySurface: 'monitor', // Prefer full screen capture
          },
          // Prefer current tab audio (for browser-based content)
          preferCurrentTab: false,
          // Request system audio (for application audio)
          systemAudio: 'include',
          // Surface switching allows user to change what's being shared
          surfaceSwitching: 'include',
          // Self browser surface - include to allow sharing the current tab
          selfBrowserSurface: 'include',
        };
        
        await room.localParticipant.setScreenShareEnabled(true, screenShareOptions);
      } else {
        await room.localParticipant.setScreenShareEnabled(false);
      }
      
      // Only update local participant's screen share track
      const lp = room.localParticipant;
      const screenPub = Array.from(lp.videoTrackPublications.values()).find((p: any) => p.source === Track.Source.ScreenShare);
      const screenTrack = (screenPub as any)?.track;
      
      participantDisplays = participantDisplays.map(p => {
        if (p.id === lp.identity) {
          // If screen sharing, use screen track; otherwise use camera track
          const videoPub = Array.from(lp.videoTrackPublications.values()).find((pub: any) => pub.source === Track.Source.Camera);
          const videoTrack = (videoPub as any)?.track;
          return { 
            ...p, 
            videoTrack: screenTrack || videoTrack, 
            isScreenSharing 
          };
        }
        return p;
      });
      dispatch('screenShareChange', { isScreenSharing });
    } catch (err) {
      console.error('Failed to toggle screen share:', err);
      isScreenSharing = !isScreenSharing;
    }
  }

  function handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    outputVolume = parseInt(target.value);
    document.querySelectorAll('audio').forEach((el) => {
      el.volume = outputVolume / 100;
    });
    // Also update presence sound volumes
    if (joinSound) joinSound.volume = (outputVolume / 100) * 0.5;
    if (leaveSound) leaveSound.volume = (outputVolume / 100) * 0.5;
  }

  function getConnectionQualityLabel(quality: ConnectionQuality): string {
    switch (quality) {
      case ConnectionQuality.Excellent: return 'excellent';
      case ConnectionQuality.Good: return 'good';
      case ConnectionQuality.Poor: return 'poor';
      case ConnectionQuality.Lost: return 'lost';
      default: return 'unknown';
    }
  }

  function getConnectionQualityColor(quality: ConnectionQuality): string {
    switch (quality) {
      case ConnectionQuality.Excellent: return 'rgba(255, 255, 255, 0.9)';
      case ConnectionQuality.Good: return 'rgba(255, 255, 255, 0.7)';
      case ConnectionQuality.Poor: return 'rgba(255, 255, 255, 0.4)';
      case ConnectionQuality.Lost: return 'rgba(255, 255, 255, 0.2)';
      default: return 'rgba(255, 255, 255, 0.3)';
    }
  }

  // Generate a consistent color for a participant based on their ID
  function getParticipantColor(id: string): string {
    const colors = [
      'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
      'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
      'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.1) 100%)',
      'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    ];
    
    // Simple hash of the ID to pick a color
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  async function disconnect() {
    if (speakingInterval) clearInterval(speakingInterval);
    
    // Leave Ably presence first
    await leaveAblyPresence();
    
    if (room) {
      room.disconnect();
      room = null;
    }
    isConnected = false;
    participantDisplays = [];
    onDisconnect();
  }

  onMount(() => connectToRoom());
  
  // Note: We do NOT disconnect on destroy - the voice call should persist
  // until the user explicitly clicks disconnect. The component may be 
  // hidden/shown while staying connected.
  onDestroy(() => {
    // Only cleanup intervals, don't disconnect
    if (speakingInterval) {
      clearInterval(speakingInterval);
      speakingInterval = null;
    }
  });
</script>

<div class="voice-room" class:hidden>
  <!-- Header -->
  <header class="voice-header">
    <div class="channel-info">
      <div class="voice-icon-wrapper">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
          <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
          <path d="M12 19V23M8 23H16"/>
        </svg>
      </div>
      <div class="channel-details">
        <h3>{channelName}</h3>
        <span class="participant-count">{participantDisplays.length} participant{participantDisplays.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    
    <div class="header-actions">
      <!-- Connection Quality -->
      {#if isConnected}
        <div class="connection-quality" title="Connection: {getConnectionQualityLabel(connectionQuality)}">
          <div class="quality-bars">
            {#each [1, 2, 3, 4] as bar}
              <div 
                class="quality-bar" 
                class:active={Number(connectionQuality) >= bar}
                style="background-color: {Number(connectionQuality) >= bar ? getConnectionQualityColor(connectionQuality) : 'rgba(255,255,255,0.2)'}"
              ></div>
            {/each}
          </div>
        </div>
      {/if}
      
      <button class="icon-btn" on:click={() => showParticipantList = !showParticipantList} title="toggle participants">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </button>
      
      <button class="icon-btn" on:click={() => showSettings = !showSettings} title="settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Settings Panel -->
  {#if showSettings}
    <div class="settings-panel">
      <div class="settings-section">
        <span class="settings-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          output volume
        </span>
        <div class="volume-control">
          <input type="range" min="0" max="100" value={outputVolume} on:input={handleVolumeChange} aria-label="Output volume" />
          <span class="volume-value">{outputVolume}%</span>
        </div>
      </div>
      
      <!-- Krisp Noise Cancellation Toggle -->
      <div class="settings-section">
        <div class="krisp-toggle">
          <span class="settings-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
              <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
              <path d="M12 19V23M8 23H16"/>
            </svg>
            krisp noise cancellation
          </span>
          <button 
            class="toggle-btn" 
            class:active={isKrispEnabled}
            on:click={toggleKrisp}
            disabled={!isConnected}
            title={isKrispEnabled ? 'disable noise cancellation' : 'enable noise cancellation'}
          >
            <span class="toggle-slider"></span>
          </button>
        </div>
        <span class="settings-hint">ai-powered noise removal for crystal-clear audio</span>
      </div>
      
      <!-- Video Resolution Selector -->
      <div class="settings-section">
        <span class="settings-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          video quality
        </span>
        <div class="resolution-selector">
          <button 
            class="resolution-btn" 
            class:active={selectedResolution === '720p'}
            on:click={() => changeResolution('720p')}
          >
            720p
          </button>
          <button 
            class="resolution-btn" 
            class:active={selectedResolution === '1080p'}
            on:click={() => changeResolution('1080p')}
          >
            1080p
          </button>
          <button 
            class="resolution-btn" 
            class:active={selectedResolution === '4k'}
            on:click={() => changeResolution('4k')}
          >
            4K
          </button>
        </div>
        <span class="settings-hint">defaults to 4k · falls back to 1080p if bandwidth is limited</span>
      </div>
    </div>
  {/if}

  <!-- Error Message -->
  {#if error}
    <div class="error-banner">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = null}>×</button>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="voice-content">
    {#if isConnecting}
      <div class="connecting-state">
        <div class="pulse-ring"></div>
        <div class="connecting-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
            <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
          </svg>
        </div>
        <p>connecting to voice channel...</p>
      </div>
    {:else if isConnected}
      <!-- Stage Layout -->
      <div class="stage-layout" class:with-sidebar={showParticipantList}>
        <!-- Content wrapper for stage + speakers -->
        <div class="stage-content-wrapper">
          <!-- Main Stage Area (focused participant) -->
          {#if focusedParticipant}
            <div class="main-stage" class:has-stream={hasActiveStream}>
              <div class="stage-video-container" class:speaking={focusedParticipant.isSpeaking}>
                {#if focusedParticipant.videoTrack}
                  <video 
                    class="stage-video"
                    autoplay 
                    playsinline
                    muted={focusedParticipant.id === room?.localParticipant?.identity}
                    use:attachVideo={focusedParticipant.videoTrack}
                  ></video>
                {:else}
                  <div class="stage-avatar-wrapper">
                    <Avatar 
                      userId={focusedParticipant.id} 
                      username={focusedParticipant.name} 
                      src={focusedParticipant.avatar} 
                      size={160} 
                    />
                  </div>
                {/if}
                
                <!-- Stage Overlay -->
                <div class="stage-overlay">
                  <div class="stage-info">
                    <span class="stage-name">{focusedParticipant.name}</span>
                    {#if focusedParticipant.isScreenSharing}
                      <span class="stage-badge screen">screen sharing</span>
                    {/if}
                    {#if focusedParticipant.isMuted}
                      <span class="stage-badge muted">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        </svg>
                      </span>
                    {/if}
                  </div>
                </div>
                
                <!-- Speaking Ring -->
                {#if focusedParticipant.isSpeaking}
                  <div class="stage-speaking-ring"></div>
                {/if}
              </div>
            </div>
          {/if}
        
        <!-- Speakers Section (collapsible) -->
        <div class="speakers-section" class:collapsed={speakersCollapsed}>
          <button class="speakers-header" on:click={() => speakersCollapsed = !speakersCollapsed}>
            <div class="speakers-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
              </svg>
              <span>speakers - {participantDisplays.length}</span>
            </div>
            <svg class="collapse-icon" class:rotated={speakersCollapsed} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          
          {#if !speakersCollapsed}
            <div class="speakers-grid">
              {#each participantDisplays as participant (participant.id)}
                <button 
                  class="speaker-tile" 
                  class:speaking={participant.isSpeaking}
                  class:focused={participant.id === focusedParticipant?.id}
                  class:watching={watchingStreamId === participant.id}
                  on:click={() => participant.isScreenSharing ? watchStream(participant.id) : focusParticipant(participant.id)}
                >
                  <div class="speaker-avatar-container" class:has-video={participant.isVideoEnabled || participant.isScreenSharing}>
                    {#if participant.videoTrack}
                      <video 
                        class="speaker-video"
                        autoplay 
                        playsinline
                        muted={participant.id === room?.localParticipant?.identity}
                        use:attachVideo={participant.videoTrack}
                      ></video>
                    {:else}
                      <div class="speaker-avatar-bg" style="background: {getParticipantColor(participant.id)}">
                        <Avatar 
                          userId={participant.id} 
                          username={participant.name} 
                          src={participant.avatar} 
                          size={64} 
                        />
                      </div>
                    {/if}
                    
                    <!-- Screen sharing indicator -->
                    {#if participant.isScreenSharing}
                      <div class="stream-indicator" class:watching={watchingStreamId === participant.id}>
                        {#if watchingStreamId === participant.id}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                          </svg>
                        {:else}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                          </svg>
                        {/if}
                      </div>
                    {/if}
                    
                    <!-- Speaking indicator ring -->
                    {#if participant.isSpeaking}
                      <div class="speaker-ring"></div>
                    {/if}
                  </div>
                  
                  <div class="speaker-info">
                    <span class="speaker-name">{participant.name}</span>
                    {#if participant.isScreenSharing}
                      <span class="watch-label">{watchingStreamId === participant.id ? 'watching' : 'click to watch'}</span>
                    {:else if participant.isMuted}
                      <svg class="speaker-muted-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        </div><!-- End stage-content-wrapper -->

        <!-- Participant Sidebar -->
        {#if showParticipantList}
          <aside class="participant-sidebar">
            <h4>in voice — {participantDisplays.length}</h4>
            <ul class="participant-list">
              {#each participantDisplays as participant (participant.id)}
                <li class="participant-item" class:speaking={participant.isSpeaking}>
                  <Avatar 
                    userId={participant.id} 
                    username={participant.name} 
                    src={participant.avatar} 
                    size={32} 
                  />
                  <span class="name">{participant.name}</span>
                  <div class="status-icons">
                    {#if participant.isMuted}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    {/if}
                    {#if participant.isVideoEnabled}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </aside>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Control Bar -->
  <footer class="control-bar">
    <div class="control-group">
      <!-- Mute -->
      <button 
        class="control-btn" 
        class:active={!isMuted} 
        class:danger={isMuted}
        on:click={toggleMute} 
        title={isMuted ? 'unmute' : 'mute'}
        disabled={!isConnected}
      >
        {#if isMuted}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        {/if}
      </button>
      
      <!-- Deafen -->
      <button 
        class="control-btn" 
        class:danger={isDeafened}
        on:click={toggleDeafen} 
        title={isDeafened ? 'undeafen' : 'deafen'}
        disabled={!isConnected}
      >
        {#if isDeafened}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.65.49-1.38.88-2.18 1.11v2.06c1.34-.3 2.57-.92 3.61-1.75l2.05 2.05 1.41-1.41L4.34 2.93zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-1.88 1.88L12 7.76zm4.5 8c0-1.77-1.02-3.29-2.5-4.03v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
          </svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        {/if}
      </button>
    </div>

    <div class="control-group">
      <!-- Krisp Noise Cancellation -->
      <button 
        class="control-btn krisp-btn" 
        class:active={isKrispEnabled}
        on:click={toggleKrisp} 
        title={isKrispEnabled ? 'disable krisp noise cancellation' : 'enable krisp noise cancellation'}
        disabled={!isConnected}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        {#if isKrispEnabled}
          <span class="krisp-badge">ON</span>
        {/if}
      </button>
      
      <!-- Video -->
      <button 
        class="control-btn" 
        class:active={isVideoEnabled}
        on:click={toggleVideo} 
        title={isVideoEnabled ? 'turn off camera' : 'turn on camera'}
        disabled={!isConnected}
      >
        {#if isVideoEnabled}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
          </svg>
        {/if}
      </button>
      
      <!-- Screen Share -->
      <button 
        class="control-btn" 
        class:active={isScreenSharing}
        on:click={toggleScreenShare} 
        title={isScreenSharing ? 'stop sharing' : 'share screen'}
        disabled={!isConnected}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
        </svg>
      </button>
    </div>
    
    <div class="control-group">
      <!-- Disconnect -->
      <button 
        class="control-btn disconnect" 
        on:click={disconnect} 
        title="disconnect"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
        </svg>
      </button>
    </div>
  </footer>
</div>

<!-- Video attachment action - improved to prevent flickering -->

<script context="module" lang="ts">
  // Track cache to prevent re-attaching the same track
  const attachedTracks = new WeakMap<HTMLVideoElement, any>();
  
  function attachVideo(node: HTMLVideoElement, track: any | undefined) {
    // Prevent flickering by checking if track is already attached
    if (track && attachedTracks.get(node) !== track) {
      // Set video element properties to reduce flickering
      node.style.opacity = '0';
      node.style.transition = 'opacity 0.15s ease-in-out';
      
      track.attach(node);
      attachedTracks.set(node, track);
      
      // Fade in after track is attached
      requestAnimationFrame(() => {
        node.style.opacity = '1';
      });
    }
    
    return {
      update(newTrack: any | undefined) {
        const currentTrack = attachedTracks.get(node);
        
        // Only update if track actually changed
        if (currentTrack === newTrack) return;
        
        if (currentTrack) {
          currentTrack.detach(node);
        }
        
        if (newTrack) {
          // Smooth transition
          node.style.opacity = '0';
          newTrack.attach(node);
          attachedTracks.set(node, newTrack);
          
          requestAnimationFrame(() => {
            node.style.opacity = '1';
          });
        } else {
          attachedTracks.delete(node);
        }
      },
      destroy() {
        const currentTrack = attachedTracks.get(node);
        if (currentTrack) {
          currentTrack.detach(node);
          attachedTracks.delete(node);
        }
      }
    };
  }
</script>

<style>
  .voice-room {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #050505;
    color: #fff;
    flex: 1;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  .voice-room.hidden {
    /* Hidden state now handled by parent container in App.svelte */
    /* This class is no longer used for visibility */
  }

  /* Header */
  .voice-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .voice-icon-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
  }

  .channel-details h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: -0.01em;
  }

  .participant-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .connection-quality {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    margin-right: 6px;
  }

  .quality-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }

  .quality-bar {
    width: 3px;
    border-radius: 1px;
    transition: all 0.2s;
  }

  .quality-bar:nth-child(1) { height: 4px; }
  .quality-bar:nth-child(2) { height: 7px; }
  .quality-bar:nth-child(3) { height: 10px; }
  .quality-bar:nth-child(4) { height: 14px; }

  .icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  /* Settings Panel */
  .settings-panel {
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settings-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: lowercase;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .volume-control input[type="range"] {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    cursor: pointer;
  }

  .volume-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  .volume-value {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    min-width: 32px;
    text-align: right;
  }

  /* Krisp Toggle */
  .krisp-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
  }

  .toggle-btn {
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 2px;
  }

  .toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-btn.active {
    background: #fff;
    border-color: #fff;
  }

  .toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    transition: transform 0.2s ease;
  }

  .toggle-btn.active .toggle-slider {
    transform: translateX(18px);
    background: #050505;
  }

  .settings-hint {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    margin-top: 4px;
    text-transform: lowercase;
  }

  .settings-section + .settings-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* Resolution Selector */
  .resolution-selector {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .resolution-btn {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    text-transform: lowercase;
    font-family: inherit;
  }

  .resolution-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .resolution-btn.active {
    background: #fff;
    border-color: #fff;
    color: #050505;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    text-transform: lowercase;
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }

  .dismiss-btn:hover {
    color: #fff;
  }

  /* Main Content */
  .voice-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Connecting State */
  .connecting-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }

  .pulse-ring {
    position: absolute;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    animation: pulse-ring 1.5s ease-out infinite;
  }

  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  .connecting-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    position: relative;
    z-index: 1;
  }

  .connecting-state p {
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    text-transform: lowercase;
  }

  /* Participant Sidebar */
  .participant-sidebar {
    width: 220px;
    background: rgba(255, 255, 255, 0.02);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    padding: 16px;
    overflow-y: auto;
  }

  .participant-sidebar h4 {
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  .participant-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .participant-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .participant-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .participant-item.speaking {
    background: rgba(255, 255, 255, 0.06);
  }

  .participant-item .name {
    flex: 1;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: lowercase;
  }

  .status-icons {
    display: flex;
    gap: 4px;
  }

  /* Control Bar */
  .control-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .control-group {
    display: flex;
    gap: 6px;
  }

  .control-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn.active {
    background: #fff;
    border-color: #fff;
    color: #050505;
  }

  .control-btn.danger {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.6);
  }

  .control-btn.danger:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .control-btn.disconnect {
    background: #fff;
    border-color: #fff;
    color: #050505;
  }

  .control-btn.disconnect:hover {
    background: rgba(255, 255, 255, 0.9);
  }

  /* Krisp Button */
  .control-btn.krisp-btn {
    position: relative;
  }

  .control-btn.krisp-btn.active {
    background: #fff;
    border-color: #fff;
    color: #050505;
  }

  .control-btn.krisp-btn.active:hover {
    background: rgba(255, 255, 255, 0.9);
  }

  .krisp-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    font-size: 8px;
    font-weight: 600;
    background: #050505;
    color: #fff;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1;
    text-transform: lowercase;
  }

  .control-btn.krisp-btn.active .krisp-badge {
    background: #050505;
    color: #fff;
  }

  /* Stage Layout */
  .stage-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .stage-layout.with-sidebar {
    flex-direction: row;
  }

  /* Main content wrapper (stage + speakers) */
  .stage-layout.with-sidebar > .stage-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .stage-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Main Stage */
  .main-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    min-height: 200px;
    overflow: hidden;
  }

  .main-stage.has-stream {
    background: #000;
  }

  .stage-video-container {
    position: relative;
    width: 100%;
    max-width: 1200px;
    aspect-ratio: 16 / 9;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid transparent;
    transition: all 0.3s ease;
  }

  .stage-video-container.speaking {
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
  }

  .stage-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
    transition: opacity 0.15s ease-in-out;
    will-change: opacity;
  }

  .stage-avatar-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
  }

  .stage-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px 20px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  }

  .stage-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stage-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    text-transform: lowercase;
  }

  .stage-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    text-transform: lowercase;
  }

  .stage-badge.screen {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
  }

  .stage-badge.muted {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
  }

  .stage-speaking-ring {
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    animation: stage-pulse 1.5s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes stage-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(255, 255, 255, 0.2); }
    50% { opacity: 0.6; box-shadow: 0 0 40px rgba(255, 255, 255, 0.1); }
  }

  /* Speakers Section */
  .speakers-section {
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .speakers-section.collapsed {
    border-top: none;
  }

  .speakers-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 20px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .speakers-header:hover {
    background: rgba(255, 255, 255, 0.02);
    color: #fff;
  }

  .speakers-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  .collapse-icon {
    transition: transform 0.2s ease;
  }

  .collapse-icon.rotated {
    transform: rotate(180deg);
  }

  .speakers-grid {
    display: flex;
    gap: 10px;
    padding: 0 20px 16px;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .speakers-grid::-webkit-scrollbar {
    height: 5px;
  }

  .speakers-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .speakers-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* Speaker Tile */
  .speaker-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    min-width: 110px;
    background: none;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .speaker-tile:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .speaker-tile.focused {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .speaker-tile.speaking {
    background: rgba(255, 255, 255, 0.06);
  }

  .speaker-avatar-container {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
  }

  .speaker-avatar-container.has-video {
    border-radius: 8px;
  }

  .speaker-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.15s ease-in-out;
  }

  .speaker-avatar-bg {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }

  .speaker-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    animation: speaker-pulse 1s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes speaker-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .speaker-name {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 85px;
    text-transform: lowercase;
  }

  .speaker-muted-icon {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Stream watching styles */
  .speaker-tile.watching {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .stream-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
    color: #050505;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: stream-pulse 2s ease-in-out infinite;
  }

  .stream-indicator.watching {
    background: #fff;
    animation: none;
  }

  @keyframes stream-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .watch-label {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
    text-transform: lowercase;
  }

  .speaker-tile.watching .watch-label {
    color: #fff;
  }

  .speaker-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    max-width: 100%;
  }

  /* Participant Sidebar - fixed positioning */
  .stage-layout .participant-sidebar {
    width: 220px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.02);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    overflow-y: auto;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .speaker-tile {
      min-width: 90px;
      padding: 8px;
    }

    .speaker-avatar-container {
      width: 56px;
      height: 56px;
    }

    .speaker-name {
      font-size: 11px;
      max-width: 65px;
    }

    .stage-video-container {
      border-radius: 10px;
    }
    
    .stage-layout.with-sidebar {
      flex-direction: column;
    }
    
    .stage-layout .participant-sidebar {
      width: 100%;
      max-height: 180px;
      border-left: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
  }
</style>
