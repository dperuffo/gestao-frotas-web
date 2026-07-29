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
          // Fase 27.73 — coluna real já existia desde a Fase 20
          // (gravada pelo stripe-webhook em customer.subscription.deleted),
          // mas nunca tinha sido adicionada aqui.
          cancelado_em: string | null;
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
          // Fase 27.92 — chave PIX do posto (cedente do boleto/documento de
          // cobrança), self-service via /minha-empresa.
          pix_chave: string | null;
          // Fase 27.42 — ignora o bloqueio de limite de veículos do plano
          // (verificarLimiteFrota) pra esta empresa. Uso interno/teste,
          // editável só por admin em /clientes/[id].
          bypass_limite_frota: boolean;
          // Fase 27.50 — "Frota" (cliente de gestão de frotas) ou "Revenda"
          // (posto revendedor com conta própria, feature de Negociação).
          segmento: string;
          // Fase 27.108 — ciclo de faturamento + prazo de vencimento do
          // CLIENTE (segmento Frota), único pra qualquer posto/rede com quem
          // negocie. Antes vivia em negociacoes_postos (1 valor por relação
          // posto+cliente) — Daniel corrigiu: "o ciclo é definido para o
          // cliente e nao para a negociacao entre cliente e posto".
          ciclo_faturamento_dias: number;
          prazo_vencimento_dias: number;
          // Fase 27.137 — aba "Meu Posto": localização usada tanto pra
          // comparar com anp_postos (evitar duplicidade) quanto pra
          // posicionar o posto nos cards de consulta/roteirização.
          latitude: number | null;
          longitude: number | null;
          // Fase 27.137 — resultado da checagem contra anp_postos:
          // pendente | confirmado | novo_sem_anp | possivel_duplicidade.
          anp_status: string;
          anp_verificado_em: string | null;
          // Fase 27.141 — dados bancários do posto (self-service via
          // /minha-empresa), base para futuro ajuste de layout de boleto
          // conforme domicílio bancário do estabelecimento. Só captura os
          // dados aqui; nenhuma lógica de boleto usa esses campos ainda.
          banco_codigo: string | null;
          banco_nome: string | null;
          agencia: string | null;
          agencia_digito: string | null;
          conta: string | null;
          conta_digito: string | null;
          tipo_conta: string | null;
          titular_nome: string | null;
          titular_documento: string | null;
          // Fase 27.149 — documentação societária/cadastral (Contrato
          // Social, comprovante de endereço da empresa, docs dos sócios em
          // empresas_socios/empresas_documentos). nao_iniciada | pendente |
          // aprovada | rejeitada — aprovada é pré-requisito pra criar/aderir
          // a Redes de Postos/Grupos Econômicos e pra aceitar/criar
          // negociações. Empresas já existentes na plataforma antes desta
          // fase foram marcadas aprovada automaticamente (grandfather).
          documentacao_status: string;
          documentacao_enviada_em: string | null;
          documentacao_revisado_em: string | null;
          documentacao_revisado_por: string | null;
          documentacao_motivo_rejeicao: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas"]["Row"]> & { nome: string };
        Update: Partial<Database["public"]["Tables"]["empresas"]["Row"]>;
        Relationships: [];
      };
      // Fase 27.149 — sócios cadastrados pela própria empresa (lista
      // dinâmica, reflete o quadro societário do Contrato Social). Cada
      // sócio tem seu próprio conjunto de documentos pessoais em
      // empresas_documentos (socio_id preenchido).
      empresas_socios: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          cpf: string;
          criado_em: string;
          criado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas_socios"]["Row"]> & {
          empresa_id: string;
          nome: string;
          cpf: string;
        };
        Update: Partial<Database["public"]["Tables"]["empresas_socios"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "empresas_socios_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase 27.149 — documentos enviados pra checagem do admin.
      // contrato_social/comprovante_endereco_empresa são a nível de empresa
      // (socio_id null); socio_cpf/socio_identidade/
      // socio_comprovante_endereco são por sócio (socio_id obrigatório).
      // Reenvio SUBSTITUI o documento anterior do mesmo tipo (índices
      // únicos parciais no banco garantem no máximo 1 linha ativa por
      // empresa+tipo ou sócio+tipo — sem histórico de versões antigas).
      empresas_documentos: {
        Row: {
          id: string;
          empresa_id: string;
          tipo: string;
          socio_id: string | null;
          storage_path: string;
          nome_arquivo: string;
          tamanho_bytes: number | null;
          enviado_por: string | null;
          enviado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas_documentos"]["Row"]> & {
          empresa_id: string;
          tipo: string;
          storage_path: string;
          nome_arquivo: string;
        };
        Update: Partial<Database["public"]["Tables"]["empresas_documentos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "empresas_documentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empresas_documentos_socio_id_fkey";
            columns: ["socio_id"];
            isOneToOne: false;
            referencedRelation: "empresas_socios";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase P0.1 — cadastro fiscal do emitente (1:1 com empresas): dados
      // pra emissão de CT-e/MDF-e via provedor de API fiscal. O certificado
      // A1 NUNCA é armazenado — só o vencimento retornado pelo provedor.
      empresas_fiscal: {
        Row: {
          empresa_id: string;
          inscricao_estadual: string | null;
          rntrc: string | null;
          regime_tributario: string;
          serie_cte: number;
          proximo_numero_cte: number;
          serie_mdfe: number;
          proximo_numero_mdfe: number;
          ambiente: string;
          provedor: string;
          provedor_ref: string | null;
          certificado_vencimento: string | null;
          certificado_enviado_em: string | null;
          status_conexao: string | null;
          status_conexao_em: string | null;
          criado_em: string;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas_fiscal"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["empresas_fiscal"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "empresas_fiscal_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase P0.1 — callbacks do provedor fiscal gravados brutos antes de
      // qualquer processamento (mesmo padrão de stripe_events).
      fiscal_webhook_eventos: {
        Row: {
          id: string;
          provedor: string;
          tipo_evento: string | null;
          referencia: string | null;
          payload: Json;
          processado: boolean;
          processado_em: string | null;
          erro_processamento: string | null;
          recebido_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fiscal_webhook_eventos"]["Row"]> & {
          provedor: string;
          payload: Json;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_webhook_eventos"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.6 — mesmo padrão de fiscal_webhook_eventos, pro webhook do
      // provedor de cobrança (Asaas/Cora/simulado).
      cobranca_webhook_eventos: {
        Row: {
          id: string;
          provedor: string;
          tipo_evento: string | null;
          referencia: string | null;
          payload: Json;
          processado: boolean;
          processado_em: string | null;
          erro_processamento: string | null;
          recebido_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cobranca_webhook_eventos"]["Row"]> & {
          provedor: string;
          payload: Json;
        };
        Update: Partial<Database["public"]["Tables"]["cobranca_webhook_eventos"]["Row"]>;
        Relationships: [];
      };
      // Fase 27.73 — tabela já existia desde a Fase 20 (histórico de
      // cobrança, gravada pelo stripe-webhook em invoice.payment_succeeded/
      // failed com status "pago"/"falhou"), mas nunca tinha sido adicionada
      // aqui.
      invoices: {
        Row: {
          id: string;
          empresa_id: string;
          stripe_invoice_id: string | null;
          valor_cents: number;
          status: string;
          periodo_inicio: string | null;
          periodo_fim: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          empresa_id: string;
          valor_cents: number;
          status: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
        Relationships: [];
      };
      negociacoes_postos: {
        Row: {
          id: string;
          empresa_cliente_id: string;
          empresa_posto_id: string | null;
          posto_cnpj: string;
          origem: string;
          status: string;
          rodada_atual: number;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
          // Fase 27.62 — quem fez a última mutação (criar/contrapropor/
          // decidir/cancelar), pra exibir "atualizado por" na tela.
          atualizado_por: string | null;
          // Fase 27.51 — retrato do nome de cada lado no momento da criação,
          // pra não depender de RLS cruzada em empresas (ver nome_empresa_publico).
          cliente_nome: string | null;
          posto_nome: string | null;
          // Fase 27.54 — termos da rodada vencedora, "fotografados" só quando
          // status = aceita (usados pela aba "Vigentes" de /negociacoes).
          vigencia_inicio: string | null;
          vigencia_fim: string | null;
          combustivel: string | null;
          volume_minimo_mensal: number | null;
          preco_unitario: number | null;
          // Fase 27.64 — ciclo de faturamento (dias por fatura) e prazo de
          // vencimento (dias após o fechamento do período), configuráveis
          // por negociação; usados pelo robô gerar_faturas_postos_robo().
          ciclo_faturamento_dias: number;
          prazo_vencimento_dias: number;
        };
        Insert: Partial<Database["public"]["Tables"]["negociacoes_postos"]["Row"]> & {
          empresa_cliente_id: string;
          posto_cnpj: string;
          origem: string;
        };
        Update: Partial<Database["public"]["Tables"]["negociacoes_postos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "negociacoes_postos_empresa_cliente_id_fkey";
            columns: ["empresa_cliente_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "negociacoes_postos_empresa_posto_id_fkey";
            columns: ["empresa_posto_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      negociacoes_postos_rodadas: {
        Row: {
          id: number;
          negociacao_id: string;
          numero_rodada: number;
          autor: string;
          combustivel: string;
          vigencia_inicio: string;
          vigencia_fim: string;
          volume_minimo_mensal: number;
          preco_unitario: number;
          // Fase 27.74 — proposto por rodada (igual combustível/preço/volume),
          // "fotografado" no cabeçalho (negociacoes_postos) quando aceito.
          ciclo_faturamento_dias: number;
          prazo_vencimento_dias: number;
          decisao: string;
          decidido_em: string | null;
          decidido_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["negociacoes_postos_rodadas"]["Row"]> & {
          negociacao_id: string;
          numero_rodada: number;
          autor: string;
          combustivel: string;
          vigencia_inicio: string;
          vigencia_fim: string;
          volume_minimo_mensal: number;
          preco_unitario: number;
        };
        Update: Partial<Database["public"]["Tables"]["negociacoes_postos_rodadas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "negociacoes_postos_rodadas_negociacao_id_fkey";
            columns: ["negociacao_id"];
            isOneToOne: false;
            referencedRelation: "negociacoes_postos";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase 27.65 — solicitação de ajuste em abastecimentos, com aprovação
      // da contraparte (cliente <-> posto). Mesmo espírito de
      // negociacoes_postos: cabeçalho + rodadas (ver
      // ajustes_abastecimentos_rodadas logo abaixo).
      ajustes_abastecimentos: {
        Row: {
          id: string;
          // Fase 27.136a — abastecimento_id virou opcional: um ajuste agora
          // pode ser sobre um abastecimento PróFrotas (abastecimento_id) OU
          // de outro provedor (abastecimento_externo_id) — CHECK no banco
          // garante que exatamente um dos dois está preenchido.
          abastecimento_id: number | null;
          abastecimento_externo_id: number | null;
          empresa_cliente_id: string;
          empresa_posto_id: string;
          origem: string;
          status: string;
          rodada_atual: number;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
          atualizado_por: string | null;
          valor_original: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ajustes_abastecimentos"]["Row"]> & {
          empresa_cliente_id: string;
          empresa_posto_id: string;
          origem: string;
        };
        Update: Partial<Database["public"]["Tables"]["ajustes_abastecimentos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ajustes_abastecimentos_abastecimento_id_fkey";
            columns: ["abastecimento_id"];
            isOneToOne: false;
            referencedRelation: "profrotas_abastecimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_abastecimentos_abastecimento_externo_id_fkey";
            columns: ["abastecimento_externo_id"];
            isOneToOne: false;
            referencedRelation: "abastecimentos_externos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_abastecimentos_empresa_cliente_id_fkey";
            columns: ["empresa_cliente_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_abastecimentos_empresa_posto_id_fkey";
            columns: ["empresa_posto_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      ajustes_abastecimentos_rodadas: {
        Row: {
          id: number;
          ajuste_id: string;
          numero_rodada: number;
          autor: string;
          data_abastecimento: string | null;
          hodometro: number | null;
          item_nome: string | null;
          item_quantidade: number | null;
          item_valor_unitario: number | null;
          item_valor_total: number | null;
          motivo: string | null;
          decisao: string;
          decidido_em: string | null;
          decidido_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ajustes_abastecimentos_rodadas"]["Row"]> & {
          ajuste_id: string;
          numero_rodada: number;
          autor: string;
        };
        Update: Partial<Database["public"]["Tables"]["ajustes_abastecimentos_rodadas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ajustes_abastecimentos_rodadas_ajuste_id_fkey";
            columns: ["ajuste_id"];
            isOneToOne: false;
            referencedRelation: "ajustes_abastecimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      precos_postos: {
        Row: {
          id: string;
          empresa_posto_id: string;
          combustivel: string;
          preco: number;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["precos_postos"]["Row"]> & {
          empresa_posto_id: string;
          combustivel: string;
          preco: number;
        };
        Update: Partial<Database["public"]["Tables"]["precos_postos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "precos_postos_empresa_posto_id_fkey";
            columns: ["empresa_posto_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase 27.64 — faturas (contas a receber) do posto: 1 linha por
      // período fechado de cada negociação, agrupando os abastecimentos
      // fornecidos naquela janela. Geradas pelo robô gerar_faturas_postos_robo().
      faturas_postos: {
        Row: {
          id: string;
          negociacao_id: string;
          empresa_posto_id: string;
          empresa_cliente_id: string;
          // Fase 27.64 (ajuste) — mesmo achado da Fase 27.51: denormalizado
          // pra não depender de RLS cruzada em empresas.
          cliente_nome: string | null;
          periodo_inicio: string;
          periodo_fim: string;
          vencimento: string;
          valor_total: number;
          volume_total: number;
          quantidade_abastecimentos: number;
          status: string;
          pago_em: string | null;
          observacoes: string | null;
          criado_em: string;
          atualizado_em: string;
          atualizado_por: string | null;
          // Fase 27.92 — número sequencial legível (não é o id/uuid), exibido
          // como referência no boleto/documento de cobrança.
          numero_fatura: number;
          // Fase CICLOS-6 — novo modelo de ciclos (janelas fixas + robô em 2
          // fases, ver migração ciclos_fixos_faturas_postos_schema). status
          // agora é 'fechada' | 'a_vencer' | 'paga' | 'cancelada'.
          ciclo_dias_referencia: number;
          data_geracao_boleto: string;
          boleto_gerado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["faturas_postos"]["Row"]> & {
          negociacao_id: string;
          empresa_posto_id: string;
          empresa_cliente_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          vencimento: string;
        };
        Update: Partial<Database["public"]["Tables"]["faturas_postos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "faturas_postos_negociacao_id_fkey";
            columns: ["negociacao_id"];
            isOneToOne: false;
            referencedRelation: "negociacoes_postos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_postos_empresa_posto_id_fkey";
            columns: ["empresa_posto_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_postos_empresa_cliente_id_fkey";
            columns: ["empresa_cliente_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase 27.64 — despesas (contas a pagar) do posto: lançamento manual,
      // mesmo espírito de custos_fixos (Frota).
      despesas_postos: {
        Row: {
          id: string;
          empresa_posto_id: string;
          tipo: string;
          descricao: string | null;
          valor: number;
          competencia: string;
          vencimento: string;
          recorrente: boolean;
          status: string;
          pago_em: string | null;
          criado_em: string;
          criado_por: string | null;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["despesas_postos"]["Row"]> & {
          empresa_posto_id: string;
          tipo: string;
          valor: number;
          competencia: string;
          vencimento: string;
        };
        Update: Partial<Database["public"]["Tables"]["despesas_postos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "despesas_postos_empresa_posto_id_fkey";
            columns: ["empresa_posto_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
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
          // Fase chamados-e-avaliação-motorista — preenchido quando a
          // avaliação vem do PWA motorista (estrada-que-cuida, sessão por
          // telefone, sem e-mail); null pro fluxo normal (web, cliente/posto).
          motorista_id: string | null;
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
      // Fase 27.86 — parâmetros globais do sistema (hoje só o timeout de
      // logout por inatividade). Tabela singleton: sempre exatamente 1
      // linha (PK booleana com constraint `id = true`), não precisa de
      // filtro por empresa/cliente — é o mesmo valor pra toda a plataforma.
      configuracoes_sistema: {
        Row: {
          id: boolean;
          logout_inatividade_minutos: number;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["configuracoes_sistema"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["configuracoes_sistema"]["Row"]>;
        Relationships: [];
      };
      // Fase Central-Treinamento (20/07/2026) — conteúdo de ajuda contextual
      // (ícone "?", tipo='contextual') e lições da Central de Treinamento
      // (tipo='licao'), editável via /administracao/central-conteudo.
      conteudo_ajuda: {
        Row: {
          id: number;
          chave: string;
          tipo: string;
          modulo: string | null;
          ordem: number;
          titulo: string;
          texto: string;
          imagem_path: string | null;
          video_path: string | null;
          perfis: string[] | null;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["conteudo_ajuda"]["Row"]> & {
          chave: string;
          tipo: string;
          titulo: string;
          texto: string;
        };
        Update: Partial<Database["public"]["Tables"]["conteudo_ajuda"]["Row"]>;
        Relationships: [];
      };
      // Fase Central-Comunicados — painel de comunicação (novidades,
      // correções, manutenção/indisponibilidade, avisos gerais), publicado
      // pelo admin (time FNI) em /administracao/central-comunicacao.
      comunicados: {
        Row: {
          id: string;
          tipo: "novidade" | "correcao" | "manutencao" | "aviso_geral";
          urgencia: "informativo" | "atencao" | "critico";
          titulo: string;
          resumo: string;
          corpo: string;
          imagem_path: string | null;
          segmentos_alvo: string[];
          planos_alvo: string[];
          empresas_alvo: string[];
          data_publicacao: string;
          data_expiracao: string | null;
          fixado: boolean;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["comunicados"]["Row"]> & {
          tipo: "novidade" | "correcao" | "manutencao" | "aviso_geral";
          titulo: string;
          resumo: string;
          corpo: string;
        };
        Update: Partial<Database["public"]["Tables"]["comunicados"]["Row"]>;
        Relationships: [];
      };
      // Fase Central-Comunicados — rastreio de leitura por usuário (chave =
      // e-mail, mesmo padrão sem FK usado em negociações/dashboard), guarda
      // servidor-side (não localStorage) pra funcionar entre dispositivos.
      comunicados_leituras: {
        Row: {
          id: string;
          comunicado_id: string;
          usuario_email: string;
          lido_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["comunicados_leituras"]["Row"]> & {
          comunicado_id: string;
          usuario_email: string;
        };
        Update: Partial<Database["public"]["Tables"]["comunicados_leituras"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "comunicados_leituras_comunicado_id_fkey";
            columns: ["comunicado_id"];
            isOneToOne: false;
            referencedRelation: "comunicados";
            referencedColumns: ["id"];
          },
        ];
      };
      grupos_economicos: {
        Row: {
          id: string;
          nome: string;
          cnpj_matriz: string | null;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
          // Fase 27.87 — mesmos valores de empresas.segmento. 'Frota' =
          // Grupo Econômico (cliente); 'Revenda' = Rede de Postos.
          segmento: string;
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
          // Fase tratamento-cnpj-cpf (27/07/2026) — cpf virou opcional pra
          // permitir auto-cadastro a partir da integração de abastecimentos
          // (placa/motorista importados só têm nome, sem CPF); o cliente
          // completa depois. Índice único (motoristas_empresa_cpf_norm_uidx)
          // já era parcial/normalizado, então convive com NULL sem mudança.
          cpf: string | null;
          telefone: string | null;
          email: string | null;
          status: "Ativo" | "Inativo";
          classificacao: "Próprio" | "Agregado";
          cnh: string | null;
          cnh_vencimento: string | null;
          centro_custo_id: string | null;
          // Vínculo automático (trigger) com usuarios_app.email quando o CPF
          // normalizado bate dentro da mesma empresa — não editar manualmente.
          usuario_app_email: string | null;
          // Fase auto-cadastro-abastecimento (27/07/2026) — mesmo espírito de
          // cadastro_veiculos: 'importado' = criado a partir de nome/CPF vindo
          // de uma integração de abastecimento; pendente_revisao some quando
          // o cliente editar e completar o cadastro.
          origem_cadastro: "manual" | "importado";
          pendente_revisao: boolean;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["motoristas"]["Row"]> & {
          empresa_id: string;
          nome_completo: string;
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
      regras_antifraude: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          tipo: "limite_valor_quantidade" | "janela_tempo_frequencia" | "localizacao_posto";
          escopo: "motorista" | "veiculo" | "empresa";
          escopo_referencia: string | null;
          condicoes: Json;
          status: "Ativo" | "Inativo";
          vigencia_inicio: string;
          vigencia_fim: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["regras_antifraude"]["Row"]> & {
          empresa_id: string;
          nome: string;
          tipo: "limite_valor_quantidade" | "janela_tempo_frequencia" | "localizacao_posto";
          escopo: "motorista" | "veiculo" | "empresa";
          condicoes: Json;
        };
        Update: Partial<Database["public"]["Tables"]["regras_antifraude"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "regras_antifraude_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      antifraude_verificacoes_falhas: {
        Row: {
          id: string;
          empresa_id: string;
          detalhe: string;
          abastecimento_referencia: Json | null;
          criado_em: string;
          lida_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["antifraude_verificacoes_falhas"]["Row"]> & {
          empresa_id: string;
          detalhe: string;
        };
        Update: Partial<Database["public"]["Tables"]["antifraude_verificacoes_falhas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "antifraude_verificacoes_falhas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      fidelidade_catalogo_itens: {
        Row: {
          id: string;
          categoria:
            | "economia_imediata"
            | "marketplace_cabine"
            | "saude_estrada"
            | "universidade_estrada"
            | "clube_caminhao"
            | "volte_para_casa"
            | "conveniencia_posto";
          titulo: string;
          descricao: string | null;
          parceiro_nome: string | null;
          pontos_necessarios: number;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
          // Fase parcerias locais — dono do item: null = catálogo global FNI
          // (admin), preenchido = posto ou cliente que criou o benefício
          // (empresas_do_usuario cobre os dois, ambos são linhas de "empresas").
          criador_empresa_id: string | null;
          imagem_url: string | null;
          validade_dias: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fidelidade_catalogo_itens"]["Row"]> & {
          categoria:
            | "economia_imediata"
            | "marketplace_cabine"
            | "saude_estrada"
            | "universidade_estrada"
            | "clube_caminhao"
            | "volte_para_casa"
            | "conveniencia_posto";
          titulo: string;
          pontos_necessarios: number;
        };
        Update: Partial<Database["public"]["Tables"]["fidelidade_catalogo_itens"]["Row"]>;
        Relationships: [];
      };
      fidelidade_resgates: {
        Row: {
          id: string;
          motorista_id: string;
          dependente_id: string | null;
          item_id: string;
          categoria: string;
          titulo: string;
          pontos_gastos: number;
          status: "solicitado" | "em_andamento" | "concluido" | "cancelado";
          solicitado_em: string;
          atualizado_em: string;
          // Fase parcerias locais — snapshot do voucher no momento do resgate.
          numero_voucher: string | null;
          valido_ate: string | null;
          parceiro_nome: string | null;
          imagem_url: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fidelidade_resgates"]["Row"]> & {
          motorista_id: string;
          item_id: string;
          categoria: string;
          titulo: string;
          pontos_gastos: number;
        };
        Update: Partial<Database["public"]["Tables"]["fidelidade_resgates"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "fidelidade_resgates_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase Fretes — rede de motoristas parceiros (terceiros/agregados) de
      // uma empresa, usada pro modo de atribuição direta de frete.
      empresas_motoristas_parceiros: {
        Row: {
          id: string;
          empresa_id: string;
          motorista_id: string;
          status: "convidado" | "ativo" | "recusado" | "removido";
          convidado_por: string | null;
          convidado_em: string;
          respondido_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas_motoristas_parceiros"]["Row"]> & {
          empresa_id: string;
          motorista_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["empresas_motoristas_parceiros"]["Row"]>;
        Relationships: [];
      };
      // Fase Fretes — oferta de frete publicada por um cliente: modo direto
      // (motorista_id já preenchido, status aguardando_confirmacao) ou modo
      // mercado aberto (status disponivel, visível pra rede toda).
      fretes: {
        Row: {
          id: string;
          empresa_id: string;
          plano_viagem_id: string | null;
          titulo: string;
          descricao: string | null;
          origem_label: string;
          origem_lat: number;
          origem_lon: number;
          destino_label: string;
          destino_lat: number;
          destino_lon: number;
          tipo_carga: string | null;
          peso_carga_kg: number | null;
          data_saida_prevista: string | null;
          prazo_entrega: string | null;
          km_estimado: number | null;
          valor_oferecido: number;
          status:
            | "disponivel"
            | "aguardando_confirmacao"
            | "aceito"
            | "em_andamento"
            | "concluido"
            | "cancelado"
            | "recusado";
          motorista_id: string | null;
          // Fase Fretes-Público-Alvo (23/07/26) — alvo da solicitação no
          // mercado aberto: fora_base (rede/parceiros) ou base (próprios).
          publico_alvo: "base" | "fora_base";
          negociacao_aceita_id: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
          coleta_rua: string | null;
          coleta_numero: string | null;
          coleta_bairro: string | null;
          coleta_cidade: string | null;
          coleta_uf: string | null;
          coleta_cep: string | null;
          coleta_referencia: string | null;
          coleta_data: string | null;
          coleta_hora: string | null;
          coleta_contato_nome: string | null;
          coleta_contato_telefone: string | null;
          entrega_rua: string | null;
          entrega_numero: string | null;
          entrega_bairro: string | null;
          entrega_cidade: string | null;
          entrega_uf: string | null;
          entrega_cep: string | null;
          entrega_referencia: string | null;
          entrega_data: string | null;
          entrega_hora: string | null;
          entrega_contato_nome: string | null;
          entrega_contato_telefone: string | null;
          carga_comprimento_m: number | null;
          carga_largura_m: number | null;
          carga_altura_m: number | null;
          veiculos_aceitos: string[];
          carrocerias_aceitas: string[];
          // Fase Fretes-Adiantamento-Combustível (19/07).
          percentual_adiantamento: number;
          saldo_combustivel_tipo: "Valor" | "Volume" | null;
          saldo_combustivel_alocado: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes"]["Row"]> & {
          empresa_id: string;
          titulo: string;
          origem_label: string;
          origem_lat: number;
          origem_lon: number;
          destino_label: string;
          destino_lat: number;
          destino_lon: number;
          valor_oferecido: number;
        };
        Update: Partial<Database["public"]["Tables"]["fretes"]["Row"]>;
        Relationships: [];
      };
      fretes_negociacoes: {
        Row: {
          id: string;
          frete_id: string;
          motorista_id: string;
          status: "aberta" | "aceita" | "recusada" | "retirada" | "perdida";
          rodada_atual: number;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_negociacoes"]["Row"]> & {
          frete_id: string;
          motorista_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_negociacoes"]["Row"]>;
        Relationships: [];
      };
      fretes_negociacoes_rodadas: {
        Row: {
          id: number;
          negociacao_id: string;
          numero_rodada: number;
          autor: "cliente" | "motorista";
          valor_proposto: number;
          mensagem: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_negociacoes_rodadas"]["Row"]> & {
          negociacao_id: string;
          numero_rodada: number;
          autor: "cliente" | "motorista";
          valor_proposto: number;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_negociacoes_rodadas"]["Row"]>;
        Relationships: [];
      };
      // Fase Fretes B — postos recomendados pelo cliente ao longo do trajeto,
      // opcionalmente ligados a um benefício de Parcerias Locais do posto.
      fretes_postos_recomendados: {
        Row: {
          id: string;
          frete_id: string;
          nome_posto: string;
          lat: number | null;
          lon: number | null;
          item_catalogo_id: string | null;
          ordem: number;
          observacao: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_postos_recomendados"]["Row"]> & {
          frete_id: string;
          nome_posto: string;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_postos_recomendados"]["Row"]>;
        Relationships: [];
      };
      // Fase Fretes B — checkpoints da execução (saiu, chegou no posto,
      // abasteceu, parada, chegou no destino, concluído, ocorrência).
      fretes_eventos: {
        Row: {
          id: string;
          frete_id: string;
          tipo_evento:
            | "saiu_origem"
            | "chegou_posto"
            | "abasteceu"
            | "parada"
            | "chegou_destino"
            | "ocorrencia"
            | "concluido";
          posto_recomendado_id: string | null;
          observacao: string | null;
          lat: number | null;
          lon: number | null;
          criado_por: string | null;
          criado_em: string;
          // Fase foto-evidência-checkpoints — caminho no bucket privado
          // `fretes-evidencias` (obrigatório em abasteceu/chegou_destino/
          // concluido/ocorrencia, opcional nos demais tipos).
          foto_path: string | null;
          // Fase P0.4 — obrigatório quando tipo_evento='ocorrencia'.
          codigo_ocorrencia: "atraso" | "avaria" | "recusa" | "reentrega" | "devolucao" | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_eventos"]["Row"]> & {
          frete_id: string;
          tipo_evento:
            | "saiu_origem"
            | "chegou_posto"
            | "abasteceu"
            | "parada"
            | "chegou_destino"
            | "ocorrencia"
            | "concluido";
        };
        Update: Partial<Database["public"]["Tables"]["fretes_eventos"]["Row"]>;
        Relationships: [];
      };
      // Fase Fretes B — avaliação bidirecional (1 a 5 estrelas) ao concluir.
      fretes_avaliacoes: {
        Row: {
          id: string;
          frete_id: string;
          avaliador: "cliente" | "motorista";
          estrelas: number;
          comentario: string | null;
          tags: string[];
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_avaliacoes"]["Row"]> & {
          frete_id: string;
          avaliador: "cliente" | "motorista";
          estrelas: number;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_avaliacoes"]["Row"]>;
        Relationships: [];
      };
      // Fase Fretes-CIOT-CTe (18/07) — documentos registrados por frete,
      // emitidos fora da plataforma (ver src/lib/cte.ts).
      fretes_cte: {
        Row: {
          id: string;
          frete_id: string;
          // Fase P0.2 — nula enquanto o CT-e emitido pelo FNI não é
          // autorizado pela SEFAZ (status 'rascunho'/'enviando'); o
          // caminho de upload sempre grava com chave (só aceita XML já
          // autorizado).
          chave_acesso: string | null;
          numero_cte: string | null;
          serie: string | null;
          protocolo_autorizacao: string | null;
          cnpj_emitente: string | null;
          nome_emitente: string | null;
          valor_prestacao: number | null;
          data_emissao: string | null;
          xml_storage_path: string | null;
          criado_por: string | null;
          criado_em: string;
          // Fase P0.2 — 'upload' (caminho original) ou 'emitido' (CT-e
          // emitido pelo FNI via provedor fiscal).
          origem: string;
          status: string;
          motivo_rejeicao: string | null;
          tomador_cnpj: string | null;
          tomador_nome: string | null;
          tomador_papel: string | null;
          cfop: string | null;
          natureza_operacao: string | null;
          icms_cst: string | null;
          icms_base: number | null;
          icms_aliquota: number | null;
          icms_valor: number | null;
          chaves_nfe: string[];
          provedor_ref: string | null;
          provedor_nome: string | null;
          ambiente: string | null;
          dacte_storage_path: string | null;
          atualizado_em: string;
          // Fase P0.6 — preenchida quando o CT-e entra numa faturas_fretes
          // (impede incluir o mesmo CT-e em duas faturas).
          fatura_frete_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_cte"]["Row"]> & {
          frete_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_cte"]["Row"]>;
        Relationships: [];
      };
      fretes_ciot: {
        Row: {
          id: string;
          frete_id: string;
          numero_ciot: string;
          rntrc: string | null;
          placa_veiculo: string | null;
          valor_frete: number | null;
          data_emissao: string | null;
          observacao: string | null;
          anexo_storage_path: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_ciot"]["Row"]> & {
          frete_id: string;
          numero_ciot: string;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_ciot"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.2 — cadastro reutilizável de remetente/destinatário/tomador
      // pra emissão de CT-e (evita recadastrar tudo em todo frete).
      cadastros_parceiros: {
        Row: {
          id: string;
          empresa_id: string;
          papel: "remetente" | "destinatario" | "tomador";
          cnpj_cpf: string;
          razao_social: string;
          ie: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          endereco_bairro: string | null;
          endereco_municipio: string | null;
          endereco_uf: string | null;
          endereco_cep: string | null;
          telefone: string | null;
          email: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cadastros_parceiros"]["Row"]> & {
          empresa_id: string;
          papel: "remetente" | "destinatario" | "tomador";
          cnpj_cpf: string;
          razao_social: string;
        };
        Update: Partial<Database["public"]["Tables"]["cadastros_parceiros"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.3 — MDF-e: 1 viagem (aqui, 1 frete) = 1 MDF-e por veículo,
      // agrupando N CT-e (ver mdfe_documentos).
      mdfe: {
        Row: {
          id: string;
          frete_id: string;
          empresa_id: string;
          veiculo_id: string | null;
          placa_veiculo: string;
          motorista_id: string | null;
          condutor_nome: string | null;
          condutor_cpf: string | null;
          condutor_adicional_nome: string | null;
          condutor_adicional_cpf: string | null;
          uf_carregamento: string;
          uf_descarregamento: string;
          percurso_uf: string[];
          numero_mdfe: string | null;
          serie: string | null;
          chave_acesso: string | null;
          protocolo_autorizacao: string | null;
          status: string;
          motivo_rejeicao: string | null;
          provedor_ref: string | null;
          provedor_nome: string | null;
          ambiente: string | null;
          data_emissao: string | null;
          encerrado_em: string | null;
          cancelado_em: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["mdfe"]["Row"]> & {
          frete_id: string;
          empresa_id: string;
          placa_veiculo: string;
          uf_carregamento: string;
          uf_descarregamento: string;
        };
        Update: Partial<Database["public"]["Tables"]["mdfe"]["Row"]>;
        Relationships: [];
      };
      mdfe_documentos: {
        Row: {
          id: string;
          mdfe_id: string;
          tipo: "cte" | "nfe";
          chave_acesso: string;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["mdfe_documentos"]["Row"]> & {
          mdfe_id: string;
          tipo: "cte" | "nfe";
          chave_acesso: string;
        };
        Update: Partial<Database["public"]["Tables"]["mdfe_documentos"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.4 — canhoto digital (POD), 1 por frete, gravado via
      // confirmar_entrega_frete.
      fretes_entregas: {
        Row: {
          id: string;
          frete_id: string;
          nome_recebedor: string;
          documento_recebedor: string | null;
          foto_canhoto_path: string;
          assinatura_path: string;
          lat: number | null;
          lon: number | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_entregas"]["Row"]> & {
          frete_id: string;
          nome_recebedor: string;
          foto_canhoto_path: string;
          assinatura_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_entregas"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.4 — romaneio: NF-e do embarcador vinculadas ao frete.
      fretes_nfe: {
        Row: {
          id: string;
          frete_id: string;
          chave_acesso: string;
          numero_nf: number | null;
          serie_nf: string | null;
          natureza_operacao: string | null;
          data_emissao: string | null;
          cnpj_emitente: string | null;
          nome_emitente: string | null;
          cnpj_destinatario: string | null;
          nome_destinatario: string | null;
          valor_nf: number | null;
          peso_bruto_kg: number | null;
          peso_liquido_kg: number | null;
          quantidade_volumes: number | null;
          especie_volume: string | null;
          origem: string;
          xml_storage_path: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_nfe"]["Row"]> & {
          frete_id: string;
          chave_acesso: string;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_nfe"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.5 — tabela de frete (cabeçalho), por cliente-tomador ou
      // geral. Componentes fixos (ad valorem/GRIS/TDE/TDA/despacho/pedágio/
      // ICMS "por dentro") ficam aqui; as faixas de peso (frete-peso) vivem
      // em tabelas_frete_faixas.
      tabelas_frete: {
        Row: {
          id: string;
          empresa_id: string;
          cliente_tomador_id: string | null;
          nome: string;
          ativo: boolean;
          uf_origem: string | null;
          cidade_origem: string | null;
          uf_destino: string | null;
          cidade_destino: string | null;
          percentual_ad_valorem: number;
          percentual_gris: number;
          valor_tde: number;
          valor_tda: number;
          valor_despacho: number;
          valor_pedagio: number;
          percentual_icms: number;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tabelas_frete"]["Row"]> & {
          empresa_id: string;
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["tabelas_frete"]["Row"]>;
        Relationships: [];
      };
      tabelas_frete_faixas: {
        Row: {
          id: string;
          tabela_frete_id: string;
          peso_min_kg: number;
          peso_max_kg: number | null;
          valor_por_kg: number;
          valor_minimo: number;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tabelas_frete_faixas"]["Row"]> & {
          tabela_frete_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tabelas_frete_faixas"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.5 — piso mínimo de frete (Res. ANTT 5.867/2020), tabela
      // NACIONAL (sem empresa_id) importável via XLSX por admin.
      pisos_antt: {
        Row: {
          id: string;
          tipo_carga: string;
          numero_eixos: number;
          coeficiente_deslocamento: number;
          coeficiente_carga_descarga: number;
          vigencia_inicio: string;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pisos_antt"]["Row"]> & {
          tipo_carga: string;
          numero_eixos: number;
          coeficiente_deslocamento: number;
        };
        Update: Partial<Database["public"]["Tables"]["pisos_antt"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.5 — cotações: simula (tabelas_frete + pisos_antt), salva, e
      // converte em frete com um clique.
      cotacoes: {
        Row: {
          id: string;
          empresa_id: string;
          tabela_frete_id: string | null;
          cliente_tomador_id: string | null;
          origem_label: string;
          origem_lat: number;
          origem_lon: number;
          destino_label: string;
          destino_lat: number;
          destino_lon: number;
          km_estimado: number | null;
          peso_kg: number;
          valor_carga: number;
          tipo_carga: string | null;
          numero_eixos: number | null;
          valor_frete_peso: number;
          valor_ad_valorem: number;
          valor_gris: number;
          valor_tde: number;
          valor_tda: number;
          valor_despacho: number;
          valor_pedagio: number;
          valor_icms: number;
          valor_total: number;
          piso_antt_valor: number | null;
          piso_antt_alerta: boolean;
          status: "simulada" | "convertida" | "descartada";
          frete_id: string | null;
          observacoes: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cotacoes"]["Row"]> & {
          empresa_id: string;
          origem_label: string;
          origem_lat: number;
          origem_lon: number;
          destino_label: string;
          destino_lat: number;
          destino_lon: number;
          peso_kg: number;
          valor_carga: number;
        };
        Update: Partial<Database["public"]["Tables"]["cotacoes"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.6 — faturas de frete: agrupa CT-es autorizados por tomador e
      // período (espelha faturas_postos).
      faturas_fretes: {
        Row: {
          id: string;
          empresa_id: string;
          tomador_cnpj: string;
          tomador_nome: string | null;
          numero_fatura: number;
          periodo_inicio: string;
          periodo_fim: string;
          vencimento: string;
          valor_total: number;
          quantidade_ctes: number;
          status: "aberta" | "paga" | "cancelada";
          pago_em: string | null;
          observacoes: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["faturas_fretes"]["Row"]> & {
          empresa_id: string;
          tomador_cnpj: string;
          periodo_inicio: string;
          periodo_fim: string;
          vencimento: string;
        };
        Update: Partial<Database["public"]["Tables"]["faturas_fretes"]["Row"]>;
        Relationships: [];
      };
      faturas_fretes_itens: {
        Row: {
          id: string;
          fatura_frete_id: string;
          frete_cte_id: string;
          frete_id: string;
          valor_prestacao: number;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["faturas_fretes_itens"]["Row"]> & {
          fatura_frete_id: string;
          frete_cte_id: string;
          frete_id: string;
          valor_prestacao: number;
        };
        Update: Partial<Database["public"]["Tables"]["faturas_fretes_itens"]["Row"]>;
        Relationships: [];
      };
      // Fase P0.6 — contas a receber genérico (origem: fatura_frete/
      // fatura_posto/avulso). Primeiro passo do ERP financeiro.
      contas_receber: {
        Row: {
          id: string;
          empresa_id: string;
          origem: "fatura_frete" | "fatura_posto" | "avulso";
          referencia_id: string | null;
          devedor_nome: string | null;
          devedor_cnpj: string | null;
          descricao: string | null;
          parcela_numero: number;
          parcela_total: number;
          valor_original: number;
          percentual_multa: number;
          percentual_juros_mes: number;
          vencimento: string;
          valor_pago: number;
          status: "aberto" | "pago" | "cancelado" | "baixado_parcial";
          pago_em: string | null;
          gateway_nome: string | null;
          gateway_ref: string | null;
          gateway_linha_digitavel: string | null;
          gateway_pix_copia_cola: string | null;
          observacoes: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contas_receber"]["Row"]> & {
          empresa_id: string;
          origem: "fatura_frete" | "fatura_posto" | "avulso";
          valor_original: number;
          vencimento: string;
        };
        Update: Partial<Database["public"]["Tables"]["contas_receber"]["Row"]>;
        Relationships: [];
      };
      contas_receber_baixas: {
        Row: {
          id: string;
          conta_receber_id: string;
          valor: number;
          forma: string | null;
          gateway_ref: string | null;
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contas_receber_baixas"]["Row"]> & {
          conta_receber_id: string;
          valor: number;
        };
        Update: Partial<Database["public"]["Tables"]["contas_receber_baixas"]["Row"]>;
        Relationships: [];
      };
      // Fase Financeiro-ERP (26/07/2026, pedido do Daniel) — substitui,
      // pra abastecimento vindo de um meio de pagamento de verdade (Ticket
      // Log, Edenred, Veloe, RedeFrota, Valecard...), o modelo antigo de
      // ciclos/faturas_postos calculados pela FNI (que continua existindo,
      // mas só pra negociação DIRETA posto↔frotista — ver
      // gerar_faturas_postos_robo() e negociacoes_postos). Mesmo desenho de
      // contas_receber, espelhado pro lado "a pagar": origem +
      // referencia_id apontam pra faturas_recebidas quando vier de
      // integração (origem = "fatura_meio_pagamento"), ou null pra
      // lançamento manual avulso.
      contas_pagar: {
        Row: {
          id: string;
          empresa_id: string;
          // Fase Onda-2 (benchmark TicketLog, itens #4 e #5) — pedido do
          // Daniel: "Custos com multas e oficinas de manutenção devem entrar
          // no contas a pagar do cliente para gestão financeira". 'multa'
          // referencia multas.id; 'orcamento_oficina' referencia
          // solicitacoes_orcamento_oficina.id (ver referencia_id).
          origem: "fatura_meio_pagamento" | "avulso" | "multa" | "orcamento_oficina";
          referencia_id: string | null;
          credor_nome: string | null;
          credor_cnpj: string | null;
          descricao: string | null;
          valor_original: number;
          valor_pago: number;
          vencimento: string;
          status: "aberto" | "pago" | "cancelado" | "baixado_parcial";
          pago_em: string | null;
          observacoes: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contas_pagar"]["Row"]> & {
          empresa_id: string;
          origem: "fatura_meio_pagamento" | "avulso" | "multa" | "orcamento_oficina";
          valor_original: number;
          vencimento: string;
        };
        Update: Partial<Database["public"]["Tables"]["contas_pagar"]["Row"]>;
        Relationships: [];
      };
      contas_pagar_baixas: {
        Row: {
          id: string;
          conta_pagar_id: string;
          valor: number;
          forma: string | null;
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contas_pagar_baixas"]["Row"]> & {
          conta_pagar_id: string;
          valor: number;
        };
        Update: Partial<Database["public"]["Tables"]["contas_pagar_baixas"]["Row"]>;
        Relationships: [];
      };
      // Cabeçalho da fatura enviada pelo meio de pagamento (Hub de
      // Integrações — POST /api/integracoes/faturas-meio-pagamento), com os
      // abastecimentos atrelados (ver abastecimentos_externos.fatura_recebida_id).
      // Sem coluna "status" de propósito — contas_pagar (origem =
      // "fatura_meio_pagamento", referencia_id = este id) é a única fonte
      // de verdade sobre pagamento, pra não duplicar estado.
      faturas_recebidas: {
        Row: {
          id: string;
          empresa_id: string;
          provedor: string;
          numero_fatura_externa: string | null;
          periodo_inicio: string | null;
          periodo_fim: string | null;
          vencimento: string;
          valor_total: number;
          quantidade_abastecimentos: number;
          observacoes: string | null;
          recebida_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["faturas_recebidas"]["Row"]> & {
          empresa_id: string;
          provedor: string;
          vencimento: string;
          valor_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["faturas_recebidas"]["Row"]>;
        Relationships: [];
      };
      // Fase Fretes-Adiantamento-Combustível (19/07) — parcelas de
      // pagamento do frete (entrada + saldo final), geradas automaticamente
      // quando o frete é aceito (ver trg_gerar_pagamentos_frete).
      fretes_pagamentos: {
        Row: {
          id: string;
          empresa_id: string;
          frete_id: string;
          tipo: "adiantamento" | "saldo_final";
          percentual: number;
          valor: number;
          status: "pendente" | "pago";
          pago_em: string | null;
          pago_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fretes_pagamentos"]["Row"]> & {
          empresa_id: string;
          frete_id: string;
          tipo: "adiantamento" | "saldo_final";
          percentual: number;
          valor: number;
        };
        Update: Partial<Database["public"]["Tables"]["fretes_pagamentos"]["Row"]>;
        Relationships: [];
      };
      fidelidade_dependentes: {
        Row: {
          id: string;
          motorista_id: string;
          nome: string;
          parentesco: string | null;
          data_nascimento: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fidelidade_dependentes"]["Row"]> & {
          motorista_id: string;
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["fidelidade_dependentes"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "fidelidade_dependentes_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      fidelidade_missoes: {
        Row: {
          id: string;
          empresa_id: string | null;
          criador_empresa_id: string | null;
          aplica_grupo_economico: boolean;
          codigo: string;
          titulo: string;
          descricao: string;
          icone: string;
          tipo_metrica: string;
          meta: number;
          bonus: number;
          ativa: boolean;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fidelidade_missoes"]["Row"]> & {
          codigo: string;
          titulo: string;
          tipo_metrica: string;
          meta: number;
        };
        Update: Partial<Database["public"]["Tables"]["fidelidade_missoes"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "fidelidade_missoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fidelidade_missoes_criador_empresa_id_fkey";
            columns: ["criador_empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      fidelidade_eventos_engajamento: {
        Row: {
          id: string;
          motorista_id: string;
          tipo_evento: string;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fidelidade_eventos_engajamento"]["Row"]> & {
          motorista_id: string;
          tipo_evento: string;
        };
        Update: Partial<Database["public"]["Tables"]["fidelidade_eventos_engajamento"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "fidelidade_eventos_engajamento_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_vinculo_motorista_veiculo: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string;
          motorista_id: string;
          data_inicio: string;
          data_fim: string | null;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_vinculo_motorista_veiculo"]["Row"]> & {
          empresa_id: string;
          placa: string;
          motorista_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_vinculo_motorista_veiculo"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_vinculo_motorista_veiculo_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parametros_vinculo_motorista_veiculo_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_intervalo_abastecimento: {
        Row: {
          id: string;
          empresa_id: string;
          tipo: "Veiculo" | "Motorista";
          placa: string | null;
          motorista_id: string | null;
          intervalo_minimo: number;
          unidade: "Horas" | "Dias";
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_intervalo_abastecimento"]["Row"]> & {
          empresa_id: string;
          tipo: "Veiculo" | "Motorista";
          intervalo_minimo: number;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_intervalo_abastecimento"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_intervalo_abastecimento_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parametros_intervalo_abastecimento_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_valor_diario_motorista: {
        Row: {
          id: string;
          empresa_id: string;
          motorista_id: string | null;
          valor_maximo: number;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_valor_diario_motorista"]["Row"]> & {
          empresa_id: string;
          valor_maximo: number;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_valor_diario_motorista"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_valor_diario_motorista_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parametros_valor_diario_motorista_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_volume_diario_veiculo: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string | null;
          volume_maximo: number;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_volume_diario_veiculo"]["Row"]> & {
          empresa_id: string;
          volume_maximo: number;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_volume_diario_veiculo"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_volume_diario_veiculo_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_produto_abastecido: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string | null;
          combustiveis_permitidos: string[];
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_produto_abastecido"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_produto_abastecido"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_produto_abastecido_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Parâmetros de NF — regra de emissão de nota fiscal por
      // empresa/CNPJ da frota, consultável por ERPs/automação de posto via
      // API (ver src/app/api/integracoes/parametros-nf/route.ts).
      parametros_nota_fiscal: {
        Row: {
          id: string;
          empresa_id: string;
          cnpj_frota: string | null;
          exige_nota_fiscal: "Sim" | "Não" | "Sem preferência";
          separar_nf_combustivel: "Sim" | "Não" | "Sem preferência";
          forma_emissao:
            | "Nota única por abastecimento"
            | "Nota aglomerada com mais de um abastecimento"
            | "Nota no ato do abastecimento";
          local_destino:
            | "Matriz"
            | "Empresa em que o veículo está cadastrado"
            | "Personalizado CNPJ por Posto"
            | "Personalizado CNPJ por Estado"
            | "Personalizado CNPJ por Abastecimento";
          cnpj_destino_personalizado: string | null;
          dados_adicionais: string | null;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_nota_fiscal"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_nota_fiscal"]["Row"]>;
        Relationships: [];
      };
      // Exceções por UF de "Personalizado CNPJ por Estado" — pedido do
      // Daniel (mockup "Configuração de Envio de Nota Personalizado por
      // Estado"): dentro de uma regra de Parâmetros de NF, cada UF pode
      // apontar pra um CNPJ de destino diferente do CNPJ padrão da regra
      // (parametros_nota_fiscal.cnpj_destino_personalizado).
      parametros_nota_fiscal_destino_uf: {
        Row: {
          id: string;
          parametro_nf_id: string;
          uf: string;
          cnpj_destino: string;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_nota_fiscal_destino_uf"]["Row"]> & {
          parametro_nf_id: string;
          uf: string;
          cnpj_destino: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_nota_fiscal_destino_uf"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_nota_fiscal_destino_uf_parametro_nf_id_fkey";
            columns: ["parametro_nf_id"];
            isOneToOne: false;
            referencedRelation: "parametros_nota_fiscal";
            referencedColumns: ["id"];
          },
        ];
      };
      // Parâmetro de Uso Pré-Pedido — 1 linha por empresa (PK = empresa_id).
      // Quando habilitado=true, criar um Plano de Viagem a partir de uma
      // rota do Roteirizador Inteligente gera um Pré-Pedido automaticamente
      // e passa a restringir abastecimentos no antifraude/verificar (só
      // libera se houver parada pré-agendada pra aquele CNPJ/placa).
      parametros_pre_pedido: {
        Row: {
          empresa_id: string;
          habilitado: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_pre_pedido"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_pre_pedido"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_pre_pedido_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_variacao_hodometro: {
        Row: {
          id: string;
          empresa_id: string;
          classificacao: "Leve" | "Pesado";
          placa: string | null;
          variacao_maxima_km: number;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_variacao_hodometro"]["Row"]> & {
          empresa_id: string;
          classificacao: "Leve" | "Pesado";
          variacao_maxima_km: number;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_variacao_hodometro"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_variacao_hodometro_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_cota_veiculo: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string;
          tipo: "Valor" | "Volume";
          limite: number;
          periodicidade: "Abastecimento" | "Semana" | "Quinzena" | "Mes";
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_cota_veiculo"]["Row"]> & {
          empresa_id: string;
          placa: string;
          tipo: "Valor" | "Volume";
          limite: number;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_cota_veiculo"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_cota_veiculo_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_dias_horarios: {
        Row: {
          id: string;
          empresa_id: string;
          classificacao: "Leve" | "Pesado" | null;
          placa: string | null;
          motorista_id: string | null;
          dias_permitidos: string[];
          hora_inicio: string;
          hora_fim: string;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_dias_horarios"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_dias_horarios"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_dias_horarios_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parametros_dias_horarios_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_postos_permitidos: {
        Row: {
          id: string;
          empresa_id: string;
          classificacao: "Leve" | "Pesado" | null;
          placa: string | null;
          motorista_id: string | null;
          postos_cnpj: string[];
          tipo_limite: "Sem limite" | "Valor" | "Volume";
          valor_maximo: number | null;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_postos_permitidos"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_postos_permitidos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_postos_permitidos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parametros_postos_permitidos_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros_limite_servicos: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string | null;
          motorista_id: string | null;
          postos_cnpj: string[];
          limites: Json;
          status: "Ativo" | "Inativo";
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parametros_limite_servicos"]["Row"]> & {
          empresa_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["parametros_limite_servicos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "parametros_limite_servicos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parametros_limite_servicos_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
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
          // Fase 27.124 — porte do veículo (Leve/Pesado), distinto de
          // tipo_veiculo (carroceria) e classificacao (Próprio/Agregado).
          tipo: "Leve" | "Pesado" | null;
          // Fase auto-cadastro-abastecimento (27/07/2026) — 'importado' =
          // criado automaticamente a partir de placa vinda de uma integração
          // de abastecimento (sem o resto do cadastro ainda); pendente_revisao
          // fica true até o cliente editar e completar os dados.
          origem_cadastro: "manual" | "importado";
          pendente_revisao: boolean;
          // Fase TCO (29/07/2026) — dados de aquisição usados no cálculo de
          // custo total de propriedade (RPCs tco_veiculo/tco_frota_resumo).
          // Opcionais: se valor_aquisicao vier nulo, o TCO é calculado sem
          // depreciação (tco_completo = false).
          valor_aquisicao: number | null;
          data_aquisicao: string | null;
          valor_residual_estimado: number | null;
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
      acoes_sugeridas: {
        Row: {
          id: number;
          empresa_id: string;
          tipo: string;
          alvo_tipo: string;
          alvo_ref: string;
          alvo_label: string;
          titulo: string;
          descricao: string;
          impacto_estimado: Json;
          severidade: string;
          status: string;
          detectado_em: string;
          decidido_em: string | null;
          decidido_por: string | null;
          executado_em: string | null;
          erro_execucao: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["acoes_sugeridas"]["Row"]> & {
          empresa_id: string;
          tipo: string;
          alvo_tipo: string;
          alvo_ref: string;
          alvo_label: string;
          titulo: string;
          descricao: string;
        };
        Update: Partial<Database["public"]["Tables"]["acoes_sugeridas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "acoes_sugeridas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase Bloqueio-por-Anomalia — configuração por tipo (liga/desliga
      // bloqueio de abastecimento quando uma ação sugerida desse tipo é
      // aprovada) e o registro dos bloqueios ativos consultados pela API de
      // Antifraude no ato do abastecimento (ver migration
      // bloqueio_abastecimento_por_anomalia).
      acoes_sugeridas_config_restricao: {
        Row: {
          id: string;
          empresa_id: string;
          tipo: string;
          restringir_abastecimento: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["acoes_sugeridas_config_restricao"]["Row"]> & {
          empresa_id: string;
          tipo: string;
        };
        Update: Partial<Database["public"]["Tables"]["acoes_sugeridas_config_restricao"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "acoes_sugeridas_config_restricao_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      bloqueios_abastecimento: {
        Row: {
          id: number;
          empresa_id: string;
          alvo_tipo: string;
          alvo_ref: string;
          alvo_label: string | null;
          tipo_origem: string;
          motivo: string | null;
          acao_sugerida_id: number | null;
          ativo: boolean;
          criado_em: string;
          criado_por: string | null;
          liberado_em: string | null;
          liberado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["bloqueios_abastecimento"]["Row"]> & {
          empresa_id: string;
          alvo_tipo: string;
          alvo_ref: string;
          tipo_origem: string;
        };
        Update: Partial<Database["public"]["Tables"]["bloqueios_abastecimento"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "bloqueios_abastecimento_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      abastecimentos_externos: {
        Row: {
          id: number;
          empresa_id: string;
          provedor: string;
          placa: string;
          motorista_nome: string | null;
          // Fase fidelidade-por-CPF (23/07/26) — CPF do motorista (dígitos
          // puros), opcional, vindo das APIs de integração; identifica o
          // motorista com certeza na fidelidade/gamificação.
          motorista_cpf: string | null;
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
          // Fase 27.136 — marca quando este abastecimento já entrou numa
          // fatura do posto (mesmo espírito de
          // profrotas_abastecimentos.fatura_posto_id).
          fatura_posto_id: string | null;
          // Fase 27.152 — coluna GERADA (2000000000 + id), faixa própria
          // (começa com "2") pra nunca colidir com o código do lado
          // profrotas (1000000000 + id — mesmo espírito da Fase 27.104, ver
          // profrotas_abastecimentos.codigo_abastecimento). Não é
          // inserível/atualizável.
          codigo_abastecimento: string;
          // Fase Financeiro-ERP (26/07/2026) — preenchido quando este
          // abastecimento veio dentro de uma fatura enviada pelo meio de
          // pagamento (ver faturas_recebidas) em vez de acumulado pelo robô
          // de negociação direta (fatura_posto_id).
          fatura_recebida_id: string | null;
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
          {
            foreignKeyName: "abastecimentos_externos_fatura_recebida_id_fkey";
            columns: ["fatura_recebida_id"];
            isOneToOne: false;
            referencedRelation: "faturas_recebidas";
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
      // lgpd_consents e lgpd_exclusoes já existiam no banco compartilhado
      // (RLS ligado, sem nenhuma policy — só service_role acessava) sem
      // nenhuma tela usando elas até a Fase 27.13. Sem FK declarada pra
      // empresas (por isso Relationships vazio) — o nome do cliente é
      // resolvido em memória, comparando empresa_id com a lista de
      // `empresas` já carregada na página.
      lgpd_consents: {
        Row: {
          id: string;
          email: string;
          empresa_id: string | null;
          tipo: string;
          ip: string | null;
          user_agent: string | null;
          timestamp: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["lgpd_consents"]["Row"]> & {
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["lgpd_consents"]["Row"]>;
        Relationships: [];
      };
      lgpd_exclusoes: {
        Row: {
          id: string;
          empresa_id: string;
          email: string;
          status: string;
          solicitado_em: string | null;
          executado_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["lgpd_exclusoes"]["Row"]> & {
          empresa_id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["lgpd_exclusoes"]["Row"]>;
        Relationships: [];
      };
      // Registro de login de clientes (Fase 27.20) — tabela nova, criada só
      // pra este app (nada de legado). Cada linha é um evento de login
      // bem-sucedido de um usuário não-admin; alimenta o badge de
      // notificação "Clientes" no menu e o painel "Últimos acessos" na tela
      // /clientes. `admin_visto_em` segue o mesmo padrão de
      // tickets.admin_visto_em / avaliacoes.resposta_admin (null = não visto).
      acessos_clientes: {
        Row: {
          id: string;
          empresa_id: string;
          user_email: string;
          criado_em: string;
          admin_visto_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["acessos_clientes"]["Row"]> & {
          empresa_id: string;
          user_email: string;
        };
        Update: Partial<Database["public"]["Tables"]["acessos_clientes"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "acessos_clientes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase 27.46 — achados de detecção de anomalias em abastecimentos
      // (volume acima do tanque, postos distantes no mesmo dia, hodômetro
      // retrocedendo/parado, preço fora da média regional). Gravado pela
      // função detectar_anomalias_abastecimento (ver Functions abaixo);
      // `revisado_em` segue o mesmo padrão null=não visto já usado em
      // acessos_clientes/tickets/avaliacoes.
      anomalias_abastecimento: {
        Row: {
          id: number;
          empresa_id: string;
          tipo: "volume_tanque" | "geo_distancia" | "hodometro" | "preco_regiao";
          severidade: "atencao" | "critica";
          origem: "profrotas" | "externo";
          referencia_id: number;
          placa: string | null;
          motorista_nome: string | null;
          data_abastecimento: string | null;
          descricao: string;
          detalhes: Record<string, unknown>;
          revisado_em: string | null;
          revisado_por: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["anomalias_abastecimento"]["Row"]> & {
          empresa_id: string;
          tipo: "volume_tanque" | "geo_distancia" | "hodometro" | "preco_regiao";
          origem: "profrotas" | "externo";
          referencia_id: number;
          descricao: string;
        };
        Update: Partial<Database["public"]["Tables"]["anomalias_abastecimento"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "anomalias_abastecimento_empresa_id_fkey";
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
          fotos: string[] | null;
        };
        Insert: Partial<Database["public"]["Tables"]["manutencoes_realizadas"]["Row"]> & {
          cnpj_frota: string;
          placa: string;
          data_manutencao: string;
        };
        Update: Partial<Database["public"]["Tables"]["manutencoes_realizadas"]["Row"]>;
        Relationships: [];
      };
      // Fase Pedágios — base pública nacional de praças de pedágio (federais
      // + estaduais), sem empresa_id, mesmo padrão de anp_postos acima.
      // Fonte: OpenStreetMap (barrier=toll_booth) + ANTT (metadados oficiais
      // de rodovia/uf/km quando dá pra cruzar por proximidade geográfica).
      pracas_pedagio: {
        Row: {
          id: number;
          nome: string;
          concessionaria: string | null;
          rodovia: string | null;
          uf: string | null;
          km: number | null;
          municipio: string | null;
          lat: number;
          lon: number;
          valor_carro: number | null;
          valor_moto: number | null;
          valor_caminhao_eixo: number | null;
          fonte: string;
          atualizado_em: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pracas_pedagio"]["Row"]> & {
          nome: string;
          lat: number;
          lon: number;
        };
        Update: Partial<Database["public"]["Tables"]["pracas_pedagio"]["Row"]>;
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
      // Fase 27.94 — catálogo oficial de códigos ANP (Tabela D02.2,
      // combustíveis), usado pra validar o cProdANP de uma NFe.
      anp_codigos_combustivel: {
        Row: {
          codigo_anp: string;
          descricao_anp: string;
        };
        Insert: Partial<Database["public"]["Tables"]["anp_codigos_combustivel"]["Row"]> & {
          codigo_anp: string;
          descricao_anp: string;
        };
        Update: Partial<Database["public"]["Tables"]["anp_codigos_combustivel"]["Row"]>;
        Relationships: [];
      };
      // Fase 27.94 — mapeia o nome de combustível usado no app
      // (precos_postos.combustivel / item_nome) pro código ANP esperado.
      combustiveis_codigo_anp: {
        Row: {
          combustivel: string;
          codigo_anp: string;
        };
        Insert: Partial<Database["public"]["Tables"]["combustiveis_codigo_anp"]["Row"]> & {
          combustivel: string;
          codigo_anp: string;
        };
        Update: Partial<Database["public"]["Tables"]["combustiveis_codigo_anp"]["Row"]>;
        Relationships: [];
      };
      // Fase 27.94 — NFe (modelo 55) de venda de combustível, validada e
      // vinculada 1:1 a um abastecimento (1ª entrega). Ver
      // src/lib/nfe.ts (parse do XML) e src/app/(dashboard)/notas-fiscais/actions.ts.
      notas_fiscais_abastecimento: {
        Row: {
          id: string;
          // Fase 27.136 — exatamente um dos dois é preenchido (CHECK
          // num_nonnulls no banco): abastecimento_id pro lado PróFrotas,
          // abastecimento_externo_id pros demais provedores (Valecard,
          // RedeFrota, TicketLog, Veloe...) — sequências de id
          // independentes, por isso não dá pra reaproveitar a mesma coluna.
          abastecimento_id: number | null;
          abastecimento_externo_id: number | null;
          empresa_posto_id: string;
          empresa_cliente_id: string;
          chave_acesso: string;
          numero_nf: number;
          serie_nf: string;
          modelo: string;
          data_emissao: string;
          cnpj_emitente: string;
          nome_emitente: string;
          cnpj_destinatario: string;
          nome_destinatario: string;
          produto_nome_xml: string;
          produto_codigo_anp: string;
          produto_descricao_anp: string;
          quantidade: number;
          valor_unitario: number;
          valor_total: number;
          valor_nf_total: number;
          xml_storage_path: string;
          enviado_por: string;
          criado_em: string;
        };
        // Sem política de RLS de INSERT/UPDATE — toda escrita passa pela RPC
        // inserir_nota_fiscal_abastecimento (SECURITY DEFINER). O tipo aqui
        // é só pro TS aceitar leitura (.select()); um .insert() direto
        // falharia em runtime por RLS mesmo que compile.
        Insert: Partial<Database["public"]["Tables"]["notas_fiscais_abastecimento"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["notas_fiscais_abastecimento"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_abastecimento_abastecimento_id_fkey";
            columns: ["abastecimento_id"];
            isOneToOne: true;
            referencedRelation: "profrotas_abastecimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      // Regra de ajuste de abastecimento (Fase seguinte a 27.152) — arquivo
      // da NFe removida quando um ajuste é aceito num abastecimento que já
      // tinha nota vinculada (ver decidir_ajuste_abastecimento). Sem
      // política de INSERT/UPDATE — toda escrita passa por essa RPC
      // SECURITY DEFINER; o tipo aqui é só pra leitura (.select()) usada em
      // notas-fiscais/actions.ts pra bloquear reenvio da mesma chave_acesso.
      notas_fiscais_abastecimento_historico: {
        Row: {
          id: string;
          nota_id_original: string;
          abastecimento_id: number | null;
          abastecimento_externo_id: number | null;
          empresa_posto_id: string | null;
          empresa_cliente_id: string | null;
          chave_acesso: string;
          numero_nf: number | null;
          serie_nf: string | null;
          modelo: string | null;
          data_emissao: string | null;
          cnpj_emitente: string | null;
          nome_emitente: string | null;
          cnpj_destinatario: string | null;
          nome_destinatario: string | null;
          produto_nome_xml: string | null;
          produto_codigo_anp: string | null;
          produto_descricao_anp: string | null;
          quantidade: number | null;
          valor_unitario: number | null;
          valor_total: number | null;
          valor_nf_total: number | null;
          xml_storage_path: string | null;
          enviado_por: string | null;
          criado_em: string | null;
          ajuste_id: string | null;
          motivo_exclusao: string;
          excluido_em: string;
          excluido_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notas_fiscais_abastecimento_historico"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["notas_fiscais_abastecimento_historico"]["Row"]>;
        Relationships: [];
      };
      // Fase 27.99 — log de tentativas de upload de NF-e rejeitadas (motivo
      // + dados extraídos do XML pra diagnóstico). Sem política de
      // INSERT/UPDATE — toda escrita passa pela RPC
      // registrar_pendencia_nota_fiscal (SECURITY DEFINER).
      notas_fiscais_pendencias: {
        Row: {
          id: string;
          empresa_posto_id: string;
          abastecimento_id: number | null;
          // Fase 27.136 — mesmo espírito de notas_fiscais_abastecimento:
          // pendência pode apontar pra um abastecimento de outro provedor.
          abastecimento_externo_id: number | null;
          provedor: string | null;
          motivo: string;
          detalhe_texto: string | null;
          cnpj_emitente: string | null;
          cnpj_destinatario: string | null;
          chave_acesso: string | null;
          numero_nf: number | null;
          produto_nome_xml: string | null;
          produto_codigo_anp: string | null;
          quantidade: number | null;
          valor_total: number | null;
          data_emissao_nfe: string | null;
          nome_arquivo: string | null;
          criado_em: string;
          criado_por: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notas_fiscais_pendencias"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["notas_fiscais_pendencias"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_pendencias_abastecimento_id_fkey";
            columns: ["abastecimento_id"];
            isOneToOne: false;
            referencedRelation: "profrotas_abastecimentos";
            referencedColumns: ["id"];
          },
        ];
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
          // Fase 27.104 — coluna GERADA (1000000000 + id), sempre 10
          // dígitos — "código" público/humano do abastecimento, pra busca
          // rápida nos filtros (não é inserível/atualizável).
          codigo_abastecimento: string;
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
          // Fase 27.64 — vínculo com a fatura (conta a receber) do posto que
          // já cobriu este abastecimento; evita faturar o mesmo registro 2x.
          fatura_posto_id: string | null;
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
          {
            foreignKeyName: "profrotas_abastecimentos_fatura_posto_id_fkey";
            columns: ["fatura_posto_id"];
            isOneToOne: false;
            referencedRelation: "faturas_postos";
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
          // Fase 27.137 — de onde veio este registro: planilha_cliente
          // (padrão, importação Excel da Fase 5), auto_cadastro_posto
          // ("Meu Posto") ou meio_pagamento.
          origem: string;
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
      // Fase 27.137 — fila de revisão pra possíveis duplicados sinalizados
      // pelo matching de "Meu Posto" contra anp_postos/postos_gf (endereço/
      // coordenadas muito próximos de outro posto já cadastrado, com CNPJ
      // diferente) — não bloqueia o posto, só entra numa fila pra admin.
      postos_gf_possiveis_duplicados: {
        Row: {
          id: string;
          empresa_id: string;
          cnpj_informado: string;
          anp_postos_id: number | null;
          postos_gf_cnpj_candidato: string | null;
          distancia_metros: number | null;
          status: string;
          revisado_por: string | null;
          revisado_em: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["postos_gf_possiveis_duplicados"]["Row"]> & {
          empresa_id: string;
          cnpj_informado: string;
        };
        Update: Partial<Database["public"]["Tables"]["postos_gf_possiveis_duplicados"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "postos_gf_possiveis_duplicados_empresa_id_fkey";
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
      // Fase 27.48 — Planos de Viagem: orçamento de custo (e receita/margem)
      // por viagem planejada. Link opcional com Rotograma OU rota salva da
      // Roteirização (rota_salva_id), veículo/motorista/centro de custo.
      // pedagios_total/custo_total_estimado/custo_diarias/
      // custo_manutencao_estimado/custo_combustivel_estimado são cache
      // denormalizado, recalculado pela Server Action a cada salvamento
      // (não são generated columns — pedagios_total depende da tabela filha
      // planos_viagem_pedagios).
      planos_viagem: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          status: "rascunho" | "planejado" | "em_andamento" | "concluido" | "cancelado";
          placa: string | null;
          motorista_id: string | null;
          rotograma_id: string | null;
          rota_salva_id: string | null;
          centro_custo_id: string | null;
          data_saida: string | null;
          retorno_previsto: string | null;
          km_estimado: number | null;
          consumo_km_l: number | null;
          preco_combustivel: number | null;
          custo_combustivel_estimado: number;
          custo_combustivel_real: number | null;
          combustivel_real_litros: number | null;
          combustivel_real_revisado_em: string | null;
          n_diarias: number;
          valor_refeicao_dia: number;
          valor_pernoite_dia: number;
          valor_banho_dia: number;
          valor_lavagem_dia: number;
          custo_diarias: number;
          custo_manutencao_km: number;
          custo_manutencao_estimado: number;
          receita_viagem: number;
          pedagios_total: number;
          custo_total_estimado: number;
          custo_total_real: number | null;
          observacoes: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["planos_viagem"]["Row"]> & {
          empresa_id: string;
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["planos_viagem"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "planos_viagem_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      planos_viagem_pedagios: {
        Row: {
          id: number;
          plano_viagem_id: string;
          praca_nome: string;
          valor: number;
          ordem: number;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["planos_viagem_pedagios"]["Row"]> & {
          plano_viagem_id: string;
          praca_nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["planos_viagem_pedagios"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "planos_viagem_pedagios_plano_viagem_id_fkey";
            columns: ["plano_viagem_id"];
            isOneToOne: false;
            referencedRelation: "planos_viagem";
            referencedColumns: ["id"];
          },
        ];
      };
      // Pré-Pedido — gerado automaticamente ao criar um Plano de Viagem
      // quando parametros_pre_pedido.habilitado=true pra empresa. Guarda o
      // número sequencial + os pontos de abastecimento pré-agendados
      // (vindos do Roteirizador Inteligente) pra validação no
      // antifraude/verificar e consulta pelo posto.
      pre_pedidos: {
        Row: {
          id: string;
          empresa_id: string;
          plano_viagem_id: string;
          numero: number;
          placa: string | null;
          motorista_id: string | null;
          status: "ativo" | "concluido" | "cancelado";
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pre_pedidos"]["Row"]> & {
          empresa_id: string;
          plano_viagem_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["pre_pedidos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "pre_pedidos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pre_pedidos_plano_viagem_id_fkey";
            columns: ["plano_viagem_id"];
            isOneToOne: false;
            referencedRelation: "planos_viagem";
            referencedColumns: ["id"];
          },
        ];
      };
      pre_pedidos_paradas: {
        Row: {
          id: string;
          pre_pedido_id: string;
          ordem: number;
          posto_cnpj: string;
          posto_nome: string | null;
          km_previsto: number | null;
          litros_previstos: number | null;
          lat: number | null;
          lon: number | null;
          atendido: boolean;
          atendido_em: string | null;
          abastecimento_referencia: Json | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pre_pedidos_paradas"]["Row"]> & {
          pre_pedido_id: string;
          posto_cnpj: string;
        };
        Update: Partial<Database["public"]["Tables"]["pre_pedidos_paradas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "pre_pedidos_paradas_pre_pedido_id_fkey";
            columns: ["pre_pedido_id"];
            isOneToOne: false;
            referencedRelation: "pre_pedidos";
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
          // Fase chamados-e-avaliação-motorista — preenchido quando o
          // chamado vem do PWA motorista (estrada-que-cuida, sessão por
          // telefone, sem e-mail); null pro fluxo normal (web, cliente/posto).
          motorista_id: string | null;
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
      // Fase Onda-2 (benchmark TicketLog, item #4) — ciclo de multas:
      // captura manual (v1, sem integração Detran/Renainf), indicação de
      // condutor (reaproveita parametros_vinculo_motorista_veiculo pra
      // sugerir), histórico por motorista/veículo, prazo de desconto. Ao
      // criar, lança automaticamente em contas_pagar (origem = "multa").
      multas: {
        Row: {
          id: string;
          empresa_id: string;
          placa: string;
          motorista_id: string | null;
          numero_ait: string | null;
          orgao_autuador: string | null;
          local_infracao: string | null;
          data_infracao: string;
          data_limite_indicacao: string | null;
          descricao: string | null;
          gravidade: string | null;
          pontos: number | null;
          valor_original: number | null;
          valor_desconto: number | null;
          status: string;
          anexo_path: string | null;
          observacoes: string | null;
          indicado_em: string | null;
          indicado_por: string | null;
          pago_em: string | null;
          criado_em: string;
          criado_por: string | null;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["multas"]["Row"]> & {
          empresa_id: string;
          placa: string;
          data_infracao: string;
        };
        Update: Partial<Database["public"]["Tables"]["multas"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "multas_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "motoristas";
            referencedColumns: ["id"];
          },
        ];
      };
      // Fase Onda-2 (benchmark TicketLog, item #5) — catálogo nacional de
      // oficinas credenciadas (mesmo padrão de postos_gf: leitura aberta a
      // qualquer usuário autenticado, escrita só admin via
      // /administracao/oficinas-credenciadas).
      oficinas_credenciadas: {
        Row: {
          id: string;
          nome: string;
          cnpj: string | null;
          especialidades: string[];
          telefone: string | null;
          email: string | null;
          endereco: string | null;
          municipio: string | null;
          uf: string | null;
          avaliacao_media: number | null;
          ativo: boolean;
          criado_em: string;
          criado_por: string | null;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["oficinas_credenciadas"]["Row"]> & { nome: string };
        Update: Partial<Database["public"]["Tables"]["oficinas_credenciadas"]["Row"]>;
        Relationships: [];
      };
      // Fase Onda-2 (benchmark TicketLog, item #5) — fluxo simples de
      // cotação por tenant: cliente solicita, gestor registra o retorno
      // (valor/prazo) recebido por telefone/e-mail (sem portal pra oficina
      // responder na v1) e decide aceitar/recusar. Ao aceitar, lança em
      // contas_pagar (origem = "orcamento_oficina").
      solicitacoes_orcamento_oficina: {
        Row: {
          id: string;
          empresa_id: string;
          oficina_id: string;
          placa: string | null;
          descricao_servico: string;
          status: string;
          valor_orcado: number | null;
          prazo_execucao: string | null;
          observacoes_oficina: string | null;
          criado_em: string;
          criado_por: string | null;
          respondido_em: string | null;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["solicitacoes_orcamento_oficina"]["Row"]> & {
          empresa_id: string;
          oficina_id: string;
          descricao_servico: string;
        };
        Update: Partial<Database["public"]["Tables"]["solicitacoes_orcamento_oficina"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "solicitacoes_orcamento_oficina_oficina_id_fkey";
            columns: ["oficina_id"];
            isOneToOne: false;
            referencedRelation: "oficinas_credenciadas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      // Fase 27.121 — view usada só pra somar consumo de cota (por
      // enquanto), colunas mínimas usadas pelo app (não é a lista completa
      // da view no banco). Ver README Fase 27.94/27.119 pra mais contexto
      // sobre a view em si.
      abastecimentos_unificado: {
        Row: {
          provedor: string | null;
          empresa_id: string | null;
          placa: string | null;
          motorista_nome: string | null;
          data_abastecimento: string | null;
          hodometro: number | null;
          posto_cnpj: string | null;
          posto_nome: string | null;
          municipio: string | null;
          uf: string | null;
          lat: number | null;
          lon: number | null;
          produto: string | null;
          litros: number | null;
          preco_litro: number | null;
          valor_total: number | null;
          // Fase 27.135 — id em texto (as duas fontes usam bigint de
          // sequências diferentes). Fase 27.152 — código de 10 dígitos dos
          // dois lados agora (1xxxxxxxxx = profrotas, 2xxxxxxxxx = externo/
          // API/planilha — ver comentário em
          // abastecimentos_externos.codigo_abastecimento).
          id: string | null;
          codigo_abastecimento: string | null;
        };
        Relationships: [];
      };
    };
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
      // Fase 27.137 — tela "Meu Posto": atualiza o cadastro da empresa,
      // compara CNPJ/coordenadas com anp_postos (e postos_gf de outros
      // donos) e faz upsert em postos_gf — nunca bloqueia, só sinaliza
      // possível duplicidade (fila postos_gf_possiveis_duplicados) pra
      // revisão de admin. Retorna { ok, status? } ou { ok: false, motivo }.
      verificar_e_registrar_posto_anp: {
        Args: {
          p_empresa_id: string;
          p_cnpj: string;
          p_razao_social: string;
          p_logradouro: string | null;
          p_numero: string | null;
          p_complemento: string | null;
          p_bairro: string | null;
          p_municipio: string | null;
          p_uf: string | null;
          p_cep: string | null;
          p_telefone: string | null;
          p_email: string | null;
          p_latitude: number | null;
          p_longitude: number | null;
        };
        Returns: Json;
      };
      empresa_id_do_cnpj: {
        Args: { p_cnpj: string };
        Returns: string | null;
      };
      // Fase 27.139 — cria uma Rede de Postos self-service: grupo +
      // primeiro vínculo (posto fundador) na mesma transação, como dono da
      // função — evita o problema de RETURNING sobre uma Rede recém-criada
      // sem membro nenhum ainda (grupos_select exigiria já pertencer ao
      // grupo pra devolver a linha do INSERT). Aceita tanto o próprio
      // posto (precisa controlar p_empresa_id) quanto admin/superusuário.
      // Retorna { ok: true, id } ou { ok: false, erro }.
      criar_rede_posto_self_service: {
        Args: { p_nome: string; p_cnpj_matriz: string | null; p_empresa_id: string };
        Returns: Json;
      };
      // Fase 27.138 — 1º nível da cascata de preço "vigente" (ver
      // resolverPrecosVigentes em src/lib/precoVigente.ts): última
      // transação real de qualquer provedor naquele posto, últimos 60 dias.
      // SECURITY DEFINER — abastecimentos_unificado é security_invoker, e
      // aqui o objetivo é um preço de referência agregado visível a
      // qualquer cliente, não só quem já tem abastecimento próprio ali.
      preco_meios_pagamento_por_posto: {
        Args: { p_posto_cnpj: string };
        Returns: { produto: string; preco_litro: number; data_abastecimento: string }[];
      };
      // Fase 27.51 — devolve só o nome de uma empresa, sem checar RLS
      // (SECURITY DEFINER) — usada só pra "fotografar" o nome da contraparte
      // ao criar uma negociação (negociacoes_postos.cliente_nome/posto_nome).
      nome_empresa_publico: {
        Args: { p_empresa_id: string };
        Returns: string | null;
      };
      // Fase FLT-2 (achado real) — mesmo espírito de nome_empresa_publico,
      // em lote: usada onde é preciso resolver nome de VÁRIAS empresas de
      // uma vez (ex: clientesOpcoes em AbastecimentosPosto.tsx) sem cair na
      // RLS cruzada de um SELECT direto em `empresas` (empresas_select_membro
      // só libera pra quem é membro/admin/superusuário).
      nomes_empresas_publico: {
        Args: { p_empresa_ids: string[] };
        Returns: { id: string; nome: string | null }[];
      };
      // Fase FLT-2 — mesmo espírito de nome_empresa_publico, mas pros 2
      // campos usados pelo gate exigirDocumentacaoAprovada
      // (empresasDocumentos.ts): documentacao_status + nome, sem checar RLS
      // (SECURITY DEFINER) — necessário porque esse gate às vezes precisa
      // checar a documentação da CONTRAPARTE (ex: posto criando negociação
      // com um cliente do qual não é membro), não só da própria empresa.
      status_documentacao_empresa_publico: {
        Args: { p_empresa_id: string };
        Returns: { documentacao_status: string | null; nome: string | null }[];
      };
      // Fase 27.65 — decide (aceita/recusa) um ajuste de abastecimento;
      // SECURITY DEFINER porque aplica os campos aceitos em
      // profrotas_abastecimentos independente de qual lado (cliente ou
      // posto) está decidindo — a RLS comum de update dessa tabela não
      // cobre os dois sentidos.
      decidir_ajuste_abastecimento: {
        Args: { p_ajuste_id: string; p_decisao: string; p_decidido_por: string | null };
        Returns: undefined;
      };
      // Fase 27.68 — resolve o id de uma empresa por CNPJ normalizado +
      // segmento, ignorando a RLS de `empresas` (empresas_select_membro só
      // libera ver empresas das quais o usuário é membro) — usada em
      // abastecimentos/[id]/page.tsx pra descobrir se o posto do
      // abastecimento está cadastrado na plataforma, mesmo quando quem está
      // olhando é o cliente (que nunca é "membro" do posto).
      resolver_empresa_por_cnpj_segmento: {
        Args: { p_cnpj: string; p_segmento: string };
        Returns: string;
      };
      // Fase 27.69 — resumo agregado (dia, combustível, quantidade, volume,
      // receita) dos abastecimentos fornecidos por um posto — devolve no
      // máximo dias×combustíveis linhas, imune ao limite de 1000 linhas do
      // PostgREST que afetava a busca de linhas brutas em DashboardPosto.tsx.
      resumo_vendas_diarias_posto: {
        Args: { p_pv_cnpj: string; p_desde: string };
        Returns: { dia: string; item_nome: string; quantidade: number; volume: number; receita: number }[];
      };
      // Fase 27.72 — lista os clientes (qualquer status de negociação) que já
      // negociaram com o posto informado, com dados de cadastro de `empresas`
      // — SECURITY DEFINER porque a RLS de `empresas` bloqueia SELECT
      // cross-tenant (mesmo problema da Fase 27.68), mas só expõe clientes
      // com quem o posto chamador tem uma negociação real (guarda de
      // autorização própria dentro da função).
      clientes_do_posto: {
        Args: { p_empresa_posto_id: string };
        Returns: {
          id: string;
          nome: string;
          cnpj: string | null;
          municipio: string | null;
          uf: string | null;
          porte: string | null;
          segmento_transporte: string | null;
          telefone_contato: string | null;
          email_contato: string | null;
          status_negociacao: string;
          negociacoes_count: number;
          ultima_atualizacao: string | null;
        }[];
      };
      // Fase 27.84 — ciclo de faturamento EM ANDAMENTO (ainda não fechado
      // pelo robô gerar_faturas_postos_robo()) de cada negociação aceita
      // visível ao chamador, com os abastecimentos acumulados até hoje.
      // SECURITY DEFINER com guarda manual (mesmo padrão da Fase 27.79).
      ciclos_abertos_postos: {
        Args: Record<PropertyKey, never>;
        Returns: {
          negociacao_id: string;
          empresa_posto_id: string;
          empresa_cliente_id: string;
          posto_nome: string | null;
          cliente_nome: string | null;
          periodo_inicio: string;
          periodo_fim_previsto: string;
          vencimento_previsto: string;
          // Fase 27.105 — valor_acumulado/volume_acumulado/quantidade_abastecimentos
          // agora contam só quem JÁ TEM NF-e (o que efetivamente vira fatura se
          // o ciclo fechar agora — regra "só fatura com NF-e vinculada").
          valor_acumulado: number;
          volume_acumulado: number;
          quantidade_abastecimentos: number;
          // Fase 27.105 — o que está represado nesse período esperando NF-e
          // (não vai entrar na próxima fatura enquanto não tiver nota).
          valor_pendente_nfe: number;
          quantidade_pendente_nfe: number;
        }[];
      };
      // Fase 27.79 — extrato de abastecimentos de uma fatura_posto, com CNPJ
      // do posto normalizado (negociacoes_postos.posto_cnpj sem pontuação vs
      // profrotas_abastecimentos.pv_cnpj formatado — comparação direta
      // sempre falhava). NÃO é SECURITY DEFINER: reaproveita a mesma RLS já
      // existente em profrotas_abastecimentos (cliente via empresa_id, posto
      // via pv_cnpj normalizado).
      abastecimentos_da_fatura: {
        Args: { p_fatura_id: string };
        Returns: {
          id: number;
          data_abastecimento: string | null;
          motorista_nome: string | null;
          veiculo_placa: string | null;
          item_nome: string | null;
          item_quantidade: number | null;
          item_valor_unitario: number | null;
          item_valor_total: number | null;
        }[];
      };
      // Fase 27.93 — mesmo formato de abastecimentos_da_fatura, mas pro
      // ciclo AINDA ABERTO (não fechado em fatura) de uma negociação —
      // recalcula o período em aberto com a mesma lógica de
      // ciclos_abertos_postos() (Fase 27.84) e devolve as linhas
      // individuais (não só o agregado). SECURITY DEFINER + guarda manual.
      abastecimentos_do_ciclo_aberto: {
        Args: { p_negociacao_id: string };
        Returns: {
          id: number;
          data_abastecimento: string | null;
          motorista_nome: string | null;
          veiculo_placa: string | null;
          item_nome: string | null;
          item_quantidade: number | null;
          item_valor_unitario: number | null;
          item_valor_total: number | null;
          // Fase 27.105 — distingue quem já tem NF-e (vai entrar na próxima
          // fatura) de quem ainda está represado esperando nota.
          tem_nfe: boolean;
        }[];
      };
      // Fase 27.92 — dados de cedente (posto) e sacado (cliente) pro
      // boleto/documento de cobrança de uma fatura. Mesmo padrão de
      // segurança de abastecimentos_da_fatura: SECURITY DEFINER + guarda
      // manual (cross-tenant, nenhuma RLS direta em `empresas` cobriria
      // enxergar os dados da CONTRAPARTE).
      dados_boleto_fatura: {
        Args: { p_fatura_id: string };
        Returns: {
          numero_fatura: number;
          posto_nome: string | null;
          posto_cnpj: string | null;
          posto_logradouro: string | null;
          posto_numero: string | null;
          posto_complemento: string | null;
          posto_bairro: string | null;
          posto_municipio: string | null;
          posto_uf: string | null;
          posto_cep: string | null;
          posto_pix_chave: string | null;
          cliente_nome: string | null;
          cliente_cnpj: string | null;
          cliente_logradouro: string | null;
          cliente_numero: string | null;
          cliente_complemento: string | null;
          cliente_bairro: string | null;
          cliente_municipio: string | null;
          cliente_uf: string | null;
          cliente_cep: string | null;
        }[];
      };
      // Fase 27.94 — busca abastecimentos candidatos a corresponder a uma
      // NFe recém-lida (por CNPJ emitente/destinatário, janela de data,
      // tolerância de quantidade/valor). Tem 2 overloads no banco: esta
      // (5 args, autoriza por e-mail/JWT — usada pela Server Action do
      // navegador) e uma com o 6º arg opcional
      // p_empresa_posto_id_confiavel (só o service_role pode chamar — usada
      // pela API de integração do ERP do posto, /api/integracoes/notas-fiscais).
      buscar_abastecimentos_candidatos_nota_fiscal: {
        Args: {
          p_cnpj_emitente: string;
          p_cnpj_destinatario: string;
          p_data_emissao: string;
          p_quantidade: number;
          p_valor_total: number;
          p_empresa_posto_id_confiavel?: string;
        };
        Returns: {
          abastecimento_id: number;
          // Fase 27.136 — de qual fonte veio o candidato: "profrotas" ou o
          // nome do provedor externo (Valecard/RedeFrota/TicketLog/Veloe).
          // Necessário pro chamador saber qual overload/ramo usar ao
          // inserir a NF-e (as 2 tabelas-fonte têm sequências de id
          // independentes).
          provedor: string;
          data_abastecimento: string;
          veiculo_placa: string | null;
          motorista_nome: string | null;
          item_nome: string | null;
          item_quantidade: number;
          item_valor_unitario: number;
          item_valor_total: number;
        }[];
      };
      // Fase 27.94 — revalida tudo server-side (CNPJ, duplicidade de chave
      // de acesso, tolerância, código ANP) e grava a NF-e. Mesmos 2
      // overloads que buscar_abastecimentos_candidatos_nota_fiscal acima —
      // os 2 últimos args só existem no overload confiável (API/ERP).
      inserir_nota_fiscal_abastecimento: {
        Args: {
          p_abastecimento_id: number;
          // Fase 27.136 — qual das 2 tabelas-fonte o p_abastecimento_id
          // acima se refere ("profrotas" ou o nome do provedor externo).
          p_provedor: string;
          p_chave_acesso: string;
          p_numero_nf: number;
          p_serie_nf: string;
          p_modelo: string;
          p_data_emissao: string;
          p_cnpj_emitente: string;
          p_nome_emitente: string;
          p_cnpj_destinatario: string;
          p_nome_destinatario: string;
          p_produto_nome_xml: string;
          p_produto_codigo_anp: string;
          p_produto_descricao_anp: string;
          p_quantidade: number;
          p_valor_unitario: number;
          p_valor_total: number;
          p_valor_nf_total: number;
          p_xml_storage_path: string;
          p_empresa_posto_id_confiavel?: string;
          p_enviado_por?: string;
        };
        Returns: Json;
      };
      // Fase 27.94/27.95 — listagem paginada dos abastecimentos com status
      // de NF-e (emitida/pendente), pra tela /notas-fiscais. p_empresa_id
      // pode ser tanto o posto quanto o cliente — a mesma RPC serve as 3
      // visões. `total_count` vem via count(*) over() (mesma página, sem
      // 2ª query).
      abastecimentos_com_status_nota_fiscal: {
        Args: {
          p_empresa_id: string;
          // Fase 27.100 — 'emitida' | 'rejeitada' | 'pendente' | null (todos).
          // Antes era p_apenas_pendentes (boolean), que misturava
          // "Rejeitada" e "Pendente" no mesmo filtro.
          p_status: string | null;
          // Fase 27.104/27.143 — busca por código do abastecimento (só
          // existe pro lado PróFrotas) OU placa/posto/cliente (cobre
          // também abastecimentos_externos) — null/'' = sem filtro.
          p_busca: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          abastecimento_id: number;
          // Fase 27.143 — "profrotas" ou o nome do provedor externo
          // (abastecimentos_externos.provedor) — id só é único DENTRO de
          // cada fonte, por isso o front usa `${provedor}-${abastecimento_id}`
          // como chave de linha.
          provedor: string;
          // Fase 27.104 — mesmo "código" de 10 dígitos exibido/buscável nos
          // filtros (coluna gerada em profrotas_abastecimentos) — Fase
          // 27.143: null pro lado externo (não existe lá).
          codigo_abastecimento: string | null;
          data_abastecimento: string;
          cliente_nome: string | null;
          posto_nome: string | null;
          veiculo_placa: string | null;
          item_nome: string | null;
          item_quantidade: number;
          item_valor_total: number;
          nota_id: string | null;
          nota_numero: number | null;
          nota_chave_acesso: string | null;
          // Fase 27.99 — motivo da última tentativa de upload rejeitada pra
          // este abastecimento (null quando nota_id não é null, ou quando
          // nunca houve tentativa).
          pendencia_motivo: string | null;
          pendencia_detalhe_texto: string | null;
          pendencia_em: string | null;
          // Fase 27.103 — dados extraídos do XML da tentativa rejeitada,
          // mesmos campos já mostrados na seção "Uploads sem abastecimento
          // correspondente" — agora também na própria linha do abastecimento
          // (pedido do Daniel: "não deveria ter uma relação do registro
          // rejeitado com a tela de detalhe abaixo?").
          pendencia_nome_arquivo: string | null;
          pendencia_cnpj_emitente: string | null;
          pendencia_cnpj_destinatario: string | null;
          pendencia_produto_nome_xml: string | null;
          pendencia_quantidade: number | null;
          pendencia_valor_total: number | null;
          total_count: number;
        }[];
      };
      // Fase 27.95 — indicador agregado (% de recolha de NF) pro painel da
      // tela /notas-fiscais — mesma janela de 90 dias da função acima.
      indicador_notas_fiscais: {
        Args: { p_empresa_id: string };
        Returns: Json;
      };
      // Fase NFE-1 — 1 linha por ciclo de faturamento (o aberto atual + os
      // últimos p_qtd_fechados já fechados em faturas_postos) de cada
      // negociação em que p_empresa_id participa (posto ou cliente), com o
      // % de recolha de NF-e daquele ciclo específico, independente do
      // status. Substitui indicador_notas_fiscais() no painel da tela
      // /notas-fiscais (pedido do Daniel: "percentual de recolha por
      // ciclo, seja o status que ele estiver").
      nfe_recolha_por_ciclo: {
        Args: { p_empresa_id: string; p_qtd_fechados?: number };
        Returns: {
          negociacao_id: string;
          empresa_posto_id: string;
          empresa_cliente_id: string;
          posto_nome: string | null;
          cliente_nome: string | null;
          fatura_posto_id: string | null;
          // 'aberto' (virtual, sem linha em faturas_postos) | 'fechada' |
          // 'a_vencer' | 'vencida' (derivado) | 'paga' | 'cancelada'.
          status: string;
          periodo_inicio: string;
          periodo_fim: string;
          vencimento: string;
          total: number;
          com_nota: number;
          sem_nota: number;
          rejeitadas: number;
          percentual: number | null;
        }[];
      };
      // Fase NFE-1 — análoga a abastecimentos_com_status_nota_fiscal, mas
      // escopada a UM ciclo específico (negociação + período) em vez da
      // janela fixa de 90 dias — usada quando o usuário seleciona um card
      // de ciclo na tela /notas-fiscais.
      abastecimentos_do_ciclo_nfe: {
        Args: {
          p_negociacao_id: string;
          p_periodo_inicio: string;
          p_periodo_fim: string;
          p_status: string | null;
          p_busca: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          abastecimento_id: number;
          provedor: string;
          codigo_abastecimento: string | null;
          data_abastecimento: string;
          cliente_nome: string | null;
          posto_nome: string | null;
          veiculo_placa: string | null;
          item_nome: string | null;
          item_quantidade: number;
          item_valor_total: number;
          nota_id: string | null;
          nota_numero: number | null;
          nota_chave_acesso: string | null;
          pendencia_motivo: string | null;
          pendencia_detalhe_texto: string | null;
          pendencia_em: string | null;
          pendencia_nome_arquivo: string | null;
          pendencia_cnpj_emitente: string | null;
          pendencia_cnpj_destinatario: string | null;
          pendencia_produto_nome_xml: string | null;
          pendencia_quantidade: number | null;
          pendencia_valor_total: number | null;
          total_count: number;
        }[];
      };
      // Fase 27.99 — grava uma tentativa de upload de NF-e rejeitada
      // (motivo estrutural do parser OU motivo retornado pela RPC de
      // inserção), pra a listagem de /notas-fiscais poder mostrar o porquê.
      registrar_pendencia_nota_fiscal: {
        Args: {
          p_empresa_posto_id: string;
          p_abastecimento_id: number | null;
          // Fase 27.136 — mesmo par usado em notas_fiscais_abastecimento:
          // provedor da fonte + id na tabela correspondente (externos usa
          // sequência de id independente da profrotas_abastecimentos).
          p_provedor: string | null;
          p_abastecimento_externo_id: number | null;
          p_motivo: string;
          p_detalhe_texto: string | null;
          p_cnpj_emitente: string | null;
          p_cnpj_destinatario: string | null;
          p_chave_acesso: string | null;
          p_numero_nf: number | null;
          p_produto_nome_xml: string | null;
          p_produto_codigo_anp: string | null;
          p_quantidade: number | null;
          p_valor_total: number | null;
          p_data_emissao_nfe: string | null;
          p_nome_arquivo: string;
        };
        Returns: string;
      };
      // Fase 27.101 — resolve o posto (empresas.id) pelo CNPJ emitente do
      // XML, checando que o usuário logado tem acesso a ele — usada na
      // Server Action de upload pra atribuir a pendência ao posto certo sem
      // depender da "empresa atual" da sessão (que falha pra usuários com
      // acesso a mais de 1 posto, ver README Fase 27.101). Retorna null se
      // não encontrar ou se o usuário não tiver acesso.
      resolver_posto_por_cnpj: {
        Args: { p_cnpj_emitente: string };
        Returns: string | null;
      };
      // Fase 27.99 — pendências que não puderam ser associadas a NENHUM
      // abastecimento (ex.: CNPJ do destinatário não bate com nenhum
      // cliente cadastrado) — não aparecem na listagem de abastecimentos,
      // então ficam numa seção à parte em /notas-fiscais.
      pendencias_sem_abastecimento: {
        Args: { p_empresa_id: string; p_limit?: number };
        Returns: {
          id: string;
          motivo: string;
          detalhe_texto: string | null;
          cnpj_emitente: string | null;
          cnpj_destinatario: string | null;
          produto_nome_xml: string | null;
          quantidade: number | null;
          valor_total: number | null;
          data_emissao_nfe: string | null;
          nome_arquivo: string | null;
          criado_em: string;
        }[];
      };
      // Fase 27.41 — conta a frota REAL da empresa (cadastro_veiculos +
      // placas distintas vistas nos abastecimentos da integração, mesmo sem
      // cadastro formal) — usada por verificarLimiteFrota (src/lib/limitePlano.ts)
      // pra bloquear sync/operação acima do limite do plano.
      contar_veiculos_reais_empresa: {
        Args: { p_empresa_id: string };
        Returns: number;
      };
      // Fase 27.46 — roda as 4 regras de detecção de anomalias em
      // abastecimentos e grava os achados novos (idempotente). p_empresa_id
      // null só é permitido pra admin (roda pra todas as empresas).
      detectar_anomalias_abastecimento: {
        Args: { p_empresa_id?: string | null };
        Returns: number;
      };
      contar_anomalias_nao_revisadas: {
        Args: { p_empresa_id?: string | null };
        Returns: number;
      };
      // Fase 27.48 — soma litros/valor reais de abastecimentos de uma placa
      // num período (usa a view abastecimentos_unificado por trás) — botão
      // "Revisar" do combustível real em Planos de Viagem.
      combustivel_real_periodo: {
        Args: { p_empresa_id: string; p_placa: string; p_data_inicio: string; p_data_fim: string };
        Returns: { litros: number; valor_total: number }[];
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
      // Aviso não bloqueante (fase tratamento-cnpj-cpf, 27/07/2026): checa
      // globalmente (SECURITY DEFINER) se já existe outra conta com o mesmo
      // CPF normalizado em usuarios_app -- não impede o cadastro, só sinaliza.
      usuario_app_cpf_duplicado: {
        Args: { p_cpf: string; p_excluir_email?: string | null };
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
      preco_medio_por_meio_pagamento: {
        Args: { p_empresa_id?: string | null };
        Returns: {
          provedor: string;
          uf: string | null;
          regiao: string | null;
          combustivel: string;
          preco_medio: number;
          litros_total: number;
          valor_total: number;
          qtd_abastecimentos: number;
        }[];
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
          municipio_posto: string | null;
          hodometro: number | null;
          data: string | null;
          meio_pagamento: string | null;
          tipo_veiculo: string | null;
          marca_veiculo: string | null;
          modelo_veiculo: string | null;
          classificacao_veiculo: string | null;
          centro_custo: string | null;
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
          origem: string | null;
          tecnico: string | null;
          centro_custo: string | null;
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
          data_lancamento: string | null;
          recorrente: boolean | null;
          origem: string | null;
          centro_custo: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_notas_fiscais_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          produto: string | null;
          nome_posto: string | null;
          cnpj_posto: string | null;
          numero_nf: number | null;
          quantidade: number | null;
          valor_total: number | null;
          valor_unitario: number | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_fretes_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          titulo: string | null;
          status: string | null;
          tipo_carga: string | null;
          uf_origem: string | null;
          uf_destino: string | null;
          motorista: string | null;
          valor_oferecido: number | null;
          km_estimado: number | null;
          peso_carga_kg: number | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_financeiro_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          movimento: string | null;
          status: string | null;
          contraparte: string | null;
          origem: string | null;
          valor_original: number | null;
          valor_pago: number | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_acoes_sugeridas_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          tipo: string | null;
          severidade: string | null;
          status: string | null;
          alvo_label: string | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_chamados_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          tipo: string | null;
          prioridade: string | null;
          status: string | null;
          data: string | null;
          empresa_id: string | null;
        }[];
      };
      relatorio_avaliacoes_bruto: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          estrelas: number | null;
          tem_comentario: boolean | null;
          data: string | null;
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
      abastecimentos_totais_filtrados: {
        Args: {
          p_empresa_id: string;
          p_q?: string | null;
          p_de?: string | null;
          p_ate?: string | null;
          p_provedor?: string | null;
          p_apenas_ajuste_pendente?: boolean;
          p_produto?: string | null;
        };
        Returns: {
          litros: number;
          valor_total: number;
          registros: number;
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
      indicadores_fidelidade_motoristas: {
        Args: { p_empresa_id: string };
        Returns: {
          motorista_id: string;
          nome_completo: string;
          telefone: string | null;
          aderido: boolean | null;
          aderiu_em: string | null;
          saldo_pontos: number;
          abastecimentos_confirmados: number;
          missoes_concluidas: number;
          resgates_total: number;
          resgates_concluidos: number;
        }[];
      };
      // Fase Fretes — rede de parceiros.
      buscar_motorista_documento: {
        Args: { p_documento: string };
        Returns: { motorista_id: string; nome_completo: string; telefone: string | null }[];
      };
      convidar_motorista_parceiro: {
        Args: { p_empresa_id: string; p_motorista_id: string };
        Returns: Database["public"]["Tables"]["empresas_motoristas_parceiros"]["Row"];
      };
      meus_parceiros_empresa: {
        Args: { p_empresa_id: string };
        Returns: {
          id: string;
          motorista_id: string;
          nome_completo: string;
          telefone: string | null;
          status: string;
          convidado_em: string;
          respondido_em: string | null;
          // Fase Fretes-Dados-Completos — cartão de reputação, ver
          // _reputacao_motorista().
          media_estrelas: number | null;
          total_avaliacoes: number;
          fretes_concluidos: number;
          taxa_conclusao: number | null;
          cnh_valida: boolean;
          cnh_vencimento: string | null;
          telefone_verificado: boolean;
          seguranca_2fa_ativo: boolean;
          dias_cadastro: number | null;
          selo_verificado: boolean;
          // Fase Destaques-Automaticos — tags recorrentes (2+ avaliações),
          // ver _reputacao_motorista().
          tags_destaque: { tag: string; quantidade: number }[];
        }[];
      };
      // Fase Fretes — negociação e listagem.
      negociacoes_frete_empresa: {
        Args: { p_frete_id: string };
        Returns: {
          negociacao_id: string;
          motorista_id: string;
          nome_motorista: string;
          telefone_motorista: string | null;
          status: string;
          rodada_atual: number;
          ultimo_valor: number;
          ultimo_autor: string;
          criado_em: string;
          media_estrelas: number | null;
          total_avaliacoes: number;
          fretes_concluidos: number;
          taxa_conclusao: number | null;
          cnh_valida: boolean;
          cnh_vencimento: string | null;
          telefone_verificado: boolean;
          seguranca_2fa_ativo: boolean;
          dias_cadastro: number | null;
          selo_verificado: boolean;
          tags_destaque: { tag: string; quantidade: number }[];
        }[];
      };
      meus_fretes_empresa: {
        Args: { p_empresa_id: string };
        Returns: {
          id: string;
          titulo: string;
          status: string;
          origem_label: string;
          destino_label: string;
          valor_oferecido: number;
          km_estimado: number | null;
          motorista_id: string | null;
          nome_motorista: string | null;
          telefone_motorista: string | null;
          criado_em: string;
        }[];
      };
      abrir_negociacao_frete: {
        Args: { p_frete_id: string; p_valor_proposto: number; p_mensagem?: string | null };
        Returns: string;
      };
      propor_rodada_negociacao: {
        Args: { p_negociacao_id: string; p_valor_proposto: number; p_mensagem?: string | null };
        Returns: undefined;
      };
      aceitar_negociacao_frete: {
        Args: { p_negociacao_id: string };
        Returns: undefined;
      };
      recusar_negociacao_frete: {
        Args: { p_negociacao_id: string };
        Returns: undefined;
      };
      responder_frete_direto: {
        Args: { p_frete_id: string; p_aceitar: boolean };
        Returns: undefined;
      };
      // Fase P0.6 — baixa (parcial ou total) de um título em contas_receber;
      // chamada tanto pelo botão "Marcar como paga" quanto pelo webhook de
      // cobrança (service role).
      baixar_conta_receber: {
        Args: {
          p_conta_id: string;
          p_valor: number;
          p_forma?: string | null;
          p_gateway_ref?: string | null;
          p_observacao?: string | null;
        };
        Returns: undefined;
      };
      cancelar_conta_receber: {
        Args: { p_conta_id: string };
        Returns: undefined;
      };
      // Fase Financeiro-ERP (26/07/2026) — mesmo par baixar/cancelar,
      // espelhado pro lado contas_pagar (sem gateway_ref — não tem
      // cobrança própria, é só registro do que já foi cobrado por fora).
      baixar_conta_pagar: {
        Args: { p_conta_id: string; p_valor: number; p_forma?: string | null; p_observacao?: string | null };
        Returns: undefined;
      };
      cancelar_conta_pagar: {
        Args: { p_conta_id: string };
        Returns: undefined;
      };
      // Fase Fretes B. Fase corrige-ambiguidade-frete (27/07/2026) — este
      // tipo estava desatualizado (só tinha os 6 parâmetros originais); o
      // banco já tinha ganho p_foto_path e p_codigo_ocorrencia em
      // migrações anteriores sem que este arquivo hand-curated fosse
      // atualizado junto — e, pior, cada uma tinha virado um OVERLOAD novo
      // em vez de substituir o anterior (3 versões coexistindo, causando
      // "Could not choose the best candidate function" no PWA Motorista).
      // Migração corrige-ambiguidade-frete removeu as 2 versões antigas;
      // só resta esta, de 8 parâmetros.
      registrar_evento_frete: {
        Args: {
          p_frete_id: string;
          p_tipo_evento: string;
          p_posto_recomendado_id?: string | null;
          p_observacao?: string | null;
          p_lat?: number | null;
          p_lon?: number | null;
          p_foto_path?: string | null;
          p_codigo_ocorrencia?: string | null;
        };
        Returns: undefined;
      };
      avaliar_frete: {
        Args: { p_frete_id: string; p_estrelas: number; p_comentario?: string | null };
        Returns: undefined;
      };
      // Fase Fretes-Público-Alvo (23/07/26) — faltava no arquivo hand-curated
      // (achado ao rodar tsc, RPC já existe de verdade no banco).
      recolocar_frete_para_base: {
        Args: { p_frete_id: string; p_motorista_id?: string | null };
        Returns: Json;
      };
      // Fase Fretes-Adiantamento-Combustível (19/07).
      marcar_pagamento_frete: {
        Args: { p_frete_id: string; p_tipo: string };
        Returns: Json;
      };
      resgates_beneficios_empresa: {
        Args: { p_empresa_id: string };
        Returns: {
          id: string;
          titulo: string;
          categoria: string;
          pontos_gastos: number;
          status: string;
          numero_voucher: string | null;
          valido_ate: string | null;
          solicitado_em: string;
          atualizado_em: string;
          nome_motorista: string;
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
      // Fase 27.133 — RPC aditiva (não altera as 3 acima) que agrupa o custo
      // de combustível por provedor/meio de pagamento (Pró-Frotas, Valecard,
      // RedeFrota, TicketLog, Veloe...), pro painel "Consolidado por meio de
      // pagamento" em /financeiro.
      dashboard_evolucao_mensal: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null };
        Returns: {
          mes: string;
          litros: number;
          valor: number;
        }[];
      };
      dashboard_top_clientes_gasto: {
        Args: { p_data_inicio?: string | null; p_limit?: number };
        Returns: {
          empresa_id: string;
          valor: number;
        }[];
      };
      indicadores_financeiros_por_provedor: {
        Args: { p_empresa_id?: string | null; p_data_inicio?: string | null; p_data_fim?: string | null };
        Returns: {
          provedor: string;
          custo_combustivel: number;
          litros: number;
          qtd_abastecimentos: number;
        }[];
      };
      // Fase DRE-Gerencial (26/07/2026, pedido do Daniel: "Faz sentido
      // criarmos um modelo de DRE para clientes e postos?") — DRE gerencial
      // por competência. dre_posto usa despesas_postos.competencia +
      // faturas_postos.periodo_fim; dre_frota usa faturas_fretes.
      // periodo_fim + abastecimentos_unificado.data_abastecimento +
      // manutencoes_realizadas.data_manutencao + custos_fixos.competencia
      // (mesmos campos já usados por indicadores_financeiros). Sem
      // SECURITY DEFINER — roda com RLS de quem chama.
      dre_posto: {
        Args: { p_empresa_posto_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          receita_bruta: number;
          cmv_combustivel: number;
          lucro_bruto: number;
          despesa_salarios: number;
          despesa_manutencao: number;
          despesa_aluguel: number;
          despesa_energia: number;
          despesa_outras: number;
          despesas_operacionais: number;
          ebitda: number;
          impostos: number;
          lucro_liquido: number;
        }[];
      };
      dre_frota: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          receita_bruta_fretes: number;
          custo_combustivel: number;
          custo_manutencao: number;
          resultado_bruto: number;
          custos_fixos: number;
          ebitda: number;
        }[];
      };
      // Fase TCO (29/07/2026) — custo total de propriedade de um único
      // veículo no período. custo_depreciacao/tco_completo ficam null/false
      // quando o veículo não tem valor_aquisicao preenchido (TCO
      // "operacional", sem depreciação).
      tco_veiculo: {
        Args: { p_empresa_id: string; p_placa: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          ano_fabricacao: number | null;
          centro_custo_id: string | null;
          centro_custo_nome: string | null;
          valor_aquisicao: number | null;
          data_aquisicao: string | null;
          valor_residual_estimado: number | null;
          km_periodo: number | null;
          custo_combustivel: number;
          custo_manutencao: number;
          custo_multas: number;
          custo_oficinas: number;
          custo_fixos: number;
          custo_depreciacao: number | null;
          tco_total: number;
          custo_por_km: number | null;
          tco_completo: boolean;
        }[];
      };
      // Fase TCO (29/07/2026) — ranking de veículos por custo/km no período,
      // mesmo padrão de paginação/filtro de manutencao_preditiva_resumo
      // (total_count embutido em cada linha).
      tco_frota_resumo: {
        Args: {
          p_empresa_id: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_centro_custo_id?: string | null;
          p_busca?: string | null;
          p_ordenar?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          ano_fabricacao: number | null;
          centro_custo_id: string | null;
          centro_custo_nome: string | null;
          valor_aquisicao: number | null;
          km_periodo: number | null;
          custo_combustivel: number;
          custo_manutencao: number;
          custo_multas: number;
          custo_oficinas: number;
          custo_fixos: number;
          custo_depreciacao: number | null;
          tco_total: number;
          custo_por_km: number | null;
          tco_completo: boolean;
          total_count: number;
        }[];
      };
      // Fase Convite-Self-Service (26/07/2026) — RPC dedicada pra /minha-
      // equipe (superfície mínima: email/nome/perfil/ativo, não a linha
      // inteira de usuarios_app, que teria CPF/telefone/mfa_secret — ver
      // comentário na migração equipe_da_empresa_rpc). SECURITY DEFINER com
      // checagem própria: só devolve algo se quem chama também tem vínculo
      // direto ativo com a mesma empresa.
      equipe_da_empresa: {
        Args: { p_empresa_id: string };
        Returns: {
          email: string;
          nome: string | null;
          perfil: string;
          ativo: boolean;
        }[];
      };
      // Fase editar-excluir-colega (27/07/2026) — CPF/telefone só pra abrir o
      // modal de "Editar" em /minha-equipe (equipe_da_empresa, acima, não
      // expõe isso na listagem geral de propósito). Restrita a quem chama
      // sendo dono da equipe (gestor_frota/posto).
      // SECURITY DEFINER — usada pela tela de consulta do posto. Retorna só
      // a parada do PRÓPRIO posto chamador (nunca o itinerário completo do
      // cliente), autorização checada internamente via empresas_do_usuario.
      consultar_pre_pedido_para_posto: {
        Args: { p_numero: number; p_empresa_posto_id: string };
        Returns: {
          pre_pedido_id: string;
          numero: number;
          status: string;
          placa: string | null;
          motorista_nome: string | null;
          data_saida: string | null;
          km_estimado: number | null;
          parada_ordem: number;
          parada_posto_nome: string | null;
          parada_litros_previstos: number | null;
          parada_atendida: boolean;
        }[];
      };
      dados_colega_para_edicao: {
        Args: { p_empresa_id: string; p_email: string };
        Returns: {
          nome: string | null;
          cpf: string | null;
          telefone: string | null;
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
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string; p_combustivel?: string | null };
        Returns: { dia: string; litros: number; valor: number }[];
      };
      indicador_padrao_dia_semana: {
        Args: { p_empresa_id: string; p_dias_lookback?: number | null; p_combustivel?: string | null };
        Returns: { dia_semana: number; media_litros: number }[];
      };
      indicador_volume_postos: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string; p_combustivel?: string | null };
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
      // Fase Motor-de-Ação-Automática — central de ações sugeridas (ver
      // migration acoes_sugeridas_motor_de_acao_automatica).
      detectar_acoes_cnh_vencida: {
        Args: { p_empresa_id?: string | null };
        Returns: number;
      };
      detectar_acoes_posto_caro: {
        Args: { p_empresa_id?: string | null; p_threshold?: number | null };
        Returns: number;
      };
      detectar_acoes_hodometro: {
        Args: { p_empresa_id?: string | null; p_minimo_ocorrencias?: number | null };
        Returns: number;
      };
      executar_acao_bloquear_motorista: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      executar_acao_remover_posto_rede: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      executar_acao_ajustar_hodometro: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      rejeitar_acao_sugerida: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      // Fase Ações-Sugeridas-Completa — fecha os 3 tipos que faltavam pra
      // cobrir tudo que Anomalias detecta (ver migration
      // acoes_sugeridas_completa_tipos_anomalias).
      detectar_acoes_volume_tanque: {
        Args: { p_empresa_id?: string | null; p_minimo_ocorrencias?: number | null };
        Returns: number;
      };
      detectar_acoes_geo_distancia: {
        Args: { p_empresa_id?: string | null; p_minimo_ocorrencias?: number | null };
        Returns: number;
      };
      detectar_acoes_preco_regiao: {
        Args: { p_empresa_id?: string | null; p_minimo_ocorrencias?: number | null };
        Returns: number;
      };
      // Fase Antifraude→Ações-Sugeridas — migrado do tipo "localizacao_posto"
      // de Antifraude (ver migration migrar_localizacao_posto_para_acoes_sugeridas).
      detectar_acoes_posto_nao_autorizado: {
        Args: { p_empresa_id?: string | null };
        Returns: number;
      };
      executar_acao_posto_nao_autorizado: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      executar_acao_limitar_volume_diario: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      executar_acao_limitar_intervalo: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      executar_acao_revisar_preco_regiao: {
        Args: { p_acao_id: number };
        Returns: undefined;
      };
      // Fase Índice-Público-de-Preço — agregado/anônimo, sem auth (grant a
      // anon), consumido pela página pública /indice-precos.
      indice_publico_precos_uf: {
        Args: Record<string, never>;
        Returns: {
          uf: string;
          combustivel: string;
          preco_medio_rede: number;
          preco_min_rede: number;
          preco_max_rede: number;
          qtd_postos: number;
          preco_medio_anp: number | null;
          data_referencia_anp: string | null;
          atualizado_em: string | null;
        }[];
      };
      comparador_diesel_ideal: {
        Args: { p_empresa_id: string };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          uf: string | null;
          familia: string;
          preco_comum: number | null;
          preco_aditivado: number | null;
          preco_fonte: string | null;
          rendimento_comum: number | null;
          rendimento_aditivado: number | null;
          custo_km_comum: number | null;
          custo_km_aditivado: number | null;
          recomendacao: string | null;
          premio_aditivado_pct: number | null;
        }[];
      };
      comparador_combustivel_ideal: {
        Args: { p_empresa_id: string };
        Returns: {
          placa: string;
          marca: string | null;
          modelo: string | null;
          uf: string | null;
          rendimento_gasolina: number | null;
          rendimento_etanol: number | null;
          rendimento_estimado: boolean | null;
          preco_gasolina: number | null;
          preco_etanol: number | null;
          preco_fonte: string | null;
          custo_km_gasolina: number | null;
          custo_km_etanol: number | null;
          recomendacao: string | null;
          economia_pct: number | null;
        }[];
      };
      pegada_carbono_periodo: {
        Args: { p_empresa_id: string; p_data_inicio: string; p_data_fim: string };
        Returns: {
          categoria: string;
          litros_total: number;
          fator_kg_co2_por_litro: number | null;
          co2_estimado_kg: number | null;
        }[];
      };
      liberar_bloqueio_abastecimento: {
        Args: { p_bloqueio_id: number };
        Returns: undefined;
      };
      indice_publico_precos_brasil: {
        Args: Record<string, never>;
        Returns: {
          combustivel: string;
          preco_medio_rede: number;
          preco_min_rede: number;
          preco_max_rede: number;
          qtd_postos: number;
          qtd_ufs: number;
          preco_medio_anp: number | null;
          data_referencia_anp: string | null;
          atualizado_em: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
