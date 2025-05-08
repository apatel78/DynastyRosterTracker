import axios from 'axios';
import { 
  SleeperUser, 
  SleeperLeague, 
  SleeperRoster, 
  SleeperPlayer,
  SleeperDraftPick,
  SleeperTransaction,
  LeagueHistory
} from './types';
import {
  saveToCache as saveToPersistentCache,
  getFromCache as getFromPersistentCache,
  getAllPlayersCacheKey,
  getUserLeaguesCacheKey,
  getPlayerAcquisitionsCacheKey,
  getLeagueDetailsCacheKey
} from './persistentCache';

const BASE_URL = 'https://api.sleeper.app/v1';
const API_DELAY_MS = 50;

const sessionPlayerCache: Record<string, CacheEntry<SleeperPlayer>> = {};
const sessionDraftCache: Record<string, CacheEntry<{ draft_id: string; type?: string; status?: string }[]>> = {};
const sessionPicksCache: Record<string, CacheEntry<SleeperDraftPick[]>> = {};
const sessionTransactionsCache: Record<string, CacheEntry<SleeperTransaction[]>> = {};
let sessionAllPlayersCache: Record<string, SleeperPlayer> | undefined;
const sessionUserSeasonsCache: Record<string, CacheEntry<string[]>> = {};

const SESSION_CACHE_EXPIRATION = 60 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }
  });
}

export async function getUserIdByUsername(username: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await axios.get(`${BASE_URL}/user/${username}`, { signal });
    return response.data.user_id || null;
  } catch (error) {
    if (axios.isCancel(error)) {
      return null;
    }
    console.error('[API/getUserIdByUsername] Error fetching user:', error);
    return null;
  }
}

export async function getUserLeagues(userId: string, season: string, signal?: AbortSignal): Promise<SleeperLeague[] | null> {
  const persistentCacheKey = getUserLeaguesCacheKey(userId, season);
  const cachedData = getFromPersistentCache<SleeperLeague[]>(persistentCacheKey);
  if (cachedData) {
    return cachedData;
  }
  try {
    const response = await axios.get(`${BASE_URL}/user/${userId}/leagues/nfl/${season}`, { signal });
    const leagues = response.data || null;
    if (leagues) {
      const leagueInfo = leagues.map((league: SleeperLeague) => ({
        league_id: league.league_id,
        name: league.name,
        season: league.season,
        total_rosters: league.total_rosters,
        roster_positions: league.roster_positions,
        previous_league_id: league.previous_league_id,
        settings: league.settings ? { type: league.settings.type } : undefined
      }));
      saveToPersistentCache(persistentCacheKey, leagueInfo);
    }
    return leagues;
  } catch (error) {
    if (axios.isCancel(error)) {
      return null;
    }
    console.error(`[API/getUserLeagues] Error for ${userId}, season ${season}:`, error);
    return null;
  }
}

export async function getUserSeasons(userId: string, signal?: AbortSignal): Promise<string[]> {
  const sessionCachedSeasons = sessionUserSeasonsCache[userId];
  const now = Date.now();
  
  if (sessionCachedSeasons && (now - sessionCachedSeasons.timestamp < SESSION_CACHE_EXPIRATION)) {
    return sessionCachedSeasons.data;
  }
  
  const currentYear = new Date().getFullYear();
  const potentialYears = Array.from({ length: currentYear - 2017 + 1 }, (_, i) => (currentYear - i + 1).toString()).reverse(); 
  
  const availableYears: string[] = [];
  for (const year of potentialYears) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const leagues = await getUserLeagues(userId, year, signal); 
      if (leagues && leagues.length > 0) {
        availableYears.push(year);
      }
      await delay(API_DELAY_MS, signal); 
    } catch (err) {
      if (axios.isCancel(err)) {
        throw err;
      }
      console.error(`[API/getUserSeasons] Error checking year ${year} for ${userId}:`, err);
    }
  }
  
  const sortedYears = availableYears.sort((a, b) => parseInt(b) - parseInt(a)); 
  
  sessionUserSeasonsCache[userId] = {
    data: sortedYears,
    timestamp: now
  };
  return sortedYears;
}

export async function getPlayersInfo(signal?: AbortSignal): Promise<Record<string, SleeperPlayer>> {
  const persistentCacheKey = getAllPlayersCacheKey();
  const cachedData = getFromPersistentCache<Record<string, SleeperPlayer>>(persistentCacheKey);
  if (cachedData) {
    sessionAllPlayersCache = cachedData; 
    return cachedData;
  }

  if (sessionAllPlayersCache) { 
    return sessionAllPlayersCache;
  }

  try {
    const response = await axios.get(`${BASE_URL}/players/nfl`, { signal });
    const rawPlayers = response.data;
    const processedPlayers: Record<string, SleeperPlayer> = {};

    for (const playerId in rawPlayers) {
      if (rawPlayers[playerId]) {
        const p = rawPlayers[playerId];
        processedPlayers[playerId] = {
          player_id: playerId,
          name: `${p.first_name} ${p.last_name}`,
          full_name: `${p.first_name} ${p.last_name}`,
          position: p.position || '',
          team: p.team || 'FA',
          avatar_url: getPlayerImageUrl(playerId),
        };
      }
    }
    
    saveToPersistentCache(persistentCacheKey, processedPlayers);
    sessionAllPlayersCache = processedPlayers; 
    return processedPlayers;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw error;
    }
    console.error('[API/getPlayersInfo] Error:', error);
    throw new Error('Could not fetch player information');
  }
}

export async function getPlayerInfo(playerId: string, signal?: AbortSignal): Promise<SleeperPlayer | null> {
    const sessionCachedPlayer = sessionPlayerCache[playerId];
    const now = Date.now();

    if (sessionCachedPlayer && (now - sessionCachedPlayer.timestamp < SESSION_CACHE_EXPIRATION)) {
        return sessionCachedPlayer.data;
    }

    try {
        const allPlayers = await getPlayersInfo(signal);
        if (allPlayers[playerId]) {
            const player = allPlayers[playerId];
             sessionPlayerCache[playerId] = {
                data: player,
                timestamp: now
            };
            return player;
        }
        const response = await axios.get(`${BASE_URL}/players/nfl`, { signal });
        const playersData = response.data;
        if (playersData && playersData[playerId]) {
            const apiPlayer = playersData[playerId];
            const playerData: SleeperPlayer = {
                player_id: playerId,
                full_name: `${apiPlayer.first_name} ${apiPlayer.last_name}`,
                name: `${apiPlayer.first_name} ${apiPlayer.last_name}`,
                position: apiPlayer.position || '',
                team: apiPlayer.team || 'FA',
                avatar_url: getPlayerImageUrl(playerId),
            };
            sessionPlayerCache[playerId] = { data: playerData, timestamp: now };
            return playerData;
        }
        return null;
    } catch (error) {
        if (axios.isCancel(error)) {
            return null;
        }
        console.error(`[API/getPlayerInfo] Error fetching player ${playerId}:`, error);
        return null;
    }
}

export async function getPlayersInfoBatch(playerIds: string[], signal?: AbortSignal): Promise<Record<string, SleeperPlayer>> {
  const players: Record<string, SleeperPlayer> = {};
  const allPlayersData = await getPlayersInfo(signal);
  if (signal?.aborted) {
    return {};
  }

  for (const playerId of playerIds) {
    if (allPlayersData[playerId]) {
      players[playerId] = allPlayersData[playerId];
    } else {
      console.warn(`[API/getPlayersInfoBatch] Player ${playerId} not found.`);
    }
  }
  return players;
}

export function getPlayerImageUrl(playerId: string): string {
  if (!playerId) {
    return '';
  }
  const cleanPlayerId = String(playerId).trim();
  if (!cleanPlayerId) {
    return '';
  }
  return `https://sleepercdn.com/content/nfl/players/${cleanPlayerId}.jpg`;
}

export async function getLeagueDetails(leagueId: string, signal?: AbortSignal): Promise<SleeperLeague | null> {
  const persistentCacheKey = getLeagueDetailsCacheKey(leagueId);
  const cachedData = getFromPersistentCache<SleeperLeague>(persistentCacheKey);
  if (cachedData) {
    return cachedData;
  }

  if (!leagueId) {
    return null;
  }
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}`, { signal });
    if (response.data && typeof response.data === 'object') {
      const fullLeagueDetails = response.data as SleeperLeague;
      
      const essentialLeagueDetails = {
        league_id: fullLeagueDetails.league_id,
        name: fullLeagueDetails.name,
        season: fullLeagueDetails.season,
        total_rosters: fullLeagueDetails.total_rosters,
        roster_positions: fullLeagueDetails.roster_positions,
        previous_league_id: fullLeagueDetails.previous_league_id,
        settings: fullLeagueDetails.settings ? { 
          type: fullLeagueDetails.settings.type 
        } : undefined
      } as SleeperLeague;
      
      saveToPersistentCache(persistentCacheKey, essentialLeagueDetails);
      return fullLeagueDetails;
    } else {
      return null;
    }
  } catch (error) {
    if (axios.isCancel(error)) {
      return null;
    }
    return null;
  }
}

interface PlayerAcquisitionData {
    userId: string;
    leagueId: string;
    season: string;
    roster?: SleeperRoster;
    drafts?: { draftInfo: { draft_id: string; type?: string; status?: string }; picks: SleeperDraftPick[] }[];
    transactions?: SleeperTransaction[];
}

export async function getPlayerAcquisitions(
  leagueId: string,
  userId: string,
  roster: SleeperRoster,
  signal?: AbortSignal
): Promise<Record<string, { type: string; details: string; timestamp?: number }>> {
  const persistentCacheKey = getPlayerAcquisitionsCacheKey(userId, leagueId);
  const cachedData = getFromPersistentCache<Record<string, { type: string; details: string; timestamp?: number }>>(persistentCacheKey);
  if (cachedData) {
    return cachedData;
  }

  const acquisitions: Record<string, { type: string; details: string; timestamp?: number }> = {};
  roster.players.forEach(playerId => {
    acquisitions[playerId] = { type: "Unknown", details: "", timestamp: 0 };
  });

  try {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const leagueDetails = await getLeagueDetails(leagueId, signal);
    const isRedraft = leagueDetails?.settings?.type === 0;

    const leagueHistoryData = await getLeagueHistory(leagueId, signal);
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (!leagueHistoryData || leagueHistoryData.length === 0) {
      if (!signal?.aborted) {
        saveToPersistentCache(persistentCacheKey, acquisitions);
      }
      return acquisitions;
    }

    const historicalDataPromises = leagueHistoryData.map(async (histSeason): Promise<PlayerAcquisitionData | null> => {
      if (signal?.aborted) {
        return null;
      }
      try {
        const seasonRosters = await getUserRoster(userId, histSeason.league_id, histSeason.season, signal);
        const userRosterThisSeason = seasonRosters?.find(r => r.owner_id === userId);
        
        const seasonDraftsFromApi = await getLeagueDrafts(histSeason.league_id, signal);
        const seasonDraftsWithPicks = await Promise.all(seasonDraftsFromApi.map(async (draftInfo) => {
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          const picks = await getDraftPicks(draftInfo.draft_id, signal);
          return { draftInfo, picks };
        }));

        const seasonTransactions = await getLeagueTransactions(histSeason.league_id, signal);
        
        return {
          userId, leagueId: histSeason.league_id, season: histSeason.season, 
          roster: userRosterThisSeason, 
          drafts: seasonDraftsWithPicks, 
          transactions: seasonTransactions
        };
      } catch (err) {
        if (axios.isCancel(err) || (err instanceof DOMException && err.name === 'AbortError')) {
          throw err;
        }
        console.error(`[API/getPlayerAcquisitions] Error fetching data for historical season ${histSeason.season} in league ${histSeason.league_id}:`, err);
        return null;
      }
    });

    const allHistoricalSeasonDataRaw = await Promise.all(historicalDataPromises);
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const allHistoricalSeasonData = allHistoricalSeasonDataRaw.filter((d): d is PlayerAcquisitionData => d !== null); 

    let userEarliestSeasonData: LeagueHistory | null = null;
    let userDesignatedStartupDraftIdInEarliestSeason: string | null = null;
    let draftsExistBeforeUserJoinedThisLineage = false;
    let foundUserInLineage = false;

    for (const histData of allHistoricalSeasonData) {
        const userRosterInThisHistoricalSeason = histData.roster;
        const draftsInThisHistoricalSeason = histData.drafts || [];

        if (userRosterInThisHistoricalSeason) {
            if (!foundUserInLineage) {
                foundUserInLineage = true;
                userEarliestSeasonData = leagueHistoryData.find(lh => lh.league_id === histData.leagueId && lh.season === histData.season) || null;
                const sortedDrafts = draftsInThisHistoricalSeason.sort((a, b) => Number(a.draftInfo.draft_id) - Number(b.draftInfo.draft_id));
                for (const draft of sortedDrafts) {
                    const userParticipated = draft.picks.some((p: SleeperDraftPick) => p.picked_by === userId);
                    if (userParticipated) {
                        if (draft.draftInfo.type === 'startup' || draft.draftInfo.draft_id.toLowerCase().includes('startup') || draft.draftInfo.draft_id.toLowerCase().includes('initial')) {
                            userDesignatedStartupDraftIdInEarliestSeason = draft.draftInfo.draft_id;
                            break;
                        }
                        if (!userDesignatedStartupDraftIdInEarliestSeason) {
                            userDesignatedStartupDraftIdInEarliestSeason = draft.draftInfo.draft_id;
                        }
                    }
                }
                 if (!userDesignatedStartupDraftIdInEarliestSeason && sortedDrafts.length > 0) {
                    const userParticipatedInAnyDraftThisSeason = sortedDrafts.some(draft => draft.picks.some((p: SleeperDraftPick) => p.picked_by === userId));
                    if (userParticipatedInAnyDraftThisSeason) {
                        for (const draft of sortedDrafts) {
                            if (draft.picks.some((p: SleeperDraftPick) => p.picked_by === userId)) {
                                userDesignatedStartupDraftIdInEarliestSeason = draft.draftInfo.draft_id;
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            if (draftsInThisHistoricalSeason.length > 0 && !foundUserInLineage) {
                draftsExistBeforeUserJoinedThisLineage = true;
            }
        }
    }

    let userStartupDraftPlayerCount = 0;
    for (const histData of allHistoricalSeasonData) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const { roster: userRosterThisSeason, drafts, transactions } = histData;
      if (!userRosterThisSeason) {
        continue;
      }

      const historicalSeasonMeta = leagueHistoryData.find(lh => lh.league_id === histData.leagueId && lh.season === histData.season);
      if (!historicalSeasonMeta) {
        continue; 
      }

      const sortedDraftsInternal = (drafts || []).sort((a,b) => Number(a.draftInfo.draft_id) - Number(b.draftInfo.draft_id));
      for (const draftData of sortedDraftsInternal) {
        const { draftInfo, picks } = draftData;
        const userPicksInThisDraft = picks.filter((p: SleeperDraftPick) => p.picked_by === userId);
        if (userPicksInThisDraft.length === 0) {
          continue;
        }
        
        let currentDraftType = "Rookie Draft";
        if (isRedraft) {
            currentDraftType = "Startup Draft";
        } else if (!draftsExistBeforeUserJoinedThisLineage && userEarliestSeasonData && historicalSeasonMeta.season === userEarliestSeasonData.season && draftInfo.draft_id === userDesignatedStartupDraftIdInEarliestSeason) {
          currentDraftType = "Startup Draft";
        }
        
        for (const pick of userPicksInThisDraft) {
          if (pick.player_id && (acquisitions[pick.player_id]?.type === "Unknown" || !acquisitions[pick.player_id]?.timestamp)) {
            const teamsInLeague = leagueDetails?.total_rosters || 12;
            const pickInRound = pick.pick_no % teamsInLeague === 0 ? teamsInLeague : pick.pick_no % teamsInLeague;
            const formattedPickNumber = pickInRound < 10 ? `0${pickInRound}` : pickInRound.toString();
            const details = (currentDraftType === "Startup Draft") ? `${pick.round}.${formattedPickNumber}` : `${historicalSeasonMeta.season} ${pick.round}.${formattedPickNumber}`;
            if (currentDraftType === "Startup Draft") {
              userStartupDraftPlayerCount++;
            }
            acquisitions[pick.player_id] = { type: currentDraftType, details, timestamp: new Date(parseInt(historicalSeasonMeta.season), 5, 1).getTime() };
          }
        }
      }
      for (const transaction of (transactions || [])) {
        if (!transaction.roster_ids.includes(userRosterThisSeason.roster_id)) {
          continue;
        }
        const transactionTime = transaction.created;
        if (transaction.adds) {
          for (const playerId in transaction.adds) {
            if (roster.players.includes(playerId)) {
              const currentAcquisition = acquisitions[playerId];
              if (!currentAcquisition || currentAcquisition.type === "Unknown" || (transactionTime && (!currentAcquisition.timestamp || transactionTime > currentAcquisition.timestamp))) {
                const date = new Date(transactionTime);
                let details = `Acquired on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                let acqType = "Unknown Transaction";
                if (transaction.type === "trade") {
                  acqType = "Trade";
                } else if (transaction.type === "waiver") {
                  acqType = "Waiver Wire";
                  if (transaction.settings?.waiver_bid) {
                    details = `Paid ${transaction.settings.waiver_bid} FAAB on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                  }
                } else if (transaction.type === "free_agent") {
                  acqType = "Free Agency";
                }
                acquisitions[playerId] = { type: acqType, details, timestamp: transactionTime };
              }
            }
          }
        }
      }
    }

    if (draftsExistBeforeUserJoinedThisLineage || (foundUserInLineage && userStartupDraftPlayerCount === 0 && userDesignatedStartupDraftIdInEarliestSeason) || (foundUserInLineage && !userDesignatedStartupDraftIdInEarliestSeason) || !foundUserInLineage) {
      for (const playerId in acquisitions) {
        if (acquisitions[playerId].type === "Unknown") {
          acquisitions[playerId] = { type: "Previous Owner", details: "On roster when user took over team", timestamp: 0 };
        }
      }
    }
    if (!signal?.aborted) {
      saveToPersistentCache(persistentCacheKey, acquisitions);
    }
    return acquisitions;
  } catch (error) {
    if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
        if (!signal?.aborted) {
          saveToPersistentCache(persistentCacheKey, acquisitions); 
        }
        throw error;
    }
    console.error(`[API/getPlayerAcquisitions] Error for ${leagueId}, user ${userId}:`, error);
    if (!signal?.aborted) {
      saveToPersistentCache(persistentCacheKey, acquisitions);
    }
    return acquisitions; 
  }
}

export async function getLeagueDrafts(leagueId: string, signal?: AbortSignal): Promise<{ draft_id: string; type?: string; status?: string }[]> {
  const cacheKey = `leagueDrafts_${leagueId}`;
  const sessionCachedDrafts = sessionDraftCache[cacheKey];
  const now = Date.now();

  if (sessionCachedDrafts && (now - sessionCachedDrafts.timestamp < SESSION_CACHE_EXPIRATION)) {
    return sessionCachedDrafts.data;
  }

  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/drafts`, { signal });
    const drafts = response.data || [];
    if (!signal?.aborted) {
      sessionDraftCache[cacheKey] = { data: drafts, timestamp: now };
    }
    return drafts;
  } catch (error) {
    if (axios.isCancel(error)) {
      return [];
    }
    console.error(`[API/getLeagueDrafts] Error fetching drafts for league ${leagueId}:`, error);
    throw new Error(`Could not fetch drafts for league ID: ${leagueId}`);
  }
}

export async function getDraftPicks(draftId: string, signal?: AbortSignal): Promise<SleeperDraftPick[]> {
  const cacheKey = `draftPicks_${draftId}`;
  const sessionCachedPicks = sessionPicksCache[cacheKey];
  const now = Date.now();

  if (sessionCachedPicks && (now - sessionCachedPicks.timestamp < SESSION_CACHE_EXPIRATION)) {
    return sessionCachedPicks.data;
  }

  try {
    const response = await axios.get(`${BASE_URL}/draft/${draftId}/picks`, { signal });
    const picks = response.data || [];
    if (!signal?.aborted) {
      sessionPicksCache[cacheKey] = { data: picks, timestamp: now };
    }
    return picks;
  } catch (error) {
    if (axios.isCancel(error)) {
      return [];
    }
    console.error(`[API/getDraftPicks] Error fetching draft picks for draft ${draftId}:`, error);
    throw new Error(`Could not fetch picks for draft ID: ${draftId}`);
  }
}

export async function getLeagueTransactions(leagueId: string, signal?: AbortSignal): Promise<SleeperTransaction[]> {
  const cacheKey = `leagueTransactions_${leagueId}`;
  const sessionCachedTransactions = sessionTransactionsCache[cacheKey];
  const now = Date.now();

  if (sessionCachedTransactions && (now - sessionCachedTransactions.timestamp < SESSION_CACHE_EXPIRATION)) {
    return sessionCachedTransactions.data;
  }

  let allTransactions: SleeperTransaction[] = [];
  try {
    for (let currentWeek = 1; currentWeek <= 18; currentWeek++) { 
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const response = await axios.get(`${BASE_URL}/league/${leagueId}/transactions/${currentWeek}`, { signal });
      const weeklyTransactions: SleeperTransaction[] = response.data;
      if (weeklyTransactions && weeklyTransactions.length > 0) {
        allTransactions = [...allTransactions, ...weeklyTransactions];
      } else if (currentWeek > 4) {
        break;
      }
    }
    
    if (!signal?.aborted) {
      sessionTransactionsCache[cacheKey] = { data: allTransactions, timestamp: now };
    }
    return allTransactions;
  } catch (error) {
    if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
      return allTransactions;
    }
    console.error(`[API/getLeagueTransactions] Error fetching transactions for ${leagueId}:`, error);
    throw new Error(`Could not fetch transactions for league ID: ${leagueId}`);
  }
}

export async function getLeagueUsers(leagueId: string, signal?: AbortSignal): Promise<Record<string, SleeperUser>> {
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/users`, { signal });
    const users: SleeperUser[] = response.data;
    const usersMap: Record<string, SleeperUser> = {};
    users.forEach(user => {
      usersMap[user.user_id] = user;
    });
    return usersMap;
  } catch (error) {
    if (axios.isCancel(error)) {
      return {}; 
    }
    console.error(`[API/getLeagueUsers] Error fetching league users for ${leagueId}:`, error);
    throw new Error(`Could not fetch users for league ID: ${leagueId}`);
  }
}

export async function getLeagueHistory(leagueId: string, signal?: AbortSignal): Promise<LeagueHistory[]> {
  const history: LeagueHistory[] = [];
  let currentLeagueId: string | null | undefined = leagueId;
  const visitedLeagueIds = new Set<string>();

  try {
    while (currentLeagueId && history.length < 10 && !visitedLeagueIds.has(currentLeagueId)) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      visitedLeagueIds.add(currentLeagueId);
      type LeagueHistoryData = { league_id: string; season: string; previous_league_id?: string };
      const response: { data: LeagueHistoryData | null } = await axios.get(`${BASE_URL}/league/${currentLeagueId}`, { signal });
      const currentLeagueData = response.data;
      if (!currentLeagueData) {
        break;
      }

      history.push({
        league_id: currentLeagueId,
        previousLeagueId: currentLeagueData.previous_league_id,
        season: currentLeagueData.season
      });
      currentLeagueId = currentLeagueData.previous_league_id;
      if (currentLeagueId) {
        await delay(API_DELAY_MS, signal);
      }
    }
    
    history.reverse();
    return history;
  } catch (error) {
    if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
      return history.reverse(); 
    }
    console.error('[API/getLeagueHistory] Error:', error);
    if (history.length === 0 && leagueId === currentLeagueId) {
        try {
            const res = await axios.get<{ league_id: string; season: string; previous_league_id?: string }>(`${BASE_URL}/league/${leagueId}`, { signal }); 
            const currentLeagueData = res.data;
            if (currentLeagueData) {
              return [{ league_id: leagueId, season: currentLeagueData.season, previousLeagueId: currentLeagueData.previous_league_id }];
            }
        } catch (_fallbackError) {
           console.error('[API/getLeagueHistory] Fallback error:', _fallbackError);
        }
    }
    return history.length > 0 ? history.reverse() : [{ league_id: leagueId, season: '', previousLeagueId: undefined }];
  }
}

/**
 * Get user roster for a specific season and league - No persistent cache
 * @param userId The user ID
 * @param leagueId The league ID 
 * @param _season Not used directly, but kept for API consistency
 */
export async function getUserRoster(
  userId: string, 
  leagueId: string, 
  _season: string,
  signal?: AbortSignal
): Promise<SleeperRoster[] | null> {
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/rosters`, { signal });
    return response.data || null;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('[API/getUserRoster] Request canceled');
      return null;
    }
    console.error(`[API/getUserRoster] Error fetching rosters for ${leagueId}:`, error);
    return null;
  }
} 