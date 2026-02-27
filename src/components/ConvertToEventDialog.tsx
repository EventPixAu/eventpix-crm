/**
 * CONVERT TO EVENT DIALOG
 * 
 * Compact confirmation dialog that converts a lead to an event.
 * All data is carried over from the lead automatically.
 */
import { CalendarIcon, Building2, MapPin, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConvertToEvent, ConvertToEventInput } from '@/hooks/useConvertToEvent';

interface Lead {
  id: string;
  lead_name: string;
  client_id: string | null;
  estimated_event_date: string | null;
  requirements_summary?: string | null;
  venue_text?: string | null;
  client?: {
    id: string;
    business_name: string;
  } | null;
}

interface ConvertToEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function ConvertToEventDialog({ open, onOpenChange, lead }: ConvertToEventDialogProps) {
  const { mutate: convertToEvent, isPending } = useConvertToEvent();

  const handleConvert = () => {
    if (!lead) return;

    const params: ConvertToEventInput = {
      enquiry_id: lead.id,
      client_id: lead.client_id,
      event_overrides: {
        event_name: lead.lead_name,
        event_date: lead.estimated_event_date || null,
        special_instructions: lead.requirements_summary || null,
        date_status: lead.estimated_event_date ? 'confirmed' : 'tbc',
      },
      venue: lead.venue_text
        ? { create: { name: lead.venue_text, address_line_1: lead.venue_text } }
        : undefined,
      options: {
        create_admin_setup_tasks: true,
        create_worksheets: true,
        copy_enquiry_contacts: true,
      },
    };

    convertToEvent(params, {
      onSuccess: () => onOpenChange(false),
    });
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Convert to Event
          </DialogTitle>
          <DialogDescription>
            This will create a new event and transfer all sales data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Summary of what will be created */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2.5">
            <div className="font-medium text-sm">{lead.lead_name}</div>

            {lead.client && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.client.business_name}
              </div>
            )}

            {lead.estimated_event_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {format(new Date(lead.estimated_event_date), 'EEE, d MMM yyyy')}
              </div>
            )}

            {lead.venue_text && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.venue_text}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Quotes, contracts, contacts, sessions, and emails will be linked to the new event. The operations workflow will be initialized automatically.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isPending}>
            {isPending ? 'Converting…' : 'Convert to Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
