export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ExerciseType = 'push_ups' | 'squats';
export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendChallengeRpcRow {
  participant_id: string;
  challenge_id: string;
  exercise_type: ExerciseType;
  target_reps: number;
  xp_reward: number;
  message: string | null;
  time_limit_seconds: number | null;
  deadline_at: string | null;
  status: ChallengeStatus;
  completed_reps: number;
  completed_at: string | null;
  started_at: string | null;
  xp_earned: number | null;
  created_at: string;
  creator_id: string;
  creator_username: string;
  creator_display_name: string | null;
  is_creator: boolean;
  opponent_id: string;
  opponent_username: string;
  opponent_display_name: string | null;
  opponent_status: ChallengeStatus;
  opponent_completed_reps: number;
  opponent_completed_at: string | null;
  opponent_started_at: string | null;
  winner_user_id: string | null;
  resolved_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          total_xp: number;
          level: number;
          current_streak: number;
          longest_streak: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_xp?: number;
          level?: number;
          current_streak?: number;
          longest_streak?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_xp?: number;
          level?: number;
          current_streak?: number;
          longest_streak?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_challenges: {
        Row: {
          id: string;
          user_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps: number;
          xp_reward: number;
          challenge_date: string;
          status: ChallengeStatus;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps?: number;
          xp_reward: number;
          challenge_date: string;
          status?: ChallengeStatus;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_type?: ExerciseType;
          target_reps?: number;
          completed_reps?: number;
          xp_reward?: number;
          challenge_date?: string;
          status?: ChallengeStatus;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_challenges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendshipStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      friend_challenges: {
        Row: {
          id: string;
          creator_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          message: string | null;
          time_limit_seconds: number | null;
          deadline_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          message?: string | null;
          time_limit_seconds?: number | null;
          deadline_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          exercise_type?: ExerciseType;
          target_reps?: number;
          xp_reward?: number;
          message?: string | null;
          time_limit_seconds?: number | null;
          deadline_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      friend_challenge_participants: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          status: ChallengeStatus;
          completed_reps: number;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          user_id: string;
          status?: ChallengeStatus;
          completed_reps?: number;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          user_id?: string;
          status?: ChallengeStatus;
          completed_reps?: number;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_or_create_daily_challenge: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['daily_challenges']['Row'];
      };
      start_challenge: {
        Args: {
          p_challenge_id: string;
        };
        Returns: Database['public']['Tables']['daily_challenges']['Row'];
      };
      complete_challenge: {
        Args: {
          p_challenge_id: string;
          p_completed_reps: number;
        };
        Returns: Database['public']['Tables']['daily_challenges']['Row'];
      };
      search_users_by_username: {
        Args: { p_query: string };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
        }[];
      };
      send_friend_request: {
        Args: { p_username: string };
        Returns: Database['public']['Tables']['friendships']['Row'];
      };
      respond_friend_request: {
        Args: { p_friendship_id: string; p_accept: boolean };
        Returns: Database['public']['Tables']['friendships']['Row'];
      };
      get_friends_list: {
        Args: Record<string, never>;
        Returns: {
          friendship_id: string;
          friend_id: string;
          username: string;
          display_name: string | null;
          level: number;
          current_streak: number;
        }[];
      };
      get_incoming_friend_requests: {
        Args: Record<string, never>;
        Returns: {
          friendship_id: string;
          requester_id: string;
          username: string;
          display_name: string | null;
          created_at: string;
        }[];
      };
      create_friend_challenge: {
        Args: {
          p_friend_id: string;
          p_exercise: ExerciseType;
          p_target_reps: number;
          p_message?: string | null;
          p_time_limit_seconds?: number | null;
        };
        Returns: string;
      };
      get_my_friend_challenges: {
        Args: Record<string, never>;
        Returns: FriendChallengeRpcRow[];
      };
      get_friend_challenge_detail: {
        Args: { p_participant_id: string };
        Returns: FriendChallengeRpcRow[];
      };
      accept_friend_challenge: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      decline_friend_challenge: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      start_friend_challenge: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      complete_friend_challenge: {
        Args: { p_participant_id: string; p_completed_reps: number };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      get_challenge_history: {
        Args: { p_limit?: number };
        Returns: {
          entry_id: string;
          kind: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps: number;
          xp_reward: number;
          status: ChallengeStatus;
          result_at: string;
          opponent_username: string | null;
          opponent_display_name: string | null;
          opponent_completed_reps: number | null;
          opponent_status: ChallengeStatus | null;
          race_seconds: number | null;
          opponent_race_seconds: number | null;
          winner_user_id: string | null;
          xp_earned: number | null;
        }[];
      };
    };
    Enums: {
      exercise_type: ExerciseType;
      challenge_status: ChallengeStatus;
      friendship_status: FriendshipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
