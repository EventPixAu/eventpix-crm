/**
 * LEAD PORTAL PREVIEW
 * 
 * Internal (authenticated) preview of what the client portal will look like
 * when this lead is converted to a job. Uses lead data directly.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileCheck2,
  FileText,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import eventpixLogo from '@/assets/eventpix-logo.png';
import { useLead } from '@/hooks/useSales';
import { useLeadSessions } from '@/hooks/useEventSessions';
import { useLeadContacts } from '@/hooks/useLeadContacts';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getPublicBaseUrl } from '@/lib/utils';

function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  try {
    const d = new Date(`2000-01-01T${time}`);
    return format(d, 'h:mm a');
  } catch {
    return time;
  }
}

function ContractStatusBadge({ status }: { status: string | null }) {
  const s = status?.toLowerCase();
  if (s === 'signed') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Signed</Badge>;
  if (s === 'sent') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Awaiting Signature</Badge>;
  return <Badge className="bg-white/10 text-white/60 border-white/20">{status || 'Draft'}</Badge>;
}

function QuoteStatusBadge({ status }: { status: string | null }) {
  const s = status?.toLowerCase();
  if (s === 'accepted') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Accepted</Badge>;
  if (s === 'sent') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Awaiting Response</Badge>;
  return <Badge className="bg-white/10 text-white/60 border-white/20">{status || 'Draft'}</Badge>;
}

export default function LeadPortalPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const { data: sessions = [] } = useLeadSessions(id);
  const { data: leadContacts = [] } = useLeadContacts(id);

  // Fetch quotes linked to this lead
  const { data: quotes = [] } = useQuery({
    queryKey: ['lead-quotes-preview', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quotes')
        .select('id, quote_number, status, public_token, total_estimate')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch contracts linked to this lead
  const { data: contracts = [] } = useQuery({
    queryKey: ['lead-contracts-preview', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('contracts')
        .select('id, title, status, public_token, signed_at, sent_at')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Lead Not Found</h1>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4 text-white border-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const client = lead.client;
  const eventType = (lead as any).event_type;
  const eventDate = lead.estimated_event_date ? parseISO(lead.estimated_event_date) : null;
  const baseUrl = getPublicBaseUrl();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Preview Banner */}
      <div className="bg-amber-500/90 text-black px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        PREVIEW MODE — This is how the client portal will appear once this lead is converted to a job
        <Button 
          size="sm" 
          variant="outline" 
          className="ml-4 h-7 text-xs bg-black/10 border-black/20 hover:bg-black/20"
          onClick={() => navigate(`/sales/leads/${id}`)}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to Lead
        </Button>
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={eventpixLogo} alt="EventPix" className="h-8" />
          <div className="h-6 w-px bg-white/20" />
          <span className="text-white/60 text-sm">Event Details</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Event Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {eventType?.name && (
            <Badge variant="secondary" className="mb-3 bg-white/10 text-white/80 border-white/20">
              {eventType.name}
            </Badge>
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{lead.lead_name}</h1>
          {client?.business_name && (
            <p className="text-white/60 text-lg">{client.business_name}</p>
          )}
        </motion.div>

        {/* Date & Venue Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 backdrop-blur-sm"
        >
          {eventDate && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium">{format(eventDate, 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>
          )}

          {lead.venue_text && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium">{lead.venue_text}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Sessions / Schedule */}
        {sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Schedule
            </h2>
            <div className="space-y-3">
              {sessions.map((s: any) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {s.label || format(parseISO(s.session_date), 'EEEE, MMM d')}
                      </p>
                      <p className="text-white/60 text-sm">
                        {format(parseISO(s.session_date), 'MMM d, yyyy')}
                        {s.start_time && ` • ${formatTime(s.start_time)}`}
                        {s.end_time && ` – ${formatTime(s.end_time)}`}
                      </p>
                    </div>
                  </div>
                  {s.location && (
                    <p className="text-white/50 text-sm mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {s.location}
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-white/50 text-sm mt-1">{s.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Lead Contacts */}
        {leadContacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-400" />
              Contacts
            </h2>
            <div className="space-y-3">
              {leadContacts.map((c: any) => (
                <div key={c.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <p className="text-white font-medium text-sm">
                    {c.contact_name || c.client_contact?.contact_name || 'Contact'}
                  </p>
                  <Badge variant="outline" className="text-xs text-white/60 border-white/20 mt-0.5 capitalize">
                    {c.role || 'contact'}
                  </Badge>
                  <div className="mt-2 space-y-1">
                    {(c.contact_email || c.client_contact?.email) && (
                      <p className="text-blue-400 text-sm flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.contact_email || c.client_contact?.email}
                      </p>
                    )}
                    {(c.contact_phone || c.client_contact?.phone) && (
                      <p className="text-blue-400 text-sm flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.contact_phone || c.client_contact?.phone}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Special Instructions / Requirements */}
        {lead.requirements_summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-3">Special Instructions</h2>
            <p className="text-white/70 text-sm whitespace-pre-wrap">{lead.requirements_summary}</p>
          </motion.div>
        )}

        {/* Contracts */}
        {contracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-orange-400" />
              Contracts
            </h2>
            <div className="space-y-2">
              {contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileCheck2 className="h-4 w-4 text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{contract.title}</p>
                      {contract.signed_at && (
                        <p className="text-white/50 text-xs">
                          Signed {format(parseISO(contract.signed_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ContractStatusBadge status={contract.status} />
                    {contract.public_token && contract.status !== 'signed' && (
                      <Button variant="ghost" size="sm" asChild className="text-white/60 hover:text-white">
                        <a href={`${baseUrl}/contract/sign/${contract.public_token}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quotes */}
        {quotes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              Quotes
            </h2>
            <div className="space-y-2">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {quote.quote_number ? `Budget #${quote.quote_number}` : 'Budget'}
                      </p>
                      {quote.total_estimate != null && (
                        <p className="text-white/50 text-xs">
                          ${Number(quote.total_estimate).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <QuoteStatusBadge status={quote.status} />
                    {quote.public_token && (
                      <Button variant="ghost" size="sm" asChild className="text-white/60 hover:text-white">
                        <a href={`${baseUrl}/accept/${quote.public_token}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-white/10">
          <p className="text-white/30 text-sm">Powered by EventPix</p>
        </div>
      </main>
    </div>
  );
}
