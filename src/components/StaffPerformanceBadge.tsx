import { useStaffPerformanceSummary } from '@/hooks/useStaffFeedback';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffPerformanceBadgeProps {
  userId: string;
  compact?: boolean;
}

export function StaffPerformanceBadge({ userId, compact = false }: StaffPerformanceBadgeProps) {
  const { data: performance, isLoading } = useStaffPerformanceSummary(userId);

  if (isLoading || !performance) {
    return null;
  }

  const { averageRating, totalEvents, recentTrend, performanceLabel } = performance;

  const getBadgeVariant = () => {
    if (performanceLabel === 'Recent quality issues') return 'destructive';
    if (performanceLabel === 'Consistently strong performance') return 'default';
    return 'secondary';
  };

  const getIcon = () => {
    if (performanceLabel === 'Recent quality issues') return AlertTriangle;
    if (performanceLabel === 'Consistently strong performance') return Sparkles;
    return Clock;
  };

  const getTrendIcon = () => {
    if (recentTrend === 'up') return TrendingUp;
    if (recentTrend === 'down') return TrendingDown;
    return Minus;
  };

  const Icon = getIcon();
  const TrendIcon = getTrendIcon();

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={getBadgeVariant()} className="h-5 px-1.5 gap-0.5">
              <Icon className="h-3 w-3" />
              {totalEvents >= 5 && (
                <>
                  <Star className="h-3 w-3 fill-current" />
                  <span className="text-xs">{averageRating}</span>
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{performanceLabel}</p>
              {totalEvents > 0 && (
                <p className="text-xs text-muted-foreground">
                  {averageRating}/5 avg across {totalEvents} events
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getBadgeVariant()} className="gap-1">
        <Icon className="h-3 w-3" />
        {performanceLabel}
      </Badge>
      {totalEvents >= 5 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span>{averageRating}</span>
          <TrendIcon
            className={cn(
              'h-3 w-3 ml-1',
              recentTrend === 'up' && 'text-green-500',
              recentTrend === 'down' && 'text-destructive'
            )}
          />
        </div>
      )}
    </div>
  );
}
