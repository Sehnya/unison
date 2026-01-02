<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { updateEmbedCard, type EmbedCardData } from '../lib/profileStorage';

  export let editable = false;
  export let cardId: string;
  export let profileEmbedData: EmbedCardData | null = null;
  export let isOwnProfile = true;

  let isEditing = false;
  let editingCode = '';
  let localEmbedCode = '';
  let embedContainer: HTMLDivElement;

  // Sync local state with prop
  $: {
    if (profileEmbedData?.embedCode && !localEmbedCode) {
      localEmbedCode = profileEmbedData.embedCode;
    }
  }

  // Use local state if available, otherwise use prop
  $: embedCode = localEmbedCode || profileEmbedData?.embedCode || '';

  // Execute scripts after embed code changes
  function executeScripts() {
    if (!embedContainer || !embedCode) return;
    
    // Find all script tags in the embed code
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const srcRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
    
    // Extract external script sources
    let match;
    while ((match = srcRegex.exec(embedCode)) !== null) {
      const src = match[1];
      // Check if script already exists
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      }
    }
    
    // Execute inline scripts
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = embedCode;
    const scripts = tempDiv.querySelectorAll('script');
    scripts.forEach(oldScript => {
      if (!oldScript.src) {
        const newScript = document.createElement('script');
        newScript.textContent = oldScript.textContent;
        document.body.appendChild(newScript);
        document.body.removeChild(newScript);
      }
    });
  }

  afterUpdate(() => {
    if (embedCode && !isEditing) {
      // Small delay to ensure DOM is updated
      setTimeout(executeScripts, 100);
    }
  });

  function startEditing() {
    if (!editable || !isOwnProfile) return;
    editingCode = embedCode;
    isEditing = true;
  }

  function saveEmbed() {
    const data: EmbedCardData = {
      embedType: 'custom',
      embedUrl: '',
      embedCode: editingCode,
    };
    updateEmbedCard(cardId, data);
    localEmbedCode = editingCode;
    isEditing = false;
  }

  function cancelEdit() {
    editingCode = embedCode;
    isEditing = false;
  }

  function clearEmbed() {
    editingCode = '';
    localEmbedCode = '';
    const data: EmbedCardData = {
      embedType: 'custom',
      embedUrl: '',
      embedCode: '',
    };
    updateEmbedCard(cardId, data);
  }
</script>

<div class="embed-card">
  {#if isEditing}
    <div class="embed-editor">
      <div class="editor-header">
        <span class="editor-title">Paste HTML Embed Code</span>
        <button class="close-btn" on:click={cancelEdit}>×</button>
      </div>
      
      <textarea
        bind:value={editingCode}
        placeholder={'<iframe src="..." width="100%" height="300"></iframe>\n\nPaste any embed code from YouTube, Spotify, SoundCloud, Twitch, Google Calendar, etc.'}
        spellcheck="false"
      ></textarea>

      <div class="editor-footer">
        <button class="cancel-btn" on:click={cancelEdit}>Cancel</button>
        <button class="save-btn" on:click={saveEmbed}>Save</button>
      </div>
    </div>
  {:else if embedCode}
    <div class="embed-content">
      <div class="embed-wrapper" bind:this={embedContainer}>
        {@html embedCode}
      </div>
      
      {#if editable && isOwnProfile}
        <div class="embed-actions">
          <button class="action-btn edit" on:click={startEditing} title="Edit embed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <button class="action-btn delete" on:click={clearEmbed} title="Remove embed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <button 
      class="embed-placeholder" 
      on:click={startEditing}
      disabled={!editable || !isOwnProfile}
    >
      <div class="placeholder-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
      </div>
      <span class="placeholder-text">
        {#if editable && isOwnProfile}
          Click to add HTML embed
        {:else}
          No embed added
        {/if}
      </span>
      <span class="placeholder-hint">YouTube, Spotify, Calendars, Widgets...</span>
    </button>
  {/if}
</div>

<style>
  .embed-card {
    width: 100%;
    height: 100%;
    min-height: 150px;
    display: flex;
    flex-direction: column;
  }

  /* Editor */
  .embed-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
    padding: 16px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .editor-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  textarea {
    flex: 1;
    min-height: 120px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #e0e0e0;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: none;
    transition: border-color 0.2s ease;
  }

  textarea:focus {
    outline: none;
    border-color: rgba(99, 179, 237, 0.6);
  }

  textarea::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .editor-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .cancel-btn,
  .save-btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .save-btn {
    background: #3182ce;
    border: none;
    color: #fff;
  }

  .save-btn:hover {
    background: #2c5282;
  }

  /* Embed Content */
  .embed-content {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .embed-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .embed-wrapper :global(iframe) {
    width: 100% !important;
    height: 100% !important;
    min-height: 200px;
    border: none !important;
    border-radius: 8px;
    flex: 1;
  }

  .embed-wrapper :global(blockquote) {
    margin: 0;
  }

  .embed-wrapper :global(*) {
    max-width: 100%;
  }

  .embed-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .embed-content:hover .embed-actions {
    opacity: 1;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .action-btn.edit {
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.8);
  }

  .action-btn.edit:hover {
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
  }

  .action-btn.delete {
    background: rgba(239, 68, 68, 0.8);
    color: #fff;
  }

  .action-btn.delete:hover {
    background: rgba(239, 68, 68, 1);
  }

  /* Placeholder */
  .embed-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    margin: 16px;
    background: transparent;
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .embed-placeholder:not(:disabled):hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.03);
  }

  .embed-placeholder:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .placeholder-icon {
    color: rgba(255, 255, 255, 0.4);
  }

  .placeholder-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }

  .placeholder-hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }
</style>
