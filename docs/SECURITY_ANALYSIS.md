# Análise de Segurança e Organização — Top-CLASS CRM

**Data:** 2026-05-08  
**Status:** Análise Completa  
**Prioridade de Correção:** Crítica → Alta → Média → Baixa

---

## 🚨 FALHAS CRÍTICAS DE SEGURANÇA

### 1. **Chaves Supabase Hardcoded no Código**
**Severidade:** 🔴 CRÍTICO  
**Localização:** `src/integrations/supabase/client.ts`

```typescript
// ❌ PROBLEMA: Credenciais em plain text no código fonte
const SUPABASE_URL = "https://acskrawxepcvkgbegrpe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**Impacto:**
- As credenciais estão expostas no git history
- Qualquer pessoa com acesso ao repositório tem acesso ao Supabase
- Se commitado, será visível no GitHub (mesmo em repos privados, pode estar em backups)

**Solução:**
```typescript
// ✅ CORRETO: Usar variáveis de ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
```

**Ações Necessárias:**
1. ✅ Recuperar as credenciais Supabase **imediatamente** (considerar como comprometidas)
2. Executar `git filter-branch` ou `git-filter-repo` para remover histórico
3. Regenerar chaves de API no Supabase
4. Fazer push com `--force` (cuidado em branches compartilhadas)

---

### 2. **.env.example com Credenciais Reais**
**Severidade:** 🔴 CRÍTICO  
**Localização:** `.env.example`

```bash
VITE_SUPABASE_URL=https://acskrawxepcvkgbegrpe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Problema:** Exemplo contém credenciais reais em vez de placeholders.

**Solução:**
```bash
# ✅ CORRETO: Use placeholders
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...SUBSTITUA_PELA_SUA_CHAVE
```

---

### 3. **.gitignore Incompleto**
**Severidade:** 🔴 CRÍTICO  
**Localização:** `.gitignore`

```
# ❌ PROBLEMA: Há apenas uma entrada .env
.env
.env.local
.env.example  # <-- PROBLEMA: Não deveria estar aqui se tiver credenciais
```

**Solução:**
```bash
# ✅ CORRETO
.env
.env.local
.env.*.local
.env.production.local
config.toml
dist
dist-ssr
*.local

# Editor & OS
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store

# Dependencies
node_modules

# Build artifacts
dist
dist-ssr

# IDE & Debug
*.sw?
*.suo
*.ntvs*
*.njsproj
*.sln
*.log
```

---

## ⚠️ FALHAS ALTAS DE SEGURANÇA

### 4. **AdminRoute sem Validação Server-Side**
**Severidade:** 🟠 ALTA  
**Localização:** `src/components/AdminRoute.tsx`

```typescript
// ❌ PROBLEMA: Apenas verificação de frontend
export function AdminRoute() {
  const { isAdmin } = useAuth()  // Pode ser manipulada
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
```

**Problema:** O frontend não é fonte confiável de autorização.

**Recomendação:**
- ✅ Use RLS (Row Level Security) no Supabase para enforce
- ✅ AdminRoute está bem para redirecionamento UX, mas NUNCA confie nele para segurança
- ✅ Backend DEVE validar `role = 'admin'` em todas as operações sensíveis (users, import/export, delete)

**Verificação:**
```typescript
// src/services/users.ts - Valida no servidor
async function inviteUser(email: string, nome: string, role: Role) {
  // Edge Function valida que o chamador é admin
  // Supabase Auth e RLS previnem acesso não-autorizado
  const { error } = await supabase.functions.invoke('invite-user', {
    body: { email, nome, role }
  })
}
```

---

### 5. **Console.error Pode Expor Informações**
**Severidade:** 🟠 ALTA  
**Localização:** 
- `src/hooks/usePipeline.ts:95`
- `src/pages/NotFound.tsx:5`

```typescript
// ❌ POTENCIAL PROBLEMA: Expõe detalhes em produção
console.error('Erro ao carregar mais leads da coluna', { status, error })
console.error("404 Error: User attempted to access non-existent route:", location.pathname)
```

**Impacto:**
- Logs de erro visíveis no DevTools do navegador em produção
- Pode expor estrutura de rotas ou dados sensíveis

**Solução:**
```typescript
// ✅ CORRETO: Use logger estruturado para produção
import { logError } from '@/lib/logger'

logError('Erro ao carregar leads', { status }, { context: 'pipeline' })

// Em produção, registra em servidor, não no console
// Em dev, mostra detalhes para debug
```

Ou use uma variável de ambiente:
```typescript
if (import.meta.env.DEV) {
  console.error('Erro ao carregar mais leads da coluna', { status, error })
}
```

---

## 🟡 FALHAS MÉDIAS — ORGANIZAÇÃO

### 6. **Arquivos Muito Grandes**
**Severidade:** 🟡 MÉDIA  
**Localização:**

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `src/pages/LeadDetail.tsx` | 1075 | Difícil manutenção |
| `src/pages/Pipeline.tsx` | 611 | Múltiplas responsabilidades |
| `src/components/leads/ImportarCsvModal.tsx` | 465 | Lógica misturada |
| `src/services/leads.ts` | 680 | Serviço monolítico |

**Impacto:**
- Difícil de testar
- Alto risco de bugs ao fazer mudanças
- Reduz legibilidade e manutenibilidade

**Solução Recomendada:**

#### LeadDetail.tsx (1075 linhas) → Refatorar em seções:
```
src/pages/
├── LeadDetail.tsx (container, ~150 linhas)
└── LeadDetail/
    ├── LeadDetailBasicInfo.tsx (~150 linhas)
    ├── LeadDetailQualification.tsx (~150 linhas)
    ├── LeadDetailNegotiation.tsx (~200 linhas)
    ├── LeadDetailFinancial.tsx (~150 linhas)
    ├── LeadDetailDocuments.tsx (~100 linhas)
    ├── LeadDetailHistory.tsx (~100 linhas)
    └── LeadDetailActions.tsx (~75 linhas)
```

#### Pipeline.tsx (611 linhas) → Refatorar:
```
src/components/Pipeline/
├── PipelineContainer.tsx (~150 linhas)
├── PipelineColumn.tsx (~150 linhas)
├── PipelineCard.tsx (~100 linhas)
├── PipelineCardFooter.tsx (~75 linhas)
└── hooks/
    └── usePipelineState.ts
```

#### ImportarCsvModal.tsx (465 linhas) → Refatorar:
```
src/components/leads/ImportarCsvModal/
├── ImportarCsvModal.tsx (~100 linhas)
├── CsvUploadStep.tsx (~80 linhas)
├── CsvPreviewStep.tsx (~120 linhas)
├── CsvMappingStep.tsx (~100 linhas)
└── CsvResultsStep.tsx (~65 linhas)
```

---

### 7. **Estrutura de Features Não Implementada**
**Severidade:** 🟡 MÉDIA  
**Localização:** `src/`

A documentação (.cursor/rules/) menciona:
```
src/features/auth/
src/features/leads/
src/features/pipeline/
src/features/dashboard/
src/features/contratos/
src/features/consultores/
src/features/historico/
```

Mas a estrutura atual é:
```
src/
├── pages/           # Aqui está tudo
├── components/      # Genéricos
├── hooks/           # Globais
└── services/        # Globais
```

**Impacto:**
- Falta coesão de features
- Difícil encontrar código relacionado
- Sem barreira clara entre features

**Solução Recomendada:**
```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── types.ts
│   ├── leads/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types.ts
│   ├── pipeline/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types.ts
│   └── dashboard/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       └── types.ts
├── shared/
│   ├── components/      # Globais (ui, Header, Sidebar)
│   ├── hooks/          # Globais (useAuth, usePermissions)
│   ├── services/       # Globais (se houver)
│   └── types/          # Types globais
├── integrations/        # Supabase, APIs externas
├── lib/                # Utilitários puros
└── App.tsx
```

---

### 8. **Falta de Validação de Input em CSV**
**Severidade:** 🟡 MÉDIA  
**Localização:** `src/services/leads.ts`, `src/lib/csv-normalizers.ts`

```typescript
// ❌ CONCERN: Validação no cliente apenas
// CSV é parseado e validado no cliente antes de enviar ao servidor
// Mas não há validação server-side em Edge Function
```

**Impacto:**
- Se alguém burlar o cliente (modificar requisição), dados inválidos entram
- Sem auditoria de quem importou o quê

**Solução:**
```typescript
// ✅ RECOMENDAÇÃO: Validar SEMPRE no servidor
// Edge Function `supabase/functions/import-csv/index.ts`
export default async function handler(req: Request) {
  const { data: { user } } = await supabase.auth.getUser()
  
  // 1. Verificar se é admin (RLS + explicit check)
  const isAdmin = await checkIsAdmin(user.id)
  if (!isAdmin) return new Response('Unauthorized', { status: 403 })
  
  // 2. Parse CSV com validação server-side
  const csv = await req.text()
  const parsed = parseAndValidateCSV(csv) // Reuse schema
  
  // 3. Sanitizar e inserir no banco
  const results = await insertLeadsFromCSV(parsed, user.id)
  
  // 4. Log na tabela importacoes_log
  await logImportacao(user.id, results)
  
  return Response.json(results)
}
```

---

## 🟢 FALHAS BAIXAS — BEST PRACTICES

### 9. **Sem CSRF Protection Explícita**
**Severidade:** 🟢 BAIXA (Supabase mitiga parcialmente)

Supabase Auth já fornece proteção via SameSite cookies, mas:
- Sem verificação de token customizada
- Sem CSRF headers em requisições POST

**Recomendação:**
- ✅ Manter como está (Supabase cuida)
- ✅ Opcional: Adicionar middleware de verificação de CSRF token para operações críticas

---

### 10. **Sem Rate Limiting Implementado**
**Severidade:** 🟢 BAIXA

**Impacto:**
- Login brute-force teoricamente possível (Supabase oferece proteção, mas limitada)
- CSV import sem limite de frequência
- Export sem limite

**Recomendação:**
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit' // ou alternativa

export const loginRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 min'), // 5 tentativas a cada 15 min
})

export const importCsvRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, '1 day'), // 10 imports por dia
})
```

---

### 11. **Falta de Content Security Policy (CSP)**
**Severidade:** 🟢 BAIXA

**Recomendação:**
Adicionar headers no `vercel.json` (ou servidor):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

---

## 📋 MELHORIAS DE ORGANIZAÇÃO

### 12. **Estrutura de Testes Ausente**
**Status:** 📁 Diretório existe mas vazio

```bash
# ✅ RECOMENDAÇÃO: Adicionar testes
src/
├── features/
│   ├── leads/
│   │   ├── services/
│   │   │   ├── leads.ts
│   │   │   └── leads.test.ts      # Tests aqui
│   │   ├── hooks/
│   │   │   ├── useLeads.ts
│   │   │   └── useLeads.test.ts   # Tests aqui
│   │   └── __tests__/             # Ou organizar aqui
│   │       ├── integration.test.ts
│   │       └── unit.test.ts
```

---

### 13. **Falta de Configuração de Logging**
**Recomendação:**
```typescript
// src/lib/logger.ts
export const logger = {
  info: (msg: string, context?: Record<string, any>) => {
    if (import.meta.env.DEV) console.log(`[INFO] ${msg}`, context)
    else sendToLoggingService(msg, context, 'INFO')
  },
  
  warn: (msg: string, context?: Record<string, any>) => {
    console.warn(`[WARN] ${msg}`, context)
    sendToLoggingService(msg, context, 'WARN')
  },
  
  error: (msg: string, error?: any, context?: Record<string, any>) => {
    console.error(`[ERROR] ${msg}`, error, context)
    sendToLoggingService(msg, { error, ...context }, 'ERROR')
  }
}
```

---

## ✅ O QUE ESTÁ BEM

### Pontos Positivos:
1. ✅ **sessionStorage** em vez de localStorage (expires ao fechar aba)
2. ✅ **RLS habilitado** em Supabase (mencionado na documentação)
3. ✅ **Validação com Zod** em formulários
4. ✅ **usePermissions hook** centralizado
5. ✅ **Auth flow** bem estruturado (login, recuperação, definição de senha)
6. ✅ **CSV normalizers** com boa validação
7. ✅ **Estrutura de serviços** separada de components

---

## 🎯 Roadmap de Correções

### Fase 1 (URGENTE — próximos dias):
- [ ] Recuperar credenciais Supabase
- [ ] Remover chaves do git history
- [ ] Regenerar credenciais
- [ ] Usar variáveis de ambiente
- [ ] Atualizar .env.example com placeholders

### Fase 2 (ALTA — próxima sprint):
- [ ] Adicionar logger estruturado
- [ ] Validação server-side para CSV
- [ ] Refatorar LeadDetail.tsx em seções
- [ ] Implementar estrutura de features

### Fase 3 (MÉDIA — roadmap):
- [ ] Adicionar CSP headers
- [ ] Implementar rate limiting
- [ ] Suite de testes (unit + integration)
- [ ] Refatorar Pipeline.tsx

### Fase 4 (BAIXA — nice to have):
- [ ] Analytics/Monitoring
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring

---

## Referências

- [OWASP Top 10 2023](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/self-hosting/security/ssl)
- [React Security Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/React_Security_Cheatsheet.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Análise concluída por:** Claude Code  
**Próxima revisão recomendada:** Após 2 semanas ou ao completar Fase 1
