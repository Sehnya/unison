<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
    create: { name: string; description: string; icon: string; banner: string };
  }>();

  let guildName = '';
  let guildDescription = '';
  let guildIcon = '';
  let guildBanner = '';
  let iconPreview = '';
  let bannerPreview = '';
  let iconInput: HTMLInputElement;
  let bannerInput: HTMLInputElement;
  let isCreating = false;
  let activeTab: 'details' | 'media' = 'details';

  // Reset creating state when modal is closed
  $: if (!isOpen && isCreating) {
    isCreating = false;
  }

  function handleIconUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        iconPreview = e.target?.result as string;
        guildIcon = iconPreview;
      };
      reader.readAsDataURL(file);
    }
  }

  function handleBannerUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        bannerPreview = e.target?.result as string;
        guildBanner = bannerPreview;
      };
      reader.readAsDataURL(file);
    }
  }

  function handleIconUrlChange(url: string) {
    guildIcon = url;
    iconPreview = url;
  }

  function handleBannerUrlChange(url: string) {
    guildBanner = url;
    bannerPreview = url;
  }

  function clearIcon() {
    guildIcon = '';
    iconPreview = '';
    if (iconInput) iconInput.value = '';
  }

  function clearBanner() {
    guildBanner = '';
    bannerPreview = '';
    if (bannerInput) bannerInput.value = '';
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'GD';
  }

  function handleCreate() {
    if (!guildName.trim() || isCreating) return;
    isCreating = true;
    dispatch('create', {
      name: guildName.trim(),
      description: guildDescription.trim(),
      icon: guildIcon,
      banner: guildBanner
    });
    // Fallback: reset creating state after 10 seconds if modal is still open
    // (in case of error that doesn't close the modal)
    setTimeout(() => {
      if (isCreating && isOpen) {
        isCreating = false;
      }
    }, 10000);
  }

  function handleClose() {
    guildName = '';
    guildDescription = '';
    guildIcon = '';
    guildBanner = '';
    iconPreview = '';
    bannerPreview = '';
    activeTab = 'details';
    isCreating = false;
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }
</script>

{#if isOpen}
  <div class="modal-overlay" on:click={handleClose} on:keydown={handleKeydown} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true">
      <div class="banner-area" style={bannerPreview ? `background-image: url(${bannerPreview})` : ''}>
        <div class="banner-overlay"></div>
        <button class="close-btn" on:click={handleClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div class="icon-preview-container">
          {#if iconPreview}
            <img src={iconPreview} alt="Guild icon" class="icon-preview" />
          {:else}
            <div class="icon-placeholder">
              <span class="icon-initials">{getInitials(guildName)}</span>
            </div>
          {/if}
          <button class="icon-edit-btn" on:click={() => iconInput?.click()} aria-label="Upload icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="modal-content">
        <h2 class="modal-title">Create Your Guild</h2>
        <p class="modal-subtitle">Build your community with a unique identity</p>

        <div class="tabs">
          <button class="tab" class:active={activeTab === 'details'} on:click={() => activeTab = 'details'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Details
          </button>
          <button class="tab" class:active={activeTab === 'media'} on:click={() => activeTab = 'media'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Media
          </button>
        </div>

        <div class="tab-content">
          {#if activeTab === 'details'}
            <div class="form-group">
              <label for="guild-name">Guild Name <span class="required">*</span></label>
              <input id="guild-name" type="text" bind:value={guildName} placeholder="Enter a memorable name..." maxlength="100" />
              <span class="char-count">{guildName.length}/100</span>
            </div>
            <div class="form-group">
              <label for="guild-description">Description</label>
              <textarea id="guild-description" bind:value={guildDescription} placeholder="What's your guild about?" rows="4" maxlength="500"></textarea>
              <span class="char-count">{guildDescription.length}/500</span>
            </div>
          {:else}
            <div class="media-section">
              <div class="media-header">
                <span class="media-label">Guild Icon</span>
                <span class="media-hint">Supports images & GIFs</span>
              </div>
              <div class="upload-options">
                <div class="upload-box" on:click={() => iconInput?.click()} on:keydown={(e) => e.key === 'Enter' && iconInput?.click()} role="button" tabindex="0">
                  <input bind:this={iconInput} type="file" accept="image/*,.gif" on:change={handleIconUpload} hidden />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Upload</span>
                </div>
                <div class="url-input-group">
                  <input type="url" placeholder="Or paste image/GIF URL..." value={guildIcon} on:input={(e) => handleIconUrlChange(e.currentTarget.value)} />
                  {#if iconPreview}
                    <button class="clear-btn" on:click={clearIcon} aria-label="Clear">×</button>
                  {/if}
                </div>
              </div>
            </div>
            <div class="media-section">
              <div class="media-header">
                <span class="media-label">Banner Image</span>
                <span class="media-hint">Recommended: 960x540</span>
              </div>
              <div class="upload-options">
                <div class="upload-box" on:click={() => bannerInput?.click()} on:keydown={(e) => e.key === 'Enter' && bannerInput?.click()} role="button" tabindex="0">
                  <input bind:this={bannerInput} type="file" accept="image/*,.gif" on:change={handleBannerUpload} hidden />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Upload</span>
                </div>
                <div class="url-input-group">
                  <input type="url" placeholder="Or paste image/GIF URL..." value={guildBanner} on:input={(e) => handleBannerUrlChange(e.currentTarget.value)} />
                  {#if bannerPreview}
                    <button class="clear-btn" on:click={clearBanner} aria-label="Clear">×</button>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" on:click={handleClose}>Cancel</button>
          <button class="create-btn" on:click={handleCreate} disabled={!guildName.trim() || isCreating}>
            {#if isCreating}
              <span class="spinner"></span> Creating...
            {:else}
              Create Guild
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    width: 480px;
    max-width: 95vw;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .banner-area {
    position: relative;
    height: 140px;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 50%, #1a365d 100%);
    background-size: cover;
    background-position: center;
  }
  .banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 0%, rgba(26, 26, 46, 0.8) 100%);
  }
  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    z-index: 10;
  }
  .close-btn:hover { background: rgba(0, 0, 0, 0.6); color: #fff; transform: rotate(90deg); }

  .icon-preview-container {
    position: absolute;
    bottom: -40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
  }
  .icon-preview, .icon-placeholder {
    width: 88px;
    height: 88px;
    border-radius: 24px;
    border: 4px solid #1a1a2e;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }
  .icon-preview { object-fit: cover; }
  .icon-placeholder {
    background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-initials { font-size: 28px; font-weight: 700; color: #fff; }
  .icon-edit-btn {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid #1a1a2e;
    background: #3182ce;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .icon-edit-btn:hover { background: #4299e1; transform: scale(1.1); }

  .modal-content { padding: 56px 28px 28px; }
  .modal-title { margin: 0; font-size: 24px; font-weight: 700; color: #fff; text-align: center; }
  .modal-subtitle { margin: 8px 0 24px; font-size: 14px; color: rgba(255, 255, 255, 0.5); text-align: center; }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    background: rgba(255, 255, 255, 0.03);
    padding: 6px;
    border-radius: 12px;
  }
  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  .tab:hover { color: rgba(255, 255, 255, 0.8); background: rgba(255, 255, 255, 0.05); }
  .tab.active { background: rgba(49, 130, 206, 0.2); color: #63b3ed; }

  .tab-content { min-height: 200px; }

  .form-group { margin-bottom: 20px; position: relative; }
  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .required { color: #f56565; }
  .form-group input, .form-group textarea {
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 15px;
    font-family: inherit;
    transition: all 0.2s ease;
    resize: none;
  }
  .form-group input:focus, .form-group textarea:focus {
    outline: none;
    border-color: #3182ce;
    background: rgba(49, 130, 206, 0.1);
    box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15);
  }
  .form-group input::placeholder, .form-group textarea::placeholder { color: rgba(255, 255, 255, 0.3); }
  .char-count { position: absolute; right: 12px; bottom: 12px; font-size: 11px; color: rgba(255, 255, 255, 0.3); }

  .media-section { margin-bottom: 24px; }
  .media-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .media-label { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.7); text-transform: uppercase; letter-spacing: 0.5px; }
  .media-hint { font-size: 11px; color: rgba(255, 255, 255, 0.4); }
  .upload-options { display: flex; gap: 12px; }
  .upload-box {
    flex: 0 0 80px;
    height: 70px;
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: rgba(255, 255, 255, 0.4);
  }
  .upload-box:hover { border-color: #3182ce; background: rgba(49, 130, 206, 0.1); color: #63b3ed; }
  .upload-box span { font-size: 10px; font-weight: 500; }
  .url-input-group { flex: 1; position: relative; }
  .url-input-group input {
    width: 100%;
    height: 70px;
    padding: 0 36px 0 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 13px;
    transition: all 0.2s ease;
  }
  .url-input-group input:focus { outline: none; border-color: #3182ce; background: rgba(49, 130, 206, 0.1); }
  .url-input-group input::placeholder { color: rgba(255, 255, 255, 0.3); }
  .clear-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    transition: all 0.2s ease;
  }
  .clear-btn:hover { background: rgba(239, 68, 68, 0.2); color: #f56565; }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .cancel-btn, .create-btn {
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cancel-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }
  .cancel-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
  .create-btn {
    background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
    border: none;
    color: #fff;
    box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
  }
  .create-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(49, 130, 206, 0.4); }
  .create-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
