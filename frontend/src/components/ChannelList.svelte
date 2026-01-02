<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Channel, Guild, User } from '../types';
  import { apiUrl } from '../lib/api';
  import { getAblyClient } from '../lib/ably';
  import CreateChannelModal from './CreateChannelModal.svelte';
  import Avatar from './Avatar.svelte';
  import ContextMenu from './ContextMenu.svelte';

  export let authToken: string | null = null;
  export let selectedGuildId: string | null = null;
  export let selectedChannelId: string | null = null;
  export let guilds: Guild[] = [];
  export let collapsed: boolean = false;
  export let currentUser: User | null = null;
  export let activeVoiceChannelId: string | null = null;
  export let channelSettingsVersion: number = 0; // Triggers reload when settings change

  const dispatch = createEventDispatcher<{
    selectChannel: { channelId: string; channelType?: 'text' | 'voice' };
    selectGuild: { guildId: string };
    channelCreated: { channel: Channel };
    openChannelSettings: { channel: Channel };
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
  
  // Channel creation modal state
  let showCreateChannelModal = false;
  let createChannelType: 'text' | 'voice' = 'text';
  
  // Context menu state
  let contextMenu: { x: number; y: number; channel: Channel } | null = null;
  
  // Ably channel subscription for real-time updates
  let ablyChannel: any = null;
  
  // Voice presence tracking - maps channelId to array of users in that channel
  let voicePresence: Map<string, VoiceUser[]> = new Map();
  let voicePresenceChannels: Map<string, any> = new Map();
  let presenceRefreshInterval: ReturnType<typeof setInterval> | null = null;
  
  // Reactive trigger for voice users - increments on ANY presence change to force re-render
  let voiceUsersTrigger = 0;
  
  // Also trigger when activeVoiceChannelId changes
  $: if (activeVoiceChannelId !== undefined) {
    voiceUsersTrigger++;
  }
  
  // Helper to increment trigger and force re-render of voice user lists
  function triggerVoicePresenceUpdate() {
    voiceUsersTrigger++;
    console.log('[VoicePresence] UI update triggered, count:', voiceUsersTrigger);
  }

  // Channel settings cache for backgrounds
  let channelBackgrounds: Map<string, string | null> = new Map();
  
  // Load channel background from localStorage
  function getChannelBackground(channelId: string): string | null {
    // Check cache first
    if (channelBackgrounds.has(channelId)) {
      return channelBackgrounds.get(channelId) || null;
    }
    
    try {
      const stored = localStorage.getItem(`channel_settings_${channelId}`);
      if (stored) {
        const settings = JSON.parse(stored);
        const bgUrl = settings.background_url || '';
        if (bgUrl.startsWith('http://') || bgUrl.startsWith('https://')) {
          channelBackgrounds.set(channelId, bgUrl);
          return bgUrl;
        }
      }
    } catch {
      // Ignore errors
    }
    channelBackgrounds.set(channelId, null);
    return null;
  }
  
  // Reload all channel backgrounds when settings version changes
  $: if (channelSettingsVersion >= 0) {
    channelBackgrounds = new Map(); // Clear cache to force reload
  }

  // Check if current user can edit channel (guild owner)
  function canEditChannel(): boolean {
    if (!currentUser || !selectedGuildId) return false;
    const guild = guilds.find(g => g.id === selectedGuildId);
    return guild?.owner_id === currentUser.id;
  }

  function handleChannelContextMenu(e: MouseEvent, channel: Channel) {
    e.preventDefault();
    if (canEditChannel()) {
      contextMenu = { x: e.clientX, y: e.clientY, channel };
    }
  }

  function handleContextMenuSelect(e: CustomEvent<{ action: string }>) {
    if (e.detail.action === 'settings' && contextMenu?.channel) {
      dispatch('openChannelSettings', { channel: contextMenu.channel });
    }
    contextMenu = null;
  }

  const channelMenuItems = [
    { 
      label: 'channel settings', 
      action: 'settings',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    }
  ];

  // Load view mode from localStorage on mount
  onMount(() => {
    // Refresh presence every 5 seconds to catch any missed updates
    presenceRefreshInterval = setInterval(() => {
      refreshVoicePresence();
    }, 5000);
  });
  
  // Refresh voice presence for all channels
  function refreshVoicePresence() {
    let anyChanges = false;
    
    voicePresenceChannels.forEach((presenceChannel, channelId) => {
      presenceChannel.presence.get({ waitForSync: true }).then((members: any[]) => {
        const users: VoiceUser[] = members.map((m: any) => ({
          id: m.clientId,
          username: m.data?.username || `User ${m.clientId.slice(0, 6)}`,
          avatar: m.data?.avatar || null,
        }));
        
        // Only update if there's a change
        const currentUsers = voicePresence.get(channelId) || [];
        const hasChanged = users.length !== currentUsers.length || 
          users.some((u, i) => currentUsers[i]?.id !== u.id);
        
        if (hasChanged) {
          console.log('[VoicePresence] 🔄 Refresh found changes for channel:', channelId, users.length, 'users');
          voicePresence.set(channelId, users);
          voicePresence = new Map(voicePresence);
          anyChanges = true;
          triggerVoicePresenceUpdate(); // Force UI re-render
        }
      }).catch((err: Error) => {
        // Ignore errors during refresh but log them
        console.warn('[VoicePresence] Refresh error for channel:', channelId, err);
      });
    });
  }

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
    
    // Clear presence refresh interval
    if (presenceRefreshInterval) {
      clearInterval(presenceRefreshInterval);
    }
    
    // Clear voice presence retry timeout
    if (voicePresenceRetryTimeout) {
      clearTimeout(voicePresenceRetryTimeout);
    }
  });

  // Subscribe to guild channels when guild changes
  $: if (selectedGuildId) {
    subscribeToGuildChannels(selectedGuildId);
  }
  
  // Subscribe to voice presence when voice channels change - use voiceChannels array directly for reactivity
  $: {
    if (voiceChannels && voiceChannels.length >= 0) {
      subscribeToVoicePresence(voiceChannels);
    }
  }
  
  // Retry subscribing to voice presence if Ably wasn't ready
  let voicePresenceRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Subscribe to voice channel presence for all voice channels
  function subscribeToVoicePresence(channels: Channel[]) {
    const client = getAblyClient();
    if (!client) {
      console.log('[VoicePresence] No Ably client available, will retry in 2 seconds...');
      // Retry after a delay if Ably isn't ready yet
      if (voicePresenceRetryTimeout) clearTimeout(voicePresenceRetryTimeout);
      voicePresenceRetryTimeout = setTimeout(() => {
        console.log('[VoicePresence] Retrying voice presence subscription...');
        subscribeToVoicePresence(channels);
      }, 2000);
      return;
    }
    
    // Clear retry timeout if we have a client
    if (voicePresenceRetryTimeout) {
      clearTimeout(voicePresenceRetryTimeout);
      voicePresenceRetryTimeout = null;
    }
    
    channels.forEach((channel) => {
      if (voicePresenceChannels.has(channel.id)) return; // Already subscribed
      
      console.log('[VoicePresence] Subscribing to presence for channel:', channel.id, channel.name);
      
      const presenceChannel = client.channels.get(`voice:${channel.id}`);
      voicePresenceChannels.set(channel.id, presenceChannel);
      
      // Handle user entering voice channel
      const handleEnter = (member: any) => {
        console.log('[VoicePresence] 🟢 User ENTERED:', member.clientId, member.data?.username, 'in channel:', channel.name);
        const users = voicePresence.get(channel.id) || [];
        if (!users.find(u => u.id === member.clientId)) {
          users.push({
            id: member.clientId,
            username: member.data?.username || `User ${member.clientId.slice(0, 6)}`,
            avatar: member.data?.avatar || null,
          });
          voicePresence.set(channel.id, [...users]);
          voicePresence = new Map(voicePresence);
          triggerVoicePresenceUpdate(); // Force UI re-render
        }
      };
      
      // Handle user leaving voice channel
      const handleLeave = (member: any) => {
        console.log('[VoicePresence] 🔴 User LEFT:', member.clientId, 'from channel:', channel.name);
        const users = voicePresence.get(channel.id) || [];
        const filtered = users.filter(u => u.id !== member.clientId);
        voicePresence.set(channel.id, filtered);
        voicePresence = new Map(voicePresence);
        triggerVoicePresenceUpdate(); // Force UI re-render
      };
      
      // Handle presence update (user data changed)
      const handleUpdate = (member: any) => {
        console.log('[VoicePresence] 🔄 User UPDATED:', member.clientId, member.data);
        const users = voicePresence.get(channel.id) || [];
        const idx = users.findIndex(u => u.id === member.clientId);
        if (idx >= 0) {
          users[idx] = {
            id: member.clientId,
            username: member.data?.username || `User ${member.clientId.slice(0, 6)}`,
            avatar: member.data?.avatar || null,
          };
          voicePresence.set(channel.id, [...users]);
          voicePresence = new Map(voicePresence);
          triggerVoicePresenceUpdate(); // Force UI re-render
        }
      };
      
      // Subscribe to all presence events BEFORE getting initial presence
      presenceChannel.presence.subscribe('enter', handleEnter);
      presenceChannel.presence.subscribe('present', handleEnter);
      presenceChannel.presence.subscribe('update', handleUpdate);
      presenceChannel.presence.subscribe('leave', handleLeave);
      
      // Get initial presence after subscribing to events
      presenceChannel.presence.get({ waitForSync: true }).then((members: any[]) => {
        console.log('[VoicePresence] 📋 Initial presence for', channel.name, ':', members.length, 'members');
        members.forEach(m => console.log('  -', m.clientId, m.data?.username));
        
        const users: VoiceUser[] = members.map((m) => ({
          id: m.clientId,
          username: m.data?.username || `User ${m.clientId.slice(0, 6)}`,
          avatar: m.data?.avatar || null,
        }));
        voicePresence.set(channel.id, users);
        voicePresence = new Map(voicePresence);
        triggerVoicePresenceUpdate(); // Force UI re-render with initial presence
      }).catch((err: Error) => {
        console.warn('[VoicePresence] Failed to get initial presence for', channel.name, err);
      });
    });
  }
  
  // Get users in a voice channel (including current user if they're connected)
  // The voiceUsersTrigger dependency ensures reactivity when activeVoiceChannelId changes
  function getVoiceUsers(channelId: string, _trigger?: number): VoiceUser[] {
    const presenceUsers = voicePresence.get(channelId) || [];
    
    // If current user is in this voice channel, make sure they're in the list
    if (activeVoiceChannelId === channelId && currentUser) {
      const currentUserInList = presenceUsers.find(u => u.id === currentUser.id);
      if (!currentUserInList) {
        return [
          {
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar || null,
          },
          ...presenceUsers
        ];
      }
    }
    
    return presenceUsers;
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
      // ChannelType: TEXT = 0, CATEGORY = 1, VOICE = 2
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

  // Admin email for channel deletion
  const ADMIN_EMAIL = 'sehnyaw@gmail.com';
  
  // Check if current user is admin
  $: isAdmin = currentUser?.email === ADMIN_EMAIL;
  
  // Delete channel (admin only)
  async function deleteChannel(channelId: string, channelName: string) {
    if (!authToken || !isAdmin) return;
    
    const confirmed = confirm(`Are you sure you want to delete the channel "${channelName}"? This action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete channel: ${response.status}`);
      }
      
      // Remove from local state
      textChannels = textChannels.filter(c => c.id !== channelId);
      voiceChannels = voiceChannels.filter(c => c.id !== channelId);
      
      // Broadcast deletion via Ably for other users
      const client = getAblyClient();
      if (client && selectedGuildId) {
        const guildChannel = client.channels.get(`guild:${selectedGuildId}:channels`);
        guildChannel.publish('channel.deleted', { channelId });
      }
      
      // If deleted channel was selected, clear selection
      if (selectedChannelId === channelId) {
        dispatch('selectChannel', { channelId: '', channelType: 'text' });
      }
      
    } catch (err) {
      console.error('Failed to delete channel:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete channel');
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
    <div class="guild-info">
      <h1 class="guild-name">
        {#if guilds.length > 0 && selectedGuildId}
          {(guilds.find(g => g.id === selectedGuildId)?.name || 'channels').toLowerCase()}
        {:else}
          channels
        {/if}
      </h1>
      <span class="channel-count">{allChannels.length} channels</span>
    </div>
  </header>

  <!-- Search -->
  <div class="search-wrapper">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21L16.65 16.65"/>
    </svg>
    <input type="text" placeholder="search channels" class="search-input" />
  </div>

  <div class="content">
    {#if error}
      <div class="status-message error">{error.toLowerCase()}</div>
    {:else if loading}
      <div class="status-message">loading...</div>
    {:else if !selectedGuildId}
      <div class="status-message">select a space to view channels</div>
    {:else if allChannels.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p>no channels yet</p>
        <button class="create-first-btn" on:click={() => openCreateChannelModal('text')}>
          create channel
        </button>
      </div>
    {:else}
      <!-- Text Channels Section -->
      <section class="channel-section">
        <button class="section-header" on:click={() => generalExpanded = !generalExpanded}>
          <svg class="chevron" class:expanded={generalExpanded} width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 18L15 12L9 6"/>
          </svg>
          <span class="section-label">text</span>
          <span class="section-count">{textChannels.length}</span>
          <button class="add-channel-btn" aria-label="Add text channel" on:click|stopPropagation={() => openCreateChannelModal('text')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5V19M5 12H19"/>
            </svg>
          </button>
        </button>
        
        {#if generalExpanded}
          <ul class="channel-items">
            {#each textChannels as channel}
              {@const bgUrl = selectedChannelId === channel.id ? getChannelBackground(channel.id) : null}
              <li>
                <button 
                  class="channel-btn"
                  class:active={selectedChannelId === channel.id}
                  class:has-bg={bgUrl}
                  on:click={() => dispatch('selectChannel', { channelId: channel.id, channelType: 'text' })}
                  on:contextmenu={(e) => handleChannelContextMenu(e, channel)}
                >
                  {#if bgUrl}
                    <img src={bgUrl} alt="" class="channel-bg-img" />
                    <span class="channel-bg-overlay"></span>
                  {/if}
                  <span class="channel-icon">#</span>
                  <span class="channel-name">{channel.name.toLowerCase()}</span>
                  {#if isAdmin}
                    <button 
                      class="delete-btn" 
                      aria-label="Delete channel"
                      on:click|stopPropagation={() => deleteChannel(channel.id, channel.name)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  {/if}
                </button>
              </li>
            {/each}
            {#if textChannels.length === 0}
              <li class="no-channels">no text channels</li>
            {/if}
          </ul>
        {/if}
      </section>

      <!-- Voice Channels Section -->
      <section class="channel-section">
        <button class="section-header" on:click={() => voiceExpanded = !voiceExpanded}>
          <svg class="chevron" class:expanded={voiceExpanded} width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 18L15 12L9 6"/>
          </svg>
          <span class="section-label">voice</span>
          <span class="section-count">{voiceChannels.length}</span>
          <button class="add-channel-btn" aria-label="Add voice channel" on:click|stopPropagation={() => openCreateChannelModal('voice')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5V19M5 12H19"/>
            </svg>
          </button>
        </button>
        
        {#if voiceExpanded}
          <ul class="channel-items">
            {#each voiceChannels as channel}
              {@const bgUrl = selectedChannelId === channel.id ? getChannelBackground(channel.id) : null}
              <li class="voice-item">
                <button 
                  class="channel-btn voice"
                  class:active={selectedChannelId === channel.id}
                  class:has-bg={bgUrl}
                  class:has-users={getVoiceUsers(channel.id, voiceUsersTrigger).length > 0}
                  on:click={() => dispatch('selectChannel', { channelId: channel.id, channelType: 'voice' })}
                  on:contextmenu={(e) => handleChannelContextMenu(e, channel)}
                >
                  {#if bgUrl}
                    <img src={bgUrl} alt="" class="channel-bg-img" />
                    <span class="channel-bg-overlay"></span>
                  {/if}
                  <svg class="channel-icon voice-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                    <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
                  </svg>
                  <span class="channel-name">{channel.name.toLowerCase()}</span>
                  {#if getVoiceUsers(channel.id, voiceUsersTrigger).length > 0}
                    <span class="voice-count">{getVoiceUsers(channel.id, voiceUsersTrigger).length}</span>
                  {/if}
                  {#if isAdmin}
                    <button 
                      class="delete-btn" 
                      aria-label="Delete channel"
                      on:click|stopPropagation={() => deleteChannel(channel.id, channel.name)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  {/if}
                </button>
                <!-- Users in voice channel -->
                {#if getVoiceUsers(channel.id, voiceUsersTrigger).length > 0}
                  <ul class="voice-users">
                    {#each getVoiceUsers(channel.id, voiceUsersTrigger) as user (user.id)}
                      <li class="voice-user">
                        <div class="user-avatar">
                          <Avatar 
                            userId={user.id} 
                            username={user.username} 
                            src={user.avatar} 
                            size={20} 
                          />
                          <span class="online-dot"></span>
                        </div>
                        <span class="user-name">{user.username.toLowerCase()}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
            {#if voiceChannels.length === 0}
              <li class="no-channels">no voice channels</li>
            {/if}
          </ul>
        {/if}
      </section>
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

<!-- Context Menu -->
{#if contextMenu}
  <ContextMenu 
    x={contextMenu.x} 
    y={contextMenu.y} 
    items={channelMenuItems}
    on:select={handleContextMenuSelect}
    on:close={() => contextMenu = null}
  />
{/if}

<style>
  .channel-list {
    display: flex;
    flex-direction: column;
    width: 260px;
    min-width: 260px;
    height: 100%;
    background: #050505;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: width 0.2s ease, min-width 0.2s ease;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .channel-list.collapsed {
    width: 0;
    min-width: 0;
    overflow: hidden;
  }

  /* Header */
  .header {
    padding: 20px 16px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .guild-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .guild-name {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .channel-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
  }

  /* Search */
  .search-wrapper {
    position: relative;
    padding: 0 12px;
    margin-bottom: 12px;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px 10px 34px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    transition: all 0.2s ease;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
  }

  .search-icon {
    position: absolute;
    left: 24px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.25);
    pointer-events: none;
  }

  /* Content */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 8px 16px;
  }

  .content::-webkit-scrollbar {
    width: 4px;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }

  .status-message {
    padding: 24px 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
  }

  .status-message.error {
    color: #ef4444;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.2);
  }

  .empty-state p {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }

  .create-first-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-first-btn:hover {
    background: #fff;
    color: #050505;
    border-color: #fff;
  }

  /* Channel Section */
  .channel-section {
    margin-bottom: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .section-header:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .chevron {
    color: rgba(255, 255, 255, 0.3);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .section-label {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.3px;
  }

  .section-count {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
  }

  .add-channel-btn {
    width: 18px;
    height: 18px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.25);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
    opacity: 0;
  }

  .section-header:hover .add-channel-btn {
    opacity: 1;
  }

  .add-channel-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  /* Channel Items */
  .channel-items {
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
  }

  .channel-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    transition: all 0.15s ease;
    position: relative;
    overflow: hidden;
  }

  .channel-btn.has-bg {
    color: #fff;
  }

  .channel-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
  }

  .channel-bg-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, rgba(5, 5, 5, 0.85) 0%, rgba(5, 5, 5, 0.6) 50%, rgba(5, 5, 5, 0.4) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .channel-btn.has-bg .channel-icon,
  .channel-btn.has-bg .channel-name,
  .channel-btn.has-bg .delete-btn,
  .channel-btn.has-bg .voice-icon,
  .channel-btn.has-bg .voice-count {
    position: relative;
    z-index: 2;
  }

  .channel-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.8);
  }

  .channel-btn.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .channel-icon {
    color: rgba(255, 255, 255, 0.3);
    font-weight: 500;
    font-size: 14px;
    flex-shrink: 0;
  }

  .channel-btn:hover .channel-icon,
  .channel-btn.active .channel-icon {
    color: rgba(255, 255, 255, 0.5);
  }

  .channel-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Voice Channel Styles */
  .voice-item {
    display: flex;
    flex-direction: column;
  }

  .channel-btn.voice .voice-icon {
    width: 14px;
    height: 14px;
  }

  .channel-btn.voice.has-users {
    color: rgba(255, 255, 255, 0.7);
  }

  .channel-btn.voice.has-users .voice-icon {
    color: #22c55e;
  }

  .voice-count {
    font-size: 10px;
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    padding: 2px 6px;
    border-radius: 8px;
    font-weight: 600;
  }

  /* Voice Users */
  .voice-users {
    list-style: none;
    padding: 0;
    margin: 2px 0 6px 22px;
    overflow: hidden;
  }

  .voice-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.15s ease, opacity 0.2s ease, transform 0.2s ease;
    animation: voiceUserEnter 0.25s ease-out forwards;
  }
  
  @keyframes voiceUserEnter {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .voice-user:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .user-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .online-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 8px;
    height: 8px;
    background: #22c55e;
    border: 2px solid #050505;
    border-radius: 50%;
  }

  .user-name {
    flex: 1;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-channels {
    padding: 8px 10px;
    color: rgba(255, 255, 255, 0.25);
    font-size: 12px;
    font-style: italic;
  }

  /* Delete Button */
  .delete-btn {
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
    opacity: 0;
    flex-shrink: 0;
    margin-left: auto;
  }

  .channel-btn:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }
</style>
