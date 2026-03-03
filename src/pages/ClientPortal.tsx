/**
 * Public Client Portal – shows event details to clients via a token link.
 * No authentication required.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Mail,
  QrCode,
  User,
  Users,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import eventpixLogo from '@/assets/eventpix-logo.png';

interface PortalContract {
  id: string;
  title: string;
  status: string | null;
  public_token: string | null;
  signed_at: string | null;
  sent_at: string | null;
}

interface PortalQuote {
  id: string;
  quote_number: string | null;
  status: string | null;
  public_token: string | null;
  total_estimate: number | null;
}

interface PortalData {
  event_name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  client_name: string | null;
  venue_name: string | null;
  venue: {
    name: string;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    google_maps_url: string | null;
  } | null;
  event_type: string | null;
  special_instructions: string | null;
  photography_brief: string | null;
  brief_content: string | null;
  main_shoot_date: string | null;
  sessions: Array<{
    id: string;
    session_date: string;
    start_time: string | null;
    end_time: string | null;
    session_label: string | null;
    location: string | null;
    notes: string | null;
  }>;
  team: Array<{
    role: string;
    name: string;
    avatar_url: string | null;
    phone: string | null;
  }>;
  contacts: Array<{
    id: string;
    contact_type: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
  }>;
  contracts: PortalContract[];
  quotes: PortalQuote[];
  qr_file_name: string | null;
  qr_signed_url: string | null;
}

function formatTime(time: string | null): string {
  if (!time) return '';
  try {
    const d = new Date(`2000-01-01T${time}`);
    return format(d, 'h:mm a');
  } catch {
    return time;
  }
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
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

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/client-portal?token=${token}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (!resp.ok) {
          throw new Error('Event not found');
        }

        const portalData = await resp.json();
        setData(portalData);
      } catch (err: any) {
        setError(err.message || 'Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
          <p className="text-white/60">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const eventDate = data.event_date ? parseISO(data.event_date) : null;
  const venueAddress = data.venue
    ? [data.venue.address_line_1, data.venue.address_line_2, data.venue.city, data.venue.state, data.venue.postcode]
        .filter(Boolean)
        .join(', ')
    : null;
  const baseUrl = getBaseUrl();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
          {data.event_type && (
            <Badge variant="secondary" className="mb-3 bg-white/10 text-white/80 border-white/20">
              {data.event_type}
            </Badge>
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{data.event_name}</h1>
          {data.client_name && (
            <p className="text-white/60 text-lg">{data.client_name}</p>
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
                {(data.start_time || data.end_time) && (
                  <p className="text-white/60 text-sm mt-0.5">
                    {data.start_time && formatTime(data.start_time)}
                    {data.start_time && data.end_time && ' – '}
                    {data.end_time && formatTime(data.end_time)}
                  </p>
                )}
              </div>
            </div>
          )}

          {(data.venue_name || venueAddress) && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium">{data.venue_name || data.venue?.name}</p>
                {venueAddress && (
                  <p className="text-white/60 text-sm mt-0.5">{venueAddress}</p>
                )}
                {data.venue?.google_maps_url && (
                  <a
                    href={data.venue.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-sm hover:underline mt-1 inline-block"
                  >
                    Open in Maps ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Sessions / Schedule */}
        {(data.sessions?.length ?? 0) > 0 && (
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
              {data.sessions.map((s) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {s.session_label || format(parseISO(s.session_date), 'EEEE, MMM d')}
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

        {/* Your Team */}
        {(data.team?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Your Team
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.team.map((member, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/5">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-white/40" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium text-sm">{member.name}</p>
                    <p className="text-white/50 text-xs capitalize">{member.role}</p>
                    {member.phone && (
                      <a href={`tel:${member.phone}`} className="text-blue-400 text-xs flex items-center gap-1 hover:underline mt-0.5">
                        <Phone className="h-3 w-3" /> {member.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Event Contacts */}
        {(data.contacts?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-400" />
              Event Contacts
            </h2>
            <div className="space-y-3">
              {data.contacts.map((c) => (
                <div key={c.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium text-sm">{c.contact_name || 'Contact'}</p>
                      <Badge variant="outline" className="text-xs text-white/60 border-white/20 mt-0.5 capitalize">
                        {c.contact_type}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {c.contact_email && (
                      <a href={`mailto:${c.contact_email}`} className="text-blue-400 text-sm flex items-center gap-1 hover:underline">
                        <Mail className="h-3 w-3" /> {c.contact_email}
                      </a>
                    )}
                    {c.contact_phone && (
                      <a href={`tel:${c.contact_phone}`} className="text-blue-400 text-sm flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" /> {c.contact_phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Event Brief */}
        {data.brief_content && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-3">Event Brief</h2>
            <p className="text-white/70 text-sm whitespace-pre-wrap">{data.brief_content}</p>
          </motion.div>
        )}

        {/* Special Instructions */}
        {data.special_instructions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-3">Special Instructions</h2>
            <p className="text-white/70 text-sm whitespace-pre-wrap">{data.special_instructions}</p>
          </motion.div>
        )}

        {/* Contracts */}
        {(data.contracts?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-orange-400" />
              Contracts
            </h2>
            <div className="space-y-2">
              {data.contracts.map((contract) => (
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
        {(data.quotes?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              Quotes
            </h2>
            <div className="space-y-2">
              {data.quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {quote.quote_number ? `Quote #${quote.quote_number}` : 'Quote'}
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
                        <a href={`${baseUrl}/quote/accept/${quote.public_token}`} target="_blank" rel="noopener noreferrer">
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

        {/* QR Code */}
        {data.qr_signed_url && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-cyan-400" />
              QR Code
            </h2>
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-cyan-400" />
                <p className="text-white text-sm font-medium">{data.qr_file_name || 'QR Code'}</p>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-white/60 hover:text-white">
                <a href={data.qr_signed_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
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
