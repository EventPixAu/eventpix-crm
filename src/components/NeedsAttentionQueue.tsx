import { AlertTriangle, Calendar, ChevronRight, Users, Package, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, isToday } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNeedsAttentionEvents } from '@/hooks/useGuardrails';
import { cn } from '@/lib/utils';

export function NeedsAttentionQueue() {
  const { data: items, isLoading } = useNeedsAttentionEvents();
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Needs Attention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Needs Attention
          </CardTitle>
          <CardDescription>All upcoming events are ready</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No issues found for today or tomorrow.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const getIssueIcon = (issue: string) => {
    if (issue.toLowerCase().includes('staff')) return Users;
    if (issue.toLowerCase().includes('equipment')) return Package;
    if (issue.toLowerCase().includes('delivery')) return Truck;
    return AlertTriangle;
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Needs Attention
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
            {items.length} issue{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <CardDescription>
          Events requiring action for today and tomorrow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(({ event, issues, priority }) => {
          const eventDate = parseISO(event.event_date);
          const isTodayEvent = isToday(eventDate);
          
          return (
            <div
              key={event.id}
              className={cn(
                'rounded-lg border p-3 space-y-2',
                priority === 'high' && 'border-destructive/50 bg-destructive/5',
                priority === 'medium' && 'border-amber-500/50 bg-amber-500/5',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{event.event_name}</h4>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs',
                        isTodayEvent 
                          ? 'bg-destructive/20 text-destructive border-destructive/50' 
                          : 'bg-amber-500/20 text-amber-700 border-amber-500/50'
                      )}
                    >
                      {isTodayEvent ? 'Today' : 'Tomorrow'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.client_name} • {event.start_at 
                      ? format(parseISO(event.start_at), 'h:mm a') 
                      : 'Time TBD'}
                  </p>
                </div>
                <Button asChild variant="ghost" size="icon" className="shrink-0">
                  <Link to={`/events/${event.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {issues.map((issue, i) => {
                  const Icon = getIssueIcon(issue);
                  return (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-xs gap-1 bg-background"
                    >
                      <Icon className="h-3 w-3" />
                      {issue}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
