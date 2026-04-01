# PRD — CRM Top Class Escritório Virtual

**Versão:** 1.1  
**Data:** 26 de março de 2026  
**Autor:** Product Manager (assistido por Claude claude-4.6-opus-high-thinking)  
**Stack:** Lovable (UI) · Supabase (banco + auth + RLS + storage) · Cursor (dev) · Vercel (hospedagem frontend)  
**Status:** Aprovado para desenvolvimento

---

## Índice

1. [Sumário Executivo](#1-sumário-executivo)
2. [Contexto de Negócio](#2-contexto-de-negócio)
3. [Personas e Jornadas](#3-personas-e-jornadas)
4. [Requisitos Funcionais por Módulo](#4-requisitos-funcionais-por-módulo)
5. [Requisitos Não Funcionais](#5-requisitos-não-funcionais)
6. [Arquitetura Técnica](#6-arquitetura-técnica)
7. [Roadmap](#7-roadmap)
8. [Riscos e Mitigações](#8-riscos-e-mitigações)
9. [Fora do Escopo](#9-fora-do-escopo)

---

## 1. Sumário Executivo

### Problema

O Top Class Escritório Virtual recebe contatos de potenciais clientes por múltiplos canais (indicações, Google, placas e redes sociais), mas o processo comercial é gerenciado de forma manual e descentralizada. As consequências diretas são:

- **Perda de leads** por falta de acompanhamento estruturado
- **Zero visibilidade** sobre o estágio de cada negociação
- **Impossibilidade de medir** a performance dos consultores comerciais
- **Nenhum controle** sobre taxa de conversão e receita em aberto

O resultado é oportunidade de venda perdida sistematicamente por desorganização do funil — não por falta de demanda.

### Solução

CRM web próprio da Top Class com:

- **Pipeline Kanban** de 4 etapas (Atendimento → Negociação → Fechado → Perdido) + status Inativo, com regras de progressão obrigatórias por etapa
- **Dois perfis de acesso** — Admin (visão total) e Consultor Comercial (visão restrita aos próprios leads)
- **Dashboards personalizados** por perfil com KPIs em tempo real
- **Gestão documental** integrada via Supabase Storage
- **Gate de pagamento** — lead só avança para Fechado com status financeiro "Pago"
- **Histórico imutável** no uso cotidiano (sem edição ou exclusão isolada de anotações); remoção somente na exclusão integral do lead pelo Admin (RF-24)

### Diferencial competitivo frente ao mercado

Nenhuma solução de CRM existente (Pipedrive, RD Station CRM, Moskit, Agendor) oferece nativamente a combinação de: validação obrigatória por etapa do funil, bloqueio de avanço por pagamento pendente e upload de documentação contratual vinculada ao lead. A construção de um CRM próprio elimina custos recorrentes por usuário e entrega aderência total ao processo comercial da Top Class.

---

## 2. Contexto de Negócio

### 2.1 Sobre a Top Class

A Top Class é um escritório virtual que oferece planos de coworking, salas de reunião, endereço fiscal e escritório virtual. Os serviços comercializados são:

| Categoria | Serviços |
|-----------|----------|
| Planos de Escritório Virtual | Plano Pro · Plano Premium · Plano Top |
| Espaços | Coworking · Sala Special Room (até 3 pessoas) · Mini Sala de Reunião (até 5 pessoas) · Sala de Reunião (até 8 pessoas) · Sala de Reunião (até 12 pessoas) · Salas Fixas |

### 2.2 Canais de aquisição

| Canal | Identificador no sistema |
|-------|--------------------------|
| Indicação | `indicacao` |
| Google | `google` |
| Placa | `placa` |
| Rede Social | `rede_social` |

### 2.3 Processo comercial atual (AS-IS)

Leads chegam por múltiplos canais → são registrados de forma descentralizada (planilhas, anotações, WhatsApp) → sem acompanhamento padronizado → sem visibilidade de funil → perda sistemática de oportunidades.

### 2.4 Processo comercial desejado (TO-BE)

Lead cadastrado no CRM com dados mínimos (nome + telefone) → entra automaticamente em Atendimento → consultor qualifica o lead (origem + interesse) para avançar a Negociação → consultor preenche dados de serviço, contratuais e documentos para Fechado → gate de pagamento impede fechamento prematuro → dashboards entregam visibilidade em tempo real → dados para decisão estratégica disponíveis a qualquer momento.

### 2.5 Benchmark de mercado

| Plataforma | Pontos fortes | Lacunas para a Top Class |
|------------|---------------|--------------------------|
| **Pipedrive** | Pipeline Kanban polido, dashboards por perfil, IA preditiva | Sem validação obrigatória por etapa, sem gate de pagamento, sem upload documental vinculado ao lead. Custo a partir de US$ 14/usuário/mês |
| **RD Station CRM** | Integração com automação de marketing RD Station | Pipeline básico, sem validação por fase, sem upload de documentos, sem controle financeiro no funil. R$ 50–150/usuário/mês |
| **Moskit CRM** | Interface simples, mobile sólido, pipeline funcional | Relatórios básicos, sem regras de negócio customizáveis, sem upload documental, sem gate de pagamento |
| **Agendor** | Pipeline visual, relatórios de funil, gestão de atividades | Sem documentação contratual, sem status financeiro como gate. Bom onboarding para times enxutos |

### 2.6 Referências de design e UX

A interface segue o padrão visual já validado pela Top Class:

- **Tema escuro** como base (fundo dark, textos claros)
- **Vermelho/rosa (#E91E63 ou similar)** como cor de destaque e ação primária
- **Sidebar fixa** à esquerda com navegação principal
- **Cards KPI** com ícones de tendência no dashboard
- **Gráficos de linha e barras** para visualização de métricas temporais e por origem

---

## 3. Personas e Jornadas

### 3.1 Personas

#### Persona 1: Admin (Gestor Comercial)

| Atributo | Descrição |
|----------|-----------|
| **Papel** | Responsável pela operação comercial e gestão do time |
| **Necessidades** | Visão completa do funil, performance por consultor, controle de receita, gestão de acessos |
| **Dores** | Sem visibilidade de resultados, não sabe quais leads estão parados, não consegue medir conversão |
| **Acesso no sistema** | Total — vê todos os leads, todos os dashboards, gerencia usuários, exporta CSV, reatribui leads |

#### Persona 2: Consultor Comercial

| Atributo | Descrição |
|----------|-----------|
| **Papel** | Responsável por atender leads, conduzir negociações e fechar contratos |
| **Necessidades** | Registrar leads rapidamente, avançar no funil, acompanhar seus resultados |
| **Dores** | Perde leads por falta de organização, não sabe quantas vendas fez no mês, retrabalho de dados |
| **Acesso no sistema** | Restrito aos próprios leads — não vê dados de outros consultores nem receita global |

### 3.2 User Stories com Prioridade MoSCoW

#### Autenticação e Acesso

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-01 | Como Admin, quero fazer login com e-mail e senha e ser direcionado automaticamente ao dashboard Admin, para acessar a visão completa do funil | **Must** |
| US-02 | Como Consultor, quero fazer login com e-mail e senha e ser direcionado automaticamente ao dashboard Consultor, para ver apenas meus leads | **Must** |
| US-03 | Como usuário, quero recuperar minha senha via e-mail, para não depender do Admin quando esquecer a senha | **Must** |
| US-04 | Como Consultor novo, quero definir minha senha pelo link de convite recebido por e-mail, para ter um primeiro acesso seguro e autônomo | **Must** |
| US-05 | Como usuário, quero que o sistema não revele se um e-mail está cadastrado (nem no login, nem na recuperação), para proteger dados contra enumeração | **Must** |

#### Pipeline Kanban

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-06 | Como Consultor, quero cadastrar um novo lead preenchendo apenas nome e telefone, para que ele entre automaticamente em Atendimento com o mínimo de fricção | **Must** |
| US-07 | Como Admin, quero selecionar o consultor responsável ao cadastrar um lead, para atribuir corretamente desde o início | **Must** |
| US-08 | Como Consultor, quero avançar um lead de Atendimento para Negociação preenchendo origem e interesse (necessidade identificada), para qualificar o lead antes de negociar | **Must** |
| US-09 | Como Consultor, quero informar opcionalmente uma porcentagem de desconto e ver o valor líquido calculado automaticamente ao preencher os dados para Fechado, para controlar descontos concedidos | **Must** |
| US-10 | Como Consultor, quero avançar um lead de Negociação para Fechado apenas quando serviço de interesse, valor bruto, dados pessoais/empresariais (RG, CPF, CNPJ, E-mail), documentação e pagamento estiverem completos, para garantir integridade dos fechamentos | **Must** |
| US-11 | Como Consultor, quero marcar um lead como Perdido (em Atendimento ou Negociação) informando obrigatoriamente o motivo, para alimentar análise de perdas | **Must** |
| US-12 | Como Consultor, quero ver uma flag visual "⚠ Pagamento Pendente" nos cards do Kanban quando o status financeiro for pendente, para priorizar cobranças | **Must** |
| US-13 | Como Consultor, quero arrastar cards entre colunas do Kanban (desktop) com validação automática das regras de negócio, para avançar leads de forma intuitiva | **Should** |
| US-14 | Como Consultor em mobile, quero avançar etapas via botão "Avançar Etapa" (substituindo drag-and-drop), para operar o pipeline pelo celular | **Should** |

#### Gestão de Leads

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-15 | Como Consultor, quero visualizar a listagem dos meus leads com campos progressivos conforme o status, para ter contexto rápido sem abrir cada lead | **Must** |
| US-16 | Como Admin, quero visualizar todos os leads de todos os consultores na listagem, para supervisionar o funil completo | **Must** |
| US-17 | Como Admin, quero exportar a listagem de leads em CSV (incluindo RG, CPF, CNPJ), para análises externas e relatórios | **Must** |
| US-18 | Como Admin, quero reatribuir um lead para outro consultor, para corrigir atribuições ou redistribuir carga | **Must** |
| US-19 | Como Consultor ou Admin, quero inativar um lead com status "Fechado" (churn), para refletir que o cliente não renovou sem perder dados históricos | **Must** |
| US-20 | Como usuário, quero buscar leads por nome, e-mail ou telefone e filtrar por status, origem, consultor e período, para localizar leads rapidamente | **Must** |
| US-21 | Como usuário, quero navegar pela listagem com paginação (25/50/100 por página), para manter a performance com volumes grandes | **Should** |

#### Detalhe do Lead

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-22 | Como Consultor, quero ver e editar os dados do lead organizados em seções progressivas (dados básicos, negociação, contratuais, documentos, financeiro), para preencher conforme o avanço no funil | **Must** |
| US-23 | Como Consultor, quero fazer upload de documentos (DOC, DOCX, JPG, PDF, até 10MB cada) com nome/descrição obrigatória, para anexar comprovantes e contratos ao lead | **Must** |
| US-24 | Como Consultor, quero registrar interações no histórico do lead com data/hora automáticas, para manter rastreabilidade completa | **Must** |
| US-25 | Como usuário, quero que o histórico de interações seja imutável no uso cotidiano (sem edição nem exclusão isolada de anotações), para garantir auditabilidade; a remoção de linhas de histórico ocorre somente na exclusão integral do lead pelo Admin (RF-24) | **Must** |
| US-26 | Como Consultor, quero marcar o checkbox "Pessoa Jurídica" para que campos CNPJ e Razão Social se tornem obrigatórios, para adequar o cadastro ao tipo de cliente | **Must** |
| US-43 | Como Admin, quero excluir permanentemente um lead após confirmação explícita no detalhe, para atender solicitações legítimas de eliminação de dados (ex.: Art. 18 LGPD) ou remover cadastros claramente incorretos ou duplicados | **Must** |

#### Dashboards

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-27 | Como Admin, quero ver KPIs de Leads Totais, Taxa de Conversão, Negócios Ganhos, Valor Total Ganho (R$), Negócios Perdidos, Valor de Negócios Perdidos e Somatório de Descontos, para monitorar a saúde do funil | **Must** |
| US-28 | Como Admin, quero ver gráficos de Leads e Ganhos por Dia, Leads por Origem, Clientes por Origem, Leads por Plano/Serviço e Clientes por Plano/Serviço, para comparar a distribuição geral de leads com os clientes efetivamente fechados e identificar canais e serviços mais eficazes | **Must** |
| US-29 | Como Admin, quero ver a tabela de Performance por Consultor (Leads, Ganhos, Conversão, Valor Ganho), para avaliar o time individualmente | **Must** |
| US-30 | Como Admin, quero filtrar todos os KPIs e gráficos por período (Hoje / 7 dias / 30 dias / Total), para analisar diferentes janelas temporais | **Must** |
| US-31 | Como Consultor, quero ver meus KPIs individuais (Leads, Conversão, Fechados, Perdidos) e gráficos restritos aos meus leads, para acompanhar meu desempenho | **Must** |

#### Gestão de Usuários

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-32 | Como Admin, quero cadastrar novos usuários (nome, e-mail, role) e que o sistema envie convite por e-mail via `inviteUserByEmail()`, para onboarding sem senha temporária | **Must** |
| US-33 | Como Admin, quero ativar/desativar consultores sem excluir seus dados e leads, para controlar acessos preservando histórico | **Must** |
| US-34 | Como Admin, quero reenviar o convite de primeiro acesso quando o link expirar (24h), para evitar que o consultor fique sem acesso | **Must** |
| US-35 | Como Admin, quero visualizar a lista de usuários com nome, e-mail, role, status, último acesso e ações, para gerenciar o time | **Must** |

#### Responsividade

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-36 | Como Consultor em mobile, quero acessar Login, Recuperar Senha, Definir Senha e Detalhe do Lead com layout responsivo, para operar fora do escritório | **Should** |
| US-37 | Como Consultor em mobile, quero ver a listagem de leads como cards verticais com Nome, Status, Origem e Data, para navegar rapidamente pelo celular | **Should** |
| US-38 | Como Consultor em mobile, quero ver o Pipeline como lista agrupada por status com filtro de coluna, substituindo o Kanban horizontal, para gerenciar leads em tela pequena | **Should** |
| US-39 | Como Consultor em mobile, quero ver o Dashboard com cards KPI empilhados e gráficos em largura total, para acompanhar métricas pelo celular | **Should** |

#### Integrações Futuras

| ID | User Story | MoSCoW |
|----|------------|--------|
| US-40 | Como Admin, quero receber notificações automáticas de novo lead cadastrado (via n8n), para reagir rapidamente | **Won't (V2.0)** |
| US-41 | Como Admin, quero alertas de leads sem movimentação há X dias (via n8n), para evitar leads estagnados | **Won't (V2.0)** |
| US-42 | Como Consultor, quero integração com WhatsApp para follow-up automatizado (via n8n), para agilizar contato com leads | **Won't (V2.0)** |

---

## 4. Requisitos Funcionais por Módulo

### Módulo 1: Autenticação e Controle de Acesso

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-01 | Login com e-mail e senha via Supabase Auth | 1. Campos e-mail e senha obrigatórios. 2. Credenciais válidas → redirect para `/dashboard`. 3. Credenciais inválidas → mensagem genérica sem revelar se e-mail existe. 4. Perfil determinado via consulta a `perfis.role` após auth | **Must** |
| RF-02 | Direcionamento automático por perfil | 1. `role = admin` → dashboard Admin com visão total. 2. `role = consultor` → dashboard Consultor com dados restritos via RLS. 3. Perfil nunca exposto na tela de login | **Must** |
| RF-03 | Recuperação de senha | 1. Usuário informa e-mail em `/recuperar-senha`. 2. Sistema exibe mensagem genérica idêntica independentemente de o e-mail existir. 3. `resetPasswordForEmail()` disparado via Supabase Auth. 4. Link expira em 1 hora. 5. Sem reenvio automático — usuário solicita novo link se necessário | **Must** |
| RF-04 | Definir/redefinir senha | 1. Tela `/definir-senha` usada em dois contextos: primeiro acesso (convite) e recuperação. 2. Título dinâmico conforme contexto ("Crie sua senha" / "Redefina sua senha"). 3. Mínimo 8 caracteres. 4. Campos "Nova Senha" e "Confirmar Senha" devem coincidir — botão desabilitado se divergirem. 5. Token inválido/expirado → mensagem de erro + link para `/recuperar-senha`. 6. Sucesso → redirect para `/login` com mensagem de confirmação | **Must** |
| RF-05 | Bloqueio de acesso para usuários inativos | 1. Usuário com `perfis.status = 'inativo'` não consegue acessar o sistema. 2. Sessão ativa é invalidada imediatamente quando o Admin desativa o perfil. 3. Dados e leads do consultor desativado permanecem intactos | **Must** |

### Módulo 2: Pipeline Kanban

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-06 | Cadastro de novo lead | 1. Botão "+ Novo Lead" abre modal. 2. Campos obrigatórios: Nome e Telefone (apenas). Origem e Necessidade não são coletados no cadastro. 3. Se Consultor: `consultor_id` atribuído automaticamente. 4. Se Admin: campo de seleção de consultor visível. 5. Validação bloqueia envio se Nome ou Telefone estiverem vazios. 6. Lead salvo com `status = 'atendimento'`. 7. Trigger Postgres registra em `pipeline_logs` (status_anterior: null → status_novo: atendimento). 8. Lead aparece imediatamente na coluna Atendimento | **Must** |
| RF-07 | Avanço Atendimento → Negociação | 1. Exige `origem` preenchido (Indicação / Google / Placa / Rede Social). 2. Exige `necessidade` preenchido (Escritório Virtual / Salas / Endereço Fiscal / Coworking). 3. Campos ausentes → bloqueio + alerta com campos faltantes destacados. 4. Todos preenchidos → status muda para `'negociacao'`. 5. Trigger Postgres registra em `pipeline_logs` | **Must** |
| RF-08 | Avanço Negociação → Fechado | 1. Campos obrigatórios de serviço: `servico_interesse` (10 opções: Plano Pro, Plano Premium, Plano Top, Coworking, Sala Special Room, Mini Sala Reunião, Sala Reunião até 8, Sala Reunião até 12, Salas Fixas) e `valor_bruto`. 2. `porcentagem_desconto` opcional (0,01% a 100%). `valor_liquido` calculado automaticamente: `valor_bruto × (1 - porcentagem_desconto / 100)`. Se desconto vazio, líquido = bruto. Campo somente leitura. 3. Campos obrigatórios pessoais: E-mail, RG, CPF. 4. Se PJ (checkbox ativo): CNPJ e Razão Social obrigatórios adicionalmente. 5. Sócios: quando aplicável, nome e contato de cada sócio. 6. Ao menos 1 comprovante de residência enviado com nome/descrição. 7. `status_financeiro` deve ser `'pago'`. Se `status_financeiro = 'pendente'` → bloqueio + flag visual "⚠ Pagamento Pendente" + mensagem "Confirme o pagamento antes de fechar este lead." 8. Todos os critérios atendidos → status muda para `'fechado'`. 9. Trigger Postgres registra em `pipeline_logs` | **Must** |
| RF-09 | Movimentação para Perdido | 1. Disponível apenas em Atendimento e Negociação. 2. Modal com seleção obrigatória de motivo: Parou de responder / Sem interesse / Preço / Concorrência / Outro. 3. Se "Outro" → campo texto livre obrigatório. 4. Salva `motivo_perda_tipo` e `motivo_perda_descricao`. 5. Status muda para `'perdido'`. 6. Trigger Postgres registra em `pipeline_logs`. 7. Motivo de perda editável posteriormente | **Must** |
| RF-10 | Inativação de cliente (churn) | 1. Disponível apenas para leads com `status = 'fechado'`. 2. Acessível para Admin e Consultor responsável. 3. Status muda para `'inativo'`. 4. Badge "Inativo" exibido na listagem e pipeline. 5. Lead excluído dos KPIs de Negócios Ganhos e Valor Total Ganho. 6. Dados e histórico preservados integralmente | **Must** |
| RF-11 | Drag-and-drop no Kanban (desktop) | 1. Arrastar card entre colunas aciona validação de regras de negócio. 2. Validação falha → card retorna à coluna de origem + mensagem de erro explicativa. 3. Validação sucede → movimentação confirmada com registro em `pipeline_logs` | **Should** |
| RF-12 | Layout Kanban em 4 colunas | 1. Colunas: Atendimento, Negociação, Fechado, Perdido. 2. Contador de leads no cabeçalho de cada coluna. 3. Cards exibem: Nome (destaque), Origem (tag colorida — exibida apenas quando preenchida), Valor Líquido (vermelho se > 0 — exibido apenas quando preenchido), Consultor responsável, Data de cadastro. 4. Cards em Negociação com pagamento pendente exibem flag "⚠ Pagamento Pendente" | **Must** |

### Módulo 3: Gestão de Leads (Listagem)

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-13 | Listagem com campos progressivos | 1. Leads em Atendimento: Nome, Telefone, Consultor, Data de Cadastro, Status. 2. A partir de Negociação: + Origem, Necessidade (Interesse). 3. Em Fechado: + Serviço de Interesse, Valor Bruto, Desconto (%), Valor Líquido, E-mail, CPF, RG, CNPJ, Razão Social, Documentos (ícone contagem), Status Financeiro. 4. Em Perdido: + Motivo da Perda (campos de Origem e Necessidade também visíveis se preenchidos) | **Must** |
| RF-14 | Busca e filtros | 1. Busca por nome, e-mail ou telefone (campo único). 2. Filtros: Status, Origem, Consultor (Admin only), Período. 3. Filtros combináveis. 4. Ao aplicar/remover filtro, retorna à página 1 | **Must** |
| RF-15 | Paginação | 1. Padrão: 25 leads por página. 2. Seletor: 25 / 50 / 100. 3. Botões Anterior/Próxima + input direto de página. 4. Total de registros exibido no rodapé ("Exibindo 1–25 de 143 leads"). 5. Respeita filtros ativos | **Should** |
| RF-16 | Exportação CSV (Admin) | 1. Botão visível e funcional apenas para Admin. 2. Exporta todos os campos do lead, incluindo RG, CPF e CNPJ. 3. Respeita filtros ativos no momento da exportação. 4. Registra em `exportacoes_log`: Admin que exportou, total de registros, filtros aplicados. 5. Indisponível em mobile | **Must** |
| RF-17 | Ações na listagem | 1. Ícone "Ver detalhes" (olho) — todos. 2. Ícone "Editar" (lápis) — todos. 3. Ícone "Reatribuir" (transferência) — Admin exclusivo. 4. Ícone "Inativar Cliente" — apenas para leads com `status = 'fechado'`, acessível para Admin e Consultor responsável | **Must** |

### Módulo 4: Detalhe e Edição do Lead

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-18 | Seções progressivas no detalhe | 1. Seção Dados Básicos: sempre visível (Nome, Telefone, Consultor, Data, Status). 2. Seção Qualificação: visível a partir de Atendimento para preenchimento, exibida a partir de Negociação (Origem, Necessidade/Interesse). 3. Seção Negociação e Contratuais: visível a partir de Negociação para preenchimento, exibida a partir de Fechado (Serviço de Interesse, Valor Bruto, Desconto %, Valor Líquido read-only, E-mail, RG, CPF, Contato, checkbox PJ → CNPJ + Razão Social, Sócios). 4. Seção Documentos. 5. Seção Status Financeiro. 6. Seção Histórico de Interações | **Must** |
| RF-19 | Upload de documentos | 1. Área de upload com drag-and-drop. 2. Campo nome/descrição obrigatório por arquivo. 3. Comprovante de residência obrigatório para avançar a Fechado. 4. Formatos aceitos: DOC, DOCX, JPG, PDF. 5. Limite: 10MB por arquivo. 6. Quantidade ilimitada de arquivos. 7. Lista exibe nome, formato, data e botão de download. 8. Armazenamento via Supabase Storage. 9. Acesso: Consultor responsável + Admin | **Must** |
| RF-20 | Histórico de interações | 1. Timeline vertical com anotações ordenadas cronologicamente. 2. Cada registro exibe: data, hora, nome do autor, texto. 3. Campo de nova anotação + botão "Registrar". 4. `created_at` automático do servidor. 5. Sem edição nem exclusão **isolada** de registros (imutabilidade via RLS); exclusão de linhas ocorre apenas quando o Admin exclui o lead inteiro (RF-24). 6. Admin pode registrar em qualquer lead; Consultor apenas nos seus | **Must** |
| RF-21 | Checkbox Pessoa Jurídica | 1. Ao ativar, campos CNPJ e Razão Social tornam-se obrigatórios. 2. Ao desativar, campos CNPJ e Razão Social voltam a ser opcionais (nullable) | **Must** |
| RF-22 | Gestão de sócios | 1. Botão "+ Adicionar Sócio" disponível no detalhe. 2. Campos por sócio: nome e contato. 3. Armazenamento em JSONB (`socios`). 4. Opcional — não impede avanço de etapa | **Must** |
| RF-23 | Status financeiro | 1. Toggle Pago/Pendente. 2. Campo numérico dia previsto para pagamento (1 a 31). 3. Se Pendente: alerta vermelho "⚠ Pagamento pendente — lead não pode ser fechado." 4. Alteração de Pendente → Pago libera o avanço para Fechado | **Must** |
| RF-24 | Ações fixas no rodapé do detalhe | 1. "Avançar Etapa" — ativo/inativo conforme regras de negócio. 2. "Marcar como Perdido" — disponível em Atendimento e Negociação. 3. "Inativar Cliente" — disponível apenas em Fechado. 4. "Salvar" — salva dados editados sem mudar status. 5. "Excluir lead" — **Admin exclusivo** (botão oculto para Consultor na UI; backend valida `role = admin`). Modal de confirmação obrigatório com aviso de irreversibilidade. Remove permanentemente o registro do lead e os dados associados: arquivos no Supabase Storage (`documentos-leads`), linhas em `documentos_lead`, `historico_interacoes` e `pipeline_logs`. Execução via função Postgres (`fn_excluir_lead_admin`) com política de DELETE no Storage apenas para Admin. Após sucesso, redireciona o usuário para a tela do pipeline | **Must** |

### Módulo 5: Dashboards

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-25 | Dashboard Admin — KPIs principais (Linha 1) | 1. Leads Totais: contagem total de leads no período. 2. Taxa de Conversão: (Fechados / Total de Leads) × 100 — não considera perdidos no denominador [ASSUMIDO — a Visão Estratégica diz "não considera leads perdidos" sem especificar se é no numerador ou denominador; assumimos que perdidos são excluídos do denominador para refletir a taxa sobre leads ativos]. 3. Negócios Ganhos: contagem de leads com `status = 'fechado'`. 4. Valor Total Ganho: soma de `valor_liquido` de leads com `status = 'fechado'` E `status_financeiro = 'pago'` | **Must** |
| RF-26 | Dashboard Admin — KPIs adicionais (Linha 2) | 1. Negócios Perdidos: contagem de leads com `status = 'perdido'`. 2. Valor de Negócios Perdidos: soma de `valor_bruto` de leads com `status = 'perdido'` que possuem `valor_bruto` preenchido. 3. Somatório de Descontos: soma de (`valor_bruto - valor_liquido`) de leads com `status = 'fechado'` | **Must** |
| RF-27 | Dashboard Admin — Gráficos (Linhas 3-5) | 1. Leads e Ganhos por Dia: gráfico de linha dupla (leads em branco/cinza, ganhos em vermelho). 2. Leads por Origem: gráfico de barras verticais (Indicação, Google, Placa, Rede Social) — considera **todos** os leads independente do status. 3. Clientes por Origem: gráfico de barras verticais (mesmas categorias) — considera **apenas** leads com `status = 'fechado'`. 4. Leads por Plano/Serviço: barras horizontais com nome do plano e quantidade — considera **todos** os leads que possuem `servico_interesse` preenchido, independente do status. 5. Clientes por Plano/Serviço: barras horizontais (mesmas categorias) — considera **apenas** leads com `status = 'fechado'` | **Must** |
| RF-28 | Dashboard Admin — Tabela Performance (Linha 5) | 1. Colunas: Consultor, Leads, Ganhos, Conversão (%), Valor Ganho (R$). 2. Dados calculados por consultor individual. 3. Valor Ganho considera apenas `status_financeiro = 'pago'` | **Must** |
| RF-29 | Dashboard Admin — Filtros temporais | Filtros: Hoje / 7 dias / 30 dias / Total. Afetam todos os cards, gráficos e tabelas simultaneamente | **Must** |
| RF-30 | Dashboard Consultor | 1. Cards: Leads Totais (próprios), Taxa de Conversão, Negócios Fechados, Negócios Perdidos (quantidade). 2. Sem Valor Total Ganho, sem Somatório de Descontos, sem Valor de Negócios Perdidos. 3. Gráficos: Leads e Ganhos por Dia, Leads por Origem, Clientes por Origem, Leads por Plano/Serviço, Clientes por Plano/Serviço — todos restritos via RLS aos leads próprios. 4. Sem tabela de Performance por Consultor. 5. Sem visibilidade de dados de outros consultores | **Must** |

### Módulo 6: Gestão de Usuários (Admin)

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-31 | Listagem de usuários | 1. Tabela com: Nome, E-mail, Role, Status (Ativo/Inativo), Último Acesso, Ações. 2. Consultores inativos exibidos com badge "Inativo" e opacidade reduzida. 3. Acessível apenas em `/admin/usuarios` | **Must** |
| RF-32 | Cadastro de novo usuário | 1. Modal com campos: Nome completo, E-mail, Role (Admin ou Consultor). 2. Sem campo de senha. 3. Sistema chama `inviteUserByEmail()` do Supabase Admin API. 4. E-mail de convite com link único enviado automaticamente. 5. Link expira em 24 horas. 6. Registro criado em `perfis` com `status = 'ativo'` | **Must** |
| RF-33 | Ativar/desativar usuário | 1. Toggle na tabela de usuários. 2. Desativar → `perfis.status = 'inativo'`. 3. Usuário desativado perde acesso imediatamente. 4. Leads e dados vinculados permanecem intactos. 5. Reativar → `perfis.status = 'ativo'` | **Must** |
| RF-34 | Reenviar convite | 1. Botão visível apenas quando o usuário ainda não completou o primeiro acesso. 2. Reenvia e-mail de convite com novo link de 24h | **Must** |

### Módulo 7: Reatribuição de Leads (Admin)

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-35 | Reatribuição de lead | 1. Ação disponível na listagem e no detalhe do lead — Admin exclusivo (oculta para Consultor via RLS + UI). 2. Modal com seleção de consultor ativo. 3. Atualiza `leads.consultor_id`. 4. Registra em `pipeline_logs` com observação automática: "Lead reatribuído de [Consultor A] para [Consultor B]" | **Must** |

### Módulo 8: Auditoria e Logs

| ID | Descrição | Critérios de Aceite | MoSCoW |
|----|-----------|---------------------|--------|
| RF-36 | Pipeline logs via trigger | 1. Toda alteração de `leads.status` gera registro automático em `pipeline_logs`. 2. Campos: lead_id, executado_por, status_anterior, status_novo, observacao, created_at. 3. Tabela somente leitura para usuários — inserção apenas via trigger Postgres. 4. Nenhum perfil tem permissão direta de UPDATE ou DELETE via RLS; remoção de linhas de `pipeline_logs` ocorre somente em cascata quando o Admin exclui o lead via `fn_excluir_lead_admin` (RF-24) | **Must** |
| RF-37 | Log de exportações CSV | 1. Cada exportação CSV gera registro em `exportacoes_log`. 2. Campos: exportado_por (Admin), total_registros, filtros_aplicados (JSONB), created_at. 3. Somente Admin tem SELECT e INSERT | **Must** |
| RF-38 | Atualização automática de `ultima_movimentacao_at` | 1. Trigger Postgres atualiza `leads.ultima_movimentacao_at` quando: (a) `leads.status` é alterado, ou (b) novo registro inserido em `historico_interacoes` para o lead. 2. Campo não editável pelo frontend | **Must** |

---

## 5. Requisitos Não Funcionais

### 5.1 Performance

| ID | Requisito | Meta | Critério de Aceite |
|----|-----------|------|-------------------|
| RNF-01 | Tempo de resposta da API (Supabase) | < 500ms | Queries simples (listagem, detalhe de lead) completam em menos de 500ms medidas no cliente em conexão de banda larga padrão |
| RNF-02 | First Contentful Paint (FCP) | < 1.5s | Tempo de carregamento inicial das telas em conexão de banda larga padrão menor que 1.5 segundo |
| RNF-03 | Feedback visual para operações pesadas | Imediato | Upload de múltiplos documentos exibe loading/progress bar imediatamente ao iniciar a operação |
| RNF-04 | Paginação como estratégia de performance | 25 leads/página padrão | Listagem carrega de forma incremental, sem buscar todos os registros de uma vez |

### 5.2 Segurança

| ID | Requisito | Implementação | Critério de Aceite |
|----|-----------|---------------|-------------------|
| RNF-05 | Proteção contra brute force no login | Rate limiting nativo do Supabase Auth | IPs bloqueados após múltiplas tentativas falhas consecutivas |
| RNF-06 | Prevenção de enumeração de usuários | Mensagens genéricas de erro | Login e recuperação de senha exibem a mesma mensagem independentemente de o e-mail existir |
| RNF-07 | Expiração de tokens | Supabase Auth nativo | Token de convite: 24h. Token de recuperação: 1h |
| RNF-08 | Rate limiting de APIs | Configuração na Vercel | Rate limiting padrão da Vercel para chamadas ao banco, prevenindo sobrecarga |
| RNF-09 | RLS (Row Level Security) | Supabase RLS | Todas as tabelas com políticas RLS ativas conforme definido na Seção 6. Consultor nunca acessa dados de outro consultor |
| RNF-10 | Isolamento de arquivos no Storage | Supabase Storage + RLS | Consultor acessa apenas documentos dos seus leads. Admin acessa todos |
| RNF-11 | Imutabilidade do histórico | RLS sem UPDATE/DELETE direto em `historico_interacoes` | Nenhum perfil consegue editar ou apagar anotações isoladamente. A remoção de interações ocorre apenas quando o Admin exclui o lead inteiro (RF-24), via função Postgres com privilégios elevados |
| RNF-12 | Acesso individual e intransferível | Autenticação por e-mail/senha | Cada usuário possui credenciais únicas. Sem login compartilhado |

### 5.3 LGPD (Lei Geral de Proteção de Dados)

| ID | Requisito | Implementação | Critério de Aceite |
|----|-----------|---------------|-------------------|
| RNF-13 | Minimização de dados | Campos obrigatórios apenas quando necessários por etapa | Cadastro exige apenas nome e telefone. Origem e interesse coletados na Negociação. Dados pessoais (RG, CPF, CNPJ), dados de serviço (serviço de interesse, valor) e documentos coletados apenas na fase de Fechado, não antecipadamente |
| RNF-14 | Controle de acesso a dados sensíveis | RLS + perfis de acesso | RG, CPF e CNPJ acessíveis apenas pelo Consultor responsável e Admin. Sem acesso cruzado entre consultores |
| RNF-15 | Rastreabilidade de acesso e exportação | `exportacoes_log` + `pipeline_logs` | Toda exportação CSV (que inclui dados sensíveis) é registrada com identificação do Admin, timestamp e filtros aplicados |
| RNF-16 | Retenção e preservação de dados | Padrão: dados mantidos indefinidamente | Leads perdidos e inativos preservam todos os dados para auditoria e BI. **Exceção:** o Admin pode excluir permanentemente um lead específico (RF-24), removendo lead, histórico, documentos (Storage + metadados) e `pipeline_logs` associados — uso restrito a casos procedentes (ex.: exercício de direitos do titular, duplicidade, erro grave) |
| RNF-17 | Segurança no armazenamento de documentos | Supabase Storage com RLS | Documentos contratuais (comprovantes, RG, contratos) armazenados com acesso controlado. Sem acesso público |
| RNF-18 | Exportação CSV com dados sensíveis | Admin exclusivo + log | Exportação restrita ao Admin. Cada exportação gera registro auditável. Funcionalidade indisponível em mobile (reduz risco de exportação em dispositivos menos seguros) |
| RNF-18a | Direito de exclusão (Art. 18 LGPD) — atendimento operacional | Exclusão integral pelo Admin (RF-24) + evidência externa | Quando houver solicitação fundamentada do titular (ou decisão interna documentada para duplicidade/erro), o Admin executa a exclusão permanente no detalhe do lead, após confirmação no modal. **Recomenda-se** manter comprovante da solicitação ou decisão **fora do CRM** (protocolo, e-mail, termo), pois o sistema não registra log dedicado de exclusões após a remoção dos dados. Avaliar anonimização parcial em versões futuras quando a exclusão total não for obrigatória |
| [⚠️ LACUNA] | Termo de consentimento | A definir | Não há registro de consentimento do lead para tratamento dos seus dados pessoais. Recomenda-se avaliar se o consentimento é coletado fora do CRM (ex: formulário de contato, contrato) ou se deve ser incorporado ao sistema em versão futura |

### 5.4 Acessibilidade

| ID | Requisito | Meta | Critério de Aceite |
|----|-----------|------|-------------------|
| RNF-19 | Padrão WCAG | 2.1 nível AA básico | Ferramenta interna focada em produtividade. Conformidade verificável com ferramentas de auditoria |
| RNF-20 | Contraste | Alto contraste | Tema escuro com textos claros e cores de destaque com ratio de contraste ≥ 4.5:1 para texto normal |
| RNF-21 | Navegação por teclado | Completa | Tab/Enter funcional em todo o sistema: formulários, Kanban, modais, sidebar. Consultores devem operar sem mouse |
| RNF-22 | Tags ARIA | Básicas | Roles e labels ARIA nos elementos interativos para compatibilidade com leitores de tela |

### 5.5 Responsividade

| ID | Requisito | Critério de Aceite |
|----|-----------|-------------------|
| RNF-23 | Desktop-first | Resolução mínima: 1280px. Layout otimizado para desktop |
| RNF-24 | Mobile — telas totalmente responsivas | Login, Recuperar Senha, Definir Senha, Detalhe do Lead: coluna única, campos full-width, botões fixos no rodapé (até 768px) |
| RNF-25 | Mobile — listagem como cards | Tabela colapsa para cards verticais: Nome, Status (badge), Origem, Data. Botão "Ver detalhes" |
| RNF-26 | Mobile — dashboard adaptado | KPIs empilhados, gráficos full-width com scroll horizontal, tabela Performance como cards |
| RNF-27 | Mobile — pipeline como lista | Kanban substituído por lista agrupada por status com filtro no topo. Drag-and-drop substituído por "Avançar Etapa" e "Marcar como Perdido" |
| RNF-28 | Mobile — funcionalidades restritas | Exportação CSV indisponível em mobile |

### 5.6 Backup e Retenção

| ID | Requisito | Implementação | Critério de Aceite |
|----|-----------|---------------|-------------------|
| RNF-29 | Retenção de dados | Indefinida (com exceção pontual) | Por padrão, todos os dados (leads ativos, perdidos, inativos, histórico, logs) são mantidos sem prazo de expiração. **Exceção:** exclusão permanente de um lead pelo Admin (RF-24), alinhada a RNF-16 e RNF-18a |
| RNF-30 | Backup | Supabase nativo | Backups diários / Point-in-Time Recovery conforme tier contratado do Supabase. Sem rotina customizada de dump no MVP |

---

## 6. Arquitetura Técnica

### 6.1 Visão geral dos componentes

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Lovable)                     │
│              Hospedado na Vercel · Desktop-first            │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌─────────┐  │
│  │  Login   │ │Dashboard │ │Pipeline│ │Leads │ │  Admin  │  │
│  │  Auth    │ │Admin/Cons│ │ Kanban │ │Lista │ │Usuários │  │
│  └──────────┘ └──────────┘ └────────┘ └──────┘ └─────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ Supabase Client SDK (JS)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                       │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │   Auth   │ │ Database │ │ Storage  │ │   Edge Funcs   │  │
│  │(e-mail + │ │(Postgres)│ │(Docs do  │ │  (se necessário│  │
│  │ senha)   │ │ + RLS    │ │  lead)   │ │   no futuro)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Triggers Postgres                       │   │
│  │  • pipeline_logs (auto-insert em mudança de status)  │   │
│  │  • ultima_movimentacao_at (auto-update)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼ (Futuro — V2.0)
┌─────────────────────────────────────────────────────────────┐
│                    n8n (Automações)                         │
│  • Notificação de novo lead                                 │
│  • Alerta de lead sem movimentação                          │
│  • Integração WhatsApp                                      │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Modelo de Dados (Supabase / PostgreSQL)

#### Tabela: `perfis`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK, FK → `auth.users` | ID do usuário autenticado |
| `nome_completo` | text | NOT NULL | Nome exibido no sistema |
| `email` | text | NOT NULL, UNIQUE | E-mail de login |
| `role` | enum | NOT NULL. Valores: `'admin'`, `'consultor'` | Perfil de acesso |
| `status` | enum | DEFAULT `'ativo'`. Valores: `'ativo'`, `'inativo'` | Controle de acesso |
| `ultimo_acesso` | timestamptz | Nullable | Atualizado a cada login |
| `avatar_url` | text | Nullable | URL do avatar (uso futuro) |
| `created_at` | timestamptz | DEFAULT `now()` | Data de criação |
| `updated_at` | timestamptz | DEFAULT `now()` | Última atualização |

#### Tabela: `leads`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | bigint | PK, auto-increment | ID do lead |
| `consultor_id` | UUID | FK → `perfis`, NOT NULL | Consultor responsável (chave para RLS) |
| `nome` | text | NOT NULL | Nome do lead |
| `telefone` | text | NOT NULL | Telefone de contato |
| `origem` | enum | Nullable. Valores: `'indicacao'`, `'google'`, `'placa'`, `'rede_social'` | Canal de aquisição. Obrigatório para avançar a Negociação |
| `necessidade` | enum | Nullable. Valores: `'escritorio_virtual'`, `'salas'`, `'endereco_fiscal'`, `'coworking'` | Interesse/necessidade identificada. Obrigatório para avançar a Negociação |
| `status` | enum | DEFAULT `'atendimento'`. Valores: `'atendimento'`, `'negociacao'`, `'fechado'`, `'perdido'`, `'inativo'` | Etapa atual do funil |
| `servico_interesse` | enum | Nullable. Valores: `'plano_pro'`, `'plano_premium'`, `'plano_top'`, `'coworking'`, `'sala_special_room'`, `'mini_sala_reuniao'`, `'sala_reuniao_8'`, `'sala_reuniao_12'`, `'salas_fixas'` | Obrigatório para avançar a Fechado |
| `valor_bruto` | decimal(10,2) | Nullable | Valor cheio do serviço. Obrigatório para avançar a Fechado |
| `porcentagem_desconto` | decimal(5,2) | Nullable, CHECK (0.01–100) | Percentual de desconto. Opcional |
| `valor_liquido` | decimal(10,2) | Nullable | Calculado: `valor_bruto × (1 - porcentagem_desconto / 100)`. Armazenado para facilitar queries |
| `email` | text | Nullable | Obrigatório para avançar a Fechado |
| `rg` | text | Nullable | Obrigatório para avançar a Fechado |
| `cpf` | text | Nullable | Obrigatório para avançar a Fechado |
| `cnpj` | text | Nullable | Obrigatório se PJ |
| `razao_social` | text | Nullable | Obrigatório quando CNPJ preenchido |
| `contato_numero` | text | Nullable | Número adicional de contato |
| `socios` | JSONB | Nullable | Array de `{nome: text, contato: text}` |
| `status_financeiro` | enum | Nullable. Valores: `'pago'`, `'pendente'` | Gate para Fechado |
| `data_prevista_pagamento` | smallint | Nullable, CHECK (1–31) | Dia fixo do mês |
| `motivo_perda_tipo` | enum | Nullable. Valores: `'parou_responder'`, `'sem_interesse'`, `'preco'`, `'concorrencia'`, `'outro'` | Motivo da perda |
| `motivo_perda_descricao` | text | Nullable | Detalhamento quando tipo = `'outro'` |
| `created_at` | timestamptz | DEFAULT `now()` | Data de cadastro |
| `updated_at` | timestamptz | DEFAULT `now()` | Última edição |
| `ultima_movimentacao_at` | timestamptz | Nullable | Atualizado via trigger (mudança de status ou nova interação). Não editável pelo frontend |

#### Tabela: `historico_interacoes`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | bigint | PK, auto-increment | ID da interação |
| `lead_id` | bigint | FK → `leads`, NOT NULL | Lead associado |
| `autor_id` | UUID | FK → `perfis`, NOT NULL | Quem registrou |
| `anotacao` | text | NOT NULL | Texto da interação |
| `created_at` | timestamptz | DEFAULT `now()` | Data/hora (servidor). Sem `updated_at` — imutável por design |

#### Tabela: `documentos_lead`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | bigint | PK, auto-increment | ID do documento |
| `lead_id` | bigint | FK → `leads`, NOT NULL | Lead associado |
| `uploaded_by` | UUID | FK → `perfis`, NOT NULL | Quem fez upload |
| `nome_descricao` | text | NOT NULL | Nome/descrição definido pelo usuário |
| `arquivo_url` | text | NOT NULL | Path no Supabase Storage |
| `formato` | enum | Valores: `'doc'`, `'docx'`, `'jpg'`, `'pdf'` | Tipo do arquivo |
| `tamanho_bytes` | integer | Nullable | Tamanho do arquivo |
| `created_at` | timestamptz | DEFAULT `now()` | Data de upload |

#### Tabela: `pipeline_logs`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | bigint | PK, auto-increment | ID do log |
| `lead_id` | bigint | FK → `leads`, NOT NULL | Lead movimentado |
| `executado_por` | UUID | FK → `perfis`, NOT NULL | Quem executou |
| `status_anterior` | text | Nullable (null na criação) | Status antes da mudança |
| `status_novo` | text | NOT NULL | Status após a mudança |
| `observacao` | text | Nullable | Reatribuições e notas automáticas |
| `created_at` | timestamptz | DEFAULT `now()` | Timestamp da movimentação |

#### Tabela: `exportacoes_log`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | bigint | PK, auto-increment | ID da exportação |
| `exportado_por` | UUID | FK → `perfis`, NOT NULL | Admin que exportou |
| `total_registros` | integer | NOT NULL | Quantidade de leads no CSV |
| `filtros_aplicados` | JSONB | Nullable | Snapshot dos filtros ativos |
| `created_at` | timestamptz | DEFAULT `now()` | Timestamp da exportação |

### 6.3 Diagrama de Relacionamentos

```
auth.users ──── 1:1 ──── perfis
                           │
              ┌────────────┼────────────────────────┐
              │            │                        │
           1:N          1:N                      1:N
              │            │                        │
           leads    historico_interacoes     pipeline_logs
              │         (autor_id)          (executado_por)
              │
     ┌────────┼────────────┬─────────────┐
     │        │            │             │
  1:N      1:N          1:N           1:N
     │        │            │             │
historico  documentos   pipeline     exportacoes_log
interacoes  _lead        _logs      (Admin only)
(lead_id)  (lead_id)    (lead_id)
```

### 6.4 Políticas de RLS (Row Level Security)

#### Tabela `leads`

| Operação | Admin | Consultor |
|----------|-------|-----------|
| SELECT | Todos os registros | Apenas onde `consultor_id = auth.uid()` |
| INSERT | Sim (qualquer `consultor_id`) | Sim (apenas `consultor_id = auth.uid()`) |
| UPDATE | Todos os registros | Apenas onde `consultor_id = auth.uid()` |
| DELETE | Não permitido | Não permitido |

#### Tabela `historico_interacoes`

| Operação | Admin | Consultor |
|----------|-------|-----------|
| SELECT | Todos os registros | Apenas de leads com `consultor_id = auth.uid()` |
| INSERT | Qualquer lead | Apenas leads com `consultor_id = auth.uid()` |
| UPDATE | **Bloqueado** | **Bloqueado** |
| DELETE | **Bloqueado** | **Bloqueado** |

#### Tabela `documentos_lead`

| Operação | Admin | Consultor |
|----------|-------|-----------|
| SELECT | Todos | Apenas documentos de leads com `consultor_id = auth.uid()` |
| INSERT | Qualquer lead | Apenas leads com `consultor_id = auth.uid()` |
| UPDATE | Não permitido | Não permitido |
| DELETE | Não permitido | Não permitido |

#### Tabela `perfis`

| Operação | Admin | Consultor |
|----------|-------|-----------|
| SELECT | Todos | Apenas o próprio perfil (`id = auth.uid()`) |
| UPDATE | Todos (exceto o próprio `role` e `status` — [ASSUMIDO: para evitar escalação de privilégios, mesmo o Admin não deve alterar seu próprio role via API direta]) | Não permitido (Consultor não edita role nem status) |

#### Tabela `pipeline_logs`

| Operação | Admin | Consultor |
|----------|-------|-----------|
| SELECT | Todos | Apenas logs de leads com `consultor_id = auth.uid()` |
| INSERT | Via trigger apenas | Via trigger apenas |
| UPDATE | **Bloqueado** | **Bloqueado** |
| DELETE | **Bloqueado** | **Bloqueado** |

#### Tabela `exportacoes_log`

| Operação | Admin | Consultor |
|----------|-------|-----------|
| SELECT | Todos | **Bloqueado** |
| INSERT | Sim | **Bloqueado** |
| UPDATE | **Bloqueado** | **Bloqueado** |
| DELETE | **Bloqueado** | **Bloqueado** |

### 6.5 Triggers PostgreSQL

| Trigger | Tabela monitorada | Evento | Ação |
|---------|-------------------|--------|------|
| `trg_pipeline_log` | `leads` | AFTER UPDATE de `status` | Insere registro em `pipeline_logs` com `status_anterior`, `status_novo`, `executado_por` |
| `trg_ultima_movimentacao_status` | `leads` | AFTER UPDATE de `status` | Atualiza `leads.ultima_movimentacao_at` para `now()` |
| `trg_ultima_movimentacao_interacao` | `historico_interacoes` | AFTER INSERT | Atualiza `leads.ultima_movimentacao_at` para `now()` no lead correspondente |
| `trg_updated_at` | `leads`, `perfis` | BEFORE UPDATE | Atualiza `updated_at` para `now()` |

### 6.6 Supabase Storage

| Configuração | Valor |
|-------------|-------|
| Bucket | `documentos-leads` |
| Estrutura de pastas | `/{lead_id}/{arquivo_id}_{nome_original}` |
| Limite por arquivo | 10MB |
| Formatos aceitos | DOC, DOCX, JPG, PDF |
| Quantidade por lead | Ilimitada |
| Acesso | RLS: Consultor do lead + Admin |

### 6.7 Integrações

| Sistema | Tipo | Uso | Fase |
|---------|------|-----|------|
| **Supabase Auth** | Nativa | Autenticação, convite (`inviteUserByEmail()`), recuperação de senha (`resetPasswordForEmail()`), gestão de sessão | MVP |
| **Supabase Storage** | Nativa | Armazenamento de documentos contratuais com RLS | MVP |
| **Supabase RLS** | Nativa | Regras de negócio no banco: isolamento, imutabilidade, gates | MVP |
| **Vercel** | Hospedagem | Frontend hosting com rate limiting padrão | MVP |
| **n8n** | Webhook/API | Notificações, alertas de inatividade, integração WhatsApp | V2.0 |

---

## 7. Roadmap

### MVP (Lançamento inicial)

**Objetivo:** Centralizar o processo comercial e eliminar perda de leads por desorganização.

| Módulo | Escopo |
|--------|--------|
| Autenticação | Login, recuperação de senha, definição de senha, direcionamento por perfil, bloqueio de inativos |
| Pipeline Kanban | 4 colunas + status Inativo, cadastro de lead, regras de progressão completas, gate de pagamento, movimentação para Perdido |
| Gestão de Leads | Listagem com campos progressivos, busca, filtros, paginação, exportação CSV (Admin) |
| Detalhe do Lead | Seções progressivas, upload de documentos, histórico imutável, status financeiro, gestão de sócios |
| Dashboards | Dashboard Admin completo (KPIs, gráficos, performance por consultor, filtros temporais). Dashboard Consultor com visão restrita |
| Gestão de Usuários | Cadastro via convite, ativar/desativar, reenviar convite |
| Reatribuição | Admin reatribui leads entre consultores |
| Auditoria | Pipeline logs via trigger, log de exportações, `ultima_movimentacao_at` automático |
| RLS | Todas as políticas implementadas |
| Responsividade | Desktop completo (1280px+) |

**[ASSUMIDO]** O MVP será operado inicialmente com 1 consultor ativo, conforme mencionado na Visão Estratégica. A arquitetura já suporta múltiplos consultores desde o primeiro dia.

### V1.0 (Consolidação)

**Objetivo:** Suporte mobile completo e refinamentos baseados em uso real.

| Módulo | Escopo |
|--------|--------|
| Responsividade mobile | Login, Recuperar/Definir Senha, Detalhe do Lead responsivos. Listagem como cards. Dashboard adaptado. Pipeline como lista agrupada com filtro. Restrição de CSV em mobile |
| Drag-and-drop | Kanban com arraste entre colunas + validação de regras de negócio (desktop) |
| Refinamentos | Ajustes de UX baseados em feedback do time. Otimização de queries para performance |

### V2.0 (Automação e Inteligência)

**Objetivo:** Automações que eliminam tarefas manuais e reduzem tempo de resposta ao lead.

| Módulo | Escopo |
|--------|--------|
| n8n — Notificações | Alerta automático de novo lead cadastrado (canal a definir) |
| n8n — Alertas de inatividade | Notificação quando lead está sem movimentação há X dias (utilizando `ultima_movimentacao_at`) |
| n8n — WhatsApp | Integração para follow-up automatizado com leads |
| [ASSUMIDO] Relatórios avançados | Análise de tempo médio por etapa, forecast de receita, análise de sazonalidade — assumido como provável demanda após estabilização do MVP, baseado no perfil analítico do Admin descrito nos documentos |

---

## 8. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | **Adoção pelo Consultor** — Resistência ao uso do CRM por ser mais trabalhoso que o processo informal atual | Alta | Alto | Pipeline impõe disciplina mínima com poucos campos por etapa. Interface Kanban visual e intuitiva. Treinamento inicial antes do go-live |
| R2 | **Perda de dados por falha do Supabase** | Baixa | Crítico | Backup diário nativo do Supabase + PITR conforme tier contratado. Imutabilidade operacional de `historico_interacoes` e `pipeline_logs` (sem alteração pelo usuário) como camada adicional de rastreabilidade; exclusão desses registros só ocorre com exclusão integral do lead pelo Admin (RF-24) |
| R3 | **Escalação de privilégios** — Consultor tenta acessar dados de outros leads | Média | Alto | RLS implementado no nível do banco (Supabase). Mesmo que o frontend seja comprometido, o banco bloqueia acessos indevidos |
| R4 | **Vazamento de dados pessoais (LGPD)** — Exportação CSV com CPF/RG cai em mãos erradas | Média | Alto | Exportação restrita ao Admin. Cada exportação logada. CSV indisponível em mobile. [⚠️ LACUNA: considerar criptografia ou mascaramento parcial de CPF/RG no CSV em versões futuras] |
| R5 | **Token de convite expirado** — Consultor não clica no link em 24h e perde acesso | Média | Baixo | Admin pode reenviar convite com um clique. Visibilidade na tela de Gestão de Usuários |
| R6 | **Performance degradada com volume crescente** — Dashboards e listagem ficam lentos com muitos leads | Baixa (MVP) | Médio | Paginação padrão de 25 leads. Filtros temporais limitam escopo de queries. `valor_liquido` salvo no banco para evitar cálculos em tempo de query. Índices nas colunas de FK e status |
| R7 | **Indisponibilidade do Supabase** — Downtime do provedor afeta toda a operação | Baixa | Crítico | Supabase oferece SLA de alta disponibilidade em planos pagos. Sem fallback local previsto no MVP — risco aceito |
| R8 | **Complexidade do Lovable para regras de negócio avançadas** — Plataforma visual pode ter limitações para implementar validações complexas | Média | Médio | Regras críticas implementadas via RLS e triggers no Supabase (independentes do frontend). Cursor disponível como IDE de apoio para código customizado |
| R9 | **Falta de consentimento LGPD documentado** — Risco regulatório se lead alegar uso indevido de seus dados | Média | Alto | [⚠️ LACUNA: definir onde e como o consentimento é coletado — fora do CRM (contrato/formulário) ou dentro do sistema em versão futura] |

---

## 9. Fora do Escopo

Os itens abaixo estão **explicitamente excluídos** do escopo deste PRD e do desenvolvimento planejado:

| Item | Motivo |
|------|--------|
| Auto-cadastro de usuários | Cadastro é feito exclusivamente pelo Admin. Não há tela de registro público |
| App nativo mobile (iOS/Android) | O sistema é web responsivo. Não será desenvolvido aplicativo nativo |
| Integração com e-mail marketing | Fora do fluxo comercial descrito. Pode ser avaliado em V2.0+ via n8n |
| Integração com ERP/financeiro | O status financeiro é manual (Pago/Pendente). Sem integração com sistemas de faturamento |
| Integração com WhatsApp (MVP) | Planejado para V2.0 via n8n |
| Automações n8n (MVP) | Todas as automações n8n são V2.0 |
| Relatórios customizáveis | Dashboards com layout fixo conforme especificado. Sem builder de relatórios |
| Multi-idioma | Sistema em português brasileiro (pt-BR) apenas |
| Multi-empresa / multi-tenant | Sistema dedicado à Top Class. Sem suporte a múltiplas empresas |
| Chat interno entre usuários | Sem funcionalidade de comunicação interna |
| Cálculo automático de comissão | Sem engine de comissionamento |
| Backup customizado / dump manual | Dependência do backup nativo do Supabase |
| Exclusão de leads pelo Consultor | Consultores não excluem leads; podem inativar clientes fechados (RF-10). A exclusão permanente é exclusiva do Admin no detalhe (RF-24) |
| Exclusão em massa / purge automatizado | Sem ferramenta de exclusão por lote, filtros ou job agendado; apenas exclusão individual confirmada pelo Admin |
| Importação de leads em massa (CSV/Excel) | Cadastro é individual pelo pipeline. Importação em massa não prevista no MVP |

---

## Apêndice A: Glossário

| Termo | Definição |
|-------|-----------|
| **Lead** | Contato de potencial cliente que demonstrou interesse nos serviços da Top Class |
| **Pipeline** | Funil comercial visual composto por etapas sequenciais (Atendimento → Negociação → Fechado) |
| **Kanban** | Metodologia visual de gestão com colunas representando etapas do processo |
| **Gate** | Condição obrigatória que deve ser cumprida para avançar de uma etapa para a próxima |
| **RLS** | Row Level Security — mecanismo do PostgreSQL/Supabase que restringe acesso a linhas específicas com base na identidade do usuário |
| **Churn** | Cliente que não renovou o serviço e será marcado como "Inativo" no sistema |
| **MoSCoW** | Método de priorização: Must (obrigatório), Should (importante), Could (desejável), Won't (não nesta versão) |
| **FCP** | First Contentful Paint — métrica de performance que mede o tempo até o primeiro conteúdo visual ser renderizado na tela |
| **PITR** | Point-in-Time Recovery — capacidade de restaurar o banco de dados para qualquer momento específico no tempo |

## Apêndice B: Referências Visuais

As seguintes capturas de tela representam a direção visual e de UX aprovada para o CRM:

1. **Dashboard Admin** — Tema escuro, cards KPI com ícones de tendência, gráficos de linha e barras, tabela de performance por consultor
2. **Pipeline Kanban** — 4 colunas com cards contendo nome, empresa, valor, origem e data. Botão "+ Novo Lead" vermelho no topo
3. **Listagem de Leads** — Tabela com colunas progressivas, busca, filtros, ações por linha, botão "Exportar CSV"
4. **Tela de Login** — Layout centralizado, fundo escuro, logo "top class.", campos e-mail/senha, botão vermelho "Entrar"

---

*Documento gerado com base nos documentos fornecidos: Visão Estratégica, Insights de Mercado e Arquitetura Técnica. Itens marcados com [ASSUMIDO] indicam interpretações justificadas. Itens marcados com [⚠️ LACUNA] indicam pontos que requerem decisão do stakeholder.*
