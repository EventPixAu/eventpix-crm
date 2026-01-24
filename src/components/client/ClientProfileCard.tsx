/**
 * CLIENT PROFILE CARD
 * 
 * Company profile card with:
 * - Company Name, Phone, Email, Address, Category
 * - Edit/Delete buttons
 */
import { Building2, Pencil, Trash2, Phone, Mail, MapPin, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  };
  onEdit: () => void;
  onDelete: () => void;
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
  onEdit, 
  onDelete,
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
            {client.category?.name && (
              <Badge variant="secondary" className="mt-1.5">
                <Tag className="h-3 w-3 mr-1" />
                {client.category.name}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
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
