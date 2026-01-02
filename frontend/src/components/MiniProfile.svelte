<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import Avatar from './Avatar.svelte';
  import { apiUrl } from '../lib/api';
  import { 
    truncateBio, 
    calculateMiniProfilePosition,
    type MutualFriend 
  } from '../lib/miniProfileUtils';
  import {
    getCachedMiniProfile,
    setCachedMiniProfile,
    type MiniProfileData
  } from '../lib/miniProfileCache';

  // Props
  export let userId: string;
  export let username: string;
  export let avatar: string | null = null;
  export let triggerElement: HTMLElement;
  export let authToken: string;
  export let currentUserId: string;
  export let onClose: () => void = () => {};
  export let onViewProfile: (userId: string) => void = () => {};

  const dispatch = createEventDispatcher<{
    close: void;
    viewProfile: { userId: string };
  }>();

  // Component state
  let profileData: MiniProfileData | null = null;
  let loading = true;
  let error = false;
  let mutualFriendsError = false;
  let position = { x: 0, y: 0 };
  let profileElement: HTMLElement;
  let isMouseOverProfile = false;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Profile dimensions for positioning
  const PROFILE_WIDTH = 300;
  const PROFILE_HEIGHT = 280;

  // Load Google Font dynamically
  function loadGoogleFont(fontName: string) {
    if (!fontName) return;
    const fontId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(fontId)) return;
    
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  // Calculate position based on trigger element
  function updatePosition() {
    if (!triggerElement) return;
    
    const triggerRect = triggerElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    position = calculateMiniProfilePosition(
      triggerRect,
      { width: PROFILE_WIDTH, height: PROFILE_HEIGHT },
      viewport
    );
  }

  // Fetch mini-profile data
  async function fetchMiniProfile() {
    // Check cache first
    const cached = getCachedMiniProfile(userId);
    if (cached) {
      profileData = cached;
      loading = false;
      if (cached.usernameFont) {
        loadGoogleFont(cached.usernameFont);
      }
      return;
    }

    loading = true;
    error = false;

    try {
      // Fetch profile data
      const profileResponse = await fetch(apiUrl(`/api/auth/users/${userId}/mini-profile`), {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profile = await profileResponse.json();
      
      // Fetch mutual friends (only if viewing another user's profile)
      let mutualFriends: MutualFriend[] = [];
      if (userId !== currentUserId) {
        try {
          const mutualResponse = await fetch(apiUrl(`/api/friends/mutual/${userId}`), {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          
          if (mutualResponse.ok) {
            const mutualData = await mutualResponse.json();
            mutualFriends = mutualData.mutualFriends || [];
          }
        } catch {
          // Silently fail for mutual friends - hide section
          mutualFriendsError = true;
        }
      }

      profileData = {
        userId: profile.userId || userId,
        username: profile.username || username,
        avatar: profile.avatar || avatar,
        bio: profile.bio || null,
        backgroundImage: profile.backgroundImage || profile.mini_profile_background || null,
        usernameFont: profile.usernameFont || profile.mini_profile_font || null,
        textColor: profile.textColor || profile.mini_profile_text_color || '#ffffff',
        mutualFriends
      };

      // Cache the profile data
      setCachedMiniProfile(userId, profileData);

      // Load custom font if specified
      if (profileData.usernameFont) {
        loadGoogleFont(profileData.usernameFont);
      }

      loading = false;
    } catch (err) {
      console.error('Failed to fetch mini-profile:', err);
      error = true;
      loading = false;
      
      // Set fallback data
      profileData = {
        userId,
        username,
        avatar,
        bio: null,
        backgroundImage: null,
        usernameFont: null,
        textColor: '#ffffff',
        mutualFriends: []
      };
    }
  }

  // Handle mouse enter on profile
  function handleMouseEnter() {
    isMouseOverProfile = true;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  // Handle mouse leave on profile
  function handleMouseLeave() {
    isMouseOverProfile = false;
    // 200ms delay before hiding
    hideTimeout = setTimeout(() => {
      handleClose();
    }, 200);
  }

  // Handle close
  function handleClose() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    onClose();
    dispatch('close');
  }

  // Handle view full profile
  function handleViewProfile() {
    onViewProfile(userId);
    dispatch('viewProfile', { userId });
    handleClose();
  }

  // Handle click outside
  function handleClickOutside(event: MouseEvent) {
    if (profileElement && !profileElement.contains(event.target as Node) &&
        triggerElement && !triggerElement.contains(event.target as Node)) {
      handleClose();
    }
  }

  onMount(() => {
    updatePosition();
    fetchMiniProfile();
    
    // Add click outside listener
    document.addEventListener('click', handleClickOutside);
    
    // Update position on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
  });

  onDestroy(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
  });

  // Reactive: get display values
  $: displayUsername = profileData?.username || username;
  $: displayAvatar = profileData?.avatar || avatar;
  $: displayBio = profileData?.bio ? truncateBio(profileData.bio, 150) : null;
  $: displayFont = profileData?.usernameFont || 'inherit';
  $: displayTextColor = profileData?.textColor || '#ffffff';
  $: displayBackground = profileData?.backgroundImage;
  $: mutualFriends = profileData?.mutualFriends || [];
  $: showMutualFriends = mutualFriends.length > 0 && !mutualFriendsError && userId !== currentUserId;
  $: displayedMutualFriends = mutualFriends.slice(0, 3);
  $: extraMutualCount = mutualFriends.length > 3 ? mutualFriends.length - 3 : 0;
</script>


<div
  bind:this={profileElement}
  class="mini-profile"
  class:has-background={displayBackground}
  style="
    left: {position.x}px;
    top: {position.y}px;
    {displayBackground ? `background-image: url(${displayBackground});` : ''}
  "
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  role="tooltip"
  aria-label="User mini profile"
>
  {#if displayBackground}
    <div class="background-overlay"></div>
  {/if}

  <div class="profile-content">
    {#if loading}
      <!-- Loading skeleton -->
      <div class="skeleton-container">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text skeleton-username"></div>
        <div class="skeleton-text skeleton-bio"></div>
        <div class="skeleton-text skeleton-bio-short"></div>
      </div>
    {:else}
      <!-- Avatar -->
      <div class="avatar-container">
        <Avatar 
          src={displayAvatar}
          username={displayUsername}
          userId={userId}
          size={64}
        />
      </div>

      <!-- Username with custom font and color -->
      <h3 
        class="username"
        style="
          font-family: {displayFont}, sans-serif;
          color: {displayTextColor};
        "
      >
        {displayUsername}
      </h3>

      <!-- Bio -->
      {#if displayBio}
        <p class="bio" style="color: {displayTextColor};">
          {displayBio}
        </p>
      {/if}

      <!-- Mutual Friends Section -->
      {#if showMutualFriends}
        <div class="mutual-friends">
          <div class="mutual-avatars">
            {#each displayedMutualFriends as friend (friend.id)}
              <div class="mutual-avatar" title={friend.username}>
                <Avatar 
                  src={friend.avatar}
                  username={friend.username}
                  userId={friend.id}
                  size={24}
                />
              </div>
            {/each}
          </div>
          <span class="mutual-label" style="color: {displayTextColor};">
            {#if extraMutualCount > 0}
              +{extraMutualCount} more mutual friend{extraMutualCount > 1 ? 's' : ''}
            {:else}
              {mutualFriends.length} mutual friend{mutualFriends.length > 1 ? 's' : ''}
            {/if}
          </span>
        </div>
      {/if}

      <!-- View Full Profile Button -->
      <button class="view-profile-btn" on:click={handleViewProfile}>
        View Full Profile
      </button>
    {/if}
  </div>
</div>

<style>
  .mini-profile {
    position: fixed;
    width: 300px;
    min-height: 200px;
    background: #2a2a2a;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    overflow: hidden;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .mini-profile.has-background {
    background-color: transparent;
  }

  .background-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    pointer-events: none;
    z-index: 0;
  }

  .profile-content {
    position: relative;
    z-index: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* Loading skeleton styles */
  .skeleton-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 12px;
  }

  .skeleton-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(90deg, #3a3a3a 25%, #4a4a4a 50%, #3a3a3a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-text {
    height: 16px;
    border-radius: 4px;
    background: linear-gradient(90deg, #3a3a3a 25%, #4a4a4a 50%, #3a3a3a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-username {
    width: 120px;
    height: 20px;
  }

  .skeleton-bio {
    width: 200px;
  }

  .skeleton-bio-short {
    width: 150px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Avatar styles */
  .avatar-container {
    margin-bottom: 12px;
  }

  /* Username styles */
  .username {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    word-break: break-word;
  }

  /* Bio styles */
  .bio {
    margin: 0 0 12px 0;
    font-size: 13px;
    line-height: 1.4;
    opacity: 0.85;
    word-break: break-word;
    max-height: 60px;
    overflow: hidden;
  }

  /* Mutual friends styles */
  .mutual-friends {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
  }

  .mutual-avatars {
    display: flex;
    margin-right: 4px;
  }

  .mutual-avatar {
    margin-left: -8px;
    border: 2px solid #2a2a2a;
    border-radius: 50%;
  }

  .mutual-avatar:first-child {
    margin-left: 0;
  }

  .mutual-label {
    font-size: 12px;
    opacity: 0.8;
  }

  /* View profile button */
  .view-profile-btn {
    width: 100%;
    padding: 10px 16px;
    background: rgba(99, 102, 241, 0.8);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .view-profile-btn:hover {
    background: rgba(99, 102, 241, 1);
  }

  .view-profile-btn:active {
    transform: scale(0.98);
  }
</style>
