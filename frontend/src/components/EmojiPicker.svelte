<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { apiUrl } from '../lib/api';

  export let guildId: string | null = null;
  export let authToken: string = '';
  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { emoji: string; isCustom: boolean; url?: string };
    close: void;
  }>();

  // Custom emoji type
  interface CustomEmoji {
    id: string;
    name: string;
    image_url: string;
    animated: boolean;
  }

  // Tab state
  type Tab = 'custom' | 'standard' | 'upload';
  let activeTab: Tab = 'custom';

  // Custom emojis from guild
  let customEmojis: CustomEmoji[] = [];
  let loadingCustom = false;

  // Upload state
  let uploadUrl = '';
  let uploadName = '';
  let uploadAnimated = false;
  let uploading = false;
  let uploadError = '';

  // Search
  let searchQuery = '';

  // Standard emoji categories
  const standardEmojis = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
    'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋'],
    'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    'Food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
    'Objects': ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
  };

  // Load custom emojis when opened
  $: if (isOpen && guildId) {
    loadCustomEmojis();
  }

  async function loadCustomEmojis() {
    if (!guildId || !authToken) return;
    
    loadingCustom = true;
    try {
      const response = await fetch(apiUrl(`/api/guilds/${guildId}/emojis`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        customEmojis = data.emojis || [];
      }
    } catch (error) {
      console.error('Failed to load custom emojis:', error);
    } finally {
      loadingCustom = false;
    }
  }

  function selectEmoji(emoji: string, isCustom: boolean = false, url?: string) {
    dispatch('select', { emoji, isCustom, url });
  }

  function selectCustomEmoji(emoji: CustomEmoji) {
    // Insert as :emoji_name: format that will be rendered as image
    dispatch('select', { 
      emoji: `:${emoji.name}:`, 
      isCustom: true, 
      url: emoji.image_url 
    });
  }

  async function uploadEmoji() {
    if (!uploadUrl.trim() || !uploadName.trim() || !guildId || !authToken) return;
    
    uploading = true;
    uploadError = '';
    
    try {
      const response = await fetch(apiUrl(`/api/guilds/${guildId}/emojis`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: uploadName.trim(),
          image_url: uploadUrl.trim(),
          animated: uploadAnimated,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to upload emoji');
      }

      // Refresh emoji list
      await loadCustomEmojis();
      
      // Clear form
      uploadUrl = '';
      uploadName = '';
      uploadAnimated = false;
      
      // Switch to custom tab to show new emoji
      activeTab = 'custom';
    } catch (error) {
      uploadError = error instanceof Error ? error.message : 'Failed to upload emoji';
    } finally {
      uploading = false;
    }
  }

  async function deleteEmoji(emojiId: string) {
    if (!guildId || !authToken) return;
    
    if (!confirm('Delete this emoji?')) return;
    
    try {
      const response = await fetch(apiUrl(`/api/guilds/${guildId}/emojis/${emojiId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      if (response.ok) {
        customEmojis = customEmojis.filter(e => e.id !== emojiId);
      }
    } catch (error) {
      console.error('Failed to delete emoji:', error);
    }
  }

  // Filter emojis by search
  $: filteredCustomEmojis = searchQuery 
    ? customEmojis.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : customEmojis;

  function close() {
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="emoji-picker">
    <div class="picker-header">
      <input
        type="text"
        class="emoji-search"
        placeholder="Search emojis..."
        bind:value={searchQuery}
      />
      <button class="close-btn" on:click={close}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="tabs">
      <button 
        class="tab" 
        class:active={activeTab === 'custom'}
        on:click={() => activeTab = 'custom'}
      >
        Server
      </button>
      <button 
        class="tab" 
        class:active={activeTab === 'standard'}
        on:click={() => activeTab = 'standard'}
      >
        Standard
      </button>
      <button 
        class="tab" 
        class:active={activeTab === 'upload'}
        on:click={() => activeTab = 'upload'}
      >
        Upload
      </button>
    </div>

    <div class="picker-content">
      {#if activeTab === 'custom'}
        <div class="custom-emojis">
          {#if loadingCustom}
            <div class="loading">Loading emojis...</div>
          {:else if filteredCustomEmojis.length === 0}
            <div class="empty">
              {#if searchQuery}
                No emojis match "{searchQuery}"
              {:else}
                No custom emojis yet. Upload one!
              {/if}
            </div>
          {:else}
            <div class="emoji-grid custom">
              {#each filteredCustomEmojis as emoji (emoji.id)}
                <button 
                  class="emoji-item custom-emoji"
                  on:click={() => selectCustomEmoji(emoji)}
                  title={`:${emoji.name}:`}
                >
                  <img src={emoji.image_url} alt={emoji.name} />
                  <button 
                    class="delete-emoji" 
                    on:click|stopPropagation={() => deleteEmoji(emoji.id)}
                    title="Delete emoji"
                  >×</button>
                </button>
              {/each}
            </div>
          {/if}
        </div>

      {:else if activeTab === 'standard'}
        <div class="standard-emojis">
          {#each Object.entries(standardEmojis) as [category, emojis]}
            {@const filtered = searchQuery 
              ? emojis.filter(e => e.includes(searchQuery))
              : emojis}
            {#if filtered.length > 0}
              <div class="emoji-category">
                <h4 class="category-title">{category}</h4>
                <div class="emoji-grid">
                  {#each filtered as emoji}
                    <button 
                      class="emoji-item"
                      on:click={() => selectEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>

      {:else if activeTab === 'upload'}
        <div class="upload-section">
          <p class="upload-hint">
            Upload custom emojis from <a href="https://emoji.gg" target="_blank" rel="noopener">emoji.gg</a> or any image URL
          </p>
          
          <div class="upload-form">
            <label class="form-label">
              Emoji Name
              <input
                type="text"
                class="form-input"
                placeholder="my_emoji"
                bind:value={uploadName}
                maxlength="32"
              />
            </label>
            
            <label class="form-label">
              Image URL
              <input
                type="url"
                class="form-input"
                placeholder="https://emoji.gg/assets/emoji/..."
                bind:value={uploadUrl}
              />
            </label>

            <label class="form-checkbox">
              <input type="checkbox" bind:checked={uploadAnimated} />
              Animated (GIF)
            </label>

            {#if uploadUrl}
              <div class="preview">
                <span>Preview:</span>
                <img src={uploadUrl} alt="Preview" class="preview-img" />
              </div>
            {/if}

            {#if uploadError}
              <div class="error">{uploadError}</div>
            {/if}

            <button 
              class="upload-btn"
              on:click={uploadEmoji}
              disabled={uploading || !uploadUrl.trim() || !uploadName.trim()}
            >
              {uploading ? 'Uploading...' : 'Upload Emoji'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .emoji-picker {
    position: absolute;
    bottom: 100%;
    left: 60px;
    width: 340px;
    max-height: 400px;
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    margin-bottom: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(20px);
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .picker-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .emoji-search {
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 14px;
  }

  .emoji-search::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .emoji-search:focus {
    outline: none;
    border-color: rgba(49, 130, 206, 0.5);
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

  .tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab {
    flex: 1;
    padding: 10px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border-bottom: 2px solid transparent;
  }

  .tab:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.05);
  }

  .tab.active {
    color: #63b3ed;
    border-bottom-color: #63b3ed;
  }

  .picker-content {
    flex: 1;
    overflow-y: auto;
    max-height: 280px;
  }

  .picker-content::-webkit-scrollbar {
    width: 6px;
  }

  .picker-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .picker-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .loading, .empty {
    padding: 40px 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    padding: 8px;
  }

  .emoji-grid.custom {
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }

  .emoji-item {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .emoji-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.1);
  }

  .custom-emoji {
    position: relative;
    padding: 4px;
  }

  .custom-emoji img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .delete-emoji {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ef4444;
    border: none;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .custom-emoji:hover .delete-emoji {
    opacity: 1;
  }

  .emoji-category {
    margin-bottom: 12px;
  }

  .category-title {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .upload-section {
    padding: 16px;
  }

  .upload-hint {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 16px;
  }

  .upload-hint a {
    color: #63b3ed;
    text-decoration: none;
  }

  .upload-hint a:hover {
    text-decoration: underline;
  }

  .upload-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .form-input {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 12px;
    color: #fff;
    font-size: 14px;
  }

  .form-input:focus {
    outline: none;
    border-color: rgba(49, 130, 206, 0.5);
  }

  .form-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .form-checkbox input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .preview {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .preview-img {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 4px;
  }

  .error {
    padding: 10px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
  }

  .upload-btn {
    padding: 12px;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .upload-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 54, 93, 0.4);
  }

  .upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
