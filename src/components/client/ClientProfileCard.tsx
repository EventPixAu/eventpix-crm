/**
 * CLIENT PROFILE CARD
 * 
 * Studio Ninja-style client profile with:
 * - Avatar and name
 * - Phone, Email, Address fields
 * - Edit Client, Delete Client buttons
 */
import { Users, Pencil, Trash2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ClientProfileCardProps {
  client: {
    id: string;
    business_name: string;
    primary_contact_name?: string | null;
    primary_contact_email?: string | null;
    primary_contact_phone?: string | null;
    billing_address?: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
  canDelete?: boolean;
}

// Parse billing_address into structured fields (Studio Ninja format)
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
  
  // Simple parsing - assumes comma-separated or line-separated
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
  const initials = client.primary_contact_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || client.business_name.slice(0, 2).toUpperCase();
  
  const addressFields = parseAddress(client.billing_address);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Avatar and Name */}
        <div className="flex items-start gap-3 mb-6">
          <div className="relative">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 p-1 bg-primary rounded-full">
              <Camera className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {client.primary_contact_name || client.business_name}
            </h2>
          </div>
        </div>

        {/* Contact Details - Studio Ninja style table layout */}
        <div className="space-y-3 text-sm">
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">Phone:</span>
            <span>{client.primary_contact_phone || '-'}</span>
          </div>
          
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">Email:</span>
            <span className="break-all">
              {client.primary_contact_email ? (
                <a 
                  href={`mailto:${client.primary_contact_email}`}
                  className="text-primary hover:underline"
                >
                  {client.primary_contact_email}
                </a>
              ) : '-'}
            </span>
          </div>
          
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">Street Address:</span>
            <span>{addressFields.street || '-'}</span>
          </div>
          
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">Suburb/Town:</span>
            <span>{addressFields.suburb || '-'}</span>
          </div>
          
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">Postcode/Zip:</span>
            <span>{addressFields.postcode || '-'}</span>
          </div>
          
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">State:</span>
            <span>{addressFields.state || '-'}</span>
          </div>
          
          <div className="flex">
            <span className="text-muted-foreground w-28 shrink-0">Country:</span>
            <span>{addressFields.country || '-'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit Client
          </Button>
          
          {canDelete && (
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Client
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
