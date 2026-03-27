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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      documentos_lead: {
        Row: {
          arquivo_url: string
          created_at: string
          formato: Database["public"]["Enums"]["formato_doc_enum"]
          id: number
          lead_id: number
          nome_descricao: string
          tamanho_bytes: number | null
          uploaded_by: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          formato: Database["public"]["Enums"]["formato_doc_enum"]
          id?: never
          lead_id: number
          nome_descricao: string
          tamanho_bytes?: number | null
          uploaded_by: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          formato?: Database["public"]["Enums"]["formato_doc_enum"]
          id?: never
          lead_id?: number
          nome_descricao?: string
          tamanho_bytes?: number | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_lead_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_lead_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      exportacoes_log: {
        Row: {
          created_at: string
          exportado_por: string
          filtros_aplicados: Json | null
          id: number
          total_registros: number
        }
        Insert: {
          created_at?: string
          exportado_por: string
          filtros_aplicados?: Json | null
          id?: never
          total_registros: number
        }
        Update: {
          created_at?: string
          exportado_por?: string
          filtros_aplicados?: Json | null
          id?: never
          total_registros?: number
        }
        Relationships: [
          {
            foreignKeyName: "exportacoes_log_exportado_por_fkey"
            columns: ["exportado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_interacoes: {
        Row: {
          anotacao: string
          autor_id: string
          created_at: string
          id: number
          lead_id: number
        }
        Insert: {
          anotacao: string
          autor_id: string
          created_at?: string
          id?: never
          lead_id: number
        }
        Update: {
          anotacao?: string
          autor_id?: string
          created_at?: string
          id?: never
          lead_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_interacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cnpj: string | null
          consultor_id: string
          contato_numero: string | null
          cpf: string | null
          created_at: string
          data_prevista_pagamento: number | null
          email: string | null
          id: number
          motivo_perda_descricao: string | null
          motivo_perda_tipo:
            | Database["public"]["Enums"]["motivo_perda_enum"]
            | null
          necessidade: Database["public"]["Enums"]["necessidade_enum"] | null
          nome: string
          origem: Database["public"]["Enums"]["origem_enum"] | null
          porcentagem_desconto: number | null
          razao_social: string | null
          rg: string | null
          servico_interesse: Database["public"]["Enums"]["servico_enum"] | null
          socios: Json | null
          status: Database["public"]["Enums"]["status_lead_enum"]
          status_financeiro:
            | Database["public"]["Enums"]["status_financeiro_enum"]
            | null
          telefone: string
          ultima_movimentacao_at: string | null
          updated_at: string
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          cnpj?: string | null
          consultor_id: string
          contato_numero?: string | null
          cpf?: string | null
          created_at?: string
          data_prevista_pagamento?: number | null
          email?: string | null
          id?: never
          motivo_perda_descricao?: string | null
          motivo_perda_tipo?:
            | Database["public"]["Enums"]["motivo_perda_enum"]
            | null
          necessidade?: Database["public"]["Enums"]["necessidade_enum"] | null
          nome: string
          origem?: Database["public"]["Enums"]["origem_enum"] | null
          porcentagem_desconto?: number | null
          razao_social?: string | null
          rg?: string | null
          servico_interesse?: Database["public"]["Enums"]["servico_enum"] | null
          socios?: Json | null
          status?: Database["public"]["Enums"]["status_lead_enum"]
          status_financeiro?:
            | Database["public"]["Enums"]["status_financeiro_enum"]
            | null
          telefone: string
          ultima_movimentacao_at?: string | null
          updated_at?: string
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          cnpj?: string | null
          consultor_id?: string
          contato_numero?: string | null
          cpf?: string | null
          created_at?: string
          data_prevista_pagamento?: number | null
          email?: string | null
          id?: never
          motivo_perda_descricao?: string | null
          motivo_perda_tipo?:
            | Database["public"]["Enums"]["motivo_perda_enum"]
            | null
          necessidade?: Database["public"]["Enums"]["necessidade_enum"] | null
          nome?: string
          origem?: Database["public"]["Enums"]["origem_enum"] | null
          porcentagem_desconto?: number | null
          razao_social?: string | null
          rg?: string | null
          servico_interesse?: Database["public"]["Enums"]["servico_enum"] | null
          socios?: Json | null
          status?: Database["public"]["Enums"]["status_lead_enum"]
          status_financeiro?:
            | Database["public"]["Enums"]["status_financeiro_enum"]
            | null
          telefone?: string
          ultima_movimentacao_at?: string | null
          updated_at?: string
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome_completo: string
          role: Database["public"]["Enums"]["role_enum"]
          status: Database["public"]["Enums"]["status_usuario_enum"]
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome_completo: string
          role: Database["public"]["Enums"]["role_enum"]
          status?: Database["public"]["Enums"]["status_usuario_enum"]
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome_completo?: string
          role?: Database["public"]["Enums"]["role_enum"]
          status?: Database["public"]["Enums"]["status_usuario_enum"]
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_logs: {
        Row: {
          created_at: string
          executado_por: string
          id: number
          lead_id: number
          observacao: string | null
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          created_at?: string
          executado_por: string
          id?: never
          lead_id: number
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          created_at?: string
          executado_por?: string
          id?: never
          lead_id?: number
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_logs_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_get_role: { Args: never; Returns: string }
    }
    Enums: {
      formato_doc_enum: "doc" | "docx" | "jpg" | "pdf"
      motivo_perda_enum:
        | "parou_responder"
        | "sem_interesse"
        | "preco"
        | "concorrencia"
        | "outro"
      necessidade_enum:
        | "escritorio_virtual"
        | "salas"
        | "endereco_fiscal"
        | "coworking"
      origem_enum: "indicacao" | "google" | "placa" | "rede_social"
      role_enum: "admin" | "consultor"
      servico_enum:
        | "plano_pro"
        | "plano_premium"
        | "plano_top"
        | "coworking"
        | "sala_special_room"
        | "mini_sala_reuniao"
        | "sala_reuniao_8"
        | "sala_reuniao_12"
        | "salas_fixas"
      status_financeiro_enum: "pago" | "pendente"
      status_lead_enum:
        | "atendimento"
        | "negociacao"
        | "fechado"
        | "perdido"
        | "inativo"
      status_usuario_enum: "ativo" | "inativo"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      formato_doc_enum: ["doc", "docx", "jpg", "pdf"],
      motivo_perda_enum: [
        "parou_responder",
        "sem_interesse",
        "preco",
        "concorrencia",
        "outro",
      ],
      necessidade_enum: [
        "escritorio_virtual",
        "salas",
        "endereco_fiscal",
        "coworking",
      ],
      origem_enum: ["indicacao", "google", "placa", "rede_social"],
      role_enum: ["admin", "consultor"],
      servico_enum: [
        "plano_pro",
        "plano_premium",
        "plano_top",
        "coworking",
        "sala_special_room",
        "mini_sala_reuniao",
        "sala_reuniao_8",
        "sala_reuniao_12",
        "salas_fixas",
      ],
      status_financeiro_enum: ["pago", "pendente"],
      status_lead_enum: [
        "atendimento",
        "negociacao",
        "fechado",
        "perdido",
        "inativo",
      ],
      status_usuario_enum: ["ativo", "inativo"],
    },
  },
} as const
