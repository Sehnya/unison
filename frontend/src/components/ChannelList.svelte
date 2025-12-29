<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Channel, Guild } from '../types';

  export let authToken: string | null = null;
  export let selectedGuildId: string | null = null;
  export let selectedChannelId: string | null = null;
  export let guilds: Guild[] = [];
  export let collapsed: boolean = false;

  const dispatch = createEventDispatcher<{
    selectChannel: { channelId: string };
    selectGuild: { guildId: string };
  }>();

  type ViewMode = 'list' | 'box' | 'icon';
  
  let textChannels: Channel[] = [];
  let voiceChannels: Channel[] = [];
  let loading = false;
  let error: string | null = null;
  let generalExpanded = true;
  let voiceExpanded = true;
  let viewMode: ViewMode = 'list';

  // Load view mode from localStorage on mount
  onMount(() => {
    const savedViewMode = localStorage.getItem('channelListViewMode');
    if (savedViewMode && ['list', 'box', 'icon'].includes(savedViewMode)) {
      viewMode = savedViewMode as ViewMode;
    }
  });

  // Save view mode to localStorage when it changes
  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    localStorage.setItem('channelListViewMode', mode);
  }

  // Load channels when guild changes
  $: if (selectedGuildId && authToken) {
    loadChannels();
  }

  async function loadChannels() {
    if (!selectedGuildId || !authToken) return;

    loading = true;
    error = null;

    try {
      const response = await fetch(`/api/guilds/${selectedGuildId}/channels`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          error = 'Unauthorized';
          return;
        }
        throw new Error(`Failed to load channels: ${response.status}`);
      }

      const data = await response.json();
      const allChannels: Channel[] = data.channels || [];

      // Separate text and voice channels
      textChannels = allChannels.filter(c => c.type === 'text' || !c.type);
      voiceChannels = allChannels.filter(c => c.type === 'voice');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load channels';
      textChannels = [];
      voiceChannels = [];
    } finally {
      loading = false;
    }
  }

  // Get all channels combined for box/icon views
  $: allChannels = [...textChannels, ...voiceChannels];

  function isVoiceChannel(channel: Channel): boolean {
    return channel.type === 'voice';
  }
</script>

<aside class="channel-list" class:collapsed>
  <!-- Header -->
  <header class="header">
    <div class="title-row">
      <h1 class="title">
        {#if guilds.length > 0 && selectedGuildId}
          {guilds.find(g => g.id === selectedGuildId)?.name || 'Channels'}
        {:else}
          Channels
        {/if}
      </h1>
      <button class="edit-btn" aria-label="Edit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"/>
          <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z"/>
        </svg>
      </button>
    </div>
    
    <!-- View Mode Toggle -->
    <div class="view-toggle">
      <button 
        class="view-btn" 
        class:active={viewMode === 'list'} 
        on:click={() => setViewMode('list')}
        aria-label="List view"
        title="List view"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
      <button 
        class="view-btn" 
        class:active={viewMode === 'box'} 
        on:click={() => setViewMode('box')}
        aria-label="Box view"
        title="Box view"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button 
        class="view-btn" 
        class:active={viewMode === 'icon'} 
        on:click={() => setViewMode('icon')}
        aria-label="Icon view"
        title="Icon view"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="5" cy="5" r="2"/>
          <circle cx="12" cy="5" r="2"/>
          <circle cx="19" cy="5" r="2"/>
          <circle cx="5" cy="12" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="19" cy="12" r="2"/>
          <circle cx="5" cy="19" r="2"/>
          <circle cx="12" cy="19" r="2"/>
          <circle cx="19" cy="19" r="2"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Search -->
  <div class="search-container">
    <input type="text" placeholder="Search channels..." class="search-input" />
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21L16.65 16.65"/>
    </svg>
  </div>

  <div class="content">
    {#if error}
      <div class="error-message">{error}</div>
    {:else if loading}
      <div class="loading-message">Loading channels...</div>
    {:else if !selectedGuildId}
      <div class="empty-state-message">Select a guild to view channels</div>
    {:else if allChannels.length === 0}
      <div class="empty-state-message">No channels in this guild</div>
    {:else}
      <!-- LIST VIEW -->
      {#if viewMode === 'list'}
        <!-- Text Channels Section -->
        <div class="section">
          <button class="section-header" on:click={() => generalExpanded = !generalExpanded}>
            <svg class="chevron" class:expanded={generalExpanded} width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 18L15 12L9 6"/>
            </svg>
            <span class="section-title">TEXT CHANNELS</span>
            <button class="add-btn" aria-label="Add channel" on:click|stopPropagation>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5V19M5 12H19"/>
              </svg>
            </button>
          </button>
          
          {#if generalExpanded}
            <ul class="channel-list-items">
              {#each textChannels as channel}
                <li>
                  <button 
                    class="channel-item"
                    class:active={selectedChannelId === channel.id}
                    on:click={() => dispatch('selectChannel', { channelId: channel.id })}
                  >
                    <span class="channel-hash">#</span>
                    <span class="channel-name">{channel.name}</span>
                  </button>
                </li>
              {/each}
              {#if textChannels.length === 0}
                <li class="empty-state">No text channels</li>
              {/if}
            </ul>
          {/if}
        </div>

        <!-- Voice Channels Section -->
        <div class="section">
          <button class="section-header" on:click={() => voiceExpanded = !voiceExpanded}>
            <svg class="chevron" class:expanded={voiceExpanded} width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 18L15 12L9 6"/>
            </svg>
            <span class="section-title">VOICE CHANNELS</span>
            <button class="add-btn" aria-label="Add voice channel" on:click|stopPropagation>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5V19M5 12H19"/>
              </svg>
            </button>
          </button>
          
          {#if voiceExpanded}
            <ul class="channel-list-items">
              {#each voiceChannels as channel}
                <li>
                  <button 
                    class="channel-item voice"
                    class:active={selectedChannelId === channel.id}
                    on:click={() => dispatch('selectChannel', { channelId: channel.id })}
                  >
                    <svg class="voice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                      <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
                      <path d="M12 19V23M8 23H16"/>
                    </svg>
                    <span class="channel-name">{channel.name}</span>
                  </button>
                </li>
              {/each}
              {#if voiceChannels.length === 0}
                <li class="empty-state">No voice channels</li>
              {/if}
            </ul>
          {/if}
        </div>

      <!-- BOX VIEW -->
      {:else if viewMode === 'box'}
        <div class="box-grid">
          {#each allChannels as channel}
            <button 
              class="box-item"
              class:active={selectedChannelId === channel.id}
              class:voice={isVoiceChannel(channel)}
              on:click={() => dispatch('selectChannel', { channelId: channel.id })}
            >
              <div class="box-icon">
                {#if isVoiceChannel(channel)}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                    <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
                    <path d="M12 19V23M8 23H16"/>
                  </svg>
                {:else}
                  <span class="box-hash">#</span>
                {/if}
              </div>
              <span class="box-name">{channel.name}</span>
              <span class="box-type">{isVoiceChannel(channel) ? 'Voice' : 'Text'}</span>
            </button>
          {/each}
        </div>

      <!-- ICON VIEW -->
      {:else if viewMode === 'icon'}
        <div class="icon-grid">
          {#each allChannels as channel}
            <button 
              class="icon-item"
              class:active={selectedChannelId === channel.id}
              class:voice={isVoiceChannel(channel)}
              on:click={() => dispatch('selectChannel', { channelId: channel.id })}
              title={channel.name}
            >
              {#if isVoiceChannel(channel)}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                  <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
                </svg>
              {:else}
                <span class="icon-hash">#</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Voice Status Bar -->
  <div class="voice-status">
    <div class="voice-info">
      <div class="voice-status-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
          <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
          <path d="M12 19V23M8 23H16"/>
        </svg>
      </div>
      <div class="voice-details">
        <span class="voice-label">Voice Connected</span>
        <span class="voice-channel">UI/UX - Society</span>
      </div>
    </div>
    <div class="voice-controls">
      <button class="voice-btn" aria-label="Mute">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
          <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </button>
      <button class="voice-btn" aria-label="Deafen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 18V12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12V18"/>
          <path d="M21 19C21 19.53 20.79 20.04 20.41 20.41C20.04 20.79 19.53 21 19 21H18C17.47 21 16.96 20.79 16.59 20.41C16.21 20.04 16 19.53 16 19V16C16 15.47 16.21 14.96 16.59 14.59C16.96 14.21 17.47 14 18 14H21V19Z"/>
          <path d="M3 19C3 19.53 3.21 20.04 3.59 20.41C3.96 20.79 4.47 21 5 21H6C6.53 21 7.04 20.79 7.41 20.41C7.79 20.04 8 19.53 8 19V16C8 15.47 7.79 14.96 7.41 14.59C7.04 14.21 6.53 14 6 14H3V19Z"/>
        </svg>
      </button>
    </div>
  </div>
</aside>

<style>
  .channel-list {
    display: flex;
    flex-direction: column;
    width: 280px;
    min-width: 280px;
    height: 100%;
    background: rgba(15, 15, 25, 0.95);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    transition: width 0.2s ease, min-width 0.2s ease;
  }

  .channel-list.collapsed {
    width: 0;
    min-width: 0;
    overflow: hidden;
  }

  /* Header */
  .header {
    padding: 20px 16px 12px;
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .title {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .edit-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* View Toggle */
  .view-toggle {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
    border-radius: 8px;
  }

  .view-btn {
    flex: 1;
    padding: 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .view-btn:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.05);
  }

  .view-btn.active {
    background: rgba(26, 54, 93, 0.5);
    color: #63b3ed;
  }

  /* Search */
  .search-container {
    position: relative;
    padding: 0 16px;
    margin-bottom: 16px;
  }

  .search-input {
    width: 100%;
    padding: 12px 40px 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    color: #fff;
    font-size: 14px;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(124, 58, 237, 0.5);
  }

  .search-icon {
    position: absolute;
    right: 28px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.35);
  }

  /* Content */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  .error-message, .loading-message, .empty-state-message {
    padding: 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .error-message {
    color: #ef4444;
  }

  /* Sections (List View) */
  .section {
    margin-bottom: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .chevron {
    color: rgba(255, 255, 255, 0.4);
    transition: transform 0.2s ease;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .section-title {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .add-btn {
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .add-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  /* Channel List (List View) */
  .channel-list-items {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .channel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .channel-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.85);
  }

  .channel-item.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .channel-hash {
    color: rgba(255, 255, 255, 0.35);
    font-weight: 500;
    font-size: 15px;
  }

  .channel-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .channel-item.voice {
    color: rgba(255, 255, 255, 0.55);
  }

  .voice-icon {
    color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  .empty-state {
    padding: 8px 12px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    font-style: italic;
  }

  /* Box View */
  .box-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 8px;
  }

  .box-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .box-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }

  .box-item.active {
    background: rgba(26, 54, 93, 0.3);
    border-color: rgba(49, 130, 206, 0.4);
  }

  .box-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
  }

  .box-item.voice .box-icon {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .box-hash {
    font-size: 22px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
  }

  .box-name {
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .box-type {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Icon View */
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 12px;
  }

  .icon-item {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    color: rgba(255, 255, 255, 0.5);
  }

  .icon-item:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .icon-item.active {
    background: rgba(26, 54, 93, 0.4);
    border-color: rgba(49, 130, 206, 0.5);
    color: #63b3ed;
  }

  .icon-item.voice {
    color: #22c55e;
  }

  .icon-hash {
    font-size: 18px;
    font-weight: 600;
  }

  /* Voice Status Bar */
  .voice-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(10, 10, 20, 0.8);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: auto;
  }

  .voice-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .voice-status-icon {
    color: #22c55e;
  }

  .voice-details {
    display: flex;
    flex-direction: column;
  }

  .voice-label {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
  }

  .voice-channel {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
  }

  .voice-controls {
    display: flex;
    gap: 8px;
  }

  .voice-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .voice-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }
</style>
