
Problema identificado: isso não depende do Supabase para “se corrigir”. Hoje já existe um bug no frontend.

O que está acontecendo:
- Na página `src/pages/LeadDetail.tsx`, a validação para avançar de `negociacao` para `fechado` verifica `documentos.length === 0`.
- Só que `documentos` vem exclusivamente de `mockDocumentos.filter(d => d.lead_id === Number(id))`.
- O componente `FileUpload` exibido na seção de documentos mantém os arquivos apenas em estado interno local e não envia nada para o `LeadDetail`.
- Resultado: mesmo anexando um arquivo visualmente, a regra de avanço continua enxergando “0 documentos”.

Conclusão:
- É um problema atual de integração entre componentes, não algo que o Supabase vai resolver sozinho.
- Quando o Supabase for integrado, ainda assim será preciso ligar o upload ao estado/persistência usados pela validação.

Plano de correção:
1. Conectar `FileUpload` ao `LeadDetail`
   - Passar `onFilesChange` para o componente.
   - Criar estado local no detalhe do lead para armazenar os arquivos anexados na sessão atual.

2. Ajustar a regra de validação
   - Em vez de validar só `mockDocumentos`, considerar:
     - documentos já existentes do lead, e
     - arquivos recém-anexados via `FileUpload`.
   - Exemplo lógico: `documentosExistentes + documentosNovos > 0`.

3. Corrigir a contagem e a exibição da seção “Documentos”
   - O título `Documentos (0)` deve refletir também os anexos recém-selecionados.
   - Se houver descrição obrigatória para cada arquivo, validar isso antes do avanço.

4. Preparar a transição futura para Supabase
   - Manter a mesma interface de estado local agora.
   - Depois, trocar a fonte dos documentos mockados por upload real + storage, sem mudar a regra de negócio.

Arquivos envolvidos:
- `src/pages/LeadDetail.tsx`
- `src/components/FileUpload.tsx`
- possivelmente `src/types/index.ts` se for útil tipar os uploads temporários

Impacto esperado após implementar:
- Se o documento estiver anexado na tela atual, o avanço de etapa passará a funcionar corretamente.
- Isso funcionará já no mock/frontend, antes mesmo da integração com Supabase.
