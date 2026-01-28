/**
 * Searchable company selector with "Create New" option
 * Uses Command/Popover pattern for efficient searching of large datasets
 */
import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, Search, Building2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Company {
  id: string;
  business_name: string;
}

interface SearchableCompanySelectorProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelect: (companyId: string) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableCompanySelector({
  companies,
  selectedCompanyId,
  onSelect,
  onCreateNew,
  isLoading = false,
  placeholder = 'Select a company...',
  disabled = false,
}: SearchableCompanySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  // Filter companies based on search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const query = searchQuery.toLowerCase();
    return companies.filter((c) => 
      c.business_name.toLowerCase().includes(query)
    );
  }, [companies, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : selectedCompany ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0" />
              {selectedCompany.business_name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Search companies..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No companies found.
            </CommandEmpty>
            <CommandGroup>
              {filteredCompanies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.id}
                  onSelect={() => {
                    onSelect(company.id);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedCompanyId === company.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  {company.business_name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCreateNew();
                  setOpen(false);
                  setSearchQuery('');
                }}
                className="cursor-pointer text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Company
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
