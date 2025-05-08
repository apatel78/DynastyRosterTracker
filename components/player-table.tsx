import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { getUserRoster, getPlayersInfo, getPlayerAcquisitions } from "@/lib/api";
import * as NFLIcons from "react-nfl-logos";
import type { SleeperRoster } from "@/lib/types";

export type PlayerRow = {
  id: string;
  name: string;
  avatarUrl?: string;
  position: string;
  team: string;
  acquisitionType: string;
  acquisitionDetails: string;
  acquisitionDate?: string;
};

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-800",
  RB: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800",
  WR: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800",
  TE: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-200 dark:border-yellow-800",
  DEF: "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600",
  K: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-800",
  SFLEX: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-200 dark:border-pink-800",
};

const ACQUISITION_COLORS: Record<string, string> = {
  "Startup Draft": "border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-500 dark:text-blue-200 dark:bg-blue-950/30",
  "Rookie Draft": "border-yellow-300 text-yellow-700 bg-yellow-50 dark:border-yellow-500 dark:text-yellow-200 dark:bg-yellow-950/30",
  "Trade": "border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-500 dark:text-purple-200 dark:bg-purple-950/30",
  "Free Agency": "border-green-300 text-green-700 bg-green-50 dark:border-green-500 dark:text-green-200 dark:bg-green-950/30",
  "Waiver Wire": "border-gray-300 text-gray-700 bg-gray-50 dark:border-gray-500 dark:text-gray-200 dark:bg-gray-800/50",
  "Previous Owner": "border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-500 dark:text-orange-200 dark:bg-orange-950/30",
  "Unknown": "border-gray-200 text-gray-400 bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800/50",
};

const TEAM_NAME_CORRECTIONS: Record<string, string> = {
  JAC: 'JAX', WSH: 'WAS', STL: 'LAR', SD: 'LAC', OAK: 'LV', ARZ: 'ARI', CLV: 'CLE'
};

const renderTeamLogo = (team: string, size = 40) => {
  const displayTeam = TEAM_NAME_CORRECTIONS[team] || team;
  
  switch (displayTeam) {
    case 'ARI': return <NFLIcons.ARI size={size} />;
    case 'ATL': return <NFLIcons.ATL size={size} />;
    case 'BAL': return <NFLIcons.BAL size={size} />;
    case 'BUF': return <NFLIcons.BUF size={size} />;
    case 'CAR': return <NFLIcons.CAR size={size} />;
    case 'CHI': return <NFLIcons.CHI size={size} />;
    case 'CIN': return <NFLIcons.CIN size={size} />;
    case 'CLE': return <NFLIcons.CLE size={size} />;
    case 'DAL': return <NFLIcons.DAL size={size} />;
    case 'DEN': return <NFLIcons.DEN size={size} />;
    case 'DET': return <NFLIcons.DET size={size} />;
    case 'GB': return <NFLIcons.GB size={size} />;
    case 'HOU': return <NFLIcons.HOU size={size} />;
    case 'IND': return <NFLIcons.IND size={size} />;
    case 'JAX': return <NFLIcons.JAX size={size} />;
    case 'KC': return <NFLIcons.KC size={size} />;
    case 'LAC': return <NFLIcons.LAC size={size} />;
    case 'LAR': return <NFLIcons.LAR size={size} />;
    case 'LV': return <NFLIcons.LV size={size} />;
    case 'MIA': return <NFLIcons.MIA size={size} />;
    case 'MIN': return <NFLIcons.MIN size={size} />;
    case 'NE': return <NFLIcons.NE size={size} />;
    case 'NO': return <NFLIcons.NO size={size} />;
    case 'NYG': return <NFLIcons.NYG size={size} />;
    case 'NYJ': return <NFLIcons.NYJ size={size} />;
    case 'PHI': return <NFLIcons.PHI size={size} />;
    case 'PIT': return <NFLIcons.PIT size={size} />;
    case 'SEA': return <NFLIcons.SEA size={size} />;
    case 'SF': return <NFLIcons.SF size={size} />;
    case 'TEN': return <Image src="/TEN.svg" alt="Tennessee Titans" width={size + 20} height={size + 20} />;
    case 'TB': return <NFLIcons.TB size={size} />;
    case 'WAS': return <Image src="/WAS.svg" alt="Washington Football Team" width={size - 4} height={size - 4} />;
    default: return <NFLIcons.NFL size={size} />;
  }
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

type SortKey = "name" | "team" | "position" | "acquisitionType";
type SortState = {
  key: SortKey | null;
  asc: boolean;
};

interface PlayerTableProps {
  userId: string;
  leagueId: string;
  season: string;
  onPlayersLoaded?: (players: PlayerRow[]) => void;
}

const POSITION_ORDER: Record<string, number> = {
  'QB': 1,
  'RB': 2,
  'WR': 3,
  'TE': 4,
  'K': 5,
  'DEF': 6,
};

const Spinner = () => (
  <div className="animate-spin mr-2 h-5 w-5 border-2 border-gray-300 rounded-full border-t-primary"></div>
);

export default React.memo(function PlayerTable({ userId, leagueId, season, onPlayersLoaded }: PlayerTableProps) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  
  const [isFetchingTableData, setIsFetchingTableData] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  
  const [sort, setSort] = useState<SortState>({ key: "name", asc: true });

  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const fetchPlayerData = useCallback(async (signal: AbortSignal) => {
    if (signal.aborted) {
      return;
    }
    setIsFetchingTableData(true);
    setError(null);

    try {
      if (signal.aborted) {
        return;
      }
      if (!userId || !leagueId || !season) {
        setError(`Missing required parameters: userId=${userId}, leagueId=${leagueId}, season=${season}`);
        if (!signal.aborted) {
            setIsFetchingTableData(false);
        }
        if (onPlayersLoaded) {
            onPlayersLoaded([]);
        }
        return;
      }
      
      const rosters = await getUserRoster(userId, leagueId, season);
      if (signal.aborted) {
        return;
      }

      if (!rosters) {
        setError("Could not fetch roster data");
        if (!signal.aborted) {
            setIsFetchingTableData(false);
        }
        if (onPlayersLoaded) {
            onPlayersLoaded([]);
        }
        return;
      }
      
      const userRoster = rosters.find((roster: SleeperRoster) => roster.owner_id === userId);
      if (!userRoster || !userRoster.players || userRoster.players.length === 0) {
        setError("No players found in roster");
        setPlayers([]);
        if (!signal.aborted) {
            setIsFetchingTableData(false);
        }
        if (onPlayersLoaded) {
            onPlayersLoaded([]);
        }
        return;
      }

      const playersInfo = await getPlayersInfo();
      if (signal.aborted) {
        return;
      }
      if (!playersInfo) {
        setError("Could not fetch players info data");
        if (!signal.aborted) {
            setIsFetchingTableData(false);
        }
        if (onPlayersLoaded) {
            onPlayersLoaded([]);
        }
        return;
      }

      const acquisitionsData = await getPlayerAcquisitions(leagueId, userId, userRoster);
      if (signal.aborted) {
        return;
      }
      if (!acquisitionsData) {
        setError("Could not fetch player acquisitions data");
        if (!signal.aborted) {
            setIsFetchingTableData(false);
        }
        if (onPlayersLoaded) {
            onPlayersLoaded([]);
        }
        return;
      }
      
      const mappedPlayers: PlayerRow[] = [];
      for (const playerId of userRoster.players) {
        if (signal.aborted) {
          return;
        }
        const playerInfo = playersInfo[playerId];
        const acquisition = acquisitionsData[playerId] || { type: "Unknown", details: "", timestamp: undefined };
        
        if (playerInfo) {
          mappedPlayers.push({
            id: playerId,
            name: playerInfo.full_name || "Unknown Player",
            avatarUrl: playerInfo.avatar_url || '',
            position: playerInfo.position || "N/A",
            team: playerInfo.team || "NFL",
            acquisitionType: acquisition.type,
            acquisitionDetails: acquisition.details,
            acquisitionDate: acquisition.timestamp ? new Date(acquisition.timestamp).toISOString() : undefined
          });
        }
      }
      
      if (!signal.aborted) {
        setPlayers(mappedPlayers);
        if (onPlayersLoaded) {
          onPlayersLoaded(mappedPlayers);
        }
      }
    } catch (err) {
      if (!signal.aborted) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
        setPlayers([]);
        if (onPlayersLoaded) {
          onPlayersLoaded([]);
        }
      }
    } finally {
      if (!signal.aborted) {
        setIsFetchingTableData(false);
      }
    }
  }, [userId, leagueId, season, onPlayersLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    fetchPlayerData(signal);

    return () => {
      controller.abort();
    };
  }, [fetchPlayerData]);

  const handleImageError = useCallback((playerId: string) => {
    setFailedImages((prev) => new Set(prev).add(playerId));
  }, []);

  const sortedPlayers = useMemo(() => {
    if (!sort.key) {
        return players;
    }

    const getSortableValue = (player: PlayerRow, key: SortKey): string | number => {
      if (key === "position") {
        return POSITION_ORDER[player.position] || 99;
      }
      if (key === "acquisitionType") {
        const order = ["Startup Draft", "Rookie Draft", "Trade", "Free Agency", "Waiver Wire", "Previous Owner", "Unknown"];
        const index = order.indexOf(player.acquisitionType);
        return index !== -1 ? index : Infinity;
      }
      return player[key];
    };

    const sorted = [...players].sort((a, b) => {
      const valA = getSortableValue(a, sort.key!);
      const valB = getSortableValue(b, sort.key!);

      if (sort.key === "acquisitionType") {
        if (valA === Infinity && valB !== Infinity) return 1;
        if (valA !== Infinity && valB === Infinity) return -1;
        if (valA === Infinity && valB === Infinity) { 
            const strA = a.acquisitionType;
            const strB = b.acquisitionType;
            return sort.asc ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return sort.asc ? valA - valB : valB - valA;
      }
      return 0;
    });
    return sorted;
  }, [players, sort]);

  if (isFetchingTableData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md min-h-[300px]">
        <Spinner />
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading player data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-background rounded-lg border border-red-500 dark:border-red-700 shadow-md min-h-[300px]">
        <p className="text-lg text-red-600 dark:text-red-400">Error: {error}</p>
        <button 
          onClick={() => {
            const retryController = new AbortController();
            fetchPlayerData(retryController.signal);
          }} 
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }
  
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md min-h-[300px]">
        <p className="text-lg text-gray-600 dark:text-gray-400">No players found in this roster or league.</p>
      </div>
    );
  }

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: true }
    );
  }

  const headerCellClass =
    "text-left font-semibold cursor-pointer select-none border-b border-r border-gray-300/70 bg-gray-100/90 dark:bg-background dark:border-border px-3 py-3 h-14 align-middle whitespace-nowrap";

  const centeredHeaderCellClass = 
    "text-center font-semibold cursor-pointer select-none border-b border-r border-gray-300/70 bg-gray-100/90 dark:bg-background dark:border-border px-3 py-3 h-14 align-middle whitespace-nowrap";

  const staticHeaderClass =
    "text-left font-semibold select-none border-b border-r border-gray-300/70 bg-gray-100/90 dark:bg-background dark:border-border px-3 py-3 h-14 align-middle whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-background dark:border-border">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th
              className={headerCellClass}
              style={{ minWidth: 180, maxWidth: 240 }}
              onClick={() => handleSort("name")}
            >
              Player Name
              {sort.key === "name" && (sort.asc ? " ▲" : " ▼")}
            </th>
            <th
              className={centeredHeaderCellClass}
              style={{ minWidth: 100 }}
              onClick={() => handleSort("position")}
            >
              Position
              {sort.key === "position" && (sort.asc ? " ▲" : " ▼")}
            </th>
            <th
              className={centeredHeaderCellClass}
              style={{ minWidth: 100 }}
              onClick={() => handleSort("team")}
            >
              Team
              {sort.key === "team" && (sort.asc ? " ▲" : " ▼")}
            </th>
            <th
              className={centeredHeaderCellClass}
              style={{ minWidth: 120 }}
              onClick={() => handleSort("acquisitionType")}
            >
              Acquisition
              {sort.key === "acquisitionType" && (sort.asc ? " ▲" : " ▼")}
            </th>
            <th className={staticHeaderClass + " border-r-0"} style={{ minWidth: 200 }}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center p-6 text-gray-400 dark:text-gray-500">
              </td>
            </tr>
          )}
          {sortedPlayers.map((player) => (
            <tr key={player.id} className="border-b hover:bg-gray-50 dark:border-border dark:hover:bg-gray-800/10">
              <td className="flex items-center gap-3 p-3 border-b border-r border-gray-300/50 dark:border-border">
                {player.avatarUrl && !failedImages.has(player.id) ? (
                  <Image
                    src={player.avatarUrl}
                    alt={player.name}
                    className="w-10 h-10 rounded-full object-cover border dark:border-gray-700"
                    width={40}
                    height={40}
                    unoptimized
                    onError={() => {
                      handleImageError(player.id);
                    }}
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-xs border dark:border-gray-700">
                    {getInitials(player.name)}
                  </span>
                )}
                <span className="font-medium">{player.name}</span>
              </td>
              <td className="text-center border-b border-r border-gray-300/50 dark:border-border">
                <div className="flex justify-center">
                <span
                    className={`inline-flex justify-center items-center w-10 px-2 py-1 rounded text-xs font-semibold border ${
                      POSITION_COLORS[player.position] || "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                  }`}
                >
                  {player.position}
                </span>
                </div>
              </td>
              <td className="text-center border-b border-r border-gray-300/50 dark:border-border">
                <div className="flex justify-center">
                  {renderTeamLogo(player.team)}
                </div>
              </td>
              <td className="text-center border-b border-r border-gray-300/50 dark:border-border">
                <div className="flex justify-center">
                <span
                    className={`inline-flex justify-center items-center w-18 px-2 py-1 rounded text-xs font-semibold border ${
                    ACQUISITION_COLORS[player.acquisitionType] || ACQUISITION_COLORS.Unknown
                  }`}
                >
                  {player.acquisitionType}
                </span>
                </div>
              </td>
              <td className="max-w-xs border-b border-gray-300/50 dark:border-border px-3 py-2">
                {player.acquisitionDetails}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}); 