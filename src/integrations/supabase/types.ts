export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_branding: {
        Row: {
          accent_color: string
          app_name: string
          company_name: string
          created_at: string
          favicon_url: string | null
          id: boolean
          login_bg_color: string | null
          login_bg_image_url: string | null
          login_logo_url: string | null
          login_subtitle: string
          login_title: string
          primary_color: string
          primary_foreground_color: string
          radius: string
          sidebar_color: string | null
          sidebar_logo_url: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          app_name?: string
          company_name?: string
          created_at?: string
          favicon_url?: string | null
          id?: boolean
          login_bg_color?: string | null
          login_bg_image_url?: string | null
          login_logo_url?: string | null
          login_subtitle?: string
          login_title?: string
          primary_color?: string
          primary_foreground_color?: string
          radius?: string
          sidebar_color?: string | null
          sidebar_logo_url?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          app_name?: string
          company_name?: string
          created_at?: string
          favicon_url?: string | null
          id?: boolean
          login_bg_color?: string | null
          login_bg_image_url?: string | null
          login_logo_url?: string | null
          login_subtitle?: string
          login_title?: string
          primary_color?: string
          primary_foreground_color?: string
          radius?: string
          sidebar_color?: string | null
          sidebar_logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      departments: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_categories: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          anydesk_id: string | null
          bitlocker_id: string | null
          bitlocker_recovery_key: string | null
          category_id: string | null
          computer_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          fabricante: string | null
          id: string
          ip_address: string | null
          license_alert_days: number[]
          license_expires_at: string | null
          license_password: string | null
          license_quantity: number | null
          license_url: string | null
          license_username: string | null
          localizacao: string | null
          mac_address: string | null
          manufacturer_id: string | null
          modelo: string | null
          numero_serie: string | null
          observacoes: string | null
          operating_system: string | null
          operating_system_id: string | null
          patrimonio: string
          responsavel_id: string | null
          status: string
          status_id: string | null
          teamviewer_id: string | null
          tipo: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          anydesk_id?: string | null
          bitlocker_id?: string | null
          bitlocker_recovery_key?: string | null
          category_id?: string | null
          computer_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fabricante?: string | null
          id?: string
          ip_address?: string | null
          license_alert_days?: number[]
          license_expires_at?: string | null
          license_password?: string | null
          license_quantity?: number | null
          license_url?: string | null
          license_username?: string | null
          localizacao?: string | null
          mac_address?: string | null
          manufacturer_id?: string | null
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          operating_system?: string | null
          operating_system_id?: string | null
          patrimonio: string
          responsavel_id?: string | null
          status?: string
          status_id?: string | null
          teamviewer_id?: string | null
          tipo: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          anydesk_id?: string | null
          bitlocker_id?: string | null
          bitlocker_recovery_key?: string | null
          category_id?: string | null
          computer_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fabricante?: string | null
          id?: string
          ip_address?: string | null
          license_alert_days?: number[]
          license_expires_at?: string | null
          license_password?: string | null
          license_quantity?: number | null
          license_url?: string | null
          license_username?: string | null
          localizacao?: string | null
          mac_address?: string | null
          manufacturer_id?: string | null
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          operating_system?: string | null
          operating_system_id?: string | null
          patrimonio?: string
          responsavel_id?: string | null
          status?: string
          status_id?: string | null
          teamviewer_id?: string | null
          tipo?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "inventory_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_operating_system_id_fkey"
            columns: ["operating_system_id"]
            isOneToOne: false
            referencedRelation: "inventory_operating_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "inventory_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "inventory_types"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_manufacturers: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_operating_systems: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_statuses: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_types: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      kb_articles: {
        Row: {
          autor_id: string
          categoria_id: string | null
          conteudo: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          publicado: boolean
          slug: string
          tipo_conteudo: string
          titulo: string
          updated_at: string
          views: number
        }
        Insert: {
          autor_id: string
          categoria_id?: string | null
          conteudo: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          publicado?: boolean
          slug: string
          tipo_conteudo?: string
          titulo: string
          updated_at?: string
          views?: number
        }
        Update: {
          autor_id?: string
          categoria_id?: string | null
          conteudo?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          publicado?: boolean
          slug?: string
          tipo_conteudo?: string
          titulo?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_attachments: {
        Row: {
          article_id: string
          created_at: string
          enviado_por: string
          id: string
          mime: string | null
          nome: string
          storage_path: string
          tamanho: number
        }
        Insert: {
          article_id: string
          created_at?: string
          enviado_por: string
          id?: string
          mime?: string | null
          nome: string
          storage_path: string
          tamanho: number
        }
        Update: {
          article_id?: string
          created_at?: string
          enviado_por?: string
          id?: string
          mime?: string | null
          nome?: string
          storage_path?: string
          tamanho?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_attachments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      kb_content_types: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          ticket_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          ticket_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          ticket_id?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          inventory_item_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          inventory_item_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          inventory_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_departments_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_toner_links: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          toner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          toner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          toner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_toner_links_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_toner_links_toner_id_fkey"
            columns: ["toner_id"]
            isOneToOne: false
            referencedRelation: "toners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          departamento: string | null
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          departamento?: string | null
          email: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          departamento?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reservation_blocked_dates: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          descricao?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      reservation_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          patrimonio: string | null
          status: Database["public"]["Enums"]["resource_status"]
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          patrimonio?: string | null
          status?: Database["public"]["Enums"]["resource_status"]
          type: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          patrimonio?: string | null
          status?: Database["public"]["Enums"]["resource_status"]
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Relationships: []
      }
      reservation_settings: {
        Row: {
          block_weekends: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          block_weekends?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          block_weekends?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          description: string | null
          end_datetime: string
          id: string
          linked_ticket_id: string | null
          parent_reservation_id: string | null
          resource_id: string
          start_datetime: string
          status: Database["public"]["Enums"]["reservation_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_datetime: string
          id?: string
          linked_ticket_id?: string | null
          parent_reservation_id?: string | null
          resource_id: string
          start_datetime: string
          status?: Database["public"]["Enums"]["reservation_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_datetime?: string
          id?: string
          linked_ticket_id?: string | null
          parent_reservation_id?: string | null
          resource_id?: string
          start_datetime?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_parent_reservation_id_fkey"
            columns: ["parent_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "reservation_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reservations: {
        Row: {
          assunto: string
          created_at: string
          data: string
          departamento: string
          equipamentos: string[]
          hora_fim: string
          hora_inicio: string
          id: string
          observacoes: string | null
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: string
          created_at?: string
          data: string
          departamento: string
          equipamentos?: string[]
          hora_fim: string
          hora_inicio: string
          id?: string
          observacoes?: string | null
          ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string
          created_at?: string
          data?: string
          departamento?: string
          equipamentos?: string[]
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacoes?: string | null
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reservations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_configs: {
        Row: {
          created_at: string
          enabled: boolean
          first_response_minutes: number
          id: string
          priority_id: string
          resolution_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          first_response_minutes?: number
          id?: string
          priority_id: string
          resolution_hours?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          first_response_minutes?: number
          id?: string
          priority_id?: string
          resolution_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_configs_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: true
            referencedRelation: "ticket_priorities"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_status_rules: {
        Row: {
          created_at: string
          finish_sla: boolean
          id: string
          pause_sla: boolean
          status_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finish_sla?: boolean
          id?: string
          pause_sla?: boolean
          status_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finish_sla?: boolean
          id?: string
          pause_sla?: boolean
          status_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_status_rules_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: true
            referencedRelation: "ticket_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      task_columns: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_final: boolean
          nome: string
          ordem: number
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_final?: boolean
          nome: string
          ordem?: number
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_final?: boolean
          nome?: string
          ordem?: number
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_columns_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          color: string | null
          column_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          descricao: string | null
          finished_at: string | null
          finished_by: string | null
          id: string
          owner_id: string | null
          position: number
          prioridade: string
          titulo: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          color?: string | null
          column_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          descricao?: string | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          owner_id?: string | null
          position?: number
          prioridade?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          color?: string | null
          column_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          descricao?: string | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          owner_id?: string | null
          position?: number
          prioridade?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "task_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          enviado_por: string
          id: string
          mime: string | null
          nome: string
          storage_path: string
          tamanho: number
          ticket_id: string
        }
        Insert: {
          created_at?: string
          enviado_por: string
          id?: string
          mime?: string | null
          nome: string
          storage_path: string
          tamanho: number
          ticket_id: string
        }
        Update: {
          created_at?: string
          enviado_por?: string
          id?: string
          mime?: string | null
          nome?: string
          storage_path?: string
          tamanho?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          id: string
          interno: boolean
          ticket_id: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          id?: string
          interno?: boolean
          ticket_id: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          interno?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_history: {
        Row: {
          autor_id: string | null
          campo: string
          created_at: string
          id: string
          ticket_id: string
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          autor_id?: string | null
          campo: string
          created_at?: string
          id?: string
          ticket_id: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          autor_id?: string | null
          campo?: string
          created_at?: string
          id?: string
          ticket_id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_priorities: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_statuses: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          is_fechado: boolean
          is_inicial: boolean
          is_resolvido: boolean
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          is_fechado?: boolean
          is_inicial?: boolean
          is_resolvido?: boolean
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          is_fechado?: boolean
          is_inicial?: boolean
          is_resolvido?: boolean
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          categoria: string
          category_id: string | null
          created_at: string
          criado_por: string
          deleted_at: string | null
          deleted_by: string | null
          descricao: string
          fechado_em: string | null
          first_response_at: string | null
          id: string
          numero: number
          printer_id: string | null
          prioridade: string
          priority_id: string | null
          resolvido_em: string | null
          responsavel_id: string | null
          sla_finished_at: string | null
          sla_pause_started_at: string | null
          sla_paused_seconds: number
          solucao: string | null
          status: string
          status_id: string | null
          titulo: string
          toner_baixado: boolean
          toner_id: string | null
          updated_at: string
        }
        Insert: {
          categoria: string
          category_id?: string | null
          created_at?: string
          criado_por: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao: string
          fechado_em?: string | null
          first_response_at?: string | null
          id?: string
          numero?: number
          printer_id?: string | null
          prioridade?: string
          priority_id?: string | null
          resolvido_em?: string | null
          responsavel_id?: string | null
          sla_finished_at?: string | null
          sla_pause_started_at?: string | null
          sla_paused_seconds?: number
          solucao?: string | null
          status?: string
          status_id?: string | null
          titulo: string
          toner_baixado?: boolean
          toner_id?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          category_id?: string | null
          created_at?: string
          criado_por?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string
          fechado_em?: string | null
          first_response_at?: string | null
          id?: string
          numero?: number
          printer_id?: string | null
          prioridade?: string
          priority_id?: string | null
          resolvido_em?: string | null
          responsavel_id?: string | null
          sla_finished_at?: string | null
          sla_pause_started_at?: string | null
          sla_paused_seconds?: number
          solucao?: string | null
          status?: string
          status_id?: string | null
          titulo?: string
          toner_baixado?: boolean
          toner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "ticket_priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "ticket_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_toner_id_fkey"
            columns: ["toner_id"]
            isOneToOne: false
            referencedRelation: "toners"
            referencedColumns: ["id"]
          },
        ]
      }
      toner_movements: {
        Row: {
          created_at: string
          data: string
          id: string
          inventory_item_id: string | null
          observacoes: string | null
          origem: string
          quantidade: number
          responsavel_id: string | null
          ticket_id: string | null
          tipo: string
          toner_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          inventory_item_id?: string | null
          observacoes?: string | null
          origem: string
          quantidade: number
          responsavel_id?: string | null
          ticket_id?: string | null
          tipo: string
          toner_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          inventory_item_id?: string | null
          observacoes?: string | null
          origem?: string
          quantidade?: number
          responsavel_id?: string | null
          ticket_id?: string | null
          tipo?: string
          toner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toner_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toner_movements_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toner_movements_toner_id_fkey"
            columns: ["toner_id"]
            isOneToOne: false
            referencedRelation: "toners"
            referencedColumns: ["id"]
          },
        ]
      }
      toners: {
        Row: {
          cor: string
          created_at: string
          id: string
          modelo: string
          quantidade: number
          quantidade_minima: number
          updated_at: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          modelo: string
          quantidade?: number
          quantidade_minima?: number
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          modelo?: string
          quantidade?: number
          quantidade_minima?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          dashboard_view: string
          tickets_filter_categoria: string
          tickets_filter_prioridade: string
          tickets_filter_q: string
          tickets_filter_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_view?: string
          tickets_filter_categoria?: string
          tickets_filter_prioridade?: string
          tickets_filter_q?: string
          tickets_filter_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_view?: string
          tickets_filter_categoria?: string
          tickets_filter_prioridade?: string
          tickets_filter_q?: string
          tickets_filter_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_department_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ti: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: undefined
      }
      restore_entity: {
        Args: { _entity_id: string; _entity_type: string }
        Returns: undefined
      }
      soft_delete_entity: {
        Args: { _entity_id: string; _entity_type: string; _metadata?: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "usuario" | "tecnico" | "admin" | "kanban"
      reservation_status: "reservado" | "concluido" | "cancelado"
      resource_status: "disponivel" | "manutencao" | "inativo"
      resource_type: "room" | "equipment"
      ticket_category:
        | "hardware"
        | "software"
        | "rede"
        | "impressoras"
        | "erp"
        | "email"
        | "telefonia"
        | "outros"
      ticket_priority: "baixa" | "media" | "alta" | "critica"
      ticket_status:
        | "aberto"
        | "em_atendimento"
        | "aguardando_usuario"
        | "resolvido"
        | "fechado"
      toner_color: "preto" | "ciano" | "magenta" | "amarelo" | "unico"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["usuario", "tecnico", "admin", "kanban"],
      reservation_status: ["reservado", "concluido", "cancelado"],
      resource_status: ["disponivel", "manutencao", "inativo"],
      resource_type: ["room", "equipment"],
      ticket_category: [
        "hardware",
        "software",
        "rede",
        "impressoras",
        "erp",
        "email",
        "telefonia",
        "outros",
      ],
      ticket_priority: ["baixa", "media", "alta", "critica"],
      ticket_status: [
        "aberto",
        "em_atendimento",
        "aguardando_usuario",
        "resolvido",
        "fechado",
      ],
      toner_color: ["preto", "ciano", "magenta", "amarelo", "unico"],
    },
  },
} as const
