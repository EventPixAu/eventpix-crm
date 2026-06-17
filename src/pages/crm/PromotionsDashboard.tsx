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
import { format, parseISO, subMonths, isBefore, isToday, isThisWeek, startOfDay } from 'date-fns';
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
  X,
  UserCheck,
  History,
  HelpCircle,
  Briefcase,
  School,
  MapPin,
  Camera,
  Video,
  Radio,
  Package,
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  CalendarCheck,
  ListTodo,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
import { Progress } from '@/components/ui/progress';
import { useCompanyStatuses } from '@/hooks/useCompanyStatuses';

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

interface ContactSummary {
  id: string;
  contact_name: string;
  email: string | null;
  status: string | null;
  category: string | null;
  archived: boolean | null;
  client_id: string | null;
  has_associations: boolean;
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
          category:company_categories(id, name),
          events:events(id, event_date, event_name)
        `)
        .eq('is_training', false)
        .order('business_name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Companies grouped by Parent Category
  const companiesByParent = useMemo(() => {
    const counts = new Map<string, number>();
    clients.forEach((c: any) => {
      const name = c.category?.name || 'Uncategorised';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [clients]);

  // Fetch truly unassigned contacts with debug info
  const { data: orphanContactsData } = useQuery({
    queryKey: ['orphan-contacts-debug'],
    queryFn: async () => {
      // Get ALL contacts with null client_id to show debug info
      const { data: contactsWithoutClient, error: contactsError } = await supabase
        .from('client_contacts')
        .select('id, contact_name, email, created_at, client_id, archived')
        .is('client_id', null)
        .or('archived.is.null,archived.eq.false')
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

  // Fetch all contacts for status/category/data health
  const { data: allContacts = [] } = useQuery({
    queryKey: ['crm-dashboard-all-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('id, contact_name, email, status, category, archived, client_id')
        .order('contact_name');
      if (error) throw error;

      // Fetch active associations to determine "has company"
      const contactIds = (data || []).map((c: any) => c.id);
      let assocSet = new Set<string>();
      if (contactIds.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < contactIds.length; i += batchSize) {
          const batch = contactIds.slice(i, i + batchSize);
          const { data: assocData } = await supabase
            .from('contact_company_associations')
            .select('contact_id')
            .in('contact_id', batch)
            .eq('is_active', true);
          (assocData || []).forEach((a: any) => assocSet.add(a.contact_id));
        }
      }

      return (data || []).map((c: any) => ({
        id: c.id,
        contact_name: c.contact_name,
        email: c.email,
        status: c.status,
        category: c.category,
        archived: c.archived,
        client_id: c.client_id,
        has_associations: assocSet.has(c.id) || !!c.client_id,
      })) as ContactSummary[];
    },
  });

  // Fetch contact-related tasks for follow-up snapshot
  const { data: contactTasks = [] } = useQuery({
    queryKey: ['crm-dashboard-contact-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, status, due_at')
        .eq('related_type', 'contact')
        .order('due_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Contact Status counts
  const { data: companyStatuses = [] } = useCompanyStatuses();
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    companyStatuses.forEach(s => { counts[s.label] = 0; });
    counts['Unassigned'] = 0;
    allContacts.forEach(c => {
      if (!c.status) {
        counts['Unassigned']++;
      } else if (counts[c.status] !== undefined) {
        counts[c.status]++;
      } else {
        counts['Unassigned']++;
      }
    });
    return counts;
  }, [allContacts, companyStatuses]);

  // Contact Category counts — exclude Staff contacts from client-side aggregates
  const clientContacts = useMemo(
    () => allContacts.filter((c: any) => c.status !== 'Staff'),
    [allContacts]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const knownCategories = [
      'Schools',
      'Event Management',
      'Professional Conference Organiser (PCO)',
      'PCO',
      'Marketing and PR',
      'Venue Management',
      'Photographer',
      'Videographer',
      'AV Production',
      'Event Supplier',
    ];
    knownCategories.forEach(cat => { counts[cat] = 0; });
    counts['Uncategorised'] = 0;
    clientContacts.forEach(c => {
      if (!c.category) {
        counts['Uncategorised']++;
      } else if (counts[c.category] !== undefined) {
        counts[c.category]++;
      } else {
        // If it's a known variant (e.g. just "PCO")
        const matched = knownCategories.find(k => 
          c.category!.toLowerCase().includes(k.toLowerCase()) ||
          k.toLowerCase().includes(c.category!.toLowerCase())
        );
        if (matched) {
          counts[matched]++;
        } else {
          counts[c.category] = (counts[c.category] || 0) + 1;
        }
      }
    });
    return counts;
  }, [clientContacts]);

  // Data health — exclude Staff from client totals
  const dataHealth = useMemo(() => {
    const total = clientContacts.length;
    const incomplete = clientContacts.filter(c =>
      !c.email || !c.has_associations || !c.status || !c.category
    );
    const archived = clientContacts.filter(c => c.archived);
    const complete = total - incomplete.length;
    const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, complete, incomplete: incomplete.length, archived: archived.length, percentage };
  }, [clientContacts]);

  // Follow-up snapshot
  const followUpStats = useMemo(() => {
    const today = startOfDay(new Date());
    const pendingTasks = contactTasks.filter((t: any) => t.status !== 'done');
    const overdue = pendingTasks.filter((t: any) => {
      const due = t.due_at ? parseISO(t.due_at) : null;
      return due && isBefore(due, today);
    });
    const dueToday = pendingTasks.filter((t: any) => {
      const due = t.due_at ? parseISO(t.due_at) : null;
      return due && isToday(due);
    });
    const dueThisWeek = pendingTasks.filter((t: any) => {
      const due = t.due_at ? parseISO(t.due_at) : null;
      return due && isThisWeek(due, { weekStartsOn: 1 });
    });
    return { overdue: overdue.length, dueToday: dueToday.length, dueThisWeek: dueThisWeek.length };
  }, [contactTasks]);

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

  const statusOrder = ['Active', 'Current', 'Previous', 'Old', 'Prospect', 'Staff', 'Archived', 'Unassigned'];
  const categoryOrder = [
    'Schools',
    'Event Management',
    'Professional Conference Organiser (PCO)',
    'Marketing and PR',
    'Venue Management',
    'Photographer',
    'Videographer',
    'AV Production',
    'Event Supplier',
  ];

  const statusIcons: Record<string, React.ElementType> = {
    Active: Activity,
    Current: UserCheck,
    Previous: History,
    Old: Clock,
    Prospect: UserPlus,
    Staff: Users,
    Archived: Archive,
    Unassigned: HelpCircle,
  };

  const categoryIcons: Record<string, React.ElementType> = {
    'Schools': School,
    'Event Management': Briefcase,
    'Professional Conference Organiser (PCO)': Building2,
    'PCO': Building2,
    'Marketing and PR': Megaphone,
    'Venue Management': MapPin,
    'Photographer': Camera,
    'Videographer': Video,
    'AV Production': Radio,
    'Event Supplier': Package,
  };

  const statusColors: Record<string, string> = {
    Current: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    Previous: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    Old: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    Prospect: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    Staff: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    Unassigned: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  };

  return (
    <AppLayout>
      <PageHeader
        title="Promotions Dashboard"
        description="Target non-current clients for marketing campaigns"
        actions={
          <Link to="/crm/emails?tab=campaigns">
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

      {/* Companies by Parent Category */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Companies by Parent Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {companiesByParent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categorised companies yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {companiesByParent.map(([name, count]) => (
                <Link
                  key={name}
                  to="/crm/companies"
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                >
                  <span className="text-sm font-medium truncate pr-2">{name}</span>
                  <Badge variant="secondary">{count}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* NEW PANELS */}
      <div className="mt-8 space-y-6">
        {/* Row 1: Contact Status & Category Summaries */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Contact Status Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Contact Status Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statusOrder.map((status) => {
                    const count = statusCounts[status] || 0;
                    const total = allContacts.length || 1;
                    const pct = Math.round((count / total) * 100);
                    const Icon = statusIcons[status] || HelpCircle;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${statusColors[status] || 'bg-muted'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{status}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t text-center">
                  <Link to="/crm/contacts" className="text-sm text-primary hover:underline">
                    View all contacts
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Category Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Contact Category Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryOrder.map((cat) => {
                    const count = categoryCounts[cat] || 0;
                    const total = allContacts.length || 1;
                    const pct = Math.round((count / total) * 100);
                    const Icon = categoryIcons[cat] || Briefcase;
                    const label = cat === 'Professional Conference Organiser (PCO)' ? 'PCO' : cat;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{label}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                  {/* Uncategorised */}
                  {(() => {
                    const count = categoryCounts['Uncategorised'] || 0;
                    const total = allContacts.length || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Uncategorised</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-muted-foreground/30 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-4 pt-3 border-t text-center">
                  <Link to="/crm/contacts" className="text-sm text-primary hover:underline">
                    View all contacts
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Row 2: Data Health & Follow-up Snapshot */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Data Health Indicator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Data Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-muted"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="text-primary"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${dataHealth.percentage}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{dataHealth.percentage}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      <strong>{dataHealth.complete}</strong> of <strong>{dataHealth.total}</strong> contacts have all key fields
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Email, Company, Status &amp; Category
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-lg font-bold">{dataHealth.incomplete}</p>
                      <p className="text-xs text-muted-foreground">Incomplete</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-500/5 border border-slate-500/10">
                    <Archive className="h-5 w-5 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-lg font-bold">{dataHealth.archived}</p>
                      <p className="text-xs text-muted-foreground">Archived</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t text-center">
                  <Link to="/crm/contacts" className="text-sm text-primary hover:underline">
                    Manage contact data
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Follow-up Snapshot */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                  Follow-up Snapshot
                </CardTitle>
                <Link to="/crm/follow-ups" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View dashboard <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-xl font-bold text-destructive">{followUpStats.overdue}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold text-primary">{followUpStats.dueToday}</p>
                    <p className="text-xs text-muted-foreground">Due Today</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted border">
                    <ListTodo className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xl font-bold">{followUpStats.dueThisWeek}</p>
                    <p className="text-xs text-muted-foreground">This Week</p>
                  </div>
                </div>

                <Link to="/crm/follow-ups">
                  <Button variant="outline" className="w-full">
                    <CalendarCheck className="h-4 w-4 mr-2" />
                    Open Follow-up Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
