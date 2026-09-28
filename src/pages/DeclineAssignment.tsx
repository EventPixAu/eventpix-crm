import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Result = { status: string; event_name?: string; event_date?: string; name?: string };

export default function DeclineAssignment() {
  const { token } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [reasonSaved, setReasonSaved] = useState(false);

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

  const saveReason = async () => {
    if (!token || !reason.trim()) return;
    setSaving(true);
    try {
      await (supabase.rpc as any)('set_decline_reason_by_token', { _token: token, _reason: reason.trim() });
      setReasonSaved(true);
    } finally {
      setSaving(false);
    }
  };

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
        {ok && !reasonSaved && (
          <div className="space-y-3 text-left pt-2">
            <label className="text-sm font-medium">Why are you unavailable? (optional)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Already booked, travelling, unavailable that week…"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReasonSaved(true)}
                disabled={saving}
              >
                Skip
              </Button>
              <Button size="sm" onClick={saveReason} disabled={saving || !reason.trim()}>
                {saving ? 'Sending…' : 'Send reason'}
              </Button>
            </div>
          </div>
        )}
        {reasonSaved && (
          <p className="text-sm text-muted-foreground">Thanks — your reason has been sent to the team.</p>
        )}
      </div>
    </div>
  );
}
