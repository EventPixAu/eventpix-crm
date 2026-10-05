import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { DELIVERY_CHOICES, deliveryChoiceLabel, requiresDeliveryTiming } from '@/lib/clientDeliveryOptions';
import documentAsset from '@/assets/client-delivery-options.asset.json';
import { getPublicBaseUrl } from '@/lib/utils';

interface RequestData { status: string; event_name?: string; event_date?: string; choice?: string; timing?: string; social_media_access?: boolean; branding_notes?: string; confirmed_at?: string }

export default function ClientDeliveryChoice() {
  const { token } = useParams();
  const [request, setRequest] = useState<RequestData | null>(null);
  const [choice, setChoice] = useState('');
  const [timing, setTiming] = useState('');
  const [social, setSocial] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
        setRequest({ status: 'invalid' }); return;
      }
      const { data, error: loadError } = await supabase.rpc('get_delivery_choice_request', { p_token: token });
      if (!active) return;
      const result = loadError ? { status: 'error' } : data as unknown as RequestData;
      setRequest(result);
      setChoice(result.choice || ''); setTiming(result.timing || '');
      setSocial(result.social_media_access || false); setNotes(result.branding_notes || '');
      setConfirmed(!!result.confirmed_at);
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !choice || (requiresDeliveryTiming(choice) && !timing)) return;
    setSaving(true); setError('');
    try {
      const { data, error: saveError } = await supabase.rpc('submit_delivery_choice', {
        p_token: token, p_choice: choice, p_timing: requiresDeliveryTiming(choice) ? timing : '',
        p_social_media_access: social, p_branding_notes: notes,
      });
      if (saveError) throw saveError;
      if ((data as { status?: string })?.status !== 'confirmed') throw new Error('This link has expired. Please ask EventPix for a new link.');
      setConfirmed(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Your choice could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-background px-5 py-10">
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-2xl font-semibold text-primary">EventPix</p>
      {!request ? <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" /> : request.status !== 'valid' ?
        <div className="space-y-3"><h1 className="text-2xl font-semibold">{request.status === 'error' ? 'Unable to load delivery options' : 'This link is invalid or has expired'}</h1><p className="text-muted-foreground">Please contact EventPix for a new delivery-options link.</p></div> : <>
        <header className="space-y-2"><h1 className="break-words text-2xl font-semibold">{request.event_name}</h1>
          {request.event_date && <p className="text-muted-foreground">{format(parseISO(request.event_date), 'EEEE, d MMMM yyyy')}</p>}
        </header>
        {confirmed ? <section className="space-y-4 border-t pt-6">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <h2 className="text-xl font-semibold">Your delivery choice is confirmed</h2>
          <p>{deliveryChoiceLabel(choice)}{requiresDeliveryTiming(choice) ? ` · ${timing === 'immediate' ? 'Immediate' : 'Delayed'}` : ''}</p>
          <p className="text-muted-foreground">Dropbox is included. Thank you — your preference has been saved for this event.</p>
          {social && <p>Social media manager access requested</p>}
          {notes && <p className="whitespace-pre-wrap break-words">{notes}</p>}
          <Button variant="outline" onClick={() => setConfirmed(false)}>Change my choice</Button>
        </section> : <form onSubmit={submit} className="space-y-6 border-t pt-6">
          <div className="space-y-3"><h2 className="text-xl font-semibold">Choose your photo delivery</h2><p className="text-muted-foreground">Dropbox is included for every event. Your edited and culled photos are delivered within two working days.</p>
            <Button asChild variant="link" className="h-auto p-0"><a href={new URL(documentAsset.url, getPublicBaseUrl()).href} download="Client_delivery_options.docx">Read the delivery-options document</a></Button>
          </div>
          <RadioGroup aria-label="Delivery option" value={choice} onValueChange={setChoice} className="gap-3">
            {DELIVERY_CHOICES.map(option => <Label key={option.value} htmlFor={option.value} className="flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[[data-state=checked]]:border-primary">
              <RadioGroupItem id={option.value} value={option.value} className="mt-1 shrink-0" />
              <span className="space-y-1"><span className="block font-semibold">{option.label}</span><span className="block text-sm font-normal leading-relaxed text-muted-foreground">{option.description}</span></span>
            </Label>)}
          </RadioGroup>
          {requiresDeliveryTiming(choice) && <div className="space-y-3"><Label>When should guests receive their photos?</Label><RadioGroup aria-label="Delivery timing" value={timing} onValueChange={setTiming}>
            <Label className="flex items-start gap-3" htmlFor="immediate"><RadioGroupItem id="immediate" value="immediate" /><span>Immediate<span className="block text-sm font-normal text-muted-foreground">Live uploads with auto enhancement. Ideal for awards and dinners.</span></span></Label>
            <Label className="flex items-start gap-3" htmlFor="delayed"><RadioGroupItem id="delayed" value="delayed" /><span>Delayed<span className="block text-sm font-normal text-muted-foreground">Photos are culled and processed before upload. Ideal for conferences.</span></span></Label>
          </RadioGroup></div>}
          <Label className="flex items-start gap-3" htmlFor="social-access"><Checkbox id="social-access" checked={social} onCheckedChange={value => setSocial(value === true)} /><span>Also provide access for our social media manager</span></Label>
          <div className="space-y-2"><Label htmlFor="branding-notes">Branding, social media contact or other notes (optional)</Label><Textarea id="branding-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={4} /></div>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || !choice || (requiresDeliveryTiming(choice) && !timing)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm delivery choice</Button>
        </form>}
      </>}
    </div>
  </main>;
}