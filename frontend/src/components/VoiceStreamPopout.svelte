<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Track } from 'livekit-client';
  import Avatar from './Avatar.svelte';

  export let channelName: string;
  export let isMuted: boolean = false;
  export let isDeafened: boolean = false;
  export let isVideoEnabled: boolean = false;
  export let isLocalScreenSharing: boolean = false;
  export let focusedParticipantName: string = '';
  export let focusedParticipantId: string = '';
  export let focusedParticipantAvatar: string | null = null;
  export let isScreenSharing: boolean = false;
  export let videoTrack: Track | null = null;
  export let participantCount: number = 0;

  const dispatch = createEventDispatcher<{
    toggleMute: void;
    toggleDeafen: void;
    toggleVideo: void;
    toggleScreenShare: void;
    disconnect: void;
    expand: void;
    minimize: void;
  }>();

  // Draggable state
  let popoutElement: HTMLElement;
  let isDragging = false;
  let isMinimized = false;
  let dragOffset = { x: 0, y: 0 };
  let position = { x: 20, y: 20 }; // Start bottom-right (will be set on mount)
  
  // Video element ref
  let videoElement: HTMLVideoElement;
  
  // Attach video track when available
  $: if (videoElement && videoTrack) {
    videoTrack.attach(videoElement);
  }
  
  function handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.popout-controls')) return;
    isDragging = true;
    dragOffset = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    position = {
      x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 240, e.clientY - dragOffset.y)),
    };
  }
  
  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
  
  function toggleMinimize() {
    isMinimized = !isMinimized;
    if (isMinimized) {
      dispatch('minimize');
    }
  }
  
  onMount(() => {
    // Position in bottom-right corner initially
    position = {
      x: window.innerWidth - 380,
      y: window.innerHeight - 280,
    };
  });
  
  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (videoElement && videoTrack) {
      videoTrack.detach(videoElement);
    }
  });
</script>

<div 
  class="voice-stream-popout"
  class:minimized={isMinimized}
  class:dragging={isDragging}
  bind:this={popoutElement}
  style="left: {position.x}px; top: {position.y}px;"
  on:mousedown={handleMouseDown}
  role="dialog"
  aria-label="Voice stream popout"
>
  <!-- Header -->
  <header class="popout-header">
    <div class="header-info">
      <div class="live-badge" class:screen={isScreenSharing}>
        {#if isScreenSharing}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
        {:else}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        {/if}
        <span>LIVE</span>
      </div>
      <span class="channel-name">{channelName}</span>
      <span class="participant-count">{participantCount}</span>
    </div>
    <div class="header-actions">
      <button class="header-btn" on:click={toggleMinimize} title={isMinimized ? 'expand' : 'minimize'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if isMinimized}
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          {:else}
            <path d="M4 14h6v6M14 10h6V4M4 14l6-6M20 4l-6 6"/>
          {/if}
        </svg>
      </button>
      <button class="header-btn expand" on:click={() => dispatch('expand')} title="return to voice channel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Video Area -->
  {#if !isMinimized}
    <div class="video-container">
      {#if videoTrack}
        <video 
          class="stream-video"
          bind:this={videoElement}
          autoplay 
          playsinline
          muted
        ></video>
      {:else}
        <div class="avatar-fallback">
          <Avatar 
            userId={focusedParticipantId} 
            username={focusedParticipantName} 
            src={focusedParticipantAvatar} 
            size={80} 
          />
        </div>
      {/if}
      
      <!-- Streamer info overlay -->
      <div class="streamer-overlay">
        <span class="streamer-name">{focusedParticipantName}</span>
        {#if isScreenSharing}
          <span class="sharing-badge">sharing screen</span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Controls -->
  <footer class="popout-controls">
    <!-- Video toggle -->
    <button 
      class="control-btn"
      class:active={isVideoEnabled}
      on:click={() => dispatch('toggleVideo')}
      title={isVideoEnabled ? 'turn off camera' : 'turn on camera'}
    >
      {#if isVideoEnabled}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
        </svg>
      {/if}
    </button>
    
    <!-- Screen share toggle -->
    <button 
      class="control-btn"
      class:active={isLocalScreenSharing}
      on:click={() => dispatch('toggleScreenShare')}
      title={isLocalScreenSharing ? 'stop sharing' : 'share screen'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
      </svg>
    </button>
    
    <div class="control-divider"></div>
    
    <!-- Mute toggle -->
    <button 
      class="control-btn" 
      class:active={!isMuted}
      class:muted={isMuted}
      on:click={() => dispatch('toggleMute')}
      title={isMuted ? 'unmute' : 'mute'}
    >
      {#if isMuted}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      {/if}
    </button>
    
    <!-- Deafen toggle -->
    <button 
      class="control-btn"
      class:muted={isDeafened}
      on:click={() => dispatch('toggleDeafen')}
      title={isDeafened ? 'undeafen' : 'deafen'}
    >
      {#if isDeafened}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.65.49-1.38.88-2.18 1.11v2.06c1.34-.3 2.57-.92 3.61-1.75l2.05 2.05 1.41-1.41L4.34 2.93zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-1.88 1.88L12 7.76zm4.5 8c0-1.77-1.02-3.29-2.5-4.03v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
        </svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      {/if}
    </button>
    
    <div class="control-divider"></div>
    
    <!-- Disconnect -->
    <button 
      class="control-btn disconnect"
      on:click={() => dispatch('disconnect')}
      title="disconnect"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
      </svg>
    </button>
  </footer>
</div>

<style>
  .voice-stream-popout {
    position: fixed;
    z-index: 9999;
    width: 360px;
    background: rgba(10, 10, 10, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
    cursor: grab;
    user-select: none;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .voice-stream-popout.dragging {
    cursor: grabbing;
    opacity: 0.9;
  }

  .voice-stream-popout.minimized {
    width: 280px;
  }

  /* Header */
  .popout-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #ef4444;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .live-badge.screen {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
    color: #3b82f6;
  }

  .channel-name {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    text-transform: lowercase;
  }

  .participant-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .header-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .header-btn.expand:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Video Container */
  .video-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    overflow: hidden;
  }

  .stream-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
  }

  .streamer-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .streamer-name {
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    text-transform: lowercase;
  }

  .sharing-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    color: #93c5fd;
    text-transform: lowercase;
  }

  /* Controls */
  .popout-controls {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    cursor: default;
  }

  .control-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .control-btn.active {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .control-btn.muted {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .control-btn.disconnect {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.9);
    color: #0a0a0a;
  }

  .control-btn.disconnect:hover {
    background: #fff;
    border-color: #fff;
  }

  .control-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 4px;
    align-self: center;
  }

  /* Animation for appearing */
  @keyframes popout-appear {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .voice-stream-popout {
    animation: popout-appear 0.25s ease-out;
  }

  /* Mobile breakpoint */
  @media (max-width: 768px) {
    .voice-stream-popout {
      width: calc(100vw - 24px) !important;
      max-width: 100%;
      left: 12px !important;
      right: 12px !important;
      bottom: 80px !important;
      top: auto !important;
    }

    .popout-header {
      padding: 10px 12px;
    }

    .stream-info {
      gap: 8px;
    }

    .streamer-avatar {
      width: 28px;
      height: 28px;
    }

    .streamer-name {
      font-size: 12px;
    }

    .live-badge {
      font-size: 9px;
      padding: 2px 6px;
    }

    .header-controls {
      gap: 4px;
    }

    .header-btn {
      width: 28px;
      height: 28px;
    }

    .popout-controls {
      padding: 10px 12px;
      gap: 6px;
    }

    .control-btn {
      width: 36px;
      height: 36px;
    }

    .control-btn.disconnect {
      width: 44px;
      height: 36px;
    }
  }

  @media (max-width: 480px) {
    .voice-stream-popout {
      width: calc(100vw - 16px) !important;
      left: 8px !important;
      right: 8px !important;
    }

    .control-btn {
      width: 32px;
      height: 32px;
    }

    .control-btn svg {
      width: 16px;
      height: 16px;
    }
  }
</style>

