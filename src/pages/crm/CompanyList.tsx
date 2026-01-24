/**
 * COMPANY LIST PAGE
 * 
 * CRM Companies list with search and category display
 * Status is computed from event data:
 * - Active Event: has current/upcoming event
 * - Current Client: delivered event in last 12 months
 * - Previous Client: delivered event older than 12 months
 * - Prospect: no delivered events
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  ExternalLink,
  Tag,
} from 'lucide-react';
import { subMonths, isAfter, parseISO, isBefore, startOfDay } from 'date-fns';

type ComputedStatus = 'active_event' | 'current_client' | 'previous_client' | 'prospect';

interface Company {
  id: string;
  business_name: string;
  trading_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  billing_address: string | null;
  category_id: string | null;
  category: { id: string; name: string } | null;
  computed_status: ComputedStatus;
  contact_count: number;
}

function computeClientStatus(events: Array<{ event_date: string; ops_status: string | null }>): ComputedStatus {
  if (!events || events.length === 0) return 'prospect';
  
  const today = startOfDay(new Date());
  const twelveMonthsAgo = subMonths(today, 12);
  
  // Check for active events (not completed/cancelled, date is today or future)
  const hasActiveEvent = events.some(e => {
    const eventDate = parseISO(e.event_date);
    const isActive = !['completed', 'cancelled'].includes(e.ops_status || '');
    return isActive && !isBefore(eventDate, today);
  });
  
  if (hasActiveEvent) return 'active_event';
  
  // Check for completed events
  const completedEvents = events.filter(e => e.ops_status === 'completed');
  if (completedEvents.length === 0) return 'prospect';
  
  // Find most recent completed event
  const mostRecentCompleted = completedEvents
    .map(e => parseISO(e.event_date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  
  if (isAfter(mostRecentCompleted, twelveMonthsAgo)) {
    return 'current_client';
  }
  
  return 'previous_client';
}

export default function CompanyList() {
  const [search, setSearch] = useState('');

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['crm-companies', search],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select(`
          id,
          business_name,
          trading_name,
          company_phone,
          company_email,
          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,
          billing_address,
          category_id,
          category:company_categories(id, name)
        `)
        .eq('is_training', false)
        .order('business_name');

      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,trading_name.ilike.%${search}%,company_email.ilike.%${search}%`
        );
      }

      const { data: clientsData, error } = await query;
      if (error) throw error;

      const clientIds = clientsData?.map(c => c.id) || [];

      // Get contact counts and events in parallel
      const [contactCountsResult, eventsResult] = await Promise.all([
        supabase
          .from('client_contacts')
          .select('client_id')
          .in('client_id', clientIds),
        supabase
          .from('events')
          .select('client_id, event_date, ops_status')
          .in('client_id', clientIds)
      ]);

      const countMap = (contactCountsResult.data || []).reduce((acc, c) => {
        acc[c.client_id] = (acc[c.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const eventsMap = (eventsResult.data || []).reduce((acc, e) => {
        if (!acc[e.client_id]) acc[e.client_id] = [];
        acc[e.client_id].push({ event_date: e.event_date, ops_status: e.ops_status });
        return acc;
      }, {} as Record<string, Array<{ event_date: string; ops_status: string | null }>>);

      return (clientsData || []).map(company => ({
        ...company,
        contact_count: countMap[company.id] || 0,
        computed_status: computeClientStatus(eventsMap[company.id] || []),
      })) as Company[];
    },
  });

  const getStatusConfig = (status: ComputedStatus) => {
    switch (status) {
      case 'active_event':
        return { label: 'Active Event', className: 'bg-green-500/10 text-green-600 border-green-500/20' };
      case 'current_client':
        return { label: 'Current Client', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
      case 'previous_client':
        return { label: 'Previous Client', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'prospect':
        return { label: 'Prospect', className: 'bg-muted text-muted-foreground' };
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Accounts"
        description="Manage your business relationships"
        actions={
          <Button asChild>
            <Link to="/crm/companies/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading companies...
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {search ? 'No companies match your search' : 'No companies yet'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        to={`/crm/companies/${company.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {company.business_name}
                      </Link>
                      {company.trading_name && (
                        <p className="text-sm text-muted-foreground">
                          t/a {company.trading_name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {(company.company_email || company.primary_contact_email) && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]">
                              {company.company_email || company.primary_contact_email}
                            </span>
                          </div>
                        )}
                        {(company.company_phone || company.primary_contact_phone) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {company.company_phone || company.primary_contact_phone}
                          </div>
                        )}
                        {!company.company_email && !company.primary_contact_email && 
                         !company.company_phone && !company.primary_contact_phone && (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.category?.name ? (
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {company.category.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{company.contact_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusConfig(company.computed_status).className}
                      >
                        {getStatusConfig(company.computed_status).label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/crm/companies/${company.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
