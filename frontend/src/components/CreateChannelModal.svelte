<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let channelType: 'text' | 'voice' | 'document' = 'text';

  const dispatch = createEventDispatcher<{
    close: void;
    create: { name: string; type: 'text' | 'voice' | 'document' };
  }>();

  let channelName = '';
  let isCreating = false;
  let error = '';

  // Reset state when modal opens/closes
  $: if (!isOpen) {
    channelName = '';
    isCreating = false;
    error = '';
  }

  function validateChannelName(name: string): string | null {
    if (!name.trim()) return 'Channel name is required';
    if (name.length < 2) return 'Channel name must be at least 2 characters';
    if (name.length > 100) return 'Channel name must be less than 100 characters';
    // Channel names should be lowercase with hyphens (like Discord)
    if (!/^[a-z0-9-]+$/.test(name.toLowerCase().replace(/\s+/g, '-'))) {
      return 'Channel name can only contain letters, numbers, and hyphens';
    }
    return null;
  }

  function formatChannelName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function handleCreate() {
    const formattedName = formatChannelName(channelName);
    const validationError = validateChannelName(formattedName);
    
    if (validationError) {
      error = validationError;
      return;
    }

    if (isCreating) return;
    
    isCreating = true;
    error = '';
    
    dispatch('create', {
      name: formattedName,
      type: channelType
    });

    // Fallback reset after 10 seconds
    setTimeout(() => {
      if (isCreating && isOpen) {
        isCreating = false;
        error = 'Request timed out. Please try again.';
      }
    }, 10000);
  }

  function handleClose() {
    channelName = '';
    error = '';
    isCreating = false;
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
    if (e.key === 'Enter' && channelName.trim()) handleCreate();
  }

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    channelName = input.value;
    error = '';
  }
</script>

{#if isOpen}
  <div class="modal-overlay" on:click={handleClose} on:keydown={handleKeydown} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div class="header-icon" class:voice={channelType === 'voice'} class:document={channelType === 'document'}>
          {#if channelType === 'voice'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
              <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
              <path d="M12 19V23M8 23H16"/>
            </svg>
          {:else if channelType === 'document'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          {:else}
            <span class="hash">#</span>
          {/if}
        </div>
        <div class="header-text">
          <h2 id="modal-title" class="modal-title">Create {channelType === 'voice' ? 'Voice' : channelType === 'document' ? 'Document' : 'Text'} Channel</h2>
          <p class="modal-subtitle">in {channelType === 'voice' ? 'VOICE' : channelType === 'document' ? 'DOCUMENT' : 'TEXT'} CHANNELS</p>
        </div>
        <button class="close-btn" on:click={handleClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="modal-content">
        <div class="channel-type-selector">
          <button 
            class="type-option" 
            class:active={channelType === 'text'}
            on:click={() => channelType = 'text'}
          >
            <div class="type-icon">
              <span class="hash">#</span>
            </div>
            <div class="type-info">
              <span class="type-name">Text</span>
              <span class="type-desc">Send messages, images, GIFs, and more</span>
            </div>
            <div class="type-check" class:visible={channelType === 'text'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </button>
          <button 
            class="type-option" 
            class:active={channelType === 'voice'}
            on:click={() => channelType = 'voice'}
          >
            <div class="type-icon voice">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
              </svg>
            </div>
            <div class="type-info">
              <span class="type-name">Voice</span>
              <span class="type-desc">Hang out with voice, video, and screen share</span>
            </div>
            <div class="type-check" class:visible={channelType === 'voice'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </button>
          <button 
            class="type-option" 
            class:active={channelType === 'document'}
            on:click={() => channelType = 'document'}
          >
            <div class="type-icon document">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div class="type-info">
              <span class="type-name">Document</span>
              <span class="type-desc">Collaborate on documents in real-time</span>
            </div>
            <div class="type-check" class:visible={channelType === 'document'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </button>
        </div>

        <div class="form-group">
          <label for="channel-name">Channel Name</label>
          <div class="input-wrapper">
            <span class="input-prefix">
              {#if channelType === 'voice'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
                  <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
                </svg>
              {:else if channelType === 'document'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              {:else}
                #
              {/if}
            </span>
            <input 
              id="channel-name" 
              type="text" 
              value={channelName}
              on:input={handleInput}
              placeholder="new-channel" 
              maxlength="100"
              autocomplete="off"
            />
          </div>
          {#if error}
            <span class="error-message">{error}</span>
          {/if}
          <span class="hint">Channel names must be lowercase and use hyphens instead of spaces</span>
        </div>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" on:click={handleClose}>Cancel</button>
        <button class="create-btn" on:click={handleCreate} disabled={!channelName.trim() || isCreating}>
          {#if isCreating}
            <span class="spinner"></span> Creating...
          {:else}
            Create Channel
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    background: #1a1a2e;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    width: 440px;
    max-width: 95vw;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 24px 0;
  }

  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
  }

  .header-icon.voice {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .header-icon.document {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .header-icon .hash {
    font-size: 24px;
    font-weight: 600;
  }

  .header-text {
    flex: 1;
  }

  .modal-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
  }

  .modal-subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .modal-content {
    padding: 24px;
  }

  .channel-type-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .type-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .type-option:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .type-option.active {
    background: rgba(49, 130, 206, 0.1);
    border-color: rgba(49, 130, 206, 0.3);
  }

  .type-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
  }

  .type-icon.voice {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .type-icon.document {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .type-icon .hash {
    font-size: 18px;
    font-weight: 600;
  }

  .type-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .type-name {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }

  .type-desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .type-check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3182ce;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.15s ease;
  }

  .type-check.visible {
    opacity: 1;
    transform: scale(1);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.15s ease;
  }

  .input-wrapper:focus-within {
    border-color: #3182ce;
    box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.2);
  }

  .input-prefix {
    padding: 0 12px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 16px;
    font-weight: 500;
    display: flex;
    align-items: center;
  }

  .form-group input {
    flex: 1;
    padding: 12px 12px 12px 0;
    background: transparent;
    border: none;
    color: #fff;
    font-size: 15px;
  }

  .form-group input:focus {
    outline: none;
  }

  .form-group input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .error-message {
    font-size: 12px;
    color: #f56565;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px 24px;
    background: rgba(0, 0, 0, 0.2);
  }

  .cancel-btn, .create-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cancel-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
  }

  .cancel-btn:hover {
    color: #fff;
    text-decoration: underline;
  }

  .create-btn {
    background: #3182ce;
    border: none;
    color: #fff;
  }

  .create-btn:hover:not(:disabled) {
    background: #4299e1;
  }

  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
