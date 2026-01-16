/**
 * ClientEventHistoryCard - Display event history indicators on client detail
 * 
 * Shows:
 * - Total events
 * - First and most recent event dates
 * - Series count
 * - Repeat client badge
 */

import { format, parseISO } from 'date-fns';
import { Calendar, TrendingUp, Layers, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientEventHistory } from '@/hooks/useClientEventHistory';
import { RepeatClientBadge } from '@/components/RepeatClientBadge';

interface ClientEventHistoryCardProps {
  clientId: string;
}

export function ClientEventHistoryCard({ clientId }: ClientEventHistoryCardProps) {
  const { data: history, isLoading } = useClientEventHistory(clientId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Event History
          </CardTitle>
          <RepeatClientBadge 
            isRepeatClient={history.is_repeat_client} 
            completedEvents={history.completed_events}
            showCount
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{history.total_events}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <Award className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{history.completed_events}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-medium">
              {history.first_event_date 
                ? format(parseISO(history.first_event_date), 'MMM yyyy')
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">First Event</p>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-medium">
              {history.most_recent_event_date 
                ? format(parseISO(history.most_recent_event_date), 'MMM yyyy')
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Most Recent</p>
          </div>
        </div>

        {history.series_count > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              Part of {history.series_count} event {history.series_count === 1 ? 'series' : 'series'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
