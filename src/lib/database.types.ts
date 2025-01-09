export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      channels: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
          is_private: boolean
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
          is_private?: boolean
          created_by: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
          is_private?: boolean
          created_by?: string
        }
      }
      messages: {
        Row: {
          id: string
          created_at: string
          content: string
          user_id: string
          channel_id: string
          parent_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          content: string
          user_id: string
          channel_id: string
          parent_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          content?: string
          user_id?: string
          channel_id?: string
          parent_id?: string | null
        }
      }
      reactions: {
        Row: {
          id: string
          created_at: string
          emoji: string
          user_id: string
          message_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          emoji: string
          user_id: string
          message_id: string
        }
        Update: {
          id?: string
          created_at?: string
          emoji?: string
          user_id?: string
          message_id?: string
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          username: string
          full_name: string
          avatar_url: string | null
          status: string | null
        }
        Insert: {
          id: string
          created_at?: string
          username: string
          full_name: string
          avatar_url?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          username?: string
          full_name?: string
          avatar_url?: string | null
          status?: string | null
        }
      }
      user_channels: {
        Row: {
          user_id: string
          channel_id: string
          role: string
          created_at: string
        }
        Insert: {
          user_id: string
          channel_id: string
          role?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          channel_id?: string
          role?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 