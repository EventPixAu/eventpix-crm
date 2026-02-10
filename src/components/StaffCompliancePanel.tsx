import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileCheck, 
  FileX, 
  Upload, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Calendar,
  Shield
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useComplianceDocumentTypes,
  useStaffComplianceDocuments,
  useStaffEligibility,
  useReviewComplianceDocument,
  useUpdateOnboardingStatus,
  ONBOARDING_STATUS_CONFIG,
  DOCUMENT_STATUS_CONFIG,
  type OnboardingStatus,
  type ComplianceDocumentType,
  type StaffComplianceDocumentWithType,
} from '@/hooks/useCompliance';

interface StaffCompliancePanelProps {
  userId: string;
  userRole?: string;
  currentOnboardingStatus?: OnboardingStatus;
}

export function StaffCompliancePanel({ 
  userId, 
  userRole = 'photographer',
  currentOnboardingStatus = 'incomplete' 
}: StaffCompliancePanelProps) {
  const [reviewingDoc, setReviewingDoc] = useState<StaffComplianceDocumentWithType | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'valid' | 'rejected'>('valid');
  const [reviewNotes, setReviewNotes] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OnboardingStatus>(currentOnboardingStatus);
  const [statusNotes, setStatusNotes] = useState('');

  const { data: documentTypes, isLoading: typesLoading } = useComplianceDocumentTypes();
  const { data: documents, isLoading: docsLoading } = useStaffComplianceDocuments(userId);
  const { data: eligibility, isLoading: eligibilityLoading } = useStaffEligibility(userId);

  const reviewMutation = useReviewComplianceDocument();
  const updateStatusMutation = useUpdateOnboardingStatus();

  const isLoading = typesLoading || docsLoading || eligibilityLoading;

  // Get required document types for this user's role
  const requiredTypes = documentTypes?.filter(dt => 
    dt.required && dt.is_active && 
    (!dt.applies_to_roles || dt.applies_to_roles.includes(userRole))
  ) || [];

  const optionalTypes = documentTypes?.filter(dt => 
    !dt.required && dt.is_active && 
    (!dt.applies_to_roles || dt.applies_to_roles.includes(userRole))
  ) || [];

  // Map documents by type ID
  const documentsByType = new Map(
    documents?.map(doc => [doc.document_type_id, doc]) || []
  );

  const handleReviewSubmit = () => {
    if (!reviewingDoc) return;

    reviewMutation.mutate({
      id: reviewingDoc.id,
      userId,
      status: reviewStatus,
      notes: reviewNotes || undefined,
    }, {
      onSuccess: () => {
        setReviewingDoc(null);
        setReviewNotes('');
      },
    });
  };

  const handleStatusUpdate = () => {
    updateStatusMutation.mutate({
      userId,
      status: newStatus,
      notes: statusNotes || undefined,
    }, {
      onSuccess: () => {
        setStatusDialogOpen(false);
        setStatusNotes('');
      },
    });
  };

  const getExpiryWarning = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) return { level: 'expired', text: 'Expired' };
    if (days <= 7) return { level: 'critical', text: `Expires in ${days} days` };
    if (days <= 30) return { level: 'warning', text: `Expires in ${days} days` };
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Eligibility Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Eligibility Status
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={ONBOARDING_STATUS_CONFIG[currentOnboardingStatus].variant}>
                {ONBOARDING_STATUS_CONFIG[currentOnboardingStatus].label}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
                Change Status
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {eligibility ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {eligibility.eligible ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-700 font-medium">Eligible for assignments</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-destructive font-medium">Not eligible for assignments</span>
                  </>
                )}
              </div>

              {eligibility.missing_documents?.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Missing: </span>
                    {eligibility.missing_documents.join(', ')}
                  </div>
                </div>
              )}

              {eligibility.expired_documents?.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <span className="font-medium">Expired: </span>
                    {eligibility.expired_documents.join(', ')}
                  </div>
                </div>
              )}

              {eligibility.pending_documents?.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Pending review: </span>
                    {eligibility.pending_documents.join(', ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Unable to check eligibility</p>
          )}
        </CardContent>
      </Card>

      {/* Required Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required Documents</CardTitle>
          <CardDescription>These documents must be valid for assignment eligibility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requiredTypes.map((docType) => {
              const doc = documentsByType.get(docType.id);
              return (
                <DocumentRow
                  key={docType.id}
                  docType={docType}
                  document={doc}
                  getExpiryWarning={getExpiryWarning}
                  onReview={setReviewingDoc}
                />
              );
            })}
            {requiredTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">No required documents configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Optional Documents */}
      {optionalTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optional Documents</CardTitle>
            <CardDescription>Additional documents that may be needed for specific events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optionalTypes.map((docType) => {
                const doc = documentsByType.get(docType.id);
                return (
                  <DocumentRow
                    key={docType.id}
                    docType={docType}
                    document={doc}
                    getExpiryWarning={getExpiryWarning}
                    onReview={setReviewingDoc}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewingDoc} onOpenChange={() => setReviewingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>
              {reviewingDoc?.document_type?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {reviewingDoc?.document_url && (
              <Button variant="outline" asChild className="w-full">
                <a href={reviewingDoc.document_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Document
                </a>
              </Button>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {reviewingDoc?.policy_number && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Policy Number</Label>
                  <p>{reviewingDoc.policy_number}</p>
                </div>
              )}
              {reviewingDoc?.issued_date && (
                <div>
                  <Label className="text-muted-foreground">Issued Date</Label>
                  <p>{format(parseISO(reviewingDoc.issued_date), 'PP')}</p>
                </div>
              )}
              {reviewingDoc?.expiry_date && (
                <div>
                  <Label className="text-muted-foreground">Expiry Date</Label>
                  <p>{format(parseISO(reviewingDoc.expiry_date), 'PP')}</p>
                </div>
              )}
              {reviewingDoc?.renewal_due_date && (
                <div>
                  <Label className="text-muted-foreground">Renewal Due</Label>
                  <p>{format(parseISO(reviewingDoc.renewal_due_date), 'PP')}</p>
                </div>
              )}
              {reviewingDoc?.renewal_paid_date && (
                <div>
                  <Label className="text-muted-foreground">Renewal Paid</Label>
                  <p>{format(parseISO(reviewingDoc.renewal_paid_date), 'PP')}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Decision</Label>
              <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as 'valid' | 'rejected')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valid">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this review..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingDoc(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReviewSubmit}
              disabled={reviewMutation.isPending}
            >
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Onboarding Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OnboardingStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Reason for status change..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending}
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Document Row Component
function DocumentRow({
  docType,
  document,
  getExpiryWarning,
  onReview,
}: {
  docType: ComplianceDocumentType;
  document?: StaffComplianceDocumentWithType;
  getExpiryWarning: (date: string | null) => { level: string; text: string } | null;
  onReview: (doc: StaffComplianceDocumentWithType) => void;
}) {
  const expiryWarning = document ? getExpiryWarning(document.expiry_date) : null;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        {document?.status === 'valid' ? (
          <FileCheck className="h-5 w-5 text-green-500" />
        ) : document?.status === 'pending_review' ? (
          <Clock className="h-5 w-5 text-yellow-500" />
        ) : document?.status === 'rejected' || document?.status === 'expired' ? (
          <FileX className="h-5 w-5 text-destructive" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium text-sm">{docType.name}</p>
          {docType.description && (
            <p className="text-xs text-muted-foreground">{docType.description}</p>
          )}
          {document?.policy_number && (
            <p className="text-xs text-muted-foreground mt-1">
              Policy: {document.policy_number}
            </p>
          )}
          {document?.expiry_date && (
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Expires: {format(parseISO(document.expiry_date), 'PP')}
              </span>
              {expiryWarning && (
                <Badge 
                  variant={expiryWarning.level === 'expired' ? 'destructive' : 'outline'}
                  className={cn(
                    'text-[10px]',
                    expiryWarning.level === 'critical' && 'border-destructive text-destructive',
                    expiryWarning.level === 'warning' && 'border-orange-500 text-orange-500'
                  )}
                >
                  {expiryWarning.text}
                </Badge>
              )}
            </div>
          )}
          {document?.renewal_due_date && (
            <span className="text-xs text-muted-foreground">
              Renewal due: {format(parseISO(document.renewal_due_date), 'PP')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {document ? (
          <>
            <Badge variant={DOCUMENT_STATUS_CONFIG[document.status].variant}>
              {DOCUMENT_STATUS_CONFIG[document.status].label}
            </Badge>
            {document.status === 'pending_review' && (
              <Button size="sm" onClick={() => onReview(document)}>
                Review
              </Button>
            )}
            {document.document_url && (
              <Button size="sm" variant="ghost" asChild>
                <a href={document.document_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </>
        ) : (
          <Badge variant="outline">Not uploaded</Badge>
        )}
      </div>
    </div>
  );
}
