/**
 * INLINE STATUS EDITOR
 * 
 * Clickable status badge that opens a dropdown for Admin/Sales users.
 * Saves immediately and logs to audit.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

type ComputedStatus = 'prospect' | 'active_event' | 'current_client' | 'previous_client';

const STATUS_OPTIONS: { value: ComputedStatus; label: string; className: string }[] = [
  { value: 'prospect', label: 'Prospect', className: 'bg-muted text-muted-foreground' },
  { value: 'active_event', label: 'Active Event', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'current_client', label: 'Current Client', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'previous_client', label: 'Previous Client', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
];

interface InlineStatusEditorProps {
  companyId: string;
  currentStatus: ComputedStatus;
  isOverride: boolean;
  computedStatus: ComputedStatus;
  onStatusChange?: () => void;
}

export function InlineStatusEditor({
  companyId,
  currentStatus,
  isOverride,
  computedStatus,
  onStatusChange,
}: InlineStatusEditorProps) {
  const { isAdmin, isSales } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const canEdit = isAdmin || isSales;
  const statusConfig = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[0];

  const handleStatusChange = async (newStatus: ComputedStatus) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log to audit
      await supabase.from('company_status_audit').insert({
        company_id: companyId,
        action: 'status_override_set',
        old_status: currentStatus,
        new_status: newStatus,
        changed_by: user?.id,
      });
      
      // Update client status
      await supabase.from('clients').update({
        manual_status: newStatus,
        status_override_at: new Date().toISOString(),
        status_override_by: user?.id,
      }).eq('id', companyId);
      
      toast.success('Status updated');
      onStatusChange?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearOverride = async () => {
    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log to audit
      await supabase.from('company_status_audit').insert({
        company_id: companyId,
        action: 'status_override_cleared',
        old_status: currentStatus,
        new_status: computedStatus,
        changed_by: user?.id,
      });
      
      // Clear override
      await supabase.from('clients').update({
        manual_status: null,
        status_override_at: null,
        status_override_by: null,
      }).eq('id', companyId);
      
      toast.success('Override cleared');
      onStatusChange?.();
    } catch (error) {
      console.error('Error clearing override:', error);
      toast.error('Failed to clear override');
    } finally {
      setIsUpdating(false);
    }
  };

  // Read-only badge for non-Admin/Sales users
  if (!canEdit) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
        {isOverride && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200">
            Manual
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isUpdating}>
          <button className="flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded">
            <Badge variant="outline" className={`${statusConfig.className} cursor-pointer hover:opacity-80`}>
              {statusConfig.label}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-background z-50">
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className="flex items-center justify-between"
            >
              <span>{option.label}</span>
              {currentStatus === option.value && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          {isOverride && (
            <>
              <div className="h-px bg-border my-1" />
              <DropdownMenuItem
                onClick={handleClearOverride}
                className="text-muted-foreground text-sm"
              >
                Clear override (use auto)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isOverride && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200">
          Manual
        </Badge>
      )}
    </div>
  );
}
