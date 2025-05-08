"use client"

import React, { useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"
import PlayerTable, { PlayerRow } from "@/components/player-table"
import SummaryCard from "@/components/summary-card"
import LeagueInfoCard from "@/components/league-info-card"

function RosterPageClient() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const userId = searchParams.get("userId");
    const username = searchParams.get("username");
    const leagueId = searchParams.get("leagueId");
    const season = searchParams.get("season");

    const [players, setPlayers] = useState<PlayerRow[]>([]);

    const handlePlayersLoaded = useCallback((loadedPlayers: PlayerRow[]) => {
      setPlayers(loadedPlayers);
    }, [setPlayers]);

    const handleLeagueOrSeasonChange = useCallback((newLeagueId: string, newSeason: string) => {
        const encodedUsername = encodeURIComponent(username || '');
        if (userId) {
            router.push(`/roster?userId=${userId}&username=${encodedUsername}&leagueId=${newLeagueId}&season=${newSeason}`);
        }
    }, [router, userId, username]);

    if (!userId || !leagueId || !season || !username) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
                <p className="mb-6">Please return to the home page and try again.</p>
              </div>
            </div>
          )
    }

    const tableKey = `${leagueId}-${season}`;

    return (
        <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
            <div className="w-full max-w-7xl space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-full min-h-[250px]"> 
                        <LeagueInfoCard 
                            userId={userId} 
                            initialLeagueId={leagueId} 
                            initialSeason={season}
                            onLeagueOrSeasonChange={handleLeagueOrSeasonChange}
                            username={username}
                        />
                    </div>
                    <div className="h-full min-h-[250px]"> 
                        {players.length > 0 ? (
                             <SummaryCard players={players} />
                        ) : (
                            <div className="p-6 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md h-full flex items-center justify-center">
                                <p className="text-gray-500 dark:text-gray-400">Summary will load after players.</p>
                            </div>
                        )}
                       
                    </div>
                </div>

                <div>
                    <PlayerTable 
                        key={tableKey}
                        userId={userId} 
                        leagueId={leagueId} 
                        season={season} 
                        onPlayersLoaded={handlePlayersLoaded}
                    />
                </div>
            </div>
        </main>
    );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<RosterLoadingFallback />}>
      <RosterPageClient />
    </Suspense>
  );
}

function RosterLoadingFallback() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
            <div className="animate-spin h-10 w-10 border-4 border-primary rounded-full border-t-transparent"></div>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading Roster...</p>
        </main>
    );
}