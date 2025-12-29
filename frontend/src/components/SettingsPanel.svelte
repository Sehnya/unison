<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { User } from '../types';

  export let user: User | null = null;

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
  let avatarUrl = user?.avatar || 'https://i.pravatar.cc/100?img=68';
  let fileInput: HTMLInputElement;
  let showPasswordSection = false;
  let saveMessage = '';

  const presenceOptions: { value: PresenceStatus; label: string; color: string }[] = [
    { value: 'online', label: 'Online', color: '#22c55e' },
    { value: 'idle', label: 'Idle', color: '#eab308' },
    { value: 'dnd', label: 'Do Not Disturb', color: '#ef4444' },
    { value: 'offline', label: 'Invisible', color: '#6b7280' },
  ];

  function handleAvatarUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const url = URL.createObjectURL(file);
    avatarUrl = url;
  }

  function triggerFileInput() {
    fileInput?.click();
  }

  function saveProfile() {
    if (!username.trim()) {
      alert('Username cannot be empty');
      return;
    }

    dispatch('updateUser', {
      user: {
        username: username.trim(),
        avatar: avatarUrl,
      }
    });

    saveMessage = 'Profile saved!';
    setTimeout(() => saveMessage = '', 2000);
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
          <img src={avatarUrl} alt="Profile" />
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