<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Channel, Guild, User } from '../types';
  import { apiUrl } from '../lib/api';
  import { getAblyClient } from '../lib/ably';
  import CreateChannelModal from './CreateChannelModal.svelte';
  import Avatar from './Avatar.svelte';

  export let authToken: string | null = null;
  export let selectedGuildId: string | null = null;
  export let selectedChannelId: string | null = null;
  export let guilds: Guild[] = [];
  export let collapsed: boolean = false;
  export let currentUser: User | null = null;

  const dispatch = createEventDispatcher<{
    selectChannel: { channelId: string; channelType?: 'text' | 'voice' };
    selectGuild: { guildId: string };
    channelCreated: { channel: Channel };
  }>();

  type ViewMode = 'list' | 'box' | 'icon';
  
  // Voice presence user type
  interface VoiceUser {
    id: string;
    username: string;
    avatar?: string | null;
  }
  
  let textChannels: Channel[] = [];
  let voiceChannels: Channel[] = [];
  let loading = false;
  let error: string | null = null;
  let generalExpanded = true;
  let voiceExpanded = true;
  let viewMode: ViewMode = 'list';
  
  // Channel creation modal state
  let showCreateChannelModal = false;
  let createChannelType: 'text' | 'voice' = 'text';
  
  // Ably channel subscription for real-time updates
  let ablyChannel: any = null;
  
  // Voice presence tracking - maps channelId to array of users in that channel
  let voicePresence: Map<string, VoiceUser[]> = new Map();
  let voicePresenceChannels: Map<string, any> = new Map();

  // Load view mode from localStorage on mount
  onMount(() => {
    const savedViewMode = localStorage.getItem('channelListViewMode');
    if (savedViewMode && ['list', 'box', 'icon'].includes(savedViewMode)) {
      viewMode = savedViewMode as ViewMode;
    }
  });

  // Subscribe to guild channel updates via Ably
  function subscribeToGuildChannels(guildId: string) {
    const client = getAblyClient();
    if (!client) return;

    // Unsubscribe from previous guild
    if (ablyChannel) {
      ablyChannel.unsubscribe();
    }

    // Subscribe to channel events for this guild
    ablyChannel = client.channels.get(`guild:${guildId}:channels`);
    
    ablyChannel.subscribe('channel.created', (message: any) => {
      const newChannel: Channel = message.data;
      // Add to appropriate list if not already present
      if (newChannel.type === 'voice') {
        if (!voiceChannels.find(c => c.id === newChannel.id)) {
          voiceChannels = [...voiceChannels, newChannel];
        }
      } else {
        if (!textChannels.find(c => c.id === newChannel.id)) {
          textChannels = [...textChannels, newChannel];
        }
      }
    });

    ablyChannel.subscribe('channel.deleted', (message: any) => {
      const { channelId } = message.data;
      textChannels = textChannels.filter(c => c.id !== channelId);
      voiceChannels = voiceChannels.filter(c => c.id !== channelId);
    });
  }

  // Cleanup Ably subscription on destroy
  onDestroy(() => {
    if (ablyChannel) {
      ablyChannel.unsubscribe();
    }
    // Cleanup voice presence subscriptions
    voicePresenceChannels.forEach((channel) => {
      try {
        channel.presence.unsubscribe();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    voicePresenceChannels.clear();
  });

  // Subscribe to guild channels when guild changes
  $: if (selectedGuildId) {
    subscribeToGuildChannels(selectedGuildId);
  }
  
  // Subscribe to voice presence when voice channels change
  $: if (voiceChannels.length > 0) {
    subscribeToVoicePresence();
  }
  
  // Subscribe to voice channel presence for all voice channels
  function subscribeToVoicePresence() {
    const client = getAblyClient();
    if (!client) return;
    
    voiceChannels.forEach((channel) => {
      if (voicePresenceChannels.has(channel.id)) return; // Already subscribed
      
      const presenceChannel = client.channels.get(`voice:${channel.id}`);
      voicePresenceChannels.set(channel.id, presenceChannel);
      
      // Get initial presence
      presenceChannel.presence.get().then((members: any[]) => {
        const users: VoiceUser[] = members.map((m) => ({
          id: m.clientId,
          username: m.data?.username || `User ${m.clientId.slice(0, 6)}`,
          avatar: m.data?.avatar || null,
        }));
        voicePresence.set(channel.id, users);
        voicePresence = new Map(voicePresence); // Trigger reactivity
      }).catch(() => {
        // Channel might not exist yet, that's ok
      });
      
      // Subscribe to presence changes
      presenceChannel.presence.subscribe('enter', (member: any) => {
        const users = voicePresence.get(channel.id) || [];
        if (!users.find(u => u.id === member.clientId)) {
          users.push({
            id: member.clientId,
            username: member.data?.username || `User ${member.clientId.slice(0, 6)}`,
            avatar: member.data?.avatar || null,
          });
          voicePresence.set(channel.id, users);
          voicePresence = new Map(voicePresence);
        }
      });
      
      presenceChannel.presence.subscribe('leave', (member: any) => {
        const users = voicePresence.get(channel.id) || [];
        const filtered = users.filter(u => u.id !== member.clientId);
        voicePresence.set(channel.id, filtered);
        voicePresence = new Map(voicePresence);
      });
    });
  }
  
  // Get users in a voice channel
  function getVoiceUsers(channelId: string): VoiceUser[] {
    return voicePresence.get(channelId) || [];
  }

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
      const response = await fetch(apiUrl(`/api/guilds/${selectedGuildId}/channels`), {
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
      const rawChannels = data.channels || [];
      
      // Map numeric types to string types
      const allChannels: Channel[] = rawChannels.map((c: any) => ({
        ...c,
        type: c.type === 2 ? 'voice' : 'text'
      }));

      // Separate text and voice channels
      textChannels = allChannels.filter(c => c.type === 'text');
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

  function openCreateChannelModal(type: 'text' | 'voice') {
    createChannelType = type;
    showCreateChannelModal = true;
  }

  async function handleCreateChannel(event: CustomEvent<{ name: string; type: 'text' | 'voice' }>) {
    if (!selectedGuildId || !authToken) return;

    const { name, type } = event.detail;

    try {
      const response = await fetch(apiUrl(`/api/guilds/${selectedGuildId}/channels`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          type: type === 'voice' ? 'voice' : 'TEXT',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create channel: ${response.status}`);
      }

      const data = await response.json();
      // Map numeric type to string type
      const newChannel: Channel = {
        ...data.channel,
        type: type // Use the type we passed in since we know it
      };

      // Add to appropriate list
      if (type === 'voice') {
        voiceChannels = [...voiceChannels, newChannel];
      } else {
        textChannels = [...textChannels, newChannel];
      }

      // Broadcast channel creation via Ably for other users
      const client = getAblyClient();
      if (client && selectedGuildId) {
        const guildChannel = client.channels.get(`guild:${selectedGuildId}:channels`);
        guildChannel.publish('channel.created', newChannel);
      }

      // Close modal
      showCreateChannelModal = false;

      // Dispatch event for parent components
      dispatch('channelCreated', { channel: newChannel });

      // Auto-select the new channel
      dispatch('selectChannel', { channelId: newChannel.id, channelType: type });

    } catch (err) {
      console.error('Failed to create channel:', err);
      // Keep modal open so user can see error or retry
      alert(err instanceof Error ? err.message : 'Failed to create channel');
    }
  }

  // Expose loadChannels for external refresh
  export function refreshChannels() {
    loadChannels();
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
            <button class="add-btn" aria-label="Add channel" on:click|stopPropagation={() => openCreateChannelModal('text')}>
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
                    on:click={() => dispatch('selectChannel', { channelId: channel.id, channelType: channel.type })}
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
            <button class="add-btn" aria-label="Add voice channel" on:click|stopPropagation={() => openCreateChannelModal('voice')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5V19M5 12H19"/>
              </svg>
            </button>
          </button>
          
          {#if voiceExpanded}
            <ul class="channel-list-items">
              {#each voiceChannels as channel}
                <li class="voice-channel-wrapper">
                  <button 
                    class="channel-item voice"
                    class:active={selectedChannelId === channel.id}
                    class:has-users={getVoiceUsers(channel.id).length > 0}
                    on:click={() => dispatch('selectChannel', { channelId: channel.id, channelType: channel.type })}
                  >
                    <svg class="voice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                      <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
                      <path d="M12 19V23M8 23H16"/>
                    </svg>
                    <span class="channel-name">{channel.name}</span>
                    {#if getVoiceUsers(channel.id).length > 0}
                      <span class="user-count">{getVoiceUsers(channel.id).length}</span>
                    {/if}
                  </button>
                  <!-- Users in voice channel -->
                  {#if getVoiceUsers(channel.id).length > 0}
                    <ul class="voice-users">
                      {#each getVoiceUsers(channel.id) as user (user.id)}
                        <li class="voice-user">
                          <Avatar 
                            userId={user.id} 
                            username={user.username} 
                            src={user.avatar} 
                            size={24} 
                          />
                          <span class="voice-user-name">{user.username}</span>
                          <div class="voice-user-status">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            </svg>
                          </div>
                        </li>
                      {/each}
                    </ul>
                  {/if}
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
              on:click={() => dispatch('selectChannel', { channelId: channel.id, channelType: channel.type })}
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
              on:click={() => dispatch('selectChannel', { channelId: channel.id, channelType: channel.type })}
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

</aside>

<!-- Create Channel Modal -->
<CreateChannelModal 
  isOpen={showCreateChannelModal}
  channelType={createChannelType}
  on:close={() => showCreateChannelModal = false}
  on:create={handleCreateChannel}
/>

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

  .channel-item.voice.has-users {
    color: #22c55e;
  }

  .voice-icon {
    color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  .channel-item.voice.has-users .voice-icon {
    color: #22c55e;
  }

  .user-count {
    font-size: 11px;
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  /* Voice channel wrapper for users list */
  .voice-channel-wrapper {
    display: flex;
    flex-direction: column;
  }

  /* Voice users list */
  .voice-users {
    list-style: none;
    padding: 0;
    margin: 0 0 4px 0;
    padding-left: 24px;
  }

  .voice-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .voice-user:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .voice-user-name {
    flex: 1;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .voice-user-status {
    display: flex;
    align-items: center;
    color: #22c55e;
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
</style>
