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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUpdateWorkflowStep, EventWorkflowStepWithProfile } from '@/hooks/useEventWorkflowSteps';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
  const [assignedTo, setAssignedTo] = useState<string>('management');
  
  const updateStep = useUpdateWorkflowStep();

  // Fetch staff assigned to this event
  const { data: eventStaff = [] } = useQuery({
    queryKey: ['event-assignments-staff', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`
          id,
          user_id,
          staff_id,
          role_on_event,
          staff_role:staff_roles!event_assignments_staff_role_id_fkey(name),
          profile:profiles!event_assignments_user_id_fkey(id, full_name, email)
        `)
        .eq('event_id', eventId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!eventId,
  });

  // Build unique staff options from assignments
  const staffOptions = (() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];

    eventStaff.forEach((a: any) => {
      const userId = a.user_id || a.profile?.id;
      if (!userId || seen.has(userId)) return;
      seen.add(userId);
      const name = a.profile?.full_name || a.profile?.email || 'Unknown';
      const role = a.staff_role?.name || a.role_on_event || '';
      options.push({
        value: userId,
        label: role ? `${name} (${role})` : name,
      });
    });

    return options;
  })();
  
  useEffect(() => {
    if (step) {
      setLabel(step.step_label);
      setDueDate(step.due_date ? parseISO(step.due_date) : undefined);
      setNotes(step.notes || '');
      setAssignedTo(step.assigned_to || 'management');
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
      assignedTo: assignedTo === 'management' ? null : assignedTo,
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
            <Label>Assigned To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="management">Management</SelectItem>
                {staffOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
