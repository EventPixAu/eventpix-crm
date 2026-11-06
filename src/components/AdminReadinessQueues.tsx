import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  AlertTriangle, 
  Calendar,
  ChevronRight, 
  Clock, 
  Filter,
  MapPin,
  Package,
  Users,
  XCircle,
  CheckCircle,
  ExternalLink,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  useUpcomingEventsReadiness, 
  useUpcomingDeliveriesReadiness,
  type EventWithReadiness,
  type DeliveryWithReadiness 
} from '@/hooks/useReadinessGates';
import { useEventSeries } from '@/hooks/useEventSeries';
import { cn } from '@/lib/utils';

function ReadinessStatusBadge({ status }: { status: 'ready' | 'partially_ready' | 'not_ready' | 'at_risk' | 'overdue' }) {
  const config = {
    ready: { label: 'Ready', icon: CheckCircle, className: 'bg-green-500/20 text-green-700 border-green-500/30' },
    partially_ready: { label: 'Partial', icon: AlertTriangle, className: 'bg-amber-500/20 text-amber-700 border-amber-500/30' },
    not_ready: { label: 'Not Ready', icon: XCircle, className: 'bg-destructive/20 text-destructive border-destructive/30' },
    at_risk: { label: 'At Risk', icon: AlertTriangle, className: 'bg-amber-500/20 text-amber-700 border-amber-500/30' },
    overdue: { label: 'Overdue', icon: XCircle, className: 'bg-destructive/20 text-destructive border-destructive/30' },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function IssueChips({ issues }: { issues: string[] }) {
  const getIcon = (issue: string) => {
    const lower = issue.toLowerCase();
    if (lower.includes('session')) return Calendar;
    if (lower.includes('venue')) return MapPin;
    if (lower.includes('photographer') || lower.includes('staff')) return Users;
    if (lower.includes('contact')) return Users;
    if (lower.includes('delivery') || lower.includes('link')) return Package;
    return AlertTriangle;
  };

  return (
    <div className="flex flex-wrap gap-1">
      {issues.map((issue, i) => {
        const Icon = getIcon(issue);
        return (
          <Badge key={i} variant="outline" className="text-xs gap-1 bg-background">
            <Icon className="h-3 w-3" />
            {issue}
          </Badge>
        );
      })}
    </div>
  );
}

function EventReadinessRow({ event }: { event: EventWithReadiness }) {
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-2',
      event.readiness.status === 'not_ready' && 'border-destructive/50 bg-destructive/5',
      event.readiness.status === 'partially_ready' && 'border-amber-500/50 bg-amber-500/5',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium truncate">{event.event_name}</h4>
            <ReadinessStatusBadge status={event.readiness.status} />
            {event.event_series_name && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Layers className="h-3 w-3" />
                {event.event_series_name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {event.first_session_date 
                ? format(parseISO(event.first_session_date), 'EEE, MMM d')
                : format(parseISO(event.event_date), 'EEE, MMM d')}
            </span>
            {event.first_session_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(parseISO(`2000-01-01T${event.first_session_time}`), 'h:mm a')}
              </span>
            )}
            {event.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.city}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{event.client_name}</p>
        </div>
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to={`/events/${event.id}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <IssueChips issues={event.readiness.issues} />
    </div>
  );
}

function DeliveryReadinessRow({ delivery }: { delivery: DeliveryWithReadiness }) {
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-2',
      delivery.readiness.status === 'overdue' && 'border-destructive/50 bg-destructive/5',
      delivery.readiness.status === 'at_risk' && 'border-amber-500/50 bg-amber-500/5',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium truncate">{delivery.event_name}</h4>
            <ReadinessStatusBadge status={delivery.readiness.status} />
            {delivery.readiness.daysOverdue && (
              <Badge variant="destructive" className="text-xs">
                {delivery.readiness.daysOverdue} day{delivery.readiness.daysOverdue !== 1 ? 's' : ''} overdue
              </Badge>
            )}
            {delivery.event_series_name && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Layers className="h-3 w-3" />
                {delivery.event_series_name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Deadline: {format(parseISO(delivery.delivery_deadline), 'MMM d, h:mm a')}
            </span>
            {delivery.delivery_link && (
              <a 
                href={delivery.delivery_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View link
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{delivery.client_name}</p>
        </div>
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to={`/events/${delivery.event_id}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <IssueChips issues={delivery.readiness.issues} />
    </div>
  );
}

interface AdminReadinessQueuesProps {
  defaultTab?: 'events' | 'deliveries';
}

export function AdminReadinessQueues({ defaultTab = 'events' }: AdminReadinessQueuesProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [eventFilter, setEventFilter] = useState<'all' | 'not_ready' | 'partially_ready'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'at_risk' | 'overdue' | 'missing_link'>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  const { data: seriesList = [] } = useEventSeries();
  
  const { 
    data: eventsData = [], 
    isLoading: eventsLoading 
  } = useUpcomingEventsReadiness({
    hoursAhead: 48,
    filterStatus: eventFilter,
    seriesId: selectedSeries !== 'all' ? selectedSeries : undefined,
    city: selectedCity !== 'all' ? selectedCity : undefined,
  });

  const { 
    data: deliveriesData = [], 
    isLoading: deliveriesLoading 
  } = useUpcomingDeliveriesReadiness({
    hoursAhead: 48,
    filterStatus: deliveryFilter,
    seriesId: selectedSeries !== 'all' ? selectedSeries : undefined,
  });

  // Extract unique cities from events
  const uniqueCities = [...new Set(eventsData.map(e => e.city).filter(Boolean))] as string[];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Readiness Queues
            </CardTitle>
            <CardDescription>
              Events and deliveries needing attention in the next 48 hours
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="events" className="gap-1">
                <Calendar className="h-4 w-4" />
                Events
                {eventsData.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {eventsData.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deliveries" className="gap-1">
                <Package className="h-4 w-4" />
                Deliveries
                {deliveriesData.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {deliveriesData.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              
              {activeTab === 'events' && (
                <>
                  <Select value={eventFilter} onValueChange={(v: any) => setEventFilter(v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Issues</SelectItem>
                      <SelectItem value="not_ready">Not Ready</SelectItem>
                      <SelectItem value="partially_ready">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {uniqueCities.length > 0 && (
                    <Select value={selectedCity} onValueChange={setSelectedCity}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue placeholder="City" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {uniqueCities.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
              
              {activeTab === 'deliveries' && (
                <Select value={deliveryFilter} onValueChange={(v: any) => setDeliveryFilter(v)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Issues</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="missing_link">Missing Link</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {seriesList.length > 0 && (
                <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Series" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Series</SelectItem>
                    {seriesList.filter(s => s.is_active).map(series => (
                      <SelectItem key={series.id} value={series.id}>
                        {series.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <TabsContent value="events" className="mt-0">
            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : eventsData.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="font-medium">All events are ready</p>
                <p className="text-sm text-muted-foreground">
                  No issues found for upcoming events in the next 48 hours
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {eventsData.map(event => (
                  <EventReadinessRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deliveries" className="mt-0">
            {deliveriesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : deliveriesData.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="font-medium">All deliveries on track</p>
                <p className="text-sm text-muted-foreground">
                  No delivery issues for the next 48 hours
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {deliveriesData.map(delivery => (
                  <DeliveryReadinessRow key={delivery.id} delivery={delivery} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
