import { useState } from 'react';
import { ListChecks, Loader2 } from 'lucide-react';
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
import { useAllWorkflowTemplates } from '@/hooks/useWorkflowTemplates';
import { useInitializeWorkflowSteps } from '@/hooks/useEventWorkflowSteps';

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
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    currentTemplateId || ''
  );
  
  const { data: templates = [], isLoading: templatesLoading } = useAllWorkflowTemplates();
  const initializeSteps = useInitializeWorkflowSteps();
  
  const activeTemplates = templates.filter(t => t.is_active);
  
  const handleInitialize = async () => {
    if (!selectedTemplateId) return;
    
    await initializeSteps.mutateAsync({
      eventId,
      templateId: selectedTemplateId,
    });
    
    setOpen(false);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentTemplateId ? 'Change Workflow Template' : 'Assign Workflow Template'}
          </DialogTitle>
          <DialogDescription>
            {currentTemplateId 
              ? 'This will reset all workflow steps. Completed steps will be lost.'
              : 'Select a workflow template to initialize steps for this job.'
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
                    {template.template_name}
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({template.phase.replace('_', ' ')})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
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
            disabled={!selectedTemplateId || initializeSteps.isPending}
          >
            {initializeSteps.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {currentTemplateId ? 'Reset & Apply' : 'Initialize Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
