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
      inventory_items: {
        Row: {
          created_at: string
          fabricante: string | null
          id: string
          localizacao: string | null
          modelo: string | null
          numero_serie: string | null
          observacoes: string | null
          patrimonio: string
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fabricante?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          patrimonio: string
          responsavel_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fabricante?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          patrimonio?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
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
          id: string
          publicado: boolean
          slug: string
          titulo: string
          updated_at: string
          views: number
        }
        Insert: {
          autor_id: string
          categoria_id?: string | null
          conteudo: string
          created_at?: string
          id?: string
          publicado?: boolean
          slug: string
          titulo: string
          updated_at?: string
          views?: number
        }
        Update: {
          autor_id?: string
          categoria_id?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          publicado?: boolean
          slug?: string
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
      kb_categories: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
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
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
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
          departamento?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      tickets: {
        Row: {
          categoria: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          criado_por: string
          descricao: string
          fechado_em: string | null
          id: string
          numero: number
          prioridade: Database["public"]["Enums"]["ticket_priority"]
          resolvido_em: string | null
          responsavel_id: string | null
          solucao: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          criado_por: string
          descricao: string
          fechado_em?: string | null
          id?: string
          numero?: number
          prioridade?: Database["public"]["Enums"]["ticket_priority"]
          resolvido_em?: string | null
          responsavel_id?: string | null
          solucao?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          criado_por?: string
          descricao?: string
          fechado_em?: string | null
          id?: string
          numero?: number
          prioridade?: Database["public"]["Enums"]["ticket_priority"]
          resolvido_em?: string | null
          responsavel_id?: string | null
          solucao?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          titulo?: string
          updated_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ti: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "usuario" | "tecnico" | "admin"
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
      app_role: ["usuario", "tecnico", "admin"],
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
    },
  },
} as const
