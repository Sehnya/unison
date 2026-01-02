<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { loadProfile, updateGalleryCard, type GalleryCardData } from '../lib/profileStorage';

  export let editable: boolean = false;
  export let cardId: string = 'default';
  export let profileGalleryData: GalleryCardData | null = null; // Gallery data from viewed profile
  export let isOwnProfile: boolean = true;

  type TransitionType = 'fade' | 'slideRight' | 'slideLeft' | 'slideUp' | 'slideDown' | 'zoom' | 'blur' | 'disintegrate';
  type FilterType = 'none' | 'grayscale' | 'sepia' | 'saturate' | 'contrast' | 'brightness' | 'hueRotate' | 'invert' | 'blur' | 'vintage' | 'cool' | 'warm';

  interface GalleryImage {
    id: string;
    src: string;
    name: string;
  }

  interface GallerySettings {
    images: GalleryImage[];
    transition: TransitionType;
    filter: FilterType;
    interval: number;
  }

  const dispatch = createEventDispatcher<{
    update: { settings: GallerySettings };
  }>();

  let settings: GallerySettings = {
    images: [],
    transition: 'fade',
    filter: 'none',
    interval: 5,
  };

  // Load saved data on mount
  onMount(() => {
    loadGalleryData();
    startSlideshow();
  });

  // Reload when profileGalleryData changes
  $: if (profileGalleryData !== undefined) {
    loadGalleryData();
  }

  function loadGalleryData() {
    // If viewing another user's profile and they have gallery data, use it
    if (!isOwnProfile && profileGalleryData) {
      settings = {
        images: profileGalleryData.images as GalleryImage[],
        transition: profileGalleryData.transition as TransitionType,
        filter: profileGalleryData.filter as FilterType,
        interval: profileGalleryData.interval
      };
    } else if (isOwnProfile) {
      const profile = loadProfile();
      if (profile.galleryCards && profile.galleryCards[cardId]) {
        const saved = profile.galleryCards[cardId];
        settings = {
          images: saved.images as GalleryImage[],
          transition: saved.transition as TransitionType,
          filter: saved.filter as FilterType,
          interval: saved.interval
        };
      }
    }
  }

  function saveSettings() {
    if (!isOwnProfile) return;
    updateGalleryCard(cardId, {
      images: settings.images,
      transition: settings.transition,
      filter: settings.filter,
      interval: settings.interval
    });
    dispatch('update', { settings });
  }

  let currentIndex = 0;
  let previousIndex = -1;
  let isTransitioning = false;
  let fileInput: HTMLInputElement;
  let showSettings = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const transitions: { value: TransitionType; label: string }[] = [
    { value: 'fade', label: 'Fade' },
    { value: 'slideRight', label: 'Slide Right' },
    { value: 'slideLeft', label: 'Slide Left' },
    { value: 'slideUp', label: 'Slide Up' },
    { value: 'slideDown', label: 'Slide Down' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'blur', label: 'Blur' },
    { value: 'disintegrate', label: 'Disintegrate' },
  ];

  const filters: { value: FilterType; label: string; css: string }[] = [
    { value: 'none', label: 'None', css: 'none' },
    { value: 'grayscale', label: 'Grayscale', css: 'grayscale(100%)' },
    { value: 'sepia', label: 'Sepia', css: 'sepia(80%)' },
    { value: 'saturate', label: 'Vibrant', css: 'saturate(150%)' },
    { value: 'contrast', label: 'Contrast', css: 'contrast(120%)' },
    { value: 'brightness', label: 'Bright', css: 'brightness(120%)' },
    { value: 'hueRotate', label: 'Hue Shift', css: 'hue-rotate(90deg)' },
    { value: 'invert', label: 'Invert', css: 'invert(100%)' },
    { value: 'blur', label: 'Soft', css: 'blur(2px)' },
    { value: 'vintage', label: 'Vintage', css: 'sepia(40%) contrast(90%) brightness(90%)' },
    { value: 'cool', label: 'Cool', css: 'saturate(110%) hue-rotate(10deg) brightness(105%)' },
    { value: 'warm', label: 'Warm', css: 'saturate(120%) hue-rotate(-10deg) brightness(105%)' },
  ];

  $: currentImage = settings.images[currentIndex] || null;
  $: previousImage = previousIndex >= 0 ? settings.images[previousIndex] : null;
  $: currentFilter = filters.find(f => f.value === settings.filter)?.css || 'none';

  onDestroy(() => {
    stopSlideshow();
  });  onDestroy(() => {
    stopSlideshow();
  });

  function startSlideshow() {
    if (settings.images.length <= 1) return;
    stopSlideshow();
    intervalId = setInterval(() => {
      nextImage();
    }, settings.interval * 1000);
  }

  function stopSlideshow() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function nextImage() {
    if (settings.images.length <= 1 || isTransitioning) return;
    previousIndex = currentIndex;
    currentIndex = (currentIndex + 1) % settings.images.length;
    triggerTransition();
  }

  function prevImage() {
    if (settings.images.length <= 1 || isTransitioning) return;
    previousIndex = currentIndex;
    currentIndex = (currentIndex - 1 + settings.images.length) % settings.images.length;
    triggerTransition();
  }

  function triggerTransition() {
    isTransitioning = true;
    setTimeout(() => {
      isTransitioning = false;
      previousIndex = -1;
    }, 800);
  }

  function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage: GalleryImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          src: event.target?.result as string,
          name: file.name,
        };
        settings.images = [...settings.images, newImage];
        settings = settings;
        saveSettings();
        
        if (settings.images.length === 1) {
          currentIndex = 0;
        }
        startSlideshow();
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  function removeImage(id: string) {
    const index = settings.images.findIndex(img => img.id === id);
    settings.images = settings.images.filter(img => img.id !== id);
    settings = settings;
    
    if (currentIndex >= settings.images.length) {
      currentIndex = Math.max(0, settings.images.length - 1);
    }
    
    saveSettings();
    startSlideshow();
  }

  function setTransition(transition: TransitionType) {
    settings.transition = transition;
    settings = settings;
    saveSettings();
  }

  function setFilter(filter: FilterType) {
    settings.filter = filter;
    settings = settings;
    saveSettings();
  }

  function setInterval_(seconds: number) {
    settings.interval = seconds;
    settings = settings;
    saveSettings();
    startSlideshow();
  }

  function goToImage(index: number) {
    if (index === currentIndex || isTransitioning) return;
    previousIndex = currentIndex;
    currentIndex = index;
    triggerTransition();
    startSlideshow();
  }
</script>

<div class="gallery-card">
  {#if settings.images.length === 0}
    <!-- Empty State / Gradient Placeholder -->
    <div class="empty-state" class:editable on:click={() => editable && fileInput?.click()}>
      <div class="gradient-bg"></div>
      {#if editable}
        <div class="upload-prompt">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span>Click to add photos</span>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Image Display -->
    <div class="image-container" style="filter: {currentFilter}">
      {#if previousImage && isTransitioning}
        <div class="image-layer previous {settings.transition}">
          <img src={previousImage.src} alt={previousImage.name} />
        </div>
      {/if}
      {#if currentImage}
        <div class="image-layer current {settings.transition}" class:transitioning={isTransitioning}>
          <img src={currentImage.src} alt={currentImage.name} />
        </div>
      {/if}
    </div>

    <!-- Navigation Dots -->
    {#if settings.images.length > 1}
      <div class="nav-dots">
        {#each settings.images as _, index}
          <button
            class="dot"
            class:active={index === currentIndex}
            on:click={() => goToImage(index)}
          ></button>
        {/each}
      </div>
    {/if}

    <!-- Navigation Arrows -->
    {#if settings.images.length > 1}
      <button class="nav-arrow prev" on:click={prevImage}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <button class="nav-arrow next" on:click={nextImage}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    {/if}
  {/if}

  <!-- Edit Controls -->
  {#if editable}
    <div class="edit-controls">
      <button class="edit-btn" on:click={() => fileInput?.click()} title="Add Photos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
      <button class="edit-btn" on:click={() => showSettings = !showSettings} title="Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </button>
    </div>

    <!-- Settings Panel -->
    {#if showSettings}
      <div class="settings-panel">
        <!-- Transition Picker -->
        <div class="setting-group">
          <label>Transition</label>
          <div class="option-grid">
            {#each transitions as t}
              <button
                class="option-btn"
                class:active={settings.transition === t.value}
                on:click={() => setTransition(t.value)}
              >
                {t.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Filter Picker -->
        <div class="setting-group">
          <label>Filter</label>
          <div class="filter-grid">
            {#each filters as f}
              <button
                class="filter-btn"
                class:active={settings.filter === f.value}
                on:click={() => setFilter(f.value)}
                title={f.label}
              >
                <div class="filter-preview" style="filter: {f.css}">
                  {#if currentImage}
                    <img src={currentImage.src} alt="" />
                  {:else}
                    <div class="gradient-mini"></div>
                  {/if}
                </div>
                <span>{f.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Interval -->
        <div class="setting-group">
          <label>Slide Duration: {settings.interval}s</label>
          <input
            type="range"
            min="2"
            max="15"
            value={settings.interval}
            on:input={(e) => setInterval_(parseInt(e.currentTarget.value))}
            class="interval-slider"
          />
        </div>

        <!-- Image List -->
        {#if settings.images.length > 0}
          <div class="setting-group">
            <label>Photos ({settings.images.length})</label>
            <div class="image-list">
              {#each settings.images as img, index}
                <div class="image-item" class:active={index === currentIndex}>
                  <img src={img.src} alt={img.name} on:click={() => goToImage(index)} />
                  <button class="remove-btn" on:click={() => removeImage(img.id)}>×</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  <input
    type="file"
    bind:this={fileInput}
    on:change={handleFileUpload}
    accept="image/*"
    multiple
    class="hidden"
  />
</div>


<style>
  .gallery-card {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    border-radius: 16px;
    overflow: hidden;
  }

  .hidden {
    display: none;
  }

  /* Empty State */
  .empty-state {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state.editable {
    cursor: pointer;
  }

  .gradient-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #ff6b6b 0%, #feca57 30%, #ff9ff3 60%, #fff 100%);
  }

  .upload-prompt {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: rgba(0, 0, 0, 0.6);
    font-size: 13px;
    background: rgba(255, 255, 255, 0.3);
    padding: 20px 30px;
    border-radius: 12px;
    backdrop-filter: blur(10px);
  }

  /* Image Container */
  .image-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .image-layer {
    position: absolute;
    inset: 0;
  }

  .image-layer img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Transitions */
  .image-layer.current {
    z-index: 2;
  }

  .image-layer.previous {
    z-index: 1;
  }

  /* Fade */
  .image-layer.fade.current.transitioning {
    animation: fadeIn 0.8s ease-out forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Slide Right */
  .image-layer.slideRight.current.transitioning {
    animation: slideInRight 0.8s ease-out forwards;
  }

  @keyframes slideInRight {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }

  /* Slide Left */
  .image-layer.slideLeft.current.transitioning {
    animation: slideInLeft 0.8s ease-out forwards;
  }

  @keyframes slideInLeft {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  /* Slide Up */
  .image-layer.slideUp.current.transitioning {
    animation: slideInUp 0.8s ease-out forwards;
  }

  @keyframes slideInUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* Slide Down */
  .image-layer.slideDown.current.transitioning {
    animation: slideInDown 0.8s ease-out forwards;
  }

  @keyframes slideInDown {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }

  /* Zoom */
  .image-layer.zoom.current.transitioning {
    animation: zoomIn 0.8s ease-out forwards;
  }

  @keyframes zoomIn {
    from { transform: scale(1.3); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  /* Blur */
  .image-layer.blur.current.transitioning {
    animation: blurIn 0.8s ease-out forwards;
  }

  @keyframes blurIn {
    from { filter: blur(20px); opacity: 0; }
    to { filter: blur(0); opacity: 1; }
  }

  /* Disintegrate */
  .image-layer.disintegrate.current.transitioning {
    animation: disintegrate 0.8s ease-out forwards;
  }

  @keyframes disintegrate {
    0% { 
      clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
      opacity: 0;
    }
    50% {
      clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
      opacity: 0.5;
    }
    100% { 
      clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      opacity: 1;
    }
  }

  /* Navigation Dots */
  .nav-dots {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    z-index: 10;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dot:hover {
    background: rgba(255, 255, 255, 0.7);
  }

  .dot.active {
    background: #fff;
    transform: scale(1.2);
  }

  /* Navigation Arrows */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .gallery-card:hover .nav-arrow {
    opacity: 1;
  }

  .nav-arrow:hover {
    background: rgba(0, 0, 0, 0.6);
  }

  .nav-arrow.prev {
    left: 8px;
  }

  .nav-arrow.next {
    right: 8px;
  }

  /* Edit Controls */
  .edit-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .edit-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .edit-btn:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  /* Settings Panel */
  .settings-panel {
    position: absolute;
    top: 48px;
    right: 8px;
    width: 280px;
    max-height: calc(100% - 60px);
    overflow-y: auto;
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px;
    z-index: 30;
  }

  .setting-group {
    margin-bottom: 16px;
  }

  .setting-group:last-child {
    margin-bottom: 0;
  }

  .setting-group label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .option-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .option-btn {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .option-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .option-btn.active {
    background: rgba(49, 130, 206, 0.3);
    border-color: rgba(49, 130, 206, 0.5);
    color: #63b3ed;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .filter-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .filter-btn.active {
    border-color: #3182ce;
  }

  .filter-preview {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    overflow: hidden;
  }

  .filter-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gradient-mini {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%);
  }

  .filter-btn span {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.6);
  }

  .filter-btn.active span {
    color: #63b3ed;
  }

  .interval-slider {
    width: 100%;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
  }

  .interval-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #3182ce;
    cursor: pointer;
  }

  .image-list {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .image-item {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    border: 2px solid transparent;
    cursor: pointer;
  }

  .image-item.active {
    border-color: #3182ce;
  }

  .image-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-item .remove-btn {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: #ef4444;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .image-item:hover .remove-btn {
    opacity: 1;
  }

  /* Scrollbar */
  .settings-panel::-webkit-scrollbar {
    width: 4px;
  }

  .settings-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-panel::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>
