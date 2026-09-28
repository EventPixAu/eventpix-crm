import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Result = { status: string; event_name?: string; event_date?: string; name?: string };

export default function DeclineAssignment() {
  const { token } = useParams();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!token) return;
    (supabase.rpc as any)('decline_assignment_by_token', { _token: token }).then(({ data, error }: any) => {
      setResult(error ? { status: 'error' } : (data as Result));
    });
  }, [token]);

  const ok = result?.status === 'declined' || result?.status === 'already_declined';
  const message = !result ? '' :
    result.status === 'declined' ? 'Thanks for letting us know — you have been marked as not available for this event.' :
    result.status === 'already_declined' ? 'You have already declined this assignment.' :
    result.status === 'on_hold' ? 'This event is not confirmed yet. We will email you once it is.' :
    'This link is invalid or has expired.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center space-y-4">
        {!result ? (
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
        ) : ok ? (
          <XCircle className="h-12 w-12 mx-auto text-muted-foreground" />
        ) : (
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
        )}
        <h1 className="text-xl font-semibold">{result ? message : 'Updating…'}</h1>
        {result?.event_name && (
          <p className="text-muted-foreground">{result.event_name}{result.event_date ? ` · ${result.event_date.split('-').reverse().join('/')}` : ''}</p>
        )}
      </div>
    </div>
  );
}
