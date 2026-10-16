import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';

interface LocationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
}

/**
 * Location picker: lists locations already saved in the system and lets the
 * user type a brand-new one ("Use \"...\"") so the list grows as locations
 * are added.
 */
export function LocationCombobox({
  value,
  onChange,
  options,
  placeholder = 'e.g. Office storeroom',
  emptyLabel = 'No location',
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const trimmed = query.trim();
  const isNew = trimmed !== '' && !options.some(loc => loc.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) setQuery('');
    }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={"w-full justify-between font-normal " + (value ? '' : 'text-muted-foreground')}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search or type a new location..."
          />
          <CommandList>
            {isNew && (
              <CommandGroup>
                <CommandItem value={"use " + trimmed} onSelect={() => select(trimmed)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Use "{trimmed}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Saved locations">
              {value && (
                <CommandItem
                  value="__no_location__"
                  onSelect={() => select('')}
                >
                  <Check className={"mr-2 h-4 w-4 " + (value ? 'opacity-0' : 'opacity-100')} />
                  {emptyLabel}
                </CommandItem>
              )}
              {options.map((loc) => (
                <CommandItem
                  key={loc}
                  value={loc}
                  onSelect={() => select(loc)}
                >
                  <Check className={"mr-2 h-4 w-4 " + (value === loc ? 'opacity-100' : 'opacity-0')} />
                  {loc}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
