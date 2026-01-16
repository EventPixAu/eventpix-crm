import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  ArrowRight, 
  Award,
  Calendar, 
  CalendarRange,
  CheckCircle, 
  Clock, 
  DollarSign, 
  FileCheck, 
  MapPin,
  Package, 
  ShieldAlert, 
  TrendingUp, 
  Users, 
  XCircle 
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useExecutiveDashboard, DateRangePreset, DateRange } from '@/hooks/useExecutiveDashboard';
import { cn } from '@/lib/utils';

function StatTile({ 
  label, 
  value, 
  icon: Icon, 
  link,
  variant = 'default',
  subtext,
}: { 
  label: string; 
  value: number | string; 
  icon: React.ElementType;
  link?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  subtext?: string;
}) {
  const variantStyles = {
    default: 'bg-card border-border hover:border-primary/50',
    success: 'bg-green-500/10 border-green-500/30 hover:border-green-500/50',
    warning: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50',
    danger: 'bg-red-500/10 border-red-500/30 hover:border-red-500/50',
  };

  const iconStyles = {
    default: 'text-primary',
    success: 'text-green-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };

  const content = (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      variantStyles[variant],
      link && 'cursor-pointer'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <Icon className={cn('h-5 w-5', iconStyles[variant])} />
      </div>
      {link && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <span>View details</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

function RiskBadge({ level }: { level: 'green' | 'amber' | 'red' }) {
  const config = {
    green: { label: 'All Clear', icon: CheckCircle, className: 'bg-green-500/20 text-green-500 border-green-500/30' },
    amber: { label: 'Attention Needed', icon: AlertTriangle, className: 'bg-amber-500/20 text-amber-500 border-amber-500/30' },
    red: { label: 'Immediate Action', icon: XCircle, className: 'bg-red-500/20 text-red-500 border-red-500/30' },
  };

  const { label, icon: Icon, className } = config[level];

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', className)}>
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  last7days: 'Last 7 Days',
  last30days: 'Last 30 Days',
  last90days: 'Last 90 Days',
  custom: 'Custom Range',
};

export default function ExecutiveDashboard() {
  const { isAdmin, isExecutive } = useAuth();
  const [preset, setPreset] = useState<DateRangePreset>('last30days');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);
  
  const { data, isLoading, error } = useExecutiveDashboard({ preset, customRange });

  // Allow access for both Admin and Executive roles
  if (!isAdmin && !isExecutive) {
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <AppLayout>
        <PageHeader
          title="Executive Dashboard"
          description="Operational overview and risk visibility"
        />
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium">Failed to load dashboard data</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handlePresetChange = (value: DateRangePreset) => {
    setPreset(value);
    if (value !== 'custom') {
      setCustomRange(undefined);
    }
  };

  const handleFromDateSelect = (date: Date | undefined) => {
    if (date) {
      setCustomRange(prev => ({
        from: date,
        to: prev?.to || new Date(),
      }));
      setPreset('custom');
    }
    setIsFromOpen(false);
  };

  const handleToDateSelect = (date: Date | undefined) => {
    if (date) {
      setCustomRange(prev => ({
        from: prev?.from || new Date(),
        to: date,
      }));
      setPreset('custom');
    }
    setIsToOpen(false);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Executive Dashboard"
          description="Operational overview and risk visibility"
        />
        
        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => handlePresetChange(v as DateRangePreset)}>
            <SelectTrigger className="w-[160px]">
              <CalendarRange className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESET_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {preset === 'custom' && (
            <div className="flex items-center gap-1">
              <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-3">
                    <Calendar className="h-4 w-4 mr-2" />
                    {customRange?.from ? format(customRange.from, 'MMM d, yyyy') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={customRange?.from}
                    onSelect={handleFromDateSelect}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover open={isToOpen} onOpenChange={setIsToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-3">
                    <Calendar className="h-4 w-4 mr-2" />
                    {customRange?.to ? format(customRange.to, 'MMM d, yyyy') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={customRange?.to}
                    onSelect={handleToDateSelect}
                    disabled={(date) => customRange?.from ? date < customRange.from : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          {data?.dateRange && (
            <Badge variant="outline" className="hidden md:flex">
              {format(data.dateRange.from, 'MMM d')} - {format(data.dateRange.to, 'MMM d, yyyy')}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No dashboard data available for this period</p>
          <p className="text-sm text-muted-foreground mt-1">Try selecting a different date range</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Risk Summary Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
          >
            <div className="flex items-center gap-4">
              <ShieldAlert className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Overall Risk Status</p>
                <p className="text-sm text-muted-foreground">Based on delivery, compliance, and equipment status</p>
              </div>
            </div>
            <RiskBadge level={data.compliance.riskLevel} />
          </motion.div>

          {/* Today & This Week Snapshot */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Today & This Week</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatTile 
                label="Events Today" 
                value={data.snapshot.eventsToday} 
                icon={Calendar}
                link="/calendar/day"
              />
              <StatTile 
                label="Events This Week" 
                value={data.snapshot.eventsThisWeek} 
                icon={Calendar}
                link="/calendar"
              />
              <StatTile 
                label="Active Series" 
                value={data.snapshot.activeSeriesCount} 
                icon={FileCheck}
                link="/admin/series"
              />
              <StatTile 
                label="Photographers Today" 
                value={data.snapshot.photographersWorkingToday} 
                icon={Users}
                link="/staff"
              />
              <StatTile 
                label="Unassigned Roles" 
                value={data.snapshot.unassignedRolesToday} 
                icon={Users}
                variant={data.snapshot.unassignedRolesToday > 0 ? 'warning' : 'default'}
                link="/events?filter=unassigned"
              />
              <StatTile 
                label="Overrides Today" 
                value={data.snapshot.conflictsOrOverridesToday} 
                icon={AlertTriangle}
                variant={data.snapshot.conflictsOrOverridesToday > 0 ? 'warning' : 'default'}
              />
            </div>
          </section>

          {/* Main Dashboard Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Delivery & SLA Risk */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Delivery & SLA
                </CardTitle>
                <CardDescription>
                  {PRESET_LABELS[preset]} performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{data.delivery.onTimePercentage.toFixed(0)}%</p>
                    <p className="text-sm text-muted-foreground">On-time delivery rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {data.delivery.deliveredOnTime30Days} of {data.delivery.totalDelivered30Days} delivered on time
                    </p>
                  </div>
                </div>
                
                <Progress 
                  value={data.delivery.onTimePercentage} 
                  className="h-2"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    'p-3 rounded-lg border',
                    data.delivery.overdueEvents > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-secondary border-border'
                  )}>
                    <p className="text-2xl font-semibold">{data.delivery.overdueEvents}</p>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                  </div>
                  <div className={cn(
                    'p-3 rounded-lg border',
                    data.delivery.dueSoon48Hours > 3 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-secondary border-border'
                  )}>
                    <p className="text-2xl font-semibold">{data.delivery.dueSoon48Hours}</p>
                    <p className="text-sm text-muted-foreground">Due in 48hrs</p>
                  </div>
                </div>

                {isAdmin && (
                  <Link 
                    to="/delivery" 
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View delivery queue <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Staffing Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Staffing Health
                </CardTitle>
                <CardDescription>Load and quality metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-xl font-semibold">{data.staffing.avgEventsPerPhotographer7Days.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Avg events/photographer (7d)</p>
                  </div>
                  <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-xl font-semibold">{data.staffing.avgEventsPerPhotographer30Days.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Avg events/photographer (30d)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Heavy load instances (3+ events/day)</span>
                    <Badge variant={data.staffing.heavyLoadPhotographers > 0 ? 'destructive' : 'secondary'}>
                      {data.staffing.heavyLoadPhotographers}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Average staff rating</span>
                    <Badge variant="outline">{data.staffing.avgStaffRating.toFixed(1)} / 5</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Low rating events (≤2)</span>
                    <Badge variant={data.staffing.lowRatingEventCount > 0 ? 'destructive' : 'secondary'}>
                      {data.staffing.lowRatingEventCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">New staff (last 30 days)</span>
                    <Badge variant="secondary">{data.staffing.newStaffCount}</Badge>
                  </div>
                </div>

                {isAdmin && (
                  <Link 
                    to="/staff" 
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View staff directory <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Cost & Margin - Admin Only (Executives cannot see cost data) */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Cost Overview
                  </CardTitle>
                  <CardDescription>Staffing costs and outliers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-secondary rounded-lg">
                      <p className="text-xl font-semibold">${data.costs.costToday.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg">
                      <p className="text-xl font-semibold">${data.costs.costThisWeek.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">This Week</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg">
                      <p className="text-xl font-semibold">${data.costs.avgCostPerEvent.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Avg/Event</p>
                    </div>
                  </div>

                  {data.costs.eventsExceedingThreshold > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">{data.costs.eventsExceedingThreshold} events exceeding cost threshold</span>
                      </div>
                    </div>
                  )}

                  {data.costs.costBySeries.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Top Series by Cost</p>
                      {data.costs.costBySeries.slice(0, 3).map((series) => (
                        <Link 
                          key={series.seriesId} 
                          to={`/admin/series/${series.seriesId}`}
                          className="flex items-center justify-between p-2 bg-secondary/50 rounded hover:bg-secondary transition-colors"
                        >
                          <span className="text-sm truncate">{series.seriesName}</span>
                          <span className="text-sm font-medium">${series.cost.toLocaleString()}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Compliance & Risk */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Compliance & Equipment
                </CardTitle>
                <CardDescription>Document expiry and equipment status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    'p-3 rounded-lg border',
                    data.compliance.expiringIn7Days > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-secondary border-border'
                  )}>
                    <p className="text-xl font-semibold">{data.compliance.expiringIn7Days}</p>
                    <p className="text-sm text-muted-foreground">Expiring in 7 days</p>
                  </div>
                  <div className={cn(
                    'p-3 rounded-lg border',
                    data.compliance.expiringIn30Days > 2 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-secondary border-border'
                  )}>
                    <p className="text-xl font-semibold">{data.compliance.expiringIn30Days}</p>
                    <p className="text-sm text-muted-foreground">Expiring in 30 days</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Events with overrides</span>
                    <Badge variant={data.compliance.eventsWithOverrides > 0 ? 'outline' : 'secondary'}>
                      {data.compliance.eventsWithOverrides}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Missing equipment</span>
                    <Badge variant={data.compliance.missingEquipment > 0 ? 'destructive' : 'secondary'}>
                      {data.compliance.missingEquipment}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Damaged equipment</span>
                    <Badge variant={data.compliance.damagedEquipment > 0 ? 'destructive' : 'secondary'}>
                      {data.compliance.damagedEquipment}
                    </Badge>
                  </div>
                </div>

                {/* Navigation links - Admin only */}
                {isAdmin && (
                  <div className="flex gap-2">
                    <Link 
                      to="/staff?tab=compliance" 
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Staff Compliance <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link 
                      to="/equipment" 
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Equipment <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Local Business Awards Spotlight */}
          {data.localBusinessAwards && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Local Business Awards Spotlight
              </h2>
              <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {data.localBusinessAwards.found 
                          ? data.localBusinessAwards.seriesName 
                          : 'Local Business Awards'}
                      </CardTitle>
                      <CardDescription>National program rollup</CardDescription>
                    </div>
                    {data.localBusinessAwards.found && isAdmin && (
                      <Link 
                        to={`/admin/series/${data.localBusinessAwards.seriesId}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        View Series <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!data.localBusinessAwards.found ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No "Local Business Awards" series found</p>
                      <p className="text-xs mt-1">Create a series with this name to enable spotlight tracking</p>
                    </div>
                  ) : (
                    <>
                      {/* National Summary */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-secondary rounded-lg text-center">
                          <p className="text-2xl font-bold">{data.localBusinessAwards.totalEvents}</p>
                          <p className="text-xs text-muted-foreground">Total Events</p>
                        </div>
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-500">{data.localBusinessAwards.deliveredEvents}</p>
                          <p className="text-xs text-muted-foreground">Delivered</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-500">{data.localBusinessAwards.pendingEvents}</p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                        <div className={cn(
                          'p-3 rounded-lg text-center border',
                          data.localBusinessAwards.overdueEvents > 0 
                            ? 'bg-red-500/10 border-red-500/20' 
                            : 'bg-secondary border-border'
                        )}>
                          <p className={cn(
                            'text-2xl font-bold',
                            data.localBusinessAwards.overdueEvents > 0 ? 'text-red-500' : ''
                          )}>
                            {data.localBusinessAwards.overdueEvents}
                          </p>
                          <p className="text-xs text-muted-foreground">Overdue</p>
                        </div>
                      </div>

                      {/* SLA Status */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Delivery SLA Status</span>
                            <span className={cn(
                              'text-sm font-bold',
                              data.localBusinessAwards.slaPercentage >= 95 ? 'text-green-500' :
                              data.localBusinessAwards.slaPercentage >= 80 ? 'text-amber-500' : 'text-red-500'
                            )}>
                              {data.localBusinessAwards.slaPercentage.toFixed(0)}%
                            </span>
                          </div>
                          <Progress 
                            value={data.localBusinessAwards.slaPercentage} 
                            className="h-2"
                          />
                        </div>
                        <Badge 
                          variant={data.localBusinessAwards.overdueEvents === 0 ? 'default' : 'destructive'}
                          className={data.localBusinessAwards.overdueEvents === 0 ? 'bg-green-500' : ''}
                        >
                          {data.localBusinessAwards.overdueEvents === 0 ? 'On Track' : 'At Risk'}
                        </Badge>
                      </div>

                      {/* City Breakdown */}
                      {data.localBusinessAwards.cityBreakdown.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            City-by-City Breakdown
                          </p>
                          <div className="grid gap-2 max-h-48 overflow-y-auto">
                            {data.localBusinessAwards.cityBreakdown.map((city, idx) => (
                              <div 
                                key={`${city.city}-${city.state}-${idx}`}
                                className={cn(
                                  'flex items-center justify-between p-2 rounded-lg border',
                                  city.slaOnTrack ? 'bg-secondary/50 border-border' : 'bg-red-500/10 border-red-500/20'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {city.slaOnTrack ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="font-medium text-sm">
                                    {city.city}{city.state ? `, ${city.state}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-muted-foreground">{city.totalEvents} events</span>
                                  <Badge variant="outline" className="text-green-500 border-green-500/30">
                                    {city.deliveredEvents} delivered
                                  </Badge>
                                  {city.overdueEvents > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                      {city.overdueEvents} overdue
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Series Performance Table */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Series Performance</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 font-medium text-muted-foreground">Series</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Events</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Delivered</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Staffing</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Avg Delivery</th>
                        {isAdmin && <th className="text-center p-4 font-medium text-muted-foreground">Avg Cost</th>}
                        <th className="text-center p-4 font-medium text-muted-foreground">Overrides</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.seriesPerformance.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-muted-foreground">
                            No active series data available
                          </td>
                        </tr>
                      ) : (
                        data.seriesPerformance.map((series) => (
                          <tr key={series.seriesId} className="border-b border-border last:border-0 hover:bg-muted/50">
                            <td className="p-4">
                              {isAdmin ? (
                                <Link 
                                  to={`/admin/series/${series.seriesId}`}
                                  className="font-medium hover:text-primary transition-colors"
                                >
                                  {series.seriesName}
                                </Link>
                              ) : (
                                <span className="font-medium">{series.seriesName}</span>
                              )}
                            </td>
                            <td className="text-center p-4">{series.totalEvents}</td>
                            <td className="text-center p-4">
                              <span className="text-green-500">{series.deliveredEvents}</span>
                              {' / '}
                              <span className="text-muted-foreground">{series.pendingEvents} pending</span>
                            </td>
                            <td className="text-center p-4">
                              <div className="flex items-center justify-center gap-2">
                                <Progress 
                                  value={series.staffingCompleteness} 
                                  className="w-16 h-2"
                                />
                                <span className="text-sm">{series.staffingCompleteness.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="text-center p-4">
                              {series.avgDeliveryTimeDays > 0 ? `${series.avgDeliveryTimeDays.toFixed(0)}d` : '—'}
                            </td>
                            {isAdmin && (
                              <td className="text-center p-4">
                                ${series.avgCostPerEvent.toFixed(0)}
                              </td>
                            )}
                            <td className="text-center p-4">
                              <Badge variant={series.overrideCount > 0 ? 'outline' : 'secondary'}>
                                {series.overrideCount}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </AppLayout>
  );
}
