<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import LoginForm from './components/LoginForm.svelte';
  import RegisterForm from './components/RegisterForm.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ChannelList from './components/ChannelList.svelte';
  import ChatArea from './components/ChatArea.svelte';
  import GroupInfo from './components/GroupInfo.svelte';
  import UserProfile from './components/UserProfile.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import DirectMessageChat from './components/DirectMessageChat.svelte';
  import CreateGuildModal from './components/CreateGuildModal.svelte';
  import HomeDashboard from './components/HomeDashboard.svelte';
  import BetaWelcomeModal from './components/BetaWelcomeModal.svelte';
  import ProfileSetupModal from './components/ProfileSetupModal.svelte';
  import MiniPlayer from './components/MiniPlayer.svelte';
  import type { User, Guild } from './types';
  import { authStorage } from './utils/storage';
  import { hasPlaylist } from './lib/musicStore';
  import { parseRoute, navigateToGuild, navigateToChannel, navigateToDashboard, navigateToMyspace, navigateToSettings, navigateToHome } from './utils/router';
  import { apiUrl } from './lib/api';
  import { initAblyWithUser, closeAbly } from './lib/ably';

  $: hasMusicPlaying = $hasPlaylist;

  let authToken: string | null = null;
  let showRegister: boolean = false;
  let showGroupInfo: boolean = false;
  let selectedGuildId: string | null = null;
  let selectedChannelId: string | null = null;
  let currentUser: User | null = null;
  let guilds: Guild[] = [];
  let loading = true;
  let channelListCollapsed = false;
  let showUserProfile = false;
  let showSettings = false;
  let selectedSection = 'main';
  let selectedDMId: string | null = null;
  let selectedDMUser: { id: string; name: string; avatar: string; status?: string } | null = null;
  let showCreateGuildModal = false;
  let showBetaModal = false;
  let showProfileSetup = false;
  let viewedUser: User | null = null; // User being viewed (when clicking on someone's name in chat)

  $: isAuthenticated = authToken !== null;
  $: showBetaModal = isAuthenticated && currentUser && !currentUser.terms_accepted_at;
  $: showProfileSetup = isAuthenticated && currentUser && currentUser.terms_accepted_at && (currentUser.bio === undefined || currentUser.bio === null) && !showBetaModal;

  function handleAuthenticated(event: CustomEvent<{ token: string; user?: User }>) {
    authToken = event.detail.token;
    authStorage.set(authToken);
    if (event.detail.user) {
      currentUser = event.detail.user;
      // Initialize Ably with user information
      try {
        initAblyWithUser(
          event.detail.user.id,
          event.detail.user.username,
          event.detail.user.avatar || null
        );
      } catch (error) {
        console.warn('Failed to initialize Ably with user:', error);
      }
    }
    loadUserData();
  }

  function handleSelectChannel(event: CustomEvent<{ channelId: string }>) {
    selectedChannelId = event.detail.channelId;
    showUserProfile = false;
    selectedDMId = null;
    selectedDMUser = null;
    
    // Update URL
    if (selectedGuildId && selectedChannelId) {
      navigateToChannel(selectedGuildId, selectedChannelId);
    }
  }

  function closeDM() {
    selectedDMId = null;
    selectedDMUser = null;
  }

  function handleSelectSection(event: CustomEvent<{ section: string }>) {
    selectedSection = event.detail.section;
    if (event.detail.section === 'settings') {
      showSettings = !showSettings;
      navigateToSettings();
    } else if (event.detail.section === 'main') {
      // Navigate to home dashboard
      selectedGuildId = null;
      selectedChannelId = null;
      showSettings = false;
      showUserProfile = false;
      selectedDMId = null;
      selectedDMUser = null;
      navigateToDashboard();
    } else if (event.detail.section === 'myspace') {
      showSettings = false;
      showUserProfile = true;
      navigateToMyspace();
    } else {
      showSettings = false;
    }
  }

  function handleSelectGuild(event: CustomEvent<{ guildId: string }>) {
    selectedGuildId = event.detail.guildId;
    selectedChannelId = null;
    showUserProfile = false;
    viewedUser = null;
    selectedDMId = null;
    selectedDMUser = null;
    
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
      selectedDMId = null;
      selectedDMUser = null;
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
          avatar: event.detail.avatar || 'https://i.pravatar.cc/100?img=68',
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
        avatar: event.detail.avatar || 'https://i.pravatar.cc/100?img=68',
      } as User;
      showUserProfile = true;
      navigateToMyspace();
    }
    
    showSettings = false;
    selectedDMId = null;
    selectedDMUser = null;
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
        avatar: updates.avatar || 'https://i.pravatar.cc/100?img=68',
        ...updates
      } as User;
    }
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
        on:selectSection={handleSelectSection}
        on:selectGuild={handleSelectGuild}
        on:openProfile={() => { showUserProfile = true; viewedUser = null; showSettings = false; selectedDMId = null; selectedDMUser = null; navigateToMyspace(); }}
        on:createGuild={handleCreateGuild}
      />
      {#if selectedGuildId}
        <ChannelList 
          {authToken}
          {selectedGuildId}
          {selectedChannelId}
          {guilds}
          collapsed={channelListCollapsed}
          on:selectChannel={handleSelectChannel}
          on:selectGuild={(e) => handleSelectGuildFromChannelList(e.detail.guildId)}
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
      {#if showUserProfile}
        <UserProfile 
          user={viewedUser || currentUser}
          on:close={() => { showUserProfile = false; viewedUser = null; }}
        />
      {:else if selectedDMId && selectedDMUser}
        <DirectMessageChat 
          dmUser={selectedDMUser}
          {currentUser}
          on:close={closeDM}
        />
      {:else if selectedChannelId}
        <ChatArea 
          channelId={selectedChannelId}
          {authToken}
          currentUser={currentUser}
          on:openGroupInfo={() => showGroupInfo = !showGroupInfo}
          on:viewUserProfile={handleViewUserProfile}
        />
      {:else if !selectedGuildId}
        <HomeDashboard 
          {guilds}
          {selectedGuildId}
          on:selectGuild={handleSelectGuild}
          on:createGuild={handleCreateGuild}
        />
      {:else}
        <div class="welcome-screen">
          <h2>Select a Channel</h2>
          <p>Choose a channel from the list to start chatting</p>
        </div>
      {/if}
      <GroupInfo 
        isOpen={showGroupInfo}
        on:close={() => showGroupInfo = false}
      />
      {#if showSettings}
        <SettingsPanel 
          user={currentUser}
          on:close={() => { showSettings = false; selectedSection = 'main'; }}
          on:updateUser={handleUpdateUser}
        />
      {/if}
      
      <!-- Create Guild Modal -->
      <CreateGuildModal 
        isOpen={showCreateGuildModal}
        on:close={() => showCreateGuildModal = false}
        on:create={submitCreateGuild}
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

      <!-- Global Music Player -->
      <MiniPlayer />
    </div>
  {:else if loading}
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if showRegister}
    <div class="auth-container">
      <RegisterForm 
        on:authenticated={handleAuthenticated} 
        on:switchToLogin={() => showRegister = false}
      />
    </div>
  {:else}
    <div class="auth-container">
      <LoginForm 
        on:authenticated={handleAuthenticated} 
        on:switchToRegister={() => showRegister = true}
      />
    </div>
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

  .auth-container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 26, 46, 0.9);
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
  }

  .welcome-screen h2 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
  }

  .welcome-screen p {
    color: rgba(255, 255, 255, 0.6);
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
