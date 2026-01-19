/**
 * INITIALIZE LEAD WORKFLOW DIALOG
 * 
 * Allows user to select a workflow template and initialize it for a Lead.
 * Supports replacing existing workflows with confirmation.
 */
import { useState } from 'react';
import { Settings, Check, Clock, Loader2, AlertTriangle } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkflowTemplatesForEntity, useInitializeWorkflow, useLeadWorkflowInstance } from '@/hooks/useWorkflowInstances';
import { useAuth } from '@/lib/auth';

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
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  
  const { role, isAdmin, isOperations } = useAuth();
  const { data: templates = [], isLoading } = useWorkflowTemplatesForEntity(entityType);
  const { data: existingInstance } = entityType === 'lead' 
    ? useLeadWorkflowInstance(entityId) 
    : { data: null };
  const initializeWorkflow = useInitializeWorkflow();
  
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const hasExistingWorkflow = !!existingInstance;
  
  // Check if user has permission (Admin or Operations)
  const canInitialize = isAdmin || isOperations;
  
  const handleInitialize = async () => {
    if (!selectedTemplateId) return;
    
    // If workflow exists, show replace confirmation first
    if (hasExistingWorkflow && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }
    
    await initializeWorkflow.mutateAsync({
      templateId: selectedTemplateId,
      entityType,
      entityId,
      mainShootAt,
    });
    
    setSelectedTemplateId('');
    setShowReplaceConfirm(false);
    onOpenChange(false);
    onSuccess?.();
  };
  
  const handleConfirmReplace = async () => {
    setShowReplaceConfirm(false);
    await handleInitialize();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {hasExistingWorkflow ? 'Replace Workflow' : 'Initialize Workflow'}
            </DialogTitle>
            <DialogDescription>
              {hasExistingWorkflow 
                ? `Replace the current workflow with a new template. This will reset all step progress.`
                : `Select a workflow template to track progress for this ${entityType}.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!canInitialize && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Only Admin and Operations users can initialize workflows.
                </AlertDescription>
              </Alert>
            )}
            
            {hasExistingWorkflow && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Current workflow:</strong> {existingInstance?.template?.template_name}
                  <br />
                  <span className="text-muted-foreground">
                    Replacing will delete all existing step progress.
                  </span>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label>Workflow Template</Label>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading templates...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No workflow templates available. Create one in Admin → Workflows.
                </p>
              ) : (
                <Select 
                  value={selectedTemplateId} 
                  onValueChange={setSelectedTemplateId}
                  disabled={!canInitialize}
                >
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
              disabled={!selectedTemplateId || initializeWorkflow.isPending || !canInitialize}
              variant={hasExistingWorkflow ? 'destructive' : 'default'}
            >
              {initializeWorkflow.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {hasExistingWorkflow ? 'Replace Workflow' : 'Initialize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Replace confirmation dialog */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all step progress for the current workflow 
              "{existingInstance?.template?.template_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmReplace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Replace Workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
