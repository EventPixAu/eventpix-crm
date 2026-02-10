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
 * - Bulk delete for selected companies
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Trash2,
  FolderOpen,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from 'lucide-react';
import { ContactImportDialog } from '@/components/crm/ContactImportDialog';
import { InlineStatusEditor } from '@/components/crm/InlineStatusEditor';
import { BulkStatusUpdateDialog } from '@/components/crm/BulkStatusUpdateDialog';
import { BulkCategoryUpdateDialog } from '@/components/crm/BulkCategoryUpdateDialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useCompanyStatuses } from '@/hooks/useCompanyStatuses';
import { subMonths, isAfter, parseISO, isBefore, startOfDay } from 'date-fns';

type SortColumn = 'tags' | 'category' | 'source' | 'status' | null;
type SortDirection = 'asc' | 'desc';

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
  lead_source: string | null;
  manual_status: string | null;
  status_override_reason: string | null;
  computed_status: ComputedStatus;
  display_status: ComputedStatus;
  is_override: boolean;
  contact_count: number;
  // Primary contact from linked contacts
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  // Aggregated tags from all linked contacts
  tags: string[];
  // Aggregated sources from all linked contacts
  contact_sources: string[];
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
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canBulkEdit = isAdmin; // Only Admin can bulk edit
  const { data: companyStatuses = [] } = useCompanyStatuses();

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete in batches to avoid URL length limits
      const batchSize = 50;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase
          .from('clients')
          .delete()
          .in('id', batch);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: `${selectedIds.size} ${selectedIds.size === 1 ? 'company' : 'companies'} deleted` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['crm-companies'] });
    },
    onError: (error: Error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to delete companies', 
        description: error.message 
      });
    },
  });

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
          lead_source,
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

      const clientIdSet = new Set(clientsData?.map(c => c.id) || []);

      // Get contact counts, primary contacts, tags, and events
      // Fetch ALL contacts with client_id to avoid .in() limit issues with large datasets
      const [contactsResult, associationsResult, eventsResult] = await Promise.all([
        // Get all contacts that have a client_id (direct link)
        supabase
          .from('client_contacts')
          .select('client_id, tags, source')
          .not('client_id', 'is', null),
        // Get all contact_company_associations (for count and primary contacts)
        supabase
          .from('contact_company_associations')
          .select(`
            company_id,
            contact_id,
            is_primary,
            contact:client_contacts(contact_name, email, tags, source)
          `)
          .eq('is_active', true),
        // Get all events for these clients
        supabase
          .from('events')
          .select('client_id, event_date, ops_status')
          .not('client_id', 'is', null)
      ]);

      // Build count map and tags map from contacts
      // Use a Set to track unique contact IDs per company (avoid double-counting)
      const contactIdsByCompany: Record<string, Set<string>> = {};
      const tagsMap: Record<string, Set<string>> = {};
      const sourcesMap: Record<string, Set<string>> = {};
      
      // Count contacts with direct client_id link (filter to only companies in our result set)
      (contactsResult.data || []).forEach(c => {
        if (!c.client_id || !clientIdSet.has(c.client_id)) return;
        if (!contactIdsByCompany[c.client_id]) contactIdsByCompany[c.client_id] = new Set();
        // We don't have the contact ID here, so we use a placeholder - this is fine for counting
        // since each row is a unique contact
        contactIdsByCompany[c.client_id].add(`direct-${contactIdsByCompany[c.client_id].size}`);
        if (c.tags && Array.isArray(c.tags)) {
          if (!tagsMap[c.client_id]) tagsMap[c.client_id] = new Set();
          c.tags.forEach((tag: string) => tagsMap[c.client_id].add(tag));
        }
        if (c.source) {
          if (!sourcesMap[c.client_id]) sourcesMap[c.client_id] = new Set();
          sourcesMap[c.client_id].add(c.source);
        }
      });

      // Process associations for counts, primary contacts, and tags
      const primaryContactMap: Record<string, { name: string; email: string | null }> = {};
      
      (associationsResult.data || []).forEach(assoc => {
        if (!clientIdSet.has(assoc.company_id)) return;
        
        const contact = assoc.contact as { contact_name: string; email: string | null; tags: string[] | null; source: string | null } | null;
        if (!contact) return;
        
        // Add to contact count (using contact_id to dedupe)
        if (!contactIdsByCompany[assoc.company_id]) contactIdsByCompany[assoc.company_id] = new Set();
        contactIdsByCompany[assoc.company_id].add(assoc.contact_id);
        
        // Track primary contact
        if (assoc.is_primary && !primaryContactMap[assoc.company_id]) {
          primaryContactMap[assoc.company_id] = {
            name: contact.contact_name,
            email: contact.email,
          };
        }
        
        // Collect tags
        if (contact.tags && Array.isArray(contact.tags)) {
          if (!tagsMap[assoc.company_id]) tagsMap[assoc.company_id] = new Set();
          contact.tags.forEach((tag: string) => tagsMap[assoc.company_id].add(tag));
        }
        
        // Collect sources
        if (contact.source) {
          if (!sourcesMap[assoc.company_id]) sourcesMap[assoc.company_id] = new Set();
          sourcesMap[assoc.company_id].add(contact.source);
        }
      });

      // Build final count map
      const countMap: Record<string, number> = {};
      Object.entries(contactIdsByCompany).forEach(([companyId, contactIds]) => {
        countMap[companyId] = contactIds.size;
      });

      const eventsMap = (eventsResult.data || []).reduce((acc, e) => {
        if (!e.client_id || !clientIdSet.has(e.client_id)) return acc;
        if (!acc[e.client_id]) acc[e.client_id] = [];
        acc[e.client_id].push({ event_date: e.event_date, ops_status: e.ops_status });
        return acc;
      }, {} as Record<string, Array<{ event_date: string; ops_status: string | null }>>);

      return (clientsData || []).map(company => {
        const computed = computeClientStatus(eventsMap[company.id] || []);
        const manualStatus = company.manual_status as ComputedStatus | null;
        const primaryContact = primaryContactMap[company.id];
        const companyTags = tagsMap[company.id] ? Array.from(tagsMap[company.id]).sort() : [];
        const companySources = sourcesMap[company.id] ? Array.from(sourcesMap[company.id]).sort() : [];
        return {
          ...company,
          contact_count: countMap[company.id] || 0,
          computed_status: computed,
          display_status: manualStatus || computed,
          is_override: !!manualStatus,
          status_override_reason: company.status_override_reason,
          primary_contact_name: primaryContact?.name || null,
          primary_contact_email: primaryContact?.email || null,
          tags: companyTags,
          contact_sources: companySources,
        };
      }) as Company[];
    },
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const sortedCompanies = useMemo(() => {
    if (!sortColumn) return companies;
    
    return [...companies].sort((a, b) => {
      let aVal: string = '';
      let bVal: string = '';
      
      switch (sortColumn) {
        case 'tags':
          aVal = a.tags.join(',').toLowerCase();
          bVal = b.tags.join(',').toLowerCase();
          break;
        case 'category':
          aVal = (a.category?.name || '').toLowerCase();
          bVal = (b.category?.name || '').toLowerCase();
          break;
        case 'source': {
          const aSources = new Set<string>();
          if (a.lead_source) aSources.add(a.lead_source);
          a.contact_sources.forEach(s => aSources.add(s));
          const bSources = new Set<string>();
          if (b.lead_source) bSources.add(b.lead_source);
          b.contact_sources.forEach(s => bSources.add(s));
          aVal = Array.from(aSources).join(',').toLowerCase();
          bVal = Array.from(bSources).join(',').toLowerCase();
          break;
        }
        case 'status':
          aVal = a.display_status.toLowerCase();
          bVal = b.display_status.toLowerCase();
          break;
      }
      
      // Empty values always go to the end
      if (!aVal && bVal) return 1;
      if (aVal && !bVal) return -1;
      if (!aVal && !bVal) return 0;
      
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [companies, sortColumn, sortDirection]);

  // Compute unique filter options from data
  const filterOptions = useMemo(() => {
    const tags = new Set<string>();
    const categories = new Set<string>();
    const sources = new Set<string>();
    const statuses = new Set<string>();

    companies.forEach(c => {
      c.tags.forEach(t => tags.add(t));
      if (c.category?.name) categories.add(c.category.name);
      if (c.lead_source) sources.add(c.lead_source);
      c.contact_sources.forEach(s => sources.add(s));
      statuses.add(c.display_status);
    });

    return {
      tags: Array.from(tags).sort(),
      categories: Array.from(categories).sort(),
      sources: Array.from(sources).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [companies]);

  // Apply filters
  const filteredCompanies = useMemo(() => {
    return sortedCompanies.filter(c => {
      if (filterTag && !c.tags.includes(filterTag)) return false;
      if (filterCategory && c.category?.name !== filterCategory) return false;
      if (filterSource) {
        const allSources = new Set<string>();
        if (c.lead_source) allSources.add(c.lead_source);
        c.contact_sources.forEach(s => allSources.add(s));
        if (!allSources.has(filterSource)) return false;
      }
      if (filterStatus && c.display_status !== filterStatus) return false;
      return true;
    });
  }, [sortedCompanies, filterTag, filterCategory, filterSource, filterStatus]);

  const hasActiveFilters = filterTag || filterCategory || filterSource || filterStatus;

  const clearAllFilters = () => {
    setFilterTag('');
    setFilterCategory('');
    setFilterSource('');
    setFilterStatus('');
  };

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
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map(c => c.id)));
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
              <>
                <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Set Status ({selectedIds.size})
                </Button>
                <Button variant="outline" onClick={() => setBulkCategoryDialogOpen(true)}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Set Category ({selectedIds.size})
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedIds.size})
                </Button>
              </>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} {selectedIds.size === 1 ? 'company' : 'companies'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All associated contacts, events, quotes, and contracts 
              linked to these companies will lose their company reference or may be deleted depending 
              on database constraints.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkStatusUpdateDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCompanyIds={Array.from(selectedIds)}
        companies={companies}
        onComplete={handleBulkComplete}
      />

      <BulkCategoryUpdateDialog
        open={bulkCategoryDialogOpen}
        onOpenChange={setBulkCategoryDialogOpen}
        selectedCompanyIds={Array.from(selectedIds)}
        onComplete={handleBulkComplete}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
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
              {hasActiveFilters
                ? `${filteredCompanies.length} of ${companies.length} companies`
                : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'}`}
            </div>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterTag || '__all__'} onValueChange={v => setFilterTag(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Tags</SelectItem>
                {filterOptions.tags.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory || '__all__'} onValueChange={v => setFilterCategory(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Categories</SelectItem>
                {filterOptions.categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSource || '__all__'} onValueChange={v => setFilterSource(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sources</SelectItem>
                {filterOptions.sources.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus || '__all__'} onValueChange={v => setFilterStatus(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {filterOptions.statuses.map(s => {
                  const statusDef = companyStatuses.find(cs => cs.name === s);
                  return (
                    <SelectItem key={s} value={s}>{statusDef?.label || s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
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
                        checked={selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('tags')}
                  >
                    <div className="flex items-center">
                      Tags
                      <SortIcon column="tags" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">
                      Category
                      <SortIcon column="category" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('source')}
                  >
                    <div className="flex items-center">
                      Source
                      <SortIcon column="source" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      <SortIcon column="status" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
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
                      {company.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {company.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {company.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{company.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
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
                    <TableCell>
                      {(() => {
                        const allSources = new Set<string>();
                        if (company.lead_source) allSources.add(company.lead_source);
                        company.contact_sources.forEach(s => allSources.add(s));
                        const sources = Array.from(allSources);
                        if (sources.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
                        return (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {sources.slice(0, 3).map((src) => (
                              <Badge key={src} variant="secondary" className="gap-1 text-xs">
                                <Database className="h-3 w-3" />
                                {src}
                              </Badge>
                            ))}
                            {sources.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{sources.length - 3}
                              </Badge>
                            )}
                          </div>
                        );
                      })()}
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
