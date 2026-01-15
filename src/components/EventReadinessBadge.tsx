import { CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEventReadiness, EventReadiness } from '@/hooks/useGuardrails';
import { cn } from '@/lib/utils';

interface EventReadinessBadgeProps {
  eventId: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

const readinessConfig: Record<EventReadiness, {
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = {
  ready: {
    label: 'Ready',
    icon: CheckCircle,
    className: 'bg-green-500/20 text-green-700 border-green-500/50 hover:bg-green-500/30',
  },
  partially_ready: {
    label: 'Partial',
    icon: AlertCircle,
    className: 'bg-amber-500/20 text-amber-700 border-amber-500/50 hover:bg-amber-500/30',
  },
  not_ready: {
    label: 'Not Ready',
    icon: XCircle,
    className: 'bg-destructive/20 text-destructive border-destructive/50 hover:bg-destructive/30',
  },
};

export function EventReadinessBadge({ eventId, showTooltip = true, size = 'sm' }: EventReadinessBadgeProps) {
  const { data: readiness, isLoading } = useEventReadiness(eventId);
  
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }
  
  if (!readiness) return null;
  
  const config = readinessConfig[readiness.status];
  const Icon = config.icon;
  
  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1 border',
        config.className,
        size === 'sm' && 'text-xs py-0',
      )}
    >
      <Icon className={cn('h-3 w-3', size === 'md' && 'h-4 w-4')} />
      {config.label}
    </Badge>
  );
  
  if (!showTooltip || readiness.issues.length === 0) {
    return badge;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">Issues:</p>
            <ul className="text-xs space-y-0.5">
              {readiness.issues.map((issue, i) => (
                <li key={i} className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
