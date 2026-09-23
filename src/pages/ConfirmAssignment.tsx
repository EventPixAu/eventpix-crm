import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Result = { status: string; event_name?: string; event_date?: string; name?: string };

export default function ConfirmAssignment() {
  const { token } = useParams();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!token) return;
    (supabase.rpc as any)('confirm_assignment_by_token', { _token: token }).then(({ data, error }: any) => {
      setResult(error ? { status: 'error' } : (data as Result));
    });
  }, [token]);

  const ok = result?.status === 'confirmed' || result?.status === 'already_confirmed';
  const message = !result ? '' :
    result.status === 'confirmed' ? 'Thanks — your availability is confirmed.' :
    result.status === 'already_confirmed' ? 'You have already confirmed this assignment.' :
    result.status === 'on_hold' ? 'This event is not confirmed yet. We will email you once it is.' :
    'This confirmation link is invalid or has expired.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center space-y-4">
        {!result ? (
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
        ) : ok ? (
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
        ) : (
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
        )}
        <h1 className="text-xl font-semibold">{result ? message : 'Confirming…'}</h1>
        {result?.event_name && (
          <p className="text-muted-foreground">{result.event_name}{result.event_date ? ` · ${result.event_date.split('-').reverse().join('/')}` : ''}</p>
        )}
      </div>
    </div>
  );
}
