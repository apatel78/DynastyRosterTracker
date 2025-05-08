"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useCallback } from "react"
import PlayerTable, { PlayerRow } from "@/components/player-table"
import SummaryCard from "@/components/summary-card"
import LeagueInfoCard from "@/components/league-info-card"

export default function RosterPage() {

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
      router.push(`/roster?userId=${userId}&username=${encodeURIComponent(username || '')}&leagueId=${newLeagueId}&season=${newSeason}`);
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

    return (
        <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
        <div className="w-full max-w-7xl">
          {players.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="h-full">
                <LeagueInfoCard 
                  userId={userId} 
                  initialLeagueId={leagueId} 
                  initialSeason={season}
                  onLeagueOrSeasonChange={handleLeagueOrSeasonChange}
                  username={username}
                />
              </div>
              <div className="h-full">
                <SummaryCard players={players} />
              </div>
            </div>
          )}
          
          <PlayerTable 
            key={`${leagueId}-${season}`}
            userId={userId} 
            leagueId={leagueId} 
            season={season} 
            onPlayersLoaded={handlePlayersLoaded}
          />
        </div>
      </main>
    )
}