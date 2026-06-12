/**
 * UNSUBSCRIBE PAGE
 * Public page reached from the unsubscribe link in campaign emails.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

type Status = 'confirm' | 'loading' | 'done' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const campaignId = params.get('c') || '';
  const [status, setStatus] = useState<Status>('confirm');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Unsubscribe — EventPix';
  }, []);

  const handleConfirm = async () => {
    if (!email) {
      setStatus('error');
      setErrorMsg('Missing email address.');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/campaign-unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, campaignId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to unsubscribe');
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Unable to process unsubscribe');
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <h1 className="text-2xl font-semibold">Unsubscribe</h1>

          {status === 'confirm' && (
            <>
              <p className="text-muted-foreground">
                Are you sure you want to unsubscribe <strong className="text-foreground">{email || 'this address'}</strong> from future EventPix email campaigns?
              </p>
              <p className="text-xs text-muted-foreground">
                You'll still receive direct booking and event-related correspondence.
              </p>
              <Button onClick={handleConfirm} className="w-full" disabled={!email}>
                Confirm unsubscribe
              </Button>
            </>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processing…</p>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="font-medium">You've been unsubscribed</p>
              <p className="text-sm text-muted-foreground">
                {email} will no longer receive marketing campaigns from EventPix.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" onClick={() => setStatus('confirm')}>Try again</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
