/**
 * COMPANY STATUS EDITOR
 * 
 * Allows Admin/Sales to manually override company status.
 * Shows badge when status is manually set vs auto-derived.
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
import { Edit2, Info, X, Check } from 'lucide-react';
import { useUpdateClient } from '@/hooks/useSales';
import { useAuth } from '@/lib/auth';

const STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'active_event', label: 'Active Event', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'current_client', label: 'Current Client', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'previous_client', label: 'Previous Client', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

interface ClientStatusEditorProps {
  clientId: string;
  manualStatus: string | null;
  computedStatus: string;
  statusOverrideAt?: string | null;
  onUpdate?: () => void;
}

export function ClientStatusEditor({
  clientId,
  manualStatus,
  computedStatus,
  statusOverrideAt,
  onUpdate,
}: ClientStatusEditorProps) {
  const { isAdmin, isSales } = useAuth();
  const updateClient = useUpdateClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(manualStatus || '');

  const canEdit = isAdmin || isSales;
  const isOverridden = !!manualStatus;
  const displayStatus = manualStatus || computedStatus;
  
  const statusConfig = STATUS_OPTIONS.find(s => s.value === displayStatus) || STATUS_OPTIONS[0];

  const handleSave = async () => {
    if (!selectedStatus) return;
    
    await updateClient.mutateAsync({
      id: clientId,
      manual_status: selectedStatus,
      status_override_at: new Date().toISOString(),
    } as any);
    
    setIsEditing(false);
    onUpdate?.();
  };

  const handleClearOverride = async () => {
    await updateClient.mutateAsync({
      id: clientId,
      manual_status: null,
      status_override_at: null,
      status_override_by: null,
    } as any);
    
    setIsEditing(false);
    onUpdate?.();
  };

  const handleCancel = () => {
    setSelectedStatus(manualStatus || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
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
          disabled={!selectedStatus || updateClient.isPending}
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
        {isOverridden && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleClearOverride}
            disabled={updateClient.isPending}
          >
            Clear Override
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
      
      {isOverridden && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
              <Info className="h-3 w-3 mr-1" />
              Manual
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Status was manually set</p>
            {statusOverrideAt && (
              <p className="text-xs text-muted-foreground">
                on {new Date(statusOverrideAt).toLocaleDateString()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      )}
      
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setSelectedStatus(manualStatus || computedStatus);
            setIsEditing(true);
          }}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}