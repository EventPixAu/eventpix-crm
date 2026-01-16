/**
 * RepeatClientBadge - Display repeat client indicator
 * 
 * Shows badge when client has more than one completed event.
 */

import { Award, Star, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RepeatClientBadgeProps {
  isRepeatClient: boolean;
  completedEvents?: number;
  className?: string;
  showCount?: boolean;
}

export function RepeatClientBadge({ 
  isRepeatClient, 
  completedEvents = 0,
  className,
  showCount = false,
}: RepeatClientBadgeProps) {
  if (!isRepeatClient) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={cn(
              'bg-amber-500/20 text-amber-700 border-amber-500/50 gap-1',
              className
            )}
          >
            <Repeat className="h-3 w-3" />
            Repeat Client
            {showCount && completedEvents > 1 && (
              <span className="text-xs opacity-75">({completedEvents})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            {completedEvents} completed {completedEvents === 1 ? 'event' : 'events'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
