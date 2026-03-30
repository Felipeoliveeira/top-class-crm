# Convite de usuário em produção (sem localhost)

Este guia implementa o checklist para o e-mail de convite apontar para o domínio real e redirecionar corretamente para `/definir-senha`. O texto `localhost:3000` no corpo do e-mail vem do **Site URL** do Supabase Auth, não do código do Vite (dev usa porta **8080** — ver `vite.config.ts`).

A Edge Function `invite-user` monta `redirectTo` como `${FRONTEND_URL}/definir-senha`. É obrigatório alinhar **Site URL**, **Redirect URLs** e o secret **`FRONTEND_URL`**.

---

## 1. Site URL (HTTPS de produção)

**Onde:** Supabase Dashboard → **Project Settings** → **Authentication** → **URL Configuration** → **Site URL**

- Defina para a URL pública do CRM, por exemplo: `https://crm.suaempresa.com`  
- **Sem** barra final.  
- Use **HTTPS** em produção.  
- Remova o uso de `http://localhost:3000` como Site URL quando o sistema estiver em produção (esse valor costuma aparecer no **texto** do e-mail padrão como `{{ .SiteURL }}`).

---

## 2. Redirect URLs (allowlist)

**Onde:** mesma página **URL Configuration** → **Redirect URLs**

Inclua pelo menos (substitua pelo seu domínio):

| Ambiente | URL a adicionar |
|----------|------------------|
| Produção | `https://crm.suaempresa.com/definir-senha` |
| Produção | `https://crm.suaempresa.com/**` (se o projeto aceitar wildcard) |
| Produção | `https://crm.suaempresa.com/login` e `https://crm.suaempresa.com/recuperar-senha` se necessário para outros fluxos Auth |
| Dev local | `http://localhost:8080/definir-senha` (porta do Vite neste repositório) |
| Dev local | `http://localhost:8080/**` ou rotas equivalentes |

Se `redirect_to` do convite **não** estiver na lista, o Auth pode redirecionar para o **Site URL** (ex.: raiz em localhost), e o usuário **não** chega em `/definir-senha`.

---

## 3. Secret `FRONTEND_URL` e redeploy da Edge Function

**Onde:** **Project Settings** → **Edge Functions** → **Secrets** (ou CLI abaixo).

- Nome: `FRONTEND_URL`  
- Valor: a mesma base do SPA em produção, **sem** barra final, por exemplo: `https://crm.suaempresa.com`

**CLI (com projeto linkado):**

```bash
supabase secrets set FRONTEND_URL=https://crm.suaempresa.com
supabase functions deploy invite-user
```

Após alterar o secret, faça **redeploy** de `invite-user` para garantir que execuções novas leiam o valor.

---

## 4. Reenviar convite e validar fluxo

1. No CRM (admin), após os passos 1–3, use **Reenviar convite** para o usuário de teste (convites antigos embutem o `redirect_to` da configuração anterior).
2. No e-mail recebido, inspecione o link **Accept the invite** (botão direito → copiar URL).  
   - Deve conter `redirect_to` (ou equivalente) apontando para `https://<seu-dominio>/definir-senha` (URL-encoded).
3. Abra o link: deve carregar a rota `/definir-senha` (`SetPassword.tsx`) e processar o hash com `type=invite`.
4. Defina a senha e confirme redirecionamento para `/login` com mensagem de sucesso.

---

## 5. (Opcional) Template de e-mail “Invite user”

**Onde:** **Authentication** → **Email Templates** → **Invite user**

O texto padrão pode exibir apenas `{{ .SiteURL }}`, o que confunde se o Site URL ainda for localhost. Após corrigir o **Site URL** para produção, o texto melhora automaticamente.

Se quiser deixar o corpo mais claro, use o link de confirmação fornecido pelo template (variáveis disponíveis no editor do Dashboard do seu projeto; em geral há URL de confirmação completa — não substitua por links manuais que quebrem o token).

---

## Troubleshooting: toast “Edge Function returned a non-2xx status code”

Esse texto é o erro **genérico** do cliente Supabase quando a função devolve 4xx/5xx. A causa real vem no **JSON** da resposta (ex.: `FRONTEND_URL não configurada…`).

- **Configurar só “URL Configuration” no Auth não basta** para a Edge Function. O `redirectTo` do convite usa o secret **`FRONTEND_URL`** (Project Settings → Edge Functions → Secrets), independente do Site URL.
- Defina `FRONTEND_URL` com a mesma base do SPA (ex.: `https://seu-dominio.com` ou `http://localhost:8080` em dev) e rode **`supabase functions deploy invite-user`** (ou redeploy pelo Dashboard).
- Depois de corrigir, tente enviar o convite de novo; o toast deve mostrar a mensagem detalhada retornada pela função (o app passa a ler o campo `error` do corpo).

---

## Referência rápida

| Item | Valor típico (produção) |
|------|-------------------------|
| Site URL | `https://<domínio>` |
| Redirect URL obrigatória | `https://<domínio>/definir-senha` |
| Secret `FRONTEND_URL` | `https://<domínio>` (igual à origem do SPA) |
| Porta dev local (este repo) | `8080` |

Código relevante: `supabase/functions/invite-user/index.ts` (`redirectTo = ${FRONTEND_URL}/definir-senha`).
