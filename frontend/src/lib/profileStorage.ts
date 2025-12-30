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
const MAX_IMAGE_SIZE = 200 * 1024; // 200KB max per image after compression

/**
 * Compress an image to reduce storage size
 * Returns null if compression fails or image is too large
 */
async function compressImage(base64: string, maxSize: number = MAX_IMAGE_SIZE): Promise<string | null> {
  return new Promise((resolve) => {
    // If it's a URL (not base64), return as-is
    if (!base64.startsWith('data:')) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Scale down if too large
      const maxDimension = 800;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try different quality levels
      for (let quality = 0.8; quality >= 0.3; quality -= 0.1) {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length <= maxSize) {
          resolve(compressed);
          return;
        }
      }
      
      // If still too large, return null
      console.warn('Image too large even after compression');
      resolve(null);
    };
    
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

/**
 * Get estimated storage size
 */
function getStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage.getItem(key)?.length || 0;
    }
  }
  return total;
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
export function saveProfile(data: ProfileData): boolean {
  try {
    data.lastUpdated = new Date().toISOString();
    data.version = CURRENT_VERSION;
    const jsonString = JSON.stringify(data);
    
    // Check if data is too large (localStorage limit is ~5MB)
    if (jsonString.length > 4 * 1024 * 1024) {
      console.error('Profile data too large to save:', (jsonString.length / 1024 / 1024).toFixed(2), 'MB');
      alert('Your profile has too much data to save. Try removing some images or content.');
      return false;
    }
    
    localStorage.setItem(STORAGE_KEY, jsonString);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Current storage:', (getStorageSize() / 1024 / 1024).toFixed(2), 'MB');
      alert('Storage is full. Try removing some images or clearing old data.');
    } else {
      console.error('Failed to save profile:', e);
    }
    return false;
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

export async function updateProfileBackground(backgroundImage: string | null): Promise<boolean> {
  const profile = loadProfile();
  
  if (backgroundImage && backgroundImage.startsWith('data:')) {
    // Compress the image before saving
    const compressed = await compressImage(backgroundImage, 300 * 1024); // 300KB for background
    if (!compressed) {
      alert('Background image is too large. Please use a smaller image.');
      return false;
    }
    profile.backgroundImage = compressed;
  } else {
    profile.backgroundImage = backgroundImage;
  }
  
  return saveProfile(profile);
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

export async function updateGalleryCard(cardId: string, data: GalleryCardData): Promise<boolean> {
  const profile = loadProfile();
  if (!profile.galleryCards) profile.galleryCards = {};
  
  // Compress all images in the gallery
  const compressedImages: GalleryImage[] = [];
  for (const img of data.images) {
    if (img.src.startsWith('data:')) {
      const compressed = await compressImage(img.src);
      if (compressed) {
        compressedImages.push({ ...img, src: compressed });
      } else {
        console.warn('Skipping image that could not be compressed:', img.name);
      }
    } else {
      compressedImages.push(img);
    }
  }
  
  // Limit to 10 images per gallery
  if (compressedImages.length > 10) {
    alert('Gallery limited to 10 images. Some images were not added.');
    compressedImages.splice(10);
  }
  
  profile.galleryCards[cardId] = { ...data, images: compressedImages };
  return saveProfile(profile);
}

export async function updateMusicCard(data: MusicCardData): Promise<boolean> {
  const profile = loadProfile();
  
  // Compress cover image if it's base64
  if (data.coverImage && data.coverImage.startsWith('data:')) {
    const compressed = await compressImage(data.coverImage, 100 * 1024); // 100KB for cover
    data.coverImage = compressed;
  }
  
  profile.musicCard = data;
  return saveProfile(profile);
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

// Get storage usage info
export function getStorageInfo(): { used: number; profileSize: number } {
  const profileData = localStorage.getItem(STORAGE_KEY);
  return {
    used: getStorageSize(),
    profileSize: profileData?.length || 0
  };
}

// Clear large data (images) while keeping layout
export function clearProfileImages(): void {
  const profile = loadProfile();
  profile.backgroundImage = null;
  if (profile.galleryCards) {
    for (const key in profile.galleryCards) {
      profile.galleryCards[key].images = [];
    }
  }
  if (profile.musicCard) {
    profile.musicCard.coverImage = null;
  }
  profile.miniWidgets = profile.miniWidgets.filter(w => w.type !== 'gif');
  saveProfile(profile);
}
