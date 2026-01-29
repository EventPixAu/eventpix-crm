/**
 * VENUE SUGGEST INPUT
 * 
 * An input field that shows venue suggestions from the database as you type.
 * Displays venue name and address, allows free-text entry.
 */
import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useActiveVenues, type Venue } from '@/hooks/useVenues';
import { cn } from '@/lib/utils';

interface VenueSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  onVenueSelect?: (venue: Venue) => void;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
}

export function VenueSuggestInput({
  value,
  onChange,
  onVenueSelect,
  placeholder = "Venue name or address",
  className,
  showIcon = false,
}: VenueSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: venues = [] } = useActiveVenues();
  
  // Filter venues based on input
  const filteredVenues = value.trim().length >= 2
    ? venues.filter(venue => {
        const searchTerm = value.toLowerCase();
        const nameMatch = venue.name.toLowerCase().includes(searchTerm);
        const addressMatch = [
          venue.address_line_1,
          venue.suburb,
          venue.state,
        ].filter(Boolean).join(' ').toLowerCase().includes(searchTerm);
        return nameMatch || addressMatch;
      }).slice(0, 6) // Limit to 6 suggestions
    : [];
  
  // Show popover when we have matches and input is focused
  useEffect(() => {
    setOpen(inputFocused && filteredVenues.length > 0);
  }, [inputFocused, filteredVenues.length]);
  
  const handleVenueSelect = (venue: Venue) => {
    // Set the venue name as the value
    onChange(venue.name);
    onVenueSelect?.(venue);
    setOpen(false);
    inputRef.current?.blur();
  };
  
  const formatAddress = (venue: Venue) => {
    const parts = [
      venue.address_line_1,
      venue.suburb,
      venue.state,
      venue.postcode,
    ].filter(Boolean);
    return parts.join(', ');
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", showIcon && "flex items-center gap-2", className)}>
          {showIcon && <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setInputFocused(false), 200);
            }}
            className={cn(!showIcon && "flex-1")}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[200px] overflow-y-auto">
          {filteredVenues.map((venue) => (
            <button
              key={venue.id}
              type="button"
              onClick={() => handleVenueSelect(venue)}
              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{venue.name}</p>
                  {formatAddress(venue) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {formatAddress(venue)}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
