import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

export interface ClientCertificate {
  id: string;
  name: string;
  team_member?: string;
  expiry_date: string | null;
  url: string;
}

export function ClientCertificates({ title, certificates }: { title: string; certificates: ClientCertificate[] }) {
  return <section className="space-y-3">
    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><ShieldCheck className="h-5 w-5 text-primary" />{title}</h2>
    {certificates.length ? <div className="divide-y divide-border">
      {certificates.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.team_member}{c.team_member && c.expiry_date ? ' · ' : ''}{c.expiry_date ? `Valid to ${format(parseISO(c.expiry_date), 'd MMM yyyy')}` : ''}</p>
        </div>
        <Button asChild variant="outline" size="sm"><a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Certificate</a></Button>
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">No certificates available.</p>}
  </section>;
}