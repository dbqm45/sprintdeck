
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "decision_notes": {
                  Row: {
                    "author_id": string | null,"content": string,"created_at": string,"id": string,"item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"content": string,"created_at"?: string,"id"?: string,"item_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "decision_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decision_notes_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "created_at": string,"description": string | null,"final_estimate": string | null,"finalized_at": string | null,"finalized_by": string | null,"id": string,"position": number,"room_id": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"final_estimate"?: string | null,"finalized_at"?: string | null,"finalized_by"?: string | null,"id"?: string,"position": number,"room_id": string,"status"?: string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"final_estimate"?: string | null,"finalized_at"?: string | null,"finalized_by"?: string | null,"id"?: string,"position"?: number,"room_id"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_finalized_by_fkey"
      columns: ["finalized_by"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"participants": {
                  Row: {
                    "display_name": string,"id": string,"joined_at": string,"last_seen_at": string,"role": string,"room_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"id"?: string,"joined_at"?: string,"last_seen_at"?: string,"role": string,"room_id": string,"user_id": string
                  }
                  Update: {
                    "display_name"?: string,"id"?: string,"joined_at"?: string,"last_seen_at"?: string,"role"?: string,"room_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "participants_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "created_at": string,"current_item_id": string | null,"deck": string,"host_secret_hash": string,"id": string,"last_activity_at": string,"owner_id": string,"slug": string,"status": string,"title": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_item_id"?: string | null,"deck"?: string,"host_secret_hash": string,"id"?: string,"last_activity_at"?: string,"owner_id": string,"slug": string,"status"?: string,"title": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"current_item_id"?: string | null,"deck"?: string,"host_secret_hash"?: string,"id"?: string,"last_activity_at"?: string,"owner_id"?: string,"slug"?: string,"status"?: string,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_current_item_id_fkey"
      columns: ["current_item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"rounds": {
                  Row: {
                    "id": string,"item_id": string,"number": number,"revealed_at": string | null,"room_id": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_id": string,"number": number,"revealed_at"?: string | null,"room_id": string,"started_at"?: string,"status": string
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"number"?: number,"revealed_at"?: string | null,"room_id"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rounds_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rounds_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"votes": {
                  Row: {
                    "created_at": string,"id": string,"participant_id": string,"round_id": string,"updated_at": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"participant_id": string,"round_id": string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"participant_id"?: string,"round_id"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "votes_participant_id_fkey"
      columns: ["participant_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "votes_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_item":
{ Args: { "p_description"?: string,"p_room_id": string,"p_title": string }; Returns: string
                           },
"cast_vote":
{ Args: { "p_round_id": string,"p_value": string }; Returns: undefined
                           },
"claim_host":
{ Args: { "p_host_secret": string,"p_slug": string }; Returns: undefined
                           },
"clear_vote":
{ Args: { "p_round_id": string }; Returns: undefined
                           },
"close_room":
{ Args: { "p_room_id": string }; Returns: undefined
                           },
"create_room":
{ Args: { "p_deck"?: string,"p_display_name": string,"p_title": string }; Returns: Json
                           },
"finalize_item":
{ Args: { "p_estimate": string,"p_item_id": string,"p_note"?: string }; Returns: undefined
                           },
"get_room_preview":
{ Args: { "p_slug": string }; Returns: Json
                           },
"get_room_state":
{ Args: { "p_slug": string }; Returns: Json
                           },
"join_room":
{ Args: { "p_display_name": string,"p_role"?: string,"p_slug": string }; Returns: Json
                           },
"reorder_items":
{ Args: { "p_item_ids": (string)[],"p_room_id": string }; Returns: undefined
                           },
"reveal_round":
{ Args: { "p_round_id": string }; Returns: undefined
                           },
"set_current_item":
{ Args: { "p_item_id": string }; Returns: undefined
                           },
"set_participant_role":
{ Args: { "p_participant_id": string,"p_role": string }; Returns: undefined
                           },
"skip_item":
{ Args: { "p_item_id": string }; Returns: undefined
                           },
"start_round":
{ Args: { "p_item_id": string }; Returns: string
                           },
"update_item":
{ Args: { "p_description"?: string,"p_item_id": string,"p_title": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
