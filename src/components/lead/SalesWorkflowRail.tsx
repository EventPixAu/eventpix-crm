/**
 * SALES WORKFLOW RAIL
 * 
 * Displays the Sales Workflow checklist for a Lead.
 * Shows workflow items from lead_workflow_items table with checkboxes.
 * Allows marking steps as complete.
 */
import { format } from 'date-fns';
import { Check, Clock, Plus, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useLeadWorkflowItems,
  useToggleWorkflowItem,
  LeadWorkflowItem,
} from '@/hooks/useSalesWorkflow';
import { useLeadSalesWorkflowInstance } from '@/hooks/useLeadSalesWorkflow';

interface SalesWorkflowRailProps {
  leadId: string;
  onInitializeWorkflow?: () => void;
}

function WorkflowItemRow({
  item,
  leadId,
}: {
  item: LeadWorkflowItem;
  leadId: string;
}) {
  const toggleItem = useToggleWorkflowItem();
  
  const handleToggle = (checked: boolean) => {
    toggleItem.mutate({
      id: item.id,
      leadId,
      is_done: checked,
    });
  };

  return (
    <div className={`flex items-start gap-3 py-3 px-3 rounded-lg transition-colors ${
      item.is_done ? 'bg-muted/30' : 'hover:bg-muted/50'
    }`}>
      {/* Checkbox */}
      <div className="mt-0.5">
        <Checkbox
          checked={item.is_done}
          onCheckedChange={handleToggle}
          disabled={toggleItem.isPending}
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${
          item.is_done ? 'text-muted-foreground line-through' : ''
        }`}>
          {item.title}
        </div>
        
        {/* Completed info */}
        {item.is_done && item.done_at && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs bg-muted">
              <Check className="h-3 w-3 mr-1" />
              {format(new Date(item.done_at), 'd MMM yyyy')}
            </Badge>
            {item.done_by_profile?.full_name && (
              <span className="text-xs text-muted-foreground">
                by {item.done_by_profile.full_name}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Loading indicator */}
      {toggleItem.isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export function SalesWorkflowRail({ 
  leadId, 
  onInitializeWorkflow,
}: SalesWorkflowRailProps) {
  const { data: workflowInstance, isLoading: isInstanceLoading, refetch } = useLeadSalesWorkflowInstance(leadId);
  const { data: workflowItems = [], isLoading: isItemsLoading } = useLeadWorkflowItems(leadId);
  
  const isLoading = isInstanceLoading || isItemsLoading;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }
  
  // No workflow assigned yet
  if (!workflowInstance) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
          <Button 
            variant="default" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600"
            onClick={onInitializeWorkflow}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">No workflow assigned yet</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onInitializeWorkflow}
          >
            <Settings className="h-4 w-4 mr-2" />
            Initialize Workflow
          </Button>
        </div>
      </div>
    );
  }
  
  // Calculate progress
  const totalItems = workflowItems.length;
  const completedItems = workflowItems.filter(item => item.is_done).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
          <p className="text-sm text-muted-foreground">
            {workflowInstance.workflow_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            title="Refresh workflow"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onInitializeWorkflow}
            title="Replace workflow"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <div className="text-right">
            <div className="text-2xl font-bold">{progressPercent}%</div>
            <p className="text-xs text-muted-foreground">
              {completedItems}/{totalItems}
            </p>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      {/* Workflow items list */}
      {workflowItems.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            No workflow steps defined
          </p>
          {onInitializeWorkflow && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onInitializeWorkflow}
            >
              <Settings className="h-4 w-4 mr-2" />
              Initialize Workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {workflowItems.map((item) => (
            <WorkflowItemRow 
              key={item.id} 
              item={item} 
              leadId={leadId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
