import React, { useCallback, useState } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UploadedFile {
  file: File
  nome_descricao: string
}

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  label?: string
  onFilesChange?: (files: UploadedFile[]) => void
}

export function FileUpload({ accept = '.doc,.docx,.jpg,.pdf', multiple = true, label = 'Arraste arquivos aqui ou clique para enviar', onFilesChange }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = useCallback((newFiles: FileList) => {
    const valid = Array.from(newFiles).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      return ['doc', 'docx', 'jpg', 'pdf'].includes(ext || '') && f.size <= 10 * 1024 * 1024
    })
    const mapped = valid.map(f => ({ file: f, nome_descricao: '' }))
    const updated = [...files, ...mapped]
    setFiles(updated)
    onFilesChange?.(updated)
  }, [files, onFilesChange])

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx)
    setFiles(updated)
    onFilesChange?.(updated)
  }

  const updateDescription = (idx: number, desc: string) => {
    const updated = files.map((f, i) => i === idx ? { ...f, nome_descricao: desc } : f)
    setFiles(updated)
    onFilesChange?.(updated)
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = accept
          input.multiple = multiple
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement
            if (target.files) handleFiles(target.files)
          }
          input.click()
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">DOC, DOCX, JPG, PDF — máx. 10MB</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-card p-3 border border-border">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate max-w-[150px]">{f.file.name}</span>
              <Input
                placeholder="Nome/descrição do arquivo *"
                value={f.nome_descricao}
                onChange={(e) => updateDescription(i, e.target.value)}
                className="flex-1 h-8 text-sm bg-background border-border"
              />
              <Button variant="ghost" size="icon" onClick={() => removeFile(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
