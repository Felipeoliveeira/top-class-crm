# Plano de Implementação — CRM Top Class

**Arquiteto:** Claude (claude-4.6-opus-high-thinking)
**Data:** 27 de março de 2026
**Baseado em:** PRD v1.1 + Regras de Progressão v1.0

---

## Estado Atual do Projeto (Baseline)

Antes das fases, é essencial documentar o que **já existe**:

| Camada | Status |
|--------|--------|
| **Páginas/UI** | Login, RecoverPassword, SetPassword, Dashboard, Pipeline, Leads, LeadDetail, Users, NotFound — estruturas visuais montadas |
| **Roteamento** | Configurado (`react-router-dom` v6) com proteção de rotas e `AdminRoute` |
| **Auth** | Zustand store (`useAuth`) com `signIn`, `signOut`, `resetPassword`, `updatePassword`, verificação de perfil ativo |
| **Permissões** | Hook `usePermissions` com flags declarativas |
| **Supabase Client** | Configurado com tipos gerados (`Database`). Schema remoto já existe (tabelas: `leads`, `perfis`, `historico_interacoes`, `documentos_lead`, `pipeline_logs`, `exportacoes_log`) |
| **Edge Function** | `invite-user` (convite de usuário com validação de role admin) |
| **Migrations locais** | Nenhuma versionada no repositório |
| **Services/Hooks de dados** | Nenhum — chamadas Supabase estão diretamente nas páginas |
| **TanStack Query** | Provider configurado, mas sem `useQuery`/`useMutation` em uso |
| **Testes** | Setup de Vitest + Playwright existente, mas apenas `example.test.ts` |

---

## Arquitetura de Implementação

Antes de iniciar, recomendo estabelecer uma camada de serviços para desacoplar lógica de negócio das páginas:

```
src/
├── services/           # NOVO - Lógica de dados + Supabase queries
│   ├── leads.ts
│   ├── pipeline.ts
│   ├── dashboard.ts
│   ├── users.ts
│   └── documents.ts
├── hooks/              # EXPANDIR - Custom hooks com TanStack Query
│   ├── useLeads.ts
│   ├── usePipeline.ts
│   ├── useDashboard.ts
│   └── useUsers.ts
```

---

## Fase 1 — Fundação Backend (Migrations, RLS, Triggers)

**Objetivo:** Garantir que o banco de dados esteja completamente configurado, versionado e seguro antes de qualquer integração frontend.

**Duração estimada:** 3-4 dias

### Epic 1.1 — Versionamento de Migrations

> Trazer o schema remoto para controle local e garantir reprodutibilidade.

| ID | User Story | Critério de Aceite | RFs |
|----|------------|-------------------|-----|
| **S-1.1.1** | Como desenvolvedor, quero ter todas as migrations do Supabase versionadas localmente, para garantir reprodutibilidade do schema | Pasta `supabase/migrations/` contém SQL com todas as tabelas, enums, índices e constraints do PRD Seção 6.2 | — |
| **S-1.1.2** | Como desenvolvedor, quero que os enums do banco reflitam exatamente os valores do PRD (`status`, `origem`, `necessidade`, `servico_interesse`, `motivo_perda_tipo`, `role`, `formato`), para evitar inconsistências | Cada enum tem exatamente os valores listados no PRD. Deploy via Supabase MCP sem erros | — |

### Epic 1.2 — Políticas RLS Completas

> Implementar todas as 6 tabelas com RLS ativo conforme PRD Seção 6.4.

| ID | User Story | Critério de Aceite | RFs |
|----|------------|-------------------|-----|
| **S-1.2.1** | Como Consultor, quero que o banco me impeça de ver leads de outros consultores, mesmo que o frontend seja comprometido | `leads` SELECT: admin vê tudo, consultor vê apenas `consultor_id = auth.uid()` | RNF-09 |
| **S-1.2.2** | Como Admin, quero que ninguém consiga editar ou excluir registros de `historico_interacoes`, para garantir auditabilidade | Policies: INSERT permitido (admin qualquer lead, consultor seus leads). UPDATE/DELETE bloqueados com `USING (false)` | RF-20, RNF-11 |
| **S-1.2.3** | Como Admin, quero que `pipeline_logs` seja somente-leitura para qualquer perfil (inserção apenas via trigger) | SELECT permitido. INSERT/UPDATE/DELETE bloqueados para todos os roles via RLS | RF-36 |
| **S-1.2.4** | Como desenvolvedor, quero que `documentos_lead` tenha RLS isolando documentos por consultor responsável do lead | SELECT/INSERT controlados por `consultor_id` do lead associado. UPDATE/DELETE bloqueados | RNF-10 |
| **S-1.2.5** | Como desenvolvedor, quero que `exportacoes_log` seja acessível apenas para admins | SELECT/INSERT apenas para admin. UPDATE/DELETE bloqueados | RF-37 |
| **S-1.2.6** | Como desenvolvedor, quero que `perfis` tenha RLS impedindo consultor de ver dados de outros usuários | Consultor vê apenas `id = auth.uid()`. Admin vê todos. UPDATE restrito | — |

### Epic 1.3 — Triggers PostgreSQL

> Implementar automações do banco conforme PRD Seção 6.5.

| ID | User Story | Critério de Aceite | RFs |
|----|------------|-------------------|-----|
| **S-1.3.1** | Como sistema, quero que toda mudança de status em `leads` gere automaticamente um registro em `pipeline_logs` | Trigger `trg_pipeline_log` em `AFTER UPDATE` de `status`. Campos: `lead_id`, `executado_por`, `status_anterior`, `status_novo`, `created_at` | RF-36 |
| **S-1.3.2** | Como sistema, quero que `ultima_movimentacao_at` seja atualizado automaticamente quando o status muda ou uma interação é registrada | Trigger `trg_ultima_movimentacao_status` em leads + Trigger `trg_ultima_movimentacao_interacao` em `historico_interacoes` | RF-38 |
| **S-1.3.3** | Como sistema, quero que `updated_at` seja atualizado automaticamente em `leads` e `perfis` | Trigger `trg_updated_at` em `BEFORE UPDATE` | — |

### Epic 1.4 — Supabase Storage

> Configurar bucket para documentos de leads.

| ID | User Story | Critério de Aceite | RFs |
|----|------------|-------------------|-----|
| **S-1.4.1** | Como desenvolvedor, quero o bucket `documentos-leads` criado com RLS, limite de 10MB por arquivo e formatos restritos (DOC, DOCX, JPG, PDF) | Bucket configurado via Supabase MCP. Policies de storage isolam acesso por consultor. Admin acessa todos | RF-19, RNF-10 |

---

## Fase 2 — Autenticação & Controle de Acesso (Integração Completa)

**Objetivo:** Garantir que os fluxos de auth do PRD funcionem end-to-end com o backend, incluindo edge cases.

**Duração estimada:** 2-3 dias

### Epic 2.1 — Fluxos de Autenticação

> Conectar as telas existentes (Login, RecoverPassword, SetPassword) à lógica completa do PRD.

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-2.1.1** | Como usuário, quero que o login nunca revele se meu e-mail está cadastrado | Mensagem genérica idêntica para e-mail válido e inválido. Sem diferença de timing perceptível | US-05, RF-01 |
| **S-2.1.2** | Como Admin, quero ser redirecionado para o Dashboard Admin após login, e Consultor para o Dashboard Consultor | Redirect pós-login consulta `perfis.role` e encaminha corretamente | US-01, US-02, RF-02 |
| **S-2.1.3** | Como Consultor desativado, quero que minha sessão seja invalidada imediatamente se o Admin me desativar | `useAuth` verifica `perfis.status` periodicamente. Se `inativo`, força logout | RF-05, US-33 |
| **S-2.1.4** | Como usuário na tela SetPassword, quero título dinâmico ("Crie sua senha" para convite, "Redefina sua senha" para recovery) | Tela detecta contexto via token type e exibe título correto | RF-04 |
| **S-2.1.5** | Como usuário com link expirado, quero ver mensagem clara com link para `/recuperar-senha` | Token inválido/expirado mostra erro + link de recuperação | RF-04 |

---

## Fase 3 — Pipeline Kanban com Regras de Progressão

**Objetivo:** Implementar o coração do CRM — o pipeline com todas as regras de negócio do documento "Regras de Progressão".

**Duração estimada:** 5-7 dias

### Epic 3.1 — Camada de Serviços e Hooks do Pipeline

> Criar a infraestrutura de dados para o pipeline.

| ID | User Story | Critério de Aceite | RFs |
|----|------------|-------------------|-----|
| **S-3.1.1** | Como desenvolvedor, quero um service `src/services/pipeline.ts` que encapsule todas as queries de leads do Kanban | Service com funções: `fetchLeadsByStatus()`, `createLead()`, `advanceStage()`, `markAsLost()`, `inactivateLead()` | — |
| **S-3.1.2** | Como desenvolvedor, quero hooks TanStack Query (`usePipelineLeads`, `useCreateLead`, `useAdvanceStage`) para gerenciar cache e mutations | Hooks usam `useQuery` e `useMutation` com invalidação automática de cache após mutations | — |

### Epic 3.2 — Cadastro de Lead

> Permitir criação de leads com o mínimo de fricção.

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-3.2.1** | Como Consultor, quero cadastrar um lead preenchendo apenas nome e telefone | Modal "+ Novo Lead" com validação zod. Campos: nome (obrigatório), telefone (obrigatório). `consultor_id` automático | US-06, RF-06 |
| **S-3.2.2** | Como Admin, quero selecionar o responsável ao cadastrar um lead | Dropdown de usuários ativos com role `consultor` **ou** `admin`, visível apenas para Admin | US-07, RF-06 |
| **S-3.2.3** | Como sistema, quero que o lead entre em Atendimento e apareça no Kanban imediatamente | Insert com `status = 'atendimento'`. Invalidação de cache TanStack Query. Trigger registra em `pipeline_logs` | RF-06 |

### Epic 3.3 — Validação de Gates (Regras de Progressão)

> Implementar **todas** as regras de progressão no frontend E no backend.

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-3.3.1** | Como Consultor, quero avançar de Atendimento → Negociação preenchendo origem e necessidade | Validação bloqueia se `origem` ou `necessidade` vazios. Alerta destaca campos faltantes. Backend também valida (Edge Function ou RLS check) | US-08, RF-07 |
| **S-3.3.2** | Como Consultor, quero avançar de Negociação → Fechado apenas quando **todos** os gates forem satisfeitos | Validação de: `servico_interesse`, `valor_bruto`, `email`, `rg`, `cpf`, PJ (`cnpj` + `razao_social` se checkbox ativo), ao menos 1 documento, `status_financeiro = 'pago'` | US-10, RF-08 |
| **S-3.3.3** | Como Consultor, quero ver o valor líquido calculado automaticamente ao preencher desconto | `valor_liquido = valor_bruto × (1 - porcentagem_desconto / 100)`. Campo read-only. Se desconto vazio, líquido = bruto | US-09, RF-08 |
| **S-3.3.4** | Como Consultor, quero que o gate de pagamento impeça o avanço para Fechado com flag visual "Pagamento Pendente" | Se `status_financeiro = 'pendente'`: bloqueio + flag "⚠ Pagamento Pendente" + mensagem | RF-08 |
| **S-3.3.5** | Como Consultor, quero marcar um lead como Perdido informando o motivo obrigatório | Modal com select de motivo. Se "Outro" → texto livre obrigatório. Disponível apenas em Atendimento e Negociação | US-11, RF-09 |
| **S-3.3.6** | Como Consultor/Admin, quero inativar um cliente (churn) apenas de Fechado | Botão disponível só em `status = 'fechado'`. Status muda para `'inativo'`. Badge visual. Excluído de KPIs de ganhos | RF-10 |
| **S-3.3.7** | Como sistema, quero impedir transições proibidas (pular etapa, retroceder, reativar perdido/inativo) | Frontend e backend rejeitam: Atendimento→Fechado, Fechado→Negociação, Perdido→qualquer, Inativo→qualquer | Regras de Progressão §2.6 |

### Epic 3.4 — Visualização do Kanban

> Implementar o layout visual de 4 colunas com cards informativos.

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-3.4.1** | Como usuário, quero ver o Kanban em 4 colunas (Atendimento, Negociação, Fechado, Perdido) com contadores | Cada coluna exibe counter no header. Leads inativos com badge visual | RF-12 |
| **S-3.4.2** | Como usuário, quero cards exibindo: Nome, Origem (tag colorida), Valor Líquido (vermelho), Consultor, Data de cadastro | Campos exibidos condicionalmente (origem/valor apenas quando preenchidos). Flag "⚠ Pagamento Pendente" quando aplicável | US-12, RF-12 |
| **S-3.4.3** | Como Consultor em desktop, quero arrastar cards entre colunas com validação automática | `@dnd-kit` (já instalado) com validação de gates. Card retorna à coluna de origem se validação falha | US-13, RF-11 |

---

## Fase 4 — Gestão de Leads (Listagem + Detalhe + Documentos)

**Objetivo:** Implementar CRUD completo de leads com campos progressivos, busca, filtros, upload e histórico imutável.

**Duração estimada:** 5-7 dias

### Epic 4.1 — Listagem de Leads com Campos Progressivos

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-4.1.1** | Como Consultor, quero ver a listagem dos meus leads com campos que mudam conforme o status | Atendimento: Nome, Telefone, Consultor, Data, Status. Negociação: + Origem, Necessidade. Fechado: + Serviço, Valores, Dados pessoais, Docs, Financeiro. Perdido: + Motivo | US-15, RF-13 |
| **S-4.1.2** | Como Admin, quero ver todos os leads de todos os consultores | RLS garante visão total para admin. Coluna "Consultor" visível na listagem | US-16, RF-13 |
| **S-4.1.3** | Como usuário, quero buscar leads por nome, e-mail ou telefone e filtrar por status, origem, consultor e período | Campo de busca único + filtros combináveis. Reset para página 1 ao aplicar filtro | US-20, RF-14 |
| **S-4.1.4** | Como usuário, quero paginação de 25/50/100 por página | Seletor de itens por página. Botões Anterior/Próxima. Total exibido no rodapé | US-21, RF-15 |
| **S-4.1.5** | Como Admin, quero exportar a listagem em CSV incluindo RG, CPF, CNPJ | Botão visível só para Admin. Respeita filtros ativos. Registra em `exportacoes_log` | US-17, RF-16, RF-37 |
| **S-4.1.6** | Como Admin, quero reatribuir um lead para outro consultor pela listagem | Modal com dropdown de consultores ativos. Registra reatribuição em `pipeline_logs` | US-18, RF-35 |

### Epic 4.2 — Detalhe e Edição do Lead

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-4.2.1** | Como Consultor, quero ver e editar dados do lead em seções progressivas | Seções: Dados Básicos (sempre), Qualificação (a partir de Atendimento), Negociação/Contratuais (a partir de Negociação), Documentos, Financeiro, Histórico | US-22, RF-18 |
| **S-4.2.2** | Como Consultor, quero o checkbox "Pessoa Jurídica" que torna CNPJ e Razão Social obrigatórios | Ao ativar: campos aparecem como obrigatórios. Ao desativar: campos voltam a opcionais | US-26, RF-21 |
| **S-4.2.3** | Como Consultor, quero gerenciar sócios (nome + contato) via JSONB | Botão "+ Adicionar Sócio". Lista editável. Armazenamento em `socios` JSONB. Opcional | RF-22 |
| **S-4.2.4** | Como Consultor, quero toggle de Status Financeiro (Pago/Pendente) com dia previsto de pagamento | Toggle visual. Campo numérico (1-31). Alerta vermelho se pendente | RF-23 |
| **S-4.2.5** | Como Consultor, quero botões fixos no rodapé: "Avançar Etapa", "Marcar como Perdido", "Inativar Cliente", "Salvar" | Botões habilitados/desabilitados conforme status atual e regras de negócio | RF-24 |

### Epic 4.3 — Upload de Documentos

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-4.3.1** | Como Consultor, quero fazer upload de documentos com drag-and-drop e nome/descrição obrigatória | Área de upload. Formatos: DOC, DOCX, JPG, PDF. Limite: 10MB. Nome/descrição obrigatório | US-23, RF-19 |
| **S-4.3.2** | Como Consultor, quero ver a lista de documentos com nome, formato, data e botão de download | Lista na seção Documentos. Download via signed URL do Supabase Storage | RF-19 |
| **S-4.3.3** | Como usuário, quero baixar documentos anexados diretamente no detalhe do lead | Botão "Download" funcional por item na seção Documentos, com geração de signed URL e abertura segura do arquivo | RF-19 |

### Epic 4.4 — Histórico de Interações

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-4.4.1** | Como Consultor, quero registrar anotações no histórico do lead com data/hora automáticas | Campo de texto + botão "Registrar". `created_at` do servidor. Timeline vertical ordenada cronologicamente | US-24, RF-20 |
| **S-4.4.2** | Como usuário, quero que o histórico seja imutável (sem edição ou exclusão) | Sem botões de edit/delete na UI. RLS bloqueia UPDATE/DELETE no backend | US-25, RF-20, RNF-11 |

---

## Fase 5 — Dashboards e KPIs

**Objetivo:** Implementar todos os dashboards conforme "Regras de Progressão" Seções 3.1–3.6.

**Duração estimada:** 4-5 dias

### Epic 5.1 — Service e Hooks de Dashboard

| ID | User Story | Critério de Aceite | RFs |
|----|------------|-------------------|-----|
| **S-5.1.1** | Como desenvolvedor, quero um `src/services/dashboard.ts` com queries otimizadas para cada KPI e gráfico | Queries respeitam filtros de status e financeiro conforme tabela de referência (Regras de Progressão §4). Queries parametrizadas por período | — |
| **S-5.1.2** | Como desenvolvedor, quero hooks `useDashboardKpis` e `useDashboardCharts` com TanStack Query | Cache de 30s. Invalidação quando leads são atualizados. Parâmetro de filtro temporal | — |

### Epic 5.2 — Dashboard Admin

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-5.2.1** | Como Admin, quero ver KPIs Linha 1: Leads Totais, Taxa de Conversão, Negócios Ganhos, Valor Total Ganho | Cálculos: `COUNT(*)`, `(Fechados / (Total - Perdidos)) × 100`, `COUNT(fechado)`, `SUM(valor_liquido) WHERE fechado AND pago` | US-27, RF-25 |
| **S-5.2.2** | Como Admin, quero ver KPIs Linha 2: Negócios Perdidos, Valor de Negócios Perdidos, Somatório de Descontos | Cálculos: `COUNT(perdido)`, `SUM(valor_bruto) WHERE perdido`, `SUM(valor_bruto - valor_liquido) WHERE fechado` | US-27, RF-26 |
| **S-5.2.3** | Como Admin, quero gráficos: Leads/Ganhos por Dia (linha dupla), Leads por Origem (barras), Clientes por Origem (barras), Leads por Plano (barras horizontais), Clientes por Plano (barras horizontais) | 5 gráficos Recharts com filtros corretos por status conforme Regras de Progressão §3.3 | US-28, RF-27 |
| **S-5.2.4** | Como Admin, quero tabela de Performance por Consultor | Colunas: Consultor, Leads, Ganhos, Conversão (%), Valor Ganho (R$). Valor considera apenas `pago` | US-29, RF-28 |
| **S-5.2.5** | Como Admin, quero filtrar todos os componentes por período (Hoje / 7 dias / 30 dias / Total) | Filtro único no topo afeta todos os KPIs, gráficos e tabela simultaneamente | US-30, RF-29 |

### Epic 5.3 — Dashboard Consultor

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-5.3.1** | Como Consultor, quero ver apenas meus KPIs: Leads Totais, Taxa de Conversão, Negócios Fechados, Negócios Perdidos | Sem Valor Total Ganho, sem Somatório de Descontos, sem Valor de Negócios Perdidos | US-31, RF-30 |
| **S-5.3.2** | Como Consultor, quero os mesmos 5 gráficos, porém restritos aos meus leads via RLS | Dados filtrados automaticamente pelo Supabase. Sem tabela de Performance por Consultor | US-31, RF-30 |

---

## Fase 6 — Gestão de Usuários (Admin)

**Objetivo:** Implementar o módulo completo de gestão de consultores.

**Duração estimada:** 2-3 dias

### Epic 6.1 — CRUD de Usuários

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-6.1.1** | Como Admin, quero ver a listagem de usuários com Nome, E-mail, Role, Status, Último Acesso e Ações | Tabela em `/admin/usuarios`. Inativos com badge e opacidade reduzida | US-35, RF-31 |
| **S-6.1.2** | Como Admin, quero cadastrar usuários (Nome, E-mail, Role) e enviar convite por e-mail automaticamente | Modal de cadastro. Chama Edge Function `invite-user` (já existente) com `redirectTo` para `/definir-senha`. Link expira em 24h. O link do e-mail de convite abre o SPA em `/definir-senha` (SetPassword): sessão via hash, título “Crie sua senha”, alinhado a RF-04 e S-2.1.4 | US-32, RF-32 |
| **S-6.1.3** | Como Admin, quero ativar/desativar consultores sem perder dados | Toggle na tabela. Desativar → `status = 'inativo'` → sessão invalidada. Reativar → `status = 'ativo'` | US-33, RF-33 |
| **S-6.1.4** | Como Admin, quero reenviar convite de primeiro acesso quando o link expirar | Botão visível apenas quando o usuário não completou primeiro acesso. Reenvia com novo link de 24h para o mesmo destino `/definir-senha` | US-34, RF-34 |

**Fluxo de primeiro acesso (convite):** Admin cadastra → e-mail enviado pelo Auth → usuário abre o link → `/definir-senha` (define senha) → após sucesso, redirect para `/login` conforme RF-04.

A Edge Function `invite-user` monta `redirectTo` a partir da variável **`FRONTEND_URL`** (URL base do SPA, sem barra final; ex.: `http://localhost:8080` em dev). Configurar como secret do projeto Supabase (Dashboard → Edge Functions → Secrets ou `supabase secrets set FRONTEND_URL=...`).

---

## Fase 7 — Responsividade Mobile

**Objetivo:** Adaptar todas as telas para uso em dispositivos móveis.

**Duração estimada:** 3-4 dias

### Epic 7.1 — Layout Responsivo

| ID | User Story | Critério de Aceite | RFs / USs |
|----|------------|-------------------|-----------|
| **S-7.1.1** | Como Consultor mobile, quero Login, Recuperar Senha e Definir Senha totalmente responsivos | Coluna única, campos full-width, botões fixos no rodapé (até 768px) | US-36, RNF-24 |
| **S-7.1.2** | Como Consultor mobile, quero a listagem de leads como cards verticais | Cards com Nome, Status (badge), Origem, Data. Botão "Ver detalhes" | US-37, RNF-25 |
| **S-7.1.3** | Como Consultor mobile, quero o Pipeline como lista agrupada por status com filtro no topo | Substituição do Kanban horizontal. Sem drag-and-drop. Botões "Avançar Etapa" e "Marcar como Perdido" | US-38, RNF-27 |
| **S-7.1.4** | Como Consultor mobile, quero Dashboard com KPIs empilhados e gráficos full-width | Cards empilhados verticalmente. Gráficos com scroll horizontal se necessário. Tabela Performance como cards | US-39, RNF-26 |
| **S-7.1.5** | Como sistema, quero que a exportação CSV fique indisponível em mobile | Botão "Exportar CSV" hidden em breakpoints mobile | RNF-28 |

---

## Fase 8 — Preparação para Lançamento

**Objetivo:** Garantir qualidade, deploy automatizado e go-live seguro.

**Duração estimada:** 5-7 dias

### Epic 8.1 — Testes E2E (Playwright)

> Cobertura dos fluxos críticos do sistema.

| ID | User Story / Task | Critério de Aceite |
|----|-------------------|-------------------|
| **S-8.1.1** | Teste E2E: Login com credenciais válidas → redirect por role | Playwright testa login Admin e Consultor com redirect correto |
| **S-8.1.2** | Teste E2E: Login com credenciais inválidas → mensagem genérica | Verifica que mensagem não revela se e-mail existe |
| **S-8.1.3** | Teste E2E: Cadastro de lead → aparece em Atendimento | Cria lead com nome/telefone. Verifica aparição no Kanban |
| **S-8.1.4** | Teste E2E: Progressão completa Atendimento → Negociação → Fechado | Preenche gates de cada etapa. Verifica movimentação. Verifica bloqueio com campos faltantes |
| **S-8.1.5** | Teste E2E: Gate de pagamento bloqueia avanço para Fechado | Tenta avançar com `pendente`. Verifica bloqueio. Muda para `pago`. Verifica liberação |
| **S-8.1.6** | Teste E2E: Marcar como Perdido com motivo obrigatório | Tenta salvar sem motivo. Verifica bloqueio. Preenche motivo. Verifica movimentação |
| **S-8.1.7** | Teste E2E: Isolamento RLS — Consultor não vê leads de outro | Login como Consultor A → verifica que leads do Consultor B não aparecem |
| **S-8.1.8** | Teste E2E: Dashboard KPIs refletem dados corretos | Cria leads com status variados. Verifica que KPIs calculam corretamente |
| **S-8.1.9** | Teste E2E: Upload de documento e download via signed URL | Upload de arquivo PDF. Verifica listagem. Verifica download |
| **S-8.1.10** | Teste E2E: Gestão de Usuários — convite, ativar/desativar | Admin cria usuário. Verifica na listagem. Desativa. Verifica bloqueio de acesso |

### Epic 8.2 — CI/CD (Vercel)

| ID | Task | Critério de Aceite |
|----|------|-------------------|
| **S-8.2.1** | Configurar projeto na Vercel com variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) | Deploy automático a partir do branch `main`. Preview deploys em branches de feature |
| **S-8.2.2** | Configurar build command (`pnpm build`) e output directory (`dist`) | Build passa sem erros de TypeScript ou linter |
| **S-8.2.3** | Configurar redirects/rewrites para SPA (`/*` → `/index.html`) | Todas as rotas do React Router funcionam com refresh do navegador |
| **S-8.2.4** | Configurar GitHub Actions (ou Vercel checks) para rodar `pnpm lint` e `pnpm test` em PRs | PRs com erros de lint ou testes falhando são bloqueados de merge |
| **S-8.2.5** | Configurar Playwright para rodar em CI contra ambiente de staging | Testes E2E rodam automaticamente em cada PR com relatório de resultados |

### Epic 8.3 — Go-Live Checklist

| ID | Task | Critério de Aceite |
|----|------|-------------------|
| **S-8.3.1** | Audit de segurança: verificar que todas as tabelas têm RLS ativo, sem chaves hardcoded no frontend | Zero segredos no código. `supabase/client.ts` usa `import.meta.env` em vez de valores hardcoded |
| **S-8.3.2** | Configurar domínio customizado na Vercel + SSL | HTTPS ativo. Redirect HTTP → HTTPS |
| **S-8.3.3** | Configurar Supabase Auth redirect URLs para domínio de produção | Links de convite (`invite-user` → `redirectTo`) e recuperação (`resetPasswordForEmail`) apontam para o domínio correto. Incluir na allowlist **Redirect URLs** a URL completa `https://<domínio>/definir-senha` (e equivalentes local/staging, ex.: `http://localhost:8080/definir-senha`), não apenas a raiz do site |
| **S-8.3.4** | Criar usuário Admin inicial (seed) no Supabase | Admin pode acessar o sistema e criar os primeiros consultores |
| **S-8.3.5** | Testar fluxo completo em produção: login → criar lead → avançar pipeline → fechar | Smoke test manual end-to-end no ambiente de produção |
| **S-8.3.6** | Documentar runbook de operação (backup, rollback, monitoramento) | `docs/runbook.md` com procedimentos de emergência |

---

## Resumo de Dependências entre Fases

```
Fase 1 (Backend)
  └──→ Fase 2 (Auth) ──→ Fase 6 (Usuários)
  └──→ Fase 3 (Pipeline) ──→ Fase 4 (Leads) ──→ Fase 5 (Dashboards)
                                                       │
                                            Fase 7 (Mobile) ──→ Fase 8 (Lançamento)
```

| Fase | Depende de | Pode paralelizar com |
|------|-----------|---------------------|
| 1 — Backend | Nenhuma | — |
| 2 — Auth | Fase 1 | — |
| 3 — Pipeline | Fase 1 | Fase 2 (parcialmente) |
| 4 — Leads | Fases 1, 3 | Fase 2 |
| 5 — Dashboards | Fases 1, 3, 4 | Fase 6 |
| 6 — Usuários | Fases 1, 2 | Fases 4, 5 |
| 7 — Mobile | Fases 2–6 | — |
| 8 — Lançamento | Todas | — |

---

## Estimativa Total

| Fase | Estimativa |
|------|-----------|
| Fase 1 — Fundação Backend | 3-4 dias |
| Fase 2 — Autenticação | 2-3 dias |
| Fase 3 — Pipeline Kanban | 5-7 dias |
| Fase 4 — Gestão de Leads | 5-7 dias |
| Fase 5 — Dashboards | 4-5 dias |
| Fase 6 — Gestão de Usuários | 2-3 dias |
| Fase 7 — Responsividade | 3-4 dias |
| Fase 8 — Preparação Lançamento | 5-7 dias |
| **Total estimado** | **29-40 dias úteis** |

---

*Documento gerado por Claude (claude-4.6-opus-high-thinking) com base no PRD v1.1 e nas Regras de Progressão v1.0. Referências cruzadas com RFs, USs e RNFs do PRD estão indicadas em cada User Story.*
