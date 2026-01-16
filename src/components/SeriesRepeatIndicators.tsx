/**
 * SeriesRepeatIndicators - Display repeat revenue indicators on series detail
 * 
 * Shows:
 * - Total events in series
 * - Years active
 * - Typical event month
 */

import { format } from 'date-fns';
import { Calendar, TrendingUp, Repeat, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeriesRepeatIndicators } from '@/hooks/useClientEventHistory';

interface SeriesRepeatIndicatorsProps {
  seriesId: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function SeriesRepeatIndicators({ seriesId }: SeriesRepeatIndicatorsProps) {
  const { data: indicators, isLoading } = useSeriesRepeatIndicators(seriesId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!indicators || indicators.total_events === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Repeat Revenue Indicators
          </CardTitle>
          {indicators.years_active > 1 && (
            <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500/50 gap-1">
              <Repeat className="h-3 w-3" />
              Annual Repeat
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{indicators.total_events}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <Repeat className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{indicators.years_active}</p>
            <p className="text-xs text-muted-foreground">Years Active</p>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <CalendarDays className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-medium">
              {indicators.typical_month 
                ? MONTH_NAMES[indicators.typical_month - 1]
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Typical Month</p>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-medium">
              {indicators.first_year && indicators.most_recent_year
                ? `${indicators.first_year} - ${indicators.most_recent_year}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Year Range</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
