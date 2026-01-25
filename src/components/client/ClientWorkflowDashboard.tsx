/**
 * CLIENT WORKFLOW DASHBOARD
 * 
 * Combined view of Sales and Operations workflow progress
 * for a client across all their leads and events.
 */
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  TrendingUp, 
  Briefcase, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useClientWorkflowProgress,
  type WorkflowProgressItem,
} from '@/hooks/useClientWorkflowProgress';
import { cn } from '@/lib/utils';

interface ClientWorkflowDashboardProps {
  clientId: string;
}

function ProgressRing({ percentage, size = 48 }: { percentage: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-muted stroke-current"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn(
            "stroke-current transition-all duration-300",
            percentage === 100 ? "text-success" : "text-primary"
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium">{percentage}%</span>
      </div>
    </div>
  );
}

function WorkflowItemRow({ item }: { item: WorkflowProgressItem }) {
  const link = item.entityType === 'lead' 
    ? `/sales/leads/${item.entityId}` 
    : `/events/${item.entityId}`;

  return (
    <Link
      to={link}
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <ProgressRing percentage={item.percentage} size={40} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.entityName}</span>
          {item.overdueSteps > 0 && (
            <Badge variant="destructive" className="text-xs h-5">
              {item.overdueSteps} overdue
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {item.entityType === 'lead' ? (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Lead
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Event
            </span>
          )}
          {item.entityDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(parseISO(item.entityDate), 'MMM d, yyyy')}
            </span>
          )}
          {item.hasWorkflow && (
            <span className="truncate">{item.templateName}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!item.hasWorkflow ? (
          <Badge variant="outline" className="text-xs">No workflow</Badge>
        ) : item.percentage === 100 ? (
          <Badge className="bg-success text-success-foreground text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {item.completedSteps}/{item.totalSteps} steps
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function DomainProgressCard({ 
  title, 
  icon: Icon,
  items,
  progress,
  emptyMessage,
}: { 
  title: string;
  icon: React.ElementType;
  items: WorkflowProgressItem[];
  progress: { total: number; completed: number; percentage: number };
  emptyMessage: string;
}) {
  const overdueCount = items.reduce((sum, i) => sum + i.overdueSteps, 0);
  const noWorkflowCount = items.filter(i => !i.hasWorkflow).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                {overdueCount} overdue
              </Badge>
            )}
            {noWorkflowCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {noWorkflowCount} without workflow
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Summary */}
        {progress.total > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {progress.completed}/{progress.total} steps ({progress.percentage}%)
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        )}

        {/* Items List */}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <WorkflowItemRow key={`${item.entityType}-${item.entityId}`} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientWorkflowDashboard({ clientId }: ClientWorkflowDashboardProps) {
  const { data, isLoading } = useClientWorkflowProgress(clientId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { 
    salesWorkflows, 
    operationsWorkflows, 
    salesProgress, 
    operationsProgress,
    overallProgress,
  } = data;

  const hasAnyWorkflows = salesWorkflows.length > 0 || operationsWorkflows.length > 0;

  if (!hasAnyWorkflows) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Workflow Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No leads or events with workflows for this client
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Workflow Progress</CardTitle>
          </div>
          {overallProgress.total > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Overall: {overallProgress.percentage}%
              </span>
              <ProgressRing percentage={overallProgress.percentage} size={36} />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">
              All ({salesWorkflows.length + operationsWorkflows.length})
            </TabsTrigger>
            <TabsTrigger value="sales">
              Sales ({salesWorkflows.length})
            </TabsTrigger>
            <TabsTrigger value="operations">
              Operations ({operationsWorkflows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {salesWorkflows.length > 0 && (
              <DomainProgressCard
                title="Sales"
                icon={Briefcase}
                items={salesWorkflows}
                progress={salesProgress}
                emptyMessage="No sales workflows"
              />
            )}
            {operationsWorkflows.length > 0 && (
              <DomainProgressCard
                title="Operations"
                icon={Calendar}
                items={operationsWorkflows}
                progress={operationsProgress}
                emptyMessage="No operations workflows"
              />
            )}
          </TabsContent>

          <TabsContent value="sales">
            <DomainProgressCard
              title="Sales Workflows"
              icon={Briefcase}
              items={salesWorkflows}
              progress={salesProgress}
              emptyMessage="No active leads for this client"
            />
          </TabsContent>

          <TabsContent value="operations">
            <DomainProgressCard
              title="Operations Workflows"
              icon={Calendar}
              items={operationsWorkflows}
              progress={operationsProgress}
              emptyMessage="No active events for this client"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
