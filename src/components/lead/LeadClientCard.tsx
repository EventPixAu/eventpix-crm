/**
 * LEAD CLIENT CARD
 * 
 * Studio Ninja-style client card showing:
 * - Primary contact name and role
 * - Email
 * - Edit Client and Send Email buttons
 */
import { Link } from 'react-router-dom';
import { Users, Pencil, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface LeadClientCardProps {
  client?: {
    id: string;
    business_name: string;
    primary_contact_name?: string | null;
    primary_contact_email?: string | null;
    primary_contact_phone?: string | null;
  } | null;
  onSendEmail?: () => void;
}

export function LeadClientCard({ client, onSendEmail }: LeadClientCardProps) {
  if (!client) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Client</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No client assigned
          </p>
        </CardContent>
      </Card>
    );
  }

  const initials = client.primary_contact_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || client.business_name.slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Client</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact info with avatar */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-muted text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="font-semibold">
              {client.primary_contact_name || client.business_name}
            </div>
            <div className="text-sm text-muted-foreground">
              (Primary)
            </div>
            {client.primary_contact_email && (
              <a 
                href={`mailto:${client.primary_contact_email}`}
                className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
              >
                {client.primary_contact_email}
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">
                  ✓
                </span>
              </a>
            )}
          </div>
          
          {/* Avatar/icon placeholder */}
          <div className="shrink-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/sales/clients/${client.id}`}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit Client
            </Link>
          </Button>
          
          <Button variant="outline" size="sm" onClick={onSendEmail}>
            <Send className="h-4 w-4 mr-1.5" />
            Send Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
