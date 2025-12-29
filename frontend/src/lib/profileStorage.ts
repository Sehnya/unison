/**
 * Profile Storage System
 * Persists all user profile data including card positions, content, and settings
 */

// Types for profile data
export interface MiniWidget {
  id: string;
  type: 'date' | 'time' | 'gif';
  gifUrl?: string;
}

export interface ProfileCard {
  id: string;
  type: 'quote' | 'gradient' | 'music' | 'games' | 'github' | 'friends';
  size: 'small' | 'wide';
}

export interface QuoteCardData {
  content: string;
}

export interface GalleryImage {
  id: string;
  src: string;
  name: string;
}

export interface GalleryCardData {
  images: GalleryImage[];
  transition: string;
  filter: string;
  interval: number;
}

export interface PlaylistTrack {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
}

export interface MusicCardData {
  name: string;
  coverImage: string | null;
  tracks: PlaylistTrack[];
}

export interface UserGame {
  id: string;
  rawgId: number;
  slug: string;
  name: string;
  image: string;
  genre: string;
  platform: string;
  rating: number;
  description: string;
}

export interface GitHubProject {
  id: string;
  repoUrl: string;
  repoName: string;
  username: string;
  description: string;
  image: string | null;
}

export interface ProfileData {
  // Layout
  cards: ProfileCard[];
  
  // Header
  greeting: string;
  backgroundImage: string | null;
  miniWidgets: MiniWidget[];
  
  // Card-specific data (keyed by card id for multiple instances)
  quoteCards: Record<string, QuoteCardData>;
  galleryCards: Record<string, GalleryCardData>;
  musicCard: MusicCardData | null;
  gamesCards: Record<string, { games: UserGame[] }>;
  githubCards: Record<string, { projects: GitHubProject[] }>;
  
  // Metadata
  lastUpdated: string;
  version: number;
}

const STORAGE_KEY = 'user_profile_data';
const CURRENT_VERSION = 1;

// Default profile data
function getDefaultProfile(): ProfileData {
  return {
    cards: [
      { id: '1', type: 'quote', size: 'small' },
      { id: '2', type: 'gradient', size: 'small' },
      { id: '3', type: 'music', size: 'small' },
      { id: '4', type: 'games', size: 'small' },
      { id: '5', type: 'github', size: 'small' },
      { id: '6', type: 'friends', size: 'small' },
    ],
    greeting: 'HI,',
    backgroundImage: null,
    miniWidgets: [],
    quoteCards: {
      '1': {
        content: `<h1>BE<br>KIND<br>AND<br>BRIGHT</h1><p><strong>Lorem ipsum</strong> dolor sit amet, consectetur adipiscing elit.</p>`
      }
    },
    galleryCards: {
      '2': {
        images: [],
        transition: 'fade',
        filter: 'none',
        interval: 5
      }
    },
    musicCard: {
      name: 'My Playlist',
      coverImage: null,
      tracks: []
    },
    gamesCards: {
      '4': { games: [] }
    },
    githubCards: {
      '5': { projects: [] }
    },
    lastUpdated: new Date().toISOString(),
    version: CURRENT_VERSION
  };
}

// Load profile from localStorage
export function loadProfile(): ProfileData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultProfile();
    }
    
    const data = JSON.parse(stored) as ProfileData;
    
    // Version migration if needed
    if (!data.version || data.version < CURRENT_VERSION) {
      return migrateProfile(data);
    }
    
    return data;
  } catch (e) {
    console.warn('Failed to load profile, using defaults:', e);
    return getDefaultProfile();
  }
}

// Save profile to localStorage
export function saveProfile(data: ProfileData): void {
  try {
    data.lastUpdated = new Date().toISOString();
    data.version = CURRENT_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save profile:', e);
  }
}

// Migrate old profile data to new version
function migrateProfile(oldData: Partial<ProfileData>): ProfileData {
  const defaultProfile = getDefaultProfile();
  
  // Merge old data with defaults
  return {
    ...defaultProfile,
    ...oldData,
    version: CURRENT_VERSION,
    lastUpdated: new Date().toISOString()
  };
}

// Helper to update specific parts of the profile
export function updateProfileCards(cards: ProfileCard[]): void {
  const profile = loadProfile();
  profile.cards = cards;
  saveProfile(profile);
}

export function updateProfileGreeting(greeting: string): void {
  const profile = loadProfile();
  profile.greeting = greeting;
  saveProfile(profile);
}

export function updateProfileBackground(backgroundImage: string | null): void {
  const profile = loadProfile();
  profile.backgroundImage = backgroundImage;
  saveProfile(profile);
}

export function updateProfileWidgets(widgets: MiniWidget[]): void {
  const profile = loadProfile();
  profile.miniWidgets = widgets;
  saveProfile(profile);
}

export function updateQuoteCard(cardId: string, content: string): void {
  const profile = loadProfile();
  if (!profile.quoteCards) profile.quoteCards = {};
  profile.quoteCards[cardId] = { content };
  saveProfile(profile);
}

export function updateGalleryCard(cardId: string, data: GalleryCardData): void {
  const profile = loadProfile();
  if (!profile.galleryCards) profile.galleryCards = {};
  profile.galleryCards[cardId] = data;
  saveProfile(profile);
}

export function updateMusicCard(data: MusicCardData): void {
  const profile = loadProfile();
  profile.musicCard = data;
  saveProfile(profile);
}

export function updateGamesCard(cardId: string, games: UserGame[]): void {
  const profile = loadProfile();
  if (!profile.gamesCards) profile.gamesCards = {};
  profile.gamesCards[cardId] = { games };
  saveProfile(profile);
}

export function updateGitHubCard(cardId: string, projects: GitHubProject[]): void {
  const profile = loadProfile();
  if (!profile.githubCards) profile.githubCards = {};
  profile.githubCards[cardId] = { projects };
  saveProfile(profile);
}

// Remove card data when card is deleted
export function removeCardData(cardId: string, cardType: string): void {
  const profile = loadProfile();
  
  switch (cardType) {
    case 'quote':
      if (profile.quoteCards) delete profile.quoteCards[cardId];
      break;
    case 'gradient':
      if (profile.galleryCards) delete profile.galleryCards[cardId];
      break;
    case 'games':
      if (profile.gamesCards) delete profile.gamesCards[cardId];
      break;
    case 'github':
      if (profile.githubCards) delete profile.githubCards[cardId];
      break;
  }
  
  saveProfile(profile);
}

// Export profile as JSON (for backup)
export function exportProfile(): string {
  const profile = loadProfile();
  return JSON.stringify(profile, null, 2);
}

// Import profile from JSON
export function importProfile(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString) as ProfileData;
    saveProfile(data);
    return true;
  } catch (e) {
    console.error('Failed to import profile:', e);
    return false;
  }
}

// Clear all profile data
export function clearProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}
