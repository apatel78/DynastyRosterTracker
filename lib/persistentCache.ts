const CACHE_PREFIX = 'sleeperHistoryCache_';
const DEFAULT_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CacheItem<T> {
  timestamp: number;
  data: T;
  duration: number;
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__testLocalStorage__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves data to localStorage with a timestamp and duration.
 * @param key The cache key.
 * @param data The data to cache.
 * @param duration Custom cache duration in milliseconds.
 */
export function saveToCache<T>(key: string, data: T, duration: number = DEFAULT_CACHE_DURATION_MS): void {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Caching disabled.');
    return;
  }
  const fullKey = CACHE_PREFIX + key;
  const cacheEntry: CacheItem<T> = {
    timestamp: Date.now(),
    data,
    duration,
  };
  try {
    localStorage.setItem(fullKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error(`[Cache] Error saving to localStorage for key ${fullKey}:`, error);
  }
}

/**
 * Retrieves data from localStorage if it exists and is not expired.
 * @param key The cache key.
 * @returns The cached data or null if not found or expired.
 */
export function getFromCache<T>(key: string): T | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }
  const fullKey = CACHE_PREFIX + key;
  const itemStr = localStorage.getItem(fullKey);

  if (!itemStr) {
    return null;
  }

  try {
    const item: CacheItem<T> = JSON.parse(itemStr);
    if (Date.now() - item.timestamp < item.duration) {
      return item.data;
    } else {
      localStorage.removeItem(fullKey);
      return null;
    }
  } catch (error) {
    console.error(`[Cache] Error parsing from localStorage for key ${fullKey}:`, error);
    localStorage.removeItem(fullKey); 
    return null;
  }
}

/**
 * Checks if a cache entry is still valid.
 * @param key The cache key.
 * @returns True if the cache entry is valid, false otherwise.
 */
export function isCacheValid(key: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }
  const fullKey = CACHE_PREFIX + key;
  const itemStr = localStorage.getItem(fullKey);

  if (!itemStr) {
    return false;
  }

  try {
    const item: CacheItem<unknown> = JSON.parse(itemStr);
    return Date.now() - item.timestamp < item.duration;
  } catch {
    return false;
  }
}

export function clearAllCache(): void {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Cache clearing skipped.');
    return;
  }
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Generates a cache key for all player info.
 * Caches player data including player_id, name, position, team.
 */
export const getAllPlayersCacheKey = () => 'allPlayers';

/**
 * Generates a cache key for basic league info (ID, name, season).
 * This caches only the minimal league data needed to identify leagues.
 * @param userId The user ID.
 * @param season The season.
 */
export const getUserLeaguesCacheKey = (userId: string, season: string) => `userLeagues_${userId}_${season}`;

/**
 * Generates a cache key for player acquisitions in a specific league for a user.
 * This caches information about how players were acquired.
 * @param userId The user ID.
 * @param leagueId The league ID.
 */
export const getPlayerAcquisitionsCacheKey = (userId: string, leagueId: string) => `playerAcquisitions_${userId}_${leagueId}`;

/**
 * Generates a cache key for basic league details.
 * @param leagueId The league ID.
 */
export const getLeagueDetailsCacheKey = (leagueId: string) => `leagueBasicDetails_${leagueId}`; 