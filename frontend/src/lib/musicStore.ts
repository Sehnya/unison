import { writable, derived, get } from 'svelte/store';

export interface Track {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
}

export interface Playlist {
  name: string;
  coverImage: string | null;
  tracks: Track[];
}

export interface MusicState {
  playlist: Playlist | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  playerReady: boolean;
  sourceUserId: string | null; // Track whose profile the music came from
}

const initialState: MusicState = {
  playlist: null,
  currentTrackIndex: 0,
  isPlaying: false,
  volume: 50,
  isMuted: false,
  playerReady: false,
  sourceUserId: null,
};

function createMusicStore() {
  const { subscribe, set, update } = writable<MusicState>(initialState);

  return {
    subscribe,
    
    setPlaylist: (playlist: Playlist, sourceUserId?: string) => {
      update(state => ({
        ...state,
        playlist,
        currentTrackIndex: 0,
        sourceUserId: sourceUserId || null,
      }));
    },

    play: () => {
      update(state => ({ ...state, isPlaying: true }));
    },

    pause: () => {
      update(state => ({ ...state, isPlaying: false }));
    },

    togglePlay: () => {
      update(state => ({ ...state, isPlaying: !state.isPlaying }));
    },

    nextTrack: () => {
      update(state => {
        if (!state.playlist) return state;
        const nextIndex = state.currentTrackIndex + 1;
        if (nextIndex < state.playlist.tracks.length) {
          return { ...state, currentTrackIndex: nextIndex, isPlaying: true };
        }
        return { ...state, isPlaying: false };
      });
    },

    prevTrack: () => {
      update(state => {
        if (state.currentTrackIndex > 0) {
          return { ...state, currentTrackIndex: state.currentTrackIndex - 1, isPlaying: true };
        }
        return state;
      });
    },

    playTrack: (index: number) => {
      update(state => ({
        ...state,
        currentTrackIndex: index,
        isPlaying: true,
      }));
    },

    setVolume: (volume: number) => {
      update(state => ({
        ...state,
        volume,
        isMuted: volume === 0,
      }));
    },

    toggleMute: () => {
      update(state => ({ ...state, isMuted: !state.isMuted }));
    },

    setPlayerReady: (ready: boolean) => {
      update(state => ({ ...state, playerReady: ready }));
    },

    clear: () => {
      set(initialState);
    },

    getState: () => get({ subscribe }),
  };
}

export const musicStore = createMusicStore();

// Derived stores for convenience
export const currentTrack = derived(musicStore, $state => 
  $state.playlist?.tracks[$state.currentTrackIndex] || null
);

export const hasPlaylist = derived(musicStore, $state => 
  $state.playlist !== null && $state.playlist.tracks.length > 0
);
