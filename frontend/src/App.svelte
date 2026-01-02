<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import LandingPage from './components/LandingPage.svelte';
  import LoginForm from './components/LoginForm.svelte';
  import RegisterForm from './components/RegisterForm.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ChannelList from './components/ChannelList.svelte';
  import ChatArea from './components/ChatArea.svelte';
  import VoiceRoom from './components/VoiceRoom.svelte';
  import VoiceMiniPlayer from './components/VoiceMiniPlayer.svelte';
  import VoiceStreamPopout from './components/VoiceStreamPopout.svelte';
  import GroupInfo from './components/GroupInfo.svelte';
  import UserProfile from './components/UserProfile.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import DirectMessageChat from './components/DirectMessageChat.svelte';
  import InboxPanel from './components/InboxPanel.svelte';
  import ComposeMessageModal from './components/ComposeMessageModal.svelte';
  import CreateGuildModal from './components/CreateGuildModal.svelte';
  import HomeDashboard from './components/HomeDashboard.svelte';
  import BetaWelcomeModal from './components/BetaWelcomeModal.svelte';
  import ProfileSetupModal from './components/ProfileSetupModal.svelte';
  import MiniPlayer from './components/MiniPlayer.svelte';
  import GuildSettingsModal from './components/GuildSettingsModal.svelte';
  import ChannelSettingsModal from './components/ChannelSettingsModal.svelte';
  import type { User, Guild, Channel, DMConversation } from './types';
  import { authStorage } from './utils/storage';
  import { hasPlaylist } from './lib/musicStore';
  import { parseRoute, navigateToGuild, navigateToChannel, navigateToDashboard, navigateToMyspace, navigateToSettings, navigateToHome } from './utils/router';
  import { apiUrl } from './lib/api';
  import { initAblyWithUser, closeAbly } from './lib/ably';

  $: hasMusicPlaying = $hasPlaylist;


  let authToken: string | null = null;
  let showRegister: boolean = false;
  let showAuthModal: boolean = false; // Show login/register modal over landing page
  let showGroupInfo: boolean = false;
  let selectedGuildId: string | null = null;
  let selectedChannelId: string | null = null;
  let selectedChannelType: 'text' | 'voice' | null = null;
  let selectedChannelName: string | null = null;
  let currentUser: User | null = null;
  let guilds: Guild[] = [];
  let loading = true;
  let channelListCollapsed = false;
  let showUserProfile = false;
  let showSettings = false;
  let selectedSection = 'main';
  let showCreateGuildModal = false;
  let showBetaModal = false;
  let showProfileSetup = false;
  let viewedUser: User | null = null; // User being viewed (when clicking on someone's name in chat)
  
  // Inbox/DM state
  let showInbox = false;
  let showComposeModal = false;
  let selectedConversation: DMConversation | null = null;
  let unreadDMCount = 0;
  
  // Guild and Channel settings modals
  let showGuildSettingsModal = false;
  let guildToEdit: Guild | null = null;
  let showChannelSettingsModal = false;
  let channelToEdit: Channel | null = null;
  let channelSettingsVersion = 0; // Increments when channel settings are saved to trigger ChatArea reload
  // Voice call state - separate from selected channel so call persists during navigation
  let activeVoiceCallChannelId: string | null = null;
  let activeVoiceCallChannelName: string | null = null;
  let activeVoiceCallGuildId: string | null = null;
  
  // Voice call UI state (controlled from VoiceRoom or MiniPlayer)
  let voiceIsMuted: boolean = false;
  let voiceIsDeafened: boolean = false;
  let voiceIsVideoEnabled: boolean = false;
  let voiceIsScreenSharing: boolean = false;
  let voiceRoomRef: VoiceRoom | null = null;
  
  // Stream popout state - tracks active video/screen share for popout view
  let streamState: {
    hasActiveStream: boolean;
    focusedParticipantId: string | null;
    focusedParticipantName: string | null;
    focusedParticipantAvatar: string | null;
    isScreenSharing: boolean;
    isVideoEnabled: boolean;
    videoTrack: any | null;
    participantCount: number;
  } = {
    hasActiveStream: false,
    focusedParticipantId: null,
    focusedParticipantName: null,
    focusedParticipantAvatar: null,
    isScreenSharing: false,
    isVideoEnabled: false,
    videoTrack: null,
    participantCount: 0,
  };
  let streamStateInterval: ReturnType<typeof setInterval> | null = null;
  let showStreamPopout: boolean = true; // Default to showing popout when there's a stream
  
  // Computed: is user viewing the active voice call channel?
  $: isViewingVoiceCall = selectedChannelId === activeVoiceCallChannelId && selectedChannelType === 'voice';
  $: hasActiveVoiceCall = activeVoiceCallChannelId !== null;
  
  // Computed: should show stream popout (when navigating away from voice with active video/screen)
  $: shouldShowStreamPopout = hasActiveVoiceCall && !isViewingVoiceCall && streamState.hasActiveStream && showStreamPopout;
  $: shouldShowMiniPlayer = hasActiveVoiceCall && !isViewingVoiceCall && !shouldShowStreamPopout;
  
  // Poll stream state from VoiceRoom when in a call
  function updateStreamState() {
    if (voiceRoomRef) {
      streamState = voiceRoomRef.getStreamState();
      // Also update local user's video/screen share state
      const fullState = voiceRoomRef.getFullState();
      voiceIsVideoEnabled = fullState.isVideoEnabled;
      voiceIsScreenSharing = fullState.isScreenSharing;
    }
  }
  
  // Start/stop polling when voice call state changes
  $: if (hasActiveVoiceCall && !isViewingVoiceCall) {
    // Start polling stream state when navigating away
    if (!streamStateInterval) {
      streamStateInterval = setInterval(updateStreamState, 500);
      updateStreamState(); // Initial update
    }
  } else {
    // Stop polling when viewing voice call or no call
    if (streamStateInterval) {
      clearInterval(streamStateInterval);
      streamStateInterval = null;
    }
  }
  
  // Handle disconnecting from voice call
  function handleVoiceDisconnect() {
    activeVoiceCallChannelId = null;
    activeVoiceCallChannelName = null;
    activeVoiceCallGuildId = null;
    voiceIsMuted = false;
    voiceIsDeafened = false;
    voiceIsVideoEnabled = false;
    voiceIsScreenSharing = false;
    showStreamPopout = true; // Reset for next call
    streamState = {
      hasActiveStream: false,
      focusedParticipantId: null,
      focusedParticipantName: null,
      focusedParticipantAvatar: null,
      isScreenSharing: false,
      isVideoEnabled: false,
      videoTrack: null,
      participantCount: 0,
    };
    if (streamStateInterval) {
      clearInterval(streamStateInterval);
      streamStateInterval = null;
    }
  }
  
  // Navigate back to the voice channel
  function expandVoiceCall() {
    if (activeVoiceCallChannelId && activeVoiceCallGuildId) {
      selectedGuildId = activeVoiceCallGuildId;
      selectedChannelId = activeVoiceCallChannelId;
      selectedChannelType = 'voice';
      selectedChannelName = activeVoiceCallChannelName;
      showStreamPopout = true; // Reset popout preference when expanding
    }
  }
  
  // Toggle mute from mini player
  function handleMiniPlayerToggleMute() {
    voiceIsMuted = !voiceIsMuted;
    if (voiceRoomRef) {
      voiceRoomRef.setMuted(voiceIsMuted);
    }
  }
  
  // Toggle deafen from mini player
  function handleMiniPlayerToggleDeafen() {
    voiceIsDeafened = !voiceIsDeafened;
    if (voiceIsDeafened) voiceIsMuted = true;
    if (voiceRoomRef) {
      voiceRoomRef.setDeafened(voiceIsDeafened);
    }
  }
  
  // Toggle video from mini player
  function handleMiniPlayerToggleVideo() {
    voiceIsVideoEnabled = !voiceIsVideoEnabled;
    if (voiceRoomRef) {
      voiceRoomRef.setVideoEnabled(voiceIsVideoEnabled);
    }
  }
  
  // Toggle screen share from mini player
  function handleMiniPlayerToggleScreenShare() {
    voiceIsScreenSharing = !voiceIsScreenSharing;
    if (voiceRoomRef) {
      voiceRoomRef.setScreenSharing(voiceIsScreenSharing);
    }
  }

  $: isAuthenticated = authToken !== null;
  $: showBetaModal = !!(isAuthenticated && currentUser && !currentUser.terms_accepted_at);
  // Profile setup is now optional - users can set it up later via settings
  $: showProfileSetup = false;

  function handleAuthenticated(event: CustomEvent<{ token: string; user?: unknown }>) {
    authToken = event.detail.token;
    authStorage.set(authToken);
    if (event.detail.user) {
      currentUser = event.detail.user as User;
      // Initialize Ably with user information
      try {
        const user = event.detail.user as User;
        initAblyWithUser(
          user.id,
          user.username,
          user.avatar || null
        );
      } catch (error) {
        console.warn('Failed to initialize Ably with user:', error);
      }
    }
    loadUserData();
  }

  async function handleSelectChannel(event: CustomEvent<{ channelId: string; channelType?: 'text' | 'voice' }>) {
    selectedChannelId = event.detail.channelId;
    selectedChannelType = event.detail.channelType || null;
    showUserProfile = false;
    showInbox = false;
    selectedConversation = null;
    
    // Fetch channel details to get name and confirm type
    if (authToken && selectedChannelId) {
      try {
        const response = await fetch(apiUrl(`/api/channels/${selectedChannelId}`), {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          selectedChannelName = data.channel?.name || null;
          // Use type from API if not provided
          if (!selectedChannelType && data.channel?.type !== undefined) {
            selectedChannelType = data.channel.type === 2 ? 'voice' : 'text';
          }
        }
      } catch (err) {
        console.error('Failed to fetch channel details:', err);
      }
    }
    
    // If clicking a voice channel, start/join the call
    if (selectedChannelType === 'voice' && selectedChannelId) {
      activeVoiceCallChannelId = selectedChannelId;
      activeVoiceCallChannelName = selectedChannelName;
      activeVoiceCallGuildId = selectedGuildId;
    }
    
    // Update URL
    if (selectedGuildId && selectedChannelId) {
      navigateToChannel(selectedGuildId, selectedChannelId);
    }
  }

  function handleOpenInbox() {
    showInbox = !showInbox; // Toggle inbox
    if (showInbox) {
      showUserProfile = false;
      showSettings = false;
      selectedConversation = null;
      selectedSection = 'inbox';
    } else {
      selectedSection = 'main';
    }
  }

  function handleOpenConversation(event: CustomEvent<{ conversation: DMConversation }>) {
    selectedConversation = event.detail.conversation;
    showInbox = false;
    showComposeModal = false;
    selectedGuildId = null; // Clear guild selection to show full-screen DM
    selectedChannelId = null;
    selectedSection = 'dm';
  }

  function handleCloseConversation() {
    selectedConversation = null;
    showInbox = true;
    selectedSection = 'main';
    // Reload unread count when closing conversation
    loadUnreadDMCount();
  }

  function handleComposeMessage() {
    showComposeModal = true;
  }

  function handleStartConversation(event: CustomEvent<{ conversation: DMConversation }>) {
    selectedConversation = event.detail.conversation;
    showComposeModal = false;
    showInbox = false;
    selectedGuildId = null; // Clear guild selection to show full-screen DM
    selectedChannelId = null;
    selectedSection = 'dm';
  }

  function handleDMMessageReceived() {
    // Reload unread count when a message is received
    loadUnreadDMCount();
  }

  async function loadUnreadDMCount() {
    if (!authToken) return;
    try {
      const response = await fetch(apiUrl('/api/friends/dm'), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const conversations = await response.json();
        unreadDMCount = conversations.reduce((sum: number, c: DMConversation) => sum + (c.unread_count || 0), 0);
      }
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  }

  function handleSelectSection(event: CustomEvent<{ section: string }>) {
    selectedSection = event.detail.section;
    if (event.detail.section === 'settings') {
      showSettings = !showSettings;
      showInbox = false;
      navigateToSettings();
    } else if (event.detail.section === 'main') {
      // Navigate to home dashboard
      selectedGuildId = null;
      selectedChannelId = null;
      showSettings = false;
      showUserProfile = false;
      showInbox = false;
      selectedConversation = null;
      navigateToDashboard();
    } else if (event.detail.section === 'myspace') {
      showSettings = false;
      showUserProfile = true;
      showInbox = false;
      navigateToMyspace();
    } else {
      showSettings = false;
    }
  }

  function handleSelectGuild(event: CustomEvent<{ guildId: string }>) {
    selectedGuildId = event.detail.guildId;
    selectedChannelId = null;
    showInbox = false;
    selectedConversation = null;
    showUserProfile = false;
    viewedUser = null;
    
    // Update URL
    if (selectedGuildId) {
      navigateToGuild(selectedGuildId);
    }
  }

  async function handleViewUserProfile(event: CustomEvent<{ userId: string; username: string; avatar?: string }>) {
    const { userId } = event.detail;
    
    // If viewing own profile, show the editable profile
    if (userId === currentUser?.id) {
      viewedUser = null;
      showUserProfile = true;
      navigateToMyspace();
      showSettings = false;
      showInbox = false;
      selectedConversation = null;
      return;
    }

    // Fetch full user profile from API to get exact saved data
    if (!authToken) {
      console.error('Cannot fetch user profile: not authenticated');
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/auth/users/${userId}`), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Use the exact user data from the API (username, avatar, bio as saved)
        viewedUser = data.user as User;
        showUserProfile = true;
        navigateToMyspace();
      } else {
        console.error('Failed to fetch user profile:', response.status);
        // Fallback to basic info from message if API fails
        viewedUser = {
          id: userId,
          username: event.detail.username,
          avatar: event.detail.avatar,
        } as User;
        showUserProfile = true;
        navigateToMyspace();
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fallback to basic info from message if API fails
      viewedUser = {
        id: userId,
        username: event.detail.username,
        avatar: event.detail.avatar,
      } as User;
      showUserProfile = true;
      navigateToMyspace();
    }
    
    showSettings = false;
    showInbox = false;
    selectedConversation = null;
  }

  function handleUpdateUser(event: CustomEvent<{ user: Partial<User> }>) {
    const updates = event.detail.user;
    if (currentUser) {
      currentUser = { 
        ...currentUser, 
        ...updates 
      };
    } else {
      currentUser = {
        id: 'local-user',
        username: updates.username || 'User',
        avatar: updates.avatar,
        ...updates
      } as User;
    }
  }

  function handleLogout() {
    // Clear all auth state
    authToken = null;
    currentUser = null;
    guilds = [];
    selectedGuildId = null;
    selectedChannelId = null;
    selectedChannelType = null;
    selectedChannelName = null;
    showSettings = false;
    showUserProfile = false;
    showInbox = false;
    selectedConversation = null;
    viewedUser = null;
    
    // Disconnect from voice if active
    if (activeVoiceCallChannelId) {
      handleVoiceDisconnect();
    }
    
    // Navigate to home
    navigateToHome();
  }

  function handleSelectGuildFromChannelList(guildId: string) {
    selectedGuildId = guildId;
    selectedChannelId = null;
  }

  async function handleCreateGuild() {
    showCreateGuildModal = true;
  }

  async function submitCreateGuild(event: CustomEvent<{ name: string; description: string; icon: string; banner: string }>) {
    if (!authToken) return;

    const { name, description, icon, banner } = event.detail;

    try {
      // Build request body, only including non-empty optional fields
      const body: { name: string; description?: string; icon?: string; banner?: string } = { name };
      if (description?.trim()) body.description = description.trim();
      if (icon?.trim()) body.icon = icon.trim();
      if (banner?.trim()) body.banner = banner.trim();

      const response = await fetch(apiUrl('/api/guilds'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        guilds = [...guilds, data.guild];
        selectedGuildId = data.guild.id;
        showCreateGuildModal = false;
        // Reload guilds to ensure we have the latest data
        await loadUserData();
      } else {
        const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        console.error('Failed to create guild:', errorData);
        const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
        alert(`Failed to create guild: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error creating guild:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error creating guild: ${errorMessage}`);
    }
  }

  async function loadUserData() {
    if (!authToken) return;

    try {
      // Fetch current user to check terms acceptance
      const userResponse = await fetch(apiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        currentUser = userData.user;
        // Initialize or update Ably with user information
        if (currentUser?.id) {
          try {
            initAblyWithUser(
              currentUser.id,
              currentUser.username,
              currentUser.avatar || null
            );
          } catch (error) {
            console.warn('Failed to initialize Ably with user:', error);
          }
        }
      }

      const guildsResponse = await fetch(apiUrl('/api/guilds'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (guildsResponse.ok) {
        const guildsData = await guildsResponse.json();
        guilds = guildsData.guilds || [];
        // Don't auto-select guild - show dashboard instead
      } else if (guildsResponse.status === 401) {
        authToken = null;
        authStorage.remove();
      }

      // Load unread DM count
      await loadUnreadDMCount();
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      loading = false;
    }
  }

  function handleBetaModalAccepted() {
    showBetaModal = false;
    // Reload user data to get updated terms_accepted_at
    loadUserData();
    // Profile setup will show automatically via reactive statement
  }

  async function handleProfileSetupCompleted(event: CustomEvent<{ username: string; avatar: string; bio: string }>) {
    showProfileSetup = false;
    // Update current user with new profile data
    if (currentUser) {
      currentUser = {
        ...currentUser,
        username: event.detail.username,
        avatar: event.detail.avatar,
        bio: event.detail.bio,
      };
    }
    // Reload user data to ensure everything is in sync
    await loadUserData();
    // Navigate to myspace page after data is loaded
    showUserProfile = true;
    selectedSection = 'myspace';
  }

  // Handle browser navigation (back/forward buttons)
  function handlePopState(event: PopStateEvent) {
    const route = parseRoute();
    
    if (route.guildId) {
      selectedGuildId = route.guildId;
      if (route.channelId) {
        selectedChannelId = route.channelId;
      } else {
        selectedChannelId = null;
      }
    } else {
      selectedGuildId = null;
      selectedChannelId = null;
    }
    
    if (route.section) {
      selectedSection = route.section;
      if (route.section === 'myspace') {
        showUserProfile = true;
      } else if (route.section === 'settings') {
        showSettings = true;
      } else {
        showUserProfile = false;
        showSettings = false;
      }
    }
  }

  onMount(() => {
    const savedToken = authStorage.get();
    if (savedToken) {
      authToken = savedToken;
      loadUserData().then(() => {
        // After data is loaded, check URL and restore navigation state
        const route = parseRoute();
        if (route.guildId) {
          // Verify guild exists in user's guilds
          const guild = guilds.find(g => g.id === route.guildId);
          if (guild) {
            selectedGuildId = route.guildId;
            if (route.channelId) {
              selectedChannelId = route.channelId;
            }
          } else {
            // Guild not found, navigate to dashboard
            navigateToDashboard();
          }
        }
        
        if (route.section) {
          selectedSection = route.section;
          if (route.section === 'myspace') {
            showUserProfile = true;
          } else if (route.section === 'settings') {
            showSettings = true;
          }
        }
      });
    } else {
      loading = false;
    }
    
    // Listen for browser navigation events
    window.addEventListener('popstate', handlePopState);
  });

  onDestroy(() => {
    window.removeEventListener('popstate', handlePopState);
    if (streamStateInterval) {
      clearInterval(streamStateInterval);
      streamStateInterval = null;
    }
  });
</script>

<main class="app">
  {#if isAuthenticated && authToken && !loading}
    <div class="app-layout" class:has-player={hasMusicPlaying}>
      <Sidebar 
        currentUser={currentUser}
        {selectedSection}
        {guilds}
        {selectedGuildId}
        {unreadDMCount}
        on:selectSection={handleSelectSection}
        on:selectGuild={handleSelectGuild}
        on:openProfile={() => { showUserProfile = true; viewedUser = null; showSettings = false; showInbox = false; selectedConversation = null; navigateToMyspace(); }}
        on:createGuild={handleCreateGuild}
        on:openGuildSettings={(e) => { guildToEdit = e.detail.guild; showGuildSettingsModal = true; }}
        on:openInbox={handleOpenInbox}
      />
      {#if selectedConversation}
        <DirectMessageChat 
          conversation={selectedConversation}
          {currentUser}
          authToken={authToken || ''}
          on:close={handleCloseConversation}
          on:viewProfile={(e) => handleViewUserProfile(new CustomEvent('viewProfile', { detail: { userId: e.detail.userId, username: selectedConversation?.other_username || '', avatar: selectedConversation?.other_avatar || undefined } }))}
          on:messageReceived={handleDMMessageReceived}
        />
      {:else if selectedGuildId}
        <ChannelList 
          {authToken}
          {selectedGuildId}
          {selectedChannelId}
          {guilds}
          {currentUser}
          collapsed={channelListCollapsed}
          activeVoiceChannelId={activeVoiceCallChannelId}
          {channelSettingsVersion}
          on:selectChannel={handleSelectChannel}
          on:selectGuild={(e) => handleSelectGuildFromChannelList(e.detail.guildId)}
          on:openChannelSettings={(e) => { channelToEdit = e.detail.channel; showChannelSettingsModal = true; }}
        />
        <button 
          class="collapse-toggle" 
          class:collapsed={channelListCollapsed}
          on:click={() => channelListCollapsed = !channelListCollapsed}
          aria-label={channelListCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18L9 12L15 6"/>
          </svg>
        </button>
      {/if}

      <!-- Inbox Panel Overlay -->
      {#if showInbox}
        <InboxPanel 
          {currentUser}
          authToken={authToken || ''}
          on:close={() => { showInbox = false; selectedSection = 'main'; }}
          on:openConversation={handleOpenConversation}
          on:viewProfile={handleViewUserProfile}
          on:composeMessage={handleComposeMessage}
        />
      {/if}
      {#if showUserProfile}
        <UserProfile 
          user={viewedUser || currentUser}
          authToken={authToken || ''}
          currentUserId={currentUser?.id || ''}
          on:close={() => { showUserProfile = false; viewedUser = null; }}
        />
      {:else if selectedChannelId}
        {#if !(selectedChannelType === 'voice' && isViewingVoiceCall)}
          <ChatArea 
            channelId={selectedChannelId}
            guildId={selectedGuildId}
            {authToken}
            currentUser={currentUser}
            {channelSettingsVersion}
            on:openGroupInfo={() => showGroupInfo = !showGroupInfo}
            on:viewUserProfile={handleViewUserProfile}
          />
        {/if}
      {:else if !selectedGuildId}
        <HomeDashboard 
          {guilds}
          {selectedGuildId}
          on:selectGuild={handleSelectGuild}
          on:createGuild={handleCreateGuild}
        />
      {:else}
        <div class="welcome-screen">
          <div class="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h2>select a channel</h2>
          <p>choose a channel from the list to start chatting</p>
        </div>
      {/if}
      <GroupInfo 
        isOpen={showGroupInfo}
        on:close={() => showGroupInfo = false}
      />
      {#if showSettings}
        <SettingsPanel 
          user={currentUser}
          authToken={authToken || ''}
          on:close={() => { showSettings = false; selectedSection = 'main'; }}
          on:updateUser={handleUpdateUser}
          on:logout={handleLogout}
        />
      {/if}
      
      <!-- Create Guild Modal -->
      <CreateGuildModal 
        isOpen={showCreateGuildModal}
        on:close={() => showCreateGuildModal = false}
        on:create={submitCreateGuild}
      />

      <!-- Compose Message Modal -->
      <ComposeMessageModal 
        isOpen={showComposeModal}
        authToken={authToken || ''}
        on:close={() => showComposeModal = false}
        on:startConversation={handleStartConversation}
      />

      <!-- Beta Welcome Modal (First Login Only) -->
      {#if showBetaModal && authToken && currentUser}
        <BetaWelcomeModal 
          {authToken}
          userId={currentUser.id}
          on:accepted={handleBetaModalAccepted}
        />
      {/if}

      <!-- Profile Setup Modal (After Terms Acceptance) -->
      {#if showProfileSetup && authToken && currentUser}
        <ProfileSetupModal 
          {authToken}
          {currentUser}
          on:completed={handleProfileSetupCompleted}
        />
      {/if}

      <!-- Guild Settings Modal -->
      <GuildSettingsModal 
        isOpen={showGuildSettingsModal}
        guild={guildToEdit}
        authToken={authToken || ''}
        on:close={() => { showGuildSettingsModal = false; guildToEdit = null; }}
        on:update={(e) => {
          const updatedGuild = e.detail.guild;
          guilds = guilds.map(g => g.id === updatedGuild.id ? updatedGuild : g);
        }}
      />

      <!-- Channel Settings Modal -->
      <ChannelSettingsModal 
        isOpen={showChannelSettingsModal}
        channel={channelToEdit}
        authToken={authToken || ''}
        on:close={() => { showChannelSettingsModal = false; channelToEdit = null; }}
        on:update={(e) => {
          // Channel updated - increment version to trigger ChatArea to reload settings
          channelSettingsVersion++;
          console.log('Channel updated:', e.detail.channel);
        }}
      />
      
      <!-- Single persistent VoiceRoom - always mounted at root level, never destroyed until disconnect -->
      {#if hasActiveVoiceCall}
        <div class="voice-room-persistent" class:viewing={isViewingVoiceCall} class:no-guild={!selectedGuildId}>
          <VoiceRoom 
            bind:this={voiceRoomRef}
            channelId={activeVoiceCallChannelId || ''}
            channelName={activeVoiceCallChannelName || 'Voice Channel'}
            {authToken}
            currentUser={currentUser}
            hidden={false}
            onDisconnect={handleVoiceDisconnect}
            on:muteChange={(e) => voiceIsMuted = e.detail.isMuted}
            on:deafenChange={(e) => voiceIsDeafened = e.detail.isDeafened}
            on:videoChange={(e) => voiceIsVideoEnabled = e.detail.isVideoEnabled}
            on:screenShareChange={(e) => voiceIsScreenSharing = e.detail.isScreenSharing}
          />
        </div>
      {/if}

      <!-- Voice Stream Popout (shows when in call with active stream but viewing other content) -->
      {#if shouldShowStreamPopout}
        <VoiceStreamPopout 
          channelName={activeVoiceCallChannelName || 'Voice Channel'}
          isMuted={voiceIsMuted}
          isDeafened={voiceIsDeafened}
          isVideoEnabled={voiceIsVideoEnabled}
          isLocalScreenSharing={voiceIsScreenSharing}
          focusedParticipantName={streamState.focusedParticipantName || ''}
          focusedParticipantId={streamState.focusedParticipantId || ''}
          focusedParticipantAvatar={streamState.focusedParticipantAvatar}
          isScreenSharing={streamState.isScreenSharing}
          videoTrack={streamState.videoTrack}
          participantCount={streamState.participantCount}
          on:toggleMute={handleMiniPlayerToggleMute}
          on:toggleDeafen={handleMiniPlayerToggleDeafen}
          on:toggleVideo={handleMiniPlayerToggleVideo}
          on:toggleScreenShare={handleMiniPlayerToggleScreenShare}
          on:disconnect={handleVoiceDisconnect}
          on:expand={expandVoiceCall}
          on:minimize={() => showStreamPopout = false}
        />
      {/if}
      
      <!-- Voice Mini Player (shows when in call but no active stream or popout minimized) -->
      {#if shouldShowMiniPlayer}
        <div class="voice-mini-player-container">
          <VoiceMiniPlayer 
            channelName={activeVoiceCallChannelName || 'Voice Channel'}
            isMuted={voiceIsMuted}
            isDeafened={voiceIsDeafened}
            isVideoEnabled={voiceIsVideoEnabled}
            isScreenSharing={voiceIsScreenSharing}
            hasActiveStream={streamState.hasActiveStream}
            participantCount={streamState.participantCount}
            on:toggleMute={handleMiniPlayerToggleMute}
            on:toggleDeafen={handleMiniPlayerToggleDeafen}
            on:toggleVideo={handleMiniPlayerToggleVideo}
            on:toggleScreenShare={handleMiniPlayerToggleScreenShare}
            on:disconnect={handleVoiceDisconnect}
            on:expand={expandVoiceCall}
            on:showPopout={() => showStreamPopout = true}
          />
        </div>
      {/if}

      <!-- Global Music Player -->
      <MiniPlayer />
    </div>
  {:else if loading}
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if showAuthModal && showRegister}
    <div class="auth-container">
      <div class="auth-modal-backdrop" on:click={() => { showAuthModal = false; showRegister = false; }} on:keydown={(e) => e.key === 'Escape' && (showAuthModal = false)} role="button" tabindex="0"></div>
      <div class="auth-modal">
        <button class="auth-close" on:click={() => { showAuthModal = false; showRegister = false; }} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <RegisterForm 
          on:authenticated={handleAuthenticated} 
          on:switchToLogin={() => showRegister = false}
        />
      </div>
    </div>
  {:else if showAuthModal}
    <div class="auth-container">
      <div class="auth-modal-backdrop" on:click={() => showAuthModal = false} on:keydown={(e) => e.key === 'Escape' && (showAuthModal = false)} role="button" tabindex="0"></div>
      <div class="auth-modal">
        <button class="auth-close" on:click={() => showAuthModal = false} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <LoginForm 
          on:authenticated={handleAuthenticated} 
          on:switchToRegister={() => showRegister = true}
        />
      </div>
    </div>
  {:else}
    <LandingPage 
      on:login={() => { showAuthModal = true; showRegister = false; }}
      on:register={() => { showAuthModal = true; showRegister = true; }}
    />
  {/if}
</main>

<style>
  .app {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .app-layout {
    display: flex;
    height: 100%;
    width: 100%;
    position: relative;
  }

  .app-layout.has-player {
    padding-bottom: 72px; /* Space for mini player */
  }
  
  .voice-mini-player-container {
    position: fixed;
    bottom: 72px; /* Above the music mini player */
    left: 72px; /* After the sidebar */
    width: 280px; /* Same width as channel list */
    z-index: 100;
  }
  
  .app-layout:not(.has-player) .voice-mini-player-container {
    bottom: 0;
  }

  /* Persistent VoiceRoom container - positioned absolutely to overlay when viewing */
  .voice-room-persistent {
    position: fixed;
    top: 0;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  /* When viewing the voice channel, position it in the main content area */
  .voice-room-persistent.viewing {
    position: fixed;
    top: 0;
    left: 352px; /* 72px sidebar + 280px channel list */
    right: 0;
    bottom: 0;
    width: auto;
    height: auto;
    overflow: visible;
    visibility: visible;
    pointer-events: auto;
    z-index: 10;
  }

  .app-layout.has-player .voice-room-persistent.viewing {
    bottom: 72px; /* Account for music mini player */
  }

  /* Handle case when no guild is selected (no channel list shown) */
  .voice-room-persistent.viewing.no-guild {
    left: 72px; /* Just sidebar */
  }

  .auth-container {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .auth-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(12px);
  }

  .auth-modal {
    position: relative;
    z-index: 1;
    background: transparent;
    max-width: 420px;
    width: 90%;
  }

  .auth-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s;
    z-index: 10;
  }

  .auth-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .loading-screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #fff;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #1a365d;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .welcome-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    text-align: center;
    background: #050505;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    gap: 16px;
  }

  .welcome-screen .welcome-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 8px;
  }

  .welcome-screen h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: -0.02em;
    text-transform: lowercase;
  }

  .welcome-screen p {
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
    margin: 0;
    text-transform: lowercase;
  }

  .collapse-toggle {
    position: absolute;
    left: 352px; /* 72px sidebar + 280px channel list */
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(15, 15, 25, 0.95);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: all 0.2s ease;
    margin-left: -14px;
  }

  .collapse-toggle:hover {
    background: rgba(26, 54, 93, 0.5);
    border-color: rgba(49, 130, 206, 0.5);
    color: #fff;
  }

  .collapse-toggle.collapsed {
    left: 72px; /* Just sidebar width when collapsed */
  }

  .collapse-toggle.collapsed svg {
    transform: rotate(180deg);
  }

  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
