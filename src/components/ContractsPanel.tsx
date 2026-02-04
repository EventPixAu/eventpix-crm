/**
 * CONTRACTS PANEL
 * 
 * Studio Ninja-style contracts panel for Lead and Job detail pages.
 * Shows contracts list with actions: Create, Preview, Send, Sign, Duplicate, Delete.
 */
import { useState, useMemo } from 'react';
import { getPublicBaseUrl } from '@/lib/utils';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import {
  FileSignature,
  Plus,
  Eye,
  CheckCircle,
  Copy,
  Link2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Mail,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Contract,
  useLeadContracts,
  useEventContracts,
  useMarkContractAsSent,
  useSignContractInternal,
  useCreateContract,
  useDeleteContract,
  useUpdateContract,
} from '@/hooks/useContracts';
import { 
  useActiveContractTemplates,
  useGenerateContractFromTemplate,
} from '@/hooks/useContractTemplates';
import { useQueryClient } from '@tanstack/react-query';
import { SendEmailDialog } from '@/components/SendEmailDialog';

interface ContractsPanelProps {
  leadId?: string;
  eventId?: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  quoteId?: string;
  leadName?: string;
  eventName?: string;
  eventDate?: string;
  defaultOpen?: boolean;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'signed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'sent':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'draft':
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function ContractsPanel({
  leadId,
  eventId,
  clientId,
  clientName,
  clientEmail,
  quoteId,
  leadName,
  eventName,
  eventDate,
  defaultOpen = false,
}: ContractsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Data hooks
  const { data: leadContracts = [] } = useLeadContracts(leadId);
  const { data: eventContracts = [] } = useEventContracts(eventId);
  const { data: templates = [] } = useActiveContractTemplates();
  
  // Mutation hooks
  const generateContract = useGenerateContractFromTemplate();
  const markAsSent = useMarkContractAsSent();
  const signContract = useSignContractInternal();
  const createContract = useCreateContract();
  const deleteContract = useDeleteContract();
  const updateContract = useUpdateContract();
  
  // State
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contractTitle, setContractTitle] = useState('');
  const [editContractHtml, setEditContractHtml] = useState('');
  const [editContractTitle, setEditContractTitle] = useState('');
  const [editMode, setEditMode] = useState<'plain' | 'html'>('plain');
  const [signedByName, setSignedByName] = useState('');
  const [signedByEmail, setSignedByEmail] = useState('');
  
  // Convert HTML to plain text for editing
  const htmlToPlainText = (html: string): string => {
    // Replace <br> and block elements with newlines
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/tr>/gi, '\n')
      // Convert bold
      .replace(/<strong>([^<]*)<\/strong>/gi, '**$1**')
      .replace(/<b>([^<]*)<\/b>/gi, '**$1**')
      // Convert italic
      .replace(/<em>([^<]*)<\/em>/gi, '*$1*')
      .replace(/<i>([^<]*)<\/i>/gi, '*$1*')
      // Convert underline
      .replace(/<u>([^<]*)<\/u>/gi, '~~$1~~')
      // Convert links
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, '[$2]($1)');
    
    // Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value;
    
    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    return text;
  };
  
  // Convert plain text (with markdown) to HTML
  const plainTextToHtml = (text: string): string => {
    let html = text;
    
    // Escape HTML entities first
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #0891b2; text-decoration: underline;">$1</a>');
    
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Underline: ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<u>$1</u>');
    
    // Convert newlines to <br>
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in a styled div
    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6;">${html}</div>`;
  };
  
  // Derived plain text for editing
  const editContractPlainText = useMemo(() => {
    return htmlToPlainText(editContractHtml);
  }, [editContractHtml]);
  
  // Handle plain text changes - convert to HTML
  const handlePlainTextChange = (plainText: string) => {
    setEditContractHtml(plainTextToHtml(plainText));
  };
  
  // Combine contracts from lead and event
  const contracts = leadId ? leadContracts : eventContracts;

  
  const handleCreateContract = async () => {
    if (!selectedTemplateId || !contractTitle) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    
    try {
      await generateContract.mutateAsync({
        templateId: selectedTemplateId,
        clientId,
        leadId: leadId || null,
        eventId: eventId || null,
        quoteId: quoteId || null,
        title: contractTitle,
      });
      
      setIsCreateOpen(false);
      setSelectedTemplateId('');
      setContractTitle('');
      
      // Invalidate relevant queries
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'lead', leadId] });
      }
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'event', eventId] });
      }
    } catch (error) {
      // Error handled by hook
    }
  };
  
  // Open send email dialog for a contract
  // For draft contracts, we generate the token FIRST so the email contains the correct signing URL
  const openSendEmailDialog = async (contract: Contract) => {
    // If the contract is a draft without a token, generate one first
    if (contract.status === 'draft' && !contract.public_token) {
      try {
        const result = await markAsSent.mutateAsync(contract.id);
        // Update contract with the new token and status
        const updatedContract = { 
          ...contract, 
          public_token: result.public_token || null, 
          status: 'sent' as const 
        };
        setSelectedContract(updatedContract);
        setIsSendEmailOpen(true);
      } catch (error) {
        // Error handled by hook - don't open dialog if token generation failed
        return;
      }
    } else {
      // Contract already has a token (resending)
      setSelectedContract(contract);
      setIsSendEmailOpen(true);
    }
  };
  
  // Handle successful email send - no longer needs to mark as sent since we do it before opening dialog
  const handleContractEmailSent = async () => {
    // Token already generated in openSendEmailDialog, just close and cleanup
  };
  
  // Get the contract signing URL using public base URL for client-facing links
  const getContractSignUrl = (contract: Contract | null) => {
    if (!contract?.public_token) return undefined;
    return `${getPublicBaseUrl()}/contract/sign/${contract.public_token}`;
  };
  
  const handleSignContract = async () => {
    if (!selectedContract) return;
    
    try {
      await signContract.mutateAsync({
        contractId: selectedContract.id,
        signedByName: signedByName || undefined,
        signedByEmail: signedByEmail || undefined,
      });
      
      setIsSignOpen(false);
      setSelectedContract(null);
      setSignedByName('');
      setSignedByEmail('');
      
      // Invalidate workflow queries to show updated step status
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['workflow-instance', 'lead', leadId] });
      }
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['workflow-instance', 'job', eventId] });
      }
    } catch (error) {
      // Error handled by hook
    }
  };
  
  const handleDuplicate = async (contract: Contract) => {
    try {
      await createContract.mutateAsync({
        client_id: clientId,
        lead_id: leadId || null,
        quote_id: contract.quote_id,
        title: `${contract.title} (Copy)`,
        status: 'draft',
      });
      toast({ title: 'Contract duplicated' });
    } catch (error) {
      // Error handled by hook
    }
  };
  
  const openPreview = (contract: Contract) => {
    setSelectedContract(contract);
    setIsPreviewOpen(true);
  };
  
  const openSignDialog = (contract: Contract) => {
    setSelectedContract(contract);
    setIsSignOpen(true);
  };
  
  const copyPublicLink = async (contract: Contract) => {
    if (contract.public_token) {
      const publicUrl = `${getPublicBaseUrl()}/contract/sign/${contract.public_token}`;
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Signing link copied to clipboard' });
    }
  };
  
  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    
    try {
      await deleteContract.mutateAsync(selectedContract.id);
      setIsDeleteOpen(false);
      setSelectedContract(null);
    } catch (error) {
      // Error handled by hook
    }
  };
  
  const openDeleteDialog = (contract: Contract) => {
    setSelectedContract(contract);
    setIsDeleteOpen(true);
  };
  
  // Open edit dialog for a draft contract
  const openEditDialog = (contract: Contract) => {
    setSelectedContract(contract);
    setEditContractTitle(contract.title);
    setEditContractHtml(contract.rendered_html || '');
    setIsEditOpen(true);
  };
  
  // Handle saving edited contract content
  const handleSaveContract = async () => {
    if (!selectedContract || !editContractTitle) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    
    try {
      await updateContract.mutateAsync({
        id: selectedContract.id,
        title: editContractTitle,
        rendered_html: editContractHtml,
      });
      
      setIsEditOpen(false);
      setSelectedContract(null);
      setEditContractHtml('');
      setEditContractTitle('');
      
      // Invalidate relevant queries
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'lead', leadId] });
      }
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'event', eventId] });
      }
    } catch (error) {
      // Error handled by hooks
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-card border rounded-lg overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">Contracts</span>
                {contracts.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {contracts.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreateOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 border-t">
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No contracts yet
                </p>
              ) : (
                <div className="space-y-2 pt-4">
                  {contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileSignature className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{contract.title}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs shrink-0 ${getStatusColor(contract.status)}`}
                        >
                          {contract.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Preview */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPreview(contract)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {/* Edit (only for draft contracts) */}
                        {contract.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(contract)}
                            title="Edit Contract"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Send Email (for draft contracts) */}
                        {contract.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSendEmailDialog(contract)}
                            disabled={markAsSent.isPending}
                            title="Send Contract"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Copy Link (for sent contracts) */}
                        {contract.status === 'sent' && contract.public_token && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSendEmailDialog(contract)}
                              title="Resend Contract Email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyPublicLink(contract)}
                              title="Copy Signing Link"
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {/* Sign (for sent contracts) */}
                        {contract.status === 'sent' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSignDialog(contract)}
                            title="Sign Contract"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Duplicate */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(contract)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        
                        {/* Delete (only for draft contracts) */}
                        {contract.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(contract)}
                            title="Delete"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Signed info */}
                        {contract.status === 'signed' && contract.signed_at && (
                          <span className="text-xs text-muted-foreground ml-2">
                            Signed {format(new Date(contract.signed_at), 'd MMM')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Create Contract Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contract</DialogTitle>
            <DialogDescription>
              Select a template to generate a new contract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template">Template *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
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
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                placeholder="Photography Agreement"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateContract} 
              disabled={generateContract.isPending || !selectedTemplateId || !contractTitle}
            >
              {generateContract.isPending ? 'Creating...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>
              Edit the contract content directly. Changes are saved when you click "Save Changes".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2">
              <Label htmlFor="editTitle">Contract Title</Label>
              <Input
                id="editTitle"
                value={editContractTitle}
                onChange={(e) => setEditContractTitle(e.target.value)}
                placeholder="Photography Agreement"
              />
            </div>
            
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <Tabs value={editMode} onValueChange={(v) => setEditMode(v as 'plain' | 'html')} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Label>Contract Content</Label>
                  <TabsList className="h-8">
                    <TabsTrigger value="plain" className="text-xs px-3">Plain Text</TabsTrigger>
                    <TabsTrigger value="html" className="text-xs px-3">HTML</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="plain" className="flex-1 overflow-hidden m-0">
                  <div className="space-y-2 h-full flex flex-col">
                    <p className="text-xs text-muted-foreground">
                      Use **bold**, *italic*, ~~underline~~, and [link text](url) for formatting.
                    </p>
                    <Textarea
                      value={editContractPlainText}
                      onChange={(e) => handlePlainTextChange(e.target.value)}
                      placeholder="Contract content..."
                      className="flex-1 min-h-[350px] text-sm resize-none"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="html" className="flex-1 overflow-hidden m-0">
                  <Textarea
                    value={editContractHtml}
                    onChange={(e) => setEditContractHtml(e.target.value)}
                    placeholder="<p>Contract content...</p>"
                    className="flex-1 min-h-[380px] font-mono text-xs resize-none"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveContract} 
              disabled={updateContract.isPending || !editContractTitle}
            >
              {updateContract.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContract?.title}</DialogTitle>
            <DialogDescription>
              Status: {selectedContract?.status}
              {selectedContract?.sent_at && ` • Sent: ${format(new Date(selectedContract.sent_at), 'PPp')}`}
              {selectedContract?.signed_at && ` • Signed: ${format(new Date(selectedContract.signed_at), 'PPp')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-6 bg-white text-gray-900">
            <div 
              className="prose prose-sm max-w-none prose-gray"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedContract?.rendered_html || '') }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Contract Dialog */}
      <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Contract</DialogTitle>
            <DialogDescription>
              Simulate signing this contract. This will mark it as signed and trigger workflow steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signedByName">Signed By (Name)</Label>
              <Input
                id="signedByName"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signedByEmail">Signed By (Email)</Label>
              <Input
                id="signedByEmail"
                type="email"
                value={signedByEmail}
                onChange={(e) => setSignedByEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSignContract} 
              disabled={signContract.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {signContract.isPending ? 'Signing...' : 'Sign Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedContract?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContract}
              disabled={deleteContract.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContract.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Contract Email Dialog */}
      <SendEmailDialog
        open={isSendEmailOpen}
        onOpenChange={(open) => {
          setIsSendEmailOpen(open);
          if (!open) setSelectedContract(null);
        }}
        clientId={clientId}
        clientEmail={clientEmail}
        clientName={clientName}
        relatedContractId={selectedContract?.id}
        contractHtml={selectedContract?.rendered_html || undefined}
        contractTitle={selectedContract?.title}
        defaultSubject={`Your Agreement with EventPix - ${eventName || leadName || ''}`}
        defaultBody={`Hi {{contact.first_name}},

Thank you for accepting the budget for your upcoming event. This agreement will now lock in the event with EventPix.

Please click the link below to review and sign the agreement:

{{contract.link}}

If you have any questions, please don't hesitate to reach out.

Regards,
The EventPix Team`}
        context="contract"
        mergeContext={{
          eventName: eventName,
          leadName: leadName,
          eventDate: eventDate,
          contractSignUrl: getContractSignUrl(selectedContract),
        }}
        onSendSuccess={handleContractEmailSent}
      />
    </>
  );
}