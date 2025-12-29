<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User } from '../types';
  import TipTapEditor from './TipTapEditor.svelte';
  import MusicCard from './MusicCard.svelte';
  import ImageGalleryCard from './ImageGalleryCard.svelte';
  import FavoriteGamesCard from './FavoriteGamesCard.svelte';
  import GitHubProjectsCard from './GitHubProjectsCard.svelte';
  import FriendsCard from './FriendsCard.svelte';
  import {
    loadProfile,
    saveProfile,
    updateProfileCards,
    updateProfileGreeting,
    updateProfileBackground,
    updateProfileWidgets,
    updateQuoteCard,
    removeCardData,
    type ProfileData,
    type ProfileCard,
    type MiniWidget
  } from '../lib/profileStorage';

  export let user: User | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  $: username = user?.username || 'Dear';
  $: avatar = user?.avatar || 'https://i.pravatar.cc/100?img=68';
  $: bio = user?.bio || '';

  let isEditMode = false;
  let backgroundImage: string | null = null;
  let fileInput: HTMLInputElement;
  let customGreeting = 'HI,';
  let isEditingGreeting = false;
  let greetingInput: HTMLInputElement;
  let showWidgetMenu = false;
  let miniGifInput: HTMLInputElement;
  let profileData: ProfileData | null = null;

  let miniWidgets: MiniWidget[] = [];

  // Quote card content (keyed by card id)
  let quoteContents: Record<string, string> = {};

  // Card definitions
  type CardType = 'quote' | 'gradient' | 'music' | 'games' | 'github' | 'friends';
  
  interface Card {
    id: string;
    type: CardType;
    size: 'small' | 'wide';
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

  // Load profile data on mount
  onMount(() => {
    profileData = loadProfile();
    
    // Load layout
    cards = profileData.cards as Card[];
    customGreeting = profileData.greeting;
    backgroundImage = profileData.backgroundImage;
    miniWidgets = profileData.miniWidgets;
    
    // Load quote contents
    if (profileData.quoteCards) {
      quoteContents = Object.fromEntries(
        Object.entries(profileData.quoteCards).map(([id, data]) => [id, data.content])
      );
    }
  });

  function getQuoteContent(cardId: string): string {
    return quoteContents[cardId] || `<h1>BE<br>KIND<br>AND<br>BRIGHT</h1><p><strong>Lorem ipsum</strong> dolor sit amet.</p>`;
  }

  function handleQuoteUpdate(cardId: string, e: CustomEvent<{ html: string }>) {
    quoteContents[cardId] = e.detail.html;
    updateQuoteCard(cardId, e.detail.html);
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

  function handleBackgroundUpload(e: Event) {
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
    reader.onload = (event) => {
      backgroundImage = event.target?.result as string;
      updateProfileBackground(backgroundImage);
    };
    reader.readAsDataURL(file);
  }

  function removeBackground() {
    backgroundImage = null;
    updateProfileBackground(null);
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
      {#if isEditMode}
        <button class="save-btn" on:click={saveLayout}>save changes</button>
        <button class="cancel-btn" on:click={() => isEditMode = false}>cancel</button>
      {:else}
        <button class="edit-space-btn" on:click={toggleEditMode}>edit my space</button>
      {/if}
      <div class="header-avatar">
        <img src={avatar} alt={username} />
      </div>
    </div>
  </header>

  <div class="profile-grid" class:edit-mode={isEditMode}>
    {#each cards as card, index (card.id)}
      <div
        class="card-wrapper {card.size}"
        class:drag-over={dragOverIndex === index}
        class:dragging={draggedCard?.id === card.id}
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
        
        <div class="card {card.type}-card" class:edit-mode={isEditMode}>
          {#if isEditMode}
            <div class="card-edit-controls">
              <div class="drag-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
              <button class="remove-card-btn" on:click|stopPropagation={() => removeCard(card.id)} title="Remove card">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          {/if}

          {#if card.type === 'quote'}
            <div class="quote-content">
              <TipTapEditor 
                content={getQuoteContent(card.id)}
                editable={isEditMode}
                placeholder="Write your creative quote..."
                on:update={(e) => handleQuoteUpdate(card.id, e)}
              />
            </div>

          {:else if card.type === 'gradient'}
            <ImageGalleryCard editable={isEditMode} cardId={card.id} />

          {:else if card.type === 'music'}
            <MusicCard editable={isEditMode} />

          {:else if card.type === 'games'}
            <FavoriteGamesCard editable={isEditMode} cardId={card.id} />

          {:else if card.type === 'github'}
            <GitHubProjectsCard editable={isEditMode} cardId={card.id} />

          {:else if card.type === 'friends'}
            <FriendsCard editable={isEditMode} />
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

  @media (max-width: 900px) {
    .card-wrapper.small, .card-wrapper.wide {
      flex: 1 1 100%;
      min-width: unset;
    }
  }
</style>
