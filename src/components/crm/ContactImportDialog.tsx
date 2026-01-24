/**
 * CONTACT IMPORT DIALOG
 * 
 * Import contacts from CSV or Google Contacts with field mapping preview
 */
import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  Cloud,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
} from 'lucide-react';
import { useContactImport, parseCSV, parseGoogleContacts, ImportedContact } from '@/hooks/useContactImport';
import { useToast } from '@/hooks/use-toast';

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'select' | 'preview' | 'importing' | 'complete';

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [importSource, setImportSource] = useState<'csv' | 'google' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { 
    importContacts, 
    importProgress, 
    isImporting, 
    importResult 
  } = useContactImport();

  const handleClose = useCallback(() => {
    if (!isImporting) {
      setStep('select');
      setContacts([]);
      setImportSource(null);
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    try {
      const content = await file.text();
      const parsed = parseCSV(content);
      
      if (parsed.length === 0) {
        toast({
          title: 'No Contacts Found',
          description: 'The CSV file appears to be empty or has an unsupported format',
          variant: 'destructive',
        });
        return;
      }

      setContacts(parsed);
      setImportSource('csv');
      setStep('preview');
    } catch (error: any) {
      toast({
        title: 'Failed to Parse CSV',
        description: error.message,
        variant: 'destructive',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [toast]);

  const handleGoogleImport = useCallback(async () => {
    try {
      // Google OAuth flow
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        toast({
          title: 'Google Import Not Configured',
          description: 'Google Contacts integration requires configuration. Please use CSV import instead.',
          variant: 'destructive',
        });
        return;
      }

      const scope = 'https://www.googleapis.com/auth/contacts.readonly';
      const redirectUri = window.location.origin + '/crm/contacts';
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', 'google_contacts_import');

      // Open Google auth in popup
      const popup = window.open(
        authUrl.toString(),
        'google_auth',
        'width=500,height=600,menubar=no,toolbar=no'
      );

      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'google_oauth_callback') {
          window.removeEventListener('message', handleMessage);
          popup?.close();

          const accessToken = event.data.accessToken;
          if (!accessToken) {
            toast({
              title: 'Authentication Failed',
              description: 'Could not get access token from Google',
              variant: 'destructive',
            });
            return;
          }

          // Fetch contacts from Google People API
          const response = await fetch(
            'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,addresses&pageSize=1000',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch Google Contacts');
          }

          const data = await response.json();
          const parsed = parseGoogleContacts(data.connections || []);
          
          if (parsed.length === 0) {
            toast({
              title: 'No Contacts Found',
              description: 'No importable contacts found in your Google account',
              variant: 'destructive',
            });
            return;
          }

          setContacts(parsed);
          setImportSource('google');
          setStep('preview');
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup listener after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
      }, 300000);
    } catch (error: any) {
      toast({
        title: 'Google Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleStartImport = useCallback(() => {
    setStep('importing');
    importContacts(contacts, {
      onSuccess: () => setStep('complete'),
      onError: () => setStep('preview'),
    });
  }, [contacts, importContacts]);

  const renderSelectStep = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card 
        className="cursor-pointer hover:border-primary transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <CardHeader className="text-center pb-2">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-primary mb-2" />
          <CardTitle className="text-lg">Import from CSV</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Upload a CSV file (Zoho compatible format)</p>
          <p className="mt-2 text-xs">Supports: First Name, Last Name, Email, Mobile, Company, Job Title</p>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:border-primary transition-colors"
        onClick={handleGoogleImport}
      >
        <CardHeader className="text-center pb-2">
          <Cloud className="h-12 w-12 mx-auto text-primary mb-2" />
          <CardTitle className="text-lg">Import from Google</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Connect to Google Contacts</p>
          <p className="mt-2 text-xs">Requires Google account authorization</p>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );

  const renderPreviewStep = () => {
    const companiesSet = new Set(contacts.filter(c => c.companyName).map(c => c.companyName!.toLowerCase()));
    const withEmail = contacts.filter(c => c.email).length;
    const withCompany = contacts.filter(c => c.companyName).length;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <User className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{contacts.length}</div>
              <div className="text-sm text-muted-foreground">Contacts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Building2 className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{companiesSet.size}</div>
              <div className="text-sm text-muted-foreground">Companies</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Mail className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{withEmail}</div>
              <div className="text-sm text-muted-foreground">With Email</div>
            </CardContent>
          </Card>
        </div>

        {withCompany < contacts.length && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {contacts.length - withCompany} contacts don't have a company and will be skipped.
            </AlertDescription>
          </Alert>
        )}

        <div className="border rounded-lg">
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Job Title</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.slice(0, 50).map((contact, idx) => (
                  <TableRow key={idx} className={!contact.companyName ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {contact.mobile ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {contact.mobile}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {contact.companyName ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3" />
                          {contact.companyName}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-destructive">
                          Missing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.jobTitle ? (
                        <Badge variant="secondary">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {contact.jobTitle}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          {contacts.length > 50 && (
            <div className="p-2 text-center text-sm text-muted-foreground border-t">
              Showing 50 of {contacts.length} contacts
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setStep('select')}>
            Back
          </Button>
          <Button onClick={handleStartImport} disabled={withCompany === 0}>
            <Upload className="h-4 w-4 mr-2" />
            Import {withCompany} Contacts
          </Button>
        </div>
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-medium">Importing Contacts...</h3>
        {importProgress && (
          <p className="text-sm text-muted-foreground mt-2">{importProgress.status}</p>
        )}
      </div>

      {importProgress && (
        <div className="space-y-2">
          <Progress value={(importProgress.current / importProgress.total) * 100} />
          <div className="text-center text-sm text-muted-foreground">
            {importProgress.current} of {importProgress.total}
          </div>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-medium">Import Complete!</h3>
      </div>

      {importResult && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Companies Created</span>
                <Badge>{importResult.companiesCreated}</Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Companies Skipped (Duplicates)</span>
                <Badge variant="outline">{importResult.companiesSkipped}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contacts Created</span>
                <Badge>{importResult.contactsCreated}</Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contacts Skipped</span>
                <Badge variant="outline">{importResult.contactsSkipped}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {importResult?.errors && importResult.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Warnings ({importResult.errors.length})
          </h4>
          <ScrollArea className="h-[120px] border rounded-lg p-3">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {importResult.errors.map((error, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <XCircle className="h-3 w-3 mt-0.5 text-destructive shrink-0" />
                  {error}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleClose}>Done</Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Contacts
            {importSource && (
              <Badge variant="secondary" className="ml-2">
                {importSource === 'csv' ? 'CSV File' : 'Google Contacts'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Choose how you want to import your contacts'}
            {step === 'preview' && 'Review the contacts before importing'}
            {step === 'importing' && 'Please wait while we import your contacts'}
            {step === 'complete' && 'Your contacts have been imported'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && renderSelectStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
