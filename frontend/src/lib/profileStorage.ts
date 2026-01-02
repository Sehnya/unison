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

// Available custom fonts for profile cards
export const CUSTOM_FONTS = [
  { name: 'Default', value: 'inherit' },
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Heellaaz', value: 'Heellaaz, sans-serif' },
  { name: 'Roderika', value: 'Roderika, serif' },
  { name: 'Roderika Rough', value: 'Roderika Rough, serif' },
  { name: 'Matte Nature', value: 'Matte Nature, serif' },
  { name: 'Purple Magic', value: 'Purple Magic, fantasy' },
  { name: 'Humble Popstar', value: 'Humble Popstar, sans-serif' },
  { name: 'Gury Pump', value: 'Gury Pump, fantasy' },
  { name: 'Shocker', value: 'Shocker, fantasy' },
] as const;

export type CustomFontValue = typeof CUSTOM_FONTS[number]['value'];

export interface CardStyle {
  // Dimensions
  width?: string;        // e.g., '300px', '100%', 'auto'
  height?: string;       // e.g., '200px', 'auto'
  minHeight?: string;    // e.g., '150px'
  maxHeight?: string;    // e.g., '400px'
  
  // Typography
  fontFamily?: string;          // e.g., 'Heellaaz', 'Roderika'
  fontSize?: string;            // e.g., '16px', '1.2rem'
  fontWeight?: string;          // e.g., 'normal', 'bold', '600'
  textColor?: string;           // e.g., '#ffffff', 'rgba(255,255,255,0.9)'
  
  // Colors and backgrounds
  backgroundColor?: string;     // e.g., '#1a1a1a', 'rgba(40, 40, 40, 0.6)'
  backgroundImage?: string;     // e.g., 'url(...)', 'linear-gradient(...)'
  backgroundSize?: string;      // e.g., 'cover', 'contain'
  backgroundPosition?: string;  // e.g., 'center', 'top left'
  opacity?: number;             // 0 to 1
  
  // Border
  borderWidth?: string;         // e.g., '1px', '2px'
  borderStyle?: string;         // e.g., 'solid', 'dashed', 'none'
  borderColor?: string;         // e.g., '#333', 'rgba(255,255,255,0.2)'
  borderRadius?: string;        // e.g., '16px', '8px'
  
  // Transitions and animations
  transitionIn?: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom' | 'bounce';
  transitionOut?: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom';
  transitionDuration?: string;  // e.g., '0.3s', '500ms'
  
  // Shadows
  boxShadow?: string;           // e.g., '0 4px 6px rgba(0,0,0,0.3)'
  
  // Blur/backdrop
  backdropBlur?: string;        // e.g., '10px'
}

export interface ProfileCard {
  id: string;
  type: 'quote' | 'gradient' | 'music' | 'games' | 'github' | 'friends' | 'embed' | 'calendar';
  size: 'small' | 'medium' | 'wide' | 'full' | 'custom';
  style?: CardStyle;
  // Grid position (1-based column and row)
  gridColumn?: number;  // 1-6 for which column
  gridRow?: number;     // 1+ for which row in that column
}

// Embed card data for players and widgets
export interface EmbedCardData {
  embedType: 'custom';
  embedUrl: string;
  embedCode?: string; // Raw HTML embed code
  title?: string;
}

// Calendar card data
export interface CalendarCardData {
  calendarType: 'google' | 'outlook' | 'custom';
  embedUrl: string;
  title?: string;
}

// Global page styling
export interface PageStyle {
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  primaryColor?: string;
  accentColor?: string;
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
  embedCards: Record<string, EmbedCardData>;
  calendarCards: Record<string, CalendarCardData>;
  
  // Global page styling
  pageStyle: PageStyle;
  
  // Metadata
  lastUpdated: string;
  version: number;
}

const CURRENT_VERSION = 3;
let authToken: string | null = null;
let cachedProfile: ProfileData | null = null;
let cachedBackgroundImage: string | null = null;

// Set auth token for API calls
export function setAuthToken(token: string | null): void {
  authToken = token;
}

// Default page style
function getDefaultPageStyle(): PageStyle {
  return {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 'medium',
    primaryColor: '#ffffff',
    accentColor: '#3182ce',
  };
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
    embedCards: {},
    calendarCards: {},
    pageStyle: getDefaultPageStyle(),
    lastUpdated: new Date().toISOString(),
    version: CURRENT_VERSION
  };
}

// Load profile from server
export async function loadProfileFromServer(userId?: string): Promise<{ profileData: ProfileData; backgroundImage: string | null }> {
  if (!authToken) {
    return { profileData: getDefaultProfile(), backgroundImage: null };
  }

  try {
    // If userId is provided, load that user's profile (read-only view)
    // Otherwise load the current user's profile
    const endpoint = userId 
      ? `/api/auth/users/${userId}/profile-data`
      : '/api/auth/profile-data';
    
    const response = await fetch(apiUrl(endpoint), {
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
      const loadedProfile = data.profileData.profile_data as ProfileData;
      const loadedBg = data.profileData.background_image || null;
      
      // Only cache if loading own profile (no userId provided)
      if (!userId) {
        cachedProfile = loadedProfile;
        cachedBackgroundImage = loadedBg;
      }
      
      return { profileData: loadedProfile, backgroundImage: loadedBg };
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
    case 'embed':
      if (profile.embedCards) delete profile.embedCards[cardId];
      break;
    case 'calendar':
      if (profile.calendarCards) delete profile.calendarCards[cardId];
      break;
  }
  
  saveProfile(profile);
}

// Update embed card data
export function updateEmbedCard(cardId: string, data: EmbedCardData): void {
  const profile = loadProfile();
  if (!profile.embedCards) profile.embedCards = {};
  profile.embedCards[cardId] = data;
  saveProfile(profile);
}

// Update calendar card data
export function updateCalendarCard(cardId: string, data: CalendarCardData): void {
  const profile = loadProfile();
  if (!profile.calendarCards) profile.calendarCards = {};
  profile.calendarCards[cardId] = data;
  saveProfile(profile);
}

// Update page style
export function updatePageStyle(style: Partial<PageStyle>): void {
  const profile = loadProfile();
  if (!profile.pageStyle) profile.pageStyle = getDefaultPageStyle();
  profile.pageStyle = { ...profile.pageStyle, ...style };
  saveProfile(profile);
}

// Get page style
export function getPageStyle(): PageStyle {
  const profile = loadProfile();
  return profile.pageStyle || getDefaultPageStyle();
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
