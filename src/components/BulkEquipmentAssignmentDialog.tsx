import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Package, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useProfiles, useStaffRoles } from '@/hooks/useStaff';
import { useAvailableEquipment } from '@/hooks/useEquipment';
import { useActiveEquipmentKits } from '@/hooks/useEquipmentKits';
import { useBulkAllocateEquipment } from '@/hooks/useBulkEquipmentAllocation';
import { toast } from 'sonner';

interface BulkEquipmentAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  preselectedStaffIds?: string[];
}

interface AllocationResult {
  userId: string;
  userName: string;
  success: boolean;
  error?: string;
}

export function BulkEquipmentAssignmentDialog({
  open,
  onOpenChange,
  eventId,
  preselectedStaffIds = [],
}: BulkEquipmentAssignmentDialogProps) {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(preselectedStaffIds);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [allocationType, setAllocationType] = useState<'item' | 'kit'>('item');
  const [isAllocating, setIsAllocating] = useState(false);
  const [results, setResults] = useState<AllocationResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { data: profiles = [] } = useProfiles();
  const { data: staffRoles = [] } = useStaffRoles();
  const { data: availableItems = [] } = useAvailableEquipment();
  const { data: kits = [] } = useActiveEquipmentKits();
  const bulkAllocate = useBulkAllocateEquipment();

  const activeStaff = profiles.filter((p) => p.is_active !== false);

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return null;
    return staffRoles.find((r) => r.id === roleId)?.name || null;
  };

  const handleStaffToggle = (userId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStaffIds.length === activeStaff.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(activeStaff.map((p) => p.id));
    }
  };

  const handleAllocate = async () => {
    if (selectedStaffIds.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }

    if (allocationType === 'item' && !selectedItemId) {
      toast.error('Please select an equipment item');
      return;
    }

    if (allocationType === 'kit' && !selectedKitId) {
      toast.error('Please select an equipment kit');
      return;
    }

    setIsAllocating(true);
    setResults([]);

    try {
      const allocResults = await bulkAllocate.mutateAsync({
        eventId,
        userIds: selectedStaffIds,
        equipmentItemId: allocationType === 'item' ? selectedItemId : undefined,
        kitId: allocationType === 'kit' ? selectedKitId : undefined,
      });

      // Map results to display format
      const displayResults: AllocationResult[] = allocResults.map((r) => {
        const staff = profiles.find((p) => p.id === r.userId);
        return {
          userId: r.userId,
          userName: staff?.full_name || (staff?.email as string) || 'Unknown',
          success: r.success,
          error: r.error,
        };
      });

      setResults(displayResults);
      setShowResults(true);

      const successCount = displayResults.filter((r) => r.success).length;
      if (successCount === displayResults.length) {
        toast.success(`Equipment allocated to ${successCount} staff member(s)`);
      } else if (successCount > 0) {
        toast.warning(`Allocated to ${successCount}/${displayResults.length} staff members`);
      } else {
        toast.error('Failed to allocate equipment');
      }
    } catch (error) {
      toast.error('Failed to allocate equipment');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleClose = () => {
    setSelectedStaffIds(preselectedStaffIds);
    setSelectedItemId('');
    setSelectedKitId('');
    setResults([]);
    setShowResults(false);
    onOpenChange(false);
  };

  const selectedItem = availableItems.find((i) => i.id === selectedItemId);
  const selectedKit = kits.find((k) => k.id === selectedKitId);

  const canAllocate =
    selectedStaffIds.length > 0 &&
    ((allocationType === 'item' && selectedItemId) || (allocationType === 'kit' && selectedKitId));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bulk Equipment Assignment
          </DialogTitle>
          <DialogDescription>
            Assign equipment to multiple staff members at once. Select staff and choose equipment
            to allocate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Equipment Selection */}
          <div className="space-y-3">
            <Label>Equipment Type</Label>
            <div className="flex gap-2">
              <Button
                variant={allocationType === 'item' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAllocationType('item')}
              >
                <Package className="h-4 w-4 mr-1" />
                Individual Item
              </Button>
              <Button
                variant={allocationType === 'kit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAllocationType('kit')}
              >
                <Users className="h-4 w-4 mr-1" />
                Equipment Kit
              </Button>
            </div>

            {allocationType === 'item' ? (
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment item..." />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {availableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment kit..." />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {kits.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedItem && (
              <div className="text-sm text-muted-foreground">
                Selected: <strong>{selectedItem.name}</strong> - {selectedItem.brand}{' '}
                {selectedItem.model}
              </div>
            )}
            {selectedKit && (
              <div className="text-sm text-muted-foreground">
                Selected Kit: <strong>{selectedKit.name}</strong>
                {selectedKit.description && ` - ${selectedKit.description}`}
              </div>
            )}
          </div>

          {/* Staff Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Staff ({selectedStaffIds.length} selected)
              </Label>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedStaffIds.length === activeStaff.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {activeStaff.map((staff) => {
                  const roleName = getRoleName(staff.default_role_id);
                  return (
                    <div
                      key={staff.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                        selectedStaffIds.includes(staff.id) ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleStaffToggle(staff.id)}
                    >
                      <Checkbox
                        checked={selectedStaffIds.includes(staff.id)}
                        onCheckedChange={() => handleStaffToggle(staff.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{staff.full_name || 'No name'}</div>
                        {staff.email && (
                          <div className="text-xs text-muted-foreground">{staff.email}</div>
                        )}
                      </div>
                      {roleName && (
                        <Badge variant="outline" className="text-xs">
                          {roleName}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {activeStaff.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No active staff found</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Results */}
          {showResults && results.length > 0 && (
            <div className="space-y-2">
              <Label>Allocation Results</Label>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                <div className="space-y-1">
                  {results.map((result) => (
                    <div
                      key={result.userId}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span className="font-medium">{result.userName}</span>
                      {result.error && <span className="text-xs">- {result.error}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Warning for kit allocation */}
          {allocationType === 'kit' && selectedStaffIds.length > 1 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Each staff member will receive their own copy of the kit items. Make sure enough
                equipment is available.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {showResults ? 'Close' : 'Cancel'}
          </Button>
          {!showResults && (
            <Button onClick={handleAllocate} disabled={!canAllocate || isAllocating}>
              {isAllocating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Allocate to {selectedStaffIds.length} Staff
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
