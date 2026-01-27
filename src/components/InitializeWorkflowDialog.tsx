import { useState, useEffect, useMemo } from 'react';
import { ListChecks, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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
import { useAllWorkflowTemplates } from '@/hooks/useWorkflowTemplates';
import { useInitializeWorkflowStepsMultiTemplate } from '@/hooks/useEventWorkflowSteps';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface InitializeWorkflowDialogProps {
  eventId: string;
  currentTemplateId?: string | null;
  trigger?: React.ReactNode;
}

interface TemplateItemWithTemplate {
  id: string;
  template_id: string;
  template_name: string;
  label: string;
  help_text: string | null;
  sort_order: number;
  date_offset_days: number | null;
  date_offset_reference: string | null;
  phase: string;
}

const ALL_OPERATIONS = '__all_operations__';

export function InitializeWorkflowDialog({
  eventId,
  currentTemplateId,
  trigger,
}: InitializeWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(currentTemplateId || ALL_OPERATIONS);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showItems, setShowItems] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  
  const { data: templates = [], isLoading: templatesLoading } = useAllWorkflowTemplates('operations');
  const initializeSteps = useInitializeWorkflowStepsMultiTemplate();
  
  const activeTemplates = templates.filter(t => t.is_active);
  
  // Fetch all items from all active operations templates
  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['all-operations-template-items', activeTemplates.map(t => t.id)],
    queryFn: async () => {
      if (activeTemplates.length === 0) return [];
      
      const { data, error } = await supabase
        .from('workflow_template_items')
        .select(`
          id,
          template_id,
          label,
          help_text,
          sort_order,
          date_offset_days,
          date_offset_reference,
          is_active,
          workflow_templates!inner(template_name, phase)
        `)
        .in('template_id', activeTemplates.map(t => t.id))
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        template_id: item.template_id,
        template_name: (item.workflow_templates as any)?.template_name || '',
        label: item.label,
        help_text: item.help_text,
        sort_order: item.sort_order,
        date_offset_days: item.date_offset_days,
        date_offset_reference: item.date_offset_reference,
        phase: (item.workflow_templates as any)?.phase || 'pre_event',
      })) as TemplateItemWithTemplate[];
    },
    enabled: open && activeTemplates.length > 0,
  });
  
  // Filter items based on selected template
  const displayedItems = useMemo(() => {
    if (selectedTemplateId === ALL_OPERATIONS) {
      return allItems;
    }
    return allItems.filter(item => item.template_id === selectedTemplateId);
  }, [allItems, selectedTemplateId]);
  
  // Group items by template for display
  const itemsByTemplate = useMemo(() => {
    const grouped = new Map<string, TemplateItemWithTemplate[]>();
    displayedItems.forEach(item => {
      const existing = grouped.get(item.template_id) || [];
      existing.push(item);
      grouped.set(item.template_id, existing);
    });
    return grouped;
  }, [displayedItems]);
  
  // Reset selections when template changes
  useEffect(() => {
    if (selectedTemplateId && displayedItems.length > 0) {
      setSelectedItemIds(new Set(displayedItems.map(i => i.id)));
      setShowItems(true);
      // Expand all templates by default
      setExpandedTemplates(new Set(itemsByTemplate.keys()));
    } else {
      setSelectedItemIds(new Set());
      setShowItems(false);
    }
  }, [selectedTemplateId, displayedItems.length]);
  
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
    setSelectedItemIds(new Set(displayedItems.map(i => i.id)));
  };
  
  const handleSelectNone = () => {
    setSelectedItemIds(new Set());
  };
  
  const toggleTemplateExpanded = (templateId: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };
  
  const toggleTemplateItems = (templateId: string, select: boolean) => {
    const templateItems = itemsByTemplate.get(templateId) || [];
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      templateItems.forEach(item => {
        if (select) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };
  
  const handleInitialize = async () => {
    if (selectedItemIds.size === 0) return;
    
    await initializeSteps.mutateAsync({
      eventId,
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
  
  const getSelectedCountForTemplate = (templateId: string) => {
    const templateItems = itemsByTemplate.get(templateId) || [];
    return templateItems.filter(item => selectedItemIds.has(item.id)).length;
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {currentTemplateId ? 'Change Workflow Steps' : 'Assign Workflow Steps'}
          </DialogTitle>
          <DialogDescription>
            Select which workflow steps apply to this job. You can pick from all operations templates or a specific one.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label>Workflow Source</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={templatesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPERATIONS}>
                  <span className="font-medium">All Operations Workflows</span>
                </SelectItem>
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
            <Collapsible open={showItems} onOpenChange={setShowItems} className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-0 hover:bg-transparent">
                    {showItems ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="font-medium">
                      Workflow Items ({selectedItemIds.size}/{displayedItems.length} selected)
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
              
              <CollapsibleContent className="flex-1 min-h-0">
                {itemsLoading ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    Loading items...
                  </div>
                ) : displayedItems.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No active items found
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] mt-2 border rounded-lg">
                    <div className="p-3 space-y-4">
                      {Array.from(itemsByTemplate.entries()).map(([templateId, items]) => {
                        const template = activeTemplates.find(t => t.id === templateId);
                        const selectedCount = getSelectedCountForTemplate(templateId);
                        const allSelected = selectedCount === items.length;
                        const noneSelected = selectedCount === 0;
                        
                        return (
                          <div key={templateId} className="space-y-1">
                            {selectedTemplateId === ALL_OPERATIONS && (
                              <div className="flex items-center justify-between sticky top-0 bg-background py-1 border-b">
                                <button
                                  type="button"
                                  onClick={() => toggleTemplateExpanded(templateId)}
                                  className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                                >
                                  {expandedTemplates.has(templateId) ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                  {template?.template_name}
                                  <Badge variant="secondary" className={cn('text-xs', getPhaseColor(template?.phase || ''))}>
                                    {getPhaseLabel(template?.phase || '')}
                                  </Badge>
                                  <span className="text-muted-foreground font-normal">
                                    ({selectedCount}/{items.length})
                                  </span>
                                </button>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTemplateItems(templateId, true)}
                                    disabled={allSelected}
                                    className="text-xs h-6 px-2"
                                  >
                                    All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTemplateItems(templateId, false)}
                                    disabled={noneSelected}
                                    className="text-xs h-6 px-2"
                                  >
                                    None
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {(selectedTemplateId !== ALL_OPERATIONS || expandedTemplates.has(templateId)) && (
                              <div className="space-y-1 pl-1">
                                {items.map((item) => (
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {currentTemplateId && (
            <p className="text-sm text-warning bg-warning/10 p-3 rounded-lg">
              ⚠️ This will replace all existing workflow steps for this job.
            </p>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleInitialize}
            disabled={selectedItemIds.size === 0 || initializeSteps.isPending}
          >
            {initializeSteps.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {currentTemplateId ? 'Replace Steps' : 'Add Steps'}
            {selectedItemIds.size > 0 && ` (${selectedItemIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}