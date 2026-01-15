import { useState, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Filter,
  Package,
  ChevronRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeliveryMetrics } from '@/hooks/useDeliveryMetrics';
import { useEventTypes } from '@/hooks/useLookups';
import { useEventSeries } from '@/hooks/useEventSeries';

export default function DeliveryMetrics() {
  const [dateRange, setDateRange] = useState('3m');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');

  const { eventTypes } = useLookups();
  const { data: seriesList } = useEventSeries();

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    switch (dateRange) {
      case '1m':
        start = subMonths(now, 1);
        break;
      case '3m':
        start = subMonths(now, 3);
        break;
      case '6m':
        start = subMonths(now, 6);
        break;
      case '12m':
        start = subMonths(now, 12);
        break;
      default:
        start = subMonths(now, 3);
    }
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(now, 'yyyy-MM-dd'),
    };
  }, [dateRange]);

  const { data: metrics, isLoading } = useDeliveryMetrics(
    startDate,
    endDate,
    selectedEventType !== 'all' ? selectedEventType : undefined,
    selectedSeries !== 'all' ? selectedSeries : undefined
  );

  const dateRangeLabel = useMemo(() => {
    switch (dateRange) {
      case '1m': return 'Last Month';
      case '3m': return 'Last 3 Months';
      case '6m': return 'Last 6 Months';
      case '12m': return 'Last 12 Months';
      default: return 'Custom';
    }
  }, [dateRange]);

  return (
    <AppLayout>
      <PageHeader
        title="Delivery Performance"
        subtitle="SLA tracking and delivery risk reporting"
        icon={Package}
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="12m">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedEventType} onValueChange={setSelectedEventType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {eventTypes?.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSeries} onValueChange={setSelectedSeries}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Series" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Series</SelectItem>
                {seriesList?.filter(s => s.is_active).map(series => (
                  <SelectItem key={series.id} value={series.id}>{series.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="On-Time Rate"
          value={metrics ? `${metrics.onTimeRate}%` : '—'}
          subtitle={dateRangeLabel}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          title="Overdue Events"
          value={metrics?.overdueCount ?? 0}
          subtitle="Pending delivery"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        />
        <StatCard
          title="Avg. Delivery Time"
          value={metrics?.averageDeliveryDays !== null ? `${metrics.averageDeliveryDays} days` : '—'}
          subtitle="From event date"
          icon={<Clock className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          title="Total Events"
          value={metrics?.totalEvents ?? 0}
          subtitle={`${metrics?.deliveredCount ?? 0} delivered`}
          icon={<Calendar className="h-5 w-5 text-primary" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* By Event Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Event Type</CardTitle>
            <CardDescription>Delivery metrics grouped by event type</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : Object.keys(metrics?.byEventType || {}).length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data for selected filters
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(metrics?.byEventType || {}).map(([id, data]) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.deliveredCount}/{data.totalEvents} delivered
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{data.onTimeRate}% on-time</p>
                      {data.averageDeliveryDays !== null && (
                        <p className="text-sm text-muted-foreground">{data.averageDeliveryDays} days avg</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Series */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Series</CardTitle>
            <CardDescription>Delivery metrics grouped by event series</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : Object.keys(metrics?.bySeries || {}).length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No series data for selected filters
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(metrics?.bySeries || {}).map(([id, data]) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.deliveredCount}/{data.totalEvents} delivered
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{data.onTimeRate}% on-time</p>
                      {data.averageDeliveryDays !== null && (
                        <p className="text-sm text-muted-foreground">{data.averageDeliveryDays} days avg</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Overdue Events
          </CardTitle>
          <CardDescription>Events that have passed their delivery deadline</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : (metrics?.overdueEvents || []).length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              No overdue events - great job!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics?.overdueEvents.map(event => (
                  <TableRow key={event.eventId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{event.eventName}</p>
                        {event.seriesName && (
                          <p className="text-sm text-muted-foreground">{event.seriesName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(event.eventDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      {event.deliveryDeadline 
                        ? format(new Date(event.deliveryDeadline), 'dd MMM yyyy')
                        : '—'
                      }
                    </TableCell>
                    <TableCell>
                      {event.daysToDeadline !== null && (
                        <Badge variant="destructive">
                          {Math.abs(event.daysToDeadline)} days
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/events/${event.eventId}`}>
                          View <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
