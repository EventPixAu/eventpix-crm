import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileCheck, 
  FileX, 
  Upload, 
  Clock, 
  Calendar,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useComplianceDocumentTypes,
  useMyComplianceDocuments,
  useUploadComplianceDocument,
  DOCUMENT_STATUS_CONFIG,
  type ComplianceDocumentType,
  type StaffComplianceDocumentWithType,
} from '@/hooks/useCompliance';

export function MyDocumentsUploader() {
  const [uploadingType, setUploadingType] = useState<ComplianceDocumentType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documentTypes, isLoading: typesLoading } = useComplianceDocumentTypes();
  const { data: myDocuments, isLoading: docsLoading } = useMyComplianceDocuments();
  const uploadMutation = useUploadComplianceDocument();

  const isLoading = typesLoading || docsLoading;

  // Map documents by type ID
  const documentsByType = new Map(
    myDocuments?.map(doc => [doc.document_type_id, doc]) || []
  );

  const requiredTypes = documentTypes?.filter(dt => dt.required && dt.is_active) || [];
  const optionalTypes = documentTypes?.filter(dt => !dt.required && dt.is_active) || [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!uploadingType || !selectedFile) return;

    uploadMutation.mutate({
      file: selectedFile,
      documentTypeId: uploadingType.id,
      issuedDate: issuedDate || undefined,
      expiryDate: expiryDate || undefined,
    }, {
      onSuccess: () => {
        setUploadingType(null);
        setSelectedFile(null);
        setIssuedDate('');
        setExpiryDate('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
    });
  };

  const openUploadDialog = (docType: ComplianceDocumentType) => {
    setUploadingType(docType);
    setSelectedFile(null);
    setIssuedDate('');
    setExpiryDate('');
  };

  const getExpiryWarning = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) return { level: 'expired', text: 'Expired' };
    if (days <= 7) return { level: 'critical', text: `Expires in ${days} days` };
    if (days <= 30) return { level: 'warning', text: `Expires in ${days} days` };
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Keep your documents up to date</p>
              <p className="text-blue-700">
                Required documents must be valid for you to be assigned to events. 
                Upload renewals before expiry to avoid interruptions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required Documents</CardTitle>
          <CardDescription>You must upload these documents to be eligible for assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requiredTypes.map((docType) => {
              const doc = documentsByType.get(docType.id);
              return (
                <DocumentCard
                  key={docType.id}
                  docType={docType}
                  document={doc}
                  getExpiryWarning={getExpiryWarning}
                  onUpload={() => openUploadDialog(docType)}
                />
              );
            })}
            {requiredTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">No required documents configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Optional Documents */}
      {optionalTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optional Documents</CardTitle>
            <CardDescription>These may be needed for specific types of events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optionalTypes.map((docType) => {
                const doc = documentsByType.get(docType.id);
                return (
                  <DocumentCard
                    key={docType.id}
                    docType={docType}
                    document={doc}
                    getExpiryWarning={getExpiryWarning}
                    onUpload={() => openUploadDialog(docType)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={!!uploadingType} onOpenChange={() => setUploadingType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              {uploadingType?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, JPG, PNG, WebP (max 10MB)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issued Date (optional)</Label>
                <Input
                  type="date"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                />
              </div>
              {uploadingType?.has_expiry && (
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadingType(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Document Card for Staff View
function DocumentCard({
  docType,
  document,
  getExpiryWarning,
  onUpload,
}: {
  docType: ComplianceDocumentType;
  document?: StaffComplianceDocumentWithType;
  getExpiryWarning: (date: string | null) => { level: string; text: string } | null;
  onUpload: () => void;
}) {
  const expiryWarning = document ? getExpiryWarning(document.expiry_date) : null;
  const needsRenewal = expiryWarning?.level === 'expired' || expiryWarning?.level === 'critical';

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border bg-card",
      needsRenewal && "border-destructive/50 bg-destructive/5"
    )}>
      <div className="flex items-center gap-3">
        {document?.status === 'valid' ? (
          <FileCheck className="h-5 w-5 text-green-500" />
        ) : document?.status === 'pending_review' ? (
          <Clock className="h-5 w-5 text-yellow-500" />
        ) : document?.status === 'rejected' || document?.status === 'expired' ? (
          <FileX className="h-5 w-5 text-destructive" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">{docType.name}</p>
          {docType.description && (
            <p className="text-sm text-muted-foreground">{docType.description}</p>
          )}
          {document?.expiry_date && (
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Expires: {format(parseISO(document.expiry_date), 'PP')}
              </span>
              {expiryWarning && (
                <Badge 
                  variant={expiryWarning.level === 'expired' ? 'destructive' : 'outline'}
                  className={cn(
                    'text-[10px]',
                    expiryWarning.level === 'critical' && 'border-destructive text-destructive',
                    expiryWarning.level === 'warning' && 'border-orange-500 text-orange-500'
                  )}
                >
                  {expiryWarning.text}
                </Badge>
              )}
            </div>
          )}
          {document?.status === 'rejected' && document.notes && (
            <p className="text-xs text-destructive mt-1">Reason: {document.notes}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {document ? (
          <>
            <Badge variant={DOCUMENT_STATUS_CONFIG[document.status].variant}>
              {DOCUMENT_STATUS_CONFIG[document.status].label}
            </Badge>
            {document.document_url && (
              <Button size="sm" variant="ghost" asChild>
                <a href={document.document_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {(document.status === 'rejected' || document.status === 'expired' || needsRenewal) && (
              <Button size="sm" onClick={onUpload}>
                Re-upload
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        )}
      </div>
    </div>
  );
}
