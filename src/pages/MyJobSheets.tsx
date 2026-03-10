/**
 * MY JOB SHEETS - Photographer-focused view
 * 
 * PHOTOGRAPHER ROLE BOUNDARIES:
 * - Shows ONLY assigned events with essential operational details
 * - NO financial data (costs, rates, invoices)
 * - NO client contact details beyond on-site contact
 * - NO admin-only features
 * 
 * Essential details for photographers:
 * - Event time and date
 * - Venue name and address
 * - On-site contact (name + phone)
 * - Coverage details (what to shoot)
 * - Equipment assigned
 * - Checklist status
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, isPast, parseISO, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  FileText,
  Package,
  AlertTriangle,
  CheckCircle2,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { useMyJobSheets } from '@/hooks/useMyJobSheets';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FilterMode = 'upcoming' | 'today' | 'past';

function JobSheetCard({ job }: { job: ReturnType<typeof useMyJobSheets>['data'][number] }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const eventDate = parseISO(job.event_date);
  const isEventToday = isToday(eventDate);
  const isEventTomorrow = isTomorrow(eventDate);
  const isEventPast = isPast(eventDate) && !isEventToday;
  
  // Extract suburb from address for compact display
  const suburb = useMemo(() => {
    if (!job.venue_address) return null;
    const parts = job.venue_address.split(',').map(p => p.trim());
    // Usually suburb is second-to-last or third part
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  }, [job.venue_address]);

  return (
    <Link to={`/events/${job.id}/day-of`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Card className={cn(
          "transition-all cursor-pointer hover:shadow-md",
          isEventToday && "border-primary/50 bg-primary/5",
          isEventPast && "opacity-60"
        )}>
          <CardContent className="p-4">
            {/* Header: Date badge + Event name */}
            <div className="flex items-start gap-3 mb-3">
              {/* Date badge */}
              <div className={cn(
                "shrink-0 w-14 text-center py-2 px-1 rounded-lg",
                isEventToday ? "bg-primary text-primary-foreground" :
                isEventTomorrow ? "bg-accent text-accent-foreground" :
                "bg-muted"
              )}>
                <p className="text-xs font-medium uppercase">
                  {isEventToday ? 'Today' : isEventTomorrow ? 'Tomorrow' : format(eventDate, 'EEE')}
                </p>
                <p className="text-xl font-bold">{format(eventDate, 'd')}</p>
                <p className="text-xs">{format(eventDate, 'MMM')}</p>
              </div>
              
              {/* Event details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{job.event_name}</h3>
                
                {/* Time */}
                {job.start_time && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {format(new Date(`2000-01-01T${job.start_time}`), 'h:mm a')}
                      {job.end_time && ` – ${format(new Date(`2000-01-01T${job.end_time}`), 'h:mm a')}`}
                    </span>
                  </div>
                )}
                
                {/* Venue */}
                {(job.venue_name || suburb) && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{job.venue_name || suburb}</span>
                  </div>
                )}
              </div>
              
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
            </div>
            
            {/* Status indicators */}
            <div className="flex flex-wrap gap-2">
              {/* On-site contact available */}
              {job.onsite_contact_phone && (
                <Badge variant="outline" className="text-xs">
                  <Phone className="h-3 w-3 mr-1" />
                  Contact Ready
                </Badge>
              )}
              
              {/* Coverage details available */}
              {job.coverage_details && (
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Brief Ready
                </Badge>
              )}
              
              {/* Equipment status */}
              {job.has_equipment && (
                <Badge 
                  variant={job.equipment_picked_up ? "default" : "outline"} 
                  className={cn(
                    "text-xs",
                    !job.equipment_picked_up && "border-amber-500/50 text-amber-600"
                  )}
                >
                  <Package className="h-3 w-3 mr-1" />
                  {job.equipment_picked_up ? 'Gear Ready' : 'Gear Pending'}
                </Badge>
              )}
              
              {/* Checklist progress */}
              {job.checklist_total > 0 && (
                <Badge 
                  variant={job.checklist_done === job.checklist_total ? "default" : "secondary"} 
                  className="text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {job.checklist_done}/{job.checklist_total}
                </Badge>
              )}
              
              {/* Delivery due warning */}
              {job.delivery_due_soon && !job.delivered && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Delivery Due
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

export default function MyJobSheets() {
  const [filter, setFilter] = useState<FilterMode>('upcoming');
  const { data: jobs = [], isLoading } = useMyJobSheets();
  
  const filteredJobs = useMemo(() => {
    const today = startOfDay(new Date());
    
    return jobs.filter(job => {
      const eventDate = parseISO(job.event_date);
      const eventDay = startOfDay(eventDate);
      
      switch (filter) {
        case 'today':
          return isToday(eventDate);
        case 'past':
          return isBefore(eventDay, today);
        case 'upcoming':
        default:
          // Include today and future
          return !isBefore(eventDay, today);
      }
    }).sort((a, b) => {
      // Upcoming: ascending (nearest first)
      // Past: descending (most recent first)
      const dateA = parseISO(a.event_date);
      const dateB = parseISO(b.event_date);
      
      if (filter === 'past') {
        return dateB.getTime() - dateA.getTime();
      }
      return dateA.getTime() - dateB.getTime();
    });
  }, [jobs, filter]);
  
  // Count for badges
  const counts = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      today: jobs.filter(j => isToday(parseISO(j.event_date))).length,
      upcoming: jobs.filter(j => !isBefore(startOfDay(parseISO(j.event_date)), today)).length,
      past: jobs.filter(j => isBefore(startOfDay(parseISO(j.event_date)), today)).length,
    };
  }, [jobs]);

  return (
    <AppLayout>
      <PageHeader
        title="My Job Sheets"
        description="Your assigned events with essential details"
      />
      
      {/* Filter Toggle */}
      <div className="flex items-center gap-4 mb-6">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as FilterMode)}
          className="justify-start"
        >
          <ToggleGroupItem value="upcoming" aria-label="Upcoming jobs">
            Upcoming
            {counts.upcoming > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                {counts.upcoming}
              </Badge>
            )}
          </ToggleGroupItem>
          <ToggleGroupItem value="today" aria-label="Today's jobs">
            Today
            {counts.today > 0 && (
              <Badge variant="default" className="ml-1.5 h-5 px-1.5">
                {counts.today}
              </Badge>
            )}
          </ToggleGroupItem>
          <ToggleGroupItem value="past" aria-label="Past jobs">
            Past
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      {/* Job List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {filter === 'today' ? 'No jobs today' :
             filter === 'past' ? 'No past jobs' :
             'No upcoming jobs'}
          </h3>
          <p className="text-muted-foreground">
            {filter === 'upcoming' 
              ? "You don't have any upcoming events assigned yet."
              : filter === 'today'
              ? "You don't have any events scheduled for today."
              : "Your completed jobs will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <JobSheetCard job={job} />
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
