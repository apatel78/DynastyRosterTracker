export interface SleeperUser {
  user_id: string;
  display_name: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string; 
  total_rosters: number;
  roster_positions: string[]; 
  previous_league_id: string | null;
  settings: {
    type?: number; 
    reserve_slots?: number;
    taxi_slots?: number;
    playoff_teams?: number;
    daily_waivers_hour?: number;
    waiver_budget?: number;
  };
}

export interface SleeperPlayer {
  player_id: string;
  name: string;
  full_name: string;
  position: string;
  team: string;
  avatar_url?: string;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
}

export interface SleeperDraftPick {
  player_id: string;
  picked_by: string;
  round: number;
  pick_no: number;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: string;
  status: string;
  roster_ids: number[];
  adds: { [playerId: string]: number };
  drops: { [playerId: string]: number };
  created: number;
  season?: string;
  league_id?: string;
  settings?: {
    waiver_bid?: number;
    seq?: number;
  };
}

export interface LeagueHistory {
  league_id: string;
  previousLeagueId?: string;
  season: string;
}
