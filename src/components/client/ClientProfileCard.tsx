/**
 * CLIENT PROFILE CARD
 * 
 * Company profile card with:
 * - Company Name, Phone, Email, Address, Category
 * - Editable Company Status
 * - Edit/Delete buttons
 */
import { Building2, Pencil, Trash2, Phone, Mail, MapPin, Tag, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClientStatusEditor } from './ClientStatusEditor';
import { SendPortalLinkButton } from './SendPortalLinkButton';

interface ClientProfileCardProps {
  client: {
    id: string;
    business_name: string;
    company_phone?: string | null;
    company_email?: string | null;
    primary_contact_name?: string | null;
    primary_contact_email?: string | null;
    primary_contact_phone?: string | null;
    billing_address?: string | null;
    category_id?: string | null;
    category?: { id: string; name: string } | null;
    lead_source?: string | null;
    manual_status?: string | null;
    status_override_at?: string | null;
    status_override_reason?: string | null;
    tags?: string[] | null;
  };
  computedStatus?: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusUpdate?: () => void;
  canDelete?: boolean;
}

// Parse billing_address into structured fields
function parseAddress(address: string | null | undefined) {
  if (!address) {
    return {
      street: null,
      suburb: null,
      postcode: null,
      state: null,
      country: null,
    };
  }
  
  const parts = address.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
  
  return {
    street: parts[0] || null,
    suburb: parts[1] || null,
    postcode: parts[2] || null,
    state: parts[3] || null,
    country: parts[4] || null,
  };
}

export function ClientProfileCard({ 
  client, 
  computedStatus = 'prospect',
  onEdit, 
  onDelete,
  onStatusUpdate,
  canDelete = true 
}: ClientProfileCardProps) {
  const addressFields = parseAddress(client.billing_address);
  const hasAddress = Object.values(addressFields).some(v => v);
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl truncate">{client.business_name}</CardTitle>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {client.category?.name && (
                <Badge variant="secondary">
                  <Tag className="h-3 w-3 mr-1" />
                  {client.category.name}
                </Badge>
              )}
              {client.lead_source && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Database className="h-3 w-3 mr-1" />
                  {client.lead_source}
                </Badge>
              )}
              {client.tags && client.tags.length > 0 && client.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Status Section */}
      <div className="px-6 pb-4">
        <div className="text-sm text-muted-foreground mb-1.5">Status</div>
        <ClientStatusEditor
          clientId={client.id}
          manualStatus={client.manual_status || null}
          computedStatus={computedStatus}
          statusOverrideAt={client.status_override_at}
          statusOverrideReason={client.status_override_reason}
          onUpdate={onStatusUpdate}
        />
      </div>
      
      <CardContent className="space-y-4">
        {/* Company Contact Details */}
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="text-muted-foreground text-xs mb-0.5">Company Phone</div>
              <span>{client.company_phone || client.primary_contact_phone || '-'}</span>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="text-muted-foreground text-xs mb-0.5">Company Email</div>
              {(client.company_email || client.primary_contact_email) ? (
                <a 
                  href={`mailto:${client.company_email || client.primary_contact_email}`}
                  className="text-primary hover:underline break-all"
                >
                  {client.company_email || client.primary_contact_email}
                </a>
              ) : '-'}
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="text-muted-foreground text-xs mb-0.5">Address</div>
              {hasAddress ? (
                <div className="space-y-0.5">
                  {addressFields.street && <div>{addressFields.street}</div>}
                  {(addressFields.suburb || addressFields.state || addressFields.postcode) && (
                    <div>
                      {[addressFields.suburb, addressFields.state, addressFields.postcode]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                  {addressFields.country && <div>{addressFields.country}</div>}
                </div>
              ) : '-'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          
          {canDelete && (
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
