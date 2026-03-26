

## Ajuste: Colunas do Kanban ocuparem toda a largura disponível

### Problema
As 4 colunas do Pipeline Kanban usam largura fixa (`w-80` = 320px cada). Na viewport atual (~1300px de área útil), sobra espaço à direita da coluna "Perdido". Não há coluna oculta — é apenas espaço não utilizado.

### Solução
Trocar `w-80 shrink-0` por `flex-1 min-w-[280px]` em cada coluna, para que se expandam proporcionalmente e preencham toda a largura. Em telas menores, o `overflow-x-auto` continua garantindo scroll horizontal.

### Arquivo alterado
- **src/pages/Pipeline.tsx** (linha ~355): substituir `className="w-80 shrink-0"` por `className="flex-1 min-w-[280px]"`

