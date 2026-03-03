/**
 * QUOTE DISCOUNT DIALOG
 * 
 * Dialog for applying a discount to the quote subtotal.
 * Supports either percentage or fixed amount discount.
 * Supports per-group discount targeting.
 */
import { useState, useEffect, useMemo } from 'react';
import { Percent, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DISCOUNT_PRESETS = [
  'NFP 20%',
  'Multi-day Discount',
  'Repeat Client',
  'Producer Discount',
  'Charity Rate',
  'Early Bird',
];

interface QuoteDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDiscountPercent: number;
  currentDiscountAmount: number;
  currentDiscountLabel: string;
  currentDiscountGroups: string[] | null;
  subtotal: number;
  /** Map of group_label → subtotal for that group */
  groupSubtotals: Record<string, number>;
  onSave: (discountPercent: number, discountAmount: number, discountLabel: string, discountGroups: string[] | null) => Promise<void>;
  isSaving?: boolean;
}

export function QuoteDiscountDialog({
  open,
  onOpenChange,
  currentDiscountPercent,
  currentDiscountAmount,
  currentDiscountLabel,
  currentDiscountGroups,
  subtotal,
  groupSubtotals,
  onSave,
  isSaving = false,
}: QuoteDiscountDialogProps) {
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(
    currentDiscountAmount > 0 ? 'amount' : 'percent'
  );
  const [percentValue, setPercentValue] = useState(currentDiscountPercent || 0);
  const [amountValue, setAmountValue] = useState(currentDiscountAmount || 0);
  const [labelValue, setLabelValue] = useState(currentDiscountLabel || '');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [applyToAll, setApplyToAll] = useState(true);

  const availableGroups = useMemo(() => Object.keys(groupSubtotals).sort(), [groupSubtotals]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setLabelValue(currentDiscountLabel || '');
      if (currentDiscountAmount > 0) {
        setDiscountType('amount');
        setAmountValue(currentDiscountAmount);
        setPercentValue(0);
      } else {
        setDiscountType('percent');
        setPercentValue(currentDiscountPercent || 0);
        setAmountValue(0);
      }
      if (currentDiscountGroups && currentDiscountGroups.length > 0) {
        setApplyToAll(false);
        setSelectedGroups(currentDiscountGroups);
      } else {
        setApplyToAll(true);
        setSelectedGroups([]);
      }
    }
  }, [open, currentDiscountPercent, currentDiscountAmount, currentDiscountLabel, currentDiscountGroups]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const discountableSubtotal = useMemo(() => {
    if (applyToAll) return subtotal;
    return selectedGroups.reduce((sum, g) => sum + (groupSubtotals[g] || 0), 0);
  }, [applyToAll, selectedGroups, groupSubtotals, subtotal]);

  const calculateDiscountedTotal = () => {
    const discountBase = discountableSubtotal;
    const nonDiscountable = subtotal - discountBase;
    if (discountType === 'percent') {
      return nonDiscountable + discountBase * (1 - percentValue / 100);
    } else {
      return nonDiscountable + Math.max(0, discountBase - amountValue);
    }
  };

  const getDiscountDisplay = () => {
    if (discountType === 'percent') {
      if (percentValue <= 0) return 'None';
      return `${percentValue}% (${formatCurrency(discountableSubtotal * (percentValue / 100))})`;
    } else {
      if (amountValue <= 0) return 'None';
      return formatCurrency(amountValue);
    }
  };

  const handleSave = async () => {
    const groups = applyToAll ? null : (selectedGroups.length > 0 ? selectedGroups : null);
    if (discountType === 'percent') {
      await onSave(percentValue, 0, labelValue, groups);
    } else {
      await onSave(0, amountValue, labelValue, groups);
    }
    onOpenChange(false);
  };

  const handleClear = async () => {
    setPercentValue(0);
    setAmountValue(0);
    setLabelValue('');
    setSelectedGroups([]);
    setApplyToAll(true);
    await onSave(0, 0, '', null);
    onOpenChange(false);
  };

  const toggleGroup = (group: string) => {
    setSelectedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const hasDiscount = discountType === 'percent' ? percentValue > 0 : amountValue > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
          <DialogDescription>
            Add a discount to the quote. You can apply it to all groups or select specific ones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Discount Label */}
          <div className="space-y-2">
            <Label>Discount Name</Label>
            <Select
              value={DISCOUNT_PRESETS.includes(labelValue) ? labelValue : '_custom'}
              onValueChange={(val) => {
                if (val === '_custom') {
                  setLabelValue('');
                } else {
                  setLabelValue(val);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a discount type" />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                ))}
                <SelectItem value="_custom">Custom...</SelectItem>
              </SelectContent>
            </Select>
            {(!DISCOUNT_PRESETS.includes(labelValue)) && (
              <Input
                type="text"
                placeholder="Enter custom discount name"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
              />
            )}
          </div>

          {/* Apply To Groups */}
          {availableGroups.length > 1 && (
            <div className="space-y-2">
              <Label>Apply To</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="apply-all"
                    checked={applyToAll}
                    onCheckedChange={(checked) => {
                      setApplyToAll(!!checked);
                      if (checked) setSelectedGroups([]);
                    }}
                  />
                  <label htmlFor="apply-all" className="text-sm font-medium cursor-pointer">
                    All groups
                  </label>
                </div>
                {!applyToAll && (
                  <div className="ml-6 space-y-1.5 border-l-2 border-muted pl-3">
                    {availableGroups.map((group) => (
                      <div key={group} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`group-${group}`}
                            checked={selectedGroups.includes(group)}
                            onCheckedChange={() => toggleGroup(group)}
                          />
                          <label htmlFor={`group-${group}`} className="text-sm cursor-pointer">
                            {group}
                          </label>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(groupSubtotals[group] || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <Tabs value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'amount')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percent" className="gap-2">
                <Percent className="h-4 w-4" />
                Percentage
              </TabsTrigger>
              <TabsTrigger value="amount" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Fixed Amount
              </TabsTrigger>
            </TabsList>

            <TabsContent value="percent" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Discount Percentage</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={percentValue}
                    onChange={(e) => setPercentValue(Number(e.target.value) || 0)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="amount" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Discount Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={amountValue}
                    onChange={(e) => setAmountValue(Number(e.target.value) || 0)}
                    className="pl-8"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {applyToAll ? 'Subtotal' : 'Discountable subtotal'}
              </span>
              <span>{formatCurrency(discountableSubtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className={hasDiscount ? 'text-green-600' : ''}>
                {hasDiscount ? '-' : ''}{getDiscountDisplay()}
              </span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>New Subtotal</span>
              <span>{formatCurrency(calculateDiscountedTotal())}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {(currentDiscountPercent > 0 || currentDiscountAmount > 0) && (
            <Button 
              variant="outline" 
              onClick={handleClear} 
              disabled={isSaving}
              className="sm:mr-auto"
            >
              Remove Discount
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Apply Discount'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
