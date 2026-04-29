/**
 * INLINE STATUS EDITOR
 * 
 * Clickable status badge that opens a dropdown for Admin users only.
 * Saves immediately on selection without requiring a reason.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronDown, Check, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useCompanyStatuses } from '@/hooks/useCompanyStatuses';

// Fallback options if database query fails
const FALLBACK_STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect', className: 'bg-muted text-muted-foreground' },
  { value: 'active_event', label: 'Active Event', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'current_client', label: 'Current Client', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'previous_client', label: 'Previous Client', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
];

// Map badge_variant to className
const variantToClassName: Record<string, string> = {
  secondary: 'bg-muted text-muted-foreground',
  default: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  destructive: 'bg-red-500/10 text-red-600 border-red-500/20',
  outline: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

interface InlineStatusEditorProps {
  companyId: string;
  currentStatus: string;
  isOverride: boolean;
  computedStatus: string;
  overrideReason?: string | null;
  onStatusChange?: () => void;
}

export function InlineStatusEditor({
  companyId,
  currentStatus,
  isOverride,
  computedStatus,
  overrideReason,
  onStatusChange,
}: InlineStatusEditorProps) {
  const { isAdmin } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: dbStatuses, isLoading: statusesLoading } = useCompanyStatuses();
  
  const canEdit = isAdmin; // Only Admin can edit status

  // Map database statuses to dropdown format, with fallback
  const STATUS_OPTIONS = dbStatuses?.map(s => ({
    value: s.name,
    label: s.label,
    className: variantToClassName[s.badge_variant || 'secondary'] || 'bg-muted text-muted-foreground',
  })) || FALLBACK_STATUS_OPTIONS;

  const statusConfig = STATUS_OPTIONS.find(s => s.value === currentStatus) || {
    value: currentStatus,
    label: currentStatus.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    className: 'bg-muted text-muted-foreground',
  };

  const handleStatusClick = async (newStatus: string) => {
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
        override_reason: null,
      });
      
      // Update client status
      await supabase.from('clients').update({
        manual_status: newStatus,
        status_override_at: new Date().toISOString(),
        status_override_by: user?.id,
        status_override_reason: null,
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
        override_reason: null,
      });
      
      // Clear override
      await supabase.from('clients').update({
        manual_status: null,
        status_override_at: null,
        status_override_by: null,
        status_override_reason: null,
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

  // Read-only badge for non-Admin users
  if (!canEdit) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={statusConfig.className}>
          {statusesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : statusConfig.label}
        </Badge>
        {isOverride && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200 cursor-help">
                <Info className="h-2.5 w-2.5 mr-0.5" />
                Manual
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Manual override</p>
              {overrideReason && (
                <p className="text-xs text-muted-foreground max-w-[200px]">{overrideReason}</p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <>
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
                onClick={() => handleStatusClick(option.value)}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200 cursor-help">
                <Info className="h-2.5 w-2.5 mr-0.5" />
                Manual
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Manual override</p>
              {overrideReason && (
                <p className="text-xs text-muted-foreground max-w-[200px]">{overrideReason}</p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );
}