/**
 * CONTRACT DETAIL PAGE
 * 
 * Displays contract details with actions for sending, signing, and managing.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, FileText, Building2, Mail, Upload, ExternalLink, 
  CheckCircle, Clock, XCircle, FileSignature, Copy, RefreshCw,
  Link as LinkIcon, User
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  useContract, 
  useUpdateContract, 
  useUploadContractFile,
  useMarkContractAsSent,
  useRegenerateContractToken 
} from '@/hooks/useContracts';
import { SendEmailDialog } from '@/components/SendEmailDialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ComponentType<any> }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  sent: { label: 'Sent', variant: 'outline', icon: Clock },
  signed: { label: 'Signed', variant: 'default', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
};

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: contract, isLoading } = useContract(id);
  const updateContract = useUpdateContract();
  const uploadFile = useUploadContractFile();
  const markAsSent = useMarkContractAsSent();
  const regenerateToken = useRegenerateContractToken();
  
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isLocked = contract?.status === 'signed' || contract?.status === 'cancelled';
  const clientData = contract?.client as any;
  
  // Generate the public signing URL
  const getPublicSigningUrl = () => {
    if (!contract?.public_token) return null;
    return `${window.location.origin}/contract/sign/${contract.public_token}`;
  };

  const handleCopyLink = () => {
    const url = getPublicSigningUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      toast({ title: 'Signing link copied to clipboard' });
    }
  };

  const handleRegenerateToken = async () => {
    if (!id) return;
    await regenerateToken.mutateAsync(id);
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.length) return;
    
    setUploading(true);
    try {
      const file = e.target.files[0];
      const fileUrl = await uploadFile.mutateAsync({ file, contractId: id });
      
      await updateContract.mutateAsync({
        id,
        file_url: fileUrl,
      });
      
      toast({ title: 'Contract file uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Failed to upload file', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleMarkAsSent = async () => {
    if (!id) return;
    await markAsSent.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!contract) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Contract not found</h2>
          <Button variant="link" onClick={() => navigate('/sales/contracts')}>
            Back to Contracts
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const publicSigningUrl = getPublicSigningUrl();

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales/contracts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{contract.title}</h1>
              <Badge variant={statusConfig.variant}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created {contract.created_at ? format(new Date(contract.created_at), 'PPP') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contract.file_url && (
            <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Document
              </Button>
            </a>
          )}
          {!isLocked && (
            <>
              <Button variant="outline" onClick={() => setIsEmailDialogOpen(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              {contract.status === 'draft' && (
                <Button onClick={handleMarkAsSent} disabled={markAsSent.isPending}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  {markAsSent.isPending ? 'Sending...' : 'Mark as Sent'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Public Signing Link */}
          {publicSigningUrl && !isLocked && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <LinkIcon className="h-5 w-5" />
                  Client Signing Link
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Share this link with your client to let them sign the contract
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input 
                    value={publicSigningUrl} 
                    readOnly 
                    className="font-mono text-sm bg-white"
                  />
                  <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRegenerateToken}
                    disabled={regenerateToken.isPending}
                    title="Regenerate link (invalidates old link)"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateToken.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Regenerating the link will invalidate any previously shared links.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Contract File */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Document</CardTitle>
              <CardDescription>Upload or view the contract document</CardDescription>
            </CardHeader>
            <CardContent>
              {contract.file_url ? (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">Contract Document</p>
                      <p className="text-sm text-muted-foreground">PDF or document file</p>
                    </div>
                  </div>
                  <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No document uploaded yet</p>
                  {!isLocked && (
                    <div>
                      <Input
                        type="file"
                        id="contract-file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileUpload}
                      />
                      <Button asChild disabled={uploading}>
                        <label htmlFor="contract-file" className="cursor-pointer">
                          {uploading ? 'Uploading...' : 'Upload Document'}
                        </label>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Records */}
          <Card>
            <CardHeader>
              <CardTitle>Related Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.lead && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lead</span>
                  <Link to={`/sales/leads`} className="font-medium text-primary hover:underline">
                    {(contract.lead as any).lead_name}
                  </Link>
                </div>
              )}
              {contract.quote && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Quote</span>
                  <Link to={`/sales/quotes/${(contract.quote as any).id}`} className="font-medium text-primary hover:underline">
                    {(contract.quote as any).quote_number || 'View Quote'}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contract Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Client</div>
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4" />
                  {clientData?.business_name || 'No client'}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="flex items-center gap-2 font-medium">
                  <StatusIcon className="h-4 w-4" />
                  {statusConfig.label}
                </div>
              </div>

              {contract.sent_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Sent</div>
                    <div className="font-medium">
                      {format(new Date(contract.sent_at), 'PPP')}
                    </div>
                  </div>
                </>
              )}

              {contract.signed_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Signed</div>
                    <div className="font-medium text-green-600">
                      {format(new Date(contract.signed_at), 'PPP')}
                    </div>
                  </div>
                </>
              )}

              {contract.signed_by_name && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Signed By</div>
                    <div className="flex items-center gap-2 font-medium">
                      <User className="h-4 w-4" />
                      {contract.signed_by_name}
                    </div>
                    {contract.signed_by_email && (
                      <div className="text-sm text-muted-foreground">
                        {contract.signed_by_email}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className={contract.status === 'signed' ? 'bg-green-50 border-green-200' : ''}>
            <CardContent className="pt-6">
              <div className="text-center">
                <StatusIcon className={`h-12 w-12 mx-auto mb-2 ${contract.status === 'signed' ? 'text-green-600' : 'text-muted-foreground'}`} />
                <div className="font-semibold text-lg">{statusConfig.label}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {contract.status === 'draft' && 'Ready to send to client'}
                  {contract.status === 'sent' && 'Awaiting client signature'}
                  {contract.status === 'signed' && 'Contract is complete'}
                  {contract.status === 'cancelled' && 'Contract was cancelled'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        clientId={contract.client_id}
        clientEmail={clientData?.primary_contact_email}
        clientName={clientData?.business_name}
        relatedContractId={contract.id}
        defaultSubject={`Contract: ${contract.title}`}
        context="contract"
      />
    </AppLayout>
  );
}
