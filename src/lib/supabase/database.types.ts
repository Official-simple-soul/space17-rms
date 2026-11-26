
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
                },"approval_actions": {
                  Row: {
                    "action": string,"approved_minor": number | null,"comment": string | null,"created_at": string,"id": string,"membership_id": string,"org_id": string,"step_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"approved_minor"?: number | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"membership_id": string,"org_id": string,"step_id": string
                  }
                  Update: {
                    "action"?: string,"approved_minor"?: number | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"membership_id"?: string,"org_id"?: string,"step_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_actions_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "approval_actions_org_id_step_id_fkey"
      columns: ["org_id","step_id"]
isOneToOne: false
      referencedRelation: "approval_steps"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"approval_runs": {
                  Row: {
                    "created_at": string,"id": string,"org_id": string,"request_id": string,"run_no": number,"snapshot": NonNullable<Json>,"status": string,"workflow_version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"org_id": string,"request_id": string,"run_no": number,"snapshot": NonNullable<Json>,"status"?: string,"workflow_version_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"org_id"?: string,"request_id"?: string,"run_no"?: number,"snapshot"?: NonNullable<Json>,"status"?: string,"workflow_version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_runs_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "approval_runs_org_id_workflow_version_id_fkey"
      columns: ["org_id","workflow_version_id"]
isOneToOne: false
      referencedRelation: "workflow_versions"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"approval_steps": {
                  Row: {
                    "activated_at": string | null,"approver_type": string,"decided_at": string | null,"id": string,"membership_id": string | null,"name": string,"org_id": string,"position": number,"required_approvals": number,"role_id": string | null,"run_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"approver_type": string,"decided_at"?: string | null,"id"?: string,"membership_id"?: string | null,"name": string,"org_id": string,"position": number,"required_approvals": number,"role_id"?: string | null,"run_id": string,"status"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"approver_type"?: string,"decided_at"?: string | null,"id"?: string,"membership_id"?: string | null,"name"?: string,"org_id"?: string,"position"?: number,"required_approvals"?: number,"role_id"?: string | null,"run_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_steps_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "approval_steps_org_id_role_id_fkey"
      columns: ["org_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "approval_steps_org_id_run_id_fkey"
      columns: ["org_id","run_id"]
isOneToOne: false
      referencedRelation: "approval_runs"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "created_at": string,"expense_line_id": string | null,"field_key": string | null,"file_name": string,"id": string,"kind": string,"mime": string,"org_id": string,"payment_id": string | null,"ready_at": string | null,"removed_at": string | null,"report_id": string | null,"request_id": string | null,"sha256": string | null,"size": number,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expense_line_id"?: string | null,"field_key"?: string | null,"file_name": string,"id"?: string,"kind"?: string,"mime": string,"org_id": string,"payment_id"?: string | null,"ready_at"?: string | null,"removed_at"?: string | null,"report_id"?: string | null,"request_id"?: string | null,"sha256"?: string | null,"size": number,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"expense_line_id"?: string | null,"field_key"?: string | null,"file_name"?: string,"id"?: string,"kind"?: string,"mime"?: string,"org_id"?: string,"payment_id"?: string | null,"ready_at"?: string | null,"removed_at"?: string | null,"report_id"?: string | null,"request_id"?: string | null,"sha256"?: string | null,"size"?: number,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_org_id_expense_line_id_fkey"
      columns: ["org_id","expense_line_id"]
isOneToOne: false
      referencedRelation: "expense_lines"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "attachments_org_id_payment_id_fkey"
      columns: ["org_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "attachments_org_id_report_id_fkey"
      columns: ["org_id","report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "attachments_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "attachments_org_id_uploaded_by_fkey"
      columns: ["org_id","uploaded_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    }
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
                },"bank_accounts": {
                  Row: {
                    "account_name": string,"bank_name": string,"last_digits": string,"membership_id": string,"org_id": string,"secret_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name": string,"bank_name": string,"last_digits": string,"membership_id": string,"org_id": string,"secret_id": string,"updated_at"?: string
                  }
                  Update: {
                    "account_name"?: string,"bank_name"?: string,"last_digits"?: string,"membership_id"?: string,"org_id"?: string,"secret_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_accounts_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
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
                },"email_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"last_error": string | null,"next_attempt_at": string,"notification_id": string,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: string,"notification_id": string,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: string,"notification_id"?: string,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: true
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_events": {
                  Row: {
                    "actor_id": string,"body": string | null,"created_at": string,"expense_line_id": string,"id": number,"org_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"body"?: string | null,"created_at"?: string,"expense_line_id": string,"id"?: never,"org_id": string,"type": string
                  }
                  Update: {
                    "actor_id"?: string,"body"?: string | null,"created_at"?: string,"expense_line_id"?: string,"id"?: never,"org_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_events_org_id_actor_id_fkey"
      columns: ["org_id","actor_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_events_org_id_expense_line_id_fkey"
      columns: ["org_id","expense_line_id"]
isOneToOne: false
      referencedRelation: "expense_lines"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"expense_items": {
                  Row: {
                    "description": string,"expense_line_id": string,"id": string,"line_total_minor": number,"org_id": string,"position": number,"quantity": number,"unit_price_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"expense_line_id": string,"id"?: string,"line_total_minor"?: never,"org_id": string,"position": number,"quantity": number,"unit_price_minor": number
                  }
                  Update: {
                    "description"?: string,"expense_line_id"?: string,"id"?: string,"line_total_minor"?: never,"org_id"?: string,"position"?: number,"quantity"?: number,"unit_price_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_items_org_id_expense_line_id_fkey"
      columns: ["org_id","expense_line_id"]
isOneToOne: false
      referencedRelation: "expense_lines"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"expense_lines": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"category_id": string | null,"created_at": string,"department_id": string | null,"description": string,"entered_by": string,"expense_date": string | null,"funding": string,"id": string,"lock_version": number,"no_receipt": boolean,"no_receipt_reason": string | null,"org_id": string,"paid_by_membership_id": string | null,"report_id": string | null,"request_id": string | null,"seller_location": string | null,"seller_name": string,"seller_phone": string | null,"status": string,"submitted_at": string | null,"total_minor": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"category_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"description"?: string,"entered_by": string,"expense_date"?: string | null,"funding"?: string,"id"?: string,"lock_version"?: number,"no_receipt"?: boolean,"no_receipt_reason"?: string | null,"org_id": string,"paid_by_membership_id"?: string | null,"report_id"?: string | null,"request_id"?: string | null,"seller_location"?: string | null,"seller_name"?: string,"seller_phone"?: string | null,"status"?: string,"submitted_at"?: string | null,"total_minor"?: number,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"category_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"description"?: string,"entered_by"?: string,"expense_date"?: string | null,"funding"?: string,"id"?: string,"lock_version"?: number,"no_receipt"?: boolean,"no_receipt_reason"?: string | null,"org_id"?: string,"paid_by_membership_id"?: string | null,"report_id"?: string | null,"request_id"?: string | null,"seller_location"?: string | null,"seller_name"?: string,"seller_phone"?: string | null,"status"?: string,"submitted_at"?: string | null,"total_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_lines_org_id_accepted_by_fkey"
      columns: ["org_id","accepted_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_lines_org_id_category_id_fkey"
      columns: ["org_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_lines_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_lines_org_id_entered_by_fkey"
      columns: ["org_id","entered_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_lines_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_lines_org_id_paid_by_membership_id_fkey"
      columns: ["org_id","paid_by_membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_lines_org_id_report_id_fkey"
      columns: ["org_id","report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "expense_lines_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
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
                },"join_codes": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by": string,"org_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "join_codes_org_id_created_by_fkey"
      columns: ["org_id","created_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "join_codes_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"join_requests": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"email": string,"full_name": string,"id": string,"org_id": string,"status": string,"token_expires_at": string,"token_hash": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"email": string,"full_name": string,"id"?: string,"org_id": string,"status"?: string,"token_expires_at": string,"token_hash": string,"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"org_id"?: string,"status"?: string,"token_expires_at"?: string,"token_hash"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "join_requests_org_id_decided_by_fkey"
      columns: ["org_id","decided_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "join_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
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
                },"notifications": {
                  Row: {
                    "created_at": string,"expense_line_id": string | null,"id": string,"membership_id": string,"org_id": string,"payload": NonNullable<Json>,"read_at": string | null,"report_id": string | null,"request_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expense_line_id"?: string | null,"id"?: string,"membership_id": string,"org_id": string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"report_id"?: string | null,"request_id"?: string | null,"type": string
                  }
                  Update: {
                    "created_at"?: string,"expense_line_id"?: string | null,"id"?: string,"membership_id"?: string,"org_id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"report_id"?: string | null,"request_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_org_id_expense_line_id_fkey"
      columns: ["org_id","expense_line_id"]
isOneToOne: false
      referencedRelation: "expense_lines"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "notifications_org_id_membership_id_fkey"
      columns: ["org_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "notifications_org_id_report_id_fkey"
      columns: ["org_id","report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "notifications_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
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
                    "created_at": string,"currency": string,"fiscal_year_start_month": number,"id": string,"limits": NonNullable<Json>,"logo_path": string | null,"name": string,"plan": string,"report_due_day": number,"settings": NonNullable<Json>,"slug": string,"status": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"fiscal_year_start_month"?: number,"id"?: string,"limits"?: NonNullable<Json>,"logo_path"?: string | null,"name": string,"plan"?: string,"report_due_day"?: number,"settings"?: NonNullable<Json>,"slug": string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"fiscal_year_start_month"?: number,"id"?: string,"limits"?: NonNullable<Json>,"logo_path"?: string | null,"name"?: string,"plan"?: string,"report_due_day"?: number,"settings"?: NonNullable<Json>,"slug"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_confirmations": {
                  Row: {
                    "confirmed_at": string,"confirmed_by": string,"org_id": string,"payment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string,"confirmed_by": string,"org_id": string,"payment_id": string
                  }
                  Update: {
                    "confirmed_at"?: string,"confirmed_by"?: string,"org_id"?: string,"payment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_confirmations_org_id_confirmed_by_fkey"
      columns: ["org_id","confirmed_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "payment_confirmations_org_id_payment_id_fkey"
      columns: ["org_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"id": string,"method": string,"note": string | null,"number": string,"org_id": string,"paid_on": string,"payee_membership_id": string | null,"payee_name": string,"recorded_by": string,"reference": string | null,"request_id": string,"status": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"id"?: string,"method": string,"note"?: string | null,"number": string,"org_id": string,"paid_on": string,"payee_membership_id"?: string | null,"payee_name": string,"recorded_by": string,"reference"?: string | null,"request_id": string,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"id"?: string,"method"?: string,"note"?: string | null,"number"?: string,"org_id"?: string,"paid_on"?: string,"payee_membership_id"?: string | null,"payee_name"?: string,"recorded_by"?: string,"reference"?: string | null,"request_id"?: string,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_org_id_payee_membership_id_fkey"
      columns: ["org_id","payee_membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "payments_org_id_recorded_by_fkey"
      columns: ["org_id","recorded_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "payments_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "payments_org_id_voided_by_fkey"
      columns: ["org_id","voided_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    }
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
                },"report_events": {
                  Row: {
                    "actor_id": string,"body": string | null,"created_at": string,"id": number,"org_id": string,"report_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"body"?: string | null,"created_at"?: string,"id"?: never,"org_id": string,"report_id": string,"type": string
                  }
                  Update: {
                    "actor_id"?: string,"body"?: string | null,"created_at"?: string,"id"?: never,"org_id"?: string,"report_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_events_org_id_actor_id_fkey"
      columns: ["org_id","actor_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "report_events_org_id_report_id_fkey"
      columns: ["org_id","report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"report_periods": {
                  Row: {
                    "created_at": string,"due_date": string,"id": string,"month": string,"org_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"due_date": string,"id"?: string,"month": string,"org_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"due_date"?: string,"id"?: string,"month"?: string,"org_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_periods_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"report_reminders": {
                  Row: {
                    "created_at": string,"department_id": string,"kind": string,"month": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id": string,"kind": string,"month": string,"org_id": string
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string,"kind"?: string,"month"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_reminders_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"department_id": string,"form_data": NonNullable<Json>,"id": string,"kind": string,"lock_version": number,"number": string | null,"org_id": string,"period_id": string,"status": string,"submitted_at": string | null,"submitted_by": string | null,"template_version_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id": string,"form_data"?: NonNullable<Json>,"id"?: string,"kind"?: string,"lock_version"?: number,"number"?: string | null,"org_id": string,"period_id": string,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"template_version_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string,"form_data"?: NonNullable<Json>,"id"?: string,"kind"?: string,"lock_version"?: number,"number"?: string | null,"org_id"?: string,"period_id"?: string,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"template_version_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "reports_org_id_period_id_fkey"
      columns: ["org_id","period_id"]
isOneToOne: false
      referencedRelation: "report_periods"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "reports_org_id_submitted_by_fkey"
      columns: ["org_id","submitted_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "reports_org_id_template_version_id_fkey"
      columns: ["org_id","template_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"request_events": {
                  Row: {
                    "actor_id": string,"amount_minor": number | null,"body": string | null,"created_at": string,"id": number,"org_id": string,"request_id": string,"step_name": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"amount_minor"?: number | null,"body"?: string | null,"created_at"?: string,"id"?: never,"org_id": string,"request_id": string,"step_name"?: string | null,"type": string
                  }
                  Update: {
                    "actor_id"?: string,"amount_minor"?: number | null,"body"?: string | null,"created_at"?: string,"id"?: never,"org_id"?: string,"request_id"?: string,"step_name"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_events_org_id_actor_id_fkey"
      columns: ["org_id","actor_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "request_events_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"request_items": {
                  Row: {
                    "approved_minor": number | null,"description": string,"id": string,"line_total_minor": number,"org_id": string,"position": number,"quantity": number,"request_id": string,"unit_price_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_minor"?: number | null,"description": string,"id"?: string,"line_total_minor"?: never,"org_id": string,"position": number,"quantity": number,"request_id": string,"unit_price_minor": number
                  }
                  Update: {
                    "approved_minor"?: number | null,"description"?: string,"id"?: string,"line_total_minor"?: never,"org_id"?: string,"position"?: number,"quantity"?: number,"request_id"?: string,"unit_price_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_items_org_id_request_id_fkey"
      columns: ["org_id","request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["org_id","id"]
    }
                  ]
                },"requests": {
                  Row: {
                    "approved_minor": number | null,"category_id": string,"closed_at": string | null,"created_at": string,"decided_at": string | null,"department_id": string | null,"form_data": NonNullable<Json>,"id": string,"lock_version": number,"needed_by": string | null,"number": string | null,"org_id": string,"purpose": string,"requester_id": string,"status": string,"submitted_at": string | null,"template_version_id": string | null,"title": string,"total_minor": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_minor"?: number | null,"category_id": string,"closed_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"department_id"?: string | null,"form_data"?: NonNullable<Json>,"id"?: string,"lock_version"?: number,"needed_by"?: string | null,"number"?: string | null,"org_id": string,"purpose"?: string,"requester_id": string,"status"?: string,"submitted_at"?: string | null,"template_version_id"?: string | null,"title"?: string,"total_minor"?: number,"updated_at"?: string
                  }
                  Update: {
                    "approved_minor"?: number | null,"category_id"?: string,"closed_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"department_id"?: string | null,"form_data"?: NonNullable<Json>,"id"?: string,"lock_version"?: number,"needed_by"?: string | null,"number"?: string | null,"org_id"?: string,"purpose"?: string,"requester_id"?: string,"status"?: string,"submitted_at"?: string | null,"template_version_id"?: string | null,"title"?: string,"total_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requests_org_id_category_id_fkey"
      columns: ["org_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "requests_org_id_department_id_fkey"
      columns: ["org_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_org_id_requester_id_fkey"
      columns: ["org_id","requester_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "requests_org_id_template_version_id_fkey"
      columns: ["org_id","template_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["org_id","id"]
    }
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
            "accept_expenses":
{ Args: { "p_lines": Json,"p_org": string }; Returns: number
                           },
"accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"accept_org_invite":
{ Args: { "p_name": string,"p_slug": string,"p_token": string }; Returns: string
                           },
"add_starter_configuration":
{ Args: { "p_org": string }; Returns: undefined
                           },
"approve_join_request":
{ Args: { "p_department"?: string,"p_id": string,"p_org": string,"p_role": string }; Returns: {
              "email": string,"token": string
            }[]
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
"claim_emails":
{ Args: { "p_limit"?: number }; Returns: {
              "attempt": number,"email": string,"expense_id": string,"id": string,"name": string,"org_name": string,"org_slug": string,"payload": Json,"report_id": string,"request_id": string,"type": string
            }[]
                           },
"comment_on_request":
{ Args: { "p_body": string,"p_id": string }; Returns: undefined
                           },
"confirm_payment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"create_org_invite":
{ Args: { "p_email": string }; Returns: string
                           },
"decide_expense":
{ Args: { "p_action": string,"p_id": string,"p_lock": number,"p_reason": string }; Returns: undefined
                           },
"decide_request":
{ Args: { "p_action": string,"p_comment": string,"p_items"?: Json,"p_lock": number,"p_step": string }; Returns: undefined
                           },
"decline_access_request":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_draft":
{ Args: { "p_id": string }; Returns: (string)[]
                           },
"delete_expense":
{ Args: { "p_id": string }; Returns: (string)[]
                           },
"department_overview":
{ Args: { "p_org": string }; Returns: {
              "department_id": string,"deputies": (string)[],"head": string,"people": number
            }[]
                           },
"discard_attachment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"end_support_session":
{ Args: { "p_id": string }; Returns: undefined
                           },
"expense_categories":
{ Args: { "p_org": string }; Returns: {
              "departments": (string)[],"id": string,"name": string
            }[]
                           },
"finish_attachment":
{ Args: { "p_id": string,"p_sha256": string,"p_size": number }; Returns: undefined
                           },
"finish_email":
{ Args: { "p_attempt": number,"p_error"?: string,"p_id": string,"p_ok": boolean }; Returns: undefined
                           },
"get_attachment":
{ Args: { "p_id": string }; Returns: {
              "file_name": string,"mime": string,"storage_path": string
            }[]
                           },
"get_expense":
{ Args: { "p_id": string }; Returns: Json
                           },
"get_join_code":
{ Args: { "p_org": string }; Returns: string
                           },
"get_pending_attachment":
{ Args: { "p_id": string }; Returns: {
              "mime": string,"storage_path": string
            }[]
                           },
"get_report":
{ Args: { "p_id": string }; Returns: Json
                           },
"get_request":
{ Args: { "p_id": string }; Returns: Json
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
"linkable_requests":
{ Args: { "p_org": string }; Returns: {
              "category_id": string,"department_id": string,"id": string,"number": string,"title": string
            }[]
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
"list_expenses":
{ Args: { "p_category"?: string,"p_department"?: string,"p_desc"?: boolean,"p_evidence"?: string,"p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_org": string,"p_search"?: string,"p_sort"?: string,"p_status"?: string,"p_to"?: string,"p_view"?: string }; Returns: {
              "category": string,"department": string,"description": string,"entered_by": string,"evidence": string,"expense_date": string,"flags": (string)[],"funding": string,"id": string,"seller": string,"status": string,"submitted_at": string,"total": number,"total_minor": number,"updated_at": string
            }[]
                           },
"list_join_requests":
{ Args: { "p_org": string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"id": string
            }[]
                           },
"list_members":
{ Args: { "p_department"?: string,"p_desc"?: boolean,"p_limit"?: number,"p_no_department"?: boolean,"p_offset"?: number,"p_org": string,"p_role"?: string,"p_search"?: string,"p_sort"?: string,"p_status"?: string }; Returns: {
              "department_names": (string)[],"id": string,"name": string,"roles": (string)[],"status": string,"total": number
            }[]
                           },
"list_notifications":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_org": string,"p_unread"?: boolean }; Returns: {
              "created_at": string,"expense_id": string,"id": string,"payload": Json,"read_at": string,"report_id": string,"request_id": string,"total": number,"type": string
            }[]
                           },
"list_payable":
{ Args: { "p_department"?: string,"p_desc"?: boolean,"p_limit"?: number,"p_offset"?: number,"p_org": string,"p_search"?: string,"p_sort"?: string }; Returns: {
              "approved_minor": number,"decided_at": string,"department": string,"id": string,"is_own": boolean,"needed_by": string,"number": string,"paid_minor": number,"requester": string,"title": string,"total": number
            }[]
                           },
"list_payments":
{ Args: { "p_desc"?: boolean,"p_from"?: string,"p_limit"?: number,"p_method"?: string,"p_offset"?: number,"p_org": string,"p_search"?: string,"p_sort"?: string,"p_status"?: string,"p_to"?: string }; Returns: {
              "amount_minor": number,"confirmed": boolean,"id": string,"method": string,"number": string,"paid_on": string,"payee": string,"reference": string,"request_id": string,"request_number": string,"status": string,"title": string,"total": number
            }[]
                           },
"list_reports":
{ Args: { "p_department"?: string,"p_desc"?: boolean,"p_limit"?: number,"p_month"?: string,"p_offset"?: number,"p_org": string,"p_search"?: string,"p_sort"?: string,"p_status"?: string }; Returns: {
              "department": string,"due_date": string,"id": string,"lines": number,"missing": number,"month": string,"number": string,"overdue": boolean,"status": string,"submitted_at": string,"total": number,"total_minor": number
            }[]
                           },
"list_requests":
{ Args: { "p_category"?: string,"p_department"?: string,"p_desc"?: boolean,"p_limit"?: number,"p_offset"?: number,"p_org": string,"p_search"?: string,"p_sort"?: string,"p_status"?: string,"p_view"?: string }; Returns: {
              "approved_minor": number,"category": string,"department": string,"id": string,"number": string,"requester": string,"status": string,"submitted_at": string,"title": string,"total": number,"total_minor": number,"updated_at": string,"waiting_since": string
            }[]
                           },
"mark_notifications_read":
{ Args: { "p_org": string,"p_subject"?: string }; Returns: undefined
                           },
"my_bank_account":
{ Args: { "p_org": string }; Returns: {
              "account_name": string,"bank_name": string,"last_digits": string,"updated_at": string
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
"my_report_months":
{ Args: { "p_org": string }; Returns: {
              "department": string,"department_id": string,"due_date": string,"lines": number,"missing": number,"month": string,"overdue": boolean,"report_id": string,"status": string,"total_minor": number,"waiting": number
            }[]
                           },
"my_work":
{ Args: { "p_org": string }; Returns: {
              "approvals": number,"expenses_returned": number,"expenses_waiting": number,"join_requests": number,"open_requests": number,"reports_due": number,"returned": number,"to_confirm": number,"to_pay": number,"unread": number
            }[]
                           },
"open_report":
{ Args: { "p_department": string,"p_month": string,"p_org": string }; Returns: string
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
"preview_steps":
{ Args: { "p_category": string,"p_total": number }; Returns: {
              "name": string,"required": number,"who": string
            }[]
                           },
"queue_report_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ready_expenses":
{ Args: { "p_org": string }; Returns: {
              "id": string,"lock_version": number,"total_minor": number
            }[]
                           },
"reassign_step":
{ Args: { "p_membership": string,"p_reason": string,"p_step": string }; Returns: undefined
                           },
"record_payment":
{ Args: { "p_amount": number,"p_lock": number,"p_method": string,"p_note": string,"p_paid_on": string,"p_payee": string,"p_reference": string,"p_request": string,"p_to_requester": boolean }; Returns: string
                           },
"reject_join_request":
{ Args: { "p_id": string,"p_org": string }; Returns: undefined
                           },
"remove_attachment":
{ Args: { "p_id": string }; Returns: string
                           },
"remove_bank_account":
{ Args: { "p_org": string }; Returns: undefined
                           },
"remove_report_line":
{ Args: { "p_id": string,"p_lock": number,"p_reason": string }; Returns: undefined
                           },
"request_expenses":
{ Args: { "p_request": string }; Returns: {
              "description": string,"expense_date": string,"id": string,"status": string,"total_minor": number
            }[]
                           },
"requestable_categories":
{ Args: { "p_org": string }; Returns: {
              "departments": (string)[],"id": string,"name": string
            }[]
                           },
"reveal_bank_account":
{ Args: { "p_request": string }; Returns: string
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
"save_bank_account":
{ Args: { "p_bank": string,"p_name": string,"p_number": string,"p_org": string }; Returns: undefined
                           },
"save_category":
{ Args: { "p_applies_to": string,"p_approvers": Json,"p_code": string,"p_departments": (string)[],"p_id": string,"p_name": string,"p_org": string,"p_requires_accounting": boolean,"p_template": string,"p_workflow": string }; Returns: string
                           },
"save_department":
{ Args: { "p_code": string,"p_id": string,"p_name": string,"p_org": string,"p_parent": string }; Returns: string
                           },
"save_expense":
{ Args: { "p_category": string,"p_date": string,"p_department": string,"p_description": string,"p_funding": string,"p_id": string,"p_items": Json,"p_location": string,"p_lock": number,"p_no_receipt": boolean,"p_org": string,"p_phone": string,"p_reason": string,"p_request": string,"p_seller": string }; Returns: Json
                           },
"save_numbering":
{ Args: { "p_digits": number,"p_org": string,"p_prefix": string,"p_reset": string,"p_type": string }; Returns: undefined
                           },
"save_report":
{ Args: { "p_form": Json,"p_id": string,"p_lock": number }; Returns: Json
                           },
"save_request":
{ Args: { "p_category": string,"p_department": string,"p_form": Json,"p_id": string,"p_items": Json,"p_lock": number,"p_needed_by": string,"p_org": string,"p_purpose": string,"p_title": string }; Returns: Json
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
"set_join_code":
{ Args: { "p_enabled": boolean,"p_org": string }; Returns: string
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
"set_report_due_day":
{ Args: { "p_day": number,"p_org": string }; Returns: undefined
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
"start_attachment":
{ Args: { "p_field": string,"p_mime": string,"p_name": string,"p_request": string,"p_size": number }; Returns: Json
                           },
"start_expense_file":
{ Args: { "p_expense": string,"p_kind": string,"p_mime": string,"p_name": string,"p_size": number }; Returns: Json
                           },
"start_payment_proof":
{ Args: { "p_mime": string,"p_name": string,"p_payment": string,"p_size": number }; Returns: Json
                           },
"start_report_file":
{ Args: { "p_field": string,"p_mime": string,"p_name": string,"p_report": string,"p_size": number }; Returns: Json
                           },
"start_support_session":
{ Args: { "p_org": string,"p_reason": string }; Returns: string
                           },
"submit_access_request":
{ Args: { "p_contact_name": string,"p_email": string,"p_message": string,"p_org_name": string }; Returns: undefined
                           },
"submit_expense":
{ Args: { "p_id": string,"p_lock": number }; Returns: string
                           },
"submit_join_request":
{ Args: { "p_code": string,"p_email": string,"p_name": string }; Returns: {
              "org_name": string,"token": string
            }[]
                           },
"submit_report":
{ Args: { "p_confirm_missing": boolean,"p_id": string,"p_lock": number }; Returns: undefined
                           },
"submit_request":
{ Args: { "p_id": string,"p_lock": number }; Returns: Json
                           },
"update_organisation":
{ Args: { "p_fiscal_month": number,"p_name": string,"p_org": string,"p_timezone": string }; Returns: undefined
                           },
"verify_join_request":
{ Args: { "p_token": string }; Returns: string
                           },
"void_payment":
{ Args: { "p_id": string,"p_lock": number,"p_reason": string }; Returns: undefined
                           },
"withdraw_expense":
{ Args: { "p_id": string,"p_lock": number }; Returns: undefined
                           },
"withdraw_request":
{ Args: { "p_id": string,"p_lock": number,"p_reason": string }; Returns: undefined
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
