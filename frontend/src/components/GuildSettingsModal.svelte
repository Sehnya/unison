<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Guild } from '../types';
  import { apiUrl } from '../lib/api';

  export let isOpen: boolean = false;
  export let guild: Guild | null = null;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    update: { guild: Guild };
  }>();

  let name = '';
  let description = '';
  let iconPreview: string | null = null;
  let iconBase64: string | null = null;
  let bannerPreview: string | null = null;
  let bannerBase64: string | null = null;
  let saving = false;
  let error = '';

  let iconInput: HTMLInputElement;
  let bannerInput: HTMLInputElement;

  // Initialize form when guild changes
  $: if (guild && isOpen) {
    name = guild.name || '';
    description = guild.description || '';
    iconPreview = guild.icon || null;
    iconBase64 = null;
    bannerPreview = guild.banner || null;
    bannerBase64 = null;
    error = '';
  }

  function handleIconUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error = 'please upload an image file';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      iconPreview = base64;
      iconBase64 = base64;
    };
    reader.readAsDataURL(file);
  }

  function handleBannerUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error = 'please upload an image file';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      bannerPreview = base64;
      bannerBase64 = base64;
    };
    reader.readAsDataURL(file);
  }

  function removeIcon() {
    iconPreview = null;
    iconBase64 = '';
  }

  function removeBanner() {
    bannerPreview = null;
    bannerBase64 = '';
  }

  async function handleSave() {
    if (!guild || !authToken) return;
    if (!name.trim()) {
      error = 'guild name is required';
      return;
    }

    saving = true;
    error = '';

    try {
      const body: any = { name: name.trim() };
      if (description.trim()) body.description = description.trim();
      if (iconBase64 !== null) body.icon = iconBase64 || null;
      if (bannerBase64 !== null) body.banner = bannerBase64 || null;

      const response = await fetch(apiUrl(`/api/guilds/${guild.id}`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'failed to update guild');
      }

      const data = await response.json();
      dispatch('update', { guild: data.guild });
      dispatch('close');
    } catch (err) {
      error = err instanceof Error ? err.message : 'failed to save';
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }

  function getGuildInitials(guildName: string): string {
    return guildName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && guild}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <button class="backdrop" on:click={() => dispatch('close')} aria-label="Close"></button>
    
    <div class="modal">
      <header class="modal-header">
        <h2>guild settings</h2>
        <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <div class="modal-content">
        <!-- Icon Section -->
        <section class="section">
          <label class="section-label">guild icon</label>
          <div class="icon-row">
            <div class="icon-preview">
              {#if iconPreview}
                <img src={iconPreview} alt="Guild icon" />
              {:else}
                <div class="icon-placeholder">
                  {getGuildInitials(name || guild.name)}
                </div>
              {/if}
            </div>
            <div class="icon-actions">
              <input type="file" bind:this={iconInput} on:change={handleIconUpload} accept="image/*" class="hidden" />
              <button class="btn-secondary" on:click={() => iconInput?.click()}>
                upload icon
              </button>
              {#if iconPreview}
                <button class="btn-text" on:click={removeIcon}>remove</button>
              {/if}
            </div>
          </div>
        </section>

        <!-- Banner Section -->
        <section class="section">
          <label class="section-label">guild banner</label>
          <div class="banner-preview" class:has-banner={bannerPreview}>
            {#if bannerPreview}
              <img src={bannerPreview} alt="Guild banner" />
              <button class="remove-banner" on:click={removeBanner}>×</button>
            {:else}
              <div class="banner-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span>add banner image</span>
              </div>
            {/if}
            <input type="file" bind:this={bannerInput} on:change={handleBannerUpload} accept="image/*" class="hidden" />
            <button class="banner-upload-btn" on:click={() => bannerInput?.click()}>
              {bannerPreview ? 'change' : 'upload'}
            </button>
          </div>
        </section>

        <!-- Name Section -->
        <section class="section">
          <label class="section-label" for="guild-name">guild name</label>
          <input 
            id="guild-name"
            type="text" 
            bind:value={name}
            placeholder="enter guild name"
            maxlength="100"
          />
        </section>

        <!-- Description Section -->
        <section class="section">
          <label class="section-label" for="guild-desc">description</label>
          <textarea 
            id="guild-desc"
            bind:value={description}
            placeholder="what's this guild about?"
            rows="3"
            maxlength="500"
          ></textarea>
        </section>

        {#if error}
          <div class="error-message">{error}</div>
        {/if}
      </div>

      <footer class="modal-footer">
        <button class="btn-secondary" on:click={() => dispatch('close')}>cancel</button>
        <button class="btn-primary" on:click={handleSave} disabled={saving}>
          {saving ? 'saving...' : 'save changes'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    border: none;
    cursor: pointer;
  }

  .modal {
    position: relative;
    width: 100%;
    max-width: 480px;
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

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 0;
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

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .section {
    margin-bottom: 24px;
  }

  .section-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }

  .icon-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .icon-preview {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.04);
    border: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .icon-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .icon-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
  }

  .icon-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .banner-preview {
    position: relative;
    width: 100%;
    height: 120px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .banner-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.25);
    font-size: 12px;
  }

  .banner-upload-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .banner-upload-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
  }

  .remove-banner {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .remove-banner:hover {
    background: rgba(239, 68, 68, 0.8);
  }

  input[type="text"], textarea {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.2s ease;
    resize: none;
  }

  input[type="text"]:focus, textarea:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
  }

  input::placeholder, textarea::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .hidden {
    display: none;
  }

  .error-message {
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-primary {
    padding: 10px 20px;
    background: #fff;
    border: none;
    border-radius: 8px;
    color: #050505;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .btn-text {
    padding: 6px 12px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .btn-text:hover {
    color: #ef4444;
  }
</style>
