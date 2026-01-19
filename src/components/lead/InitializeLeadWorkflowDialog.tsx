/**
 * INITIALIZE LEAD WORKFLOW DIALOG
 * 
 * Allows user to select a workflow template and initialize it for a Lead.
 */
import { useState } from 'react';
import { Settings, Check, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkflowTemplatesForEntity, useInitializeWorkflow } from '@/hooks/useWorkflowInstances';

interface InitializeLeadWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'lead' | 'job';
  entityId: string;
  mainShootAt?: string | null;
  onSuccess?: () => void;
}

export function InitializeLeadWorkflowDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  mainShootAt,
  onSuccess,
}: InitializeLeadWorkflowDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const { data: templates = [], isLoading } = useWorkflowTemplatesForEntity(entityType);
  const initializeWorkflow = useInitializeWorkflow();
  
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  
  const handleInitialize = async () => {
    if (!selectedTemplateId) return;
    
    await initializeWorkflow.mutateAsync({
      templateId: selectedTemplateId,
      entityType,
      entityId,
      mainShootAt,
    });
    
    setSelectedTemplateId('');
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Initialize Workflow
          </DialogTitle>
          <DialogDescription>
            Select a workflow template to track progress for this {entityType}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Workflow Template</Label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No workflow templates available. Create one in Admin → Workflows.
              </p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {template.template_name}
                        {template.applies_to && (
                          <Badge variant="outline" className="text-xs ml-2">
                            {template.applies_to}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {selectedTemplate?.description && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {selectedTemplate.description}
              </p>
            </div>
          )}
          
          {mainShootAt && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> Due dates for scheduled steps will be calculated 
                based on the main shoot date.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleInitialize} 
            disabled={!selectedTemplateId || initializeWorkflow.isPending}
          >
            {initializeWorkflow.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Initialize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
