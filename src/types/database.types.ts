// Tipos TypeScript do banco Supabase (projeto nedthbeekvwzcjrhsghp).
//
// IMPORTANTE: este arquivo cobre, por enquanto, apenas as tabelas usadas
// pela Fase 0/1 da aplicação web. O banco tem mais de 50 tabelas no total.
// Para regenerar o arquivo completo automaticamente (recomendado assim que
// o Supabase CLI estiver instalado localmente):
//
//   npx supabase login
//   npm run gen:types
//
// (o script "gen:types" já está configurado no package.json)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string;
          nome: string;
          cnpj: string | null;
          ativo: boolean | null;
          plano: string;
          status: string;
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          max_usuarios: number | null;
          max_veiculos: number | null;
          termo_aceito_em: string | null;
          termo_aceito_por: string | null;
          logradouro: string | null;
          numero: string | null;
          complemento: string | null;
          bairro: string | null;
          municipio: string | null;
          uf: string | null;
          cep: string | null;
          telefone_contato: string | null;
          email_contato: string | null;
          porte: string | null;
          segmento_transporte: string | null;
          volume_potencial: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas"]["Row"]> & { nome: string };
        Update: Partial<Database["public"]["Tables"]["empresas"]["Row"]>;
        Relationships: [];
      };
      usuarios_app: {
        Row: {
          id: string;
          email: string;
          nome: string | null;
          perfil: string;
          cnpj_vinculado: string | null;
          empresa_nome: string | null;
          ativo: boolean;
          cpf: string | null;
          telefone: string | null;
          segmento: string | null;
          mfa_secret: string | null;
          mfa_habilitado: boolean;
          tour_onboarding_visto: boolean;
          tour_onboarding_visto_em: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["usuarios_app"]["Row"]> & {
          email: string;
          perfil: string;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios_app"]["Row"]>;
        Relationships: [];
      };
      usuarios_empresas: {
        Row: {
          user_email: string;
          empresa_id: string;
          role: string | null;
          ativo: boolean | null;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["usuarios_empresas"]["Row"]> & {
          user_email: string;
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios_empresas"]["Row"]>;
        Relationships: [];
      };
      avaliacoes: {
        Row: {
          id: string;
          empresa_id: string | null;
          user_email: string;
          estrelas: number;
          comentario: string | null;
          resposta_admin: string | null;
          respondido_por: string | null;
          respondido_em: string | null;
          criado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["avaliacoes"]["Row"]> & {
          user_email: string;
          estrelas: number;
        };
        Update: Partial<Database["public"]["Tables"]["avaliacoes"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "avaliacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      permissoes_perfil: {
        Row: {
          id: string;
          funcionalidade: string;
          perfil: string;
          permitido: boolean | null;
          empresa_id: string;
          atualizado_em: string | null;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["permissoes_perfil"]["Row"]> & {
          funcionalidade: string;
          perfil: string;
        };
        Update: Partial<Database["public"]["Tables"]["permissoes_perfil"]["Row"]>;
        Relationships: [];
      };
      grupos_economicos: {
        Row: {
          id: string;
          nome: string;
          cnpj_matriz: string | null;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["grupos_economicos"]["Row"]> & {
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["grupos_economicos"]["Row"]>;
        Relationships: [];
      };
      grupos_economicos_empresas: {
        Row: {
          id: string;
          grupo_economico_id: string;
          empresa_id: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_economico_id: string;
          empresa_id: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["grupos_economicos_empresas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "grupos_economicos_empresas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupos_economicos_empresas_grupo_economico_id_fkey";
            columns: ["grupo_economico_id"];
            isOneToOne: false;
            referencedRelation: "grupos_economicos";
            referencedColumns: ["id"];
          },
        ];
      };
      motoristas: {
        Row: {
          id: string;
          empresa_id: string;
          nome_completo: string;
          cpf: string;
          telefone: string | null;
          email: string | null;
          status: "Ativo" | "Inativo";
          classificacao: "Próprio" | "Agregado";
          cnh: string | null;
          cnh_vencimento: string | null;
          centro_custo_id: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["motoristas"]["Row"]> & {
          empresa_id: string;
          nome_completo: string;
          cpf: string;
        };
        Update: Partial<Database["public"]["Tables"]["motoristas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "motoristas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "motoristas_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
        ];
      };
      cadastro_veiculos: {
        Row: {
          id: string;
          cnpj_frota: string;
          placa: string;
          marca: string | null;
          modelo: string | null;
          motor: string | null;
          ano_modelo: number | null;
          ano_fabricacao: number | null;
          hodometro_atual: number | null;
          combustivel: string | null;
          tanque: number | null;
          autonomia: number | null;
          cor: string | null;
          chassi: string | null;
          renavam: string | null;
          ativo: boolean | null;
          centro_custo_id: string | null;
          centro_custo_nome: string | null;
          municipio: string | null;
          tipo_veiculo: string | null;
          uf_veiculo: string | null;
          numero_eixos: number | null;
          classificacao: "Próprio" | "Agregado" | null;
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["cadastro_veiculos"]["Row"]> & {
          cnpj_frota: string;
          placa: string;
        };
        Update: Partial<Database["public"]["Tables"]["cadastro_veiculos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "cadastro_veiculos_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
        ];
      };
      centros_custo: {
        Row: {
          id: string;
          empresa_id: string | null;
          cnpj_frota: string | null;
          nome: string;
          codigo: string | null;
          descricao: string | null;
          responsavel: string | null;
          ativo: boolean | null;
          criado_por: string | null;
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["centros_custo"]["Row"]> & {
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["centros_custo"]["Row"]>;
        Relationships: [];
      };
      // Histórico de alocação de veículo a centro de custo (Fase 8). Uma
      // linha por período em que uma placa ficou vinculada a um centro de
      // custo: `data_fim = null` significa alocação vigente. Reatribuir o
      // veículo fecha a linha anterior (seta data_fim) e abre uma nova, em
      // vez de sobrescrever — assim dá pra reconstruir "onde esse veículo
      // esteve" em qualquer data passada.
      centros_custo_veiculos: {
        Row: {
          id: string;
          centro_custo_id: string | null;
          empresa_id: string | null;
          cnpj_frota: string | null;
          placa: string;
          data_inicio: string | null;
          data_fim: string | null;
          ativo: boolean | null;
          criado_por: string | null;
          criado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["centros_custo_veiculos"]["Row"]> & {
          placa: string;
        };
        Update: Partial<Database["public"]["Tables"]["centros_custo_veiculos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "centros_custo_veiculos_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
        ];
      };
      // Painel Financeiro (Fase 22): valor planejado por categoria/mês/ano,
      // opcionalmente por centro de custo.
      orcamentos: {
        Row: {
          id: string;
          empresa_id: string;
          centro_custo_id: string | null;
          categoria: string;
          ano: number;
          mes: number;
          valor_planejado: number;
          observacoes: string | null;
          criado_em: string | null;
          criado_por: string | null;
          atualizado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["orcamentos"]["Row"]> & {
          empresa_id: string;
          ano: number;
          mes: number;
          valor_planejado: number;
        };
        Update: Partial<Database["public"]["Tables"]["orcamentos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "orcamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamentos_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
        ];
      };
      // Painel Financeiro (Fase 22): despesas fora do fluxo operacional
      // (abastecimento/manutenção) — seguro, IPVA, licenciamento,
      // rastreamento, multas. origem="api" quando veio de
      // /api/integracoes/custos-fixos em vez de lançamento manual.
      abastecimentos_externos: {
        Row: {
          id: number;
          empresa_id: string;
          provedor: string;
          placa: string;
          motorista_nome: string | null;
          data_abastecimento: string;
          hodometro: number | null;
          posto_nome: string | null;
          posto_cnpj: string | null;
          combustivel: string | null;
          quantidade: number;
          valor_unitario: number | null;
          valor_total: number;
          transacao_externa_id: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["abastecimentos_externos"]["Row"]> & {
          empresa_id: string;
          provedor: string;
          placa: string;
          data_abastecimento: string;
          quantidade: number;
          valor_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["abastecimentos_externos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "abastecimentos_externos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      custos_fixos: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string | null;
          centro_custo_id: string | null;
          tipo: string;
          descricao: string | null;
          valor: number;
          competencia: string;
          recorrente: boolean;
          origem: string;
          criado_em: string | null;
          criado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["custos_fixos"]["Row"]> & {
          empresa_id: string;
          tipo: string;
          valor: number;
          competencia: string;
        };
        Update: Partial<Database["public"]["Tables"]["custos_fixos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "custos_fixos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custos_fixos_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
        ];
      };
      // Chaves de API por empresa (genérico) — já existia no banco, sem uso
      // até a Fase 22, quando virou o mecanismo de autenticação de
      // /api/integracoes/custos-fixos. Só o hash da chave é armazenado.
      api_keys: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          hash_chave: string;
          escopos: Json;
          ativa: boolean | null;
          criada_em: string | null;
          ultimo_uso: string | null;
          revogada_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["api_keys"]["Row"]> & {
          empresa_id: string;
          nome: string;
          hash_chave: string;
        };
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "api_keys_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Registro de aceite do Termo de Adesão — tabela que já existia no
      // banco compartilhado, sem nenhuma tela usando ela até a Fase 23.
      // Escrita só via Edge Function (service role); hash/versão/IP são
      // sempre calculados no servidor, nunca recebidos prontos do client.
      termos_aceite: {
        Row: {
          id: number;
          email: string;
          plano: string;
          hash_termo: string;
          versao_termo: string | null;
          aceito_em: string;
          empresa_id: string | null;
          ip: string | null;
          pagamento_confirmado: boolean | null;
          stripe_session_id: string | null;
          email_enviado: boolean | null;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["termos_aceite"]["Row"]> & {
          email: string;
          plano: string;
          hash_termo: string;
        };
        Update: Partial<Database["public"]["Tables"]["termos_aceite"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "termos_aceite_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Histórico de manutenções por veículo — tabela que já existia no
      // banco compartilhado (comentário original: "alimenta a análise
      // preditiva"), sem nenhuma tela usando ela até a Fase 8.
      manutencoes_realizadas: {
        Row: {
          id: number;
          cnpj_frota: string;
          placa: string;
          data_manutencao: string;
          hodometro: number | null;
          tecnico: string | null;
          oficina: string | null;
          custo_total: number | null;
          itens_realizados: string[] | null;
          obs_gerais: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
          empresa_id: string | null;
          origem: string;
        };
        Insert: Partial<Database["public"]["Tables"]["manutencoes_realizadas"]["Row"]> & {
          cnpj_frota: string;
          placa: string;
          data_manutencao: string;
        };
        Update: Partial<Database["public"]["Tables"]["manutencoes_realizadas"]["Row"]>;
        Relationships: [];
      };
      anp_postos: {
        Row: {
          id: number;
          uf: string | null;
          municipio: string | null;
          razao_social: string | null;
          cnpj: string | null;
          bandeira: string | null;
          endereco: string | null;
          bairro: string | null;
          cep: string | null;
          latitude: number | null;
          longitude: number | null;
          ativo: boolean | null;
          gestao_frotas: boolean;
          autorizacao_anp: string | null;
          situacao: string | null;
          status_sigaf: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["anp_postos"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["anp_postos"]["Row"]>;
        Relationships: [];
      };
      anp_precos_referencia: {
        Row: {
          id: number;
          nivel: "brasil" | "regiao" | "estado" | "municipio" | "capital";
          data_inicial: string;
          data_final: string;
          regiao: string;
          estado: string;
          municipio: string;
          produto: string;
          num_postos_pesquisados: number | null;
          unidade_medida: string | null;
          preco_medio: number | null;
          desvio_padrao: number | null;
          preco_minimo: number | null;
          preco_maximo: number | null;
          coef_variacao: number | null;
          criado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["anp_precos_referencia"]["Row"]> & {
          nivel: "brasil" | "regiao" | "estado" | "municipio" | "capital";
          data_inicial: string;
          data_final: string;
          produto: string;
        };
        Update: Partial<Database["public"]["Tables"]["anp_precos_referencia"]["Row"]>;
        Relationships: [];
      };
      frota_abastecimentos: {
        Row: {
          id: number;
          usuario_email: string;
          id_transacao: number | null;
          data_abastecimento: string | null;
          hora_abastecimento: string | null;
          cnpj_frota: string | null;
          razao_frota: string | null;
          centro_custo: string | null;
          cnpj_posto: string | null;
          nome_posto: string | null;
          cidade_posto: string | null;
          uf_posto: string | null;
          placa: string | null;
          tipo_veiculo: string | null;
          nome_motorista: string | null;
          hod_atual: number | null;
          hod_anterior: number | null;
          km_percorrido: number | null;
          media_km_l: number | null;
          produto: string | null;
          litros: number | null;
          preco_litro: number | null;
          valor_combustivel: number | null;
          valor_total: number | null;
          status_transacao: string | null;
          lat_posto: number | null;
          lon_posto: number | null;
          nome_arquivo: string | null;
          created_at: string | null;
          empresa_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["frota_abastecimentos"]["Row"]> & {
          usuario_email: string;
        };
        Update: Partial<Database["public"]["Tables"]["frota_abastecimentos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "frota_abastecimentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      profrotas_abastecimentos: {
        Row: {
          id: number;
          cnpj_frota: string;
          identificador: number;
          abastecimento_estornado: number | null;
          data_abastecimento: string | null;
          data_atualizacao: string | null;
          data_transacao: string | null;
          status_autorizacao: number | null;
          motivo_recusa: string | null;
          motivo_cancelamento: string | null;
          hodometro: number | null;
          horimetro: number | null;
          frota_cnpj: string | null;
          frota_razao_social: string | null;
          motorista_id: number | null;
          motorista_nome: string | null;
          veiculo_id: number | null;
          veiculo_placa: string | null;
          pv_cnpj: string | null;
          pv_razao_social: string | null;
          pv_posto_interno: boolean | null;
          pv_municipio: string | null;
          pv_uf: string | null;
          pv_latitude: number | null;
          pv_longitude: number | null;
          item_id: string | null;
          item_nome: string | null;
          item_tipo: number | null;
          item_quantidade: number | null;
          item_valor_unitario: number | null;
          item_valor_total: number | null;
          payload_raw: Json | null;
          importado_em: string;
          sync_key: string;
          criado_em: string | null;
          empresa_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["profrotas_abastecimentos"]["Row"]> & {
          cnpj_frota: string;
          identificador: number;
          sync_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["profrotas_abastecimentos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "profrotas_abastecimentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      profrotas_api_keys: {
        Row: {
          id: number;
          cnpj_frota: string;
          nome_empresa: string;
          token: string;
          ativo: boolean;
          data_cadastro: string;
          data_inicio_sync: string;
          ultimo_sync: string | null;
          registros_sync: number | null;
          criado_por: string | null;
          empresa_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["profrotas_api_keys"]["Row"]> & {
          cnpj_frota: string;
          nome_empresa: string;
          token: string;
        };
        Update: Partial<Database["public"]["Tables"]["profrotas_api_keys"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "profrotas_api_keys_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      postos_gf: {
        Row: {
          cnpj: string;
          razao_social: string | null;
          distribuidora: string | null;
          municipio: string | null;
          uf: string | null;
          lat: number | null;
          lon: number | null;
          perfil_venda: string | null;
          horario: string | null;
          funciona_24h: boolean | null;
          pista_caminhao: boolean | null;
          arla: boolean | null;
          conveniencia: boolean | null;
          extras: Json | null;
          versao_id: number | null;
          atualizado_em: string | null;
          empresa_id: string | null;
          bairro: string | null;
          bandeira: string | null;
          tipo_localizacao: string | null;
          tipo_bandeira: string | null;
          grupo_economico: string | null;
          rede: string | null;
          micromercado: string | null;
          status_pdv: string | null;
          situacao_pdv: string | null;
          status_ipiranga: string | null;
          codigo_jde_ipiranga: string | null;
          codigo_jde: string | null;
          taxa_administracao: number | null;
          cep: string | null;
          logradouro: string | null;
          numero: string | null;
          complemento: string | null;
          nome_contato: string | null;
          telefone_contato: string | null;
          email_contato: string | null;
          nome_responsavel: string | null;
          telefone_responsavel: string | null;
          email_responsavel: string | null;
          conveniencia_am_pm: boolean | null;
          possui_restaurante: boolean | null;
          possui_banheiro: boolean | null;
          cobranca_banheiro: boolean | null;
          possui_estacionamento: boolean | null;
          possui_troca_oleo: boolean | null;
          possui_oleo_granel: boolean | null;
          possui_internet: boolean | null;
          tipo_arla: string | null;
          outros_servicos: string | null;
          data_habilitacao: string | null;
          ativo: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["postos_gf"]["Row"]> & { cnpj: string };
        Update: Partial<Database["public"]["Tables"]["postos_gf"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "postos_gf_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      historico_precos: {
        Row: {
          id: number;
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          combustivel: string;
          preco: number;
          fonte: string | null;
          data_ref: string;
          lat: number | null;
          lon: number | null;
          criado_em: string | null;
          empresa_id: string | null;
          codigo_profrotas: string | null;
          codigo_abadi: string | null;
          preco_anterior: number | null;
          preco_referencia: number | null;
          status: string | null;
          status_ponto_venda: string | null;
          origem_alteracao: string | null;
          bandeira: string | null;
          data_atualizacao: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["historico_precos"]["Row"]> & {
          cnpj: string;
          combustivel: string;
          preco: number;
          data_ref: string;
        };
        Update: Partial<Database["public"]["Tables"]["historico_precos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "historico_precos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Tabela compartilhada com a ferramenta interna (Streamlit) que ja
      // existia no banco antes desta Fase 7 -- por isso "tipo" nao tem CHECK
      // constraint e "criado_em" e texto livre (nem sempre ISO 8601 nos
      // registros antigos). Reaproveitamos os mesmos valores de "tipo" do
      // Streamlit ("estado" | "rota" | "busca" | "roteirizacao") para manter
      // compatibilidade.
      rotas_salvas: {
        Row: {
          id: string;
          empresa_id: string | null;
          usuario_email: string;
          nome: string;
          tipo: "estado" | "rota" | "busca" | "roteirizacao";
          dados: Json;
          criado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["rotas_salvas"]["Row"]> & {
          id: string;
          usuario_email: string;
          nome: string;
          tipo: "estado" | "rota" | "busca" | "roteirizacao";
        };
        Update: Partial<Database["public"]["Tables"]["rotas_salvas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "rotas_salvas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Rotograma de Segurança: mapa de pontos de risco e paradas ao longo de
      // uma viagem, para o motorista levar impresso/em PDF. Tabela já existia
      // no banco (compartilhada com a ferramenta Streamlit, nunca usada de
      // fato) -- reaproveitamos o schema existente. "riscos" e "paradas" são
      // listas jsonb de itens (ver RotogramaRisco/RotogramaParada em
      // src/app/(dashboard)/rotograma/tipos.ts).
      rotogramas: {
        Row: {
          id: string;
          numero: number;
          empresa_id: string | null;
          user_email: string;
          origem: string | null;
          destino: string | null;
          veiculo: string | null;
          motorista: string | null;
          placa: string | null;
          data_viagem: string | null;
          carga: string | null;
          observacoes: string | null;
          riscos: Json;
          paradas: Json;
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["rotogramas"]["Row"]> & {
          user_email: string;
        };
        Update: Partial<Database["public"]["Tables"]["rotogramas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "rotogramas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Gestão de Chamados (tickets) — tabela que já existia no banco
      // compartilhado (usada por uma ferramenta anterior, com registros
      // reais), evoluída na Fase 19: comentarios/anexos (colunas antigas,
      // texto-com-JSON) ficam depreciadas — o histórico foi migrado para
      // ticket_comentarios/ticket_anexos abaixo. usuario_visto_em/
      // admin_visto_em sustentam a notificação visual (comparar contra
      // atualizado_em).
      tickets: {
        Row: {
          id: string;
          numero: number;
          empresa_id: string | null;
          user_email: string;
          tipo: "incidente" | "melhoria";
          titulo: string;
          descricao: string;
          status: "aberto" | "em_analise" | "resolvido" | "fechado";
          prioridade: "baixa" | "media" | "alta" | "critica" | null;
          anexos: Json | null;
          resposta_admin: string | null;
          comentarios: string | null;
          criado_em: string | null;
          atualizado_em: string | null;
          usuario_visto_em: string | null;
          admin_visto_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["tickets"]["Row"]> & {
          user_email: string;
          tipo: "incidente" | "melhoria";
          titulo: string;
          descricao: string;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "tickets_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Thread de mensagens entre o usuário do cliente e o admin da FNI —
      // uma linha por comentário, ordenada por criado_em.
      ticket_comentarios: {
        Row: {
          id: string;
          ticket_id: string;
          autor_email: string;
          autor_tipo: "usuario" | "admin";
          texto: string;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ticket_comentarios"]["Row"]> & {
          ticket_id: string;
          autor_email: string;
          autor_tipo: "usuario" | "admin";
          texto: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_comentarios"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ticket_comentarios_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      // Metadados de anexo — o arquivo em si vive no Storage (bucket
      // "ticket-anexos", privado); "url" aqui é o caminho do objeto
      // ("{ticket_id}/{arquivo}"), não uma URL pública — o app gera uma
      // signed URL sob demanda pra download. Linhas com url = null são
      // anexos legados (metadado migrado, conteúdo não recuperável).
      ticket_anexos: {
        Row: {
          id: string;
          ticket_id: string;
          nome: string;
          tipo_mime: string | null;
          tamanho: number | null;
          url: string | null;
          autor_email: string | null;
          criado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ticket_anexos"]["Row"]> & {
          ticket_id: string;
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_anexos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ticket_anexos_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Marca tour_onboarding_visto=true (Fase 24) só na linha do próprio
      // usuário (pelo e-mail do JWT) — SECURITY DEFINER porque não existe
      // policy de UPDATE pro usuário comum em usuarios_app.
      marcar_tour_onboarding_visto: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      empresas_do_usuario: {
        Args: { p_email: string };
        Returns: string[];
      };
      empresa_id_do_cnpj: {
        Args: { p_cnpj: string };
        Returns: string | null;
      };
      // Fase 27.3 — checagem de duplicidade normalizada, chamada pelo app
      // antes de gravar veiculos/motoristas (índices únicos funcionais são a
      // trava definitiva no banco; isso só existe pra dar mensagem amigável).
      veiculo_duplicado: {
        Args: { p_cnpj_frota: string; p_placa: string; p_excluir_id?: string | null };
        Returns: boolean;
      };
      motorista_duplicado: {
        Args: { p_empresa_id: string; p_cpf: string; p_excluir_id?: string | null };
        Returns: boolean;
      };
      // Resolve o vínculo de cadastro_veiculos com uma empresa via cnpj_frota,
      // usando a mesma normalização de empresa_id_do_cnpj (só alfanuméricos,
      // maiúsculo) -- comparar cnpj_frota direto com empresas.cnpj falha
      // porque nem sempre os dois lados vêm formatados igual.
      veiculos_da_empresa: {
        Args: { p_empresa_id: string };
        Returns: Database["public"]["Tables"]["cadastro_veiculos"]["Row"][];
      };
      // Executa uma consulta SELECT/WITH somente leitura, com SECURITY INVOKER
      // (roda com o papel do usuário logado, respeitando RLS normalmente) e
      // várias camadas de validação (bloqueio de DML/DDL, 1 statement só,
      // limite de 200 linhas, timeout de 8s). Usada pelo Assistente IA FNI
      // para consultar o banco sob demanda sem risco de vazar dados entre
      // empresas nem de alterar dados.
      ia_executar_select: {
        Args: { p_sql: string };
        Returns: Json;
      };
      nextval_identificador_manual: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      perfil_usuario_atual: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postos_gf_por_uf: {
        Args: Record<PropertyKey, never>;
        Returns: { uf: string; total: number }[];
      };
      anp_postos_por_uf: {
        Args: Record<PropertyKey, never>;
        Returns: { uf: string; total: number }[];
      };
      postos_gf_municipios_unicos: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      preco_medio_por_combustivel: {
        Args: { p_empresa_id?: string | null };
        Returns: { combustivel: string; preco_medio: number; qtd_postos: number }[];
      };
      postos_gf_top_municipios: {
        Args: { p_limit?: number };
        Returns: { municipio: string; uf: string; total: number }[];
      };
      postos_gf_pontos_mapa: {
        Args: { p_empresa_id?: string | null };
        Returns: { cnpj: string; razao_social: string | null; municipio: string | null; uf: string | null; lat: number; lon: number }[];
      };
      historico_precos_evolucao_mensal: {
        Args: Record<PropertyKey, never>;
        Returns: { mes: string; combustivel: string; preco_medio: number }[];
      };
      historico_precos_serie_uf_combustivel: {
        Args: { p_empresa_id?: string | null };
        Returns: { mes: string; uf: string; combustivel: string; preco_medio: number; qtd: number }[];
      };
      historico_precos_volatilidade_mensal: {
        Args: { p_empresa_id?: string | null };
        Returns: { mes: string; combustivel: string; volatilidade: number; qtd: number }[];
      };
      historico_precos_detalhado: {
        Args: { p_empresa_id?: string | null };
        Returns: {
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          combustivel: string;
          data_ref: string;
          preco: number;
          semana: string;
          mes: string;
        }[];
      };
      relatorio_abastecimentos_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          placa: string | null;
          motorista: string | null;
          produto: string | null;
          litros: number | null;
          valor: number | null;
          preco_litro: number | null;
          cnpj_posto: string | null;
          nome_posto: string | null;
          uf_posto: string | null;
          hodometro: number | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_manutencoes_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          placa: string | null;
          oficina: string | null;
          custo_total: number | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_custos_fixos_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          placa: string | null;
          tipo: string | null;
          descricao: string | null;
          valor: number | null;
          data: string | null;
          recorrente: boolean | null;
          origem: string | null;
          empresa_id: string | null;
        }[];
      };
      abastecimentos_preco_periodo: {
        Args: Record<PropertyKey, never>;
        Returns: { uf: string; semana: string; mes: string; preco_medio: number; qtd: number }[];
      };
      postos_gf_precos_mapa: {
        Args: { p_empresa_id?: string | null };
        Returns: {
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          combustivel: string;
          preco: number;
          lat: number | null;
          lon: number | null;
        }[];
      };
      postos_gf_desvio_anp: {
        Args: { p_empresa_id?: string | null };
        Returns: {
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          combustivel: string;
          categoria_anp: string | null;
          preco_gf: number;
          preco_anp: number;
          nivel_anp: string;
          diff_pct: number;
          diff_rs: number;
        }[];
      };
      abastecimentos_postos_visitados: {
        Args: Record<PropertyKey, never>;
        Returns: {
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          lat: number | null;
          lon: number | null;
          visitas: number;
          preco_medio: number;
          litros_total: number;
        }[];
      };
      postos_gf_servicos: {
        Args: { p_empresa_id?: string | null };
        Returns: {
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          arla: boolean | null;
          funciona_24h: boolean | null;
          possui_banheiro: boolean | null;
          possui_estacionamento: boolean | null;
          possui_internet: boolean | null;
          possui_oleo_granel: boolean | null;
          possui_restaurante: boolean | null;
          possui_troca_oleo: boolean | null;
          pista_caminhao: boolean | null;
          conveniencia: boolean | null;
          conveniencia_am_pm: boolean | null;
        }[];
      };
      postos_gf_distribuidoras_por_uf: {
        Args: Record<PropertyKey, never>;
        Returns: { uf: string; distribuidora: string; total: number }[];
      };
      preco_medio_por_combustivel_uf: {
        Args: Record<PropertyKey, never>;
        Returns: { uf: string; combustivel: string; preco_medio: number; qtd_postos: number }[];
      };
      postos_gf_municipios_por_uf: {
        Args: Record<PropertyKey, never>;
        Returns: { uf: string; municipios: number }[];
      };
      postos_gf_alertas_preco: {
        Args: { p_threshold?: number; p_empresa_id?: string | null };
        Returns: {
          cnpj: string;
          razao_social: string | null;
          municipio: string | null;
          uf: string | null;
          combustivel: string;
          categoria_anp: string;
          preco_gf: number;
          preco_anp: number;
          nivel_anp: string;
          diff_pct: number;
          diff_rs: number;
        }[];
      };
      indicadores_centro_custo: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          centro_custo_id: string;
          centro_custo_nome: string;
          qtd_veiculos: number;
          custo_abastecimento: number;
          litros_abastecidos: number;
          custo_manutencao: number;
          km_rodado: number;
          custo_por_km: number | null;
          consumo_medio: number | null;
        }[];
      };
      indicadores_financeiros: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          custo_combustivel: number;
          litros_abastecidos: number;
          km_rodado: number;
          custo_manutencao: number;
          custo_fixos: number;
          custo_total: number;
          custo_por_km: number | null;
          orcamento_planejado: number;
        }[];
      };
      indicadores_financeiros_evolucao: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          mes: string;
          custo_combustivel: number;
          custo_manutencao: number;
          custo_fixos: number;
        }[];
      };
      indicadores_financeiros_por_centro_custo: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          centro_custo_id: string;
          centro_custo_nome: string;
          custo_combustivel: number;
          custo_manutencao: number;
          custo_fixos: number;
        }[];
      };
      manutencao_preditiva_base: {
        Args: { p_empresa_id: string; p_placa?: string | null };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          tipo_veiculo: string | null;
          is_pesado: boolean;
          centro_custo_id: string | null;
          centro_custo_nome: string | null;
          ano_fabricacao: number | null;
          idade_anos: number;
          km_atual: number;
          consumo_atual: number | null;
          consumo_base: number | null;
          degradacao: number;
          componente: string;
          componente_label: string;
          componente_icone: string;
          peso: number;
          intervalo_km: number;
          score: number;
          km_since: number;
          km_next: number;
          urgencia: "ok" | "alerta" | "critico";
          pct: number;
          fonte: "real" | "estimado";
        }[];
      };
      manutencao_preditiva_resumo: {
        Args: {
          p_empresa_id: string;
          p_centro_custo_id?: string | null;
          p_busca?: string | null;
          p_status?: string | null;
          p_ordenar?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          tipo_veiculo: string | null;
          centro_custo_id: string | null;
          centro_custo_nome: string | null;
          km_atual: number;
          idade_anos: number;
          consumo_atual: number | null;
          degradacao: number;
          score_geral: number;
          status: "ok" | "alerta" | "critico";
          n_criticos: number;
          n_alertas: number;
          total_count: number;
        }[];
      };
      manutencao_preditiva_kpis: {
        Args: { p_empresa_id: string; p_centro_custo_id?: string | null; p_busca?: string | null };
        Returns: {
          total_veiculos: number;
          total_criticos: number;
          total_alertas: number;
          total_ok: number;
          score_medio: number;
        }[];
      };
      indicador_variacao_precos: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          item_nome: string;
          qtd_abastecimentos: number;
          preco_min: number;
          preco_med: number;
          preco_max: number;
          desvio_padrao: number;
          coef_variacao: number;
          uf_referencia: string | null;
          anp_nivel: "estado" | "brasil" | null;
          anp_preco_min: number | null;
          anp_preco_med: number | null;
          anp_preco_max: number | null;
          anp_desvio_padrao: number | null;
          anp_data_referencia: string | null;
        }[];
      };
      indicador_consumo_diario: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: { dia: string; litros: number; valor: number }[];
      };
      indicador_padrao_dia_semana: {
        Args: { p_empresa_id: string; p_dias_lookback?: number | null };
        Returns: { dia_semana: number; media_litros: number }[];
      };
      indicador_volume_postos: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: { posto_cnpj: string; posto_nome: string | null; dia: string; litros: number }[];
      };
      indicador_ranking_veiculos: {
        Args: {
          p_empresa_id: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          gasto_total: number;
          litros_total: number;
          qtd_abastecimentos: number;
          total_count: number;
        }[];
      };
      indicador_ranking_motoristas: {
        Args: {
          p_empresa_id: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          motorista_nome: string;
          gasto_total: number;
          litros_total: number;
          qtd_abastecimentos: number;
          total_count: number;
        }[];
      };
      indicador_eficiencia_veiculos: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          abastecimentos: number;
          km_total: number | null;
          km_medio: number | null;
          media_km_l: number | null;
          litros_total: number;
          preco_medio: number | null;
          custo_total: number | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
