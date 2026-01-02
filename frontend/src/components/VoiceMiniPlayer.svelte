<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let channelName: string;
  export let isMuted: boolean = false;
  export let isDeafened: boolean = false;
  export let isVideoEnabled: boolean = false;
  export let isScreenSharing: boolean = false;
  export let hasActiveStream: boolean = false;
  export let participantCount: number = 0;

  const dispatch = createEventDispatcher<{
    toggleMute: void;
    toggleDeafen: void;
    toggleVideo: void;
    toggleScreenShare: void;
    disconnect: void;
    expand: void;
    showPopout: void;
  }>();
</script>

<div class="voice-mini-player">
  <!-- Left section: Channel info -->
  <button class="expand-btn" on:click={() => dispatch('expand')} title="Return to voice channel">
    <div class="channel-info">
      <div class="voice-icon" class:streaming={hasActiveStream}>
        {#if hasActiveStream}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
            <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
          </svg>
        {/if}
      </div>
      <div class="details">
        <span class="status">
          {#if hasActiveStream}
            <span class="live-dot"></span>
            Live
          {:else}
            Voice Connected
          {/if}
        </span>
        <span class="channel-name">{channelName} · {participantCount}</span>
      </div>
    </div>
  </button>
  
  <!-- Right section: Controls -->
  <div class="controls">
    <!-- Show video popout button when there's an active stream -->
    {#if hasActiveStream}
      <button 
        class="control-btn show-video"
        on:click={() => dispatch('showPopout')}
        title="Show stream"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 7h-8v6h8V7zm4-4H1v17.98h22V3zm-2 16.01H3V4.98h18v14.03z"/>
        </svg>
      </button>
    {/if}
    
    <!-- Video toggle -->
    <button 
      class="control-btn"
      class:active={isVideoEnabled}
      on:click={() => dispatch('toggleVideo')}
      title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
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
      class:active={isScreenSharing}
      on:click={() => dispatch('toggleScreenShare')}
      title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
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
      title={isMuted ? 'Unmute' : 'Mute'}
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
      title={isDeafened ? 'Undeafen' : 'Deafen'}
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
      title="Disconnect"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .voice-mini-player {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px;
    background: rgba(5, 5, 5, 0.95);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    gap: 10px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .expand-btn {
    flex: 1;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 8px;
    transition: background 0.15s ease;
    min-width: 0;
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .voice-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .voice-icon.streaming {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    animation: pulse-stream 2s ease-in-out infinite;
  }

  @keyframes pulse-stream {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #22c55e;
    text-transform: lowercase;
    letter-spacing: -0.01em;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    animation: live-pulse 1.5s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.9); }
  }

  .channel-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 110px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .control-divider {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 2px;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  .control-btn.active {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .control-btn.muted {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .control-btn.disconnect {
    background: #fff;
    border-color: transparent;
    color: #0a0a0a;
  }

  .control-btn.disconnect:hover {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
  }

  .control-btn.show-video {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .control-btn.show-video:hover {
    background: rgba(59, 130, 246, 0.2);
  }
</style>
