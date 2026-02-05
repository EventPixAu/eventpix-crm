/**
 * EDIT QUOTE ITEM DIALOG
 * 
 * Allows inline editing of quote line item details:
 * description, quantity, unit price, tax rate, group
 */
import { useState, useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuoteItem } from '@/hooks/useQuoteItems';
import { useProductCategories } from '@/hooks/useProducts';

interface EditQuoteItemDialogProps {
  item: QuoteItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, updates: {
    description?: string;
    quantity?: number;
    unit_price?: number;
    tax_rate?: number;
    group_label?: string | null;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function EditQuoteItemDialog({
  item,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: EditQuoteItemDialogProps) {
  const { data: categories = [] } = useProductCategories();
  
  // Use category names as group labels, with "Other" as fallback
  const groupLabels = useMemo(() => {
    const categoryNames = categories
      .filter(c => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => c.name);
    // Always include "Other" as a fallback option
    if (!categoryNames.includes('Other')) {
      categoryNames.push('Other');
    }
    return categoryNames;
  }, [categories]);

  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [taxRate, setTaxRate] = useState(10);
  const [groupLabel, setGroupLabel] = useState('');

  // Sync state when item changes
  useEffect(() => {
    if (item) {
      setDescription(item.description || '');
      setQuantity(item.quantity || 1);
      setUnitPrice(item.unit_price || 0);
      setTaxRate((item.tax_rate || 0) * 100);
      setGroupLabel(item.group_label || '');
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    
    await onSave(item.id, {
      description,
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate / 100,
      group_label: groupLabel || null,
    });
    
    onOpenChange(false);
  };

  const lineTotal = quantity * unitPrice * (1 + taxRate / 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Line Item</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {item?.product && (
            <div className="pb-3 border-b">
              <Label className="text-muted-foreground text-xs">Product</Label>
              <p className="font-medium text-lg">{item.product.name}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              {item?.product?.description && item.product.description !== description && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setDescription(item.product!.description || '')}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Product Description
                </Button>
              )}
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Item description - this appears on the quote"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Unit Price</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Group</Label>
            <Select value={groupLabel} onValueChange={setGroupLabel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groupLabels.map((label) => (
                  <SelectItem key={label} value={label}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Line Total (inc. tax)</span>
              <span className="text-lg font-semibold">{formatCurrency(lineTotal)}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !description.trim()}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
