import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calendar,
  MapPin,
  ExternalLink,
  Loader2,
  LogOut,
  Building2,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import eventpixLogo from '@/assets/eventpix-logo.png';
import type { Session } from '@supabase/supabase-js';

interface Company {
  id: string;
  business_name: string;
  trading_name: string | null;
}

interface Lead {
  id: string;
  lead_name: string;
  status: string;
  estimated_event_date: string | null;
  venue_text: string | null;
  client_portal_token: string | null;
  created_at: string;
  updated_at: string;
  company_name: string;
}

interface Event {
  id: string;
  event_name: string;
  event_date: string | null;
  venue_name: string | null;
  ops_status: string | null;
  client_portal_token: string | null;
  created_at: string;
  company_name: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  qualifying: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  proposal_sent: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  negotiating: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  won: 'bg-green-500/20 text-green-300 border-green-500/30',
  awaiting_details: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  booked: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-300 border-green-500/30',
  in_progress: 'bg-primary/20 text-primary border-primary/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  delivered: 'bg-green-500/20 text-green-300 border-green-500/30',
};

function formatStatus(s: string | null) {
  if (!s) return 'Pending';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClientPortalDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let loadedForUserId: string | null = null;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRedirectTimer = () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
    };

    const scheduleLoginRedirect = () => {
      clearRedirectTimer();
      redirectTimer = setTimeout(() => {
        if (mounted && !loadedForUserId) navigate('/client-login');
      }, 2500);
    };

    async function loadPortalData(session: Session | null) {
      if (!session) {
        scheduleLoginRedirect();
        return;
      }

      clearRedirectTimer();

      if (loadedForUserId === session.user.id) return;
      loadedForUserId = session.user.id;

      setUserEmail(session.user.email ?? null);

      const { data, error: rpcError } = await supabase.rpc('get_client_portal_data');
      
      if (!mounted) return;

      if (rpcError) {
        console.error('Portal data error:', rpcError);
        setError('Unable to load your portal data. Please contact the team.');
        setLoading(false);
        return;
      }

      const result = data as any;
      if (!result?.success) {
        setError(result?.error || 'No data found for your account. Please contact the team.');
        setLoading(false);
        return;
      }

      setCompanies(result.companies || []);
      setLeads(result.leads || []);
      setEvents(result.events || []);
      setLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadPortalData(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => loadPortalData(session))
      .catch((sessionError) => {
        console.error('Portal session error:', sessionError);
        scheduleLoginRedirect();
      });

    return () => {
      mounted = false;
      clearRedirectTimer();
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/client-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your portal…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <img src={eventpixLogo} alt="Eventpixii" className="h-10 mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={eventpixLogo} alt="Eventpixii" className="h-8" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Client Portal</h1>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Companies */}
        {companies.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {companies.map((c) => (
              <Badge key={c.id} variant="outline" className="gap-1.5 py-1 px-3">
                <Building2 className="h-3 w-3" />
                {c.trading_name || c.business_name}
              </Badge>
            ))}
          </div>
        )}

        {/* Active Leads (Sales Stage) */}
        {leads.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Proposals in Progress
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {leads.map((lead, i) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="bg-card border-border hover:border-primary/40 transition-colors group">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{lead.lead_name}</h3>
                          {companies.length > 1 && (
                            <p className="text-xs text-muted-foreground">{lead.company_name}</p>
                          )}
                        </div>
                        <Badge className={statusColors[lead.status] || 'bg-muted text-muted-foreground'}>
                          {formatStatus(lead.status)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {lead.estimated_event_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(lead.estimated_event_date), 'dd MMM yyyy')}
                          </span>
                        )}
                        {lead.venue_text && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.venue_text}
                          </span>
                        )}
                      </div>

                      {lead.client_portal_token && (
                        <a
                          href={`${baseUrl}/lead/${lead.client_portal_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            size="sm"
                            className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 gap-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Details
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Active Events */}
        {events.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Your Events
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="bg-card border-border hover:border-primary/40 transition-colors group">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{event.event_name}</h3>
                          {companies.length > 1 && (
                            <p className="text-xs text-muted-foreground">{event.company_name}</p>
                          )}
                        </div>
                        <Badge className={statusColors[event.ops_status || ''] || 'bg-muted text-muted-foreground'}>
                          {formatStatus(event.ops_status)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {event.event_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(event.event_date), 'dd MMM yyyy')}
                          </span>
                        )}
                        {event.venue_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venue_name}
                          </span>
                        )}
                      </div>

                      {event.client_portal_token && (
                        <a
                          href={`${baseUrl}/event/${event.client_portal_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            size="sm"
                            className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 gap-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Event Details
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {leads.length === 0 && events.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No active projects</h2>
            <p className="text-muted-foreground text-sm">
              When you have leads or events with us, they'll appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
