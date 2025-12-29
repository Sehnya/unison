<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { loadProfile, updateMusicCard, type MusicCardData } from '../lib/profileStorage';
  import { musicStore, type Playlist, type Track } from '../lib/musicStore';

  export let editable: boolean = false;
  export let autoplay: boolean = false; // Don't autoplay in card, let user click

  const dispatch = createEventDispatcher<{
    update: { playlist: Playlist };
  }>();

  let playlist: Playlist = {
    name: 'My Playlist',
    coverImage: null,
    tracks: []
  };

  // Load saved data on mount
  onMount(() => {
    const profile = loadProfile();
    if (profile.musicCard) {
      playlist = {
        name: profile.musicCard.name,
        coverImage: profile.musicCard.coverImage,
        tracks: profile.musicCard.tracks as Track[]
      };
    }
  });

  function savePlaylist() {
    updateMusicCard({
      name: playlist.name,
      coverImage: playlist.coverImage,
      tracks: playlist.tracks
    });
    dispatch('update', { playlist });
  }

  // Subscribe to global music store to show current state
  $: globalState = $musicStore;
  $: isGlobalPlaylist = globalState.playlist?.name === playlist.name && 
                        globalState.playlist?.tracks.length === playlist.tracks.length;
  $: currentTrackIndex = isGlobalPlaylist ? globalState.currentTrackIndex : 0;
  $: isPlaying = isGlobalPlaylist ? globalState.isPlaying : false;

  let showPlaylist = false;
  let showAddTrack = false;
  let newYoutubeUrl = '';
  let coverImageInput: HTMLInputElement;
  let draggedTrackIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let editingPlaylistName = false;
  let playlistNameInput: HTMLInputElement;
  let showVolumeSlider = false;

  $: currentTrack = playlist.tracks[currentTrackIndex] || null;
  $: coverDisplay = playlist.coverImage || 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452';
  $: volume = globalState.volume;
  $: isMuted = globalState.isMuted;

  function toggleMute() {
    musicStore.toggleMute();
  }

  function handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    musicStore.setVolume(parseInt(target.value));
  }

  function togglePlay() {
    // If this playlist isn't loaded globally, load it first
    if (!isGlobalPlaylist) {
      musicStore.setPlaylist(playlist);
      musicStore.play();
    } else {
      musicStore.togglePlay();
    }
  }

  function nextTrack() {
    if (!isGlobalPlaylist) {
      musicStore.setPlaylist(playlist);
    }
    musicStore.nextTrack();
  }

  function prevTrack() {
    if (!isGlobalPlaylist) {
      musicStore.setPlaylist(playlist);
    }
    musicStore.prevTrack();
  }

  function extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async function addTrack() {
    if (!newYoutubeUrl.trim()) return;
    
    const videoId = extractVideoId(newYoutubeUrl);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }

    // Try to get video title from oEmbed (no API key needed)
    let title = 'Unknown Track';
    try {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(newYoutubeUrl)}`);
      const data = await response.json();
      if (data.title) title = data.title;
    } catch (e) {
      console.warn('Could not fetch video title');
    }

    const newTrack: Track = {
      id: `track-${Date.now()}`,
      youtubeUrl: newYoutubeUrl,
      videoId,
      title
    };

    playlist.tracks = [...playlist.tracks, newTrack];
    playlist = playlist;
    newYoutubeUrl = '';
    showAddTrack = false;
    savePlaylist();
  }

  function removeTrack(id: string) {
    const index = playlist.tracks.findIndex(t => t.id === id);
    playlist.tracks = playlist.tracks.filter(t => t.id !== id);
    playlist = playlist;
    
    if (index <= currentTrackIndex && currentTrackIndex > 0) {
      currentTrackIndex--;
    }
    savePlaylist();
  }

  function playTrack(index: number) {
    if (!isGlobalPlaylist) {
      musicStore.setPlaylist(playlist);
    }
    musicStore.playTrack(index);
  }

  function handleCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      playlist.coverImage = event.target?.result as string;
      playlist = playlist;
      savePlaylist();
    };
    reader.readAsDataURL(file);
  }

  function removeCover() {
    playlist.coverImage = null;
    playlist = playlist;
    savePlaylist();
  }

  // Drag and drop for reordering
  function handleDragStart(e: DragEvent, index: number) {
    if (!editable) return;
    draggedTrackIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (!editable || draggedTrackIndex === null) return;
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDragEnd() {
    draggedTrackIndex = null;
    dragOverIndex = null;
  }

  function handleDrop(e: DragEvent, targetIndex: number) {
    if (!editable || draggedTrackIndex === null) return;
    e.preventDefault();

    if (draggedTrackIndex !== targetIndex) {
      const newTracks = [...playlist.tracks];
      const [removed] = newTracks.splice(draggedTrackIndex, 1);
      newTracks.splice(targetIndex, 0, removed);
      playlist.tracks = newTracks;
      playlist = playlist;
      
      // Update current track index if needed
      if (draggedTrackIndex === currentTrackIndex) {
        currentTrackIndex = targetIndex;
      } else if (draggedTrackIndex < currentTrackIndex && targetIndex >= currentTrackIndex) {
        currentTrackIndex--;
      } else if (draggedTrackIndex > currentTrackIndex && targetIndex <= currentTrackIndex) {
        currentTrackIndex++;
      }
      
      savePlaylist();
    }
    
    draggedTrackIndex = null;
    dragOverIndex = null;
  }

  function startEditingName() {
    if (!editable) return;
    editingPlaylistName = true;
    setTimeout(() => playlistNameInput?.focus(), 0);
  }

  function finishEditingName() {
    editingPlaylistName = false;
    if (!playlist.name.trim()) {
      playlist.name = 'My Playlist';
    }
    savePlaylist();
  }
</script>

<div class="music-card-content">
  <!-- Cover Image -->
  <div class="cover-section">
    <div class="album-art" on:click={() => editable && coverImageInput?.click()} class:editable role={editable ? 'button' : undefined}>
      <img src={coverDisplay} alt="Playlist cover" />
      {#if editable}
        <div class="cover-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span>Change Cover</span>
        </div>
      {/if}
    </div>
    {#if editable && playlist.coverImage}
      <button class="remove-cover" on:click={removeCover}>×</button>
    {/if}
    <input type="file" bind:this={coverImageInput} on:change={handleCoverUpload} accept="image/*" class="hidden" />
  </div>

  <!-- Track Info -->
  <div class="track-info">
    {#if editingPlaylistName}
      <input
        type="text"
        bind:this={playlistNameInput}
        bind:value={playlist.name}
        on:blur={finishEditingName}
        on:keydown={(e) => e.key === 'Enter' && finishEditingName()}
        class="playlist-name-input"
        maxlength="30"
      />
    {:else}
      <span 
        class="playlist-name" 
        class:editable
        on:click={startEditingName}
        on:keydown={(e) => e.key === 'Enter' && startEditingName()}
        role={editable ? 'button' : undefined}
        tabindex={editable ? 0 : undefined}
      >
        {playlist.name}
        {#if editable}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        {/if}
      </span>
    {/if}
    <span class="track-name">{currentTrack?.title || 'No track selected'}</span>
    <span class="track-count">{playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}</span>
  </div>

  <!-- Player Controls -->
  <div class="player-controls">
    <button class="control-btn" on:click={prevTrack} disabled={currentTrackIndex === 0}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
      </svg>
    </button>
    <button class="control-btn play" on:click={togglePlay}>
      {#if isPlaying}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
        </svg>
      {:else}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7L8 5z"/>
        </svg>
      {/if}
    </button>
    <button class="control-btn" on:click={nextTrack} disabled={currentTrackIndex >= playlist.tracks.length - 1}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zm2 0V6l6.5 6L8 18zm8-12v12h2V6h-2z"/>
      </svg>
    </button>
  </div>

  <!-- Volume Control -->
  <div class="volume-control" on:mouseenter={() => showVolumeSlider = true} on:mouseleave={() => showVolumeSlider = false}>
    <button class="volume-btn" on:click={toggleMute}>
      {#if isMuted || volume === 0}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      {:else if volume < 50}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <path d="M15.54 8.46a5 5 0 010 7.07"/>
        </svg>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <path d="M15.54 8.46a5 5 0 010 7.07"/>
          <path d="M19.07 4.93a10 10 0 010 14.14"/>
        </svg>
      {/if}
    </button>
    {#if showVolumeSlider}
      <div class="volume-slider-container">
        <input
          type="range"
          min="0"
          max="100"
          value={isMuted ? 0 : volume}
          on:input={handleVolumeChange}
          class="volume-slider"
        />
        <span class="volume-value">{isMuted ? 0 : volume}%</span>
      </div>
    {/if}
  </div>

  <!-- Playlist Toggle -->
  <button class="playlist-toggle" on:click={() => showPlaylist = !showPlaylist}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
    {showPlaylist ? 'Hide' : 'Show'} Playlist
  </button>

  <!-- Playlist Panel -->
  {#if showPlaylist}
    <div class="playlist-panel">
      <div class="playlist-tracks">
        {#each playlist.tracks as track, index (track.id)}
          <div
            class="playlist-track"
            class:active={index === currentTrackIndex}
            class:drag-over={dragOverIndex === index}
            draggable={editable}
            on:dragstart={(e) => handleDragStart(e, index)}
            on:dragover={(e) => handleDragOver(e, index)}
            on:dragleave={() => dragOverIndex = null}
            on:dragend={handleDragEnd}
            on:drop={(e) => handleDrop(e, index)}
            on:click={() => playTrack(index)}
            on:keydown={(e) => e.key === 'Enter' && playTrack(index)}
            role="button"
            tabindex="0"
          >
            {#if editable}
              <span class="drag-handle">⋮⋮</span>
            {/if}
            <span class="track-number">{index + 1}</span>
            <span class="track-title">{track.title}</span>
            {#if index === currentTrackIndex && isPlaying}
              <span class="playing-indicator">▶</span>
            {/if}
            {#if editable}
              <button class="remove-track" on:click|stopPropagation={() => removeTrack(track.id)}>×</button>
            {/if}
          </div>
        {/each}
      </div>

      {#if editable}
        {#if showAddTrack}
          <div class="add-track-form">
            <input
              type="text"
              bind:value={newYoutubeUrl}
              placeholder="Paste YouTube URL..."
              on:keydown={(e) => e.key === 'Enter' && addTrack()}
            />
            <button class="add-btn" on:click={addTrack}>Add</button>
            <button class="cancel-btn" on:click={() => { showAddTrack = false; newYoutubeUrl = ''; }}>×</button>
          </div>
        {:else}
          <button class="add-track-btn" on:click={() => showAddTrack = true}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add YouTube Track
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</div>


<style>
  .music-card-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 8px;
  }

  .hidden {
    display: none;
  }

  /* Cover Section */
  .cover-section {
    position: relative;
    margin-bottom: 12px;
  }

  .album-art {
    width: 120px;
    height: 120px;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }

  .album-art.editable {
    cursor: pointer;
  }

  .album-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
    color: #fff;
    font-size: 11px;
  }

  .album-art.editable:hover .cover-overlay {
    opacity: 1;
  }

  .remove-cover {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: #ef4444;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Track Info */
  .track-info {
    text-align: center;
    margin-bottom: 12px;
    width: 100%;
  }

  .playlist-name {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .playlist-name.editable {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .playlist-name.editable:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .playlist-name svg {
    opacity: 0;
  }

  .playlist-name.editable:hover svg {
    opacity: 0.7;
  }

  .playlist-name-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #3182ce;
    border-radius: 4px;
    color: #fff;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 8px;
    text-align: center;
    width: 150px;
  }

  .track-name {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
    margin: 0 auto;
  }

  .track-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Player Controls */
  .player-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .control-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 8px;
    transition: color 0.15s ease;
  }

  .control-btn:hover:not(:disabled) {
    color: #fff;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn.play {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #fff;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn.play:hover {
    transform: scale(1.05);
  }

  /* Volume Control */
  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    margin-bottom: 8px;
  }

  .volume-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .volume-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .volume-slider-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    position: absolute;
    left: 44px;
    white-space: nowrap;
    z-index: 10;
  }

  .volume-slider {
    width: 80px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .volume-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    border: none;
  }

  .volume-value {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    min-width: 32px;
    text-align: right;
  }

  /* Playlist Toggle */
  .playlist-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .playlist-toggle:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  /* Playlist Panel */
  .playlist-panel {
    width: 100%;
    margin-top: 12px;
    max-height: 200px;
    overflow-y: auto;
  }

  .playlist-tracks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .playlist-track {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease;
    position: relative;
  }

  .playlist-track:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .playlist-track.active {
    background: rgba(49, 130, 206, 0.2);
  }

  .playlist-track.drag-over {
    border-top: 2px solid #3182ce;
  }

  .drag-handle {
    color: rgba(255, 255, 255, 0.3);
    cursor: grab;
    font-size: 10px;
    letter-spacing: -2px;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .track-number {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    min-width: 16px;
  }

  .track-title {
    flex: 1;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playing-indicator {
    color: #3182ce;
    font-size: 10px;
  }

  .remove-track {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .playlist-track:hover .remove-track {
    opacity: 1;
  }

  .remove-track:hover {
    background: rgba(239, 68, 68, 0.4);
  }

  /* Add Track */
  .add-track-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px;
    margin-top: 8px;
    background: rgba(49, 130, 206, 0.15);
    border: 1px dashed rgba(49, 130, 206, 0.4);
    border-radius: 8px;
    color: #63b3ed;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-track-btn:hover {
    background: rgba(49, 130, 206, 0.25);
    border-color: rgba(49, 130, 206, 0.6);
  }

  .add-track-form {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .add-track-form input {
    flex: 1;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
  }

  .add-track-form input:focus {
    outline: none;
    border-color: #3182ce;
  }

  .add-track-form input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .add-btn {
    padding: 8px 14px;
    background: #1a365d;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
  }

  .add-btn:hover {
    background: #2c5282;
  }

  .cancel-btn {
    width: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  /* Scrollbar */
  .playlist-panel::-webkit-scrollbar {
    width: 4px;
  }

  .playlist-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .playlist-panel::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>
