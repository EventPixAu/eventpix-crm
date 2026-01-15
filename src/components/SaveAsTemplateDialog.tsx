/**
 * SAVE AS TEMPLATE DIALOG
 * 
 * Dialog for creating a quote template from an existing quote.
 */
import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateTemplateFromQuote } from '@/hooks/useQuoteTemplates';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  defaultName?: string;
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  quoteId,
  defaultName = '',
}: SaveAsTemplateDialogProps) {
  const createTemplate = useCreateTemplateFromQuote();
  
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;

    await createTemplate.mutateAsync({
      quoteId,
      templateName: name.trim(),
      templateDescription: description.trim() || undefined,
    });

    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Create a reusable template from this quote's items and terms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wedding Photography Package"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this template includes..."
              rows={3}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            This will save the current line items and terms as a template that can be applied to future quotes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || createTemplate.isPending}
          >
            {createTemplate.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
