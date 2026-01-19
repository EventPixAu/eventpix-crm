import { useMemo } from 'react';
import { format } from 'date-fns';
import { User, UserCheck, UserMinus, UserX, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStaffDirectory } from '@/hooks/useStaff';
import { useStaffAvailabilityByDate, type AvailabilityStatus } from '@/hooks/useStaffAvailability';
import { cn } from '@/lib/utils';

interface StaffAvailabilityOverlayProps {
  date: Date;
  className?: string;
}

interface StaffWithAvailability {
  id: string;
  name: string;
  status: AvailabilityStatus;
  notes: string | null;
}

const statusConfig: Record<AvailabilityStatus, { 
  label: string; 
  icon: typeof UserCheck; 
  className: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  available: {
    label: 'Available',
    icon: UserCheck,
    className: 'text-emerald-600 dark:text-emerald-400',
    badgeVariant: 'default',
  },
  limited: {
    label: 'Limited',
    icon: UserMinus,
    className: 'text-amber-600 dark:text-amber-400',
    badgeVariant: 'secondary',
  },
  unavailable: {
    label: 'Unavailable',
    icon: UserX,
    className: 'text-destructive',
    badgeVariant: 'destructive',
  },
};

function StaffAvailabilityItem({ staff }: { staff: StaffWithAvailability }) {
  const config = statusConfig[staff.status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg transition-colors",
      staff.status === 'unavailable' && "bg-destructive/10",
      staff.status === 'limited' && "bg-amber-500/10",
      staff.status === 'available' && "bg-emerald-500/10"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        staff.status === 'unavailable' && "bg-destructive/20",
        staff.status === 'limited' && "bg-amber-500/20",
        staff.status === 'available' && "bg-emerald-500/20"
      )}>
        <Icon className={cn("h-4 w-4", config.className)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{staff.name}</p>
        {staff.notes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground truncate cursor-help">
                {staff.notes}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {staff.notes}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Badge variant={config.badgeVariant} className="shrink-0 text-xs">
        {config.label}
      </Badge>
    </div>
  );
}

export function StaffAvailabilityOverlay({ date, className }: StaffAvailabilityOverlayProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: profiles = [] } = useStaffDirectory();
  const { data: availabilityData = [], isLoading } = useStaffAvailabilityByDate(dateStr);

  // Merge profiles with availability data
  const staffWithAvailability = useMemo(() => {
    const availabilityMap = new Map(
      availabilityData.map(a => [a.user_id, a])
    );

    return profiles.map(profile => {
      const availability = availabilityMap.get(profile.id);
      return {
        id: profile.id,
        name: profile.full_name || 'Unnamed Staff',
        status: (availability?.availability_status || 'available') as AvailabilityStatus,
        notes: availability?.notes || null,
      };
    });
  }, [profiles, availabilityData]);

  // Group by status
  const { available, limited, unavailable } = useMemo(() => {
    return {
      available: staffWithAvailability.filter(s => s.status === 'available'),
      limited: staffWithAvailability.filter(s => s.status === 'limited'),
      unavailable: staffWithAvailability.filter(s => s.status === 'unavailable'),
    };
  }, [staffWithAvailability]);

  const hasIssues = limited.length > 0 || unavailable.length > 0;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
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
          <User className="h-4 w-4" />
          Staff Availability
          {hasIssues && (
            <Badge variant="outline" className="ml-auto text-xs text-amber-600 border-amber-300">
              <AlertCircle className="h-3 w-3 mr-1" />
              {unavailable.length + limited.length} restriction(s)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[280px] pr-3">
          <div className="space-y-4">
            {/* Unavailable Staff */}
            {unavailable.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                  <UserX className="h-3 w-3" />
                  Unavailable ({unavailable.length})
                </h4>
                <div className="space-y-1">
                  {unavailable.map(staff => (
                    <StaffAvailabilityItem key={staff.id} staff={staff} />
                  ))}
                </div>
              </div>
            )}

            {/* Limited Staff */}
            {limited.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <UserMinus className="h-3 w-3" />
                  Limited ({limited.length})
                </h4>
                <div className="space-y-1">
                  {limited.map(staff => (
                    <StaffAvailabilityItem key={staff.id} staff={staff} />
                  ))}
                </div>
              </div>
            )}

            {/* Available Staff */}
            {available.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Available ({available.length})
                </h4>
                <div className="space-y-1">
                  {available.map(staff => (
                    <StaffAvailabilityItem key={staff.id} staff={staff} />
                  ))}
                </div>
              </div>
            )}

            {staffWithAvailability.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No staff members found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
