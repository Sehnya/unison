<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { apiUrl } from '../lib/api';

  export let authToken: string = '';
  export let currentUser: { id: string; username: string; avatar?: string; bio?: string } | null = null;

  const dispatch = createEventDispatcher<{
    completed: { username: string; avatar: string; bio: string };
  }>();

  let username = currentUser?.username || '';
  let bio = currentUser?.bio || '';
  let avatar = currentUser?.avatar || '';
  let avatarFile: File | null = null;
  let avatarPreview: string = '';
  let fileInput: HTMLInputElement;
  let loading = false;
  let error = '';

  $: if (avatarFile) {
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview = e.target?.result as string;
    };
    reader.readAsDataURL(avatarFile);
  }

  function handleAvatarSelect() {
    fileInput?.click();
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        error = 'Please select an image file';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        error = 'Image must be less than 5MB';
        return;
      }
      avatarFile = file;
      error = '';
    }
  }

  async function handleSubmit() {
    if (!username.trim()) {
      error = 'Username is required';
      return;
    }

    loading = true;
    error = '';

    try {
      // Convert avatar to base64 if a new file was selected
      let avatarData = avatar;
      if (avatarFile && avatarPreview) {
        avatarData = avatarPreview;
      }

      // Update user profile
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          avatar: avatarData,
          bio: bio.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to update profile');
      }

      const data = await response.json();
      dispatch('completed', {
        username: data.user.username,
        avatar: data.user.avatar || '',
        bio: data.user.bio || '',
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update profile';
    } finally {
      loading = false;
    }
  }

  async function skipToMySpace() {
    // When skipping, we need to save an empty bio to the backend
    // so the modal doesn't show again
    loading = true;
    error = '';

    try {
      // Use current user's username if no username was entered
      const usernameToSave = username.trim() || currentUser?.username;
      if (!usernameToSave) {
        error = 'Username is required';
        loading = false;
        return;
      }

      // Save current username/avatar if they exist, and set bio to empty string
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: usernameToSave,
          avatar: avatar || currentUser?.avatar || '',
          bio: '', // Set empty bio so modal doesn't show again
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to update profile');
      }

      const data = await response.json();
      dispatch('completed', {
        username: data.user.username,
        avatar: data.user.avatar || '',
        bio: data.user.bio || '',
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to skip profile setup';
      loading = false;
    }
  }
</script>

<div class="modal-overlay" on:click|stopPropagation>
  <div class="modal-content" role="dialog" aria-labelledby="modal-title" aria-modal="true">
    <div class="modal-header">
      <h2 id="modal-title">Set Up Your Profile</h2>
      <p class="subtitle">Customize your profile to get started</p>
    </div>

    <div class="modal-body">
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-section">
        <label class="form-label">Profile Picture</label>
        <div class="avatar-section">
          <div class="avatar-preview" on:click={handleAvatarSelect}>
            {#if avatarPreview}
              <img src={avatarPreview} alt="Avatar preview" />
            {:else if avatar}
              <img src={avatar} alt="Current avatar" />
            {:else}
              <div class="avatar-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M20 21C20 16.58 16.42 13 12 13C7.58 13 4 16.58 4 21"/>
                </svg>
              </div>
            {/if}
            <div class="avatar-overlay">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Upload</span>
            </div>
          </div>
          <input
            type="file"
            bind:this={fileInput}
            on:change={handleFileChange}
            accept="image/*"
            class="hidden-input"
          />
          <p class="hint">Click to upload a profile picture (optional)</p>
        </div>
      </div>

      <div class="form-section">
        <label for="username" class="form-label">Username <span class="required">*</span></label>
        <input
          id="username"
          type="text"
          bind:value={username}
          placeholder="Enter your username"
          class="form-input"
          maxlength="32"
          required
        />
      </div>

      <div class="form-section">
        <label for="bio" class="form-label">Bio</label>
        <textarea
          id="bio"
          bind:value={bio}
          placeholder="Tell us a little about yourself..."
          class="form-textarea"
          maxlength="500"
          rows="4"
        ></textarea>
        <p class="hint">{bio.length}/500 characters</p>
      </div>
    </div>

    <div class="modal-footer">
      <button 
        class="skip-button" 
        on:click={skipToMySpace}
        disabled={loading}
      >
        Skip for now
      </button>
      <button 
        class="save-button" 
        on:click={handleSubmit}
        disabled={loading || !username.trim()}
      >
        {loading ? 'Saving...' : 'Save & Go to My Space'}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .modal-content {
    background: #0a0a14;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    padding: 24px 24px 0 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 24px;
    text-align: center;
  }

  .modal-header h2 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .modal-header .subtitle {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 24px 0;
  }

  .modal-body {
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-label {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .required {
    color: #ef4444;
  }

  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .avatar-preview {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    border: 3px solid rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
  }

  .avatar-preview:hover {
    border-color: #63b3ed;
    transform: scale(1.05);
  }

  .avatar-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
  }

  .avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
    color: #fff;
    font-size: 12px;
  }

  .avatar-preview:hover .avatar-overlay {
    opacity: 1;
  }

  .hidden-input {
    display: none;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 15px;
    font-family: inherit;
    transition: all 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #63b3ed;
    background: rgba(255, 255, 255, 0.08);
  }

  .form-input::placeholder,
  .form-textarea::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  .modal-footer {
    padding: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .skip-button,
  .save-button {
    flex: 1;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .skip-button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .skip-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .save-button {
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
  }

  .save-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 54, 93, 0.4);
  }

  .skip-button:disabled,
  .save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

