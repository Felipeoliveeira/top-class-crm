import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Download, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/useAuth'
import {
  buildCsvTemplate,
  buildExcelTemplate,
  parseImportCsv,
  xlsxToCsvText,
  importLeads,
  type ImportRowResult,
  type ImportLeadsResult,
} from '@/services/leads'
import { isTopClassSheet, mapTopClassSheet } from '@/lib/top-class-sheet-mapper'
import { PIPELINE_QUERY_KEYS } from '@/hooks/usePipeline'
import { SERVICO_LABELS } from '@/types'

interface ImportarCsvModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'template' | 'upload' | 'preview' | 'resultado'

const ORIGEM_LABELS: Record<string, string> = {
  indicacao: 'Indicação',
  google: 'Google',
  placa: 'Placa',
  rede_social: 'Rede Social',
  outros: 'Outros',
}

export function ImportarCsvModal({ open, onOpenChange }: ImportarCsvModalProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<Step>('template')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseResults, setParseResults] = useState<ImportRowResult[]>([])
  const [importResult, setImportResult] = useState<ImportLeadsResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const validRows = parseResults.filter(r => r.success)
  const invalidRows = parseResults.filter(r => !r.success)
  const hasErrors = invalidRows.length > 0

  function handleDownloadTemplate() {
    const csv = buildCsvTemplate()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'template_importacao_leads.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleDownloadExcelTemplate() {
    const blob = buildExcelTemplate()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'template_importacao_leads.xlsx'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleParsedCsv(text: string) {
    const csvToProcess = isTopClassSheet(text) ? mapTopClassSheet(text) : text
    const results = parseImportCsv(csvToProcess)
    if (results.length === 0) {
      toast.error('O arquivo não contém dados para importar.')
      return
    }
    setParseResults(results)
    setActiveTab('preview')
  }

  function processFile(file: File) {
    const isXlsx = file.name.endsWith('.xlsx')
    const isCsv = file.name.endsWith('.csv')

    if (!isCsv && !isXlsx) {
      toast.error('Apenas arquivos .csv ou .xlsx são aceitos.')
      return
    }

    setFileName(file.name)

    if (isXlsx) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer
        const csvText = xlsxToCsvText(buffer)
        handleParsedCsv(csvText)
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        handleParsedCsv(text)
      }
      reader.readAsText(file, 'UTF-8')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  async function handleImport() {
    if (!user?.id || validRows.length === 0) return
    setIsImporting(true)
    try {
      const result = await importLeads(parseResults, user.id, user.id)
      setImportResult(result)
      setActiveTab('resultado')
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.leads })
      if (result.totalSucesso > 0) {
        toast.success(`${result.totalSucesso} lead(s) importado(s) com sucesso!`)
      }
    } catch (err) {
      toast.error(`Falha na importação: ${(err as Error).message}`)
    } finally {
      setIsImporting(false)
    }
  }

  function handleReset() {
    setActiveTab('template')
    setFileName(null)
    setParseResults([])
    setImportResult(null)
  }

  function handleClose(open: boolean) {
    if (!open) handleReset()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Importar Leads via CSV / Excel</DialogTitle>
          <DialogDescription>
            Importe leads em massa com o estágio definido diretamente no arquivo.
            Dados como telefone, CPF, datas e status serão normalizados automaticamente.
            Os documentos deverão ser adicionados individualmente em cada lead.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Step)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full shrink-0">
            <TabsTrigger value="template">1. Template</TabsTrigger>
            <TabsTrigger value="upload">2. Upload</TabsTrigger>
            <TabsTrigger value="preview" disabled={parseResults.length === 0}>
              3. Revisão
              {parseResults.length > 0 && (
                <Badge variant={hasErrors ? 'destructive' : 'default'} className="ml-2 text-xs">
                  {hasErrors ? invalidRows.length + ' erros' : validRows.length + ' ok'}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resultado" disabled={!importResult}>4. Resultado</TabsTrigger>
          </TabsList>

          {/* ABA 1: Template */}
          <TabsContent value="template" className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-full gap-6 py-8 px-2">
              <div className="text-center space-y-2">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-semibold">Baixe o template</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Use o template abaixo (CSV ou Excel) para preencher os dados dos leads.
                  Não altere os cabeçalhos das colunas. Dados como telefone, CPF, datas e
                  status serão normalizados automaticamente antes da validação.
                </p>
              </div>

              <div className="bg-surface-elevated rounded-lg p-4 w-full max-w-lg space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Obrigatórios para todos os status</p>
                <div className="flex flex-wrap gap-1">
                  {['status', 'nome', 'origem', 'necessidade'].map(f => (
                    <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-mono">telefone</span> é opcional; se vazio, o lead importa com aviso no Kanban.
                </p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Obrigatórios em negociacao e fechado</p>
                <div className="flex flex-wrap gap-1">
                  {['email', 'servico_interesse', 'valor_bruto', 'vencimento_dia', 'data_inicio_contrato', 'data_fim_contrato'].map(f => (
                    <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>
                  ))}
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Obrigatório apenas em negociacao</p>
                <div className="flex flex-wrap gap-1">
                  {['cpf', 'possui_nota_fiscal'].map(f => (
                    <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>
                  ))}
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Obrigatório apenas em perdido</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs font-mono">motivo_perda</Badge>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Sempre opcionais</p>
                <div className="flex flex-wrap gap-1">
                  {['telefone', 'contato_numero', 'cnpj', 'razao_social', 'indicacao_responsavel_nome', 'indicacao_responsavel_telefone'].map(f => (
                    <Badge key={f} variant="outline" className="text-xs font-mono">{f}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Valores aceitos em <span className="font-mono text-primary">status</span>:{' '}
                  <span className="font-mono">atendimento</span>, <span className="font-mono">negociacao</span>,{' '}
                  <span className="font-mono">fechado</span>, <span className="font-mono">perdido</span>
                </p>
              </div>

              <div className="flex gap-3 flex-wrap justify-center">
                <Button onClick={handleDownloadTemplate} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar template.csv
                </Button>
                <Button onClick={handleDownloadExcelTemplate} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar template.xlsx
                </Button>
                <Button onClick={() => setActiveTab('upload')}>
                  Já tenho o arquivo →
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: Upload */}
          <TabsContent value="upload" className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-full gap-6 py-8 px-2">
              <div
                className={`border-2 border-dashed rounded-xl p-12 w-full max-w-lg text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/60 hover:bg-surface-elevated'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium">
                  {fileName ? (
                    <span className="text-primary">{fileName}</span>
                  ) : (
                    <>Arraste o arquivo aqui ou <span className="text-primary underline">clique para selecionar</span></>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Arquivos .csv ou .xlsx — máximo 200 linhas</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('template')}>
                ← Voltar ao template
              </Button>
            </div>
          </TabsContent>

          {/* ABA 3: Preview / Revisão */}
          <TabsContent value="preview" className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{parseResults.length} linha(s) lidas</span>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {validRows.length} válida(s)
                </Badge>
                {hasErrors && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> {invalidRows.length} erro(s) crítico(s)
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('upload')}>
                ← Trocar arquivo
              </Button>
            </div>

            {hasErrors && (
              <div className="mb-3 p-3 rounded-lg border border-destructive/40 bg-destructive/5 shrink-0">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {invalidRows.length} linha(s) com erro crítico não serão importadas.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dados como telefone, CPF, datas e status já foram normalizados automaticamente.
                      Corrija os erros restantes no arquivo e faça novo upload, ou prossiga importando apenas as linhas válidas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
              <div className="p-2 space-y-1">
                {[...parseResults].sort((a, b) => {
                  if (!a.success && b.success) return -1
                  if (a.success && !b.success) return 1
                  return a.rowIndex - b.rowIndex
                }).map((row) => (
                  <div
                    key={row.rowIndex}
                    className={`rounded-md p-3 text-sm ${
                      row.success ? 'bg-surface-elevated' : 'bg-destructive/5 border border-destructive/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {row.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {row.success && row.data ? row.data.nome : `Linha ${row.rowIndex}`}
                        </span>
                        {row.success && row.data && (
                          <span className="text-muted-foreground text-xs shrink-0">
                            {row.data.telefone}
                            {' · '}
                            <span className="capitalize">{row.data.status}</span>
                            {row.data.servico_interesse && ` · ${SERVICO_LABELS[row.data.servico_interesse] ?? row.data.servico_interesse}`}
                            {row.data.valor_bruto != null && ` · R$ ${row.data.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">Linha {row.rowIndex}</span>
                    </div>
                    {!row.success && (
                      <ul className="mt-2 ml-6 space-y-0.5">
                        {row.errors.map((err, i) => (
                          <li key={i} className="text-xs text-destructive">
                            <span className="font-semibold font-mono">{err.field}</span>: {err.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 shrink-0">
              {validRows.length > 0 && (
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar {validRows.length} lead(s)
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ABA 4: Resultado */}
          <TabsContent value="resultado" className="flex-1 min-h-0 overflow-y-auto">
            {importResult && (
              <div className="flex flex-col items-center justify-center min-h-full gap-6 py-8 px-2">
                <div className="text-center space-y-2">
                  {importResult.totalSucesso > 0 ? (
                    <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="h-14 w-14 text-destructive mx-auto" />
                  )}
                  <h3 className="text-xl font-semibold">Importação concluída</h3>
                </div>

                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-500">{importResult.totalSucesso}</p>
                    <p className="text-sm text-muted-foreground">importados</p>
                  </div>
                  {importResult.totalErros > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-destructive">{importResult.totalErros}</p>
                      <p className="text-sm text-muted-foreground">com erro</p>
                    </div>
                  )}
                </div>

                {importResult.erros.length > 0 && (
                  <div className="w-full max-w-lg">
                    <p className="text-sm font-medium text-destructive mb-2">Erros durante a inserção:</p>
                    <ScrollArea className="max-h-40 border rounded-lg p-2 bg-destructive/5">
                      {importResult.erros.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">
                          Linha {e.rowIndex}: {e.message}
                        </p>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {importResult.totalSucesso > 0 && (
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Os leads foram criados no estágio definido no CSV.
                    Acesse cada lead para completar informações e adicionar documentos.
                  </p>
                )}

                <div className="flex gap-3 flex-wrap justify-center">
                  <Button variant="outline" onClick={handleReset}>
                    Nova importação
                  </Button>
                  <Button onClick={() => handleClose(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
