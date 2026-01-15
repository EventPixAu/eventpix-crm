import { Lock, Unlock, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useEventLocking } from '@/hooks/useGuardrails';

interface EventLockBannerProps {
  eventStartAt: string | null;
  onRequestUnlock?: () => void;
  showUnlockButton?: boolean;
}

export function EventLockBanner({ 
  eventStartAt, 
  onRequestUnlock,
  showUnlockButton = false 
}: EventLockBannerProps) {
  const { isLocked, minutesUntilStart, lockThreshold } = useEventLocking(eventStartAt);
  
  if (!isLocked) return null;
  
  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <Lock className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 flex items-center gap-2">
        Event Locked
        <span className="flex items-center gap-1 text-xs font-normal bg-amber-500/20 px-2 py-0.5 rounded">
          <Clock className="h-3 w-3" />
          {minutesUntilStart} min until start
        </span>
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm">
          Editing is locked within {lockThreshold} minutes of event start. 
          Venue, times, and staff assignments cannot be changed without override.
        </span>
        {showUnlockButton && onRequestUnlock && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRequestUnlock}
            className="shrink-0 ml-4 border-amber-500/50 text-amber-700 hover:bg-amber-500/20"
          >
            <Unlock className="h-3 w-3 mr-1" />
            Request Unlock
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
