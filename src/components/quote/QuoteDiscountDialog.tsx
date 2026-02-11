/**
 * QUOTE DISCOUNT DIALOG
 * 
 * Dialog for applying a discount to the quote subtotal.
 * Supports either percentage or fixed amount discount.
 */
import { useState, useEffect } from 'react';
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
  subtotal: number;
  onSave: (discountPercent: number, discountAmount: number, discountLabel: string) => Promise<void>;
  isSaving?: boolean;
}

export function QuoteDiscountDialog({
  open,
  onOpenChange,
  currentDiscountPercent,
  currentDiscountAmount,
  currentDiscountLabel,
  subtotal,
  onSave,
  isSaving = false,
}: QuoteDiscountDialogProps) {
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(
    currentDiscountAmount > 0 ? 'amount' : 'percent'
  );
  const [percentValue, setPercentValue] = useState(currentDiscountPercent || 0);
  const [amountValue, setAmountValue] = useState(currentDiscountAmount || 0);
  const [labelValue, setLabelValue] = useState(currentDiscountLabel || '');

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
    }
  }, [open, currentDiscountPercent, currentDiscountAmount, currentDiscountLabel]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const calculateDiscountedTotal = () => {
    if (discountType === 'percent') {
      return subtotal * (1 - percentValue / 100);
    } else {
      return Math.max(0, subtotal - amountValue);
    }
  };

  const getDiscountDisplay = () => {
    if (discountType === 'percent') {
      if (percentValue <= 0) return 'None';
      return `${percentValue}% (${formatCurrency(subtotal * (percentValue / 100))})`;
    } else {
      if (amountValue <= 0) return 'None';
      return formatCurrency(amountValue);
    }
  };

  const handleSave = async () => {
    if (discountType === 'percent') {
      await onSave(percentValue, 0, labelValue);
    } else {
      await onSave(0, amountValue, labelValue);
    }
    onOpenChange(false);
  };

  const handleClear = async () => {
    setPercentValue(0);
    setAmountValue(0);
    setLabelValue('');
    await onSave(0, 0, '');
    onOpenChange(false);
  };

  const hasDiscount = discountType === 'percent' ? percentValue > 0 : amountValue > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
          <DialogDescription>
            Add a discount to the quote subtotal. Choose between a percentage or fixed amount.
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
            <p className="text-xs text-muted-foreground">
              Choose a preset or enter a custom label
            </p>
          </div>

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
                <p className="text-xs text-muted-foreground">
                  Enter a percentage between 0 and 100
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Enter a fixed dollar amount to deduct
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
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
