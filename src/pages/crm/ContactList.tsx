/**
 * CONTACT LIST PAGE
 * 
 * CRM Contacts list with search and job title display
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
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
  User,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Briefcase,
  Upload,
} from 'lucide-react';
import { ContactImportDialog } from '@/components/crm/ContactImportDialog';
import { CreateStandaloneContactDialog } from '@/components/crm/CreateStandaloneContactDialog';

interface CompanyAssociation {
  company_id: string;
  company_name: string;
  is_primary: boolean;
}

interface Contact {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  job_title_id: string | null;
  job_title: { id: string; name: string } | null;
  role_title: string | null;
  is_primary: boolean | null;
  client_id: string | null;
  companies: CompanyAssociation[];
}

export default function ContactList() {
  const [search, setSearch] = useState('');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['crm-contacts', search],
    queryFn: async () => {
      // Fetch all contacts from master table
      let query = supabase
        .from('client_contacts')
        .select(`
          id,
          contact_name,
          first_name,
          last_name,
          email,
          phone,
          phone_mobile,
          job_title_id,
          job_title:job_titles(id, name),
          role_title,
          is_primary,
          client_id,
          is_freelance,
          clients(id, business_name, is_training)
        `)
        .order('contact_name');

      if (search) {
        query = query.or(
          `contact_name.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out training company contacts
      const filteredData = (data || []).filter((contact: any) => {
        if (contact.client_id && contact.clients?.is_training) {
          return false;
        }
        return true;
      });

      // Fetch ALL company associations for all contacts
      const contactIds = filteredData.map((c: any) => c.id);
      
      let associationsMap: Record<string, CompanyAssociation[]> = {};

      if (contactIds.length > 0) {
        const { data: associations } = await supabase
          .from('contact_company_associations')
          .select(`
            contact_id,
            company_id,
            is_primary,
            company:clients(id, business_name)
          `)
          .in('contact_id', contactIds)
          .eq('is_active', true)
          .order('is_primary', { ascending: false });

        // Build a map of contact_id -> all companies
        (associations || []).forEach((assoc: any) => {
          if (!associationsMap[assoc.contact_id]) {
            associationsMap[assoc.contact_id] = [];
          }
          associationsMap[assoc.contact_id].push({
            company_id: assoc.company_id,
            company_name: assoc.company?.business_name || 'Unknown',
            is_primary: assoc.is_primary,
          });
        });
      }

      return filteredData.map((contact: any) => {
        // Collect all companies for this contact
        const companies: CompanyAssociation[] = [];
        
        // Add direct client link first if it exists
        if (contact.client_id && contact.clients?.business_name) {
          companies.push({
            company_id: contact.client_id,
            company_name: contact.clients.business_name,
            is_primary: true,
          });
        }
        
        // Add associations (avoid duplicates with direct link)
        const contactAssociations = associationsMap[contact.id] || [];
        contactAssociations.forEach((assoc) => {
          // Don't add if it's the same as the direct client_id
          if (assoc.company_id !== contact.client_id) {
            companies.push(assoc);
          }
        });

        return {
          id: contact.id,
          contact_name: contact.contact_name,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          phone_mobile: contact.phone_mobile,
          job_title_id: contact.job_title_id,
          job_title: contact.job_title,
          role_title: contact.role_title,
          is_primary: contact.is_primary,
          client_id: contact.client_id,
          companies,
        };
      }) as Contact[];
    },
  });

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <AppLayout>
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Individual Contacts"
        description="Manage contacts across all companies"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Contact</span>
            </Button>
          </div>
        }
      />

      <ContactImportDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      <CreateStandaloneContactDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {search ? 'No contacts match your search' : 'No contacts yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    to={`/crm/contacts/${contact.id}`}
                    className="block p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">
                          {contact.first_name || contact.last_name 
                            ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                            : contact.contact_name}
                        </span>
                        {contact.is_primary && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {contact.companies.length > 0 ? (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div className="flex flex-wrap gap-1">
                            {contact.companies.map((company, idx) => (
                              <span key={company.company_id} className="truncate">
                                {company.company_name}
                                {company.is_primary && <span className="text-xs ml-0.5">(P)</span>}
                                {idx < contact.companies.length - 1 && ', '}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate italic">No company</span>
                        </div>
                      )}
                      {contact.job_title?.name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{contact.job_title.name}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone_mobile && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{contact.phone_mobile}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Tablet/Desktop Table View */}
              <div className="hidden md:block overflow-x-auto -mx-3 sm:-mx-6 px-3 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      <TableHead className="min-w-[200px]">Companies</TableHead>
                      <TableHead className="min-w-[120px]">Job Title</TableHead>
                      <TableHead className="min-w-[180px]">Email</TableHead>
                      <TableHead className="min-w-[120px]">Mobile</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/crm/contacts/${contact.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {contact.first_name || contact.last_name 
                                ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                                : contact.contact_name}
                            </Link>
                            {contact.is_primary && (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.companies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {contact.companies.map((company) => (
                                <Link
                                  key={company.company_id}
                                  to={`/crm/companies/${company.company_id}`}
                                  className="inline-flex items-center gap-1 text-sm hover:text-primary"
                                >
                                  <Badge 
                                    variant={company.is_primary ? "default" : "secondary"} 
                                    className="gap-1 text-xs"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {company.company_name}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="flex items-center gap-2 text-sm text-muted-foreground italic">
                              <Building2 className="h-4 w-4 shrink-0" />
                              No company
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.job_title?.name ? (
                            <Badge variant="secondary" className="gap-1">
                              <Briefcase className="h-3 w-3" />
                              {contact.job_title.name}
                            </Badge>
                          ) : contact.role_title ? (
                            <span className="text-sm">{contact.role_title}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1 text-sm hover:text-primary"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[180px]">{contact.email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.phone_mobile ? (
                            <a
                              href={`tel:${contact.phone_mobile}`}
                              className="flex items-center gap-1 text-sm hover:text-primary whitespace-nowrap"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              {contact.phone_mobile}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/crm/contacts/${contact.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </AppLayout>
  );
}
