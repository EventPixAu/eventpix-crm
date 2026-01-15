import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { useEventCostSummary } from '@/hooks/useEventCosts';
import { Skeleton } from '@/components/ui/skeleton';

interface EventCostSummaryProps {
  eventId: string;
}

export function EventCostSummary({ eventId }: EventCostSummaryProps) {
  const { data: costSummary, isLoading } = useEventCostSummary(eventId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Staffing Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!costSummary) {
    return null;
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return `$${amount.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Staffing Costs
          {costSummary.exceedsThreshold && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Exceeds Threshold
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">Total Estimated Cost</span>
          <span className="text-lg font-bold">{formatCurrency(costSummary.totalEstimatedCost)}</span>
        </div>

        {costSummary.costThreshold && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Cost Threshold</span>
            <span>{formatCurrency(costSummary.costThreshold)}</span>
          </div>
        )}

        {costSummary.assignmentCosts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costSummary.assignmentCosts.map((ac) => (
                <TableRow key={ac.assignmentId}>
                  <TableCell className="font-medium">{ac.staffName}</TableCell>
                  <TableCell>{ac.roleName || '—'}</TableCell>
                  <TableCell>
                    {ac.rateType ? (
                      <span className="capitalize">{ac.rateType.replace('_', ' ')}</span>
                    ) : (
                      <span className="text-muted-foreground">No rate</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {ac.estimatedCost !== null ? (
                      formatCurrency(ac.estimatedCost)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No staff assigned yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
