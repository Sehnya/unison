<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User } from '../types';
  import MusicCard from './MusicCard.svelte';
  import ImageGalleryCard from './ImageGalleryCard.svelte';
  import FavoriteGamesCard from './FavoriteGamesCard.svelte';
  import GitHubProjectsCard from './GitHubProjectsCard.svelte';
  import FriendsCard from './FriendsCard.svelte';
  import EmbedCard from './EmbedCard.svelte';
  import CalendarCard from './CalendarCard.svelte';
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
    updatePageStyle,
    CUSTOM_FONTS,
    type ProfileData,
    type ProfileCard,
    type MiniWidget,
    type PageStyle
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
  
  // Bio editing state
  let editableBio = '';
  let isEditingBio = false;
  let bioTextarea: HTMLTextAreaElement;
  let bioFont = 'system-ui';
  let showBioFontMenu = false;
  
  // Available bio fonts
  const bioFonts = [
    { name: 'System', value: 'system-ui, -apple-system, sans-serif' },
    { name: 'Serif', value: 'Georgia, "Times New Roman", serif' },
    { name: 'Mono', value: '"SF Mono", "Fira Code", monospace' },
    { name: 'Handwriting', value: '"Caveat", cursive' },
    { name: 'Display', value: '"Playfair Display", serif' },
  ];
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
  
  type CardType = 'quote' | 'gradient' | 'music' | 'games' | 'github' | 'friends' | 'embed' | 'calendar';
  
  interface Card {
    id: string;
    type: CardType;
    size: 'small' | 'medium' | 'wide' | 'full' | 'custom';
    style?: CardStyle;
    gridColumn?: number;  // 1-4 for which column
    gridRow?: number;     // 1+ for which row
  }

  interface CardOption {
    type: CardType;
    label: string;
    icon: string;
    size: 'small' | 'medium' | 'wide' | 'full';
    singleton?: boolean;
  }

  const cardOptions: CardOption[] = [
    { type: 'quote', label: 'Quote Card', icon: '', size: 'small' },
    { type: 'gradient', label: 'Image Gallery', icon: '', size: 'medium' },
    { type: 'music', label: 'Music Player', icon: '', size: 'medium', singleton: true },
    { type: 'games', label: 'Favorite Games', icon: '', size: 'small' },
    { type: 'github', label: 'GitHub Projects', icon: '', size: 'medium' },
    { type: 'friends', label: 'Friends', icon: '', size: 'wide', singleton: true },
    { type: 'embed', label: 'Embed Player', icon: '', size: 'wide' },
    { type: 'calendar', label: 'Calendar', icon: '', size: 'full' },
  ];

  // Page style state
  let pageStyle: PageStyle = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 'medium',
    primaryColor: '#ffffff',
    accentColor: '#3182ce',
  };
  let showPageStyleMenu = false;

  // Page font options
  const pageFonts = [
    { name: 'System', value: 'system-ui, -apple-system, sans-serif' },
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Poppins', value: 'Poppins, sans-serif' },
    { name: 'Playfair', value: '"Playfair Display", serif' },
    { name: 'Merriweather', value: 'Merriweather, serif' },
    { name: 'Fira Code', value: '"Fira Code", monospace' },
    { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
  ];

  // Font size options
  const fontSizes = [
    { name: 'Small', value: 'small', scale: '0.875' },
    { name: 'Medium', value: 'medium', scale: '1' },
    { name: 'Large', value: 'large', scale: '1.125' },
    { name: 'X-Large', value: 'xlarge', scale: '1.25' },
  ];

  // Get font size scale
  function getFontSizeScale(size: string): string {
    const found = fontSizes.find(f => f.value === size);
    return found?.scale || '1';
  }

  // Resize state for cards
  let resizingCard: string | null = null;
  let resizeStartPos = { x: 0, y: 0 };
  let resizeStartSize = { width: 0, height: 0 };

  let cards: Card[] = [];
  let showAddCardMenu = false;
  let addCardMenuPos = { x: 0, y: 0 };
  let cardSettingsOpen: string | null = null; // ID of card being customized
  
  // Open add card menu positioned near the button
  function openAddCardMenu(e: MouseEvent) {
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    
    // Position menu above the button, centered
    addCardMenuPos = {
      x: rect.left + rect.width / 2 - 150, // Center the 300px menu
      y: rect.top - 12 // 12px above the button
    };
    
    // Clamp to viewport
    addCardMenuPos.x = Math.max(16, Math.min(addCardMenuPos.x, window.innerWidth - 316));
    
    showAddCardMenu = !showAddCardMenu;
  }
  
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
  
  // Get wrapper style for custom sizes and minHeight
  function getWrapperStyleCSS(card: Card): string {
    const styles: string[] = [];
    
    // Apply minHeight if set (from resize drag)
    if (card.style?.minHeight) {
      styles.push(`min-height: ${card.style.minHeight}`);
    }
    
    // Custom size width
    if (card.size === 'custom' && card.style?.width) {
      styles.push(`flex-basis: ${card.style.width}`);
    }
    
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
  function updateCardSize(cardId: string, size: 'small' | 'medium' | 'wide' | 'full' | 'custom') {
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
    
    // Load page style
    if (profileData.pageStyle) {
      pageStyle = profileData.pageStyle;
    }
    
    // Load bio font from user if available
    if (user?.bio_font) {
      bioFont = user.bio_font;
    }
    
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

  // Drag state for grid-based placement
  let draggedCard: Card | null = null;
  let draggedElement: HTMLElement | null = null;
  let dropTargetIndex: number | null = null;
  let isDragging = false;

  function handleDragStart(e: DragEvent, card: Card, element: HTMLElement) {
    if (!isEditMode) return;
    
    draggedCard = card;
    draggedElement = element;
    isDragging = true;
    
    // Use setTimeout to allow the drag image to be captured before adding class
    setTimeout(() => {
      element.classList.add('dragging');
    }, 0);
    
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.id);
      // Set a drag image
      const dragImage = element.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '0.8';
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 50, 50);
      setTimeout(() => dragImage.remove(), 0);
    }
  }

  function handleDragEnd() {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
    }
    draggedCard = null;
    draggedElement = null;
    dropTargetIndex = null;
    isDragging = false;
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (!isEditMode || !draggedCard) return;
    e.preventDefault();
    
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    
    const draggedIndex = cards.findIndex(c => c.id === draggedCard?.id);
    if (draggedIndex === index) {
      dropTargetIndex = null;
      return;
    }
    
    dropTargetIndex = index;
  }

  function handleDragLeave(e: DragEvent) {
    // Only clear if leaving the card entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest('.card-wrapper')) {
      dropTargetIndex = null;
    }
  }

  function handleDrop(e: DragEvent, targetIndex: number) {
    if (!isEditMode || !draggedCard) return;
    e.preventDefault();
    
    const draggedIndex = cards.findIndex(c => c.id === draggedCard?.id);
    if (draggedIndex === -1 || draggedIndex === targetIndex) {
      dropTargetIndex = null;
      isDragging = false;
      return;
    }

    // Reorder cards
    const newCards = [...cards];
    const [removed] = newCards.splice(draggedIndex, 1);
    
    // If dragging forward, adjust for the removal
    const insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex;
    newCards.splice(insertIndex, 0, removed);
    
    cards = newCards;
    dropTargetIndex = null;
    isDragging = false;
    updateProfileCards(cards as ProfileCard[]);
  }

  // Handle dropping on the grid background (at the end)
  function handleGridDrop(e: DragEvent) {
    if (!isEditMode || !draggedCard) return;
    
    // Only handle if not dropped on a card
    const target = e.target as HTMLElement;
    if (target.closest('.card-wrapper')) return;
    
    e.preventDefault();
    
    const draggedIndex = cards.findIndex(c => c.id === draggedCard?.id);
    if (draggedIndex === -1) return;

    // Move to end
    const newCards = [...cards];
    const [removed] = newCards.splice(draggedIndex, 1);
    newCards.push(removed);
    
    cards = newCards;
    dropTargetIndex = null;
    isDragging = false;
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

  function startEditingBio() {
    if (!isEditMode) return;
    editableBio = user?.description || bio || '';
    isEditingBio = true;
    setTimeout(() => bioTextarea?.focus(), 0);
  }

  async function finishEditingBio() {
    isEditingBio = false;
    
    // Save bio to server
    if (authToken) {
      try {
        const response = await fetch(apiUrl('/api/auth/profile'), {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bio: editableBio,
            bio_font: bioFont,
          }),
        });

        if (response.ok && user) {
          user.bio = editableBio;
        }
      } catch (error) {
        console.error('Error saving bio:', error);
      }
    }
  }

  function handleBioKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isEditingBio = false;
    }
  }

  function selectBioFont(font: string) {
    bioFont = font;
    showBioFontMenu = false;
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

  function formatLastActive(lastActive: string): string {
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Page style functions
  function handlePageFontChange(fontValue: string) {
    pageStyle = { ...pageStyle, fontFamily: fontValue };
    if (canEdit) {
      updatePageStyle({ fontFamily: fontValue });
    }
  }

  function handlePageFontSizeChange(sizeValue: string) {
    pageStyle = { ...pageStyle, fontSize: sizeValue as PageStyle['fontSize'] };
    if (canEdit) {
      updatePageStyle({ fontSize: sizeValue as PageStyle['fontSize'] });
    }
  }

  // Size cycle order for resize operations
  const sizeOrder: Array<'small' | 'medium' | 'wide' | 'full'> = ['small', 'medium', 'wide', 'full'];
  
  // Get current grid column count based on screen width
  function getGridColumns(): number {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width >= 1800) return 6;
    if (width >= 1600) return 4;
    if (width >= 1400) return 3;
    if (width >= 768) return 2;
    return 1;
  }

  // Resize handlers for cards - uses grid-based sizing
  function handleResizeStart(e: MouseEvent, cardId: string) {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    const cardWrapper = (e.currentTarget as HTMLElement).closest('.card-wrapper') as HTMLElement | null;
    if (!cardWrapper) return;
    
    startResize(e, cardId, cardWrapper);
  }

  // Resize state for smooth animations
  let resizeTargetSize: 'small' | 'medium' | 'wide' | 'full' | null = null;
  let resizeTargetHeight: number = 0;
  let resizeAnimationFrame: number | null = null;
  let resizeStartSize_initial: 'small' | 'medium' | 'wide' | 'full' | 'custom' | null = null;

  function startResize(e: MouseEvent, cardId: string, cardElement: HTMLElement) {
    resizingCard = cardId;
    resizeStartPos = { x: e.clientX, y: e.clientY };
    resizeStartSize = { 
      width: cardElement.offsetWidth, 
      height: cardElement.offsetHeight 
    };
    
    // Store initial size for reference
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex >= 0) {
      resizeStartSize_initial = cards[cardIndex].size;
      resizeTargetSize = cards[cardIndex].size as any;
      resizeTargetHeight = cardElement.offsetHeight;
    }
    
    // Add body class to prevent text selection during drag
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }

  function handleResize(e: MouseEvent) {
    if (!resizingCard) return;
    
    // Cancel any pending animation frame
    if (resizeAnimationFrame) {
      cancelAnimationFrame(resizeAnimationFrame);
    }
    
    // Use requestAnimationFrame for smooth updates
    resizeAnimationFrame = requestAnimationFrame(() => {
      if (!resizingCard) return;
      
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      
      const cardIndex = cards.findIndex(c => c.id === resizingCard);
      if (cardIndex === -1) return;
      
      const gridColumns = getGridColumns();
      
      // Calculate new size based on horizontal drag with smoothing
      // Use smaller threshold for more responsive feel
      const columnThreshold = 80;
      const spanDelta = Math.round(deltaX / columnThreshold);
      
      // Get initial span count (from when drag started)
      const initialSizeIndex = sizeOrder.indexOf(resizeStartSize_initial as any);
      const initialSpan = initialSizeIndex >= 0 ? initialSizeIndex + 1 : 1;
      
      // Calculate new span (clamped to grid columns)
      const newSpan = Math.max(1, Math.min(gridColumns, initialSpan + spanDelta));
      
      // Map span to size
      let newSize: 'small' | 'medium' | 'wide' | 'full';
      if (newSpan >= gridColumns) {
        newSize = 'full';
      } else if (newSpan >= 3) {
        newSize = 'wide';
      } else if (newSpan >= 2) {
        newSize = 'medium';
      } else {
        newSize = 'small';
      }
      
      // Calculate new height with smooth interpolation
      const newHeight = Math.max(180, Math.round(resizeStartSize.height + deltaY));
      
      // Update target indicators
      resizeTargetSize = newSize;
      resizeTargetHeight = newHeight;
      
      // Update card state
      const currentCard = cards[cardIndex];
      if (currentCard.size !== newSize || 
          Math.abs((parseInt(currentCard.style?.minHeight || '0') || 0) - newHeight) > 5) {
        cards[cardIndex] = {
          ...currentCard,
          size: newSize,
          style: {
            ...currentCard.style,
            minHeight: `${newHeight}px`,
          }
        };
        cards = [...cards];
      }
    });
  }

  function stopResize() {
    // Cancel any pending animation
    if (resizeAnimationFrame) {
      cancelAnimationFrame(resizeAnimationFrame);
      resizeAnimationFrame = null;
    }
    
    // Reset body styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    if (resizingCard && canEdit) {
      updateProfileCards(cards as ProfileCard[]);
    }
    
    resizingCard = null;
    resizeTargetSize = null;
    resizeStartSize_initial = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
  
  // Quick resize buttons - cycle through sizes
  function cycleCardSize(cardId: string, direction: 'expand' | 'shrink') {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const currentSize = cards[cardIndex].size;
    const currentIndex = sizeOrder.indexOf(currentSize as any);
    
    let newIndex: number;
    if (direction === 'expand') {
      newIndex = Math.min(sizeOrder.length - 1, currentIndex + 1);
    } else {
      newIndex = Math.max(0, currentIndex - 1);
    }
    
    cards[cardIndex] = { ...cards[cardIndex], size: sizeOrder[newIndex] };
    cards = [...cards];
    
    if (canEdit) {
      updateProfileCards(cards as ProfileCard[]);
    }
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

<div class="profile-container" style="{backgroundImage ? `background-image: url(${backgroundImage});` : ''} font-family: {pageStyle.fontFamily}; --font-scale: {getFontSizeScale(pageStyle.fontSize)};" class:has-background={backgroundImage}>
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

  <input 
    type="file" 
    bind:this={miniGifInput}
    on:change={handleMiniGifUpload}
    accept="image/gif,image/png,image/jpeg,image/webp"
    class="hidden-input"
  />

  <!-- Top bar with edit controls -->
  <header class="profile-top-bar">
    <div class="top-bar-left">
      {#if isEditMode}
        <button class="bg-picker-btn" on:click={triggerFileInput}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span>{backgroundImage ? 'Change BG' : 'Add BG'}</span>
        </button>
        {#if backgroundImage}
          <button class="bg-remove-btn" on:click={removeBackground} title="Remove background">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        {/if}
        
        <!-- Page Style Button -->
        <div class="page-style-wrapper">
          <button class="page-style-btn" on:click={() => showPageStyleMenu = !showPageStyleMenu}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"/>
              <line x1="9" y1="20" x2="15" y2="20"/>
              <line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
            <span>Page Style</span>
          </button>
          
          {#if showPageStyleMenu}
            <div class="page-style-menu">
              <div class="style-section">
                <label class="style-label">Page Font</label>
                <div class="font-options-grid">
                  {#each pageFonts as font}
                    <button 
                      class="font-opt" 
                      class:active={pageStyle.fontFamily === font.value}
                      style="font-family: {font.value}"
                      on:click={() => handlePageFontChange(font.value)}
                    >
                      {font.name}
                    </button>
                  {/each}
                </div>
              </div>
              
              <div class="style-section">
                <label class="style-label">Text Size</label>
                <div class="size-options-row">
                  {#each fontSizes as size}
                    <button 
                      class="size-opt" 
                      class:active={pageStyle.fontSize === size.value}
                      on:click={() => handlePageFontSizeChange(size.value)}
                    >
                      {size.name}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="top-bar-right">
      {#if canEdit}
        {#if isEditMode}
          <button class="save-btn" on:click={saveLayout}>Save</button>
          <button class="cancel-btn" on:click={() => isEditMode = false}>Cancel</button>
        {:else}
          <button class="edit-space-btn" on:click={toggleEditMode}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Edit Space
          </button>
        {/if}
      {:else}
        {#if friendRequestStatus === 'loading'}
          <button class="friend-btn loading" disabled>
            <span class="spinner-small"></span>
          </button>
        {:else if friendRequestStatus === 'friends'}
          <button class="friend-btn friends" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Friends
          </button>
        {:else if friendRequestStatus === 'pending' || friendRequestStatus === 'sent'}
          <button class="friend-btn pending" disabled>Request Sent</button>
        {:else}
          <button class="friend-btn add" on:click={sendFriendRequest}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Add Friend
          </button>
        {/if}
      {/if}
    </div>
  </header>

  <!-- Main two-column layout -->
  <div class="profile-layout">
    <!-- Left Column: Profile Card -->
    <aside class="profile-sidebar">
      <div class="profile-card">
        <!-- Large Avatar -->
        <div class="profile-avatar-section">
          <div class="profile-avatar-wrapper">
            <Avatar 
              src={avatar}
              username={username}
              userId={user?.id || currentUserId}
              size={200}
            />
            <div class="status-indicator {user?.status || 'offline'}"></div>
          </div>
        </div>

        <!-- Username -->
        <h1 class="profile-username">{username}</h1>

        <!-- Bio/Description -->
        <div class="bio-section">
          {#if isEditMode && isEditingBio}
            <div class="bio-edit-container">
              <textarea
                bind:this={bioTextarea}
                bind:value={editableBio}
                on:blur={finishEditingBio}
                on:keydown={handleBioKeydown}
                class="bio-textarea"
                style="font-family: {bioFont}"
                placeholder="Write something about yourself..."
                maxlength="200"
              ></textarea>
              <span class="bio-char-count">{editableBio.length}/200</span>
            </div>
          {:else}
            <p 
              class="profile-description"
              class:placeholder={!bio && !user?.description}
              class:editable={isEditMode}
              style="font-family: {bioFont}"
              on:click={startEditingBio}
              on:keydown={(e) => e.key === 'Enter' && startEditingBio()}
              role={isEditMode ? 'button' : undefined}
              tabindex={isEditMode ? 0 : undefined}
            >
              {#if bio || user?.description}
                {user?.description || bio}
              {:else if isEditMode}
                Click to add a bio...
              {/if}
              {#if isEditMode}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="bio-edit-icon">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              {/if}
            </p>
          {/if}
          
          {#if isEditMode}
            <div class="bio-font-picker">
              <button class="font-picker-btn" on:click={() => showBioFontMenu = !showBioFontMenu}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 7 4 4 20 4 20 7"/>
                  <line x1="9" y1="20" x2="15" y2="20"/>
                  <line x1="12" y1="4" x2="12" y2="20"/>
                </svg>
                Font
              </button>
              
              {#if showBioFontMenu}
                <div class="bio-font-menu">
                  {#each bioFonts as font}
                    <button 
                      class="font-option"
                      class:active={bioFont === font.value}
                      style="font-family: {font.value}"
                      on:click={() => selectBioFont(font.value)}
                    >
                      {font.name}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Info Grid -->
        <div class="profile-info-grid">
          {#if user?.age}
            <div class="info-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span class="info-label">Age</span>
              <span class="info-value">{user.age}</span>
            </div>
          {/if}
          
          {#if user?.location}
            <div class="info-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span class="info-label">Location</span>
              <span class="info-value">{user.location}</span>
            </div>
          {/if}
        </div>

        <!-- Mood Card -->
        {#if user?.mood || user?.mood_emoji}
          <div class="mood-card">
            <span class="mood-emoji">{user?.mood_emoji || '💭'}</span>
            <span class="mood-text">{user?.mood || 'Feeling good'}</span>
          </div>
        {:else if isOwnProfile}
          <div class="mood-card placeholder">
            <span class="mood-emoji">💭</span>
            <span class="mood-text">Set your mood...</span>
          </div>
        {/if}

        <!-- Last Active -->
        <div class="last-active">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          {#if user?.status === 'online'}
            <span>Online now</span>
          {:else if user?.last_active}
            <span>Last seen {formatLastActive(user.last_active)}</span>
          {:else}
            <span>Offline</span>
          {/if}
        </div>

        <!-- Mini Widgets -->
        {#if miniWidgets.length > 0 || isEditMode}
          <div class="profile-widgets">
            {#each miniWidgets as widget (widget.id)}
              <div class="mini-widget {widget.type}">
                {#if widget.type === 'date'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>{currentDate}</span>
                {:else if widget.type === 'time'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
                
                {#if showWidgetMenu}
                  <div class="widget-menu">
                    <button on:click={() => addWidget('date')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      </svg>
                      Date
                    </button>
                    <button on:click={() => addWidget('time')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                      </svg>
                      Time
                    </button>
                    <button on:click={() => addWidget('gif')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      </svg>
                      GIF
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </aside>

    <!-- Right Column: Customizable Cards -->
    <main class="profile-content">
      <div class="content-header">
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
          <h2 
            class="greeting-title"
            class:editable={isEditMode}
            on:click={startEditingGreeting}
            on:keydown={(e) => e.key === 'Enter' && startEditingGreeting()}
            role={isEditMode ? 'button' : undefined}
            tabindex={isEditMode ? 0 : undefined}
          >
            {customGreeting}
            {#if isEditMode}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edit-icon">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            {/if}
          </h2>
        {/if}
      </div>

      <div 
        class="profile-grid" 
        class:edit-mode={isEditMode} 
        class:is-dragging={isDragging}
        on:dragover|preventDefault
        on:drop={handleGridDrop}
      >
        {#each cards as card, index (card.id)}
          <div
            class="card-wrapper {card.size} {getTransitionClass(card)}"
            class:dragging={draggedCard?.id === card.id}
            class:resizing={resizingCard === card.id}
            class:drop-target={dropTargetIndex === index && draggedCard?.id !== card.id}
            style={getWrapperStyleCSS(card)}
            draggable={isEditMode ? "true" : "false"}
            on:dragstart={(e) => handleDragStart(e, card, e.currentTarget)}
            on:dragend={handleDragEnd}
            on:dragover={(e) => handleDragOver(e, index)}
            on:dragleave={handleDragLeave}
            on:drop={(e) => handleDrop(e, index)}
            role={isEditMode ? "button" : undefined}
            tabindex={isEditMode ? 0 : undefined}
          >
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
              <!-- Quick size controls -->
              <div class="size-controls">
                <button 
                  class="size-ctrl-btn shrink" 
                  on:click|stopPropagation={() => cycleCardSize(card.id, 'shrink')}
                  disabled={card.size === 'small'}
                  title="Shrink"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M5 12h14"/>
                  </svg>
                </button>
                <span class="size-label">{card.size === 'small' ? '1x' : card.size === 'medium' ? '2x' : card.size === 'wide' ? '3x' : card.size === 'full' ? 'full' : '●'}</span>
                <button 
                  class="size-ctrl-btn expand" 
                  on:click|stopPropagation={() => cycleCardSize(card.id, 'expand')}
                  disabled={card.size === 'full'}
                  title="Expand"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
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
            <!-- Resize handle for drag-to-resize -->
            <div 
              class="resize-handle"
              class:active={resizingCard === card.id}
              on:mousedown={(e) => handleResizeStart(e, card.id)}
              role="button"
              aria-label="Resize card"
              tabindex="0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18"/>
                <path d="M18 13L13 18"/>
                <path d="M18 18h0"/>
              </svg>
              {#if resizingCard === card.id && resizeTargetSize}
                <div class="resize-tooltip">
                  {resizeTargetSize === 'small' ? '1×1' : resizeTargetSize === 'medium' ? '2×1' : resizeTargetSize === 'wide' ? '3×1' : 'full'}
                </div>
              {/if}
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

          {:else if card.type === 'embed'}
            <EmbedCard 
              editable={isEditMode && isOwnProfile} 
              cardId={card.id}
              profileEmbedData={profileData?.embedCards?.[card.id] || null}
              isOwnProfile={isOwnProfile}
            />

          {:else if card.type === 'calendar'}
            <CalendarCard 
              editable={isEditMode && isOwnProfile} 
              cardId={card.id}
              profileCalendarData={profileData?.calendarCards?.[card.id] || null}
              isOwnProfile={isOwnProfile}
            />
          {/if}
        </div>
      </div>
        {/each}

        {#if isEditMode}
          <div class="card-wrapper small add-card-wrapper">
            <div class="card add-card">
              <button class="add-new-btn" on:click={openAddCardMenu}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
                <span>Add Card</span>
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Add card menu portal - positioned fixed on top of everything -->
      {#if showAddCardMenu}
        <div 
          class="add-card-menu-backdrop" 
          on:click={() => showAddCardMenu = false}
          on:keydown={(e) => e.key === 'Escape' && (showAddCardMenu = false)}
          role="button"
          tabindex="-1"
        ></div>
        <div 
          class="add-card-menu" 
          style="left: {addCardMenuPos.x}px; bottom: {window.innerHeight - addCardMenuPos.y}px;"
        >
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

      {#if isEditMode}
        <div class="edit-hint">Drag cards to rearrange • Click ⚙️ for card settings • Drag corner to resize • Click + to add new cards</div>
      {/if}
    </main>
  </div>
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
              >1x</button>
              <button 
                class="size-option" 
                class:active={editingCard.size === 'medium'}
                on:click={() => updateCardSize(editingCard.id, 'medium')}
              >2x</button>
              <button 
                class="size-option" 
                class:active={editingCard.size === 'wide'}
                on:click={() => updateCardSize(editingCard.id, 'wide')}
              >3x</button>
              <button 
                class="size-option" 
                class:active={editingCard.size === 'full'}
                on:click={() => updateCardSize(editingCard.id, 'full')}
              >Full</button>
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
    background: #0a0a0a;
    padding: 20px;
    overflow-x: hidden;
    overflow-y: auto;
    position: relative;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    font-size: calc(1rem * var(--font-scale, 1));
  }

  .profile-container.has-background {
    background-color: transparent;
  }

  /* Apply font scale to text elements */
  .profile-container :global(h1),
  .profile-container :global(h2),
  .profile-container :global(h3),
  .profile-container :global(p),
  .profile-container :global(span),
  .profile-container :global(div) {
    font-family: inherit;
  }

  .background-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    pointer-events: none;
    z-index: 0;
  }

  .hidden-input {
    display: none;
  }

  /* Top Bar */
  .profile-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    margin-bottom: 20px;
    position: relative;
    z-index: 10;
    background: rgba(20, 20, 20, 0.8);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .top-bar-left, .top-bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bg-picker-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .bg-picker-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .bg-remove-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .bg-remove-btn:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  /* Page Style Controls */
  .page-style-wrapper {
    position: relative;
  }

  .page-style-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .page-style-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .page-style-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: rgba(25, 25, 25, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 16px;
    min-width: 280px;
    z-index: 100;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .style-section {
    margin-bottom: 16px;
  }

  .style-section:last-child {
    margin-bottom: 0;
  }

  .style-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }

  .font-options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .font-opt {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }

  .font-opt:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .font-opt.active {
    background: rgba(99, 179, 237, 0.2);
    border-color: #63b3ed;
    color: #63b3ed;
  }

  .size-options-row {
    display: flex;
    gap: 6px;
  }

  .size-opt {
    flex: 1;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }

  .size-opt:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .size-opt.active {
    background: rgba(99, 179, 237, 0.2);
    border-color: #63b3ed;
    color: #63b3ed;
  }

  /* Size Controls */
  .size-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 2px;
  }

  .size-ctrl-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .size-ctrl-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .size-ctrl-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .size-ctrl-btn.expand:hover:not(:disabled) {
    background: rgba(99, 179, 237, 0.3);
    color: #63b3ed;
  }

  .size-ctrl-btn.shrink:hover:not(:disabled) {
    background: rgba(239, 154, 68, 0.3);
    color: #ef9a44;
  }

  .size-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    min-width: 28px;
    text-align: center;
    text-transform: lowercase;
    letter-spacing: 0.5px;
  }

  /* Resize Handle - Drag to resize */
  .resize-handle {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    cursor: se-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    background: transparent;
    border: none;
    border-radius: 6px;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 15;
    opacity: 0;
  }

  .card-wrapper:hover .resize-handle,
  .resize-handle:focus {
    opacity: 1;
  }

  .resize-handle:hover {
    color: #63b3ed;
    background: rgba(99, 179, 237, 0.1);
    transform: scale(1.15);
  }

  .resize-handle.active {
    opacity: 1;
    color: #63b3ed;
    background: rgba(99, 179, 237, 0.2);
    transform: scale(1.2);
    box-shadow: 0 0 12px rgba(99, 179, 237, 0.4);
  }

  /* Size tooltip during resize */
  .resize-tooltip {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    padding: 6px 10px;
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(99, 179, 237, 0.5);
    border-radius: 6px;
    color: #63b3ed;
    font-size: 12px;
    font-weight: 600;
    font-family: 'SF Mono', 'Monaco', monospace;
    white-space: nowrap;
    pointer-events: none;
    animation: tooltipPop 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .resize-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    right: 8px;
    border: 5px solid transparent;
    border-top-color: rgba(99, 179, 237, 0.5);
  }

  @keyframes tooltipPop {
    0% { transform: scale(0.8) translateY(4px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }

  .edit-space-btn, .save-btn, .cancel-btn, .friend-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .edit-space-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .edit-space-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .save-btn {
    background: #fff;
    color: #000;
  }

  .save-btn:hover {
    background: #f0f0f0;
  }

  .cancel-btn {
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .friend-btn.add {
    background: #fff;
    color: #000;
  }

  .friend-btn.friends {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .friend-btn.pending {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Two Column Layout */
  .profile-layout {
    display: flex;
    gap: 24px;
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  /* Left Sidebar - Profile Card */
  .profile-sidebar {
    flex-shrink: 0;
    width: 320px;
  }

  .profile-card {
    background: rgba(18, 18, 18, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 32px 24px;
    backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    position: sticky;
    top: 20px;
  }

  .profile-avatar-section {
    position: relative;
  }

  .profile-avatar-wrapper {
    position: relative;
    width: 200px;
    height: 200px;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 3px solid rgba(255, 255, 255, 0.1);
  }

  .profile-avatar-wrapper :global(.avatar) {
    width: 100% !important;
    height: 100% !important;
    border-radius: 16px;
  }

  .status-indicator {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 4px solid rgba(18, 18, 18, 0.95);
    z-index: 2;
  }

  .status-indicator.online { background: #22c55e; }
  .status-indicator.idle { background: #f59e0b; }
  .status-indicator.dnd { background: #ef4444; }
  .status-indicator.offline { background: #6b7280; }

  .profile-username {
    font-size: 30px;
    font-weight: 700;
    color: #fff;
    margin: 0;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .bio-section {
    width: 100%;
    position: relative;
  }

  .profile-description {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    line-height: 1.6;
    margin: 0;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 60px;
  }

  .profile-description.editable {
    cursor: pointer;
    border-radius: 12px;
    transition: background 0.2s ease;
  }

  .profile-description.editable:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .profile-description.placeholder {
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
    font-size: 14px;
  }

  .bio-edit-icon {
    opacity: 0.4;
    flex-shrink: 0;
  }

  .profile-description.editable:hover .bio-edit-icon {
    opacity: 0.8;
  }

  .bio-edit-container {
    position: relative;
    width: 100%;
  }

  .bio-textarea {
    width: 100%;
    min-height: 80px;
    padding: 12px 16px;
    font-size: 18px;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    resize: none;
    outline: none;
    text-align: center;
    line-height: 1.6;
    transition: border-color 0.2s ease;
  }

  .bio-textarea:focus {
    border-color: rgba(255, 255, 255, 0.4);
  }

  .bio-textarea::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .bio-char-count {
    position: absolute;
    bottom: 8px;
    right: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  .bio-font-picker {
    display: flex;
    justify-content: center;
    position: relative;
  }

  .font-picker-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .font-picker-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .bio-font-menu {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: rgba(25, 25, 25, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 8px;
    min-width: 160px;
    z-index: 100;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .bio-font-menu .font-option {
    display: block;
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    text-align: left;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .bio-font-menu .font-option:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .bio-font-menu .font-option.active {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .profile-info-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    width: 100%;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .info-item svg {
    color: rgba(255, 255, 255, 0.5);
  }

  .info-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-value {
    font-size: 13px;
    color: #fff;
    font-weight: 500;
  }

  .mood-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 12px;
    width: 100%;
  }

  .mood-card.placeholder {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.1);
    border-style: dashed;
  }

  .mood-emoji {
    font-size: 24px;
  }

  .mood-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
  }

  .mood-card.placeholder .mood-text {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .last-active {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .profile-widgets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    width: 100%;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mini-widget {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    position: relative;
  }

  .mini-widget svg {
    opacity: 0.6;
  }

  .mini-widget.gif {
    padding: 4px;
  }

  .mini-gif {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    object-fit: cover;
  }

  .remove-widget {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: #ef4444;
    color: #fff;
    font-size: 12px;
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
  }

  .add-widget-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px dashed rgba(255, 255, 255, 0.3);
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .add-widget-btn:hover {
    border-color: rgba(255, 255, 255, 0.5);
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.05);
  }

  .widget-menu {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: rgba(25, 25, 25, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 6px;
    min-width: 100px;
    z-index: 100;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .widget-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .widget-menu button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Right Content Area */
  .profile-content {
    flex: 1;
    min-width: 0;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow: hidden;
  }

  .content-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .greeting-title {
    font-size: 28px;
    font-weight: 600;
    color: #fff;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .greeting-title.editable {
    cursor: pointer;
    padding: 6px 12px;
    margin: -6px -12px;
    border-radius: 10px;
    transition: background 0.2s ease;
  }

  .greeting-title.editable:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .greeting-title .edit-icon {
    opacity: 0.4;
    transition: opacity 0.2s ease;
  }

  .greeting-title.editable:hover .edit-icon {
    opacity: 0.8;
  }

  .greeting-input {
    font-size: 28px;
    font-weight: 600;
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    padding: 6px 16px;
    outline: none;
    min-width: 200px;
    max-width: 400px;
  }

  .greeting-input:focus {
    border-color: #fff;
  }

  .greeting-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  /* Profile Grid - Flexible Auto-flow Layout */
  .profile-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: minmax(200px, auto);
    grid-auto-flow: dense; /* Auto-reflow cards to fill gaps */
    gap: 16px;
    position: relative;
    z-index: 1;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    overflow: visible; /* Allow resize handles to show */
  }

  .card-wrapper {
    position: relative;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), 
                opacity 0.2s ease,
                grid-column 0.3s ease,
                min-height 0.3s ease;
    min-height: 200px;
    width: 100%;
    max-width: 100%;
    display: flex;
    overflow: visible; /* Allow resize handle to show outside */
    contain: layout style; /* Performance optimization */
  }

  /* Card sizes using grid span - 4 column system */
  .card-wrapper.small {
    grid-column: span 1;
  }

  .card-wrapper.medium {
    grid-column: span 2;
  }

  .card-wrapper.wide {
    grid-column: span 3;
  }

  .card-wrapper.full {
    grid-column: span 4;
  }

  /* Custom sized cards inherit their minHeight from inline style */
  .card-wrapper.custom {
    grid-column: span 2;
  }
  
  /* Resizing state - disable transitions for instant feedback during drag */
  .card-wrapper.resizing {
    z-index: 100;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    transition: none !important; /* Instant feedback during drag */
  }
  
  .card-wrapper.resizing .card {
    box-shadow: 0 0 0 2px rgba(99, 179, 237, 0.4);
    transition: box-shadow 0.15s ease !important;
  }
  
  /* Other cards shift smoothly when one is being resized */
  .profile-grid:has(.resizing) .card-wrapper:not(.resizing) {
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                grid-column 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Add card wrapper styling */
  .card-wrapper.add-card-wrapper {
    min-height: 180px;
    grid-column: span 1;
  }

  .card-wrapper.dragging {
    opacity: 0.4;
    transform: scale(0.95);
  }

  /* Drop target indicator */
  .card-wrapper.drop-target {
    position: relative;
  }

  .card-wrapper.drop-target::before {
    content: '';
    position: absolute;
    inset: -4px;
    border: 3px dashed #63b3ed;
    border-radius: 20px;
    background: rgba(99, 179, 237, 0.1);
    z-index: 10;
    animation: pulse 1s ease-in-out infinite;
    pointer-events: none;
  }

  /* Grid dragging state */
  .profile-grid.is-dragging {
    min-height: 200px;
  }

  .profile-grid.is-dragging .card-wrapper:not(.dragging):not(.drop-target) {
    opacity: 0.7;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .card {
    background: rgba(30, 30, 30, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 16px;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 180px;
    font-size: 16px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .card:hover {
    border-color: rgba(255, 255, 255, 0.15);
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
    left: 8px;
    display: flex;
    gap: 6px;
    z-index: 5;
  }

  .drag-handle {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-card-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: #f87171;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .remove-card-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
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
    padding: 0;
    min-height: 220px;
  }

  .embed-card {
    padding: 0;
    min-height: 180px;
  }
  
  .calendar-card {
    padding: 12px;
    min-height: 200px;
  }

  .gradient-card {
    padding: 0;
    min-height: 180px;
  }

  .games-card {
    padding: 12px;
    min-height: 160px;
  }

  .github-card {
    padding: 12px;
    min-height: 160px;
  }

  .friends-card {
    padding: 12px;
    min-height: 180px;
  }

  .quote-card {
    padding: 16px;
    min-height: 160px;
  }

  .add-card-wrapper {
    position: relative;
    overflow: visible !important; /* Allow dropdown to show */
  }

  .add-card {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(30, 30, 30, 0.4);
    border: 2px dashed rgba(255, 255, 255, 0.15);
    min-height: 140px;
    position: relative;
    transition: all 0.2s ease;
    overflow: visible !important; /* Allow dropdown to show */
  }

  .add-card:hover {
    border-color: rgba(99, 179, 237, 0.5);
    background: rgba(99, 179, 237, 0.05);
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

  /* Add card menu backdrop */
  .add-card-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99998;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    animation: backdropFade 0.15s ease;
  }

  @keyframes backdropFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .add-card-menu {
    position: fixed;
    z-index: 99999;
    background: rgba(20, 20, 20, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 16px;
    min-width: 300px;
    backdrop-filter: blur(24px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    animation: menuPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes menuPop {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
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

  /* Extra large screens - 6 column layout for more flexibility */
  @media (min-width: 1800px) {
    .profile-grid {
      grid-template-columns: repeat(6, 1fr);
      gap: 20px;
    }

    .card-wrapper.small {
      grid-column: span 1;
    }

    .card-wrapper.medium {
      grid-column: span 2;
    }

    .card-wrapper.wide {
      grid-column: span 3;
    }

    .card-wrapper.full {
      grid-column: span 6;
    }
  }

  /* Large screens - 4 column (default above) */
  @media (max-width: 1600px) {
    .profile-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .card-wrapper.small {
      grid-column: span 1;
    }

    .card-wrapper.medium {
      grid-column: span 2;
    }

    .card-wrapper.wide {
      grid-column: span 3;
    }

    .card-wrapper.full {
      grid-column: span 4;
    }
  }

  /* Medium screens - 3 column */
  @media (max-width: 1400px) {
    .profile-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .card-wrapper.small {
      grid-column: span 1;
    }

    .card-wrapper.medium {
      grid-column: span 1;
    }

    .card-wrapper.wide {
      grid-column: span 2;
    }

    .card-wrapper.full {
      grid-column: span 3;
    }
  }

  /* Tablet/Medium screens - 2 column */
  @media (max-width: 1200px) {
    .profile-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .card-wrapper.small,
    .card-wrapper.medium {
      grid-column: span 1;
    }

    .card-wrapper.wide,
    .card-wrapper.full {
      grid-column: span 2;
    }
  }

  /* Tablet breakpoint - stacked layout */
  @media (max-width: 1024px) {
    .profile-layout {
      flex-direction: column;
    }

    .profile-sidebar {
      width: 100%;
    }

    .profile-card {
      flex-direction: row;
      flex-wrap: wrap;
      padding: 24px;
      gap: 24px;
      position: static;
    }

    .profile-avatar-section {
      flex-shrink: 0;
    }

    .profile-avatar-wrapper {
      width: 120px;
      height: 120px;
    }

    .profile-username {
      font-size: 24px;
    }
  }

  /* Small tablet / large phone */
  @media (max-width: 768px) {
    .profile-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .card-wrapper.small,
    .card-wrapper.medium {
      grid-column: span 1;
    }

    .card-wrapper.wide,
    .card-wrapper.full {
      grid-column: span 2;
    }

    .card-wrapper {
      min-height: 180px;
    }
  }

  /* Mobile breakpoint */
  @media (max-width: 640px) {
    .profile-container {
      padding: 12px;
    }

    .profile-top-bar {
      flex-direction: column;
      gap: 12px;
      padding: 12px;
    }

    .profile-card {
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 20px;
    }

    .profile-avatar-wrapper {
      width: 100px;
      height: 100px;
    }

    .profile-username {
      font-size: 22px;
    }

    .greeting-title {
      font-size: 20px;
    }

    .profile-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .card-wrapper.small,
    .card-wrapper.medium,
    .card-wrapper.wide,
    .card-wrapper.full {
      grid-column: span 1;
    }

    .card-wrapper {
      min-height: 160px;
    }

    .card {
      padding: 14px;
      min-height: 140px;
    }

    .card-edit-controls {
      top: 6px;
      left: 6px;
      gap: 4px;
    }

    .card-edit-controls button,
    .card-edit-controls .drag-handle {
      width: 24px;
      height: 24px;
    }

    .profile-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .card-wrapper.small,
    .card-wrapper.wide {
      grid-column: span 1;
    }

    .card-wrapper {
      min-height: 160px;
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
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .card-settings-btn:hover {
    background: rgba(0, 0, 0, 0.7);
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
