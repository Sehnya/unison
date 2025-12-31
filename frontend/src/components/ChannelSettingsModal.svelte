<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Channel } from '../types';
  import { apiUrl } from '../lib/api';

  export let isOpen: boolean = false;
  export let channel: Channel | null = null;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    update: { channel: Channel };
  }>();

  let name = '';
  let topic = '';
  let backgroundUrl = '';
  let backgroundPreview: string | null = null;
  let textColor = '#ffffff';
  let saving = false;
  let error = '';

  let backgroundInput: HTMLInputElement;

  // Preset colors for text
  const colorPresets = [
    '#ffffff', '#e5e5e5', '#a3a3a3',
    '#fca5a5', '#fdba74', '#fcd34d',
    '#86efac', '#67e8f9', '#a5b4fc',
    '#f0abfc', '#fb7185'
  ];

  // Initialize form when channel changes
  $: if (channel && isOpen) {
    name = channel.name || '';
    topic = channel.topic || '';
    // Load custom settings from localStorage
    try {
      const stored = localStorage.getItem(`channel_settings_${channel.id}`);
      if (stored) {
        const settings = JSON.parse(stored);
        backgroundUrl = settings.background_url || '';
        backgroundPreview = settings.background_url || null;
        textColor = settings.text_color || '#ffffff';
      } else {
        backgroundUrl = '';
        backgroundPreview = null;
        textColor = '#ffffff';
      }
    } catch {
      backgroundUrl = '';
      backgroundPreview = null;
      textColor = '#ffffff';
    }
    error = '';
  }

  function handleBackgroundUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error = 'please upload an image or gif file';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      backgroundPreview = base64;
      backgroundUrl = base64;
    };
    reader.readAsDataURL(file);
  }

  function removeBackground() {
    backgroundPreview = null;
    backgroundUrl = '';
  }

  function setBackgroundFromUrl() {
    if (backgroundUrl.trim()) {
      backgroundPreview = backgroundUrl.trim();
    }
  }

  async function handleSave() {
    if (!channel || !authToken) return;
    if (!name.trim()) {
      error = 'channel name is required';
      return;
    }

    saving = true;
    error = '';

    try {
      const body: any = { 
        name: name.trim(),
        topic: topic.trim() || null
      };

      const response = await fetch(apiUrl(`/api/channels/${channel.id}`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'failed to update channel');
      }

      const data = await response.json();
      // Store custom settings in localStorage for now (until backend supports it)
      const customSettings = {
        background_url: backgroundUrl || null,
        text_color: textColor
      };
      localStorage.setItem(`channel_settings_${channel.id}`, JSON.stringify(customSettings));
      
      dispatch('update', { channel: { ...data.channel, settings: customSettings } });
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
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && channel}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <button class="backdrop" on:click={() => dispatch('close')} aria-label="Close"></button>
    
    <div class="modal">
      <header class="modal-header">
        <h2>channel settings</h2>
        <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <div class="modal-content">
        <!-- Name Section -->
        <section class="section">
          <label class="section-label" for="channel-name">channel name</label>
          <input 
            id="channel-name"
            type="text" 
            bind:value={name}
            placeholder="enter channel name"
            maxlength="100"
          />
        </section>

        <!-- Topic Section -->
        <section class="section">
          <label class="section-label" for="channel-topic">topic</label>
          <input 
            id="channel-topic"
            type="text" 
            bind:value={topic}
            placeholder="what's this channel about?"
            maxlength="1024"
          />
        </section>

        <!-- Background Section -->
        <section class="section">
          <label class="section-label">background image / gif</label>
          <div class="background-preview" class:has-bg={backgroundPreview}>
            {#if backgroundPreview}
              <img src={backgroundPreview} alt="Channel background" />
              <button class="remove-bg" on:click={removeBackground}>×</button>
            {:else}
              <div class="bg-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span>add background</span>
              </div>
            {/if}
            <input type="file" bind:this={backgroundInput} on:change={handleBackgroundUpload} accept="image/*,.gif" class="hidden" />
          </div>
          <div class="bg-actions">
            <button class="btn-secondary small" on:click={() => backgroundInput?.click()}>
              upload file
            </button>
            <span class="or-text">or</span>
            <div class="url-input-row">
              <input 
                type="text" 
                bind:value={backgroundUrl}
                placeholder="paste image/gif url"
                class="url-input"
              />
              <button class="btn-secondary small" on:click={setBackgroundFromUrl}>
                apply
              </button>
            </div>
          </div>
        </section>

        <!-- Text Color Section -->
        <section class="section">
          <label class="section-label">text color</label>
          <div class="color-preview-row">
            <div class="color-preview" style="background: {textColor}"></div>
            <input 
              type="text" 
              bind:value={textColor}
              placeholder="#ffffff"
              class="color-input"
            />
          </div>
          <div class="color-presets">
            {#each colorPresets as color}
              <button 
                class="color-preset" 
                class:active={textColor === color}
                style="background: {color}"
                on:click={() => textColor = color}
                aria-label="Select color {color}"
              ></button>
            {/each}
          </div>
          <div class="color-sample" style="color: {textColor}; background: {backgroundPreview ? `url(${backgroundPreview})` : 'rgba(255,255,255,0.05)'}; background-size: cover;">
            <span>sample message text</span>
          </div>
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
  }

  input[type="text"]:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .background-preview {
    position: relative;
    width: 100%;
    height: 100px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 12px;
  }

  .background-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bg-placeholder {
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

  .remove-bg {
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

  .remove-bg:hover {
    background: rgba(239, 68, 68, 0.8);
  }

  .bg-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .or-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  .url-input-row {
    display: flex;
    gap: 8px;
    flex: 1;
    min-width: 200px;
  }

  .url-input {
    flex: 1;
    padding: 8px 12px !important;
    font-size: 12px !important;
  }

  .color-preview-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .color-preview {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .color-input {
    flex: 1;
    font-family: 'JetBrains Mono', monospace !important;
  }

  .color-presets {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .color-preset {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .color-preset:hover {
    transform: scale(1.1);
  }

  .color-preset.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
  }

  .color-sample {
    padding: 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 14px;
    text-align: center;
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

  .btn-secondary.small {
    padding: 8px 12px;
    font-size: 12px;
  }
</style>
