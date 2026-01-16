import { format } from 'date-fns';
import { Calendar, Clock, MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEventSessions } from '@/hooks/useEventSessions';
import { cn } from '@/lib/utils';

interface SessionsDisplayProps {
  eventId: string;
  compact?: boolean;
  className?: string;
}

export function SessionsDisplay({ eventId, compact = false, className }: SessionsDisplayProps) {
  const { data: sessions = [] } = useEventSessions(eventId);

  if (sessions.length === 0) return null;

  const openInMaps = (address: string) => {
    const query = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-sm font-medium text-muted-foreground">Sessions ({sessions.length})</p>
        <div className="flex flex-wrap gap-2">
          {sessions.map((session) => (
            <Badge key={session.id} variant="outline" className="text-xs">
              {format(new Date(session.session_date), 'MMM d')}
              {session.label && ` - ${session.label}`}
              {session.start_time && ` @ ${format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a')}`}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Sessions ({sessions.length})
      </h3>
      <div className="space-y-2">
        {sessions.map((session, index) => (
          <Card key={session.id} className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="text-center shrink-0 w-12 py-1 bg-primary/10 rounded">
                  <p className="text-lg font-bold text-primary">
                    {format(new Date(session.session_date), 'd')}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {format(new Date(session.session_date), 'EEE')}
                  </p>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {session.label && (
                      <span className="font-medium">{session.label}</span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(session.session_date), 'EEEE, MMMM d, yyyy')}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {(session as any).arrival_time && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock className="h-3.5 w-3.5" />
                        Call: {format(new Date(`2000-01-01T${(session as any).arrival_time}`), 'h:mm a')}
                      </span>
                    )}
                    {session.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a')}
                        {session.end_time && (
                          <> – {format(new Date(`2000-01-01T${session.end_time}`), 'h:mm a')}</>
                        )}
                      </span>
                    )}
                    
                    {(session.venue_name || session.venue_address) && (
                      <button
                        type="button"
                        onClick={() => session.venue_address && openInMaps(session.venue_address)}
                        className={cn(
                          "flex items-center gap-1",
                          session.venue_address && "hover:text-primary cursor-pointer"
                        )}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {session.venue_name || session.venue_address}
                        </span>
                        {session.venue_address && (
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
