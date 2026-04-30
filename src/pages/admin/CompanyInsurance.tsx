import { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Shield,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ExternalLink,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useCompanyInsurancePolicies,
  useCreateInsurancePolicy,
  useUpdateInsurancePolicy,
  useDeleteInsurancePolicy,
  useUploadCoc,
  getCocSignedUrl,
  type CompanyInsurancePolicy,
} from '@/hooks/useCompanyInsurance';

export default function CompanyInsurance() {
  const { data: policies, isLoading } = useCompanyInsurancePolicies();
  const createMutation = useCreateInsurancePolicy();
  const updateMutation = useUpdateInsurancePolicy();
  const deleteMutation = useDeleteInsurancePolicy();
  const uploadCocMutation = useUploadCoc();

  const [editPolicy, setEditPolicy] = useState<Partial<CompanyInsurancePolicy> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const cocInputRef = useRef<HTMLInputElement>(null);

  const openNew = () => {
    setIsNew(true);
    setEditPolicy({
      insurance_type: '',
      policy_number: '',
      insurer_name: '',
      renewal_due_date: '',
      renewal_paid_date: '',
      notes: '',
    });
  };

  const openEdit = (p: CompanyInsurancePolicy) => {
    setIsNew(false);
    setEditPolicy({
      id: p.id,
      insurance_type: p.insurance_type,
      policy_number: p.policy_number || '',
      insurer_name: p.insurer_name || '',
      renewal_due_date: p.renewal_due_date || '',
      renewal_paid_date: p.renewal_paid_date || '',
      notes: p.notes || '',
    });
  };

  const handleSave = () => {
    if (!editPolicy?.insurance_type) return;
    const payload = {
      insurance_type: editPolicy.insurance_type,
      policy_number: editPolicy.policy_number || null,
      insurer_name: editPolicy.insurer_name || null,
      renewal_due_date: editPolicy.renewal_due_date || null,
      renewal_paid_date: editPolicy.renewal_paid_date || null,
      notes: editPolicy.notes || null,
    };

    if (isNew) {
      createMutation.mutate(payload, { onSuccess: () => setEditPolicy(null) });
    } else if (editPolicy.id) {
      updateMutation.mutate({ id: editPolicy.id, ...payload }, { onSuccess: () => setEditPolicy(null) });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const handleCocUpload = (policyId: string) => {
    setUploadingId(policyId);
    cocInputRef.current?.click();
  };

  const handleCocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingId) {
      uploadCocMutation.mutate({ policyId: uploadingId, file });
    }
    setUploadingId(null);
    if (cocInputRef.current) cocInputRef.current.value = '';
  };

  const handleViewCoc = async (filePath: string) => {
    try {
      const url = await getCocSignedUrl(filePath);
      window.open(url, '_blank');
    } catch {
      // error handled by toast in hook
    }
  };

  const getRenewalWarning = (dueDate: string | null) => {
    if (!dueDate) return null;
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return { level: 'overdue' as const, text: 'Overdue' };
    if (days <= 14) return { level: 'soon' as const, text: `Due in ${days}d` };
    if (days <= 30) return { level: 'upcoming' as const, text: `Due in ${days}d` };
    return null;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Company Insurance"
        description="Manage your company's insurance policies, renewals, and certificates of currency"
      />

      <input
        ref={cocInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={handleCocFileChange}
      />

      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Add Policy
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !policies?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No insurance policies added yet</p>
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" /> Add your first policy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {policies.map((policy) => {
              const warning = getRenewalWarning(policy.renewal_due_date);
              return (
                <Card key={policy.id} className={cn(
                  warning?.level === 'overdue' && 'border-destructive/50'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{policy.insurance_type}</h3>
                          {policy.insurer_name && (
                            <span className="text-sm text-muted-foreground">— {policy.insurer_name}</span>
                          )}
                          {warning && (
                            <Badge
                              variant={warning.level === 'overdue' ? 'destructive' : 'outline'}
                              className={cn(
                                'text-xs',
                                warning.level === 'soon' && 'border-destructive text-destructive',
                                warning.level === 'upcoming' && 'border-orange-500 text-orange-500'
                              )}
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {warning.text}
                            </Badge>
                          )}
                        </div>

                        {policy.policy_number && (
                          <p className="text-sm text-muted-foreground">
                            Policy #: <span className="font-mono">{policy.policy_number}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {policy.renewal_due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Renewal due: {format(parseISO(policy.renewal_due_date), 'PP')}
                            </span>
                          )}
                          {policy.renewal_paid_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Paid: {format(parseISO(policy.renewal_paid_date), 'PP')}
                            </span>
                          )}
                        </div>

                        {policy.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{policy.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {policy.coc_file_path ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewCoc(policy.coc_file_path!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> CoC
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCocUpload(policy.id)}
                            disabled={uploadCocMutation.isPending}
                          >
                            <Upload className="h-3.5 w-3.5 mr-1" /> CoC
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(policy)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(policy.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Create Dialog */}
      <Dialog open={!!editPolicy} onOpenChange={() => setEditPolicy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Insurance Policy' : 'Edit Insurance Policy'}</DialogTitle>
            <DialogDescription>
              {isNew ? 'Add a new company insurance record' : 'Update policy details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Insurance Type *</Label>
              <Input
                value={editPolicy?.insurance_type || ''}
                onChange={(e) => setEditPolicy(prev => prev ? { ...prev, insurance_type: e.target.value } : null)}
                placeholder="e.g. General Insurance, Workers Compensation"
              />
            </div>
            <div className="space-y-2">
              <Label>Insurer Name</Label>
              <Input
                value={editPolicy?.insurer_name || ''}
                onChange={(e) => setEditPolicy(prev => prev ? { ...prev, insurer_name: e.target.value } : null)}
                placeholder="e.g. QBE, Allianz"
              />
            </div>
            <div className="space-y-2">
              <Label>Policy Number</Label>
              <Input
                value={editPolicy?.policy_number || ''}
                onChange={(e) => setEditPolicy(prev => prev ? { ...prev, policy_number: e.target.value } : null)}
                placeholder="e.g. POL-123456"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Renewal Due Date</Label>
                <Input
                  type="date"
                  value={editPolicy?.renewal_due_date || ''}
                  onChange={(e) => setEditPolicy(prev => prev ? { ...prev, renewal_due_date: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Renewal Paid Date</Label>
                <Input
                  type="date"
                  value={editPolicy?.renewal_paid_date || ''}
                  onChange={(e) => setEditPolicy(prev => prev ? { ...prev, renewal_paid_date: e.target.value } : null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editPolicy?.notes || ''}
                onChange={(e) => setEditPolicy(prev => prev ? { ...prev, notes: e.target.value } : null)}
                placeholder="Any additional details..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPolicy(null)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!editPolicy?.insurance_type || createMutation.isPending || updateMutation.isPending}
            >
              {isNew ? 'Add Policy' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Insurance Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this insurance record and any uploaded certificate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
