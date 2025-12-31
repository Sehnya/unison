<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User } from '../types';
  import Avatar from './Avatar.svelte';
  import { apiUrl } from '../lib/api';
  import { authStorage } from '../utils/storage';
  import { closeAbly } from '../lib/ably';

  export let user: User | null = null;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    updateUser: { user: Partial<User> };
    logout: void;
  }>();

  type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';
  type SettingsTab = 'profile' | 'account' | 'appearance';

  let activeTab: SettingsTab = 'profile';
  let username = user?.username || '';
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let presence: PresenceStatus = 'online';
  let avatarUrl = user?.avatar || null;
  let avatarBase64: string | null = user?.avatar || null;
  let fileInput: HTMLInputElement;
  let saveMessage = '';
  let saving = false;
  
  // Font selection
  let selectedFont = (user as any)?.username_font || 'Inter';
  
  // Popular Google Fonts for username display
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

  const presenceOptions: { value: PresenceStatus; label: string }[] = [
    { value: 'online', label: 'online' },
    { value: 'idle', label: 'idle' },
    { value: 'dnd', label: 'do not disturb' },
    { value: 'offline', label: 'invisible' },
  ];
  
  // Load Google Font dynamically
  function loadGoogleFont(fontName: string) {
    const fontId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(fontId)) return;
    
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
  
  onMount(() => {
    loadGoogleFont(selectedFont);
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
      alert('please upload an image file');
      return;
    }

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
      saveMessage = 'username cannot be empty';
      setTimeout(() => saveMessage = '', 3000);
      return;
    }

    if (!authToken) return;

    saving = true;
    try {
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
        dispatch('updateUser', {
          user: data.user || {
            username: username.trim(),
            avatar: avatarBase64,
            username_font: selectedFont,
          }
        });
        saveMessage = 'changes saved';
      } else {
        const error = await response.json().catch(() => ({}));
        saveMessage = error.message || 'failed to save';
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      saveMessage = 'error saving profile';
    } finally {
      saving = false;
      setTimeout(() => saveMessage = '', 3000);
    }
  }

  function savePassword() {
    if (!currentPassword) {
      saveMessage = 'enter current password';
      setTimeout(() => saveMessage = '', 3000);
      return;
    }
    if (newPassword.length < 6) {
      saveMessage = 'password must be at least 6 characters';
      setTimeout(() => saveMessage = '', 3000);
      return;
    }
    if (newPassword !== confirmPassword) {
      saveMessage = 'passwords do not match';
      setTimeout(() => saveMessage = '', 3000);
      return;
    }

    saveMessage = 'password updated';
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    setTimeout(() => saveMessage = '', 3000);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }

  async function handleLogout() {
    try {
      // Call logout API to invalidate session
      if (authToken) {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Always clear local state regardless of API result
      authStorage.remove();
      closeAbly();
      dispatch('logout');
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
  <button class="overlay-backdrop" on:click={() => dispatch('close')} aria-label="Close settings"></button>
  
  <div class="settings-panel">
    <!-- Header -->
    <header class="panel-header">
      <h1>settings</h1>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </header>

    <!-- Navigation Tabs -->
    <nav class="tabs">
      <button 
        class="tab" 
        class:active={activeTab === 'profile'}
        on:click={() => activeTab = 'profile'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        profile
      </button>
      <button 
        class="tab" 
        class:active={activeTab === 'account'}
        on:click={() => activeTab = 'account'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        account
      </button>
      <button 
        class="tab" 
        class:active={activeTab === 'appearance'}
        on:click={() => activeTab = 'appearance'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        appearance
      </button>
    </nav>

    <!-- Content -->
    <div class="panel-content">
      {#if activeTab === 'profile'}
        <!-- Avatar Section -->
        <section class="section">
          <div class="section-label">avatar</div>
          <div class="avatar-row">
            <div class="avatar-preview">
              {#if avatarUrl}
                <img src={avatarUrl} alt="Profile" />
              {:else}
                <Avatar 
                  src={null}
                  username={user?.username || username}
                  userId={user?.id || ''}
                  size={72}
                />
              {/if}
              <div class="status-badge {presence}"></div>
            </div>
            <div class="avatar-info">
              <input type="file" bind:this={fileInput} on:change={handleAvatarUpload} accept="image/*" class="hidden" />
              <button class="btn-secondary" on:click={triggerFileInput}>
                upload image
              </button>
              <p class="hint">jpg, png or gif · max 2mb</p>
            </div>
          </div>
        </section>

        <!-- Username Section -->
        <section class="section">
          <div class="section-label">username</div>
          <div class="input-wrapper">
            <input 
              type="text" 
              bind:value={username}
              placeholder="enter username"
              maxlength="32"
            />
            <span class="char-count">{username.length}/32</span>
          </div>
        </section>

        <!-- Status Section -->
        <section class="section">
          <div class="section-label">status</div>
          <div class="status-grid">
            {#each presenceOptions as option}
              <button 
                class="status-option"
                class:active={presence === option.value}
                on:click={() => presence = option.value}
              >
                <span class="status-dot {option.value}"></span>
                {option.label}
              </button>
            {/each}
          </div>
        </section>

      {:else if activeTab === 'account'}
        <!-- Email Section -->
        <section class="section">
          <div class="section-label">email</div>
          <div class="info-row">
            <span class="info-value">{user?.email || 'not set'}</span>
            <span class="info-badge">verified</span>
          </div>
        </section>

        <!-- Password Section -->
        <section class="section">
          <div class="section-label">change password</div>
          <div class="form-stack">
            <div class="input-wrapper">
              <label for="current-password">current password</label>
              <input 
                id="current-password"
                type="password" 
                bind:value={currentPassword} 
                placeholder="enter current password" 
              />
            </div>
            <div class="input-wrapper">
              <label for="new-password">new password</label>
              <input 
                id="new-password"
                type="password" 
                bind:value={newPassword} 
                placeholder="enter new password" 
              />
            </div>
            <div class="input-wrapper">
              <label for="confirm-password">confirm password</label>
              <input 
                id="confirm-password"
                type="password" 
                bind:value={confirmPassword} 
                placeholder="confirm new password" 
              />
            </div>
            <button class="btn-secondary" on:click={savePassword}>
              update password
            </button>
          </div>
        </section>

        <!-- Danger Zone -->
        <section class="section danger-section">
          <div class="section-label">danger zone</div>
          <div class="danger-card">
            <div class="danger-info">
              <span class="danger-title">delete account</span>
              <span class="danger-desc">permanently remove your account and all data</span>
            </div>
            <button class="btn-danger">delete</button>
          </div>
        </section>

        <!-- Logout Section -->
        <section class="section">
          <div class="section-label">session</div>
          <div class="logout-card">
            <div class="logout-info">
              <span class="logout-title">log out</span>
              <span class="logout-desc">sign out of your account on this device</span>
            </div>
            <button class="btn-logout" on:click={handleLogout}>log out</button>
          </div>
        </section>

      {:else if activeTab === 'appearance'}
        <!-- Font Section -->
        <section class="section">
          <div class="section-label">username font</div>
          <div class="font-preview" style="font-family: '{selectedFont}', sans-serif;">
            {username || 'preview'}
          </div>
          <div class="font-grid">
            {#each fontOptions as font}
              <button 
                class="font-option"
                class:active={selectedFont === font.name}
                style="font-family: '{font.name}', sans-serif;"
                on:click={() => handleFontChange(font.name)}
                title={font.name}
              >
                <span class="font-sample">Aa</span>
                <span class="font-name">{font.name.toLowerCase()}</span>
              </button>
            {/each}
          </div>
        </section>

        <!-- Theme Section (placeholder) -->
        <section class="section">
          <div class="section-label">theme</div>
          <div class="theme-options">
            <button class="theme-option active">
              <div class="theme-preview dark"></div>
              <span>dark</span>
            </button>
            <button class="theme-option" disabled>
              <div class="theme-preview light"></div>
              <span>light</span>
              <span class="coming-soon">soon</span>
            </button>
          </div>
        </section>
      {/if}

      <!-- Save Message -->
      {#if saveMessage}
        <div class="toast" class:error={saveMessage.includes('error') || saveMessage.includes('cannot') || saveMessage.includes('failed')}>
          {saveMessage}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <footer class="panel-footer">
      <button class="btn-secondary" on:click={() => dispatch('close')}>cancel</button>
      <button class="btn-primary" on:click={saveProfile} disabled={saving}>
        {saving ? 'saving...' : 'save changes'}
      </button>
    </footer>
  </div>
</div>


<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 24px;
  }

  .overlay-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    border: none;
    cursor: pointer;
  }

  .settings-panel {
    position: relative;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    background: #050505;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    animation: slideUp 0.25s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .panel-header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab:hover {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.8);
  }

  .tab.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* Content */
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .section {
    margin-bottom: 28px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  /* Avatar */
  .avatar-row {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .avatar-preview {
    position: relative;
    width: 72px;
    height: 72px;
    flex-shrink: 0;
  }

  .avatar-preview img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .status-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid #050505;
  }

  .status-badge.online { background: #22c55e; }
  .status-badge.idle { background: #eab308; }
  .status-badge.dnd { background: #ef4444; }
  .status-badge.offline { background: #6b7280; }

  .avatar-info {
    flex: 1;
  }

  .hidden {
    display: none;
  }

  .hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    margin: 8px 0 0;
  }

  /* Inputs */
  .input-wrapper {
    position: relative;
  }

  .input-wrapper label {
    display: block;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 6px;
  }

  .input-wrapper input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .input-wrapper input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
  }

  .input-wrapper input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .char-count {
    position: absolute;
    right: 12px;
    bottom: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.25);
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Status Grid */
  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .status-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .status-option:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .status-option.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.online { background: #22c55e; }
  .status-dot.idle { background: #eab308; }
  .status-dot.dnd { background: #ef4444; }
  .status-dot.offline { background: #6b7280; }

  /* Info Row */
  .info-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .info-value {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }

  .info-badge {
    padding: 4px 10px;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 6px;
    font-size: 11px;
    color: #22c55e;
  }

  /* Danger Zone */
  .danger-section .section-label {
    color: rgba(239, 68, 68, 0.6);
  }

  .danger-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 10px;
  }

  .danger-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .danger-title {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }

  .danger-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Font Section */
  .font-preview {
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    font-size: 28px;
    color: #fff;
    text-align: center;
    margin-bottom: 16px;
  }

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

  /* Theme Options */
  .theme-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .theme-option:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
  }

  .theme-option.active {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .theme-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .theme-preview {
    width: 100%;
    height: 48px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .theme-preview.dark {
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  }

  .theme-preview.light {
    background: linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%);
  }

  .theme-option span {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  .coming-soon {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #fff;
    font-size: 13px;
    animation: toastIn 0.2s ease;
    z-index: 1001;
  }

  .toast.error {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* Buttons */
  .btn-primary {
    padding: 12px 24px;
    background: #fff;
    border: none;
    border-radius: 10px;
    color: #050505;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .btn-danger {
    padding: 10px 18px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #ef4444;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  /* Logout Section */
  .logout-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .logout-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .logout-title {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }

  .logout-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .btn-logout {
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-logout:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* Footer */
  .panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* Scrollbar */
  .panel-content::-webkit-scrollbar {
    width: 6px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
  }
</style>
