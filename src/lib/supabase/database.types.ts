
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
            "access_requests": {
                  Row: {
                    "contact_name": string,"created_at": string,"email": string,"id": string,"message": string | null,"org_name": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_name": string,"created_at"?: string,"email": string,"id"?: string,"message"?: string | null,"org_name": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "contact_name"?: string,"created_at"?: string,"email"?: string,"id"?: string,"message"?: string | null,"org_name"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"org_id": string | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"org_id"?: string | null,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"org_id"?: string | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "archived_at": string | null,"code": string,"created_at": string,"id": string,"name": string,"org_id": string,"parent_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"code": string,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"parent_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"parent_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_org_id_parent_id_fkey"
      columns: ["org_id","parent_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"membership_roles": {
                  Row: {
                    "created_at": string,"department_id": string | null,"granted_by": string | null,"id": string,"membership_id": string,"org_id": string,"role_id": string,"valid_from": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: string | null,"granted_by"?: string | null,"id"?: string,"membership_id": string,"org_id": string,"role_id": string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string | null,"granted_by"?: string | null,"id"?: string,"membership_id"?: string,"org_id"?: string,"role_id"?: string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_roles_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "membership_roles_org_id_granted_by_fkey"
      columns: ["org_id","granted_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "membership_roles_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "membership_roles_org_id_role_id_fkey"
      columns: ["org_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"job_title": string | null,"org_id": string,"primary_department_id": string | null,"staff_no": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_title"?: string | null,"org_id": string,"primary_department_id"?: string | null,"staff_no"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_title"?: string | null,"org_id"?: string,"primary_department_id"?: string | null,"staff_no"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_org_id_primary_department_id_fkey"
      columns: ["org_id","primary_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"org_invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_org_id": string | null,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_org_id"?: string | null,"email": string,"expires_at": string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_org_id"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_invites_created_org_id_fkey"
      columns: ["created_org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"organisations": {
                  Row: {
                    "created_at": string,"currency": string,"fiscal_year_start_month": number,"id": string,"limits": NonNullable<Json>,"logo_path": string | null,"name": string,"plan": string,"settings": NonNullable<Json>,"slug": string,"status": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"fiscal_year_start_month"?: number,"id"?: string,"limits"?: NonNullable<Json>,"logo_path"?: string | null,"name": string,"plan"?: string,"settings"?: NonNullable<Json>,"slug": string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"fiscal_year_start_month"?: number,"id"?: string,"limits"?: NonNullable<Json>,"logo_path"?: string | null,"name"?: string,"plan"?: string,"settings"?: NonNullable<Json>,"slug"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permissions": {
                  Row: {
                    "allowed_scopes": (string)[],"description": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_scopes": (string)[],"description": string,"key": string
                  }
                  Update: {
                    "allowed_scopes"?: (string)[],"description"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"full_name": string,"phone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"phone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"phone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"org_id": string,"permission_key": string,"role_id": string,"scope": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"permission_key": string,"role_id": string,"scope": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"permission_key"?: string,"role_id"?: string,"scope"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_org_id_role_id_fkey"
      columns: ["org_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    }
                  ]
                },"roles": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"org_id": string,"system_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"system_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"system_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"support_sessions": {
                  Row: {
                    "admin_user_id": string,"created_at": string,"ended_at": string | null,"expires_at": string,"id": string,"org_id": string,"reason": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_user_id": string,"created_at"?: string,"ended_at"?: string | null,"expires_at": string,"id"?: string,"org_id": string,"reason": string,"starts_at"?: string
                  }
                  Update: {
                    "admin_user_id"?: string,"created_at"?: string,"ended_at"?: string | null,"expires_at"?: string,"id"?: string,"org_id"?: string,"reason"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_sessions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_org_invite":
{ Args: { "p_name": string,"p_slug": string,"p_token": string }; Returns: string
                           },
"create_org_invite":
{ Args: { "p_email": string }; Returns: string
                           },
"decline_access_request":
{ Args: { "p_id": string }; Returns: undefined
                           },
"end_support_session":
{ Args: { "p_id": string }; Returns: undefined
                           },
"grant_platform_admin":
{ Args: { "p_user": string }; Returns: undefined
                           },
"my_organisations":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"membership_status": string,"name": string,"slug": string,"status": string
            }[]
                           },
"my_permissions":
{ Args: { "p_org": string }; Returns: {
              "department_id": string,"permission_key": string,"scope": string
            }[]
                           },
"my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_name": string,"phone": string
            }[]
                           },
"peek_org_invite":
{ Args: { "p_token": string }; Returns: {
              "email": string,"has_account": boolean,"state": string
            }[]
                           },
"revoke_org_invite":
{ Args: { "p_id": string }; Returns: undefined
                           },
"set_organisation_suspended":
{ Args: { "p_org": string,"p_reason": string,"p_suspended": boolean }; Returns: undefined
                           },
"start_support_session":
{ Args: { "p_org": string,"p_reason": string }; Returns: string
                           },
"submit_access_request":
{ Args: { "p_contact_name": string,"p_email": string,"p_message": string,"p_org_name": string }; Returns: undefined
                           },
"update_organisation":
{ Args: { "p_fiscal_month": number,"p_name": string,"p_org": string,"p_timezone": string }; Returns: undefined
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
