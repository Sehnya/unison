<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let channelName: string;
  export let isMuted: boolean = false;
  export let isDeafened: boolean = false;

  const dispatch = createEventDispatcher<{
    toggleMute: void;
    toggleDeafen: void;
    disconnect: void;
    expand: void;
  }>();
</script>

<div class="voice-mini-player">
  <button class="expand-btn" on:click={() => dispatch('expand')} title="Return to voice channel">
    <div class="channel-info">
      <div class="voice-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
          <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
        </svg>
      </div>
      <div class="details">
        <span class="status">Voice Connected</span>
        <span class="channel-name">{channelName}</span>
      </div>
    </div>
  </button>
  
  <div class="controls">
    <button 
      class="control-btn" 
      class:active={!isMuted}
      class:muted={isMuted}
      on:click={() => dispatch('toggleMute')}
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      {#if isMuted}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      {/if}
    </button>
    
    <button 
      class="control-btn"
      class:muted={isDeafened}
      on:click={() => dispatch('toggleDeafen')}
      title={isDeafened ? 'Undeafen' : 'Deafen'}
    >
      {#if isDeafened}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.65.49-1.38.88-2.18 1.11v2.06c1.34-.3 2.57-.92 3.61-1.75l2.05 2.05 1.41-1.41L4.34 2.93zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-1.88 1.88L12 7.76zm4.5 8c0-1.77-1.02-3.29-2.5-4.03v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
        </svg>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      {/if}
    </button>
    
    <button 
      class="control-btn disconnect"
      on:click={() => dispatch('disconnect')}
      title="Disconnect"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
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
    padding: 8px 12px;
    background: rgba(34, 197, 94, 0.1);
    border-top: 1px solid rgba(34, 197, 94, 0.2);
    gap: 8px;
  }

  .expand-btn {
    flex: 1;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .voice-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(34, 197, 94, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
  }

  .details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .status {
    font-size: 12px;
    font-weight: 600;
    color: #22c55e;
  }

  .channel-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .controls {
    display: flex;
    gap: 4px;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .control-btn.active {
    color: #22c55e;
  }

  .control-btn.muted {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .control-btn.disconnect {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .control-btn.disconnect:hover {
    background: rgba(239, 68, 68, 0.3);
  }
</style>
