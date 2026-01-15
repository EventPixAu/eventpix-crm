import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useStaffEligibility, useLogComplianceOverride } from '@/hooks/useCompliance';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignmentEligibilityWarningProps {
  userId: string;
  userName: string;
  eventId: string;
  onOverride?: () => void;
  onCancel?: () => void;
  showOverrideOption?: boolean;
}

export function AssignmentEligibilityWarning({
  userId,
  userName,
  eventId,
  onOverride,
  onCancel,
  showOverrideOption = true,
}: AssignmentEligibilityWarningProps) {
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const { data: eligibility, isLoading } = useStaffEligibility(userId);
  const logOverrideMutation = useLogComplianceOverride();

  const handleOverride = () => {
    if (!overrideReason.trim()) return;

    logOverrideMutation.mutate({
      eventId,
      userId,
      reason: overrideReason,
    }, {
      onSuccess: () => {
        setOverrideDialogOpen(false);
        setOverrideReason('');
        onOverride?.();
      },
    });
  };

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  // If eligible, don't show anything
  if (eligibility?.eligible) {
    return null;
  }

  const issues = [
    ...eligibility?.missing_documents?.map(d => `Missing: ${d}`) || [],
    ...eligibility?.expired_documents?.map(d => `Expired: ${d}`) || [],
  ];

  if (eligibility?.onboarding_status !== 'active') {
    issues.unshift(`Onboarding status: ${eligibility?.onboarding_status}`);
  }

  return (
    <>
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Compliance Issues for {userName}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1">
            {issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
          {eligibility?.pending_documents && eligibility.pending_documents.length > 0 && (
            <p className="mt-2 text-sm">
              Pending review: {eligibility.pending_documents.join(', ')}
            </p>
          )}
          
          {showOverrideOption && (
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setOverrideDialogOpen(true)}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Override & Assign Anyway
              </Button>
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Override Compliance Check
            </DialogTitle>
            <DialogDescription>
              You are about to assign {userName} to this event despite compliance issues. 
              This action will be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Issues being overridden:</strong>
                <ul className="list-disc list-inside mt-1">
                  {issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Reason for Override *</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this override is necessary..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be recorded in the audit log.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleOverride}
              disabled={!overrideReason.trim() || logOverrideMutation.isPending}
            >
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact inline warning for use in lists/tables
export function EligibilityBadge({ userId }: { userId: string }) {
  const { data: eligibility, isLoading } = useStaffEligibility(userId);

  if (isLoading) {
    return <Skeleton className="h-5 w-16" />;
  }

  if (eligibility?.eligible) {
    return null;
  }

  const issueCount = 
    (eligibility?.missing_documents?.length || 0) + 
    (eligibility?.expired_documents?.length || 0);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive">
      <ShieldAlert className="h-3 w-3" />
      {eligibility?.onboarding_status !== 'active' 
        ? `Status: ${eligibility?.onboarding_status}`
        : `${issueCount} compliance issue${issueCount !== 1 ? 's' : ''}`
      }
    </span>
  );
}
