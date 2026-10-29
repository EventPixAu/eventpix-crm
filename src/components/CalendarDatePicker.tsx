import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CalendarDatePickerProps {
  /** Local yyyy-MM-dd string or null/empty */
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Months shown side by side when open (default 2, covering ~9 weeks) */
  numberOfMonths?: number;
}

/**
 * Popover date picker showing multiple months side by side,
 * storing values as local yyyy-MM-dd strings.
 */
export function CalendarDatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  ariaLabel,
  disabled,
  className,
  numberOfMonths = 2,
}: CalendarDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parseISO(String(value).slice(0, 10));
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">
            {selected ? format(selected, "d MMM yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => {
            onChange(day ? format(day, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          numberOfMonths={numberOfMonths}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onChange(format(new Date(), "yyyy-MM-dd"));
              setOpen(false);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
