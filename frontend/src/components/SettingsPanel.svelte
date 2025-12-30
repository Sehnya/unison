<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User } from '../types';
  import Avatar from './Avatar.svelte';
  import { apiUrl } from '../lib/api';

  export let user: User | null = null;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    updateUser: { user: Partial<User> };
  }>();

  type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

  let username = user?.username || '';
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let presence: PresenceStatus = 'online';
  let avatarUrl = user?.avatar || null;
  let avatarBase64: string | null = user?.avatar || null;
  let fileInput: HTMLInputElement;
  let showPasswordSection = false;
  let saveMessage = '';
  let saving = false;
  
  // Font selection
  let selectedFont = (user as any)?.username_font || 'Inter';
  let fontLoaded = false;
  
  // Popular Google Fonts for username display
  const fontOptions = [
    { name: 'Inter', category: 'Sans-serif' },
    { name: 'Roboto', category: 'Sans-serif' },
    { name: 'Open Sans', category: 'Sans-serif' },
    { name: 'Lato', category: 'Sans-serif' },
    { name: 'Montserrat', category: 'Sans-serif' },
    { name: 'Poppins', category: 'Sans-serif' },
    { name: 'Raleway', category: 'Sans-serif' },
    { name: 'Nunito', category: 'Sans-serif' },
    { name: 'Pangolin', category: 'Sans-serif' },
    { name: 'Playfair Display', category: 'Serif' },
    { name: 'Merriweather', category: 'Serif' },
    { name: 'Lora', category: 'Serif' },
    { name: 'Crimson Text', category: 'Serif' },
    { name: 'Special Elite', category: 'Serif' },
    { name: 'Pacifico', category: 'Handwriting' },
    { name: 'Dancing Script', category: 'Handwriting' },
    { name: 'Caveat', category: 'Handwriting' },
    { name: 'Satisfy', category: 'Handwriting' },
    { name: 'Cherry Bomb One', category: 'Display' },
    { name: 'Concert One', category: 'Display' },
    { name: 'Permanent Marker', category: 'Display' },
    { name: 'Bebas Neue', category: 'Display' },
    { name: 'Righteous', category: 'Display' },
    { name: 'Bangers', category: 'Display' },
    { name: 'Press Start 2P', category: 'Display' },
    { name: 'Freckle Face', category: 'Display' },
    { name: 'UnifrakturCook', category: 'Display' },
    { name: 'Jersey 10', category: 'Display' },
    { name: 'VT323', category: 'Monospace' },
    { name: 'Fira Code', category: 'Monospace' },
    { name: 'JetBrains Mono', category: 'Monospace' },
  ];

  const presenceOptions: { value: PresenceStatus; label: string; color: string }[] = [
    { value: 'online', label: 'Online', color: '#22c55e' },
    { value: 'idle', label: 'Idle', color: '#eab308' },
    { value: 'dnd', label: 'Do Not Disturb', color: '#ef4444' },
    { value: 'offline', label: 'Invisible', color: '#6b7280' },
  ];
  
  // Load Google Font dynamically
  function loadGoogleFont(fontName: string) {
    const fontId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Check if already loaded
    if (document.getElementById(fontId)) return;
    
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
  
  // Load selected font on mount and when it changes
  onMount(() => {
    loadGoogleFont(selectedFont);
    fontLoaded = true;
  });
  
  function handleFontChange(fontName: string) {
    selectedFont = fontName;
    loadGoogleFont(fontName);
  }

  function handleAvatarUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Convert to base64 for persistence
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      avatarUrl = base64;
      avatarBase64 = base64;
    };
    reader.readAsDataURL(file);
  }

  function triggerFileInput() {
    fileInput?.click();
  }

  async function saveProfile() {
    if (!username.trim()) {
      alert('Username cannot be empty');
      return;
    }

    if (!authToken) {
      alert('Not authenticated');
      return;
    }

    saving = true;
    try {
      // Save to database via API
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          avatar: avatarBase64,
          username_font: selectedFont,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state with the saved user data
        dispatch('updateUser', {
          user: data.user || {
            username: username.trim(),
            avatar: avatarBase64,
            username_font: selectedFont,
          }
        });
        saveMessage = 'Profile saved!';
      } else {
        const error = await response.json().catch(() => ({}));
        alert(error.message || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      saving = false;
      setTimeout(() => saveMessage = '', 2000);
    }
  }

  function savePassword() {
    if (!currentPassword) {
      alert('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Would call API here
    saveMessage = 'Password updated!';
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    showPasswordSection = false;
    setTimeout(() => saveMessage = '', 2000);
  }
</script>

<div class="settings-overlay" on:click={() => dispatch('close')} on:keydown={(e) => e.key === 'Escape' && dispatch('close')}>
  <div class="settings-panel" on:click|stopPropagation>
    <div class="panel-header">
      <h2>Settings</h2>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

  <div class="panel-content">
    <!-- Profile Picture Section -->
    <section class="settings-section">
      <h3>Profile Picture</h3>
      <div class="avatar-section">
        <div class="avatar-preview">
          {#if avatarUrl}
            <img src={avatarUrl} alt="Profile" />
          {:else}
            <Avatar 
              src={null}
              username={user?.username || username}
              userId={user?.id || ''}
              size={80}
            />
          {/if}
          <div class="presence-dot {presence}"></div>
        </div>
        <div class="avatar-actions">
          <input type="file" bind:this={fileInput} on:change={handleAvatarUpload} accept="image/*" class="hidden" />
          <button class="upload-btn" on:click={triggerFileInput}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Upload New
          </button>
          <p class="hint">JPG, PNG or GIF. Max 2MB.</p>
        </div>
      </div>
    </section>

    <!-- Username Section -->
    <section class="settings-section">
      <h3>Username</h3>
      <div class="input-group">
        <input 
          type="text" 
          bind:value={username}
          placeholder="Enter username"
          maxlength="32"
        />
        <span class="char-count">{username.length}/32</span>
      </div>
    </section>

    <!-- Username Font Section -->
    <section class="settings-section">
      <h3>Username Font</h3>
      <div class="font-preview" style="font-family: {selectedFont}, sans-serif;">
        {username || 'Preview'}
      </div>
      <div class="font-selector">
        <select 
          class="font-select"
          bind:value={selectedFont}
          on:change={(e) => handleFontChange(e.currentTarget.value)}
        >
          {#each fontOptions as font}
            <option value={font.name}>{font.name} ({font.category})</option>
          {/each}
        </select>
      </div>
      <div class="font-grid">
        {#each fontOptions.slice(0, 8) as font}
          <button 
            class="font-option"
            class:active={selectedFont === font.name}
            style="font-family: {font.name}, sans-serif;"
            on:click={() => handleFontChange(font.name)}
            title={font.name}
          >
            Aa
          </button>
        {/each}
      </div>
      <p class="hint">Choose a font for your username display</p>
    </section>

    <!-- Presence Section -->
    <section class="settings-section">
      <h3>Status</h3>
      <div class="presence-options">
        {#each presenceOptions as option}
          <button 
            class="presence-option"
            class:active={presence === option.value}
            on:click={() => presence = option.value}
          >
            <span class="presence-indicator" style="background: {option.color}"></span>
            <span class="presence-label">{option.label}</span>
          </button>
        {/each}
      </div>
    </section>

    <!-- Password Section -->
    <section class="settings-section">
      <div class="section-header">
        <h3>Password</h3>
        <button class="toggle-btn" on:click={() => showPasswordSection = !showPasswordSection}>
          {showPasswordSection ? 'Cancel' : 'Change'}
        </button>
      </div>
      
      {#if showPasswordSection}
        <div class="password-form">
          <div class="input-group">
            <label>Current Password</label>
            <input type="password" bind:value={currentPassword} placeholder="Enter current password" />
          </div>
          <div class="input-group">
            <label>New Password</label>
            <input type="password" bind:value={newPassword} placeholder="Enter new password" />
          </div>
          <div class="input-group">
            <label>Confirm Password</label>
            <input type="password" bind:value={confirmPassword} placeholder="Confirm new password" />
          </div>
          <button class="save-password-btn" on:click={savePassword}>Update Password</button>
        </div>
      {/if}
    </section>

    <!-- Save Message -->
    {#if saveMessage}
      <div class="save-message">{saveMessage}</div>
    {/if}
  </div>

  <div class="panel-footer">
    <button class="save-btn" on:click={saveProfile}>Save Changes</button>
  </div>
</div>
</div>


<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings-panel {
    width: 340px;
    height: 100%;
    background: #1a1a1a;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.25s ease;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .panel-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 28px;
  }

  .settings-section h3 {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-header h3 {
    margin: 0;
  }

  .toggle-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: rgba(49, 130, 206, 0.2);
    color: #63b3ed;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    background: rgba(49, 130, 206, 0.3);
  }

  /* Avatar Section */
  .avatar-section {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .avatar-preview {
    position: relative;
    width: 80px;
    height: 80px;
  }

  .avatar-preview img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid rgba(255, 255, 255, 0.1);
  }

  .presence-dot {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid #1a1a1a;
  }

  .presence-dot.online { background: #22c55e; }
  .presence-dot.idle { background: #eab308; }
  .presence-dot.dnd { background: #ef4444; }
  .presence-dot.offline { background: #6b7280; }

  .avatar-actions {
    flex: 1;
  }

  .hidden {
    display: none;
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(49, 130, 206, 0.2);
    border: 1px solid rgba(49, 130, 206, 0.4);
    border-radius: 8px;
    color: #63b3ed;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 8px;
  }

  .upload-btn:hover {
    background: rgba(49, 130, 206, 0.3);
    border-color: rgba(49, 130, 206, 0.6);
  }

  .hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  /* Input Groups */
  .input-group {
    position: relative;
    margin-bottom: 12px;
  }

  .input-group label {
    display: block;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 6px;
  }

  .input-group input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    transition: border-color 0.15s ease;
  }

  .input-group input:focus {
    outline: none;
    border-color: #3182ce;
  }

  .input-group input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .char-count {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  /* Font Selector */
  .font-preview {
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 24px;
    color: #fff;
    text-align: center;
    margin-bottom: 12px;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .font-selector {
    margin-bottom: 12px;
  }

  .font-select {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }

  .font-select:focus {
    outline: none;
    border-color: #3182ce;
  }

  .font-select option {
    background: #1a1a1a;
    color: #fff;
  }

  .font-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 8px;
  }

  .font-option {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .font-option:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .font-option.active {
    background: rgba(49, 130, 206, 0.2);
    border-color: rgba(49, 130, 206, 0.5);
    color: #63b3ed;
  }

  /* Presence Options */
  .presence-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .presence-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .presence-option:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .presence-option.active {
    background: rgba(49, 130, 206, 0.15);
    border-color: rgba(49, 130, 206, 0.5);
    color: #fff;
  }

  .presence-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  /* Password Form */
  .password-form {
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .save-password-btn {
    width: 100%;
    padding: 12px;
    background: #1a365d;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    margin-top: 4px;
  }

  .save-password-btn:hover {
    background: #2c5282;
  }

  /* Save Message */
  .save-message {
    padding: 12px;
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    color: #22c55e;
    font-size: 13px;
    text-align: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Footer */
  .panel-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .save-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-btn:hover {
    box-shadow: 0 4px 20px rgba(26, 54, 93, 0.4);
    transform: translateY(-1px);
  }

  /* Scrollbar */
  .panel-content::-webkit-scrollbar {
    width: 6px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
</style>