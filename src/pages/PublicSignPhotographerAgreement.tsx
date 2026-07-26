import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { CheckCircle2, XCircle, FileSignature } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

interface LoadedContract {
  contract_id: string;
  title: string;
  template_name: string;
  rendered_html: string;
  status: string;
  signed_at: string | null;
  signed_by_name: string | null;
  photographer_name: string;
  business_name: string;
}

async function callSign(method: 'GET' | 'POST', payload?: any, token?: string) {
  const url = `${SUPABASE_URL}/functions/v1/photographer-agreement-sign${method === 'GET' && token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const resp = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: method === 'POST' ? JSON.stringify(payload) : undefined,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function PublicSignPhotographerAgreement() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<LoadedContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await callSign('GET', undefined, token);
        setContract(data);
        setFullName(data.photographer_name || '');
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSign = async () => {
    if (!fullName.trim() || !email.trim() || !accepted) {
      toast.error('Please complete all fields and accept the agreement');
      return;
    }
    setSubmitting(true);
    try {
      await callSign('POST', { token, full_name: fullName.trim(), email: email.trim(), signature_data: fullName.trim(), accepted: true });
      setSuccess(true);
    } catch (e: any) {
      toast.error('Failed to sign', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Unable to load agreement</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!contract) return null;

  const alreadySigned = contract.status === 'signed' || success;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-2xl font-bold"><FileSignature className="h-6 w-6" /> Photographer Services Agreement</div>
          <p className="text-muted-foreground mt-1">EventPix</p>
        </div>

        {alreadySigned ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-5 w-5" /> Thank you. Your Photographer Services Agreement has been signed.</CardTitle>
              {contract.signed_at && <CardDescription>Signed by {contract.signed_by_name || fullName} on {new Date(contract.signed_at).toLocaleString('en-AU')}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-6 bg-white text-black">
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.rendered_html) }} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-6 bg-white text-black">
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.rendered_html) }} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sign Agreement</CardTitle>
                <CardDescription>Please review the agreement above. To accept, enter your name and click "Sign Agreement".</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="accept" checked={accepted} onCheckedChange={v => setAccepted(!!v)} />
                  <Label htmlFor="accept" className="text-sm font-normal cursor-pointer">
                    I have read and agree to the Photographer Services Agreement. I understand that typing my name below acts as my electronic signature.
                  </Label>
                </div>
                <Alert>
                  <AlertDescription className="text-xs">Signing this agreement records your IP address and timestamp for compliance purposes.</AlertDescription>
                </Alert>
                <Button onClick={handleSign} disabled={submitting || !fullName.trim() || !email.trim() || !accepted} className="w-full">
                  {submitting ? 'Signing…' : 'Sign Agreement'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
