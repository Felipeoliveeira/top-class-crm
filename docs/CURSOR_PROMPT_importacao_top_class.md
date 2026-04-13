# PROMPT CURSOR — Adaptador de Importação CSV (Planilha Interna Top Class)

---

## CONTEXTO

O CRM Top Class já possui uma funcionalidade de importação CSV funcionando, com uma camada de
normalização de dados implementada em `csv-normalizers.ts`. Essa camada deve ser **mantida
intacta**. Precisamos adicionar um **adaptador específico** para a planilha interna da empresa,
que tem formato próprio e fixo.

---

## OBJETIVO

Criar uma função `mapTopClassSheet` que converte as colunas da planilha interna da Top Class
para o formato de campos do CRM, aplicando as regras de negócio descritas abaixo.

Após o mapeamento, os dados seguem normalmente para a camada de normalização existente em
`csv-normalizers.ts`.

---

## MAPEAMENTO DE COLUNAS

### Tabela de mapeamento

| Coluna da planilha      | Campo(s) do CRM                                      | Regra                                                                                         |
|-------------------------|------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `Nome/Razão Social`     | `nome` ou `razao_social`                             | Se `CNPJ/CPF` tiver 14 dígitos → `razao_social`. Se tiver 11 dígitos → `nome`                 |
| `CNPJ/CPF`              | `cnpj` ou `cpf`                                      | 14 dígitos → `cnpj`. 11 dígitos → `cpf`                                                       |
| `Responsável`           | `nome`                                               | Sempre vai para `nome`. Se CPF, o valor será igual ao `Nome/Razão Social` — usar apenas um    | 
| `Contato`               | `telefone`                                           | Direto                                                                                        |
| `Email`                 | `email`                                              | Direto                                                                                        |
| `Plano`                 | `servico_interesse`                                  | Usar `normalizeServicoInteresse` de `csv-normalizers.ts`                                      |
| `Início`                | `data_inicio_contrato`                               | Normalizar data via `normalizeDate`                                                           |
| `Término`               | `data_fim_contrato`                                  | Normalizar data via `normalizeDate`                                                           |
| `Valor`                 | `valor_bruto`                                        | Normalizar via `normalizeValor`                                                               |
| `Venc.`                 | `vencimento_dia`                                     | Normalizar via `normalizeVencimento`                                                          |
| `NF`                    | `possui_nota_fiscal`                                 | Normalizar via `normalizeNotaFiscal`                                                          |
| `Contador`              | `origem` + `indicacao_responsavel_nome`              | Ver regra específica abaixo                                                                   |
| `Telefone`              | `indicacao_responsavel_telefone`                     | Apenas quando `origem` for `Indicação`                                                        |

---

## REGRA DO CAMPO CONTADOR → ORIGEM

```
Se o valor for "google" ou "site" (case-insensitive, com ou sem acento):
  origem = "Google"
  indicacao_responsavel_nome = vazio

Se o valor for "sem indicação", "sem indicacao", vazio ou nulo:
  origem = "Outros"
  indicacao_responsavel_nome = vazio

Qualquer outro valor de texto (nome de pessoa ou empresa):
  origem = "Indicação"
  indicacao_responsavel_nome = valor da coluna
```

Os valores fixos aceitos no campo `origem` do CRM são: `Indicação`, `Google`, `Redes Sociais`, `Outros`.

---

## REGRA DO STATUS

Esta planilha representa clientes ativos da empresa. O status padrão para todas as linhas
importadas por este adaptador deve ser `fechado`.

---

## DETECÇÃO AUTOMÁTICA DO FORMATO

Na etapa de Upload, o sistema deve detectar automaticamente se o arquivo enviado é a
planilha interna da Top Class verificando se os cabeçalhos contêm:

```
Nome/Razão Social, CNPJ/CPF, Responsável, Contato, Email, Plano, Início, Término, Valor, Venc., NF, Contador, Telefone
```

- Se detectado → aplicar `mapTopClassSheet` antes de seguir para a normalização existente.
- Se não detectado → seguir o fluxo de importação atual normalmente (sem alterações).

---

## ONDE CRIAR

A função `mapTopClassSheet` deve ser criada em arquivo separado:

```
src/lib/top-class-sheet-mapper.ts
```

---

## RESTRIÇÕES — NÃO ALTERAR

- `csv-normalizers.ts` — manter intacto
- Validação server-side existente
- Limite de 1.000 linhas por arquivo
- Registro em `importacoes_log`
- Etapas de Revisão e Resultado existentes

---

## ENTREGÁVEL ESPERADO

1. Arquivo `top-class-sheet-mapper.ts` com a função `mapTopClassSheet`
2. Integração da detecção automática na etapa de Upload do fluxo existente
3. Nenhuma outra parte do sistema deve ser alterada
