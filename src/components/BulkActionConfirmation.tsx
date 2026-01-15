import { useState } from 'react';
import { AlertTriangle, Users, Calendar, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BulkActionSummary {
  totalEvents: number;
  staffAffected: number;
  conflicts: number;
  overridesRequired: number;
}

interface BulkActionConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: 'assignment' | 'creation' | 'update';
  summary: BulkActionSummary;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export function BulkActionConfirmation({
  open,
  onOpenChange,
  actionType,
  summary,
  onConfirm,
  isProcessing = false,
}: BulkActionConfirmationProps) {
  const [firstConfirmed, setFirstConfirmed] = useState(false);
  const [secondConfirmed, setSecondConfirmed] = useState(false);
  
  const isLargeAction = summary.totalEvents >= 10;
  const hasIssues = summary.conflicts > 0 || summary.overridesRequired > 0;
  
  const canProceed = firstConfirmed && (!isLargeAction || secondConfirmed);
  
  const handleClose = () => {
    setFirstConfirmed(false);
    setSecondConfirmed(false);
    onOpenChange(false);
  };
  
  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };
  
  const getActionLabel = () => {
    switch (actionType) {
      case 'assignment': return 'Bulk Assignment';
      case 'creation': return 'Bulk Event Creation';
      case 'update': return 'Bulk Update';
      default: return 'Bulk Action';
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirm {getActionLabel()}
          </DialogTitle>
          <DialogDescription>
            Please review the impact summary before proceeding.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Impact Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{summary.totalEvents}</p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{summary.staffAffected}</p>
              <p className="text-xs text-muted-foreground">Staff Affected</p>
            </div>
          </div>
          
          {/* Warnings */}
          {hasIssues && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700">Issues Detected</AlertTitle>
              <AlertDescription className="text-sm">
                <ul className="list-disc list-inside space-y-1 mt-1">
                  {summary.conflicts > 0 && (
                    <li>{summary.conflicts} scheduling conflict{summary.conflicts !== 1 ? 's' : ''}</li>
                  )}
                  {summary.overridesRequired > 0 && (
                    <li>{summary.overridesRequired} override{summary.overridesRequired !== 1 ? 's' : ''} required</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Large action warning */}
          {isLargeAction && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Large Bulk Action</AlertTitle>
              <AlertDescription className="text-sm">
                This action affects {summary.totalEvents} events. 
                Please confirm twice before proceeding.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Confirmation checkboxes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="first-confirm"
                checked={firstConfirmed}
                onCheckedChange={(checked) => setFirstConfirmed(!!checked)}
              />
              <Label htmlFor="first-confirm" className="text-sm cursor-pointer">
                I have reviewed the impact summary and want to proceed with this bulk action.
              </Label>
            </div>
            
            {isLargeAction && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="second-confirm"
                  checked={secondConfirmed}
                  onCheckedChange={(checked) => setSecondConfirmed(!!checked)}
                  disabled={!firstConfirmed}
                />
                <Label 
                  htmlFor="second-confirm" 
                  className="text-sm cursor-pointer"
                >
                  I understand this is a large action affecting {summary.totalEvents} events 
                  and I confirm this is intentional.
                </Label>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!canProceed || isProcessing}
            className={hasIssues ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Confirm ${getActionLabel()}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
