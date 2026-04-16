import { ListFilter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface LeadsTableColumnFilterProps {
  title: string
  allOptionLabel: string
  value: string
  optionEntries: [string, string][]
  onValueChange: (value: string) => void
}

export function LeadsTableColumnFilter({
  title,
  allOptionLabel,
  value,
  optionEntries,
  onValueChange,
}: LeadsTableColumnFilterProps) {
  const isActive = value !== 'all'

  return (
    <th
      className={cn(
        'text-left py-3 px-4 text-xs font-medium uppercase',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <div className="flex items-center gap-0.5">
        <span className="truncate">{title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={`Filtrar por ${title}`}
            >
              <ListFilter className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[10rem] bg-card border-border">
            <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
              <DropdownMenuRadioItem value="all" className="text-foreground focus:bg-surface-elevated">
                {allOptionLabel}
              </DropdownMenuRadioItem>
              {optionEntries.map(([key, label]) => (
                <DropdownMenuRadioItem
                  key={key}
                  value={key}
                  className="text-foreground focus:bg-surface-elevated"
                >
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </th>
  )
}
