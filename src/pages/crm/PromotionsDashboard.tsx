/**
 * PROMOTIONS DASHBOARD
 * 
 * CRM-focused dashboard for marketing/promotions targeting non-current clients:
 * - Prospects (companies never had an event)
 * - Previous clients (last event > 12 months ago)
 * - Win-back opportunities
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, subMonths, isAfter, isBefore } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Building2, 
  ChevronRight, 
  Mail, 
  Megaphone,
  UserPlus,
  Users,
  Clock,
  TrendingUp,
  Bug,
  ChevronDown,
  ChevronUp,
  Check,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Type for debug contact info
interface DebugContactInfo {
  id: string;
  contact_name: string;
  email: string | null;
  created_at: string;
  client_id: string | null;
  association_count: number;
  is_truly_orphan: boolean;
}

export default function PromotionsDashboard() {
  const [debugOpen, setDebugOpen] = useState(false);

  // Fetch clients with their event history
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-with-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          events:events(id, event_date, event_name)
        `)
        .eq('is_training', false)
        .order('business_name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch truly unassigned contacts with debug info
  const { data: orphanContactsData } = useQuery({
    queryKey: ['orphan-contacts-debug'],
    queryFn: async () => {
      // Get ALL contacts with null client_id to show debug info
      const { data: contactsWithoutClient, error: contactsError } = await supabase
        .from('client_contacts')
        .select('id, contact_name, email, created_at, client_id')
        .is('client_id', null)
        .order('created_at', { ascending: false });
      
      if (contactsError) throw contactsError;
      if (!contactsWithoutClient || contactsWithoutClient.length === 0) {
        return { orphanContacts: [], debugContacts: [] };
      }
      
      const contactIds = contactsWithoutClient.map(c => c.id);
      
      // Get association counts for each contact
      const { data: associations, error: assocError } = await supabase
        .from('contact_company_associations')
        .select('contact_id, is_active')
        .in('contact_id', contactIds);
      
      if (assocError) throw assocError;
      
      // Count active associations per contact
      const associationCounts = new Map<string, number>();
      associations?.forEach(a => {
        if (a.is_active) {
          associationCounts.set(a.contact_id, (associationCounts.get(a.contact_id) || 0) + 1);
        }
      });
      
      // Build debug info for all contacts
      const debugContacts: DebugContactInfo[] = contactsWithoutClient.map(c => ({
        id: c.id,
        contact_name: c.contact_name,
        email: c.email,
        created_at: c.created_at,
        client_id: c.client_id,
        association_count: associationCounts.get(c.id) || 0,
        is_truly_orphan: !associationCounts.has(c.id) || associationCounts.get(c.id) === 0
      }));
      
      // Filter to truly orphan contacts for display
      const orphanContacts = debugContacts
        .filter(c => c.is_truly_orphan)
        .slice(0, 10);
      
      return { orphanContacts, debugContacts };
    }
  });

  const orphanContacts = orphanContactsData?.orphanContacts || [];
  const debugContacts = orphanContactsData?.debugContacts || [];

  // Calculate client segments
  const segments = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    const sixMonthsAgo = subMonths(now, 6);

    const prospects: typeof clients = [];
    const previousClients: typeof clients = [];
    const winBackTargets: typeof clients = [];
    const recentClients: typeof clients = [];

    clients.forEach(client => {
      const events = (client as any).events || [];
      
      if (events.length === 0) {
        prospects.push(client);
      } else {
        const sortedEvents = [...events].sort((a: any, b: any) => 
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        );
        const lastEventDate = parseISO(sortedEvents[0].event_date);
        
        if (isBefore(lastEventDate, twelveMonthsAgo)) {
          previousClients.push(client);
          // Win-back if they had multiple events (loyal customers we lost)
          if (events.length >= 2) {
            winBackTargets.push(client);
          }
        } else if (isBefore(lastEventDate, sixMonthsAgo)) {
          // 6-12 months - potential churn risk
          winBackTargets.push(client);
        }
      }
    });

    return {
      prospects,
      previousClients,
      winBackTargets,
      totalNonCurrent: prospects.length + previousClients.length
    };
  }, [clients]);

  return (
    <AppLayout>
      <PageHeader
        title="Promotions Dashboard"
        description="Target non-current clients for marketing campaigns"
        actions={
          <Link to="/crm/emails">
            <Button className="bg-gradient-primary hover:opacity-90">
              <Mail className="h-4 w-4 mr-2" />
              Email Campaigns
            </Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard
            title="Prospects (No Events)"
            value={segments.prospects.length}
            icon={UserPlus}
            variant="primary"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatCard
            title="Previous (12+ Months)"
            value={segments.previousClients.length}
            icon={Clock}
            variant="default"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatCard
            title="Win-Back Targets"
            value={segments.winBackTargets.length}
            icon={TrendingUp}
            variant="warning"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatCard
            title="Orphan Contacts"
            value={orphanContacts.length}
            icon={Users}
            variant="default"
          />
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Prospects List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Prospects
              </CardTitle>
              <Link to="/crm/companies" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="text-center text-muted-foreground py-8">Loading...</div>
              ) : segments.prospects.length === 0 ? (
                <div className="text-center py-8">
                  <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No prospects found</p>
                </div>
              ) : (
                <div className="divide-y divide-border -mx-6">
                  {segments.prospects.slice(0, 5).map((client) => (
                    <Link
                      key={client.id}
                      to={`/crm/companies/${client.id}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.business_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {client.primary_contact_email || 'No email'}
                        </p>
                      </div>
                      <Badge variant="outline">Prospect</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Win-Back Targets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-warning" />
                Win-Back Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {segments.winBackTargets.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No win-back targets</p>
                </div>
              ) : (
                <div className="divide-y divide-border -mx-6">
                  {segments.winBackTargets.slice(0, 5).map((client) => {
                    const events = (client as any).events || [];
                    const lastEvent = events.sort((a: any, b: any) => 
                      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
                    )[0];
                    
                    return (
                      <Link
                        key={client.id}
                        to={`/crm/companies/${client.id}`}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{client.business_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Last event: {lastEvent ? format(parseISO(lastEvent.event_date), 'MMM yyyy') : 'N/A'}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                          {events.length} events
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Orphan Contacts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Unassigned Contacts
              </CardTitle>
              <Link to="/crm/contacts" className="text-sm text-primary hover:underline">
                Manage contacts
              </Link>
            </CardHeader>
            <CardContent>
              {orphanContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">All contacts are assigned to companies</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orphanContacts.map((contact) => (
                    <Link
                      key={contact.id}
                      to={`/crm/contacts/${contact.id}`}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {contact.contact_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{contact.contact_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.email || 'No email'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Debug Panel - Assignment Verification */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2"
        >
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <Card className="border-dashed border-muted-foreground/30">
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                      <Bug className="h-5 w-5" />
                      Debug: Assignment Verification
                      <Badge variant="outline" className="ml-2 font-normal">
                        {debugContacts.length} contacts analyzed
                      </Badge>
                    </CardTitle>
                    {debugOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium mb-1">Assignment Logic:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><strong>client_id</strong>: Direct FK to clients table (legacy assignment)</li>
                      <li><strong>association_count</strong>: Active links in contact_company_associations</li>
                      <li><strong>Truly Orphan</strong>: client_id IS NULL AND association_count = 0</li>
                    </ul>
                  </div>

                  {debugContacts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No contacts with null client_id</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium">Contact</th>
                            <th className="text-left py-2 px-3 font-medium">client_id</th>
                            <th className="text-center py-2 px-3 font-medium">Associations</th>
                            <th className="text-center py-2 px-3 font-medium">Truly Orphan?</th>
                            <th className="text-left py-2 px-3 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {debugContacts.slice(0, 20).map((contact) => (
                            <tr key={contact.id} className="hover:bg-muted/30">
                              <td className="py-2 px-3">
                                <Link 
                                  to={`/crm/contacts/${contact.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {contact.contact_name}
                                </Link>
                                {contact.email && (
                                  <span className="text-xs text-muted-foreground block">
                                    {contact.email}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {contact.client_id || 'NULL'}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge 
                                  variant={contact.association_count > 0 ? 'default' : 'secondary'}
                                  className="min-w-[2rem]"
                                >
                                  {contact.association_count}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {contact.is_truly_orphan ? (
                                  <Check className="h-4 w-4 text-primary mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-destructive mx-auto" />
                                )}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground text-xs">
                                {format(parseISO(contact.created_at), 'MMM d, yyyy')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {debugContacts.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Showing 20 of {debugContacts.length} contacts
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs">
                    <p className="font-medium mb-2">Summary:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <span className="text-muted-foreground">Total analyzed:</span>
                        <span className="font-medium ml-1">{debugContacts.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Truly orphan:</span>
                        <span className="font-medium ml-1 text-primary">
                          {debugContacts.filter(c => c.is_truly_orphan).length}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Has associations:</span>
                        <span className="font-medium ml-1 text-destructive">
                          {debugContacts.filter(c => !c.is_truly_orphan).length}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Displayed:</span>
                        <span className="font-medium ml-1">{orphanContacts.length}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      </div>
    </AppLayout>
  );
}
