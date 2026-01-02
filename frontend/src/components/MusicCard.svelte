<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { loadProfile, updateMusicCard, type MusicCardData } from '../lib/profileStorage';
  import { musicStore, type Playlist, type Track } from '../lib/musicStore';

  export let editable: boolean = false;
  export let autoplay: boolean = false;
  export let profileMusicData: MusicCardData | null = null;
  export let isOwnProfile: boolean = true;

  const dispatch = createEventDispatcher<{
    update: { playlist: Playlist };
  }>();

  let playlist: Playlist = {
    name: 'My Playlist',
    coverImage: null,
    tracks: []
  };

  let hasAutoPlayed = false;

  onMount(() => {
    loadPlaylistData();
  });

  $: if (profileMusicData !== undefined) {
    loadPlaylistData();
  }

  function loadPlaylistData() {
    if (!isOwnProfile && profileMusicData) {
      playlist = {
        name: profileMusicData.name,
        coverImage: profileMusicData.coverImage,
        tracks: profileMusicData.tracks as Track[]
      };
      
      if (autoplay && playlist.tracks.length > 0 && !hasAutoPlayed) {
        hasAutoPlayed = true;
        setTimeout(() => {
          musicStore.setPlaylist(playlist);
          musicStore.play();
        }, 500);
      }
    } else if (isOwnProfile) {
      const profile = loadProfile();
      if (profile.musicCard) {
        playlist = {
          name: profile.musicCard.name,
          coverImage: profile.musicCard.coverImage,
          tracks: profile.musicCard.tracks as Track[]
        };
      }
    }
  }

  function savePlaylist() {
    if (!isOwnProfile) return;
    updateMusicCard({
      name: playlist.name,
      coverImage: playlist.coverImage,
      tracks: playlist.tracks
    });
    dispatch('update', { playlist });
  }

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

  $: currentTrack = playlist.tracks[currentTrackIndex] || null;
  $: coverDisplay = playlist.coverImage || 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452';
  $: volume = globalState.volume;
  $: isMuted = globalState.isMuted;

  // Parse track title to get song name and artist
  $: parsedTitle = parseTrackTitle(currentTrack?.title || playlist.name);

  function parseTrackTitle(title: string): { song: string; artist: string } {
    // Common patterns: "Artist - Song", "Song by Artist", "Song | Artist"
    const separators = [' - ', ' – ', ' | ', ' by '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2) {
          return { artist: parts[0].trim(), song: parts.slice(1).join(sep).trim() };
        }
      }
    }
    return { song: title, artist: playlist.name };
  }

  function togglePlay() {
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
      savePlaylist();
    }
    
    draggedTrackIndex = null;
    dragOverIndex = null;
  }
</script>

<div class="music-card-modern">
  <!-- Full-bleed Cover Image -->
  <div 
    class="cover-container"
    class:editable
    style="background-image: url({coverDisplay})"
  >
    <!-- Gradient Overlay -->
    <div class="cover-gradient"></div>
    
    <!-- Edit Cover Button (only in edit mode) -->
    {#if editable}
      <button class="edit-cover-btn" on:click={() => coverImageInput?.click()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </button>
      <input type="file" bind:this={coverImageInput} on:change={handleCoverUpload} accept="image/*" class="hidden" />
    {/if}

    <!-- Track Info Overlay -->
    <div class="track-overlay">
      <div class="track-details">
        <h3 class="song-title">{parsedTitle.song}</h3>
        <p class="artist-name">{parsedTitle.artist}</p>
      </div>
      
      <!-- Play Button -->
      <button class="play-btn" on:click={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
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
    </div>
  </div>

  <!-- Mini Player Controls (shown when playing) -->
  {#if isPlaying || showPlaylist}
    <div class="mini-controls">
      <button class="mini-btn" on:click={prevTrack} disabled={currentTrackIndex === 0} aria-label="Previous">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
        </svg>
      </button>
      
      <div class="progress-info">
        <span class="track-num">{currentTrackIndex + 1}/{playlist.tracks.length}</span>
      </div>
      
      <button class="mini-btn" on:click={nextTrack} disabled={currentTrackIndex >= playlist.tracks.length - 1} aria-label="Next">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm2 0V6l6.5 6L8 18zm8-12v12h2V6h-2z"/>
        </svg>
      </button>
      
      <button class="mini-btn playlist-btn" on:click={() => showPlaylist = !showPlaylist} aria-label="Toggle playlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Playlist Panel -->
  {#if showPlaylist}
    <div class="playlist-panel">
      <div class="playlist-header">
        <span class="playlist-title">{playlist.name}</span>
        <span class="track-count">{playlist.tracks.length} tracks</span>
      </div>
      
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
              <span class="playing-indicator">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
              </span>
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
            Add Track
          </button>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Empty State -->
  {#if playlist.tracks.length === 0 && !showPlaylist}
    <button class="empty-state" on:click={() => showPlaylist = true}>
      {#if editable}
        <span>Click to add music</span>
      {:else}
        <span>No tracks yet</span>
      {/if}
    </button>
  {/if}
</div>

<style>
  .music-card-modern {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .hidden {
    display: none;
  }

  /* Cover Container - Full Bleed */
  .cover-container {
    position: relative;
    flex: 1;
    min-height: 180px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  /* Gradient Overlay */
  .cover-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 40%,
      rgba(0, 0, 0, 0.3) 60%,
      rgba(0, 0, 0, 0.8) 100%
    );
    pointer-events: none;
  }

  /* Edit Cover Button */
  .edit-cover-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 5;
  }

  .cover-container.editable:hover .edit-cover-btn {
    opacity: 1;
  }

  .edit-cover-btn:hover {
    transform: scale(1.1);
    background: rgba(0, 0, 0, 0.7);
  }

  /* Track Info Overlay */
  .track-overlay {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 20px;
    gap: 16px;
  }

  .track-details {
    flex: 1;
    min-width: 0;
  }

  .song-title {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .artist-name {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }

  /* Play Button */
  .play-btn {
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .play-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
  }

  .play-btn:active {
    transform: scale(0.95);
  }

  /* Mini Controls */
  .mini-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
  }

  .mini-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .mini-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .mini-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .progress-info {
    padding: 0 12px;
  }

  .track-num {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-variant-numeric: tabular-nums;
  }

  .playlist-btn {
    margin-left: auto;
  }

  /* Playlist Panel */
  .playlist-panel {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    max-height: 250px;
    overflow-y: auto;
  }

  .playlist-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .playlist-title {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .track-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .playlist-tracks {
    display: flex;
    flex-direction: column;
  }

  .playlist-track {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .playlist-track:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .playlist-track.active {
    background: rgba(99, 179, 237, 0.15);
  }

  .playlist-track.drag-over {
    border-top: 2px solid #63b3ed;
  }

  .drag-handle {
    color: rgba(255, 255, 255, 0.3);
    cursor: grab;
    font-size: 10px;
    letter-spacing: -2px;
  }

  .track-number {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    min-width: 20px;
    text-align: center;
  }

  .track-title {
    flex: 1;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Playing Indicator Animation */
  .playing-indicator {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }

  .playing-indicator .bar {
    width: 3px;
    background: #63b3ed;
    border-radius: 1px;
    animation: equalizer 0.8s ease-in-out infinite;
  }

  .playing-indicator .bar:nth-child(1) {
    height: 60%;
    animation-delay: 0s;
  }

  .playing-indicator .bar:nth-child(2) {
    height: 100%;
    animation-delay: 0.2s;
  }

  .playing-indicator .bar:nth-child(3) {
    height: 40%;
    animation-delay: 0.4s;
  }

  @keyframes equalizer {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }

  .remove-track {
    width: 22px;
    height: 22px;
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
    padding: 12px;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-track-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .add-track-form {
    display: flex;
    gap: 6px;
    padding: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .add-track-form input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 12px;
  }

  .add-track-form input:focus {
    outline: none;
    border-color: #63b3ed;
  }

  .add-track-form input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .add-btn {
    padding: 8px 16px;
    background: #3182ce;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .add-btn:hover {
    background: #2c5282;
  }

  .cancel-btn {
    width: 34px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  /* Empty State */
  .empty-state {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    border: 1px dashed rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 3;
  }

  .empty-state:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.5);
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
