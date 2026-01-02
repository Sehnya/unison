<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { updateCalendarCard, type CalendarCardData } from '../lib/profileStorage';

  export let editable = false;
  export let cardId: string;
  export let profileCalendarData: CalendarCardData | null = null;
  export let isOwnProfile = true;

  const dispatch = createEventDispatcher();

  type CalendarType = 'google' | 'outlook' | 'custom';

  let calendarType: CalendarType = profileCalendarData?.calendarType || 'google';
  let embedUrl = profileCalendarData?.embedUrl || '';
  let title = profileCalendarData?.title || '';
  let isEditing = false;
  let parsedEmbedUrl = '';

  const calendarTypes = [
    { value: 'google', label: 'Google Calendar', icon: '📅', placeholder: 'Paste your Google Calendar embed URL' },
    { value: 'outlook', label: 'Outlook', icon: '📆', placeholder: 'Paste your Outlook Calendar embed URL' },
    { value: 'custom', label: 'Custom', icon: '🗓️', placeholder: 'Paste any calendar embed URL' },
  ];

  // Parse URL to ensure it's a valid embed URL
  function parseCalendarUrl(url: string, type: CalendarType): string {
    if (!url) return '';
    
    try {
      switch (type) {
        case 'google': {
          // Handle Google Calendar URLs
          if (url.includes('calendar.google.com')) {
            // If it's already an embed URL, use it
            if (url.includes('/embed')) {
              return url;
            }
            // Try to extract calendar ID and create embed URL
            const calIdMatch = url.match(/src=([^&]+)/);
            if (calIdMatch) {
              return `https://calendar.google.com/calendar/embed?src=${calIdMatch[1]}&ctz=local`;
            }
          }
          break;
        }
        case 'outlook': {
          // Handle Outlook Calendar URLs
          if (url.includes('outlook.office365.com') || url.includes('outlook.live.com')) {
            return url;
          }
          break;
        }
        case 'custom':
          return url;
      }
    } catch (e) {
      console.error('Error parsing calendar URL:', e);
    }
    return url;
  }

  // Update parsed URL when inputs change
  $: parsedEmbedUrl = parseCalendarUrl(embedUrl, calendarType);

  function setCalendarType(value: string) {
    calendarType = value as CalendarType;
  }

  function startEditing() {
    if (!editable || !isOwnProfile) return;
    isEditing = true;
  }

  function saveCalendar() {
    const data: CalendarCardData = {
      calendarType,
      embedUrl,
      title: title || undefined,
    };
    updateCalendarCard(cardId, data);
    isEditing = false;
  }

  function cancelEdit() {
    // Reset to saved values
    calendarType = profileCalendarData?.calendarType || 'google';
    embedUrl = profileCalendarData?.embedUrl || '';
    title = profileCalendarData?.title || '';
    isEditing = false;
  }

  // Load data on mount
  onMount(() => {
    if (profileCalendarData) {
      calendarType = profileCalendarData.calendarType;
      embedUrl = profileCalendarData.embedUrl;
      title = profileCalendarData.title || '';
    }
  });
</script>

<div class="calendar-card" class:editing={isEditing}>
  {#if isEditing}
    <div class="calendar-editor">
      <div class="editor-header">
        <h4>Add Calendar</h4>
        <button class="close-btn" on:click={cancelEdit}>×</button>
      </div>
      
      <div class="calendar-type-selector">
        {#each calendarTypes as type}
          <button 
            class="type-btn" 
            class:active={calendarType === type.value}
            on:click={() => setCalendarType(type.value)}
          >
            <span class="type-icon">{type.icon}</span>
            <span class="type-label">{type.label}</span>
          </button>
        {/each}
      </div>

      <div class="input-group">
        <label>Title (optional)</label>
        <input type="text" bind:value={title} placeholder="My Schedule" />
      </div>

      <div class="input-group">
        <label>Embed URL</label>
        <input 
          type="text" 
          bind:value={embedUrl} 
          placeholder={calendarTypes.find(t => t.value === calendarType)?.placeholder}
        />
        <span class="input-hint">
          {#if calendarType === 'google'}
            Go to Google Calendar → Settings → Calendar settings → Integrate calendar → Copy "Embed code" URL
          {:else if calendarType === 'outlook'}
            Go to Outlook Calendar → Settings → Shared calendars → Publish a calendar → Copy the ICS link
          {:else}
            Paste any calendar embed URL or iframe src
          {/if}
        </span>
      </div>

      {#if parsedEmbedUrl}
        <div class="preview-section">
          <label>Preview</label>
          <div class="calendar-preview">
            <iframe 
              src={parsedEmbedUrl}
              title={title || 'Calendar preview'}
              frameborder="0"
            ></iframe>
          </div>
        </div>
      {/if}

      <div class="editor-actions">
        <button class="cancel-btn" on:click={cancelEdit}>Cancel</button>
        <button class="save-btn" on:click={saveCalendar}>Save</button>
      </div>
    </div>
  {:else if parsedEmbedUrl}
    <div class="calendar-content">
      {#if title}
        <div class="calendar-title">{title}</div>
      {/if}
      <div class="calendar-frame">
        <iframe 
          src={parsedEmbedUrl}
          title={title || 'Calendar'}
          frameborder="0"
        ></iframe>
      </div>
      {#if editable && isOwnProfile}
        <div class="edit-controls">
          <button class="edit-btn" on:click={startEditing} title="Edit Calendar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="calendar-placeholder" on:click={startEditing} on:keydown={(e) => e.key === 'Enter' && startEditing()} role="button" tabindex="0">
      <div class="placeholder-icon">📅</div>
      <div class="placeholder-text">
        {#if editable && isOwnProfile}
          Click to add a calendar
        {:else}
          No calendar added
        {/if}
      </div>
      <div class="placeholder-hint">Google Calendar, Outlook, or custom</div>
    </div>
  {/if}
</div>

<style>
  .calendar-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .calendar-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 24px;
    transition: all 0.2s ease;
    min-height: 150px;
  }

  .calendar-placeholder:hover {
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.05);
  }

  .placeholder-icon {
    font-size: 32px;
    opacity: 0.6;
  }

  .placeholder-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }

  .placeholder-hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .calendar-editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .editor-header h4 {
    margin: 0;
    font-size: 16px;
    color: #fff;
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
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .calendar-type-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .type-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .type-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .type-btn.active {
    background: rgba(99, 179, 237, 0.2);
    border-color: #63b3ed;
    color: #63b3ed;
  }

  .type-icon {
    font-size: 14px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .input-group input {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-size: 13px;
  }

  .input-group input:focus {
    outline: none;
    border-color: #63b3ed;
  }

  .input-group input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .input-hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.4;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-section label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .calendar-preview {
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
    height: 200px;
    width: 100%;
  }

  .calendar-preview iframe {
    width: 100%;
    height: 100%;
  }

  .editor-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .cancel-btn,
  .save-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
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
  }

  .save-btn {
    background: #3182ce;
    border: none;
    color: #fff;
  }

  .save-btn:hover {
    background: #2c5282;
  }

  .calendar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
  }

  .calendar-title {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    padding: 0 4px;
  }

  .calendar-frame {
    flex: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
    min-height: 200px;
    width: 100%;
  }

  .calendar-frame iframe {
    width: 100%;
    height: 100%;
    min-height: 200px;
  }

  /* Edit Controls - Dark UI in top right */
  .edit-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .edit-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .edit-btn:hover {
    background: rgba(0, 0, 0, 0.7);
  }
</style>
