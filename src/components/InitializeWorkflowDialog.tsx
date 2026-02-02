import { useState, useEffect, useMemo } from 'react';
import { ListChecks, Loader2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
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
import { useInitializeWorkflowStepsSelective } from '@/hooks/useEventWorkflowSteps';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Phase configuration for display
const PHASE_CONFIG = {
  pre_event: { label: 'Pre-Event', color: 'text-info' },
  day_of: { label: 'Day Of', color: 'text-warning' },
  post_event: { label: 'Post-Event', color: 'text-success' },
} as const;

interface InitializeWorkflowDialogProps {
  eventId: string;
  currentTemplateId?: string | null;
  currentEventTypeId?: string | null;
  trigger?: React.ReactNode;
}

interface TemplateItem {
  id: string;
  template_id: string;
  label: string;
  help_text: string | null;
  sort_order: number;
  is_active: boolean;
  date_offset_days: number | null;
  date_offset_reference: string | null;
  completion_type?: string;
  auto_trigger_event?: string | null;
}

// Hook to fetch all items for a template
function useTemplateItems(templateId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-template-items', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('workflow_template_items')
        .select('*')
        .eq('template_id', templateId)
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as TemplateItem[];
    },
    enabled: !!templateId,
  });
}

export function InitializeWorkflowDialog({
  eventId,
  currentTemplateId,
  trigger,
}: InitializeWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showItems, setShowItems] = useState(false);
  
  // Fetch operations workflow templates
  const { data: templates = [], isLoading: templatesLoading } = useAllWorkflowTemplates('operations');
  
  // Fetch items for the selected template
  const { data: templateItems = [], isLoading: itemsLoading } = useTemplateItems(selectedTemplateId);
  
  const initializeSteps = useInitializeWorkflowStepsSelective();
  
  // Filter to active templates only
  const activeTemplates = useMemo(() => {
    return templates.filter(t => t.is_active);
  }, [templates]);
  
  // Group items by phase (from the parent template)
  const itemsByPhase = useMemo(() => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) return new Map<string, TemplateItem[]>();
    
    // All items in a template belong to the template's phase
    const grouped = new Map<string, TemplateItem[]>();
    grouped.set(selectedTemplate.phase, templateItems);
    return grouped;
  }, [selectedTemplateId, templates, templateItems]);
  
  // Get item count for each template
  const getItemCount = async (templateId: string) => {
    const { count } = await supabase
      .from('workflow_template_items')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', templateId)
      .eq('is_active', true);
    return count || 0;
  };
  
  // Reset selections when template changes
  useEffect(() => {
    if (selectedTemplateId && templateItems.length > 0) {
      setSelectedItemIds(new Set(templateItems.map(item => item.id)));
      setShowItems(true);
    } else {
      setSelectedItemIds(new Set());
      setShowItems(false);
    }
  }, [selectedTemplateId, templateItems]);
  
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
    setSelectedItemIds(new Set(templateItems.map(item => item.id)));
  };
  
  const handleSelectNone = () => {
    setSelectedItemIds(new Set());
  };
  
  const handleInitialize = async () => {
    if (selectedItemIds.size === 0 || !selectedTemplateId) return;
    
    await initializeSteps.mutateAsync({
      eventId,
      templateId: selectedTemplateId,
      selectedItemIds: Array.from(selectedItemIds),
    });
    
    setOpen(false);
  };
  
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const isLoading = templatesLoading || itemsLoading;
  
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
            Select a workflow template to apply its steps to this job.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label>Workflow Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={templatesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a workflow..." />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{template.template_name}</span>
                      <span>
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                        >
                          {PHASE_CONFIG[template.phase as keyof typeof PHASE_CONFIG]?.label || template.phase}
                        </Badge>
                      </span>
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
                      Workflow Steps ({selectedItemIds.size}/{templateItems.length} selected)
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
                {isLoading ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    Loading steps...
                  </div>
                ) : templateItems.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No active steps in this template
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] mt-2 border rounded-lg">
                    <div className="p-3 space-y-1">
                      {selectedTemplate && (
                        <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                          <span className={cn(
                            'text-sm font-medium',
                            PHASE_CONFIG[selectedTemplate.phase as keyof typeof PHASE_CONFIG]?.color || ''
                          )}>
                            {PHASE_CONFIG[selectedTemplate.phase as keyof typeof PHASE_CONFIG]?.label || selectedTemplate.phase}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            ({selectedItemIds.size}/{templateItems.length})
                          </span>
                        </div>
                      )}
                      
                      {templateItems.map((item) => (
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
            disabled={selectedItemIds.size === 0 || !selectedTemplateId || initializeSteps.isPending}
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
