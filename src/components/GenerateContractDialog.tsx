/**
 * GENERATE CONTRACT DIALOG
 * 
 * Dialog to generate a contract from a template.
 * Used in QuoteDetail and ContractList pages.
 */
import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { FileSignature, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { 
  useActiveContractTemplates, 
  useGenerateContractFromTemplate,
  renderMergeFields,
  MergeFieldContext
} from '@/hooks/useContractTemplates';

interface GenerateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
  clientContactName?: string;
  leadId?: string | null;
  quoteId?: string | null;
  eventId?: string | null;
  quoteNumber?: string | null;
  quoteTotal?: number | null;
  venueName?: string | null;
  venueAddress?: string | null;
  sessions?: Array<{ session_date: string; start_time?: string | null; end_time?: string | null }>;
  onSuccess?: (contractId: string) => void;
}

export function GenerateContractDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientContactName,
  leadId,
  quoteId,
  eventId,
  quoteNumber,
  quoteTotal,
  venueName,
  venueAddress,
  sessions,
  onSuccess,
}: GenerateContractDialogProps) {
  const { toast } = useToast();
  const { data: templates } = useActiveContractTemplates();
  const generateContract = useGenerateContractFromTemplate();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  // Build preview context
  const previewContext: MergeFieldContext = {
    client: {
      business_name: clientName || null,
      primary_contact_name: clientContactName || null,
    },
    event: {
      venue_name: venueName || null,
      venue_address: venueAddress || null,
    },
    sessions: sessions || [],
    quote: {
      quote_number: quoteNumber || null,
      total_estimate: quoteTotal || null,
    },
  };

  const previewHtml = selectedTemplate 
    ? renderMergeFields(selectedTemplate.body_html, previewContext)
    : '';

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTemplateId('');
      setTitle('');
      setShowPreview(false);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!selectedTemplateId || !title.trim()) {
      toast({ title: 'Please select a template and enter a title', variant: 'destructive' });
      return;
    }

    const result = await generateContract.mutateAsync({
      templateId: selectedTemplateId,
      clientId,
      leadId,
      quoteId,
      eventId,
      title: title.trim(),
    });

    onOpenChange(false);
    
    if (onSuccess && result?.id) {
      onSuccess(result.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showPreview ? "max-w-5xl max-h-[90vh] overflow-y-auto" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Generate Contract
          </DialogTitle>
          <DialogDescription>
            Generate a contract from a template with merge fields filled in.
          </DialogDescription>
        </DialogHeader>
        
        <div className={showPreview ? "grid grid-cols-2 gap-6" : ""}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template">Contract Template *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Contract Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Photography Services Agreement"
              />
            </div>

            {clientName && (
              <Card className="bg-muted">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    This contract will be generated for:
                  </p>
                  <p className="font-medium">{clientName}</p>
                  {quoteNumber && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Quote: {quoteNumber}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedTemplateId && !showPreview && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Contract
              </Button>
            )}
          </div>

          {showPreview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  Hide Preview
                </Button>
              </div>
              <div className="border rounded-lg p-4 bg-white max-h-[400px] overflow-y-auto">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={!selectedTemplateId || !title.trim() || generateContract.isPending}
          >
            {generateContract.isPending ? 'Generating...' : 'Generate Contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
