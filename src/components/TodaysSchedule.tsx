import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { MapPin, Clock, ChevronRight, AlertTriangle, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ScheduleEvent {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  client_name: string;
}

interface TodaysScheduleProps {
  events: ScheduleEvent[];
  currentEventId?: string;
}

export function TodaysSchedule({ events, currentEventId }: TodaysScheduleProps) {
  const navigate = useNavigate();
  
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aTime = a.start_time || '99:99';
      const bTime = b.start_time || '99:99';
      return aTime.localeCompare(bTime);
    });
  }, [events]);
  
  // Calculate gaps between events
  const eventsWithGaps = useMemo(() => {
    return sortedEvents.map((event, index) => {
      let gapMinutes: number | null = null;
      let gapType: 'normal' | 'tight' | 'back-to-back' | null = null;
      
      if (index > 0 && sortedEvents[index - 1].end_time && event.start_time) {
        const prevEnd = sortedEvents[index - 1].end_time!;
        const currStart = event.start_time;
        
        // Parse times (HH:MM format)
        const [prevH, prevM] = prevEnd.split(':').map(Number);
        const [currH, currM] = currStart.split(':').map(Number);
        
        const prevMinutes = prevH * 60 + prevM;
        const currMinutes = currH * 60 + currM;
        
        gapMinutes = currMinutes - prevMinutes;
        
        if (gapMinutes <= 0) {
          gapType = 'back-to-back';
        } else if (gapMinutes < 45) {
          gapType = 'tight';
        } else {
          gapType = 'normal';
        }
      }
      
      return {
        ...event,
        gapMinutes,
        gapType,
        eventNumber: index + 1,
        totalEvents: sortedEvents.length,
      };
    });
  }, [sortedEvents]);
  
  if (events.length <= 1) return null;
  
  return (
    <Card className="p-4 bg-muted/30 border-dashed">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Today's Schedule</h3>
        <Badge variant="secondary" className="text-xs">
          {events.length} events
        </Badge>
      </div>
      
      <div className="space-y-2">
        {eventsWithGaps.map((event, index) => {
          const isCurrent = event.id === currentEventId;
          
          return (
            <div key={event.id}>
              {/* Gap indicator */}
              {event.gapType && index > 0 && (
                <div className="flex items-center gap-2 py-1 pl-4">
                  <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    event.gapType === 'tight' && 'bg-amber-500/20 text-amber-600',
                    event.gapType === 'back-to-back' && 'bg-destructive/20 text-destructive',
                    event.gapType === 'normal' && 'text-muted-foreground'
                  )}>
                    {event.gapType === 'back-to-back' 
                      ? 'Back-to-back'
                      : event.gapType === 'tight'
                        ? `⚠️ ${event.gapMinutes}min gap`
                        : `${event.gapMinutes}min gap`
                    }
                  </span>
                  <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                </div>
              )}
              
              {/* Event card */}
              <button
                onClick={() => navigate(`/events/${event.id}/day-of`)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-colors',
                  'hover:bg-muted/50',
                  isCurrent 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-card border-border'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Event number indicator */}
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    isCurrent 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {isCurrent ? <Check className="h-4 w-4" /> : event.eventNumber}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {event.event_name}
                      </span>
                      {isCurrent && (
                        <Badge className="text-xs">Current</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {event.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.start_time.slice(0, 5)}
                          {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                        </span>
                      )}
                      {event.venue_name && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          {event.venue_name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
