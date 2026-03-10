import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, parseISO, isBefore, isAfter, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Circle, CircleDot, CircleSlash, Loader2, AlertTriangle, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { 
  useMyAvailability, 
  useSetAvailability,
  useBulkSetAvailability,
  useSameDayEvents,
  AvailabilityStatus,
  StaffAvailability,
} from '@/hooks/useStaffAvailability';
import { Badge } from '@/components/ui/badge';

interface AvailabilityCalendarProps {
  userId?: string;
  readOnly?: boolean;
}

export function AvailabilityCalendar({ userId, readOnly = false }: AvailabilityCalendarProps) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editFromTime, setEditFromTime] = useState('');
  const [editUntilTime, setEditUntilTime] = useState('');
  const [pendingStatus, setPendingStatus] = useState<AvailabilityStatus | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  // Range selection state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [showRangeDialog, setShowRangeDialog] = useState(false);
  const [rangeStatus, setRangeStatus] = useState<AvailabilityStatus>('unavailable');
  const [rangeNotes, setRangeNotes] = useState('');
  const [rangeFromTime, setRangeFromTime] = useState('');
  const [rangeUntilTime, setRangeUntilTime] = useState('');
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const { data: availability = [], isLoading } = useMyAvailability(
    format(monthStart, 'yyyy-MM-dd'),
    format(monthEnd, 'yyyy-MM-dd')
  );
  
  // Fetch same-day events for the selected date
  const { data: sameDayEvents = [] } = useSameDayEvents(effectiveUserId, selectedDate || undefined);
  
  const setAvailability = useSetAvailability();
  const bulkSetAvailability = useBulkSetAvailability();
  
  // Create a map of date -> availability for quick lookup
  const availabilityMap = useMemo(() => {
    const map = new Map<string, StaffAvailability>();
    availability.forEach(a => {
      map.set(a.date, a);
    });
    return map;
  }, [availability]);
  
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get the day of week for the first day (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();
  
  // Calculate selected range days
  const rangeDays = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    const start = isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
    const end = isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
    return eachDayOfInterval({ start, end }).filter(day => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return !isBefore(day, today);
    });
  }, [rangeStart, rangeEnd]);
  
  const isInRange = (day: Date) => {
    if (!rangeStart) return false;
    if (!rangeEnd) return isSameDay(day, rangeStart);
    
    const start = isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
    const end = isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
    
    return (isAfter(day, start) || isSameDay(day, start)) && 
           (isBefore(day, end) || isSameDay(day, end));
  };
  
  const handleDayClick = (day: Date, dateStr: string) => {
    const dayAvailability = availabilityMap.get(dateStr);
    
    if (isSelectingRange) {
      if (!rangeStart) {
        setRangeStart(day);
      } else if (!rangeEnd) {
        setRangeEnd(day);
        setShowRangeDialog(true);
      } else {
        // Reset and start new selection
        setRangeStart(day);
        setRangeEnd(null);
      }
    } else {
      setSelectedDate(dateStr);
      setEditNotes(dayAvailability?.notes || '');
      setEditFromTime(dayAvailability?.unavailable_from?.slice(0, 5) || '');
      setEditUntilTime(dayAvailability?.unavailable_until?.slice(0, 5) || '');
    }
  };
  
  const handleSetAvailability = async (status: AvailabilityStatus) => {
    if (!effectiveUserId || !selectedDate) return;
    
    // Check if there are existing assignments and warn user
    if (sameDayEvents.length > 0 && status !== 'available') {
      setPendingStatus(status);
      setShowWarningDialog(true);
      return;
    }
    
    await executeAvailabilityChange(status);
  };
  
  const executeAvailabilityChange = async (status: AvailabilityStatus) => {
    if (!effectiveUserId || !selectedDate) return;
    
    await setAvailability.mutateAsync({
      userId: effectiveUserId,
      date: selectedDate,
      status,
      notes: editNotes || undefined,
    });
    
    setSelectedDate(null);
    setEditNotes('');
    setPendingStatus(null);
  };
  
  const handleConfirmWithWarning = async () => {
    if (pendingStatus) {
      await executeAvailabilityChange(pendingStatus);
    }
    setShowWarningDialog(false);
  };
  
  const handleBulkApply = async () => {
    if (!effectiveUserId || rangeDays.length === 0) return;
    
    const dates = rangeDays.map(day => format(day, 'yyyy-MM-dd'));
    
    await bulkSetAvailability.mutateAsync({
      userId: effectiveUserId,
      dates,
      status: rangeStatus,
      notes: rangeNotes || undefined,
    });
    
    // Reset range selection
    setRangeStart(null);
    setRangeEnd(null);
    setShowRangeDialog(false);
    setIsSelectingRange(false);
    setRangeNotes('');
  };
  
  const cancelRangeSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setIsSelectingRange(false);
    setShowRangeDialog(false);
    setRangeNotes('');
  };
  
  const getStatusIcon = (status: AvailabilityStatus | undefined) => {
    switch (status) {
      case 'unavailable':
        return <CircleSlash className="h-3 w-3 text-destructive" />;
      case 'limited':
        return <CircleDot className="h-3 w-3 text-amber-500" />;
      default:
        return null;
    }
  };
  
  const getStatusColor = (status: AvailabilityStatus | undefined) => {
    switch (status) {
      case 'unavailable':
        return 'bg-destructive/20 border-destructive/50 text-destructive-foreground';
      case 'limited':
        return 'bg-amber-500/20 border-amber-500/50';
      default:
        return '';
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Range Selection Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant={isSelectingRange ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (isSelectingRange) {
              cancelRangeSelection();
            } else {
              setIsSelectingRange(true);
              setSelectedDate(null);
            }
          }}
          className="gap-2"
        >
          <CalendarRange className="h-4 w-4" />
          {isSelectingRange ? 'Cancel Range Selection' : 'Select Date Range'}
        </Button>
        
        {isSelectingRange && rangeStart && (
          <Badge variant="secondary" className="text-xs">
            {rangeEnd 
              ? `${format(isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd, 'MMM d')} - ${format(isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd, 'MMM d')}`
              : `From ${format(rangeStart, 'MMM d')} - Click end date`
            }
          </Badge>
        )}
      </div>
      
      {isSelectingRange && (
        <p className="text-sm text-muted-foreground text-center">
          Click the start date, then click the end date to select a range
        </p>
      )}
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground justify-center">
        <div className="flex items-center gap-1">
          <Circle className="h-3 w-3" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <CircleDot className="h-3 w-3 text-amber-500" />
          <span>Limited</span>
        </div>
        <div className="flex items-center gap-1">
          <CircleSlash className="h-3 w-3 text-destructive" />
          <span>Unavailable</span>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
        
        {/* Empty cells for days before the month starts */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        
        {/* Calendar days */}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayAvailability = availabilityMap.get(dateStr);
          const status = dayAvailability?.availability_status;
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
          const inRange = isSelectingRange && isInRange(day) && !isPast;
          
          if (isSelectingRange) {
            return (
              <button
                key={dateStr}
                disabled={readOnly || isPast}
                onClick={() => handleDayClick(day, dateStr)}
                className={cn(
                  'aspect-square p-1 rounded-lg border text-sm flex flex-col items-center justify-center gap-0.5',
                  'transition-colors hover:bg-muted/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isToday(day) && 'ring-2 ring-primary',
                  inRange && 'bg-primary/20 border-primary',
                  !inRange && getStatusColor(status),
                  !status && !inRange && 'border-border'
                )}
              >
                <span className={cn(
                  'font-medium',
                  !isSameMonth(day, currentMonth) && 'text-muted-foreground'
                )}>
                  {format(day, 'd')}
                </span>
                {getStatusIcon(status)}
              </button>
            );
          }
          
          return (
            <Popover 
              key={dateStr}
              open={selectedDate === dateStr}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedDate(null);
                  setEditNotes('');
                }
              }}
            >
              <PopoverTrigger asChild>
                <button
                  disabled={readOnly || isPast}
                  onClick={() => handleDayClick(day, dateStr)}
                  className={cn(
                    'aspect-square p-1 rounded-lg border text-sm flex flex-col items-center justify-center gap-0.5',
                    'transition-colors hover:bg-muted/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    isToday(day) && 'ring-2 ring-primary',
                    getStatusColor(status),
                    !status && 'border-border'
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    !isSameMonth(day, currentMonth) && 'text-muted-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>
                  {getStatusIcon(status)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 pointer-events-auto" align="center">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">{format(parseISO(dateStr), 'EEEE, MMMM d')}</h4>
                    <p className="text-sm text-muted-foreground">
                      Set your availability
                    </p>
                  </div>
                  
                  <ToggleGroup 
                    type="single" 
                    value={status || 'available'}
                    onValueChange={(value) => {
                      if (value) handleSetAvailability(value as AvailabilityStatus);
                    }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="available" className="text-xs">
                      <Circle className="h-3 w-3 mr-1" />
                      Available
                    </ToggleGroupItem>
                    <ToggleGroupItem value="limited" className="text-xs">
                      <CircleDot className="h-3 w-3 mr-1 text-amber-500" />
                      Limited
                    </ToggleGroupItem>
                    <ToggleGroupItem value="unavailable" className="text-xs">
                      <CircleSlash className="h-3 w-3 mr-1 text-destructive" />
                      Unavailable
                    </ToggleGroupItem>
                  </ToggleGroup>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="e.g., Only available after 2pm..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  
                  {editNotes !== (dayAvailability?.notes || '') && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleSetAvailability(status || 'available')}
                      disabled={setAvailability.isPending}
                    >
                      Save Notes
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      
      {/* Range Selection Dialog */}
      <Dialog open={showRangeDialog} onOpenChange={(open) => {
        if (!open) {
          setShowRangeDialog(false);
          // Keep the range selection active so user can adjust
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5" />
              Set Availability for {rangeDays.length} Day{rangeDays.length !== 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              {rangeStart && rangeEnd && (
                <>
                  {format(isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd, 'MMMM d, yyyy')} 
                  {' '}to{' '}
                  {format(isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd, 'MMMM d, yyyy')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <ToggleGroup 
                type="single" 
                value={rangeStatus}
                onValueChange={(value) => {
                  if (value) setRangeStatus(value as AvailabilityStatus);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="available" className="text-xs">
                  <Circle className="h-3 w-3 mr-1" />
                  Available
                </ToggleGroupItem>
                <ToggleGroupItem value="limited" className="text-xs">
                  <CircleDot className="h-3 w-3 mr-1 text-amber-500" />
                  Limited
                </ToggleGroupItem>
                <ToggleGroupItem value="unavailable" className="text-xs">
                  <CircleSlash className="h-3 w-3 mr-1 text-destructive" />
                  Unavailable
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={rangeNotes}
                onChange={(e) => setRangeNotes(e.target.value)}
                placeholder="e.g., Annual leave, On holiday..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={cancelRangeSelection}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkApply}
              disabled={bulkSetAvailability.isPending}
            >
              {bulkSetAvailability.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Apply to {rangeDays.length} Day{rangeDays.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Warning Dialog for Existing Assignments */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Existing Assignments
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are already assigned to <strong>{sameDayEvents.length} event{sameDayEvents.length > 1 ? 's' : ''}</strong> on this day:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {sameDayEvents.slice(0, 3).map((event) => (
                  <li key={event.id}>{event.event_name}</li>
                ))}
                {sameDayEvents.length > 3 && (
                  <li className="text-muted-foreground">...and {sameDayEvents.length - 3} more</li>
                )}
              </ul>
              <p className="text-sm font-medium mt-2">
                Changing your availability will <strong>not</strong> remove these assignments. 
                An admin may override your availability if needed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmWithWarning}>
              Change Availability Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
