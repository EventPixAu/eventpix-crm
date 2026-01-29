import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useUpdateWorkflowStep, EventWorkflowStepWithProfile } from '@/hooks/useEventWorkflowSteps';

interface EditWorkflowStepDialogProps {
  step: EventWorkflowStepWithProfile | null;
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWorkflowStepDialog({
  step,
  eventId,
  open,
  onOpenChange,
}: EditWorkflowStepDialogProps) {
  const [label, setLabel] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  
  const updateStep = useUpdateWorkflowStep();
  
  useEffect(() => {
    if (step) {
      setLabel(step.step_label);
      setDueDate(step.due_date ? parseISO(step.due_date) : undefined);
      setNotes(step.notes || '');
    }
  }, [step]);
  
  const handleSave = async () => {
    if (!step) return;
    
    await updateStep.mutateAsync({
      stepId: step.id,
      eventId,
      stepLabel: label,
      dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      notes: notes || null,
    });
    
    onOpenChange(false);
  };
  
  const handleClearDate = () => {
    setDueDate(undefined);
  };
  
  if (!step) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit Workflow Step
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="step-label">Step Label</Label>
            <Input
              id="step-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter step label"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Due Date</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'No due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearDate}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="step-notes">Notes</Label>
            <Textarea
              id="step-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this step"
              rows={3}
            />
          </div>
          
          {step.completion_type === 'auto' && (
            <p className="text-xs text-muted-foreground bg-info/10 p-2 rounded">
              This is an auto-complete step. It will be marked complete automatically when triggered by the system.
            </p>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!label.trim() || updateStep.isPending}
          >
            {updateStep.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
