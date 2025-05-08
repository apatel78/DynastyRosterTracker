"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLeagueDetails, getUserLeagues, getUserSeasons, getUserRoster } from '@/lib/api';
import { SleeperLeague } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';

interface LeagueInfoCardProps {
  userId: string;
  initialLeagueId: string;
  initialSeason: string;
  onLeagueOrSeasonChange?: (newLeagueId: string, newSeason: string) => void;
  username: string;
}

const formatRosterPositions = (positions: string[]): string => {
  if (!positions || positions.length === 0) {
    return 'N/A';
  }
  const modifiedPositions = positions.map(pos => pos === 'SUPER_FLEX' ? 'SFLEX' : pos);

  const counts: Record<string, number> = {};
  modifiedPositions.forEach(pos => {
    counts[pos] = (counts[pos] || 0) + 1;
  });
  return Object.entries(counts).map(([pos, count]) => count > 1 ? `${count} ${pos}` : pos).join(', ');
};

const getLeagueType = (league: SleeperLeague | null): string => {
  if (!league) {
    return 'N/A';
  }
  if (league.settings && typeof league.settings.type !== 'undefined') {
    if (league.settings.type === 2) {
      return 'Dynasty';
    }
    if (league.settings.type === 1) {
      return 'Keeper';
    }
    if (league.settings.type === 0) {
      return 'Redraft';
    }
  }
  if (league.previous_league_id) {
    return 'Dynasty'; 
  }
  return 'Redraft';
};

export default React.memo(function LeagueInfoCard({
  userId,
  initialLeagueId,
  initialSeason,
  onLeagueOrSeasonChange,
  username,
}: LeagueInfoCardProps) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(initialLeagueId);
  const [selectedSeason, setSelectedSeason] = useState<string>(initialSeason);
  
  const [currentLeagueDetails, setCurrentLeagueDetails] = useState<SleeperLeague | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableLeagues, setAvailableLeagues] = useState<SleeperLeague[]>([]);

  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isLoadingUserLeagues, setIsLoadingUserLeagues] = useState(true);
  const [isLoadingYears, setIsLoadingYears] = useState(true);
  const [isCheckingRoster, setIsCheckingRoster] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
        return;
    }
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchAllAvailableYears = async () => {
      setIsLoadingYears(true);
      try {
        const years = await getUserSeasons(userId);
        if (!signal.aborted) {
            setAvailableYears(years);
        }
      } catch (err) {
        if (!signal.aborted) {
            console.error("Error fetching all available years:", err);
        }
      } finally {
        if (!signal.aborted) {
            setIsLoadingYears(false);
        }
      }
    };
    
    fetchAllAvailableYears();
    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    if (!selectedLeagueId || !userId) {
        return;
    }
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchLeagueDetails = async () => {
      setIsLoadingDetails(true);
      setError(null);
      setRosterError(null);
      try {
        const details = await getLeagueDetails(selectedLeagueId);
        if (!signal.aborted) {
            setCurrentLeagueDetails(details);
            if (!details) {
                setError("Failed to load league details.");
            }
        }
      } catch (err) {
        if (!signal.aborted) {
            console.error("Error fetching league details:", err);
            setError("Could not load league information.");
        }
      } finally {
        if (!signal.aborted) {
            setIsLoadingDetails(false);
        }
      }
    };
    fetchLeagueDetails();
    return () => controller.abort();
  }, [selectedLeagueId, userId]);

  useEffect(() => {
    if (!selectedSeason || !userId) {
        return;
    }
    const controller = new AbortController();
    const signal = controller.signal;

    setIsLoadingUserLeagues(true);
    const fetchUserLeaguesForSeason = async () => {
      try {
        const leagues = await getUserLeagues(userId, selectedSeason);
        if (!signal.aborted) {
            const fetchedLeagues = leagues || [];
            setAvailableLeagues(fetchedLeagues);
        }
      } catch (err) {
        if (!signal.aborted) {
            console.error("Error fetching user's leagues for season:", err);
            setAvailableLeagues([]);
        }
      } finally {
        if (!signal.aborted) {
            setIsLoadingUserLeagues(false);
        }
      }
    };
    fetchUserLeaguesForSeason();
    return () => controller.abort();
  }, [selectedSeason, userId]);

  const handleYearChange = useCallback((newSeason: string) => {
    if (newSeason === selectedSeason) {
        return;
    }
    setSelectedSeason(newSeason);
    setRosterError(null);
    if (onLeagueOrSeasonChange) {
        onLeagueOrSeasonChange(selectedLeagueId, newSeason);
    }
  }, [selectedSeason, onLeagueOrSeasonChange, selectedLeagueId]);

  const handleLeagueChange = useCallback(async (newLeagueId: string) => {
    if (newLeagueId === selectedLeagueId) {
        return;
    }
    
    setError(null);
    setRosterError(null);
    setIsCheckingRoster(true);

    try {
      const details = await getLeagueDetails(newLeagueId);
      if (!details) {
        throw new Error(`No details returned for league ${newLeagueId}`);
      }
      
      const rosters = await getUserRoster(userId, newLeagueId, selectedSeason);
      const userRoster = rosters?.find(r => r.owner_id === userId);
      
      if (!userRoster || !userRoster.players || userRoster.players.length === 0) {
        setRosterError("This league has an empty roster. Please select a different league.");
        return;
      }

      setSelectedLeagueId(newLeagueId);
      if (onLeagueOrSeasonChange) {
        onLeagueOrSeasonChange(newLeagueId, selectedSeason);
      }
    } catch (err) {
      console.error(`Failed to validate/load details for league ${newLeagueId}:`, err);
      setError("Could not load details for the selected league. It might be invalid or inaccessible. Please try another.");
    } finally {
      setIsCheckingRoster(false);
    }
  }, [selectedLeagueId, userId, selectedSeason, onLeagueOrSeasonChange]);

  const leagueType = useMemo(() => getLeagueType(currentLeagueDetails), [currentLeagueDetails]);
  const numTeams = useMemo(() => currentLeagueDetails?.total_rosters || 'N/A', [currentLeagueDetails]);
  const starters = useMemo(() => formatRosterPositions(currentLeagueDetails?.roster_positions || []), [currentLeagueDetails]);
  const displayUsername = useMemo(() => username || 'N/A', [username]);

  if (isLoadingDetails && !currentLeagueDetails && !error && !rosterError) {
    return <div className="p-4 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md animate-pulse">Loading league info...</div>;
  }

  if (error) {
    return <div className="p-4 bg-white dark:bg-background rounded-lg border border-red-500 dark:border-red-700 shadow-md text-red-600">Error: {error}</div>;
  }

  if (!currentLeagueDetails && rosterError) {
     return <div className="p-4 bg-white dark:bg-background rounded-lg border border-red-500 dark:border-red-700 shadow-md text-red-600">Error: {rosterError}</div>;
  }

  if (!currentLeagueDetails && !isLoadingDetails) {
    return <div className="p-4 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md">No league details found or selected.</div>;
  }

  return (
    <div className="p-6 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md h-full flex flex-col">
      <div className="flex items-center mb-6">
        <Link href="/" passHref>
          <button aria-label="Go back to homepage" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 mr-4">
            <span className="h-6 w-6 text-gray-700 dark:text-gray-300 text-xl">←</span>
          </button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 text-center flex-grow">League Info</h2>
      </div>
      
      {isLoadingDetails && !currentLeagueDetails ? (
         <div className="p-4 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md animate-pulse">Loading league data...</div>
      ) : currentLeagueDetails ? (
        <>
          <div className="flex flex-col md:flex-row md:items-end md:space-x-4 mb-6">
            <div className="flex-1 min-w-0 mb-4 md:mb-0">
              <label htmlFor="league-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">League</label>
              <Select value={selectedLeagueId} onValueChange={handleLeagueChange} disabled={isLoadingUserLeagues || isLoadingDetails || isCheckingRoster}>
                <SelectTrigger id="league-select" className="w-full h-10">
                  <SelectValue placeholder="Select league..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLeagues.map(league => (
                    <SelectItem key={league.league_id} value={league.league_id}>
                      {league.name} ({league.season})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rosterError && (
                <div className="text-sm text-red-500 font-medium mt-1">{rosterError}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="year-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Season</label>
              <Select value={selectedSeason} onValueChange={handleYearChange} disabled={isLoadingYears}>
                <SelectTrigger id="year-select" className="w-full h-10">
                  <SelectValue placeholder="Select year..." />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 flex-grow">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">League Type</p>
              <p className="text-lg text-gray-800 dark:text-gray-200">{leagueType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</p>
              <p className="text-lg text-gray-800 dark:text-gray-200">{displayUsername}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Teams</p>
              <p className="text-lg text-gray-800 dark:text-gray-200">{numTeams}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Roster (Starters)</p>
              <p className="text-lg text-gray-800 dark:text-gray-200">{starters}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Please select a league and season.</div>
      )}
    </div>
  );
});
