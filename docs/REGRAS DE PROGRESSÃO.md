# Regras de Progressão de Leads & KPIs do Dashboard

**Referência:** PRD-CRM-TopClass v1.1 (RFs 06–10, 25–30)
**Última atualização:** 27 de março de 2026

---

## 1. Visão Geral do Pipeline

O pipeline do CRM Top Class possui **4 etapas sequenciais obrigatórias** e **1 status especial**:

```
Atendimento → Negociação → Fechado → Perdido
                                  ↓
                               Inativo (churn)
```

**Regras gerais:**

- Nenhuma etapa pode ser pulada — a progressão é estritamente sequencial.
- Toda movimentação de etapa é validada no **frontend** (UX) e no **backend** (RLS + trigger Postgres).
- Toda movimentação gera registro automático na tabela `pipeline_logs` (imutável — sem UPDATE/DELETE).
- O campo `ultima_movimentacao_at` é atualizado automaticamente via trigger a cada mudança de status ou nova interação registrada.

---

## 2. Regras de Progressão por Etapa

### 2.1 Cadastro do Lead (entrada em Atendimento)

| Item | Detalhe |
|------|---------|
| **Campos obrigatórios** | `nome`, `telefone` (apenas esses dois) |
| **Origem e Necessidade** | Não são coletados no cadastro inicial |
| **Consultor** | Se o autor é Consultor: `consultor_id` é atribuído automaticamente. Se Admin: campo de seleção de consultor visível |
| **Status inicial** | `'atendimento'` |
| **Log automático** | Trigger insere em `pipeline_logs` → `status_anterior: null`, `status_novo: 'atendimento'` |
| **Resultado visual** | Lead aparece imediatamente na coluna Atendimento do Kanban |

---

### 2.2 Atendimento → Negociação

| Item | Detalhe |
|------|---------|
| **Campos obrigatórios (gates)** | `origem` e `necessidade` |

**Valores aceitos para `origem`:**

| Valor no banco | Exibição |
|----------------|----------|
| `'indicacao'` | Indicação |
| `'google'` | Google |
| `'placa'` | Placa |
| `'rede_social'` | Rede Social |

**Valores aceitos para `necessidade`:**

| Valor no banco | Exibição |
|----------------|----------|
| `'escritorio_virtual'` | Escritório Virtual |
| `'salas'` | Salas |
| `'endereco_fiscal'` | Endereço Fiscal |
| `'coworking'` | Coworking |

**Comportamento:**

- Se qualquer campo obrigatório estiver vazio → bloqueio + alerta com campos faltantes destacados.
- Todos preenchidos → status muda para `'negociacao'`.
- Trigger registra em `pipeline_logs`.

---

### 2.3 Negociação → Fechado

Esta é a transição mais exigente do pipeline. Todos os gates abaixo devem ser satisfeitos simultaneamente.

#### Gates obrigatórios

| Categoria | Campos obrigatórios |
|-----------|---------------------|
| **Serviço** | `servico_interesse`, `valor_bruto` |
| **Dados pessoais** | `email`, `rg`, `cpf` |
| **Pessoa Jurídica** (se checkbox PJ ativo) | `cnpj`, `razao_social` (adicionais) |
| **Documentação** | Ao menos **1 comprovante de residência** enviado com nome/descrição |
| **Financeiro** | `status_financeiro = 'pago'` |

**Valores aceitos para `servico_interesse`:**

| Valor no banco | Exibição |
|----------------|----------|
| `'plano_pro'` | Plano Pro |
| `'plano_premium'` | Plano Premium |
| `'plano_top'` | Plano Top |
| `'coworking_hora'` | Coworking - Hora |
| `'coworking_turno'` | Coworking - Turno |
| `'coworking_diaria'` | Coworking - Diária |
| `'coworking_mensal_4h'` | Coworking Mensal - 4 Horas |
| `'coworking_mensal_8h'` | Coworking Mensal - 8 Horas |
| `'sala_special_room'` | Sala Special Room (até 3 pessoas) |
| `'mini_sala_reuniao'` | Mini Sala de Reunião (até 5 pessoas) |
| `'sala_reuniao_8'` | Sala de Reunião (até 8 pessoas) |
| `'sala_reuniao_12'` | Sala de Reunião (até 12 pessoas) |
| `'salas_fixas'` | Salas Fixas |

_Obs.: o tipo PostgreSQL `servico_enum` ainda inclui o valor legado `'coworking'` (sem uso na UI); novos cadastros usam apenas os cinco planos Coworking listados acima._

#### Desconto e valor líquido

- `porcentagem_desconto` é **opcional** (aceita de 0,01% a 100%).
- `valor_liquido` é calculado automaticamente: `valor_bruto × (1 - porcentagem_desconto / 100)`.
- Se desconto vazio → `valor_liquido = valor_bruto`.
- Campo `valor_liquido` é **somente leitura** no frontend.

#### Gate de pagamento

- Se `status_financeiro = 'pendente'` → **bloqueio total** do avanço + flag visual "⚠ Pagamento Pendente" + mensagem "Confirme o pagamento antes de fechar este lead."
- Somente quando `status_financeiro = 'pago'` o avanço é liberado.

**Comportamento:**

- Qualquer gate não satisfeito → bloqueio + alerta especificando o que falta.
- Todos os critérios atendidos → status muda para `'fechado'`.
- Trigger registra em `pipeline_logs`.

---

### 2.4 Movimentação para Perdido

| Item | Detalhe |
|------|---------|
| **Disponível em** | Atendimento e Negociação (apenas) |
| **Campo obrigatório** | `motivo_perda_tipo` |
| **Se motivo = 'outro'** | Campo `motivo_perda_descricao` (texto livre) torna-se obrigatório |
| **Editável posteriormente** | Sim — o motivo de perda pode ser alterado após o registro |

**Valores aceitos para `motivo_perda_tipo`:**

| Valor no banco | Exibição |
|----------------|----------|
| `'parou_responder'` | Parou de responder |
| `'sem_interesse'` | Sem interesse |
| `'preco'` | Preço |
| `'concorrencia'` | Concorrência |
| `'outro'` | Outro (exige descrição) |

**Comportamento:**

- Modal com seleção obrigatória de motivo.
- Salva `motivo_perda_tipo` e `motivo_perda_descricao`.
- Status muda para `'perdido'`.
- Trigger registra em `pipeline_logs`.

---

### 2.5 Fechado → Inativo (Churn)

| Item | Detalhe |
|------|---------|
| **Disponível em** | Apenas para leads com `status = 'fechado'` |
| **Quem pode executar** | Admin e Consultor responsável pelo lead |
| **Resultado** | Status muda para `'inativo'` |
| **Visual** | Badge "Inativo" exibido na listagem e pipeline |
| **Impacto nos KPIs** | Lead **excluído** dos KPIs de Negócios Ganhos e Valor Total Ganho |
| **Dados** | Todos os dados e histórico são preservados integralmente |

---

### 2.6 Diagrama de Transições Permitidas

```
                ┌──────────────┐
                │  ATENDIMENTO │
                └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          │ (origem +  │            │ (motivo de
          │ necessidade)            │  perda)
          ▼            │            ▼
   ┌──────────────┐    │    ┌──────────────┐
   │  NEGOCIAÇÃO  │    │    │   PERDIDO    │
   └──────┬───────┘    │    └──────────────┘
          │            │            ▲
          │ (todos os  │            │ (motivo de
          │  gates)    │            │  perda)
          ▼            │            │
   ┌──────────────┐    │    ────────┘
   │   FECHADO    │────┘
   └──────┬───────┘
          │
          │ (churn)
          ▼
   ┌──────────────┐
   │   INATIVO    │
   └──────────────┘
```

**Transições proibidas (nunca permitidas):**

- Atendimento → Fechado (pula Negociação)
- Perdido → qualquer etapa (sem reativação no MVP)
- Inativo → qualquer etapa (sem reativação no MVP)
- Fechado → Atendimento ou Negociação (sem retrocesso)

---

## 3. Cards KPI do Dashboard

### 3.1 Dashboard Admin — Linha 1 (KPIs Principais)

#### Leads Totais

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Volume total de leads no funil |
| **Cálculo** | `COUNT(*)` de todos os leads no período filtrado |
| **Filtro de status** | Nenhum — considera todos os status (atendimento, negociação, fechado, perdido, inativo) |
| **Filtro temporal** | Aplica o filtro de período selecionado (Hoje / 7 dias / 30 dias / Total) |

#### Taxa de Conversão

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Eficácia do funil em converter leads ativos em clientes |
| **Cálculo** | `(Fechados / (Total de Leads - Perdidos)) × 100` |
| **Importante** | Leads com `status = 'perdido'` são **excluídos do denominador**, para refletir a taxa sobre leads que ainda estão ativos ou foram convertidos |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Negócios Ganhos

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Quantidade de leads que chegaram ao fechamento |
| **Cálculo** | `COUNT(*)` onde `status = 'fechado'` |
| **Filtro de status** | Considera **apenas** leads com `status = 'fechado'` |
| **Observação** | Leads com `status = 'inativo'` (churn) **não** são contabilizados aqui |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Valor Total Ganho (R$)

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Receita confirmada dos negócios fechados e pagos |
| **Cálculo** | `SUM(valor_liquido)` onde `status = 'fechado'` **E** `status_financeiro = 'pago'` |
| **Filtro de status** | `status = 'fechado'` |
| **Filtro financeiro** | `status_financeiro = 'pago'` (exclui leads fechados com pagamento pendente) |
| **Filtro temporal** | Aplica o filtro de período selecionado |

---

### 3.2 Dashboard Admin — Linha 2 (KPIs Adicionais)

#### Negócios Perdidos

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Volume de leads que não converteram |
| **Cálculo** | `COUNT(*)` onde `status = 'perdido'` |
| **Filtro de status** | Considera **apenas** leads com `status = 'perdido'` |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Valor de Negócios Perdidos (R$)

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Receita potencial perdida |
| **Cálculo** | `SUM(valor_bruto)` onde `status = 'perdido'` **E** `valor_bruto IS NOT NULL` |
| **Filtro de status** | `status = 'perdido'` |
| **Observação** | Usa `valor_bruto` (não líquido), pois leads perdidos podem não ter desconto negociado. Leads perdidos em Atendimento (sem `valor_bruto`) não entram na soma |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Somatório de Descontos (R$)

| Aspecto | Definição |
|---------|-----------|
| **O que mede** | Total de descontos concedidos nos negócios fechados |
| **Cálculo** | `SUM(valor_bruto - valor_liquido)` onde `status = 'fechado'` |
| **Filtro de status** | Considera **apenas** leads com `status = 'fechado'` |
| **Observação** | Se não houve desconto (`valor_bruto = valor_liquido`), a contribuição do lead para este KPI é zero |
| **Filtro temporal** | Aplica o filtro de período selecionado |

---

### 3.3 Dashboard Admin — Gráficos

#### Leads e Ganhos por Dia

| Aspecto | Definição |
|---------|-----------|
| **Tipo** | Gráfico de linha dupla |
| **Linha 1 (branco/cinza)** | Total de leads criados por dia |
| **Linha 2 (vermelho)** | Leads com `status = 'fechado'` por dia |
| **Eixo X** | Dias do período filtrado |
| **Eixo Y** | Quantidade de leads |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Leads por Origem

| Aspecto | Definição |
|---------|-----------|
| **Tipo** | Gráfico de barras verticais |
| **Categorias** | Indicação, Google, Placa, Rede Social |
| **Filtro de status** | **Nenhum** — considera **todos** os leads independente do status |
| **Finalidade** | Mostra de quais canais vêm os leads em geral |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Clientes por Origem

| Aspecto | Definição |
|---------|-----------|
| **Tipo** | Gráfico de barras verticais |
| **Categorias** | Indicação, Google, Placa, Rede Social |
| **Filtro de status** | Considera **apenas** leads com `status = 'fechado'` |
| **Finalidade** | Mostra quais canais geram clientes efetivos (conversões), permitindo comparação com "Leads por Origem" para identificar canais com melhor taxa de conversão |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Leads por Plano/Serviço

| Aspecto | Definição |
|---------|-----------|
| **Tipo** | Gráfico de barras horizontais |
| **Categorias** | Plano Pro, Plano Premium, Plano Top, Coworking - Hora, Coworking - Turno, Coworking - Diária, Coworking Mensal - 4 Horas, Coworking Mensal - 8 Horas, Sala Special Room, Mini Sala Reunião, Sala Reunião até 8, Sala Reunião até 12, Salas Fixas |
| **Filtro de status** | **Nenhum** — considera **todos** os leads que possuem `servico_interesse` preenchido, independente do status |
| **Observação** | Leads em Atendimento (sem `servico_interesse`) não aparecem neste gráfico |
| **Filtro temporal** | Aplica o filtro de período selecionado |

#### Clientes por Plano/Serviço

| Aspecto | Definição |
|---------|-----------|
| **Tipo** | Gráfico de barras horizontais |
| **Categorias** | Mesmas do gráfico anterior |
| **Filtro de status** | Considera **apenas** leads com `status = 'fechado'` |
| **Finalidade** | Mostra quais serviços são efetivamente contratados, permitindo comparação com "Leads por Plano/Serviço" para identificar serviços com melhor taxa de fechamento |
| **Filtro temporal** | Aplica o filtro de período selecionado |

---

### 3.4 Dashboard Admin — Tabela de Performance por Consultor

| Coluna | Cálculo |
|--------|---------|
| **Consultor** | Nome do consultor (`perfis.nome_completo`) |
| **Leads** | `COUNT(*)` de leads atribuídos ao consultor no período |
| **Ganhos** | `COUNT(*)` onde `status = 'fechado'` para o consultor |
| **Conversão (%)** | `(Ganhos / Leads) × 100` por consultor |
| **Valor Ganho (R$)** | `SUM(valor_liquido)` onde `status = 'fechado'` **E** `status_financeiro = 'pago'` para o consultor |

---

### 3.5 Dashboard Admin — Filtros Temporais

| Filtro | Abrangência |
|--------|-------------|
| **Hoje** | Leads criados no dia atual |
| **7 dias** | Leads criados nos últimos 7 dias |
| **30 dias** | Leads criados nos últimos 30 dias |
| **Total** | Todos os leads sem restrição de data |

Os filtros afetam **todos** os cards KPI, gráficos e a tabela de performance **simultaneamente**.

---

### 3.6 Dashboard Consultor (Visão Restrita)

O Dashboard do Consultor exibe dados **exclusivamente dos seus próprios leads**, isolados via RLS no Supabase.

#### Cards KPI disponíveis

| Card | Cálculo | Presente? |
|------|---------|-----------|
| **Leads Totais** | `COUNT(*)` dos leads próprios no período | Sim |
| **Taxa de Conversão** | `(Fechados / (Total - Perdidos)) × 100` dos leads próprios | Sim |
| **Negócios Fechados** | `COUNT(*)` onde `status = 'fechado'` dos leads próprios | Sim |
| **Negócios Perdidos** | `COUNT(*)` onde `status = 'perdido'` dos leads próprios | Sim |
| Valor Total Ganho | — | **Não disponível** |
| Somatório de Descontos | — | **Não disponível** |
| Valor de Negócios Perdidos | — | **Não disponível** |

#### Gráficos disponíveis

Mesmos gráficos do Admin, porém filtrados por RLS (apenas leads próprios):

- Leads e Ganhos por Dia
- Leads por Origem
- Clientes por Origem
- Leads por Plano/Serviço
- Clientes por Plano/Serviço

#### Componentes ausentes

- Tabela de Performance por Consultor (exclusiva do Admin)
- Qualquer dado de outros consultores

---

## 4. Resumo de Filtros por Status nos KPIs

Tabela de referência rápida para implementação:

| Componente | Filtro de Status | Filtro Financeiro |
|------------|------------------|-------------------|
| Leads Totais | Nenhum (todos) | Nenhum |
| Taxa de Conversão | Exclui `'perdido'` do denominador | Nenhum |
| Negócios Ganhos | `status = 'fechado'` | Nenhum |
| Valor Total Ganho | `status = 'fechado'` | `status_financeiro = 'pago'` |
| Negócios Perdidos | `status = 'perdido'` | Nenhum |
| Valor de Negócios Perdidos | `status = 'perdido'` | Nenhum (usa `valor_bruto`) |
| Somatório de Descontos | `status = 'fechado'` | Nenhum |
| Leads por Origem | Nenhum (todos) | Nenhum |
| Clientes por Origem | `status = 'fechado'` | Nenhum |
| Leads por Plano/Serviço | Nenhum (todos com `servico_interesse` preenchido) | Nenhum |
| Clientes por Plano/Serviço | `status = 'fechado'` | Nenhum |
| Leads e Ganhos por Dia | Nenhum (todos) + `status = 'fechado'` (2 linhas) | Nenhum |
| Tabela Performance — Valor Ganho | `status = 'fechado'` | `status_financeiro = 'pago'` |
