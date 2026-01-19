/**
 * QUOTE CONTEXT PANEL
 * 
 * Right sidebar panel showing Lead/Job and Client summary.
 * Studio Ninja style - displays context info for the quote.
 */
import { format } from 'date-fns';
import { Building2, Calendar, MapPin, User, Mail, Phone, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface QuoteContextPanelProps {
  quote: {
    quote_number?: string | null;
    created_at?: string | null;
    valid_until?: string | null;
    status: string;
    accepted_at?: string | null;
    accepted_by_name?: string | null;
    lead?: {
      id: string;
      lead_name: string;
      main_shoot_start_at?: string | null;
      main_shoot_end_at?: string | null;
      event_type?: { name: string } | null;
      venue_name?: string | null;
      venue_address?: string | null;
      client?: {
        id: string;
        business_name: string;
        primary_contact_name?: string | null;
        primary_contact_email?: string | null;
        primary_contact_phone?: string | null;
      } | null;
    } | null;
    client?: {
      id: string;
      business_name: string;
      primary_contact_name?: string | null;
      primary_contact_email?: string | null;
      primary_contact_phone?: string | null;
    } | null;
  };
  subtotal: number;
  taxTotal: number;
  total: number;
}

export function QuoteContextPanel({ quote, subtotal, taxTotal, total }: QuoteContextPanelProps) {
  const lead = quote.lead as any;
  const client = quote.client || lead?.client;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Lead/Job Summary */}
      {lead && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lead Details</CardTitle>
              <Link to={`/sales/leads/${lead.id}`}>
                <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                  <ExternalLink className="h-3 w-3" />
                  View Lead
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium">{lead.lead_name}</div>
                {lead.event_type?.name && (
                  <div className="text-sm text-muted-foreground">{lead.event_type.name}</div>
                )}
              </div>
            </div>
            
            {(lead.main_shoot_start_at || lead.main_shoot_end_at) && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-sm">
                    {lead.main_shoot_start_at && format(new Date(lead.main_shoot_start_at), 'PPP')}
                  </div>
                  {lead.main_shoot_start_at && lead.main_shoot_end_at && (
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(lead.main_shoot_start_at), 'p')} - {format(new Date(lead.main_shoot_end_at), 'p')}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {(lead.venue_name || lead.venue_address) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  {lead.venue_name && <div className="text-sm">{lead.venue_name}</div>}
                  {lead.venue_address && (
                    <div className="text-sm text-muted-foreground">{lead.venue_address}</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Summary */}
      {client && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Client</CardTitle>
              <Link to={`/sales/clients/${client.id}`}>
                <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                  <ExternalLink className="h-3 w-3" />
                  View Client
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="font-medium">{client.business_name}</div>
            </div>
            
            {client.primary_contact_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.primary_contact_name}</span>
              </div>
            )}
            
            {client.primary_contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={`mailto:${client.primary_contact_email}`}
                  className="text-sm text-primary hover:underline"
                >
                  {client.primary_contact_email}
                </a>
              </div>
            )}
            
            {client.primary_contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={`tel:${client.primary_contact_phone}`}
                  className="text-sm hover:underline"
                >
                  {client.primary_contact_phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quote Totals */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm opacity-80">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm opacity-80">
              <span>GST</span>
              <span>{formatCurrency(taxTotal)}</span>
            </div>
            <Separator className="bg-primary-foreground/20" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Status Info */}
      {quote.accepted_at && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="text-center text-green-800">
              <div className="font-medium">Quote Accepted</div>
              <div className="text-sm">
                {format(new Date(quote.accepted_at), 'PPP')}
              </div>
              {quote.accepted_by_name && (
                <div className="text-sm text-green-600">
                  by {quote.accepted_by_name}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
