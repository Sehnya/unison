// RAWG API Service with intelligent caching
const RAWG_API_KEY = '866d8e34fe1843adabc85d1abc0e17f3';
const RAWG_BASE_URL = 'https://api.rawg.io/api';

export interface RAWGGame {
  id: number;
  slug: string;
  name: string;
  background_image: string;
  released: string;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  playtime: number;
  genres: { id: number; name: string; slug: string }[];
  platforms: { platform: { id: number; name: string; slug: string } }[];
  short_screenshots: { id: number; image: string }[];
  description_raw?: string;
}

export interface CachedGame {
  id: string;
  rawgId: number;
  slug: string;
  name: string;
  image: string;
  released: string;
  rating: number;
  genres: string[];
  platforms: string[];
  playtime: number;
  description: string;
  cachedAt: number;
}

// In-memory cache for current session
const memoryCache = new Map<string, CachedGame>();

// LocalStorage key for persistent cache
const CACHE_KEY = 'rawg_game_cache';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// Load cache from localStorage on init
function loadCache(): Map<string, CachedGame> {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, CachedGame>;
      const now = Date.now();
      
      // Filter out expired entries
      Object.entries(parsed).forEach(([key, game]) => {
        if (now - game.cachedAt < CACHE_EXPIRY) {
          memoryCache.set(key, game);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load RAWG cache:', e);
  }
  return memoryCache;
}

// Save cache to localStorage
function saveCache(): void {
  try {
    const cacheObj: Record<string, CachedGame> = {};
    memoryCache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
  } catch (e) {
    console.warn('Failed to save RAWG cache:', e);
  }
}

// Initialize cache on module load
loadCache();

// Get cache key for a game (by slug or id)
function getCacheKey(identifier: string | number): string {
  return `game_${identifier}`;
}

// Check if game is in cache
export function getFromCache(identifier: string | number): CachedGame | null {
  const key = getCacheKey(identifier);
  const cached = memoryCache.get(key);
  
  if (cached && Date.now() - cached.cachedAt < CACHE_EXPIRY) {
    return cached;
  }
  
  return null;
}

// Add game to cache
export function addToCache(game: CachedGame): void {
  const keyById = getCacheKey(game.rawgId);
  const keyBySlug = getCacheKey(game.slug);
  const keyByName = getCacheKey(game.name.toLowerCase());
  
  memoryCache.set(keyById, game);
  memoryCache.set(keyBySlug, game);
  memoryCache.set(keyByName, game);
  
  saveCache();
}

// Convert RAWG API response to cached game format
function convertToCachedGame(rawgGame: RAWGGame): CachedGame {
  return {
    id: `rawg_${rawgGame.id}`,
    rawgId: rawgGame.id,
    slug: rawgGame.slug,
    name: rawgGame.name,
    image: rawgGame.background_image || '',
    released: rawgGame.released || '',
    rating: Math.round(rawgGame.rating),
    genres: rawgGame.genres?.map(g => g.name) || [],
    platforms: rawgGame.platforms?.map(p => p.platform.name) || [],
    playtime: rawgGame.playtime || 0,
    description: rawgGame.description_raw || '',
    cachedAt: Date.now(),
  };
}

// Search games from RAWG API
export async function searchGames(query: string, page: number = 1, pageSize: number = 10): Promise<CachedGame[]> {
  if (!query.trim()) return [];
  
  // Check cache first for exact match
  const cached = getFromCache(query.toLowerCase());
  if (cached) {
    return [cached];
  }
  
  try {
    const url = new URL(`${RAWG_BASE_URL}/games`);
    url.searchParams.set('key', RAWG_API_KEY);
    url.searchParams.set('search', query);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('page_size', pageSize.toString());
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`RAWG API error: ${response.status}`);
    }
    
    const data = await response.json();
    const games: CachedGame[] = data.results.map((game: RAWGGame) => {
      const cachedGame = convertToCachedGame(game);
      addToCache(cachedGame);
      return cachedGame;
    });
    
    return games;
  } catch (error) {
    console.error('Failed to search games:', error);
    return [];
  }
}

// Get game details by ID or slug
export async function getGameDetails(identifier: string | number): Promise<CachedGame | null> {
  // Check cache first
  const cached = getFromCache(identifier);
  if (cached) {
    return cached;
  }
  
  try {
    const url = new URL(`${RAWG_BASE_URL}/games/${identifier}`);
    url.searchParams.set('key', RAWG_API_KEY);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`RAWG API error: ${response.status}`);
    }
    
    const game: RAWGGame = await response.json();
    const cachedGame = convertToCachedGame(game);
    addToCache(cachedGame);
    
    return cachedGame;
  } catch (error) {
    console.error('Failed to get game details:', error);
    return null;
  }
}

// Get all cached games (for displaying user's saved games)
export function getAllCachedGames(): CachedGame[] {
  const games: CachedGame[] = [];
  const seen = new Set<number>();
  
  memoryCache.forEach((game) => {
    if (!seen.has(game.rawgId)) {
      seen.add(game.rawgId);
      games.push(game);
    }
  });
  
  return games;
}

// Clear expired cache entries
export function cleanupCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  memoryCache.forEach((game, key) => {
    if (now - game.cachedAt >= CACHE_EXPIRY) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => memoryCache.delete(key));
  saveCache();
}
