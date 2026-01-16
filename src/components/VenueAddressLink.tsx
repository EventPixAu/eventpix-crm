import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VenueAddressLinkProps {
  address: string | null | undefined;
  venueName?: string | null;
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'button' | 'inline';
}

export function VenueAddressLink({ 
  address, 
  venueName, 
  className,
  showIcon = true,
  variant = 'default'
}: VenueAddressLinkProps) {
  if (!address && !venueName) return null;

  const openInMaps = () => {
    if (!address) return;
    const query = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={openInMaps}
        disabled={!address}
        className={className}
      >
        <MapPin className="h-4 w-4 mr-2" />
        Open in Maps
        <ExternalLink className="h-3 w-3 ml-2" />
      </Button>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={openInMaps}
        disabled={!address}
        className={cn(
          "inline-flex items-center gap-1 text-sm hover:text-primary transition-colors",
          !address && "cursor-default text-muted-foreground",
          address && "hover:underline cursor-pointer",
          className
        )}
      >
        {showIcon && <MapPin className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{venueName || address}</span>
        {address && <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />}
      </button>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-1", className)}>
      {venueName && <p className="font-medium">{venueName}</p>}
      {address && (
        <button
          type="button"
          onClick={openInMaps}
          className="text-sm text-primary hover:underline flex items-center gap-1 text-left"
        >
          <span>{address}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </button>
      )}
    </div>
  );
}
