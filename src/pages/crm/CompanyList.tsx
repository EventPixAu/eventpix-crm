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
} from 'lucide-react';

interface Company {
  id: string;
  business_name: string;
  trading_name: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  industry: string | null;
  status: string | null;
  website: string | null;
  contact_count: number;
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
          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,
          industry,
          status,
          website
        `)
        .eq('is_training', false)
        .order('business_name');

      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,trading_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%,primary_contact_email.ilike.%${search}%`
        );
      }

      const { data: clientsData, error } = await query;
      if (error) throw error;

      // Get contact counts for each company
      const { data: contactCounts } = await supabase
        .from('client_contacts')
        .select('client_id')
        .in('client_id', clientsData?.map(c => c.id) || []);

      const countMap = (contactCounts || []).reduce((acc, c) => {
        acc[c.client_id] = (acc[c.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (clientsData || []).map(company => ({
        ...company,
        contact_count: countMap[company.id] || 0,
      })) as Company[];
    },
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'inactive':
        return 'bg-muted text-muted-foreground';
      case 'prospect':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-muted text-muted-foreground';
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
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Industry</TableHead>
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
                      {company.primary_contact_name ? (
                        <div className="space-y-1">
                          <p className="text-sm">{company.primary_contact_name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {company.primary_contact_email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {company.primary_contact_email}
                              </span>
                            )}
                            {company.primary_contact_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {company.primary_contact_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {company.industry || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{company.contact_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(company.status)}
                      >
                        {company.status || 'Unknown'}
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
