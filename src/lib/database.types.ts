/**
 * Temporary strict Database types for the 21 Blaze online schema.
 *
 * Generate authoritative types after the project is linked:
 *   npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OnlineMatchStatus = 'active' | 'completed' | 'abandoned' | 'rejected';

export type VerifiedGameOverReason = 'timeExpired' | 'busts' | 'deckEmpty';

export type LiveMatchStatus =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'awaiting_results'
  | 'completed'
  | 'cancelled'
  | 'forfeited'
  | 'expired';

export type LivePlayerResult =
  | 'pending'
  | 'win'
  | 'loss'
  | 'draw'
  | 'forfeit_win'
  | 'forfeit_loss';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_seed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_seed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_seed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      online_matches: {
        Row: {
          id: string;
          user_id: string;
          seed: number;
          status: OnlineMatchStatus;
          started_at: string;
          expires_at: string;
          completed_at: string | null;
          client_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          seed: number;
          status?: OnlineMatchStatus;
          started_at: string;
          expires_at: string;
          completed_at?: string | null;
          client_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          seed?: number;
          status?: OnlineMatchStatus;
          started_at?: string;
          expires_at?: string;
          completed_at?: string | null;
          client_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      verified_scores: {
        Row: {
          id: string;
          match_id: string;
          user_id: string;
          score: number;
          lanes_cleared: number;
          cards_played: number;
          busts: number;
          time_remaining_seconds: number;
          game_over_reason: VerifiedGameOverReason;
          move_log: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          user_id: string;
          score: number;
          lanes_cleared: number;
          cards_played: number;
          busts: number;
          time_remaining_seconds: number;
          game_over_reason: VerifiedGameOverReason;
          move_log: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          user_id?: string;
          score?: number;
          lanes_cleared?: number;
          cards_played?: number;
          busts?: number;
          time_remaining_seconds?: number;
          game_over_reason?: VerifiedGameOverReason;
          move_log?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      live_matches: {
        Row: {
          id: string;
          room_code: string;
          mode: string;
          status: LiveMatchStatus;
          seed: number;
          host_user_id: string;
          starts_at: string | null;
          ends_at: string | null;
          expires_at: string;
          winner_user_id: string | null;
          finish_reason: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          room_code: string;
          mode?: string;
          status: LiveMatchStatus;
          seed: number;
          host_user_id: string;
          starts_at?: string | null;
          ends_at?: string | null;
          expires_at: string;
          winner_user_id?: string | null;
          finish_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          room_code?: string;
          mode?: string;
          status?: LiveMatchStatus;
          seed?: number;
          host_user_id?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          expires_at?: string;
          winner_user_id?: string | null;
          finish_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      live_match_players: {
        Row: {
          match_id: string;
          user_id: string;
          seat: number;
          ready_at: string | null;
          joined_at: string;
          last_seen_at: string | null;
          disconnected_at: string | null;
          submitted_at: string | null;
          verified_score: number | null;
          verified_lanes_cleared: number | null;
          verified_cards_played: number | null;
          verified_busts: number | null;
          verified_time_remaining_seconds: number | null;
          verified_move_log: Json | null;
          result: LivePlayerResult;
        };
        Insert: {
          match_id: string;
          user_id: string;
          seat: number;
          ready_at?: string | null;
          joined_at?: string;
          last_seen_at?: string | null;
          disconnected_at?: string | null;
          submitted_at?: string | null;
          verified_score?: number | null;
          verified_lanes_cleared?: number | null;
          verified_cards_played?: number | null;
          verified_busts?: number | null;
          verified_time_remaining_seconds?: number | null;
          verified_move_log?: Json | null;
          result?: LivePlayerResult;
        };
        Update: {
          match_id?: string;
          user_id?: string;
          seat?: number;
          ready_at?: string | null;
          joined_at?: string;
          last_seen_at?: string | null;
          disconnected_at?: string | null;
          submitted_at?: string | null;
          verified_score?: number | null;
          verified_lanes_cleared?: number | null;
          verified_cards_played?: number | null;
          verified_busts?: number | null;
          verified_time_remaining_seconds?: number | null;
          verified_move_log?: Json | null;
          result?: LivePlayerResult;
        };
        Relationships: [];
      };
    };
    Views: {
      global_leaderboard: {
        Row: {
          user_id: string;
          display_name: string;
          score: number;
          lanes_cleared: number;
          cards_played: number;
          busts: number;
          time_remaining_seconds: number;
          game_over_reason: VerifiedGameOverReason;
          created_at: string;
          rank: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type ProfileRow = Tables<'profiles'>;
export type GlobalLeaderboardRow = Database['public']['Views']['global_leaderboard']['Row'];
