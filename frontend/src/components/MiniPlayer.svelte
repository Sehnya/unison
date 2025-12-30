<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { musicStore, currentTrack, hasPlaylist } from '../lib/musicStore';

  let ytPlayer: any = null;
  let playerContainer: HTMLElement;
  let showFullPlayer = false;
  let progressPercent = 0;
  let currentTime = 0;
  let duration = 0;
  let progressInterval: number;
  let isUpdatingFromPlayer = false; // Flag to prevent reactive loops

  $: track = $currentTrack;
  $: isPlaying = $musicStore.isPlaying;
  $: volume = $musicStore.volume;
  $: isMuted = $musicStore.isMuted;
  $: playlist = $musicStore.playlist;
  $: currentIndex = $musicStore.currentTrackIndex;
  $: effectiveVolume = isMuted ? 0 : volume;
  $: coverImage = playlist?.coverImage || 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452';

  onMount(() => {
    initYouTubeAPI();
  });

  onDestroy(() => {
    // Cleanup timeouts
    if (syncTimeout) clearTimeout(syncTimeout);
    
    // Only pause, don't destroy - player should persist across navigation
    // The player will be reused if component is recreated
    if (ytPlayer && ytPlayer.pauseVideo) {
      try {
        // Pause but don't destroy to maintain state
        ytPlayer.pauseVideo();
      } catch (e) {
        console.warn('Error pausing player on destroy:', e);
      }
    }
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    // Note: We don't destroy the player here because:
    // 1. The component should persist as long as there's a playlist
    // 2. If the component is recreated, we want to reuse the player if possible
    // 3. Only destroy when the playlist is actually cleared
  });

  function initYouTubeAPI() {
    const win = window as any;
    if (!win.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      win.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready');
        musicStore.setPlayerReady(true);
        if (track && playerContainer) {
          createPlayer();
        }
      };
    } else if (win.YT?.Player) {
      console.log('YouTube API already loaded');
      musicStore.setPlayerReady(true);
      if (track && playerContainer) {
        createPlayer();
      }
    }
  }

  function createPlayer() {
    if (!track || !playerContainer) {
      console.warn('Cannot create player: track or container missing', { track, playerContainer });
      return;
    }
    
    const win = window as any;
    if (!win.YT?.Player) {
      console.warn('YouTube Player API not available');
      return;
    }
    
    // Try to reuse existing player first
    if (ytPlayer && ytPlayer.loadVideoById) {
      try {
        const currentVideoId = ytPlayer.getVideoData?.()?.video_id;
        if (currentVideoId !== track.videoId) {
          console.log('Reusing existing player, loading new video:', track.videoId);
          ytPlayer.loadVideoById(track.videoId);
          if (isPlaying) {
            setTimeout(() => {
              if (ytPlayer) ytPlayer.playVideo();
            }, 100);
          }
        }
        return; // Reused player, don't create new one
      } catch (e) {
        console.warn('Error reusing player, will create new one:', e);
        // Fall through to create new player
      }
    }
    
    // Only destroy if we need to create a new player
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
        ytPlayer = null;
      } catch (e) {
        console.warn('Error destroying previous player:', e);
      }
    }
    
    try {
      console.log('Creating new YouTube player for video:', track.videoId);
      ytPlayer = new win.YT.Player(playerContainer, {
        height: '1',
        width: '1',
        videoId: track.videoId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      });
    } catch (error) {
      console.error('Error creating YouTube player:', error);
    }
  }

  function onPlayerReady(event: any) {
    musicStore.setPlayerReady(true);
    try {
      // Set initial volume (YouTube API expects 0-100)
      const youtubeVolume = Math.max(0, Math.min(100, effectiveVolume));
      ytPlayer.setVolume(youtubeVolume);
      if (isMuted) {
        ytPlayer.mute();
      } else {
        ytPlayer.unMute();
      }
    } catch (error) {
      console.warn('Error setting initial volume:', error);
    }
    if (isPlaying) {
      ytPlayer.playVideo();
    }
    startProgressTracking();
  }

  function onPlayerStateChange(event: any) {
    // Prevent reactive loop by setting flag
    isUpdatingFromPlayer = true;
    
    if (event.data === 0) {
      // Video ended
      musicStore.nextTrack();
    } else if (event.data === 1) {
      // Playing
      if (!isPlaying) {
        musicStore.play();
      }
      duration = ytPlayer.getDuration();
    } else if (event.data === 2) {
      // Paused
      if (isPlaying) {
        musicStore.pause();
      }
    } else if (event.data === 3) {
      // Buffering - keep current state
    } else if (event.data === 5) {
      // Video cued - keep current state
    }
    
    // Reset flag after a short delay to allow reactive statements to run
    setTimeout(() => {
      isUpdatingFromPlayer = false;
    }, 100);
  }

  function onPlayerError(event: any) {
    console.error('YouTube player error:', event.data);
    musicStore.nextTrack();
  }

  function startProgressTracking() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
        currentTime = ytPlayer.getCurrentTime() || 0;
        duration = ytPlayer.getDuration() || 0;
        progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
      }
    }, 500) as unknown as number;
  }

  // React to track changes
  $: if (track && ytPlayer && $musicStore.playerReady) {
    try {
      console.log('Loading new track:', track.videoId);
      const currentVideoId = ytPlayer.getVideoData?.()?.video_id;
      // Only load if it's a different video
      if (currentVideoId !== track.videoId) {
        ytPlayer.loadVideoById(track.videoId);
        // Small delay to ensure video is loaded before playing
        setTimeout(() => {
          if (isPlaying && ytPlayer) {
            ytPlayer.playVideo();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading track:', error);
      // Try to recreate player
      if (playerContainer) {
        createPlayer();
      }
    }
  }
  
  // If track changes but player doesn't exist yet, create it
  $: if (track && !ytPlayer && playerContainer && $musicStore.playerReady) {
    const win = window as any;
    if (win.YT?.Player) {
      createPlayer();
    }
  }

  // React to play/pause changes (only if not updating from player)
  // Use a small delay to avoid conflicts with player state changes
  let syncTimeout: ReturnType<typeof setTimeout> | null = null;
  $: if (ytPlayer && $musicStore.playerReady && !isUpdatingFromPlayer) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      if (isUpdatingFromPlayer) return;
      try {
        const playerState = ytPlayer.getPlayerState?.();
        // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
        if (isPlaying && playerState !== 1 && playerState !== 3 && playerState !== -1) {
          // Store says playing but player is not - sync player (ignore buffering and unstarted states)
          ytPlayer.playVideo();
        } else if (!isPlaying && playerState === 1) {
          // Store says paused but player is playing - sync player
          ytPlayer.pauseVideo();
        }
      } catch (error) {
        console.warn('Error syncing play/pause state:', error);
      }
    }, 100);
  }
  
  // Cleanup timeout on destroy
  onDestroy(() => {
    if (syncTimeout) clearTimeout(syncTimeout);
  });

  // React to volume changes
  $: if (ytPlayer && $musicStore.playerReady) {
    try {
      if (isMuted) {
        ytPlayer.mute();
      } else {
        ytPlayer.unMute();
        // YouTube API expects volume 0-100
        const youtubeVolume = Math.max(0, Math.min(100, volume));
        ytPlayer.setVolume(youtubeVolume);
      }
    } catch (error) {
      console.warn('Error setting volume:', error);
    }
  }

  // Create player when track becomes available and container is ready
  $: if (track && playerContainer && $musicStore.playerReady && !ytPlayer) {
    const win = window as any;
    if (win.YT?.Player) {
      createPlayer();
    }
  }
  
  // Also try to create player when container becomes available
  $: if (playerContainer && track && $musicStore.playerReady && !ytPlayer) {
    const win = window as any;
    if (win.YT?.Player) {
      createPlayer();
    }
  }

  function togglePlay() {
    if (!ytPlayer) {
      // If player not ready, just toggle store state
      musicStore.togglePlay();
      return;
    }
    
    try {
      const playerState = ytPlayer.getPlayerState?.();
      // YouTube player states: 1 = playing, 2 = paused, -1 = unstarted, 0 = ended
      if (playerState === 1) {
        // Currently playing, pause it
        isUpdatingFromPlayer = true;
        ytPlayer.pauseVideo();
        musicStore.pause();
        setTimeout(() => { isUpdatingFromPlayer = false; }, 200);
      } else {
        // Currently paused or stopped, play it
        isUpdatingFromPlayer = true;
        ytPlayer.playVideo();
        musicStore.play();
        setTimeout(() => { isUpdatingFromPlayer = false; }, 200);
      }
    } catch (error) {
      console.warn('Error toggling play:', error);
      // Fallback to store toggle
      musicStore.togglePlay();
    }
  }

  function handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    musicStore.setVolume(parseInt(target.value));
  }

  function handleProgressClick(e: MouseEvent) {
    if (!ytPlayer || !duration) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    ytPlayer.seekTo(percent * duration, true);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

{#if $hasPlaylist}
  <!-- Mini bar at bottom -->
  <div class="mini-player" class:expanded={showFullPlayer}>
    <div class="progress-bar" on:click={handleProgressClick} role="slider" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} tabindex="0">
      <div class="progress-fill" style="width: {progressPercent}%"></div>
    </div>
    
    <div class="mini-content">
      <div class="track-info" on:click={() => showFullPlayer = !showFullPlayer} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && (showFullPlayer = !showFullPlayer)}>
        <img src={coverImage} alt="Album art" class="mini-cover" />
        <div class="track-details">
          <span class="track-title">{track?.title || 'No track'}</span>
          <span class="playlist-name">{playlist?.name || 'Playlist'}</span>
        </div>
      </div>

      <div class="controls">
        <button class="control-btn" on:click={() => musicStore.prevTrack()} disabled={currentIndex === 0}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
          </svg>
        </button>
        
        <button class="control-btn play" on:click={togglePlay}>
          {#if isPlaying}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          {:else}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z"/>
            </svg>
          {/if}
        </button>
        
        <button class="control-btn" on:click={() => musicStore.nextTrack()} disabled={!playlist || currentIndex >= playlist.tracks.length - 1}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm2 0V6l6.5 6L8 18zm8-12v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <div class="volume-section">
        <button class="volume-btn" on:click={() => musicStore.toggleMute()}>
          {#if isMuted || volume === 0}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
          {/if}
        </button>
        <input type="range" min="0" max="100" value={isMuted ? 0 : volume} on:input={handleVolumeChange} class="volume-slider" />
      </div>

      <button class="expand-btn" on:click={() => showFullPlayer = !showFullPlayer}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if showFullPlayer}
            <path d="M18 15l-6-6-6 6"/>
          {:else}
            <path d="M6 9l6 6 6-6"/>
          {/if}
        </svg>
      </button>
    </div>
  </div>

  <!-- Full screen player overlay -->
  {#if showFullPlayer}
    <div class="full-player-overlay" on:click={() => showFullPlayer = false} on:keydown={(e) => e.key === 'Escape' && (showFullPlayer = false)} role="dialog" aria-modal="true" tabindex="-1">
      <div class="full-player" on:click|stopPropagation role="dialog">
        <button class="close-btn" on:click={() => showFullPlayer = false}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>

        <div class="full-cover">
          <img src={coverImage} alt="Album art" />
        </div>

        <div class="full-info">
          <h2 class="full-title">{track?.title || 'No track'}</h2>
          <p class="full-playlist">{playlist?.name || 'Playlist'}</p>
        </div>

        <div class="full-progress">
          <div class="progress-track" on:click={handleProgressClick} role="slider" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} tabindex="0">
            <div class="progress-fill" style="width: {progressPercent}%"></div>
          </div>
          <div class="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div class="full-controls">
          <button class="full-control-btn" on:click={() => musicStore.prevTrack()} disabled={currentIndex === 0}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
            </svg>
          </button>
          
          <button class="full-control-btn play" on:click={togglePlay}>
            {#if isPlaying}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            {:else}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z"/>
              </svg>
            {/if}
          </button>
          
          <button class="full-control-btn" on:click={() => musicStore.nextTrack()} disabled={!playlist || currentIndex >= playlist.tracks.length - 1}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2 0V6l6.5 6L8 18zm8-12v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        <div class="full-volume">
          <button class="volume-btn" on:click={() => musicStore.toggleMute()}>
            {#if isMuted || volume === 0}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
            {/if}
          </button>
          <input type="range" min="0" max="100" value={isMuted ? 0 : volume} on:input={handleVolumeChange} class="volume-slider-full" />
        </div>

        <!-- Playlist -->
        <div class="full-playlist-section">
          <h3>Up Next</h3>
          <div class="playlist-tracks">
            {#each playlist?.tracks || [] as t, i (t.id)}
              <button 
                class="playlist-track" 
                class:active={i === currentIndex}
                on:click={() => musicStore.playTrack(i)}
              >
                <span class="track-num">{i + 1}</span>
                <span class="track-name">{t.title}</span>
                {#if i === currentIndex && isPlaying}
                  <span class="playing-icon">▶</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Hidden YouTube player -->
  <div bind:this={playerContainer} class="youtube-player"></div>
{/if}

<style>
  .mini-player {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 72px;
    background: rgba(15, 15, 20, 0.98);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 9999;
    backdrop-filter: blur(20px);
  }

  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
  }

  .progress-bar:hover {
    height: 5px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3182ce, #63b3ed);
    transition: width 0.1s linear;
  }

  .mini-content {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 20px;
    gap: 20px;
  }

  .track-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  .mini-cover {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: cover;
  }

  .track-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .track-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .control-btn:hover:not(:disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn.play {
    width: 48px;
    height: 48px;
    background: #fff;
    color: #1a1a1a;
  }

  .control-btn.play:hover {
    transform: scale(1.05);
    background: #fff;
  }

  .volume-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .volume-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .volume-btn:hover {
    color: #fff;
  }

  .volume-slider {
    width: 100px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  .expand-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  /* Full player overlay */
  .full-player-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .full-player {
    width: 100%;
    max-width: 480px;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 0;
    right: 0;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .full-cover {
    width: 280px;
    height: 280px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    margin-bottom: 32px;
  }

  .full-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .full-info {
    text-align: center;
    margin-bottom: 24px;
  }

  .full-title {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px;
  }

  .full-playlist {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .full-progress {
    width: 100%;
    margin-bottom: 24px;
  }

  .progress-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    cursor: pointer;
    margin-bottom: 8px;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .full-controls {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 24px;
  }

  .full-control-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .full-control-btn:hover:not(:disabled) {
    color: #fff;
    transform: scale(1.1);
  }

  .full-control-btn:disabled {
    opacity: 0.3;
  }

  .full-control-btn.play {
    width: 72px;
    height: 72px;
    background: #fff;
    color: #1a1a1a;
  }

  .full-volume {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 200px;
    margin-bottom: 32px;
  }

  .volume-slider-full {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
  }

  .volume-slider-full::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  .full-playlist-section {
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
  }

  .full-playlist-section h3 {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 12px;
  }

  .playlist-tracks {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .playlist-track {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .playlist-track:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .playlist-track.active {
    background: rgba(49, 130, 206, 0.2);
    color: #fff;
  }

  .track-num {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    min-width: 20px;
  }

  .track-name {
    flex: 1;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playing-icon {
    color: #3182ce;
    font-size: 10px;
  }

  .youtube-player {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  /* Scrollbar */
  .full-playlist-section::-webkit-scrollbar {
    width: 4px;
  }

  .full-playlist-section::-webkit-scrollbar-track {
    background: transparent;
  }

  .full-playlist-section::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>
