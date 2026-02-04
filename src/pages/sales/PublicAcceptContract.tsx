/**
 * PUBLIC CONTRACT ACCEPTANCE PAGE
 * 
 * Allows clients to sign contracts via public link (no login required).
 * Includes digital signature pad for handwritten signatures.
 * Security: Only exposes minimal contract info, no internal data.
 */
import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, FileText, ExternalLink, Shield, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/eventpix-logo.png';

interface PublicContractData {
  id: string;
  title: string;
  status: string;
  file_url: string | null;
  rendered_html: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signature_data: string | null;
}

export default function PublicAcceptContract() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [contract, setContract] = useState<PublicContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContract();
  }, [token]);

  const fetchContract = async () => {
    if (!token) {
      setError('Invalid contract link');
      setLoading(false);
      return;
    }

    try {
      // Fetch contract by public token - only get safe fields
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select(`
          id,
          title,
          status,
          file_url,
          rendered_html,
          signed_at,
          signed_by_name,
          signature_data
        `)
        .eq('public_token', token)
        .maybeSingle();

      if (contractError) {
        setError('Failed to load contract');
        setLoading(false);
        return;
      }

      if (!contractData) {
        setError('Contract not found or link has expired');
        setLoading(false);
        return;
      }

      setContract(contractData);

      if (contractData.status === 'signed') {
        setSigned(true);
      }
    } catch (err) {
      setError('Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!token || !formData.name.trim() || !formData.email.trim() || !agreedToTerms) {
      toast({ 
        title: 'Please fill in all fields and agree to terms', 
        variant: 'destructive' 
      });
      return;
    }

    if (!signatureData) {
      toast({ 
        title: 'Please sign the contract', 
        description: 'Draw your signature in the signature pad above',
        variant: 'destructive' 
      });
      return;
    }

    setSigning(true);

    try {
      const { data, error } = await supabase.rpc('accept_contract_public', {
        p_token: token,
        p_name: formData.name,
        p_email: formData.email,
        p_signature_data: signatureData,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to sign contract');
      }

      setSigned(true);
      toast({ title: 'Contract signed successfully!' });
    } catch (err: any) {
      toast({ 
        title: 'Failed to sign contract', 
        description: err.message,
        variant: 'destructive' 
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 text-6xl mb-4">😕</div>
            <h2 className="text-xl font-semibold mb-2">Contract Not Found</h2>
            <p className="text-muted-foreground">
              {error || 'This contract link may have expired or is invalid.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed || contract.status === 'signed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-green-500 mx-auto mb-4">
              <CheckCircle className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Contract Signed!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for signing this contract. We'll be in touch shortly with next steps.
            </p>
            <p className="text-sm font-medium">
              {contract.title}
            </p>
            {contract.signed_at && (
              <p className="text-sm text-muted-foreground mt-2">
                Signed on {format(new Date(contract.signed_at), 'PPP')}
              </p>
            )}
            {contract.signed_by_name && (
              <p className="text-sm text-muted-foreground">
                By: {contract.signed_by_name}
              </p>
            )}
            {/* Display signature if available */}
            {contract.signature_data && (
              <div className="mt-4 border rounded-lg p-2 bg-white inline-block">
                <img 
                  src={contract.signature_data} 
                  alt="Signature" 
                  className="max-h-20 max-w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contract.status === 'cancelled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Contract Unavailable</h2>
            <p className="text-muted-foreground">
              This contract is no longer available for signing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-black rounded-lg p-6 mb-8 text-center">
          <img src={logo} alt="Eventpix" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Photography Agreement</h1>
          <p className="text-gray-300">
            {contract.title}
          </p>
        </div>

        {/* Contract Document */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Document
            </CardTitle>
            <CardDescription>
              Please review the contract document before signing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contract.rendered_html ? (
              <div className="border rounded-lg p-6 bg-white text-gray-900 max-h-[400px] overflow-y-auto">
                <div 
                  className="prose prose-sm max-w-none prose-gray"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.rendered_html) }}
                />
              </div>
            ) : contract.file_url ? (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{contract.title}</p>
                    <p className="text-sm text-muted-foreground">Click to view document</p>
                  </div>
                </div>
                <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Document
                  </Button>
                </a>
              </div>
            ) : (
              <div className="text-center py-8 bg-muted rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Contract document will be provided separately
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signing Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Sign Contract
            </CardTitle>
            <CardDescription>
              Enter your details and sign below to complete the agreement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Your Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Signature Pad */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Your Signature *
                </Label>
                <SignaturePad 
                  onChange={setSignatureData}
                  height={150}
                />
                <p className="text-xs text-muted-foreground">
                  Use your mouse or finger to draw your signature above
                </p>
              </div>
              
              <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
                <Checkbox
                  id="agree"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="agree"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I confirm that I have read and understood this contract, and I agree to enter into this contract with EventPix
                  </label>
                  <p className="text-xs text-muted-foreground">
                    By checking this box and signing above, you acknowledge that you have read and agree to all terms and conditions outlined in the contract document.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Signature Date</Label>
                <div className="p-3 bg-muted rounded-lg text-sm font-medium">
                  {format(new Date(), 'PPPP')}
                </div>
              </div>
              
              <Button 
                className="w-full bg-primary hover:bg-primary/90" 
                size="lg"
                onClick={handleSign}
                disabled={!formData.name.trim() || !formData.email.trim() || !agreedToTerms || !signatureData || signing}
              >
                {signing ? 'Processing...' : 'Accept Contract'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By clicking Accept, your signature becomes legally binding. Make sure you have reviewed the contract.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
