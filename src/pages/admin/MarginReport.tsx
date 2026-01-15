/**
 * MARGIN REPORT PAGE
 * 
 * Admin-only margin analysis: cost vs quoted total per event and series.
 * Access: Admin only
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  BarChart3,
  Filter,
  ChevronDown
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useMarginReport } from '@/hooks/useMarginReport';
import { useEventSeries } from '@/hooks/useEventSeries';
import { cn } from '@/lib/utils';

type DatePreset = 'this_month' | 'last_month' | 'last_90_days' | 'year_to_date' | 'all_time' | 'custom';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function MarginReport() {
  const { isAdmin } = useAuth();
  const [datePreset, setDatePreset] = useState<DatePreset>('last_90_days');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('all');
  
  const { data: seriesList } = useEventSeries();

  // Calculate date range based on preset
  const getDateRange = () => {
    const today = new Date();
    switch (datePreset) {
      case 'this_month':
        return { startDate: format(startOfMonth(today), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'last_month':
        const lastMonth = subDays(startOfMonth(today), 1);
        return { startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd') };
      case 'last_90_days':
        return { startDate: format(subDays(today, 90), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'year_to_date':
        return { startDate: `${today.getFullYear()}-01-01`, endDate: format(today, 'yyyy-MM-dd') };
      case 'all_time':
        return {};
      case 'custom':
        return {
          startDate: customStartDate ? format(customStartDate, 'yyyy-MM-dd') : undefined,
          endDate: customEndDate ? format(customEndDate, 'yyyy-MM-dd') : undefined,
        };
      default:
        return {};
    }
  };

  const dateRange = getDateRange();
  const filters = {
    ...dateRange,
    seriesId: selectedSeriesId !== 'all' ? selectedSeriesId : undefined,
  };

  const { data: marginData, isLoading } = useMarginReport(filters);
  
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const MarginIndicator = ({ value }: { value: number }) => {
    const isPositive = value >= 0;
    const isHealthy = value >= 30;
    return (
      <div className={cn(
        'flex items-center gap-1',
        isPositive ? (isHealthy ? 'text-green-600' : 'text-amber-600') : 'text-red-600'
      )}>
        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {formatPercent(value)}
      </div>
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Margin Report"
        description="Cost vs quoted total analysis (Admin only)"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_90_days">Last 90 Days</SelectItem>
            <SelectItem value="year_to_date">Year to Date</SelectItem>
            <SelectItem value="all_time">All Time</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={customStartDate}
                  onSelect={setCustomStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={customEndDate}
                  onSelect={setCustomEndDate}
                  disabled={(date) => customStartDate ? date < customStartDate : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Series" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Series</SelectItem>
            {seriesList?.map((series) => (
              <SelectItem key={series.id} value={series.id}>
                {series.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !marginData ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No margin data available</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(marginData.totalRevenue)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Staff Cost</p>
                    <p className="text-2xl font-bold">{formatCurrency(marginData.totalCost)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className={marginData.totalMargin >= 0 ? 'border-green-500/30' : 'border-red-500/30'}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Margin</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      marginData.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatCurrency(marginData.totalMargin)}
                    </p>
                  </div>
                  <MarginIndicator value={marginData.marginPercent} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Events Analyzed</p>
                  <p className="text-2xl font-bold">{marginData.eventCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg margin: {formatCurrency(marginData.averageMarginPerEvent)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Events and Series */}
          <Tabs defaultValue="events">
            <TabsList>
              <TabsTrigger value="events">By Event</TabsTrigger>
              <TabsTrigger value="series">By Series</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Event Margins</CardTitle>
                  <CardDescription>Cost vs quoted total per event</CardDescription>
                </CardHeader>
                <CardContent>
                  {marginData.events.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No events with accepted quotes found
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Quoted</TableHead>
                          <TableHead className="text-right">Staff Cost</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Margin %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marginData.events.map((event) => (
                          <TableRow key={event.eventId}>
                            <TableCell className="font-medium">
                              {event.eventName}
                              {event.seriesName && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {event.seriesName}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(event.eventDate), 'MMM d, yyyy')}</TableCell>
                            <TableCell>{event.clientName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(event.quotedTotal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(event.staffCost)}</TableCell>
                            <TableCell className={cn(
                              'text-right font-medium',
                              event.margin >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                              {formatCurrency(event.margin)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginIndicator value={event.marginPercent} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="series" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Series Margins</CardTitle>
                  <CardDescription>Aggregated margins by event series</CardDescription>
                </CardHeader>
                <CardContent>
                  {marginData.series.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No series with completed events found
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Series</TableHead>
                          <TableHead className="text-right">Events</TableHead>
                          <TableHead className="text-right">Total Quoted</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">Total Margin</TableHead>
                          <TableHead className="text-right">Margin %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marginData.series.map((series) => (
                          <TableRow key={series.seriesId}>
                            <TableCell className="font-medium">{series.seriesName}</TableCell>
                            <TableCell className="text-right">{series.eventCount}</TableCell>
                            <TableCell className="text-right">{formatCurrency(series.totalQuoted)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(series.totalCost)}</TableCell>
                            <TableCell className={cn(
                              'text-right font-medium',
                              series.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                              {formatCurrency(series.totalMargin)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginIndicator value={series.marginPercent} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  );
}
