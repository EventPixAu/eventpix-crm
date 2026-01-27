/**
 * PhotographerDashboard - Mobile-first dashboard for photographers
 * 
 * Shows ONLY events they are assigned to.
 * Excludes all financial data.
 * Quick access to job sheets, calendar, and help.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isToday, isTomorrow, isFuture, isPast, addDays } from 'date-fns';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  CalendarCheck,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Package,
  Phone,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/lib/auth';
import { useMyJobSheets, MyJobSheet } from '@/hooks/useMyJobSheets';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'today' | 'upcoming' | 'past';

function JobCard({ job, showFullDate = false }: { job: MyJobSheet; showFullDate?: boolean }) {
  const eventDate = parseISO(job.event_date);
  const eventToday = isToday(eventDate);
  const eventTomorrow = isTomorrow(eventDate);
  const eventPast = isPast(eventDate) && !eventToday;

  // Format date label
  const dateLabel = eventToday
    ? 'Today'
    : eventTomorrow
    ? 'Tomorrow'
    : showFullDate
    ? format(eventDate, 'EEE, MMM d')
    : format(eventDate, 'EEE');

  return (
    <Link to={`/events/${job.id}/day-of`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Card
          className={cn(
            'transition-all cursor-pointer hover:shadow-md',
            eventToday && 'border-primary/50 bg-primary/5',
            eventPast && 'opacity-60'
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Date badge */}
              <div
                className={cn(
                  'shrink-0 w-14 text-center py-2 px-1 rounded-lg',
                  eventToday
                    ? 'bg-primary text-primary-foreground'
                    : eventTomorrow
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-xs font-medium uppercase">{dateLabel}</p>
                <p className="text-xl font-bold">{format(eventDate, 'd')}</p>
                <p className="text-xs">{format(eventDate, 'MMM')}</p>
              </div>

              {/* Event details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{job.event_name}</h3>

                {(job.arrival_time || job.start_time) && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {job.arrival_time ? (
                        <>
                          <span className="text-primary font-medium">
                            Call: {format(new Date(`2000-01-01T${job.arrival_time}`), 'h:mm a')}
                          </span>
                          {job.start_time && job.start_time !== job.arrival_time && (
                            <span className="text-muted-foreground ml-1">
                              (Event: {format(new Date(`2000-01-01T${job.start_time}`), 'h:mm a')}
                              {job.end_time && ` – ${format(new Date(`2000-01-01T${job.end_time}`), 'h:mm a')}`})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {format(new Date(`2000-01-01T${job.start_time}`), 'h:mm a')}
                          {job.end_time && ` – ${format(new Date(`2000-01-01T${job.end_time}`), 'h:mm a')}`}
                        </>
                      )}
                    </span>
                  </div>
                )}

                {job.venue_name && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{job.venue_name}</span>
                  </div>
                )}

                {/* Status indicators */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {job.onsite_contact_phone && (
                    <Badge variant="outline" className="text-xs">
                      <Phone className="h-3 w-3 mr-1" />
                      Contact
                    </Badge>
                  )}
                  {job.has_equipment && (
                    <Badge
                      variant={job.equipment_picked_up ? 'default' : 'outline'}
                      className={cn(
                        'text-xs',
                        !job.equipment_picked_up && 'border-amber-500/50 text-amber-600'
                      )}
                    >
                      <Package className="h-3 w-3 mr-1" />
                      {job.equipment_picked_up ? 'Gear Ready' : 'Gear Pending'}
                    </Badge>
                  )}
                  {job.delivery_due_soon && !job.delivered && (
                    <Badge variant="destructive" className="text-xs">
                      Delivery Due
                    </Badge>
                  )}
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

export default function PhotographerDashboard() {
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useMyJobSheets();
  const [filter, setFilter] = useState<FilterType>('upcoming');

  // Filter jobs
  const filteredJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return jobs.filter((job) => {
      const eventDate = parseISO(job.event_date);

      switch (filter) {
        case 'today':
          return isToday(eventDate);
        case 'upcoming':
          return isFuture(eventDate) || isToday(eventDate);
        case 'past':
          return isPast(eventDate) && !isToday(eventDate);
        default:
          return true;
      }
    }).sort((a, b) => {
      const dateA = parseISO(a.event_date);
      const dateB = parseISO(b.event_date);
      return filter === 'past' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    });
  }, [jobs, filter]);

  // Counts for filter badges
  const counts = useMemo(() => {
    const today = new Date();
    return {
      all: jobs.length,
      today: jobs.filter((j) => isToday(parseISO(j.event_date))).length,
      upcoming: jobs.filter((j) => {
        const d = parseISO(j.event_date);
        return isFuture(d) || isToday(d);
      }).length,
      past: jobs.filter((j) => {
        const d = parseISO(j.event_date);
        return isPast(d) && !isToday(d);
      }).length,
    };
  }, [jobs]);

  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Extract first name from full_name, falling back to email prefix
  const fullName = user?.user_metadata?.full_name as string | undefined;
  const firstName = fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-2xl font-display font-bold">
            {greeting}, {firstName}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {counts.upcoming} upcoming {counts.upcoming === 1 ? 'job' : 'jobs'}
            {counts.today > 0 && ` • ${counts.today} today`}
          </p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <Link to="/my-job-sheets">
            <div className="flex flex-col items-center p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <FileText className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs text-center">Job Sheets</span>
            </div>
          </Link>
          <Link to="/my-calendar">
            <div className="flex flex-col items-center p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Calendar className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs text-center">Calendar</span>
            </div>
          </Link>
          <Link to="/my-availability">
            <div className="flex flex-col items-center p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <CalendarCheck className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs text-center">Availability</span>
            </div>
          </Link>
          <Link to="/knowledge-base">
            <div className="flex flex-col items-center p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <BookOpen className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs text-center">Help</span>
            </div>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-4">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as FilterType)}
            className="justify-start"
          >
            <ToggleGroupItem value="upcoming" className="text-sm">
              Upcoming {counts.upcoming > 0 && `(${counts.upcoming})`}
            </ToggleGroupItem>
            <ToggleGroupItem value="today" className="text-sm">
              Today {counts.today > 0 && `(${counts.today})`}
            </ToggleGroupItem>
            <ToggleGroupItem value="past" className="text-sm">
              Past {counts.past > 0 && `(${counts.past})`}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Job list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {filter === 'today'
                ? 'No jobs scheduled for today'
                : filter === 'upcoming'
                ? 'No upcoming jobs'
                : filter === 'past'
                ? 'No past jobs'
                : 'No jobs found'}
            </p>
            <Link to="/my-availability" className="mt-4 inline-block">
              <Button variant="outline">Update Availability</Button>
            </Link>
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
                <JobCard job={job} showFullDate={filter !== 'today'} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          <Link
            to="/"
            className="flex flex-col items-center p-2 text-primary"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs mt-1">Jobs</span>
          </Link>
          <Link
            to="/my-job-sheets"
            className="flex flex-col items-center p-2 text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs mt-1">Sheets</span>
          </Link>
          <Link
            to="/knowledge-base"
            className="flex flex-col items-center p-2 text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-xs mt-1">Help</span>
          </Link>
          <Link
            to="/staff/me"
            className="flex flex-col items-center p-2 text-muted-foreground hover:text-foreground"
          >
            <User className="h-5 w-5" />
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
