import React, { useMemo } from 'react';
import { PlayerRow } from './player-table';

const ACQUISITION_COLORS: Record<string, string> = {
  "Startup Draft": "text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-950/30",
  "Rookie Draft": "text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-950/30",
  "Trade": "text-purple-800 bg-purple-100 dark:text-purple-200 dark:bg-purple-950/30",
  "Free Agency": "text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-950/30",
  "Waiver Wire": "text-gray-800 bg-gray-100 dark:text-gray-200 dark:bg-gray-800/50",
  "Previous Owner": "text-orange-800 bg-orange-100 dark:text-orange-200 dark:bg-orange-950/30",
  "Unknown": "text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800/50",
};

const BORDER_COLORS: Record<string, string> = {
  "Startup Draft": "border-blue-300 dark:border-blue-500",
  "Rookie Draft": "border-yellow-300 dark:border-yellow-500",
  "Trade": "border-purple-300 dark:border-purple-500",
  "Free Agency": "border-green-300 dark:border-green-500",
  "Waiver Wire": "border-gray-300 dark:border-gray-500",
  "Previous Owner": "border-orange-300 dark:border-orange-500",
  "Unknown": "border-gray-200 dark:border-gray-600",
};

interface SummaryCardProps {
  players: PlayerRow[];
}

const summaryDisplayOrder: { type: string; label: string; id: string }[] = [
  { id: "startup", type: "Startup Draft", label: "Startup Draft" },
  { id: "rookie", type: "Rookie Draft", label: "Rookie Draft" },
  { id: "trade", type: "Trade", label: "Traded" },
  { id: "waiver", type: "Waiver Wire", label: "Waivers" },
  { id: "fa", type: "Free Agency", label: "Free Agent" },
  { id: "prevOwner", type: "Previous Owner", label: "Previous Owner" },
];

export default React.memo(function SummaryCard({ players }: SummaryCardProps) {
  const acquisitionCounts = useMemo(() => {
    return players.reduce(
      (counts, player) => {
        const type = player.acquisitionType;
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );
  }, [players]);

  const totalDrafted = useMemo(() => {
    return (acquisitionCounts["Startup Draft"] || 0) + 
           (acquisitionCounts["Rookie Draft"] || 0);
  }, [acquisitionCounts]);

  const hasStartupDraftPlayers = useMemo(() => {
    return acquisitionCounts["Startup Draft"] && acquisitionCounts["Startup Draft"] > 0;
  }, [acquisitionCounts]);

  return (
    <div className="p-6 bg-white dark:bg-background rounded-lg border dark:border-border shadow-md h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 text-center">Summary</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-grow">
        {summaryDisplayOrder.map(({ type, label, id }) => {
          if (type === "Startup Draft" && !hasStartupDraftPlayers) {
            return null;
          }
          if (type === "Previous Owner" && hasStartupDraftPlayers) {
            return null;
          }
          
          const count = acquisitionCounts[type] || 0;


          return (
            <div 
              key={id} 
              className={`p-3 md:p-4 rounded-lg flex flex-col items-center justify-center border transition-all duration-150 hover:shadow-lg hover:scale-105 
                ${BORDER_COLORS[type] || BORDER_COLORS.Unknown} 
                ${ACQUISITION_COLORS[type] || ACQUISITION_COLORS.Unknown}`}
            >
              <span className="text-2xl md:text-3xl font-bold">{count}</span>
              <span className="text-xs md:text-sm font-medium text-center">{label}</span>
            </div>
          );
        })}

        <div 
          className={`p-3 md:p-4 rounded-lg flex flex-col items-center justify-center border transition-all duration-150 hover:shadow-lg hover:scale-105 
            border-indigo-300 dark:border-indigo-500 
            text-indigo-800 bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-950/30`}
        >
          <span className="text-2xl md:text-3xl font-bold">{totalDrafted}</span>
          <span className="text-xs md:text-sm font-medium text-center">Total Drafted</span>
        </div>
      </div>
    </div>
  );
});
