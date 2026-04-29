import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, Package } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useEquipmentItems, EQUIPMENT_CATEGORIES } from '@/hooks/useEquipment';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AllocationWithEvent {
  id: string;
  equipment_item_id: string;
  status: string;
  allocated_at: string;
  returned_at: string | null;
  event: {
    id: string;
    event_name: string;
    event_date: string;
    start_at: string | null;
    end_at: string | null;
  };
  equipment_item: {
    id: string;
    name: string;
    category: string;
  };
}

function useAllocationsInRange(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['equipment-allocations-range', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_allocations')
        .select(`
          id,
          equipment_item_id,
          status,
          allocated_at,
          returned_at,
          event:events(id, event_name, event_date, start_at, end_at),
          equipment_item:equipment_items(id, name, category)
        `)
        .gte('allocated_at', startDate.toISOString())
        .or(`returned_at.is.null,returned_at.gte.${startDate.toISOString()}`)
        .neq('status', 'returned');

      if (error) throw error;
      return data as AllocationWithEvent[];
    },
  });
}

export function EquipmentAvailabilityCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: allocations, isLoading: allocationsLoading } = useAllocationsInRange(monthStart, monthEnd);
  const { data: equipment, isLoading: equipmentLoading } = useEquipmentItems();

  const isLoading = allocationsLoading || equipmentLoading;

  // Group allocations by date
  const allocationsByDate = useMemo(() => {
    if (!allocations) return new Map<string, AllocationWithEvent[]>();
    
    const map = new Map<string, AllocationWithEvent[]>();
    
    allocations.forEach((allocation) => {
      if (!allocation.event) return;
      
      const eventDate = allocation.event.event_date;
      if (!eventDate) return;
      
      const dateKey = eventDate;
      const existing = map.get(dateKey) || [];
      existing.push(allocation);
      map.set(dateKey, existing);
    });
    
    return map;
  }, [allocations]);

  // Filter equipment by category
  const filteredEquipment = useMemo(() => {
    if (!equipment) return [];
    if (categoryFilter === 'all') return equipment;
    return equipment.filter((item) => item.category === categoryFilter);
  }, [equipment, categoryFilter]);

  // Get allocations for selected date
  const selectedDateAllocations = useMemo(() => {
    if (!selectedDate || !allocations) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return (allocationsByDate.get(dateKey) || []).filter((a) => 
      categoryFilter === 'all' || a.equipment_item?.category === categoryFilter
    );
  }, [selectedDate, allocations, allocationsByDate, categoryFilter]);

  // Get available equipment for selected date
  const availableEquipmentForDate = useMemo(() => {
    if (!selectedDate || !filteredEquipment) return [];
    const allocatedIds = new Set(selectedDateAllocations.map((a) => a.equipment_item_id));
    return filteredEquipment.filter((item) => 
      !allocatedIds.has(item.id) && item.status === 'available'
    );
  }, [selectedDate, filteredEquipment, selectedDateAllocations]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    setSelectedDate(null);
  };

  const getDayStats = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayAllocations = allocationsByDate.get(dateKey) || [];
    const filtered = categoryFilter === 'all' 
      ? dayAllocations 
      : dayAllocations.filter((a) => a.equipment_item?.category === categoryFilter);
    return {
      total: filtered.length,
      items: filtered,
    };
  };

  // Handle error states
  if (!allocationsLoading && !equipmentLoading && !equipment?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Equipment Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No equipment in inventory yet.</p>
            <p className="text-sm mt-1">Add equipment in the Inventory tab to see availability.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Equipment Availability
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EQUIPMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
            <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-start-${i}`} className="h-16" />
              ))}
              
              {days.map((day) => {
                const stats = getDayStats(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasAllocations = stats.total > 0;
                
                return (
                  <Tooltip key={day.toISOString()}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'h-16 p-1 rounded-md border text-left transition-colors relative',
                          'hover:bg-accent hover:border-accent-foreground/20',
                          isToday(day) && 'border-primary',
                          isSelected && 'bg-primary/10 border-primary',
                          !isSameMonth(day, currentDate) && 'text-muted-foreground opacity-50'
                        )}
                      >
                        <span className={cn(
                          'text-sm font-medium',
                          isToday(day) && 'text-primary'
                        )}>
                          {format(day, 'd')}
                        </span>
                        
                        {hasAllocations && (
                          <div className="absolute bottom-1 left-1 right-1">
                            <div className="flex items-center gap-1">
                              <div className="h-1.5 flex-1 rounded-full bg-primary/60" />
                              <span className="text-[10px] text-muted-foreground">{stats.total}</span>
                            </div>
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    {hasAllocations && (
                      <TooltipContent>
                        <p>{stats.total} item{stats.total !== 1 ? 's' : ''} allocated</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected date details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">
              Click on a date to see equipment allocation details.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Allocated items */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center justify-between">
                  Allocated
                  <Badge variant="secondary">{selectedDateAllocations.length}</Badge>
                </h3>
                <ScrollArea className="h-[200px]">
                  {selectedDateAllocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No equipment allocated for this date.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDateAllocations.map((allocation) => (
                        <div
                          key={allocation.id}
                          className="flex items-start justify-between p-2 rounded-md bg-muted/50 text-sm"
                        >
                          <div>
                            <p className="font-medium">{allocation.equipment_item?.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {allocation.equipment_item?.category?.replace('_', ' ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {allocation.event?.event_name}
                            </p>
                            <Badge variant="outline" className="text-[10px] mt-1 capitalize">
                              {allocation.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Available items */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center justify-between">
                  Available
                  <Badge variant="outline">{availableEquipmentForDate.length}</Badge>
                </h3>
                <ScrollArea className="h-[200px]">
                  {availableEquipmentForDate.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {filteredEquipment.length === 0 
                        ? 'No equipment in inventory.' 
                        : 'All equipment is allocated.'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {availableEquipmentForDate.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-md bg-green-500/10 text-sm"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {item.category.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
