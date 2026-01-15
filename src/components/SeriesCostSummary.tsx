import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSeriesCostSummary } from '@/hooks/useEventCosts';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

interface SeriesCostSummaryProps {
  seriesId: string;
  eventIds: string[];
}

export function SeriesCostSummary({ seriesId, eventIds }: SeriesCostSummaryProps) {
  const { data: costSummary, isLoading } = useSeriesCostSummary(seriesId, eventIds);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Series Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!costSummary || costSummary.eventCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Series Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No cost data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(0)}`;

  // Calculate trend
  const trendData = costSummary.costTrend;
  let trendDirection: 'up' | 'down' | 'flat' = 'flat';
  if (trendData.length >= 2) {
    const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
    const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
    const firstAvg = firstHalf.reduce((s, t) => s + t.cost, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, t) => s + t.cost, 0) / secondHalf.length;
    if (secondAvg > firstAvg * 1.1) trendDirection = 'up';
    else if (secondAvg < firstAvg * 0.9) trendDirection = 'down';
  }

  const chartData = trendData.map((t) => ({
    name: format(parseISO(t.date), 'MMM d'),
    cost: t.cost,
    fullName: t.eventName,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Series Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{formatCurrency(costSummary.totalCost)}</div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{formatCurrency(costSummary.averageCostPerEvent)}</div>
            <div className="text-xs text-muted-foreground">Avg per Event</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg flex flex-col items-center justify-center">
            <div className="flex items-center gap-1">
              {trendDirection === 'up' && <TrendingUp className="h-5 w-5 text-destructive" />}
              {trendDirection === 'down' && <TrendingDown className="h-5 w-5 text-green-500" />}
              {trendDirection === 'flat' && <Minus className="h-5 w-5 text-muted-foreground" />}
              <span className="text-lg font-semibold capitalize">{trendDirection}</span>
            </div>
            <div className="text-xs text-muted-foreground">Cost Trend</div>
          </div>
        </div>

        {chartData.length > 1 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={40} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName || ''}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(var(--primary))"
                  fill="url(#costGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
