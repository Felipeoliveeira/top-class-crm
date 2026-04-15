import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  fixedLabel?: boolean;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Selecionar período",
  fixedLabel = false,
  className,
  buttonClassName,
  disabled,
}: DateRangePickerProps) {
  const [fromMonth, setFromMonth] = React.useState<Date | undefined>(value?.from);
  const [toMonth, setToMonth] = React.useState<Date | undefined>(value?.to ?? value?.from);

  React.useEffect(() => {
    if (value?.from) {
      setFromMonth(value.from);
    }
    if (value?.to) {
      setToMonth(value.to);
      return;
    }
    if (value?.from) {
      setToMonth(value.from);
    }
  }, [value?.from, value?.to]);

  const label = React.useMemo(() => {
    if (fixedLabel) {
      return placeholder;
    }
    if (value?.from && value?.to) {
      return `${format(value.from, "dd/MM/yyyy")} - ${format(value.to, "dd/MM/yyyy")}`;
    }
    if (value?.from) {
      return format(value.from, "dd/MM/yyyy");
    }
    return placeholder;
  }, [fixedLabel, placeholder, value]);

  const handleChangeFrom = React.useCallback(
    (nextFrom: Date | undefined) => {
      if (!nextFrom) {
        onChange(undefined);
        return;
      }
      const currentTo = value?.to;
      if (currentTo && currentTo >= nextFrom) {
        onChange({ from: nextFrom, to: currentTo });
        return;
      }
      onChange({ from: nextFrom, to: undefined });
    },
    [onChange, value?.to],
  );

  const handleChangeTo = React.useCallback(
    (nextTo: Date | undefined) => {
      const currentFrom = value?.from;
      if (!currentFrom) {
        onChange(nextTo ? { from: nextTo, to: nextTo } : undefined);
        return;
      }
      if (!nextTo) {
        onChange({ from: currentFrom, to: undefined });
        return;
      }
      if (nextTo < currentFrom) {
        onChange({ from: currentFrom, to: undefined });
        return;
      }
      onChange({ from: currentFrom, to: nextTo });
    },
    [onChange, value?.from],
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date-range-picker-trigger"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-9 justify-start rounded-full px-4 py-1.5 text-left text-sm font-medium",
              !value?.from && "text-muted-foreground",
              buttonClassName,
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Início</p>
              <Calendar
                initialFocus
                mode="single"
                month={fromMonth}
                onMonthChange={setFromMonth}
                selected={value?.from}
                onSelect={handleChangeFrom}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Fim</p>
              <Calendar
                mode="single"
                month={toMonth}
                onMonthChange={setToMonth}
                selected={value?.to}
                onSelect={handleChangeTo}
                disabled={(date) => Boolean(value?.from && date < value.from)}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
