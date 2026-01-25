/**
 * COMPANY LIST PAGE
 * 
 * CRM Companies list with search and category display
 * Status is computed from event data:
 * - Active Event: has current/upcoming event
 * - Current Client: delivered event in last 12 months
 * - Previous Client: delivered event older than 12 months
 * - Prospect: no delivered events
 * 
 * Features:
 * - Inline status editing for Admin/Sales
 * - Bulk status update for selected companies
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Upload,
  CheckSquare,
} from 'lucide-react';
import { ContactImportDialog } from '@/components/crm/ContactImportDialog';
import { InlineStatusEditor } from '@/components/crm/InlineStatusEditor';
import { BulkStatusUpdateDialog } from '@/components/crm/BulkStatusUpdateDialog';
import { useAuth } from '@/lib/auth';
import { subMonths, isAfter, parseISO, isBefore, startOfDay } from 'date-fns';

type ComputedStatus = 'active_event' | 'current_client' | 'previous_client' | 'prospect';

interface Company {
  id: string;
  business_name: string;
  trading_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  billing_address: string | null;
  category_id: string | null;
  category: { id: string; name: string } | null;
  manual_status: string | null;
  status_override_reason: string | null;
  computed_status: ComputedStatus;
  display_status: ComputedStatus;
  is_override: boolean;
  contact_count: number;
  // Primary contact from linked contacts
  primary_contact_name: string | null;
  primary_contact_email: string | null;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const canBulkEdit = isAdmin; // Only Admin can bulk edit

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
          billing_address,
          category_id,
          manual_status,
          status_override_reason,
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

      // Get contact counts, primary contacts, and events in parallel
      const [contactCountsResult, primaryContactsResult, eventsResult] = await Promise.all([
        supabase
          .from('client_contacts')
          .select('client_id')
          .in('client_id', clientIds),
        // Get primary contacts from contact_company_associations
        supabase
          .from('contact_company_associations')
          .select(`
            company_id,
            contact:client_contacts(contact_name, email)
          `)
          .in('company_id', clientIds)
          .eq('is_primary', true),
        supabase
          .from('events')
          .select('client_id, event_date, ops_status')
          .in('client_id', clientIds)
      ]);

      const countMap = (contactCountsResult.data || []).reduce((acc, c) => {
        acc[c.client_id] = (acc[c.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Map primary contacts by company_id
      const primaryContactMap = (primaryContactsResult.data || []).reduce((acc, pc) => {
        const contact = pc.contact as { contact_name: string; email: string | null } | null;
        if (contact) {
          acc[pc.company_id] = {
            name: contact.contact_name,
            email: contact.email,
          };
        }
        return acc;
      }, {} as Record<string, { name: string; email: string | null }>);

      const eventsMap = (eventsResult.data || []).reduce((acc, e) => {
        if (!acc[e.client_id]) acc[e.client_id] = [];
        acc[e.client_id].push({ event_date: e.event_date, ops_status: e.ops_status });
        return acc;
      }, {} as Record<string, Array<{ event_date: string; ops_status: string | null }>>);

      return (clientsData || []).map(company => {
        const computed = computeClientStatus(eventsMap[company.id] || []);
        const manualStatus = company.manual_status as ComputedStatus | null;
        const primaryContact = primaryContactMap[company.id];
        return {
          ...company,
          contact_count: countMap[company.id] || 0,
          computed_status: computed,
          display_status: manualStatus || computed,
          is_override: !!manualStatus,
          status_override_reason: company.status_override_reason,
          primary_contact_name: primaryContact?.name || null,
          primary_contact_email: primaryContact?.email || null,
        };
      }) as Company[];
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-companies'] });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === companies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map(c => c.id)));
    }
  };

  const handleBulkComplete = () => {
    setSelectedIds(new Set());
    handleRefresh();
  };

  return (
    <AppLayout>
    <div className="space-y-6">
      <PageHeader
        title="Company Accounts"
        description="Manage your business relationships"
        actions={
          <div className="flex items-center gap-2">
            {canBulkEdit && selectedIds.size > 0 && (
              <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Set Status ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button asChild>
              <Link to="/crm/companies/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Link>
            </Button>
          </div>
        }
      />
      
      <ContactImportDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      <BulkStatusUpdateDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCompanyIds={Array.from(selectedIds)}
        companies={companies}
        onComplete={handleBulkComplete}
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
                  {canBulkEdit && (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedIds.size === companies.length && companies.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
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
                    {canBulkEdit && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(company.id)}
                          onCheckedChange={() => toggleSelection(company.id)}
                        />
                      </TableCell>
                    )}
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
                        {company.primary_contact_name && (
                          <div className="text-sm font-medium">
                            {company.primary_contact_name}
                          </div>
                        )}
                        {(company.primary_contact_email || company.company_email) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[200px]">
                              {company.primary_contact_email || company.company_email}
                            </span>
                          </div>
                        )}
                        {company.company_phone && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {company.company_phone}
                          </div>
                        )}
                        {!company.primary_contact_name && !company.primary_contact_email && 
                         !company.company_email && !company.company_phone && (
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
                      <InlineStatusEditor
                        companyId={company.id}
                        currentStatus={company.display_status}
                        isOverride={company.is_override}
                        computedStatus={company.computed_status}
                        overrideReason={company.status_override_reason}
                        onStatusChange={handleRefresh}
                      />
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
    </AppLayout>
  );
}
