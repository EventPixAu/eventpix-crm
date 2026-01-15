import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  UserX,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useStaffingForecast, type StaffingForecast as StaffingForecastType } from '@/hooks/useEventSeries';
import { cn } from '@/lib/utils';

interface StaffingForecastProps {
  seriesId: string;
  defaultPhotographersRequired?: number;
  className?: string;
}

const statusConfig = {
  fully_staffed: {
    label: 'Fully Staffed',
    icon: UserCheck,
    className: 'text-emerald-600 dark:text-emerald-400',
    bgClassName: 'bg-emerald-500/10',
    badgeVariant: 'default' as const,
  },
  understaffed: {
    label: 'Understaffed',
    icon: UserMinus,
    className: 'text-amber-600 dark:text-amber-400',
    bgClassName: 'bg-amber-500/10',
    badgeVariant: 'secondary' as const,
  },
  overstaffed: {
    label: 'Overstaffed',
    icon: TrendingUp,
    className: 'text-blue-600 dark:text-blue-400',
    bgClassName: 'bg-blue-500/10',
    badgeVariant: 'outline' as const,
  },
  unassigned: {
    label: 'Unassigned',
    icon: UserX,
    className: 'text-destructive',
    bgClassName: 'bg-destructive/10',
    badgeVariant: 'destructive' as const,
  },
};

function ForecastEventRow({ event }: { event: StaffingForecastType['events'][0] }) {
  const config = statusConfig[event.status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg transition-colors",
      config.bgClassName
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        event.status === 'unassigned' && "bg-destructive/20",
        event.status === 'understaffed' && "bg-amber-500/20",
        event.status === 'overstaffed' && "bg-blue-500/20",
        event.status === 'fully_staffed' && "bg-emerald-500/20"
      )}>
        <Icon className={cn("h-4 w-4", config.className)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{event.event_name}</p>
          <Badge variant={config.badgeVariant} className="shrink-0 text-xs">
            {event.assigned}/{event.required}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(parseISO(event.event_date), 'MMM d, yyyy')}</span>
          {(event.city || event.venue_name) && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3" />
                {event.city || event.venue_name}
              </span>
            </>
          )}
        </div>
      </div>
      <Link to={`/events/${event.id}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

export function StaffingForecast({ seriesId, defaultPhotographersRequired = 1, className }: StaffingForecastProps) {
  const { data: forecast, isLoading } = useStaffingForecast(seriesId, defaultPhotographersRequired);

  const staffingPercentage = useMemo(() => {
    if (!forecast || forecast.totalRequired === 0) return 100;
    return Math.round((forecast.totalAssigned / forecast.totalRequired) * 100);
  }, [forecast]);

  const hasIssues = forecast && (forecast.understaffed > 0 || forecast.unassigned > 0);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecast || forecast.upcomingEvents === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Staffing Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events to forecast</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      className,
      hasIssues && "border-amber-300 dark:border-amber-700"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Staffing Forecast
          {hasIssues && (
            <Badge variant="outline" className="ml-auto text-xs text-amber-600 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {forecast.understaffed + forecast.unassigned} need attention
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Overall Coverage</span>
            <span className="font-medium">
              {forecast.totalAssigned} / {forecast.totalRequired} staff
            </span>
          </div>
          <Progress 
            value={Math.min(staffingPercentage, 100)} 
            className={cn(
              "h-2",
              staffingPercentage < 50 && "[&>div]:bg-destructive",
              staffingPercentage >= 50 && staffingPercentage < 100 && "[&>div]:bg-amber-500",
              staffingPercentage >= 100 && "[&>div]:bg-emerald-500"
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {staffingPercentage}% staffed for {forecast.upcomingEvents} upcoming event(s)
          </p>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-lg font-bold">{forecast.fullyStaffed}</p>
              <p className="text-xs text-muted-foreground">Fully Staffed</p>
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg",
            forecast.unassigned > 0 ? "bg-destructive/10" : "bg-muted"
          )}>
            <UserX className={cn(
              "h-4 w-4",
              forecast.unassigned > 0 ? "text-destructive" : "text-muted-foreground"
            )} />
            <div>
              <p className="text-lg font-bold">{forecast.unassigned}</p>
              <p className="text-xs text-muted-foreground">Unassigned</p>
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg",
            forecast.understaffed > 0 ? "bg-amber-500/10" : "bg-muted"
          )}>
            <UserMinus className={cn(
              "h-4 w-4",
              forecast.understaffed > 0 ? "text-amber-600" : "text-muted-foreground"
            )} />
            <div>
              <p className="text-lg font-bold">{forecast.understaffed}</p>
              <p className="text-xs text-muted-foreground">Understaffed</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-lg font-bold">{forecast.overstaffed}</p>
              <p className="text-xs text-muted-foreground">Overstaffed</p>
            </div>
          </div>
        </div>

        {/* Events List */}
        {hasIssues && (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider mb-2 text-muted-foreground">
              Events Needing Attention
            </h4>
            <ScrollArea className="h-[200px] pr-2">
              <div className="space-y-2">
                {forecast.events
                  .filter(e => e.status === 'unassigned' || e.status === 'understaffed')
                  .map(event => (
                    <ForecastEventRow key={event.id} event={event} />
                  ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
