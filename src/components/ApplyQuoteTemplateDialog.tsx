/**
 * APPLY QUOTE TEMPLATE DIALOG
 * 
 * Dialog for selecting and applying a quote template to a quote.
 * Adds template items to the quote (items are editable after).
 */
import { useState } from 'react';
import { FileText, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useActiveQuoteTemplates, QuoteTemplate } from '@/hooks/useQuoteTemplates';
import { useCreateQuoteItem } from '@/hooks/useQuoteItems';
import { useUpdateQuote } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';

interface ApplyQuoteTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  onApplied?: () => void;
}

export function ApplyQuoteTemplateDialog({
  open,
  onOpenChange,
  quoteId,
  onApplied,
}: ApplyQuoteTemplateDialogProps) {
  const { toast } = useToast();
  const { data: templates, isLoading } = useActiveQuoteTemplates();
  const createItem = useCreateQuoteItem();
  const updateQuote = useUpdateQuote();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [applying, setApplying] = useState(false);

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const handleApply = async () => {
    if (!selectedTemplate) return;

    setApplying(true);
    try {
      // Add all template items to the quote
      for (const item of selectedTemplate.items_json) {
        await createItem.mutateAsync({
          quote_id: quoteId,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        });
      }

      // Update quote terms if template has terms
      if (selectedTemplate.terms_text) {
        await updateQuote.mutateAsync({
          id: quoteId,
          terms_text: selectedTemplate.terms_text,
        });
      }

      toast({ 
        title: 'Template applied', 
        description: `Added ${selectedTemplate.items_json.length} items from "${selectedTemplate.name}"` 
      });
      
      setSelectedTemplateId('');
      onOpenChange(false);
      onApplied?.();
    } catch (err: any) {
      toast({ title: 'Failed to apply template', description: err.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Apply Quote Template
          </DialogTitle>
          <DialogDescription>
            Select a template to add predefined items to this quote. Items can be edited after.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Select Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Loading...' : 'Choose a template'} />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
                {!templates?.length && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No templates available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <div>
                <h4 className="font-medium">{selectedTemplate.name}</h4>
                {selectedTemplate.description && (
                  <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  Items
                  <Badge variant="secondary">{selectedTemplate.items_json.length}</Badge>
                </div>
                <ul className="text-sm space-y-1">
                  {selectedTemplate.items_json.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span className="truncate flex-1">{item.description}</span>
                      <span className="text-muted-foreground ml-2">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </span>
                    </li>
                  ))}
                  {selectedTemplate.items_json.length > 5 && (
                    <li className="text-muted-foreground italic">
                      +{selectedTemplate.items_json.length - 5} more items...
                    </li>
                  )}
                </ul>
              </div>

              {selectedTemplate.terms_text && (
                <div className="text-sm">
                  <span className="font-medium">Terms: </span>
                  <span className="text-muted-foreground">
                    {selectedTemplate.terms_text.slice(0, 100)}
                    {selectedTemplate.terms_text.length > 100 ? '...' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={!selectedTemplateId || applying}
          >
            {applying ? (
              'Applying...'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Apply Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
