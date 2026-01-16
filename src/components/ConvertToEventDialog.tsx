import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Clock, Package, FileText, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useConvertToEvent, ConvertToEventInput } from '@/hooks/useConvertToEvent';
import { useActiveVenues } from '@/hooks/useVenues';
import { useActiveCoveragePackages } from '@/hooks/useCoveragePackages';

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
  const { data: venues = [] } = useActiveVenues();
  const { data: coveragePackages = [] } = useActiveCoveragePackages();

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [dateStatus, setDateStatus] = useState<'confirmed' | 'tbc' | 'tentative'>('confirmed');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [venueOption, setVenueOption] = useState<'existing' | 'new' | 'tbc'>('tbc');
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [deliveryDeadline, setDeliveryDeadline] = useState<Date | undefined>();
  const [coveragePackageId, setCoveragePackageId] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      setEventName(lead.lead_name);
      setEventDate(lead.estimated_event_date ? new Date(lead.estimated_event_date) : undefined);
      setDateStatus(lead.estimated_event_date ? 'confirmed' : 'tbc');
      setSpecialInstructions(lead.requirements_summary || '');
      if (lead.venue_text) {
        setVenueOption('new');
        setNewVenueName(lead.venue_text);
      }
      // Set default delivery deadline to 5 days after event
      if (lead.estimated_event_date) {
        const deadline = new Date(lead.estimated_event_date);
        deadline.setDate(deadline.getDate() + 5);
        setDeliveryDeadline(deadline);
      }
    }
  }, [lead]);

  const handleSubmit = () => {
    if (!lead) return;

    const params: ConvertToEventInput = {
      enquiry_id: lead.id,
      client_id: lead.client_id,
      event_overrides: {
        event_name: eventName,
        event_date: eventDate ? format(eventDate, 'yyyy-MM-dd') : null,
        start_time: startTime || null,
        end_time: endTime || null,
        coverage_package_id: coveragePackageId || null,
        delivery_deadline_at: deliveryDeadline ? format(deliveryDeadline, 'yyyy-MM-dd') : null,
        special_instructions: specialInstructions || null,
        date_status: dateStatus,
      },
      venue: venueOption === 'existing' && selectedVenueId
        ? { venue_id: selectedVenueId }
        : venueOption === 'new' && newVenueName
          ? { create: { name: newVenueName, address_line_1: newVenueAddress || null } }
          : undefined,
      options: {
        create_admin_setup_tasks: true,
        create_worksheets: true,
        copy_enquiry_contacts: true,
      },
    };

    convertToEvent(params, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Convert to Event
          </DialogTitle>
          <DialogDescription>
            Create an event from enquiry "{lead.lead_name}". This will also create setup tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Info */}
          {lead.client && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Client: <strong>{lead.client.business_name}</strong>
              </span>
            </div>
          )}

          {/* Event Name */}
          <div className="space-y-2">
            <Label htmlFor="eventName">Event Name</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Enter event name"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event Date</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 justify-start text-left font-normal',
                        !eventDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {eventDate ? format(eventDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventDate}
                      onSelect={(date) => {
                        setEventDate(date);
                        if (date) {
                          setDateStatus('confirmed');
                          // Update delivery deadline
                          const deadline = new Date(date);
                          deadline.setDate(deadline.getDate() + 5);
                          setDeliveryDeadline(deadline);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date Status</Label>
              <Select value={dateStatus} onValueChange={(v) => setDateStatus(v as typeof dateStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="tbc">TBC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Start Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Venue
            </Label>
            <Select value={venueOption} onValueChange={(v) => setVenueOption(v as typeof venueOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Select existing venue</SelectItem>
                <SelectItem value="new">Create new venue</SelectItem>
                <SelectItem value="tbc">TBC</SelectItem>
              </SelectContent>
            </Select>

            {venueOption === 'existing' && (
              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {venueOption === 'new' && (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <Input
                  placeholder="Venue name"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                />
                <Input
                  placeholder="Venue address"
                  value={newVenueAddress}
                  onChange={(e) => setNewVenueAddress(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Coverage Package */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Coverage Package
            </Label>
            <Select value={coveragePackageId || "none"} onValueChange={(v) => setCoveragePackageId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select package (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No package selected</SelectItem>
                {coveragePackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} {pkg.hours_included && `(${pkg.hours_included}h)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Deadline */}
          <div className="space-y-2">
            <Label>Delivery Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !deliveryDeadline && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deliveryDeadline ? format(deliveryDeadline, 'PPP') : 'Select deadline'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deliveryDeadline}
                  onSelect={setDeliveryDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Special Instructions */}
          <div className="space-y-2">
            <Label htmlFor="specialInstructions" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Special Instructions
            </Label>
            <Textarea
              id="specialInstructions"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special requirements or instructions..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !eventName}>
            {isPending ? 'Creating...' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
