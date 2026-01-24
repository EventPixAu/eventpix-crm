/**
 * CLIENT EVENTS PANEL
 * 
 * Displays current and previous events for a company
 * with links to Operations > Events
 */
import { Link } from 'react-router-dom';
import { format, parseISO, isPast, isToday, isFuture } from 'date-fns';
import { Calendar, ArrowRight, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientEvents } from '@/hooks/useSales';

interface ClientEventsPanelProps {
  clientId: string;
}

export function ClientEventsPanel({ clientId }: ClientEventsPanelProps) {
  const { data: events = [], isLoading } = useClientEvents(clientId);
  
  // Separate into current/upcoming and previous events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const currentEvents = events.filter(e => {
    const eventDate = parseISO(e.event_date);
    return isFuture(eventDate) || isToday(eventDate) || 
      (e.ops_status && !['completed', 'delivered', 'cancelled'].includes(e.ops_status));
  });
  
  const previousEvents = events.filter(e => {
    const eventDate = parseISO(e.event_date);
    return isPast(eventDate) && !isToday(eventDate) && 
      (!e.ops_status || ['completed', 'delivered', 'cancelled'].includes(e.ops_status));
  });

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-600">Confirmed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'delivered':
        return <Badge variant="default" className="bg-purple-600">Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Current Events</CardTitle>
            <Badge variant="secondary" className="ml-auto">{currentEvents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {currentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No current or upcoming events
            </p>
          ) : (
            <div className="space-y-3">
              {currentEvents.slice(0, 5).map((event) => (
                <Link 
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{event.event_name}</div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(parseISO(event.event_date), 'MMM d, yyyy')}
                        </span>
                        {event.venue_name && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {event.venue_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(event.ops_status)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
              {currentEvents.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to={`/events?client_id=${clientId}`}>
                    View all {currentEvents.length} events
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previous Events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Previous Events</CardTitle>
            <Badge variant="outline" className="ml-auto">{previousEvents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {previousEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No previous events
            </p>
          ) : (
            <div className="space-y-3">
              {previousEvents.slice(0, 5).map((event) => (
                <Link 
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{event.event_name}</div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(parseISO(event.event_date), 'MMM d, yyyy')}
                        </span>
                        {(event as any).event_type?.name && (
                          <Badge variant="outline" className="text-xs">
                            {(event as any).event_type.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(event.ops_status)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
              {previousEvents.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to={`/events?client_id=${clientId}&status=completed`}>
                    View all {previousEvents.length} previous events
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
