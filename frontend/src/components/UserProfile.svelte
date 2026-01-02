<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User } from '../types';
  import MusicCard from './MusicCard.svelte';
  import ImageGalleryCard from './ImageGalleryCard.svelte';
  import FavoriteGamesCard from './FavoriteGamesCard.svelte';
  import GitHubProjectsCard from './GitHubProjectsCard.svelte';
  import FriendsCard from './FriendsCard.svelte';
  import Avatar from './Avatar.svelte';
  import {
    loadProfile,
    loadProfileFromServer,
    saveProfile,
    setAuthToken,
    updateProfileCards,
    updateProfileGreeting,
    updateProfileBackground,
    updateProfileWidgets,
    updateQuoteCard,
    removeCardData,
    CUSTOM_FONTS,
    type ProfileData,
    type ProfileCard,
    type MiniWidget
  } from '../lib/profileStorage';
  import { apiUrl } from '../lib/api';

  export let user: User | null = null;
  export let authToken: string = '';
  export let currentUserId: string = ''; // The logged-in user's ID

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  // Determine if viewing own profile (can edit) or another user's (read-only)
  $: isOwnProfile = !user || user.id === currentUserId;
  $: canEdit = isOwnProfile;

  $: username = user?.username || 'Dear';
  $: avatar = user?.avatar || null;
  $: bio = user?.bio || '';
  let backgroundImage: string | null = null;
  let fileInput: HTMLInputElement;
  let customGreeting = 'HI,';
  let isEditingGreeting = false;
  let greetingInput: HTMLInputElement;
  let showWidgetMenu = false;
  let miniGifInput: HTMLInputElement;
  let profileData: ProfileData | null = null;
  let profileLoading = true;

  let miniWidgets: MiniWidget[] = [];
  let isEditMode = false;

  // Friend request state
  let friendRequestStatus: 'none' | 'pending' | 'friends' | 'loading' | 'sent' = 'none';
  let friendRequestError = '';

  // Quote card content (keyed by card id)
  let quoteContents: Record<string, string> = {};

  // Card definitions - import CardStyle type
  import type { CardStyle } from '../lib/profileStorage';
  
  type CardType = 'quote' | 'gradient' | 'music' | 'games' | 'github' | 'friends';
  
  interface Card {
    id: string;
    type: CardType;
    size: 'small' | 'wide' | 'custom';
    style?: CardStyle;
  }

  interface CardOption {
    type: CardType;
    label: string;
    icon: string;
    size: 'small' | 'wide';
    singleton?: boolean;
  }

  const cardOptions: CardOption[] = [
    { type: 'quote', label: 'Quote Card', icon: '', size: 'small' },
    { type: 'gradient', label: 'Image Gallery', icon: '', size: 'small' },
    { type: 'music', label: 'Music Player', icon: '', size: 'small', singleton: true },
    { type: 'games', label: 'Favorite Games', icon: '', size: 'small' },
    { type: 'github', label: 'GitHub Projects', icon: '', size: 'small' },
    { type: 'friends', label: 'Friends', icon: '', size: 'small', singleton: true },
  ];

  let cards: Card[] = [];
  let showAddCardMenu = false;
  let cardSettingsOpen: string | null = null; // ID of card being customized
  
  // Convert CardStyle to inline CSS string
  function getCardStyleCSS(style?: CardStyle): string {
    if (!style) return '';
    
    const styles: string[] = [];
    
    // Dimensions
    if (style.width) styles.push(`width: ${style.width}`);
    if (style.height) styles.push(`height: ${style.height}`);
    if (style.minHeight) styles.push(`min-height: ${style.minHeight}`);
    if (style.maxHeight) styles.push(`max-height: ${style.maxHeight}`);
    
    // Typography
    if (style.fontFamily) styles.push(`font-family: ${style.fontFamily}`);
    if (style.fontSize) styles.push(`font-size: ${style.fontSize}`);
    if (style.fontWeight) styles.push(`font-weight: ${style.fontWeight}`);
    if (style.textColor) styles.push(`color: ${style.textColor}`);
    
    // Background
    if (style.backgroundColor) styles.push(`background-color: ${style.backgroundColor}`);
    if (style.backgroundImage) styles.push(`background-image: ${style.backgroundImage}`);
    if (style.backgroundSize) styles.push(`background-size: ${style.backgroundSize}`);
    if (style.backgroundPosition) styles.push(`background-position: ${style.backgroundPosition}`);
    if (style.opacity !== undefined) styles.push(`opacity: ${style.opacity}`);
    
    // Border
    if (style.borderWidth) styles.push(`border-width: ${style.borderWidth}`);
    if (style.borderStyle) styles.push(`border-style: ${style.borderStyle}`);
    if (style.borderColor) styles.push(`border-color: ${style.borderColor}`);
    if (style.borderRadius) styles.push(`border-radius: ${style.borderRadius}`);
    
    // Effects
    if (style.boxShadow) styles.push(`box-shadow: ${style.boxShadow}`);
    if (style.backdropBlur) styles.push(`backdrop-filter: blur(${style.backdropBlur})`);
    if (style.transitionDuration) styles.push(`transition-duration: ${style.transitionDuration}`);
    
    return styles.join('; ');
  }
  
  // Get wrapper style for custom sizes
  function getWrapperStyleCSS(card: Card): string {
    if (card.size !== 'custom' || !card.style) return '';
    
    const styles: string[] = [];
    if (card.style.width) styles.push(`flex-basis: ${card.style.width}`);
    
    return styles.join('; ');
  }
  
  // Get transition class for card animations
  function getTransitionClass(card: Card): string {
    if (!card.style?.transitionIn) return '';
    return `transition-${card.style.transitionIn}`;
  }
  
  // Update a card's style
  function updateCardStyle(cardId: string, newStyle: Partial<CardStyle>) {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    cards[cardIndex] = {
      ...cards[cardIndex],
      style: { ...cards[cardIndex].style, ...newStyle }
    };
    cards = [...cards]; // Trigger reactivity
    
    // Save to profile
    if (canEdit) {
      updateProfileCards(cards as ProfileCard[]);
    }
  }
  
  // Helper to update transition style with proper typing
  function updateTransitionIn(cardId: string, value: string) {
    updateCardStyle(cardId, { transitionIn: value as CardStyle['transitionIn'] });
  }
  
  // Helper to update card size
  function updateCardSize(cardId: string, size: 'small' | 'wide' | 'custom') {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    cards[cardIndex] = { ...cards[cardIndex], size };
    cards = [...cards];
    if (canEdit) {
      updateProfileCards(cards as ProfileCard[]);
    }
  }
  
  // Helper to reset card style
  function resetCardStyle(cardId: string) {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    cards[cardIndex] = { ...cards[cardIndex], style: undefined };
    cards = [...cards];
    if (canEdit) {
      updateProfileCards(cards as ProfileCard[]);
    }
  }
  
  // Open card settings
  function openCardSettings(cardId: string) {
    cardSettingsOpen = cardId;
  }
  
  // Close card settings
  function closeCardSettings() {
    cardSettingsOpen = null;
  }

  // Track the user ID we loaded profile for to detect changes
  let loadedUserId: string | null = null;

  // Get the effective user ID for the profile being viewed
  $: effectiveUserId = user?.id || currentUserId;

  // Function to load profile data
  async function loadProfileData() {
    profileLoading = true;
    
    // Set auth token for API calls
    setAuthToken(authToken);
    
    // Determine which user's profile to load
    // If viewing own profile (isOwnProfile), don't pass userId to load current user's data
    const userIdToLoad = isOwnProfile ? undefined : user?.id;
    
    // Load profile from server
    const { profileData: serverProfile, backgroundImage: serverBg } = await loadProfileFromServer(userIdToLoad);
    profileData = serverProfile;
    backgroundImage = serverBg;
    
    // Load layout
    cards = profileData.cards as Card[];
    customGreeting = profileData.greeting;
    miniWidgets = profileData.miniWidgets;
    
    // Load quote contents
    if (profileData.quoteCards) {
      quoteContents = Object.fromEntries(
        Object.entries(profileData.quoteCards).map(([id, data]) => [id, data.content])
      );
    }
    
    // Track which user we loaded (use effectiveUserId for consistency)
    loadedUserId = effectiveUserId;
    profileLoading = false;
  }

  // Load profile data on mount
  onMount(() => {
    loadProfileData();
  });

  // Reload profile when the viewed user changes
  $: if (effectiveUserId !== loadedUserId && loadedUserId !== null) {
    loadProfileData();
  }

  // Check friendship status when viewing another user's profile
  $: if (!isOwnProfile && user?.id && authToken) {
    checkFriendshipStatus();
  }

  async function checkFriendshipStatus() {
    if (!user?.id || !authToken || isOwnProfile) return;
    
    friendRequestStatus = 'loading';
    try {
      // Check if already friends
      const friendsResponse = await fetch(apiUrl('/api/friends'), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      if (friendsResponse.ok) {
        const friends = await friendsResponse.json();
        const isFriend = friends.some((f: { friend_id: string; user_id: string }) => 
          f.friend_id === user?.id || f.user_id === user?.id
        );
        
        if (isFriend) {
          friendRequestStatus = 'friends';
          return;
        }
      }

      // Check for pending outgoing requests
      const outgoingResponse = await fetch(apiUrl('/api/friends/requests/outgoing'), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      if (outgoingResponse.ok) {
        const outgoing = await outgoingResponse.json();
        const hasPending = outgoing.some((r: { friend_id: string }) => r.friend_id === user?.id);
        
        if (hasPending) {
          friendRequestStatus = 'pending';
          return;
        }
      }

      friendRequestStatus = 'none';
    } catch (err) {
      console.error('Failed to check friendship status:', err);
      friendRequestStatus = 'none';
    }
  }

  async function sendFriendRequest() {
    if (!user?.id || !authToken) return;
    
    friendRequestStatus = 'loading';
    friendRequestError = '';
    
    try {
      const response = await fetch(apiUrl('/api/friends/requests'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friend_id: user.id }),
      });

      if (response.ok) {
        friendRequestStatus = 'sent';
      } else {
        const data = await response.json();
        friendRequestError = data.error?.message || 'Failed to send request';
        friendRequestStatus = 'none';
      }
    } catch (err) {
      console.error('Failed to send friend request:', err);
      friendRequestError = 'Failed to send request';
      friendRequestStatus = 'none';
    }
  }

  function getQuoteContent(cardId: string): string {
    return quoteContents[cardId] || `<h1>BE<br>KIND<br>AND<br>BRIGHT</h1><p><strong>Lorem ipsum</strong> dolor sit amet.</p>`;
  }

  function handleQuoteUpdate(cardId: string, html: string) {
    quoteContents[cardId] = html;
    updateQuoteCard(cardId, html);
  }

  function canAddCardType(type: CardType): boolean {
    const option = cardOptions.find(o => o.type === type);
    if (option?.singleton) {
      return !cards.some(c => c.type === type);
    }
    return true;
  }

  function addCard(type: CardType) {
    if (!canAddCardType(type)) {
      alert(`You can only have one ${cardOptions.find(o => o.type === type)?.label} card`);
      return;
    }

    const option = cardOptions.find(o => o.type === type);
    if (!option) return;

    const newCard: Card = {
      id: `card-${Date.now()}`,
      type,
      size: option.size,
    };

    cards = [...cards, newCard];
    showAddCardMenu = false;
    updateProfileCards(cards as ProfileCard[]);
  }

  function removeCard(id: string) {
    const card = cards.find(c => c.id === id);
    if (card) {
      removeCardData(id, card.type);
    }
    cards = cards.filter(c => c.id !== id);
    updateProfileCards(cards as ProfileCard[]);
  }

  // Drag state
  let draggedCard: Card | null = null;
  let dragOverIndex: number | null = null;
  let draggedElement: HTMLElement | null = null;

  function handleDragStart(e: DragEvent, card: Card, element: HTMLElement) {
    if (!isEditMode) return;
    draggedCard = card;
    draggedElement = element;
    element.classList.add('dragging');
    
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.id);
    }
  }

  function handleDragEnd() {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
    }
    draggedCard = null;
    draggedElement = null;
    dragOverIndex = null;
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (!isEditMode || !draggedCard) return;
    e.preventDefault();
    
    const draggedIndex = cards.findIndex(c => c.id === draggedCard?.id);
    if (draggedIndex !== index) {
      dragOverIndex = index;
    }
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(e: DragEvent, targetIndex: number) {
    if (!isEditMode || !draggedCard) return;
    e.preventDefault();
    
    const draggedIndex = cards.findIndex(c => c.id === draggedCard?.id);
    if (draggedIndex === -1 || draggedIndex === targetIndex) {
      dragOverIndex = null;
      return;
    }

    const newCards = [...cards];
    const [removed] = newCards.splice(draggedIndex, 1);
    newCards.splice(targetIndex, 0, removed);
    cards = newCards;
    
    dragOverIndex = null;
    updateProfileCards(cards as ProfileCard[]);
  }

  function toggleEditMode() {
    if (!canEdit) return; // Can't edit other users' profiles
    isEditMode = !isEditMode;
    if (!isEditMode) {
      showWidgetMenu = false;
      showAddCardMenu = false;
    }
  }

  function saveLayout() {
    isEditMode = false;
    showWidgetMenu = false;
    showAddCardMenu = false;
    
    // Save all profile data
    updateProfileCards(cards as ProfileCard[]);
    updateProfileGreeting(customGreeting);
    updateProfileBackground(backgroundImage);
    updateProfileWidgets(miniWidgets);
  }

  async function handleBackgroundUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload an image or GIF file');
      return;
    }

    // Convert to base64 for persistence
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      backgroundImage = base64Image;
      
      // Save to database via API
      if (authToken && user?.id) {
        try {
          const response = await fetch(apiUrl('/api/auth/profile'), {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              background_image: base64Image,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // Update user prop if possible (will be reactive)
            if (user) {
              user.background_image = base64Image;
            }
          } else {
            console.error('Failed to save background image');
            alert('Failed to save background image. Please try again.');
          }
        } catch (error) {
          console.error('Error saving background image:', error);
          alert('Error saving background image. Please try again.');
        }
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeBackground() {
    backgroundImage = null;
    
    // Save to database via API
    if (authToken && user?.id) {
      try {
        const response = await fetch(apiUrl('/api/auth/profile'), {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            background_image: null,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update user prop if possible (will be reactive)
          if (user) {
            user.background_image = undefined;
          }
        } else {
          console.error('Failed to remove background image');
          alert('Failed to remove background image. Please try again.');
        }
      } catch (error) {
        console.error('Error removing background image:', error);
        alert('Error removing background image. Please try again.');
      }
    }
  }

  function triggerFileInput() {
    fileInput?.click();
  }

  function startEditingGreeting() {
    if (!isEditMode) return;
    isEditingGreeting = true;
    setTimeout(() => greetingInput?.focus(), 0);
  }

  function finishEditingGreeting() {
    isEditingGreeting = false;
    if (!customGreeting.trim()) {
      customGreeting = 'HI,';
    }
    updateProfileGreeting(customGreeting);
  }

  function handleGreetingKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      finishEditingGreeting();
    } else if (e.key === 'Escape') {
      isEditingGreeting = false;
    }
  }

  function addWidget(type: 'date' | 'time' | 'gif') {
    if (type === 'gif') {
      miniGifInput?.click();
    } else {
      miniWidgets = [...miniWidgets, { id: `widget-${Date.now()}`, type }];
      updateProfileWidgets(miniWidgets);
    }
    showWidgetMenu = false;
  }

  function handleMiniGifUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image or GIF');
      return;
    }

    // Convert to base64 for persistence
    const reader = new FileReader();
    reader.onload = (event) => {
      const gifUrl = event.target?.result as string;
      miniWidgets = [...miniWidgets, { id: `widget-${Date.now()}`, type: 'gif', gifUrl }];
      updateProfileWidgets(miniWidgets);
    };
    reader.readAsDataURL(file);
  }

  function removeWidget(id: string) {
    miniWidgets = miniWidgets.filter(w => w.id !== id);
    updateProfileWidgets(miniWidgets);
  }

  function formatDate(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatTime(): string {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  let currentTime = formatTime();
  let currentDate = formatDate();
  
  if (typeof window !== 'undefined') {
    setInterval(() => {
      currentTime = formatTime();
      currentDate = formatDate();
    }, 1000);
  }
</script>

<div class="profile-container" style={backgroundImage ? `background-image: url(${backgroundImage})` : ''} class:has-background={backgroundImage}>
  {#if backgroundImage}
    <div class="background-overlay"></div>
  {/if}

  <input 
    type="file" 
    bind:this={fileInput}
    on:change={handleBackgroundUpload}
    accept="image/jpeg,image/png,image/gif,image/webp"
    class="hidden-input"
  />

  {#if isEditMode}
    <div class="background-picker">
      <button class="bg-picker-btn" on:click={triggerFileInput}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span>{backgroundImage ? 'Change Background' : 'Add Background'}</span>
      </button>
      {#if backgroundImage}
        <button class="bg-remove-btn" on:click={removeBackground}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      {/if}
      <span class="bg-hint">Supports JPG, PNG, GIF, WebP</span>
    </div>
  {/if}

  <header class="profile-header">
    <div class="greeting">
      {#if isEditMode && isEditingGreeting}
        <input
          type="text"
          bind:this={greetingInput}
          bind:value={customGreeting}
          on:blur={finishEditingGreeting}
          on:keydown={handleGreetingKeydown}
          class="greeting-input"
          maxlength="30"
          placeholder="Your greeting..."
        />
      {:else}
        <h1 
          class:editable={isEditMode}
          on:click={startEditingGreeting}
          on:keydown={(e) => e.key === 'Enter' && startEditingGreeting()}
          role={isEditMode ? 'button' : undefined}
          tabindex={isEditMode ? 0 : undefined}
        >
          {customGreeting} <span class="username">{username.toUpperCase()}!</span>
          {#if isEditMode}
            <span class="edit-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </span>
          {/if}
        </h1>
      {/if}
      
      {#if bio}
        <div class="bio-section">
          <p class="bio-text">{bio}</p>
        </div>
      {/if}
      
      <div class="mini-widgets">
        {#each miniWidgets as widget (widget.id)}
          <div class="mini-widget {widget.type}">
            {#if widget.type === 'date'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{currentDate}</span>
            {:else if widget.type === 'time'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <span>{currentTime}</span>
            {:else if widget.type === 'gif' && widget.gifUrl}
              <img src={widget.gifUrl} alt="Mini GIF" class="mini-gif" />
            {/if}
            {#if isEditMode}
              <button class="remove-widget" on:click={() => removeWidget(widget.id)}>×</button>
            {/if}
          </div>
        {/each}

        {#if isEditMode}
          <div class="add-widget-wrapper">
            <button class="add-widget-btn" on:click={() => showWidgetMenu = !showWidgetMenu}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            
            {#if showWidgetMenu}
              <div class="widget-menu">
                <button on:click={() => addWidget('date')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Date
                </button>
                <button on:click={() => addWidget('time')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  Time
                </button>
                <button on:click={() => addWidget('gif')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                  </svg>
                  Mini GIF
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <input 
        type="file" 
        bind:this={miniGifInput}
        on:change={handleMiniGifUpload}
        accept="image/gif,image/png,image/jpeg,image/webp"
        class="hidden-input"
      />
    </div>
    <div class="header-actions">
      {#if canEdit}
        {#if isEditMode}
          <button class="save-btn" on:click={saveLayout}>save changes</button>
          <button class="cancel-btn" on:click={() => isEditMode = false}>cancel</button>
        {:else}
          <button class="edit-space-btn" on:click={toggleEditMode}>edit my space</button>
        {/if}
      {:else}
        <!-- Add Friend button for other users' profiles -->
        {#if friendRequestStatus === 'loading'}
          <button class="friend-btn loading" disabled>
            <span class="spinner-small"></span>
          </button>
        {:else if friendRequestStatus === 'friends'}
          <button class="friend-btn friends" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            friends
          </button>
        {:else if friendRequestStatus === 'pending' || friendRequestStatus === 'sent'}
          <button class="friend-btn pending" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            request sent
          </button>
        {:else}
          <button class="friend-btn add" on:click={sendFriendRequest}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            add friend
          </button>
        {/if}
        {#if friendRequestError}
          <span class="friend-error">{friendRequestError}</span>
        {/if}
      {/if}
      <div class="header-avatar">
        <Avatar 
          src={avatar}
          username={username}
          userId={user?.id || currentUserId}
          size={44}
        />
      </div>
    </div>
  </header>

  <div class="profile-grid" class:edit-mode={isEditMode}>
    {#each cards as card, index (card.id)}
      <div
        class="card-wrapper {card.size} {getTransitionClass(card)}"
        class:drag-over={dragOverIndex === index}
        class:dragging={draggedCard?.id === card.id}
        style={getWrapperStyleCSS(card)}
        draggable={isEditMode}
        on:dragstart={(e) => handleDragStart(e, card, e.currentTarget)}
        on:dragend={handleDragEnd}
        on:dragover={(e) => handleDragOver(e, index)}
        on:dragleave={handleDragLeave}
        on:drop={(e) => handleDrop(e, index)}
        role={isEditMode ? "button" : undefined}
        tabindex={isEditMode ? 0 : undefined}
      >
        {#if dragOverIndex === index && draggedCard?.id !== card.id}
          <div class="drop-indicator"></div>
        {/if}
        
        <div 
          class="card {card.type}-card" 
          class:edit-mode={isEditMode}
          class:has-custom-bg={card.style?.backgroundImage}
          style={getCardStyleCSS(card.style)}
        >
          {#if card.style?.backgroundImage}
            <div class="card-bg-overlay"></div>
          {/if}
          
          {#if isEditMode}
            <div class="card-edit-controls">
              <div class="drag-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
              <!-- Card settings button -->
              <button class="card-settings-btn" on:click|stopPropagation={() => openCardSettings(card.id)} title="Card settings">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              <button class="remove-card-btn" on:click|stopPropagation={() => removeCard(card.id)} title="Remove card">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          {/if}

          {#if card.type === 'quote'}
            <div class="quote-content">
              <div class="quote-text" contenteditable={isEditMode} on:blur={(e) => handleQuoteUpdate(card.id, e.currentTarget.innerHTML)}>
                {@html getQuoteContent(card.id) || '<p>Write your creative quote...</p>'}
              </div>
            </div>

          {:else if card.type === 'gradient'}
            <ImageGalleryCard 
              editable={isEditMode && isOwnProfile} 
              cardId={card.id}
              profileGalleryData={profileData?.galleryCards?.[card.id] || null}
              isOwnProfile={isOwnProfile}
            />

          {:else if card.type === 'music'}
            <MusicCard 
              editable={isEditMode && isOwnProfile} 
              profileMusicData={profileData?.musicCard || null}
              isOwnProfile={isOwnProfile}
              autoplay={!isOwnProfile}
            />

          {:else if card.type === 'games'}
            <FavoriteGamesCard 
              editable={isEditMode && isOwnProfile} 
              cardId={card.id}
              profileGamesData={profileData?.gamesCards?.[card.id] || null}
              isOwnProfile={isOwnProfile}
            />

          {:else if card.type === 'github'}
            <GitHubProjectsCard 
              editable={isEditMode && isOwnProfile} 
              cardId={card.id}
              profileGitHubData={profileData?.githubCards?.[card.id] || null}
              isOwnProfile={isOwnProfile}
            />

          {:else if card.type === 'friends'}
            <FriendsCard editable={isEditMode} {authToken} userId={effectiveUserId} />
          {/if}
        </div>
      </div>
    {/each}

    {#if isEditMode}
      <div class="card-wrapper small add-card-wrapper">
        <div class="card add-card">
          <button class="add-new-btn" on:click={() => showAddCardMenu = !showAddCardMenu}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add Card</span>
          </button>
          
          {#if showAddCardMenu}
            <div class="add-card-menu">
              <div class="menu-header">Choose a card type</div>
              <div class="menu-options">
                {#each cardOptions as option}
                  <button 
                    class="menu-option"
                    class:disabled={!canAddCardType(option.type)}
                    on:click={() => addCard(option.type)}
                    disabled={!canAddCardType(option.type)}
                  >
                    <span class="option-label">{option.label}</span>
                    {#if option.singleton && !canAddCardType(option.type)}
                      <span class="option-badge">Added</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if isEditMode}
    <div class="edit-hint">Drag cards to rearrange your space</div>
  {/if}
</div>

<!-- Card Settings Panel -->
{#if cardSettingsOpen}
  {@const editingCard = cards.find(c => c.id === cardSettingsOpen)}
  {#if editingCard}
    <div class="card-settings-overlay" on:click={closeCardSettings} on:keydown={(e) => e.key === 'Escape' && closeCardSettings()} role="button" tabindex="0">
      <div class="card-settings-panel" on:click|stopPropagation role="dialog" aria-labelledby="card-settings-title">
        <div class="settings-header">
          <h3 id="card-settings-title">Card Settings</h3>
          <button class="close-settings-btn" on:click={closeCardSettings}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="settings-body">
          <!-- Size -->
          <div class="settings-section">
            <label class="settings-label">Size</label>
            <div class="size-options">
              <button 
                class="size-option" 
                class:active={editingCard.size === 'small'}
                on:click={() => updateCardSize(editingCard.id, 'small')}
              >Small</button>
              <button 
                class="size-option" 
                class:active={editingCard.size === 'wide'}
                on:click={() => updateCardSize(editingCard.id, 'wide')}
              >Wide</button>
              <button 
                class="size-option" 
                class:active={editingCard.size === 'custom'}
                on:click={() => updateCardSize(editingCard.id, 'custom')}
              >Custom</button>
            </div>
          </div>
          
          <!-- Dimensions (for custom size) -->
          {#if editingCard.size === 'custom'}
            <div class="settings-section">
              <label class="settings-label">Dimensions</label>
              <div class="dimension-inputs">
                <div class="input-group">
                  <label>Width</label>
                  <input 
                    type="text" 
                    value={editingCard.style?.width || ''} 
                    placeholder="e.g., 300px, 50%"
                    on:change={(e) => updateCardStyle(editingCard.id, { width: e.currentTarget.value })}
                  />
                </div>
                <div class="input-group">
                  <label>Height</label>
                  <input 
                    type="text" 
                    value={editingCard.style?.height || ''} 
                    placeholder="e.g., 250px, auto"
                    on:change={(e) => updateCardStyle(editingCard.id, { height: e.currentTarget.value })}
                  />
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Font Family -->
          <div class="settings-section">
            <label class="settings-label">Font Family</label>
            <div class="font-options">
              {#each CUSTOM_FONTS as font}
                <button 
                  class="font-option" 
                  class:active={editingCard.style?.fontFamily === font.value}
                  style="font-family: {font.value}"
                  on:click={() => updateCardStyle(editingCard.id, { fontFamily: font.value })}
                >
                  {font.name}
                </button>
              {/each}
            </div>
          </div>
          
          <!-- Text Color -->
          <div class="settings-section">
            <label class="settings-label">Text Color</label>
            <div class="color-input-row">
              <input 
                type="color" 
                value={editingCard.style?.textColor?.startsWith('#') ? editingCard.style.textColor : '#ffffff'}
                on:change={(e) => updateCardStyle(editingCard.id, { textColor: e.currentTarget.value })}
              />
              <input 
                type="text" 
                value={editingCard.style?.textColor || ''} 
                placeholder="#ffffff"
                on:change={(e) => updateCardStyle(editingCard.id, { textColor: e.currentTarget.value })}
              />
            </div>
          </div>
          
          <!-- Background Color -->
          <div class="settings-section">
            <label class="settings-label">Background Color</label>
            <div class="color-input-row">
              <input 
                type="color" 
                value={editingCard.style?.backgroundColor?.startsWith('#') ? editingCard.style.backgroundColor : '#282828'}
                on:change={(e) => updateCardStyle(editingCard.id, { backgroundColor: e.currentTarget.value })}
              />
              <input 
                type="text" 
                value={editingCard.style?.backgroundColor || ''} 
                placeholder="rgba(40, 40, 40, 0.6)"
                on:change={(e) => updateCardStyle(editingCard.id, { backgroundColor: e.currentTarget.value })}
              />
            </div>
          </div>
          
          <!-- Opacity -->
          <div class="settings-section">
            <label class="settings-label">Opacity: {Math.round((editingCard.style?.opacity ?? 1) * 100)}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={Math.round((editingCard.style?.opacity ?? 1) * 100)}
              on:input={(e) => updateCardStyle(editingCard.id, { opacity: parseInt(e.currentTarget.value) / 100 })}
              class="opacity-slider"
            />
          </div>
          
          <!-- Background Image -->
          <div class="settings-section">
            <label class="settings-label">Background Image</label>
            <input 
              type="text" 
              value={editingCard.style?.backgroundImage?.replace(/^url\(['"]?|['"]?\)$/g, '') || ''} 
              placeholder="https://example.com/image.jpg"
              on:change={(e) => {
                const value = e.currentTarget.value;
                updateCardStyle(editingCard.id, { 
                  backgroundImage: value ? `url('${value}')` : undefined,
                  backgroundSize: value ? 'cover' : undefined,
                  backgroundPosition: value ? 'center' : undefined,
                });
              }}
            />
          </div>
          
          <!-- Border -->
          <div class="settings-section">
            <label class="settings-label">Border</label>
            <div class="border-inputs">
              <div class="input-group">
                <label>Width</label>
                <input 
                  type="text" 
                  value={editingCard.style?.borderWidth || ''} 
                  placeholder="1px"
                  on:change={(e) => updateCardStyle(editingCard.id, { borderWidth: e.currentTarget.value })}
                />
              </div>
              <div class="input-group">
                <label>Style</label>
                <select 
                  value={editingCard.style?.borderStyle || 'none'}
                  on:change={(e) => updateCardStyle(editingCard.id, { borderStyle: e.currentTarget.value })}
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="double">Double</option>
                </select>
              </div>
              <div class="input-group">
                <label>Color</label>
                <input 
                  type="color" 
                  value={editingCard.style?.borderColor?.startsWith('#') ? editingCard.style.borderColor : '#333333'}
                  on:change={(e) => updateCardStyle(editingCard.id, { borderColor: e.currentTarget.value })}
                />
              </div>
            </div>
          </div>
          
          <!-- Border Radius -->
          <div class="settings-section">
            <label class="settings-label">Border Radius</label>
            <input 
              type="text" 
              value={editingCard.style?.borderRadius || ''} 
              placeholder="16px"
              on:change={(e) => updateCardStyle(editingCard.id, { borderRadius: e.currentTarget.value })}
            />
          </div>
          
          <!-- Transition In -->
          <div class="settings-section">
            <label class="settings-label">Entrance Animation</label>
            <select 
              value={editingCard.style?.transitionIn || 'none'}
              on:change={(e) => updateTransitionIn(editingCard.id, e.currentTarget.value)}
            >
              <option value="none">None</option>
              <option value="fade">Fade In</option>
              <option value="slide-up">Slide Up</option>
              <option value="slide-down">Slide Down</option>
              <option value="slide-left">Slide Left</option>
              <option value="slide-right">Slide Right</option>
              <option value="zoom">Zoom In</option>
              <option value="bounce">Bounce</option>
            </select>
          </div>
          
          <!-- Box Shadow -->
          <div class="settings-section">
            <label class="settings-label">Box Shadow</label>
            <input 
              type="text" 
              value={editingCard.style?.boxShadow || ''} 
              placeholder="0 4px 6px rgba(0,0,0,0.3)"
              on:change={(e) => updateCardStyle(editingCard.id, { boxShadow: e.currentTarget.value })}
            />
          </div>
          
          <!-- Backdrop Blur -->
          <div class="settings-section">
            <label class="settings-label">Backdrop Blur</label>
            <input 
              type="text" 
              value={editingCard.style?.backdropBlur || ''} 
              placeholder="10px"
              on:change={(e) => updateCardStyle(editingCard.id, { backdropBlur: e.currentTarget.value })}
            />
          </div>
        </div>
        
        <div class="settings-footer">
          <button class="reset-btn" on:click={() => resetCardStyle(editingCard.id)}>
            Reset to Default
          </button>
          <button class="done-btn" on:click={closeCardSettings}>
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .profile-container {
    width: 100%;
    height: 100%;
    background: #1a1a1a;
    padding: 24px;
    overflow-y: auto;
    position: relative;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .profile-container.has-background {
    background-color: transparent;
  }

  .background-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    pointer-events: none;
    z-index: 0;
  }

  .hidden-input {
    display: none;
  }

  .background-picker {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .bg-picker-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(49, 130, 206, 0.2);
    border: 1px dashed rgba(49, 130, 206, 0.5);
    border-radius: 12px;
    color: #63b3ed;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .bg-picker-btn:hover {
    background: rgba(49, 130, 206, 0.3);
    border-color: rgba(49, 130, 206, 0.7);
  }

  .bg-remove-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .bg-remove-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .bg-hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    position: relative;
    z-index: 1;
  }

  .greeting {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .greeting h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .greeting h1.editable {
    cursor: pointer;
    padding: 4px 8px;
    margin: -4px -8px;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .greeting h1.editable:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .edit-icon {
    opacity: 0.5;
    margin-left: 4px;
  }

  .greeting h1.editable:hover .edit-icon {
    opacity: 1;
  }

  .greeting-input {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid #3182ce;
    border-radius: 8px;
    padding: 4px 12px;
    outline: none;
    min-width: 120px;
    max-width: 300px;
  }

  .greeting-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .bio-section {
    margin-left: 16px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    max-width: 400px;
  }

  .bio-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    line-height: 1.5;
  }

  .mini-widgets {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
  }

  .mini-widget {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    position: relative;
  }

  .mini-widget svg {
    opacity: 0.6;
  }

  .mini-widget.gif {
    padding: 4px;
  }

  .mini-gif {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    object-fit: cover;
  }

  .remove-widget {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: #ef4444;
    color: #fff;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .mini-widget:hover .remove-widget {
    opacity: 1;
  }

  .add-widget-wrapper {
    position: relative;
    z-index: 1000;
  }

  .add-widget-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 255, 255, 0.3);
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .add-widget-btn:hover {
    border-color: rgba(49, 130, 206, 0.6);
    color: #63b3ed;
    background: rgba(49, 130, 206, 0.1);
  }

  .widget-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 8px;
    min-width: 140px;
    z-index: 1001;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .widget-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .widget-menu button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .widget-menu button svg {
    opacity: 0.6;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .friend-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .friend-btn.add {
    background: #fff;
    color: #050505;
  }

  .friend-btn.add:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
  }

  .friend-btn.friends {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    cursor: default;
  }

  .friend-btn.pending {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    cursor: default;
  }

  .friend-btn.loading {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    min-width: 100px;
    justify-content: center;
  }

  .friend-btn:disabled {
    cursor: default;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .friend-error {
    font-size: 11px;
    color: #f87171;
  }

  .edit-space-btn, .save-btn, .cancel-btn {
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .edit-space-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .save-btn {
    background: #1a365d;
    border: none;
    color: #fff;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
  }

  .edit-space-btn:hover { background: rgba(255, 255, 255, 0.15); }
  .save-btn:hover { background: #2c5282; }
  .cancel-btn:hover { background: rgba(255, 255, 255, 0.05); }

  .header-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
  }

  .header-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .card-wrapper {
    position: relative;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .card-wrapper.small {
    flex: 1 1 calc(33.333% - 12px);
    min-width: 250px;
  }

  .card-wrapper.wide {
    flex: 1 1 calc(50% - 8px);
    min-width: 400px;
  }

  .card-wrapper.dragging {
    opacity: 0.5;
    transform: scale(0.98);
  }

  .card-wrapper.drag-over {
    transform: translateX(8px);
  }

  .drop-indicator {
    position: absolute;
    left: -8px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #3182ce;
    border-radius: 2px;
    z-index: 10;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .card {
    background: rgba(40, 40, 40, 0.6);
    border-radius: 16px;
    padding: 20px;
    position: relative;
    height: 100%;
    min-height: 200px;
    font-size: 18px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .card.edit-mode {
    cursor: grab;
    border: 2px dashed transparent;
  }

  .card.edit-mode:hover {
    border-color: rgba(49, 130, 206, 0.5);
    box-shadow: 0 0 20px rgba(49, 130, 206, 0.2);
  }

  .card.edit-mode:active {
    cursor: grabbing;
  }

  .card-edit-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    z-index: 5;
  }

  .drag-handle {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-card-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .remove-card-btn:hover {
    background: rgba(239, 68, 68, 0.4);
    color: #fff;
  }

  .quote-card { 
    padding: 16px;
    min-height: 250px;
  }

  .quote-content {
    height: 100%;
  }

  .gradient-card {
    padding: 0;
    overflow: visible;
    min-height: 220px;
  }

  .music-card {
    display: flex;
    flex-direction: column;
    padding: 12px;
    min-height: 280px;
  }

  .add-card-wrapper {
    position: relative;
  }

  .add-card {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(40, 40, 40, 0.3);
    border: 2px dashed rgba(49, 130, 206, 0.4);
    min-height: 160px;
    position: relative;
  }

  .add-new-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 20px;
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .add-new-btn:hover { 
    color: #63b3ed;
    background: rgba(49, 130, 206, 0.1);
  }

  .add-new-btn span {
    font-size: 14px;
    font-weight: 500;
  }

  .add-card-menu {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(25, 25, 25, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    padding: 12px;
    min-width: 280px;
    z-index: 1000;
    backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    animation: menuSlideUp 0.2s ease;
  }

  @keyframes menuSlideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .menu-header {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 8px;
  }

  .menu-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .menu-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.85);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .menu-option:hover:not(:disabled) {
    background: rgba(49, 130, 206, 0.15);
    border-color: rgba(49, 130, 206, 0.4);
  }

  .menu-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-label {
    flex: 1;
    text-align: left;
  }

  .option-badge {
    font-size: 9px;
    padding: 2px 6px;
    background: rgba(49, 130, 206, 0.3);
    color: #63b3ed;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .edit-hint {
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    margin-top: 24px;
    padding: 12px;
    background: rgba(49, 130, 206, 0.1);
    border-radius: 8px;
    border: 1px dashed rgba(49, 130, 206, 0.3);
    position: relative;
    z-index: 1;
  }

  /* Tablet breakpoint */
  @media (max-width: 900px) {
    .card-wrapper.small, .card-wrapper.wide {
      flex: 1 1 100%;
      min-width: unset;
    }
  }

  /* Mobile breakpoint */
  @media (max-width: 640px) {
    .profile-container {
      padding: 12px;
    }

    .profile-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
    }

    .greeting-section {
      width: 100%;
    }

    .greeting {
      font-size: 2.5rem;
    }

    .username {
      font-size: 2rem;
    }

    .header-right {
      width: 100%;
      justify-content: space-between;
    }

    .card {
      padding: 14px;
      min-height: 160px;
      font-size: 16px;
    }

    .card-edit-controls {
      top: 8px;
      right: 8px;
      gap: 4px;
    }

    .card-edit-controls button,
    .card-edit-controls .drag-handle {
      width: 24px;
      height: 24px;
    }

    .profile-grid {
      gap: 12px;
    }

    .edit-hint {
      font-size: 12px;
      padding: 10px;
      margin-top: 16px;
    }

    /* Card settings panel mobile */
    .card-settings-panel {
      width: 100%;
      max-width: 100vw;
      max-height: 90vh;
      border-radius: 16px 16px 0 0;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
    }

    .card-settings-overlay {
      align-items: flex-end;
    }

    .settings-header {
      padding: 16px 20px;
    }

    .settings-header h3 {
      font-size: 16px;
    }

    .settings-body {
      padding: 16px 20px;
      max-height: calc(90vh - 140px);
      gap: 16px;
    }

    .settings-footer {
      padding: 16px 20px;
    }

    .size-options {
      flex-wrap: wrap;
    }

    .size-option {
      flex: 1 1 calc(33% - 6px);
      min-width: 80px;
      padding: 10px 12px;
      font-size: 12px;
    }

    .font-options {
      gap: 6px;
    }

    .font-option {
      padding: 10px 12px;
      font-size: 14px;
    }

    .dimension-inputs,
    .border-inputs {
      flex-direction: column;
      gap: 10px;
    }

    .input-group {
      width: 100%;
    }

    .settings-body input[type="text"],
    .settings-body select {
      padding: 12px;
      font-size: 14px;
    }

    .color-input-row {
      flex-direction: column;
      gap: 8px;
    }

    .color-input-row input[type="color"] {
      width: 100%;
      height: 48px;
    }

    .reset-btn,
    .done-btn {
      padding: 14px 20px;
      font-size: 15px;
    }

    /* Add card menu mobile */
    .add-card-menu {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
      border-radius: 16px 16px 0 0;
      max-height: 60vh;
      overflow-y: auto;
    }

    .menu-options {
      grid-template-columns: 1fr;
    }

    .menu-option {
      padding: 14px;
    }
  }

  /* Small mobile */
  @media (max-width: 380px) {
    .greeting {
      font-size: 2rem;
    }

    .username {
      font-size: 1.5rem;
    }

    .card {
      padding: 12px;
      font-size: 14px;
    }

    .font-option {
      font-size: 12px;
      padding: 8px 10px;
    }
  }

  /* Card settings button */
  .card-settings-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(99, 179, 237, 0.2);
    color: #63b3ed;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .card-settings-btn:hover {
    background: rgba(99, 179, 237, 0.4);
    color: #fff;
  }

  /* Card background overlay for custom backgrounds */
  .card.has-custom-bg {
    position: relative;
    background-size: cover;
    background-position: center;
  }

  .card-bg-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border-radius: inherit;
    z-index: 0;
  }

  .card.has-custom-bg > :not(.card-bg-overlay) {
    position: relative;
    z-index: 1;
  }

  /* Card Settings Panel */
  .card-settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  }

  .card-settings-panel {
    background: #1e1e1e;
    border-radius: 16px;
    width: 420px;
    max-width: 90vw;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .settings-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .close-settings-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-settings-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .settings-body {
    padding: 20px 24px;
    overflow-y: auto;
    max-height: calc(85vh - 160px);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settings-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .size-options {
    display: flex;
    gap: 8px;
  }

  .size-option {
    flex: 1;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .size-option:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .size-option.active {
    background: rgba(99, 179, 237, 0.2);
    border-color: #63b3ed;
    color: #63b3ed;
  }

  /* Font options */
  .font-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .font-option {
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.85);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .font-option:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .font-option.active {
    background: rgba(99, 179, 237, 0.2);
    border-color: #63b3ed;
    color: #63b3ed;
  }

  .dimension-inputs,
  .border-inputs {
    display: flex;
    gap: 12px;
  }

  .input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-group label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .settings-body input[type="text"],
  .settings-body select {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-size: 13px;
    width: 100%;
    transition: all 0.15s ease;
  }

  .settings-body input[type="text"]:focus,
  .settings-body select:focus {
    outline: none;
    border-color: #63b3ed;
    background: rgba(99, 179, 237, 0.1);
  }

  .settings-body input[type="text"]::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .settings-body select {
    cursor: pointer;
  }

  .settings-body select option {
    background: #1e1e1e;
    color: #fff;
  }

  .color-input-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .color-input-row input[type="color"] {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    cursor: pointer;
    padding: 4px;
  }

  .color-input-row input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-input-row input[type="color"]::-webkit-color-swatch {
    border-radius: 4px;
    border: none;
  }

  .color-input-row input[type="text"] {
    flex: 1;
  }

  .opacity-slider {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    cursor: pointer;
  }

  .opacity-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #63b3ed;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .opacity-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #63b3ed;
    cursor: pointer;
    border: 2px solid #fff;
  }

  .settings-footer {
    display: flex;
    gap: 12px;
    padding: 20px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .reset-btn {
    flex: 1;
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .done-btn {
    flex: 1;
    padding: 12px 20px;
    border-radius: 8px;
    border: none;
    background: #3182ce;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .done-btn:hover {
    background: #2c5282;
  }

  /* Card transition animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Card entrance animations */
  .card-wrapper.transition-fade {
    animation: cardFadeIn 0.5s ease-out forwards;
  }

  .card-wrapper.transition-slide-up {
    animation: cardSlideUp 0.5s ease-out forwards;
  }

  .card-wrapper.transition-slide-down {
    animation: cardSlideDown 0.5s ease-out forwards;
  }

  .card-wrapper.transition-slide-left {
    animation: cardSlideLeft 0.5s ease-out forwards;
  }

  .card-wrapper.transition-slide-right {
    animation: cardSlideRight 0.5s ease-out forwards;
  }

  .card-wrapper.transition-zoom {
    animation: cardZoom 0.5s ease-out forwards;
  }

  .card-wrapper.transition-bounce {
    animation: cardBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  }

  @keyframes cardFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes cardSlideUp {
    from { 
      opacity: 0;
      transform: translateY(30px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes cardSlideDown {
    from { 
      opacity: 0;
      transform: translateY(-30px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes cardSlideLeft {
    from { 
      opacity: 0;
      transform: translateX(30px);
    }
    to { 
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes cardSlideRight {
    from { 
      opacity: 0;
      transform: translateX(-30px);
    }
    to { 
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes cardZoom {
    from { 
      opacity: 0;
      transform: scale(0.8);
    }
    to { 
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes cardBounce {
    from { 
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.95);
    }
    to { 
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Custom size card wrapper */
  .card-wrapper.custom {
    flex: 0 0 auto;
  }

  /* Settings body scrollbar */
  .settings-body::-webkit-scrollbar {
    width: 6px;
  }

  .settings-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .settings-body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
