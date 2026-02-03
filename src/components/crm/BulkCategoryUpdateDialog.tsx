/**
 * BULK CATEGORY UPDATE DIALOG
 * 
 * Admin-only dialog to set category on multiple companies at once.
 */
import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useCompanyCategories } from '@/hooks/useCompanyCategories';

interface BulkCategoryUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanyIds: string[];
  onComplete: () => void;
}

export function BulkCategoryUpdateDialog({
  open,
  onOpenChange,
  selectedCompanyIds,
  onComplete,
}: BulkCategoryUpdateDialogProps) {
  const { isAdmin } = useAuth();
  const { data: categories = [], isLoading: categoriesLoading } = useCompanyCategories();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Only Admin can use bulk update
  if (!isAdmin) {
    return null;
  }

  const handleBulkUpdate = async () => {
    if (!selectedCategory || selectedCompanyIds.length === 0) return;

    setIsUpdating(true);
    try {
      // Use null for "none" option to clear category
      const categoryValue = selectedCategory === '__none__' ? null : selectedCategory;

      // Bulk update companies
      const { error } = await supabase
        .from('clients')
        .update({ category_id: categoryValue })
        .in('id', selectedCompanyIds);

      if (error) throw error;

      const categoryName = selectedCategory === '__none__' 
        ? 'None' 
        : categories.find(c => c.id === selectedCategory)?.name || 'Unknown';
      
      toast.success(`Updated category to "${categoryName}" for ${selectedCompanyIds.length} ${selectedCompanyIds.length === 1 ? 'company' : 'companies'}`);
      onOpenChange(false);
      setSelectedCategory('');
      onComplete();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update categories');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectedCategory('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Category Update</DialogTitle>
          <DialogDescription>
            Set category for {selectedCompanyIds.length} selected {selectedCompanyIds.length === 1 ? 'company' : 'companies'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Category</label>
            <Select 
              value={selectedCategory} 
              onValueChange={setSelectedCategory}
              disabled={categoriesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">None (clear category)</span>
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={!selectedCategory || isUpdating}
          >
            {isUpdating ? 'Updating...' : `Update ${selectedCompanyIds.length} Companies`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
