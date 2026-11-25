
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
                },"categories": {
                  Row: {
                    "applies_to": string,"archived_at": string | null,"code": string,"created_at": string,"id": string,"name": string,"org_id": string,"requires_accounting": boolean,"template_id": string | null,"updated_at": string,"workflow_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applies_to"?: string,"archived_at"?: string | null,"code": string,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"requires_accounting"?: boolean,"template_id"?: string | null,"updated_at"?: string,"workflow_id"?: string | null
                  }
                  Update: {
                    "applies_to"?: string,"archived_at"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"requires_accounting"?: boolean,"template_id"?: string | null,"updated_at"?: string,"workflow_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_org_id_template_id_fkey"
      columns: ["org_id","template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "categories_org_id_workflow_id_fkey"
      columns: ["org_id","workflow_id"]
isOneToOne: false
      referencedRelation: "workflows"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"category_approvers": {
                  Row: {
                    "category_id": string,"department_id": string | null,"id": string,"membership_id": string | null,"org_id": string,"role_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"department_id"?: string | null,"id"?: string,"membership_id"?: string | null,"org_id": string,"role_id"?: string | null
                  }
                  Update: {
                    "category_id"?: string,"department_id"?: string | null,"id"?: string,"membership_id"?: string | null,"org_id"?: string,"role_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "category_approvers_org_id_category_id_fkey"
      columns: ["org_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "category_approvers_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "category_approvers_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "category_approvers_org_id_role_id_fkey"
      columns: ["org_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"category_departments": {
                  Row: {
                    "category_id": string,"department_id": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"department_id": string,"org_id": string
                  }
                  Update: {
                    "category_id"?: string,"department_id"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "category_departments_org_id_category_id_fkey"
      columns: ["org_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "category_departments_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"department_members": {
                  Row: {
                    "created_at": string,"department_id": string,"membership_id": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id": string,"membership_id": string,"org_id": string
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string,"membership_id"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "department_members_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "department_members_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
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
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"department_id": string | null,"email": string,"expires_at": string,"id": string,"invited_by": string,"org_id": string,"revoked_at": string | null,"role_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"department_id"?: string | null,"email": string,"expires_at": string,"id"?: string,"invited_by": string,"org_id": string,"revoked_at"?: string | null,"role_id": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"department_id"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"org_id"?: string,"revoked_at"?: string | null,"role_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_invited_by_fkey"
      columns: ["org_id","invited_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "invitations_org_id_role_id_fkey"
      columns: ["org_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
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
                },"number_counters": {
                  Row: {
                    "document_type": string,"last_value": number,"org_id": string,"period_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "document_type": string,"last_value": number,"org_id": string,"period_key": string
                  }
                  Update: {
                    "document_type"?: string,"last_value"?: number,"org_id"?: string,"period_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "number_counters_org_id_document_type_fkey"
      columns: ["org_id","document_type"]
isOneToOne: false
      referencedRelation: "number_sequences"
      referencedColumns: ["org_id","document_type"]
    }
                  ]
                },"number_sequences": {
                  Row: {
                    "digits": number,"document_type": string,"org_id": string,"prefix": string,"reset": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "digits"?: number,"document_type": string,"org_id": string,"prefix": string,"reset"?: string,"updated_at"?: string
                  }
                  Update: {
                    "digits"?: number,"document_type"?: string,"org_id"?: string,"prefix"?: string,"reset"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "number_sequences_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
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
                },"template_versions": {
                  Row: {
                    "fields": NonNullable<Json>,"id": string,"org_id": string,"published_at": string,"published_by": string,"template_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "fields": NonNullable<Json>,"id"?: string,"org_id": string,"published_at"?: string,"published_by": string,"template_id": string,"version": number
                  }
                  Update: {
                    "fields"?: NonNullable<Json>,"id"?: string,"org_id"?: string,"published_at"?: string,"published_by"?: string,"template_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_versions_org_id_published_by_fkey"
      columns: ["org_id","published_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "template_versions_org_id_template_id_fkey"
      columns: ["org_id","template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"templates": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"current_version_id": string | null,"id": string,"kind": string,"name": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"kind": string,"name": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "templates_id_current_version_id_fkey"
      columns: ["id","current_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["template_id","id"]
    },{
      foreignKeyName: "templates_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"workflow_steps": {
                  Row: {
                    "approver_type": string,"id": string,"membership_id": string | null,"min_amount_minor": number | null,"name": string,"org_id": string,"position": number,"required_approvals": number,"role_id": string | null,"workflow_version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approver_type": string,"id"?: string,"membership_id"?: string | null,"min_amount_minor"?: number | null,"name": string,"org_id": string,"position": number,"required_approvals"?: number,"role_id"?: string | null,"workflow_version_id": string
                  }
                  Update: {
                    "approver_type"?: string,"id"?: string,"membership_id"?: string | null,"min_amount_minor"?: number | null,"name"?: string,"org_id"?: string,"position"?: number,"required_approvals"?: number,"role_id"?: string | null,"workflow_version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflow_steps_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "workflow_steps_org_id_role_id_fkey"
      columns: ["org_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "workflow_steps_org_id_workflow_version_id_fkey"
      columns: ["org_id","workflow_version_id"]
isOneToOne: false
      referencedRelation: "workflow_versions"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"workflow_versions": {
                  Row: {
                    "id": string,"org_id": string,"published_at": string,"published_by": string,"version": number,"workflow_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"org_id": string,"published_at"?: string,"published_by": string,"version": number,"workflow_id": string
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"published_at"?: string,"published_by"?: string,"version"?: number,"workflow_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflow_versions_org_id_published_by_fkey"
      columns: ["org_id","published_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "workflow_versions_org_id_workflow_id_fkey"
      columns: ["org_id","workflow_id"]
isOneToOne: false
      referencedRelation: "workflows"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"workflows": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"current_version_id": string | null,"id": string,"name": string,"org_id": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"name": string,"org_id": string,"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflows_id_current_version_id_fkey"
      columns: ["id","current_version_id"]
isOneToOne: false
      referencedRelation: "workflow_versions"
      referencedColumns: ["workflow_id","id"]
    },{
      foreignKeyName: "workflows_org_id_fkey"
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
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"accept_org_invite":
{ Args: { "p_name": string,"p_slug": string,"p_token": string }; Returns: string
                           },
"add_starter_configuration":
{ Args: { "p_org": string }; Returns: undefined
                           },
"archive_category":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"archive_department":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"archive_role":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"archive_template":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"archive_workflow":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"audit_filters":
{ Args: { "p_org": string }; Returns: {
              "kind": string,"label": string,"value": string
            }[]
                           },
"create_org_invite":
{ Args: { "p_email": string }; Returns: string
                           },
"decline_access_request":
{ Args: { "p_id": string }; Returns: undefined
                           },
"department_overview":
{ Args: { "p_org": string }; Returns: {
              "department_id": string,"deputies": (string)[],"head": string,"people": number
            }[]
                           },
"end_support_session":
{ Args: { "p_id": string }; Returns: undefined
                           },
"grant_platform_admin":
{ Args: { "p_user": string }; Returns: undefined
                           },
"grant_role":
{ Args: { "p_department"?: string,"p_membership": string,"p_org": string,"p_role": string,"p_until"?: string }; Returns: undefined
                           },
"invite_member":
{ Args: { "p_department"?: string,"p_email": string,"p_org": string,"p_role": string }; Returns: string
                           },
"list_approvers":
{ Args: { "p_key": string,"p_org": string }; Returns: {
              "id": string,"name": string
            }[]
                           },
"list_audit":
{ Args: { "p_area"?: string,"p_desc"?: boolean,"p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_org": string,"p_person"?: string,"p_search"?: string,"p_sort"?: string,"p_to"?: string }; Returns: {
              "action": string,"after": Json,"area": string,"at": string,"before": Json,"id": string,"person": string,"reason": string,"total": number
            }[]
                           },
"list_members":
{ Args: { "p_department"?: string,"p_desc"?: boolean,"p_limit"?: number,"p_no_department"?: boolean,"p_offset"?: number,"p_org": string,"p_role"?: string,"p_search"?: string,"p_sort"?: string,"p_status"?: string }; Returns: {
              "department_names": (string)[],"id": string,"name": string,"roles": (string)[],"status": string,"total": number
            }[]
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
"peek_invitation":
{ Args: { "p_token": string }; Returns: {
              "email": string,"has_account": boolean,"org_name": string,"state": string
            }[]
                           },
"peek_org_invite":
{ Args: { "p_token": string }; Returns: {
              "email": string,"has_account": boolean,"state": string
            }[]
                           },
"revoke_invitation":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"revoke_org_invite":
{ Args: { "p_id": string }; Returns: undefined
                           },
"revoke_role":
{ Args: { "p_grant": string,"p_org": string }; Returns: undefined
                           },
"role_overview":
{ Args: { "p_org": string }; Returns: {
              "people": number,"role_id": string
            }[]
                           },
"save_category":
{ Args: { "p_applies_to": string,"p_approvers": Json,"p_code": string,"p_departments": (string)[],"p_id": string,"p_name": string,"p_org": string,"p_requires_accounting": boolean,"p_template": string,"p_workflow": string }; Returns: string
                           },
"save_department":
{ Args: { "p_code": string,"p_id": string,"p_name": string,"p_org": string,"p_parent": string }; Returns: string
                           },
"save_numbering":
{ Args: { "p_digits": number,"p_org": string,"p_prefix": string,"p_reset": string,"p_type": string }; Returns: undefined
                           },
"save_role":
{ Args: { "p_id": string,"p_name": string,"p_org": string,"p_permissions": Json }; Returns: string
                           },
"save_template":
{ Args: { "p_expected": number,"p_fields": Json,"p_id": string,"p_kind": string,"p_name": string,"p_org": string }; Returns: Json
                           },
"save_workflow":
{ Args: { "p_expected": number,"p_id": string,"p_name": string,"p_org": string,"p_steps": Json,"p_subject": string }; Returns: Json
                           },
"set_member_departments":
{ Args: { "p_departments": (string)[],"p_membership": string,"p_org": string,"p_primary": string }; Returns: undefined
                           },
"set_member_status":
{ Args: { "p_membership": string,"p_org": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"set_organisation_suspended":
{ Args: { "p_org": string,"p_reason": string,"p_suspended": boolean }; Returns: undefined
                           },
"setup_counts":
{ Args: { "p_org": string }; Returns: {
              "categories": number,"departments": number,"members": number,"roles": number,"templates": number,"workflows": number
            }[]
                           },
"setup_warnings":
{ Args: { "p_org": string }; Returns: {
              "code": string,"found": number,"needed": number,"subject": string,"subject_id": string
            }[]
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
