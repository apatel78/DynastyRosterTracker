"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getUserIdByUsername, getUserLeagues, getUserRoster, getPlayersInfo, getPlayerAcquisitions } from "@/lib/api"
import type { SleeperLeague } from "@/lib/types"
import { clearAllCache } from "@/lib/persistentCache"

const Spinner = () => (
  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
);

export const UserInputForm = React.memo(function UserInputFormComponent() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [season, setSeason] = useState(() => String(currentYear));
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  const [userId, setUserId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSelectedLeague, setIsLoadingSelectedLeague] = useState(false);
  
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erroredLeagueId, setErroredLeagueId] = useState<string | null>(null);

  const prevUsername = useRef<string | null>(null);
  const backgroundLoadAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLeagues([]);
    setSelectedLeagueId("");
    setUserId(null);
    setError(null);
    setErroredLeagueId(null);
    setIsLoadingSelectedLeague(false);
    if (backgroundLoadAbortControllerRef.current) {
      backgroundLoadAbortControllerRef.current.abort();
      backgroundLoadAbortControllerRef.current = null;
    }
  }, [username, season]);

  const validateSeason = useCallback((value: string) => {
    const yearNumber = parseInt(value, 10);
    if (isNaN(yearNumber)) {
      return "Please enter a valid year";
    }
    if (yearNumber < 2017 || yearNumber > currentYear) {
      return `Year must be between 2017 and ${currentYear}`;
    }
    return null;
  }, [currentYear]);
  
  const handleSeasonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSeason(value);
    setSeasonError(validateSeason(value));
  }, [validateSeason]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  }, []);

  const backgroundLoadRosters = useCallback(async (leaguesToLoad: SleeperLeague[], currentUserId: string, signal: AbortSignal) => {
    for (const league of leaguesToLoad) {
      if (signal.aborted) {
        return;
      }
      try {
        await getUserRoster(currentUserId, league.league_id, league.season);
      } catch (err) {
        if (!signal.aborted) {
          console.error(`[Background] Error preloading roster for league ${league.league_id}:`, err);
        }
      }
      if (signal.aborted) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, []);

  const loadAcquisitionsForLeague = useCallback(async (league: SleeperLeague, currentUserId: string, signal?: AbortSignal): Promise<boolean> => {
    if (signal?.aborted) return false;
    try {
      const leagueRosters = await getUserRoster(currentUserId, league.league_id, league.season);
      if (signal?.aborted) {
        return false;
      }
      if (leagueRosters) {
        const userRosterForLeague = leagueRosters.find(r => r.owner_id === currentUserId);
        if (userRosterForLeague) {
          await getPlayerAcquisitions(league.league_id, currentUserId, userRosterForLeague);
          return !signal?.aborted;
        } else {
          if (!signal?.aborted) {
            console.warn(`[Acquisition Load] User roster not found in league: ${league.name}`);
          }
        }
      } else {
        if (!signal?.aborted) {
          console.warn(`[Acquisition Load] Could not get rosters for league: ${league.name}`);
        }
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.error("Error preloading league data:", err);
      }
    }
    return false;
  }, []);

  const backgroundLoadOtherAcquisitions = useCallback(async (allLeagues: SleeperLeague[], selectedId: string, currentUserId: string, signal: AbortSignal) => {
    const otherLeagues = allLeagues.filter(l => l.league_id !== selectedId);
    for (const league of otherLeagues) {
      if (signal.aborted) {
        return;
      }
      await loadAcquisitionsForLeague(league, currentUserId, signal);
      if (signal.aborted) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, [loadAcquisitionsForLeague]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const seasonValidationError = validateSeason(season);
    if (seasonValidationError) {
      setSeasonError(seasonValidationError);
      return;
    }
    if (prevUsername.current !== username) {
      clearAllCache();
      prevUsername.current = username;
    }
    
    setIsLoading(true);
    setError(null);
    setLeagues([]);
    setSelectedLeagueId("");
    setIsLoadingSelectedLeague(false);

    if (backgroundLoadAbortControllerRef.current) {
        backgroundLoadAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    backgroundLoadAbortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      const id = await getUserIdByUsername(username);
      if (signal.aborted) {
        return;
      }

      if (id) {
        setUserId(id);
        await getPlayersInfo();
        if (signal.aborted) {
          return;
        }

        const userLeagues = await getUserLeagues(id, season);
        if (signal.aborted) {
          return;
        }

        if (userLeagues && userLeagues.length > 0) {
          setLeagues(userLeagues);
          backgroundLoadRosters(userLeagues, id, signal);
        } else {
          setError("No leagues found for this season.");
        }
      } else {
        setError("User not found. Please check the username and try again.");
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error("[Submit] Error:", err);
        setError("An error occurred. Please try again later.");
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [username, season, validateSeason, backgroundLoadRosters]);

  useEffect(() => {
    if (selectedLeagueId && userId && leagues.length > 0) {
      setIsLoadingSelectedLeague(true);
      setError(null);
      setErroredLeagueId(null);
      
      if (backgroundLoadAbortControllerRef.current) {
        backgroundLoadAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      backgroundLoadAbortControllerRef.current = controller;
      const signal = controller.signal;

      const selectedLeague = leagues.find(l => l.league_id === selectedLeagueId);
      if (selectedLeague) {
        loadAcquisitionsForLeague(selectedLeague, userId, signal)
          .then(success => {
            if (!signal.aborted) {
              setIsLoadingSelectedLeague(false);
              if (success) {
                backgroundLoadOtherAcquisitions(leagues, selectedLeagueId, userId, signal);
              } else {
                setErroredLeagueId(selectedLeagueId);
                setError(`Failed to load full data for ${selectedLeague.name}. Roster might be incomplete or unavailable.`);
              }
            }
          });
      }
       return () => {
        if (backgroundLoadAbortControllerRef.current === controller) {
            controller.abort();
            backgroundLoadAbortControllerRef.current = null;
        } else {
            controller.abort();
        }
      };
    }
  }, [selectedLeagueId, userId, leagues, loadAcquisitionsForLeague, backgroundLoadOtherAcquisitions]);

  const handleGoToLeague = useCallback(async () => {
    if (!userId || !selectedLeagueId || erroredLeagueId === selectedLeagueId) {
      return;
    }
    
    setIsLoadingSelectedLeague(true);
    router.push(`/roster?userId=${userId}&username=${encodeURIComponent(username)}&leagueId=${selectedLeagueId}&season=${season}`);
  }, [userId, selectedLeagueId, season, username, router, erroredLeagueId]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">Sleeper Username</Label>
        <Input
          id="username"
          placeholder="Enter your Sleeper username"
          value={username}
          onChange={handleUsernameChange}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="season">NFL Season</Label>
        <Input
          id="season"
          placeholder={`Enter year (2017-${currentYear})`}
          value={season}
          onChange={handleSeasonChange}
          required
          disabled={isLoading}
          type="number"
          min={2017}
          max={currentYear}
        />
        {seasonError && (
          <div className="text-sm text-red-500 font-medium mt-1">{seasonError}</div>
        )}
      </div>

      {error && <div className="text-sm text-red-500 font-medium">{error}</div>}
      
      {leagues.length > 0 ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="league">Leagues</Label>
            <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId} disabled={isLoadingSelectedLeague || isLoading}>
              <SelectTrigger id="league" className="w-full">
                <SelectValue placeholder="Select a league..." />
              </SelectTrigger>
              <SelectContent>
                {leagues.map((league) => (
                  <SelectItem key={league.league_id} value={league.league_id}>
                    {league.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            type="button" 
            className="w-full" 
            disabled={!selectedLeagueId || isLoadingSelectedLeague || erroredLeagueId === selectedLeagueId}
            onClick={handleGoToLeague}
          >
            {isLoadingSelectedLeague ? (
              <div className="flex items-center justify-center">
                <Spinner />
                <span>Loading Roster Data...</span>
              </div>
            ) : (
              "View Roster"
            )}
          </Button>
        </>
      ) : (
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading || !!seasonError}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Spinner />
              <span>Finding Leagues...</span>
            </div>
          ) : (
            "Find Leagues"
          )}
        </Button>
      )}
    </form>
  );
});