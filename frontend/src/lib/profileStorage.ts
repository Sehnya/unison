/**
 * Profile Storage System
 * Persists user profile data to the server database
 */

import { apiUrl } from './api';

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

const CURRENT_VERSION = 2;
let authToken: string | null = null;
let cachedProfile: ProfileData | null = null;
let cachedBackgroundImage: string | null = null;

// Set auth token for API calls
export function setAuthToken(token: string | null): void {
  authToken = token;
}

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

// Load profile from server
export async function loadProfileFromServer(): Promise<{ profileData: ProfileData; backgroundImage: string | null }> {
  if (!authToken) {
    return { profileData: getDefaultProfile(), backgroundImage: null };
  }

  try {
    const response = await fetch(apiUrl('/api/auth/profile-data'), {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      console.warn('Failed to load profile from server:', response.status);
      return { profileData: getDefaultProfile(), backgroundImage: null };
    }

    const data = await response.json();
    
    if (data.profileData?.profile_data) {
      cachedProfile = data.profileData.profile_data as ProfileData;
      cachedBackgroundImage = data.profileData.background_image || null;
      return { profileData: cachedProfile, backgroundImage: cachedBackgroundImage };
    }
    
    return { profileData: getDefaultProfile(), backgroundImage: null };
  } catch (e) {
    console.warn('Failed to load profile from server:', e);
    return { profileData: getDefaultProfile(), backgroundImage: null };
  }
}

// Load profile (sync version using cache)
export function loadProfile(): ProfileData {
  return cachedProfile || getDefaultProfile();
}

// Get cached background image
export function getBackgroundImage(): string | null {
  return cachedBackgroundImage;
}

// Save profile to server
export async function saveProfileToServer(data: ProfileData, backgroundImage?: string | null): Promise<boolean> {
  if (!authToken) {
    console.warn('No auth token, cannot save profile to server');
    return false;
  }

  try {
    data.lastUpdated = new Date().toISOString();
    data.version = CURRENT_VERSION;
    
    const response = await fetch(apiUrl('/api/auth/profile-data'), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileData: data,
        backgroundImage: backgroundImage !== undefined ? backgroundImage : cachedBackgroundImage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to save profile:', errorData);
      return false;
    }

    cachedProfile = data;
    if (backgroundImage !== undefined) {
      cachedBackgroundImage = backgroundImage;
    }
    return true;
  } catch (e) {
    console.error('Failed to save profile to server:', e);
    return false;
  }
}

// Legacy sync save (for backwards compatibility - now async internally)
export function saveProfile(data: ProfileData): void {
  saveProfileToServer(data).catch(console.error);
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

export async function updateProfileBackground(backgroundImage: string | null): Promise<boolean> {
  const profile = loadProfile();
  return saveProfileToServer(profile, backgroundImage);
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
export async function importProfile(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString) as ProfileData;
    return await saveProfileToServer(data);
  } catch (e) {
    console.error('Failed to import profile:', e);
    return false;
  }
}

// Clear profile data
export async function clearProfile(): Promise<void> {
  cachedProfile = null;
  cachedBackgroundImage = null;
  await saveProfileToServer(getDefaultProfile(), null);
}
