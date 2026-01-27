import { useState, useEffect } from 'react';
import { ListChecks, Loader2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAllWorkflowTemplates, useAllTemplateItems } from '@/hooks/useWorkflowTemplates';
import { useInitializeWorkflowStepsSelective } from '@/hooks/useEventWorkflowSteps';
import { cn } from '@/lib/utils';

interface InitializeWorkflowDialogProps {
  eventId: string;
  currentTemplateId?: string | null;
  trigger?: React.ReactNode;
}

export function InitializeWorkflowDialog({
  eventId,
  currentTemplateId,
  trigger,
}: InitializeWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(currentTemplateId || '');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showItems, setShowItems] = useState(false);
  
  const { data: templates = [], isLoading: templatesLoading } = useAllWorkflowTemplates('operations');
  const { data: templateItems = [], isLoading: itemsLoading } = useAllTemplateItems(
    selectedTemplateId || undefined
  );
  const initializeSteps = useInitializeWorkflowStepsSelective();
  
  const activeTemplates = templates.filter(t => t.is_active);
  const activeItems = templateItems.filter(i => i.is_active !== false);
  
  // Reset selections when template changes
  useEffect(() => {
    if (selectedTemplateId && activeItems.length > 0) {
      // Select all items by default
      setSelectedItemIds(new Set(activeItems.map(i => i.id)));
      setShowItems(true);
    } else {
      setSelectedItemIds(new Set());
      setShowItems(false);
    }
  }, [selectedTemplateId, activeItems.length]);
  
  const handleItemToggle = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  
  const handleSelectAll = () => {
    setSelectedItemIds(new Set(activeItems.map(i => i.id)));
  };
  
  const handleSelectNone = () => {
    setSelectedItemIds(new Set());
  };
  
  const handleInitialize = async () => {
    if (!selectedTemplateId || selectedItemIds.size === 0) return;
    
    await initializeSteps.mutateAsync({
      eventId,
      templateId: selectedTemplateId,
      selectedItemIds: Array.from(selectedItemIds),
    });
    
    setOpen(false);
  };
  
  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'pre_event': return 'Pre-Event';
      case 'day_of': return 'Day Of';
      case 'post_event': return 'Post-Event';
      default: return phase;
    }
  };
  
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'pre_event': return 'bg-info/10 text-info';
      case 'day_of': return 'bg-warning/10 text-warning';
      case 'post_event': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ListChecks className="h-4 w-4 mr-2" />
            {currentTemplateId ? 'Change Workflow' : 'Assign Workflow'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {currentTemplateId ? 'Change Workflow Template' : 'Assign Workflow Template'}
          </DialogTitle>
          <DialogDescription>
            {currentTemplateId 
              ? 'This will reset all workflow steps. Completed steps will be lost.'
              : 'Select a workflow template and choose which items apply to this job.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Workflow Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={templatesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span>{template.template_name}</span>
                      <Badge variant="secondary" className={cn('text-xs', getPhaseColor(template.phase))}>
                        {getPhaseLabel(template.phase)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedTemplateId && (
            <Collapsible open={showItems} onOpenChange={setShowItems}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-0 hover:bg-transparent">
                    {showItems ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="font-medium">
                      Workflow Items ({selectedItemIds.size}/{activeItems.length} selected)
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-7"
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectNone}
                    className="text-xs h-7"
                  >
                    None
                  </Button>
                </div>
              </div>
              
              <CollapsibleContent>
                {itemsLoading ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    Loading items...
                  </div>
                ) : activeItems.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No active items in this template
                  </div>
                ) : (
                  <ScrollArea className="h-[250px] mt-2 border rounded-lg">
                    <div className="p-3 space-y-1">
                      {activeItems.map((item) => (
                        <label
                          key={item.id}
                          className={cn(
                            'flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors',
                            selectedItemIds.has(item.id)
                              ? 'bg-primary/5 hover:bg-primary/10'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <Checkbox
                            checked={selectedItemIds.has(item.id)}
                            onCheckedChange={() => handleItemToggle(item.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-sm font-medium',
                              !selectedItemIds.has(item.id) && 'text-muted-foreground'
                            )}>
                              {item.label}
                            </p>
                            {item.help_text && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {item.help_text}
                              </p>
                            )}
                            {item.date_offset_days !== null && item.date_offset_reference && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {item.date_offset_days > 0 ? '+' : ''}{item.date_offset_days}d from {item.date_offset_reference.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {currentTemplateId && (
            <p className="text-sm text-warning bg-warning/10 p-3 rounded-lg">
              ⚠️ Changing the workflow will delete all existing workflow steps for this job.
            </p>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleInitialize}
            disabled={!selectedTemplateId || selectedItemIds.size === 0 || initializeSteps.isPending}
          >
            {initializeSteps.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {currentTemplateId ? 'Reset & Apply' : 'Assign Workflow'}
            {selectedItemIds.size > 0 && ` (${selectedItemIds.size} items)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
