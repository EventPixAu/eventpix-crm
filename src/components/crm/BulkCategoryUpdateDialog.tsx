/**
 * BULK CATEGORY + CLIENT TYPE UPDATE DIALOG
 *
 * Admin-only dialog to set Parent Category, Sub-category and/or Client Type
 * on multiple companies at once.
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { CompanyCategoryPicker } from './CompanyCategoryPicker';
import { ClientTypePicker } from './ClientTypePicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanyIds: string[];
  onComplete: () => void;
}

export function BulkCategoryUpdateDialog({ open, onOpenChange, selectedCompanyIds, onComplete }: Props) {
  const { isAdmin } = useAuth();
  const [applyCategory, setApplyCategory] = useState(true);
  const [parentId, setParentId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [applyClientType, setApplyClientType] = useState(false);
  const [clientType, setClientType] = useState<'Direct' | 'Indirect' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isAdmin) return null;

  const reset = () => {
    setApplyCategory(true); setParentId(null); setSubcategoryId(null);
    setApplyClientType(false); setClientType(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (selectedCompanyIds.length === 0) return;
    if (!applyCategory && !applyClientType) return;
    setIsUpdating(true);
    try {
      const updates: Record<string, unknown> = {};
      if (applyCategory) {
        updates.category_id = parentId;
        updates.subcategory_id = subcategoryId;
      }
      if (applyClientType) {
        updates.client_type = clientType;
      }
      const { error } = await supabase
        .from('clients')
        .update(updates as any)
        .in('id', selectedCompanyIds);
      if (error) throw error;
      toast.success(`Updated ${selectedCompanyIds.length} ${selectedCompanyIds.length === 1 ? 'company' : 'companies'}`);
      handleClose();
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Update</DialogTitle>
          <DialogDescription>
            Update category and/or client type for {selectedCompanyIds.length} selected {selectedCompanyIds.length === 1 ? 'company' : 'companies'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2 border rounded-md p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={applyCategory} onCheckedChange={(v) => setApplyCategory(!!v)} />
              <span className="font-medium text-sm">Set Category</span>
            </label>
            {applyCategory && (
              <CompanyCategoryPicker
                parentId={parentId}
                subcategoryId={subcategoryId}
                onChange={(p, s) => { setParentId(p); setSubcategoryId(s); }}
              />
            )}
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={applyClientType} onCheckedChange={(v) => setApplyClientType(!!v)} />
              <span className="font-medium text-sm">Set Client Type</span>
            </label>
            {applyClientType && (
              <ClientTypePicker value={clientType} onChange={setClientType} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isUpdating || (!applyCategory && !applyClientType)}
          >
            {isUpdating ? 'Updating…' : `Update ${selectedCompanyIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
