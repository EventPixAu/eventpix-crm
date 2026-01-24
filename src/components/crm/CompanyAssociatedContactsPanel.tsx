/**
 * Panel showing all associated contacts for a company
 * These are contacts whose primary company is elsewhere but work with this company
 */
import { Link } from 'react-router-dom';
import { User, Building2, Briefcase, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useCompanyAssociations,
  RELATIONSHIP_TYPES,
} from '@/hooks/useContactCompanyAssociations';

interface CompanyAssociatedContactsPanelProps {
  companyId: string;
}

export function CompanyAssociatedContactsPanel({ companyId }: CompanyAssociatedContactsPanelProps) {
  const { data: associations = [], isLoading } = useCompanyAssociations(companyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Associated Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (associations.length === 0) {
    return null; // Don't show panel if no associations
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Associated Contacts
          <Badge variant="secondary" className="ml-auto text-xs">
            {associations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-3">
          Contacts from other companies who also work with this company
        </p>
        <div className="space-y-2">
          {associations.map((assoc) => (
            <Link
              key={assoc.id}
              to={`/crm/contacts/${assoc.contact_id}`}
              className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {assoc.contact?.contact_name || 'Unknown Contact'}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {RELATIONSHIP_TYPES.find(t => t.value === assoc.relationship_type)?.label || assoc.relationship_type}
                  </Badge>
                  {(assoc.job_title?.name || assoc.custom_title) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {assoc.job_title?.name || assoc.custom_title}
                    </span>
                  )}
                </div>
                {assoc.contact?.email && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {assoc.contact.email}
                  </p>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
