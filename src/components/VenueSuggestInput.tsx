/**
 * VENUE SUGGEST INPUT
 * 
 * An input field that shows venue suggestions from the database as you type.
 * Falls back to Google Places API for venues not in the database.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Globe, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useActiveVenues, type Venue } from '@/hooks/useVenues';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface VenueSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  onVenueSelect?: (venue: Venue) => void;
  onGooglePlaceSelect?: (details: { name: string; address: string }) => void;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
}

export function VenueSuggestInput({
  value,
  onChange,
  onVenueSelect,
  onGooglePlaceSelect,
  placeholder = "Start typing to search venues...",
  className,
  showIcon = false,
}: VenueSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [googlePredictions, setGooglePredictions] = useState<GooglePrediction[]>([]);
  const [sessionToken] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  
  const { data: venues = [] } = useActiveVenues();
  
  // Filter local venues based on input
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
      }).slice(0, 4)
    : [];

  // Google Places search (debounced, only when few local results)
  const searchGooglePlaces = useCallback(async (query: string) => {
    if (query.length < 3 || filteredVenues.length >= 3) {
      setGooglePredictions([]);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: { input: query, sessionToken },
      });
      if (!error && data?.predictions) {
        setGooglePredictions(data.predictions.slice(0, 4));
      }
    } catch {
      setGooglePredictions([]);
    }
  }, [filteredVenues.length, sessionToken]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3 && inputFocused) {
      debounceRef.current = setTimeout(() => searchGooglePlaces(value), 400);
    } else {
      setGooglePredictions([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, inputFocused, searchGooglePlaces]);

  const hasResults = filteredVenues.length > 0 || googlePredictions.length > 0;
  
  useEffect(() => {
    setOpen(inputFocused && hasResults);
  }, [inputFocused, hasResults]);
  
  const handleVenueSelect = (venue: Venue) => {
    onChange(venue.name);
    onVenueSelect?.(venue);
    setOpen(false);
    setGooglePredictions([]);
    inputRef.current?.blur();
  };

  const handleGoogleSelect = async (prediction: GooglePrediction) => {
    onChange(prediction.structured_formatting?.main_text || prediction.description);
    setOpen(false);
    setGooglePredictions([]);
    
    // Fetch place details for the full address
    try {
      const { data, error } = await supabase.functions.invoke('google-places-details', {
        body: { placeId: prediction.place_id, sessionToken },
      });
      if (!error && data) {
        onGooglePlaceSelect?.({
          name: data.name || prediction.structured_formatting?.main_text || '',
          address: data.formatted_address || '',
        });
      }
    } catch {
      // Still set the name even if details fail
    }
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
              setTimeout(() => setInputFocused(false), 200);
            }}
            className={cn(!showIcon && "flex-1", "bg-secondary")}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[280px] overflow-y-auto">
          {filteredVenues.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium flex items-center gap-1.5 bg-muted/50">
                <Database className="h-3 w-3" /> Your Venues
              </div>
              {filteredVenues.map((venue) => (
                <button
                  key={venue.id}
                  type="button"
                  onClick={() => handleVenueSelect(venue)}
                  className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
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
            </>
          )}
          {googlePredictions.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium flex items-center gap-1.5 bg-muted/50">
                <Globe className="h-3 w-3" /> Google Places
              </div>
              {googlePredictions.map((prediction) => (
                <button
                  key={prediction.place_id}
                  type="button"
                  onClick={() => handleGoogleSelect(prediction)}
                  className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {prediction.structured_formatting?.main_text || prediction.description}
                      </p>
                      {prediction.structured_formatting?.secondary_text && (
                        <p className="text-xs text-muted-foreground truncate">
                          {prediction.structured_formatting.secondary_text}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
