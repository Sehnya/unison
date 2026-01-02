<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Avatar from './Avatar.svelte';
  import { isValidImageFile, isValidHexColor } from '../lib/miniProfileUtils';

  export let authToken: string = '';
  export let currentSettings: {
    backgroundImage: string | null;
    usernameFont: string;
    textColor: string;
  } = {
    backgroundImage: null,
    usernameFont: 'Inter',
    textColor: '#ffffff'
  };
  export let username: string = '';
  export let avatar: string | null = null;
  export let userId: string = '';
  export let bio: string | null = null;

  const dispatch = createEventDispatcher<{
    save: { backgroundImage: string | null; usernameFont: string; textColor: string };
    change: { backgroundImage: string | null; usernameFont: string; textColor: string };
  }>();

  // Local state
  let backgroundImage: string | null = currentSettings.backgroundImage;
  let usernameFont: string = currentSettings.usernameFont || 'Inter';
  let textColor: string = currentSettings.textColor || '#ffffff';
  let isDragging = false;
  let errorMessage = '';
  let fileInput: HTMLInputElement;

  // Popular Google Fonts for mini-profile
  const fontOptions = [
    { name: 'Inter', category: 'sans-serif' },
    { name: 'Roboto', category: 'sans-serif' },
    { name: 'Poppins', category: 'sans-serif' },
    { name: 'Montserrat', category: 'sans-serif' },
    { name: 'Playfair Display', category: 'serif' },
    { name: 'Merriweather', category: 'serif' },
    { name: 'Pacifico', category: 'handwriting' },
    { name: 'Dancing Script', category: 'handwriting' },
    { name: 'Bebas Neue', category: 'display' },
    { name: 'Permanent Marker', category: 'display' },
    { name: 'Fira Code', category: 'monospace' },
    { name: 'JetBrains Mono', category: 'monospace' },
  ];

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

  onMount(() => {
    // Load all fonts for the selector
    fontOptions.forEach(font => loadGoogleFont(font.name));
    // Load current font
    loadGoogleFont(usernameFont);
  });

  // Emit changes when settings update
  function emitChange() {
    dispatch('change', { backgroundImage, usernameFont, textColor });
  }

  // Handle font change
  function handleFontChange(fontName: string) {
    usernameFont = fontName;
    loadGoogleFont(fontName);
    emitChange();
  }

  // Handle color change
  function handleColorChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const newColor = input.value;
    if (isValidHexColor(newColor)) {
      textColor = newColor;
      errorMessage = '';
      emitChange();
    } else {
      errorMessage = 'Invalid color format. Use #RRGGBB';
    }
  }

  // Handle color input (text field)
  function handleColorInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const newColor = input.value;
    // Allow partial input while typing
    if (newColor.startsWith('#') && newColor.length <= 7) {
      textColor = newColor;
      if (newColor.length === 7 && isValidHexColor(newColor)) {
        errorMessage = '';
        emitChange();
      }
    }
  }

  // Handle file selection
  function handleFileSelect(file: File) {
    errorMessage = '';
    
    if (!isValidImageFile(file.type, file.size)) {
      if (file.size > 5 * 1024 * 1024) {
        errorMessage = 'Image must be less than 5MB';
      } else {
        errorMessage = 'Invalid image format. Use JPG, PNG, WebP, or GIF';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      backgroundImage = e.target?.result as string;
      emitChange();
    };
    reader.onerror = () => {
      errorMessage = 'Failed to read image file';
    };
    reader.readAsDataURL(file);
  }

  // Handle file input change
  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  // Handle drag events
  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    
    const file = event.dataTransfer?.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  // Remove background image
  function removeBackground() {
    backgroundImage = null;
    emitChange();
  }

  // Trigger file input
  function triggerFileInput() {
    fileInput?.click();
  }

  // Get current settings
  export function getSettings() {
    return { backgroundImage, usernameFont, textColor };
  }

  // Truncate bio for preview
  $: displayBio = bio && bio.length > 150 ? bio.slice(0, 150) + '...' : bio;
</script>

<div class="mini-profile-settings">
  <!-- Live Preview -->
  <div class="preview-section">
    <div class="section-label">preview</div>
    <div 
      class="preview-card"
      class:has-background={backgroundImage}
      style={backgroundImage ? `background-image: url(${backgroundImage});` : ''}
    >
      {#if backgroundImage}
        <div class="preview-overlay"></div>
      {/if}
      <div class="preview-content">
        <div class="preview-avatar">
          <Avatar 
            src={avatar}
            {username}
            {userId}
            size={64}
          />
        </div>
        <h3 
          class="preview-username"
          style="font-family: '{usernameFont}', sans-serif; color: {textColor};"
        >
          {username || 'Username'}
        </h3>
        {#if displayBio}
          <p class="preview-bio" style="color: {textColor};">
            {displayBio}
          </p>
        {/if}
        <button class="preview-btn">View Full Profile</button>
      </div>
    </div>
  </div>

  <!-- Background Image Upload -->
  <div class="setting-section">
    <div class="section-label">background image</div>
    <div 
      class="upload-area"
      class:dragging={isDragging}
      on:dragenter={handleDragEnter}
      on:dragleave={handleDragLeave}
      on:dragover={handleDragOver}
      on:drop={handleDrop}
      role="button"
      tabindex="0"
      on:click={triggerFileInput}
      on:keydown={(e) => e.key === 'Enter' && triggerFileInput()}
    >
      <input 
        type="file" 
        bind:this={fileInput}
        on:change={handleFileInputChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        class="hidden"
      />
      {#if backgroundImage}
        <div class="upload-preview">
          <img src={backgroundImage} alt="Background preview" />
          <button 
            class="remove-btn" 
            on:click|stopPropagation={removeBackground}
            aria-label="Remove background"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {:else}
        <div class="upload-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>drag & drop or click to upload</span>
          <span class="upload-hint">JPG, PNG, WebP, GIF · max 5MB</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Font Selector -->
  <div class="setting-section">
    <div class="section-label">username font</div>
    <div class="font-grid">
      {#each fontOptions as font}
        <button 
          class="font-option"
          class:active={usernameFont === font.name}
          style="font-family: '{font.name}', sans-serif;"
          on:click={() => handleFontChange(font.name)}
          title={font.name}
        >
          <span class="font-sample">Aa</span>
          <span class="font-name">{font.name.toLowerCase()}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Color Picker -->
  <div class="setting-section">
    <div class="section-label">text color</div>
    <div class="color-picker-row">
      <input 
        type="color" 
        value={textColor}
        on:change={handleColorChange}
        class="color-input"
      />
      <input 
        type="text" 
        value={textColor}
        on:input={handleColorInput}
        placeholder="#ffffff"
        maxlength="7"
        class="color-text-input"
      />
      <div 
        class="color-preview"
        style="background-color: {textColor};"
      ></div>
    </div>
  </div>

  <!-- Error Message -->
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .mini-profile-settings {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  /* Preview Section */
  .preview-section {
    margin-bottom: 8px;
  }

  .preview-card {
    position: relative;
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
    background: #2a2a2a;
    border-radius: 12px;
    overflow: hidden;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .preview-card.has-background {
    background-color: transparent;
  }

  .preview-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }

  .preview-content {
    position: relative;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .preview-avatar {
    margin-bottom: 12px;
  }

  .preview-username {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    word-break: break-word;
  }

  .preview-bio {
    margin: 0 0 12px 0;
    font-size: 13px;
    line-height: 1.4;
    opacity: 0.85;
    word-break: break-word;
    max-height: 60px;
    overflow: hidden;
  }

  .preview-btn {
    width: 100%;
    padding: 10px 16px;
    background: rgba(99, 102, 241, 0.8);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    pointer-events: none;
  }

  /* Upload Area */
  .setting-section {
    margin-bottom: 0;
  }

  .upload-area {
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.02);
  }

  .upload-area:hover {
    border-color: rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.04);
  }

  .upload-area.dragging {
    border-color: rgba(99, 102, 241, 0.6);
    background: rgba(99, 102, 241, 0.1);
  }

  .hidden {
    display: none;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.5);
  }

  .upload-placeholder svg {
    opacity: 0.5;
  }

  .upload-placeholder span {
    font-size: 13px;
  }

  .upload-hint {
    font-size: 11px !important;
    color: rgba(255, 255, 255, 0.35) !important;
  }

  .upload-preview {
    position: relative;
    display: flex;
    justify-content: center;
  }

  .upload-preview img {
    max-width: 100%;
    max-height: 120px;
    border-radius: 8px;
    object-fit: cover;
  }

  .remove-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.9);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .remove-btn:hover {
    background: rgba(239, 68, 68, 1);
  }

  /* Font Grid */
  .font-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .font-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .font-option:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .font-option.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .font-sample {
    font-size: 20px;
    color: #fff;
  }

  .font-name {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    font-family: 'Inter', sans-serif !important;
  }

  /* Color Picker */
  .color-picker-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .color-input {
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: transparent;
    padding: 0;
  }

  .color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-input::-webkit-color-swatch {
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  .color-text-input {
    flex: 1;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-family: 'Fira Code', monospace;
  }

  .color-text-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
  }

  .color-preview {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  /* Error Message */
  .error-message {
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #fca5a5;
    font-size: 13px;
  }
</style>
