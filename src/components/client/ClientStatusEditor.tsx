/**
 * COMPANY STATUS EDITOR
 * 
 * Allows Admin only to manually override company status.
 * Saves immediately on selection without requiring a reason.
 * Shows badge when status is manually set vs auto-derived.
 * Logs all status changes to company_status_audit table.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Edit2, Info, X, Check, Trash2 } from 'lucide-react';
import { useUpdateClient } from '@/hooks/useSales';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompanyStatuses } from '@/hooks/useCompanyStatuses';

// Fallback options if database query fails
const FALLBACK_STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'active_event', label: 'Active Event', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'current_client', label: 'Current Client', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'previous_client', label: 'Previous Client', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

// Map badge_variant to color classes
const variantToColor: Record<string, string> = {
  secondary: 'bg-slate-100 text-slate-700 border-slate-200',
  default: 'bg-blue-100 text-blue-700 border-blue-200',
  destructive: 'bg-red-100 text-red-700 border-red-200',
  outline: 'bg-amber-100 text-amber-700 border-amber-200',
};

interface ClientStatusEditorProps {
  clientId: string;
  updatedAt: string;
  manualStatus: string | null;
  computedStatus: string;
  statusOverrideAt?: string | null;
  statusOverrideReason?: string | null;
  onUpdate?: () => void;
}

export function ClientStatusEditor({
  clientId,
  updatedAt,
  manualStatus,
  computedStatus,
  statusOverrideAt,
  statusOverrideReason,
  onUpdate,
}: ClientStatusEditorProps) {
  const { isAdmin } = useAuth();
  const updateClient = useUpdateClient();
  const { data: dbStatuses } = useCompanyStatuses();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(manualStatus || '');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Map database statuses to dropdown format, with fallback
  const STATUS_OPTIONS = dbStatuses?.map(s => ({
    value: s.name,
    label: s.label,
    color: variantToColor[s.badge_variant || 'secondary'] || 'bg-slate-100 text-slate-700 border-slate-200',
  })) || FALLBACK_STATUS_OPTIONS;

  const canEdit = isAdmin; // Only Admin can edit
  const isOverridden = !!manualStatus;
  const displayStatus = manualStatus || computedStatus;
  
  const statusConfig = STATUS_OPTIONS.find(s => s.value === displayStatus) || {
    value: displayStatus,
    label: displayStatus.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const handleSave = async () => {
    if (!selectedStatus) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log to audit
      await supabase.from('company_status_audit').insert({
        company_id: clientId,
        action: 'status_override_set',
        old_status: displayStatus,
        new_status: selectedStatus,
        changed_by: user?.id,
        override_reason: null,
      });
      
      await updateClient.mutateAsync({
        id: clientId,
        updated_at: updatedAt,
        manual_status: selectedStatus,
        status_override_at: new Date().toISOString(),
        status_override_by: user?.id,
        status_override_reason: null,
      } as any);
      
      toast.success('Status updated');
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error saving status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearOverride = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log to audit
      await supabase.from('company_status_audit').insert({
        company_id: clientId,
        action: 'status_override_cleared',
        old_status: manualStatus,
        new_status: computedStatus,
        changed_by: user?.id,
        override_reason: null,
      });
      
      await updateClient.mutateAsync({
        id: clientId,
        updated_at: updatedAt,
        manual_status: null,
        status_override_at: null,
        status_override_by: null,
        status_override_reason: null,
      } as any);
      
      toast.success('Override cleared - status will be auto-computed from events');
      setClearConfirmOpen(false);
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error clearing override:', error);
      toast.error('Failed to clear override');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedStatus(manualStatus || '');
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    setSelectedStatus(manualStatus || computedStatus);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSave}
            disabled={!selectedStatus || isSaving}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isOverridden && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-destructive hover:text-destructive"
            onClick={() => setClearConfirmOpen(true)}
            disabled={isSaving}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear Override
          </Button>
        )}

        {/* Clear Override Confirmation */}
        <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Status Override?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the manual status override and the company status will be 
                automatically computed from its events. The status will change to: <strong>
                {STATUS_OPTIONS.find(s => s.value === computedStatus)?.label || computedStatus}
                </strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearOverride} disabled={isSaving}>
                {isSaving ? 'Clearing...' : 'Clear Override'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
      
      
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleStartEditing}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}