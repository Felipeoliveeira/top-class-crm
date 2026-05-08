# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Top-CLASS CRM** — Web-based lead and sales pipeline management system for Top Class Escritório Virtual (Aracaju, SE). The system handles the complete lead lifecycle from initial contact to closure or loss, with role-based access control (Admin and Consultor).

**Stack:**
- Frontend: React 18 + TypeScript + Vite + Shadcn/ui + Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Storage)
- State management: Zustand + TanStack React Query
- Form validation: React Hook Form + Zod

## Directory Structure

```
src/
├── components/           # Reusable UI components (Shadcn/ui + Radix)
│   └── ui/              # Base Shadcn/ui components
├── pages/               # Page components (routed)
├── hooks/               # Custom React hooks (useAuth, useLeads, usePipeline, etc.)
├── services/            # API/Supabase service functions
├── lib/                 # Utilities: formatters, CSV parsers, validators
├── types/               # TypeScript type definitions (index.ts)
├── integrations/        # External service clients (Supabase)
└── test/                # Test utilities

supabase/                # Database migrations, functions, triggers
.cursor/rules/           # Cursor IDE rules (coding.mdc)
docs/                    # Project documentation (PRD, implementation plan)
```

## Key Data Models

All types are defined in `src/types/index.ts`:

- **Lead**: id, nome, telefone, status, origem, necessidade, servico_interesse, valor_bruto/liquido, email, cpf, rg, cnpj, status_financeiro, data_prevista_pagamento, data_inicio/fim_contrato, possui_nota_fiscal, motivo_perda_tipo, etc.
- **Perfil**: User profile with role (admin | consultor), status (ativo | inativo), last access
- **HistoricoInteracao**: Immutable interaction timeline (lead_id, autor_id, anotacao, created_at)
- **DocumentoLead**: Document metadata (lead_id, arquivo_url, formato, tamanho_bytes)

**Lead Status:** atendimento → negociacao → fechado | perdido | inativo (terminal states)

## Common Commands

```bash
# Development
pnpm dev              # Start Vite dev server (http://localhost:3000)
pnpm build            # Production build
pnpm build:dev        # Development build
pnpm preview          # Preview production build locally

# Linting & Testing
pnpm lint             # Run ESLint
pnpm test             # Run vitest (single run)
pnpm test:watch       # Run vitest in watch mode

# Database/Migrations
# Located in supabase/ — run migrations via Supabase CLI
# Edge Functions in supabase/functions/
```

## Architecture & Patterns

### Data Fetching & State Management

- **TanStack React Query** for server state (leads, users, dashboards)
- **Zustand** for global client state (auth, user profile, UI toggles)
- Query keys defined in hooks: `LEADS_QUERY_KEYS`, `PIPELINE_QUERY_KEYS`, etc.
- Invalidation patterns: When a mutation succeeds, invalidate related queries

Example:
```typescript
// src/hooks/useLeads.ts
export const LEADS_QUERY_KEYS = {
  documentCounts: (leadIds: number[]) => ['leads', 'documentCounts', leadIds.sort((a, b) => a - b)],
}

useReassignLeadConsultor() {
  return useMutation({
    mutationFn: ({ leadId, novoConsultorId }) => reassignLeadConsultor(leadId, novoConsultorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.leads })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
```

### Services Layer

All Supabase queries and business logic are in `src/services/`:
- `leads.ts` — Lead CRUD, export/import CSV, document counts
- `pipeline.ts` — Pipeline state transitions, validation
- `dashboard.ts` — KPI calculations, metrics
- `users.ts` — User management (Admin only)

**Never query Supabase directly from components** — use services + hooks.

### Form & Validation

- **React Hook Form** for form state
- **Zod** for schema validation
- Validation errors tied to form fields
- Example: Lead detail form has sections for Dados Básicos, Negociação, Status Financeiro

### CSV Handling

- `src/lib/csv-normalizers.ts` — Normalize/validate CSV fields (email, CPF, CNPJ, dates, amounts)
- `src/lib/top-class-sheet-mapper.ts` — Map CSV columns to Lead fields
- Import: validate on server-side (Edge Function), return errors by row
- Export: use `buildLeadsExportCsv()` from `src/services/leads.ts`

## Pipeline Rules & Gates

The pipeline has 4 fixed stages. Advancement requires field validation:

1. **Atendimento → Negociação**
   - Required: origem (indicacao | google | placa | rede_social), necessidade
   
2. **Negociação → Fechado**
   - Required: servico_interesse, valor_bruto, email, cpf, rg, status_financeiro = "pago"
   - Also required (Gates): data_prevista_pagamento (1–31), data_inicio_contrato, data_fim_contrato, possui_nota_fiscal (true | false)
   - Optional: porcentagem_desconto (valor_liquido calculated automatically)
   - If pessoa_juridica = true: cnpj and razao_social required

3. **Any → Perdido**
   - Required: motivo_perda_tipo, motivo_perda_descricao (if tipo = "outro")

4. **Fechado → Inativo** (client churn, terminal)

**Validation occurs in frontend AND backend (Postgres trigger `fn_validate_lead_transition`).**

## Routing & Auth

Routes in `src/App.tsx`:
- `/login` — Public login
- `/recuperar-senha` — Public password recovery
- `/definir-senha` — Public set password (first access or recovery)
- `/dashboard` — Authenticated, role-based redirect (Admin or Consultor dashboard)
- `/pipeline` — Kanban view
- `/leads` — Lead list with filters
- `/leads/:id` — Lead detail & edit
- `/admin/usuarios` — User management (Admin only, guarded by `<AdminRoute>`)

Auth flow:
1. Supabase Auth session via `useAuth()` hook
2. User profile (`perfis` table) fetched to determine role
3. Role determines dashboard layout and accessible actions
4. RLS policies on Supabase enforce data isolation

## Important Implementation Details

### Immutable History
- `historico_interacoes` table is append-only (RLS: no UPDATE/DELETE)
- Every status change, annotation, or document upload creates a record
- Deletion of history only occurs when Admin deletes the entire lead

### Payment Pending Flag
- When `status_financeiro = 'pendente'`, card shows "⚠ Pagamento Pendente" flag
- Lead cannot advance to Fechado unless `status_financeiro = 'pago'`

### Document Upload
- Uses Supabase Storage bucket `documentos-leads`
- Path: `{lead_id}/{timestamp}_{filename}`
- Metadata stored in `documentos_lead` table
- Comprovante de residência is mandatory for Fechado

### CSV Import/Export (Admin Only)
- Export includes all fields (including CPF, CNPJ, RG)
- Import validates each row, reports errors by line number
- Max 1,000 rows per file (safety limit)
- Logs stored in `importacoes_log` / `exportacoes_log` tables

### Dashboard Filtering
- Admin Dashboard: Full KPIs + Performance by Consultor table
- Consultor Dashboard: Same KPIs (no R$ values) + same graphs, no performance table
- Both filterable by: Hoje / 7 dias / 30 dias / Total

## Supabase Specifics

### RLS Policies
- All tables have RLS enabled
- Consultors can view/edit all leads (not restricted by consultor_id) — this is intentional per PRD
- Admin has unrestricted access
- `historico_interacoes`: Append-only for all users; Admin can delete when lead is deleted

### Key Tables
- `leads` — Lead data
- `perfis` — User profiles with role
- `documentos_lead` — Document metadata + Storage URLs
- `historico_interacoes` — Immutable interaction log
- `pipeline_logs` — Audit log of status transitions
- `importacoes_log`, `exportacoes_log` — CSV operation logs

### Triggers & Functions
- `fn_validate_lead_transition()` — Validates lead advancement rules (runs on INSERT to `pipeline_logs`)
- Auto-increment `created_at` and `updated_at` on all tables
- `ultima_movimentacao_at` updated on status change or new interaction

## Common Development Tasks

### Adding a New Lead Field
1. Add column to `leads` table (migration in `supabase/migrations/`)
2. Update `Lead` interface in `src/types/index.ts`
3. Add field to form in `src/pages/LeadDetail.tsx`
4. Update validation if needed (Zod schema)
5. Update export/import CSV normalizers if exportable
6. Run `pnpm lint` to check

### Adding a New Dashboard Metric (Admin)
1. Add KPI calculation in `src/services/dashboard.ts`
2. Create `useXXX()` hook in `src/hooks/useDashboard.ts`
3. Add KpiCard in `src/pages/Dashboard.tsx`
4. Update query keys in hook

### Filtering Leads
- Use `LeadsListFiltersSnapshot` interface (search, status, origem, necessidade, consultorId, periodoDe, periodoAte)
- Filters are passed to `src/services/leads.ts` fetch functions
- Reset to page 1 when filters change

## Code Style & Conventions

- **Naming:** camelCase for variables/functions, PascalCase for components/types
- **Imports:** Use `@` alias (configured in `vite.config.ts`) — `import { Button } from "@/components/ui/button"`
- **Types:** Named exports, interfaces preferred for data models
- **Comments:** Only for non-obvious business logic (e.g., why a gate exists)
- **No `any`:** Use `unknown` or explicit types
- **No enums:** Use union types instead (`'admin' | 'consultor'`)

## Cursor Rules

See `.cursor/rules/coding.mdc` for full rules. Key points:
- TypeScript strict mode not enabled but enforced via linting
- Shadcn/ui + Tailwind CSS for all UI
- Mobile-first responsive design
- Never expose secrets in environment variables to the browser
- Use Edge Functions for sensitive operations
- RLS mandatory on all tables

## Documentation References

- **PRD:** `docs/PRD-CRM-TopClass.md` — Full product requirements
- **Implementation Plan:** `docs/PLANO-IMPLEMENTACAO.md` — Technical roadmap
- **Progression Rules:** `docs/REGRAS DE PROGRESSÃO.md` — Detailed field requirements by stage

