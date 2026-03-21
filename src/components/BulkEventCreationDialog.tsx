/**
 * BULK EVENT CREATION DIALOG
 * 
 * Create multiple events at once for an event series.
 * Uses ContactSelector for onsite contact selection.
 */
import { useState, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Rocket,
  MapPin,
  Calendar,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useBulkCreateEvents, EventSeries } from '@/hooks/useEventSeries';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';

interface BulkEventRow {
  id: string;
  event_date: string;
  city: string;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  onsite_contact_id: string | null;
  onsite_contact_name: string;
  onsite_contact_phone: string;
  notes: string;
  isExpanded: boolean;
}

interface BulkEventCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: EventSeries;
}

function createEmptyRow(defaults?: Partial<BulkEventRow>): BulkEventRow {
  return {
    id: crypto.randomUUID(),
    event_date: '',
    city: '',
    venue_name: '',
    venue_address: '',
    start_time: '18:00',
    end_time: '22:00',
    onsite_contact_id: null,
    onsite_contact_name: '',
    onsite_contact_phone: '',
    notes: '',
    isExpanded: false,
    ...defaults,
  };
}

export function BulkEventCreationDialog({
  open,
  onOpenChange,
  series,
}: BulkEventCreationDialogProps) {
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const bulkCreate = useBulkCreateEvents();
  
  // State
  // Series default times
  const seriesStartTime = (series as any).default_start_time || '18:00';
  const seriesEndTime = (series as any).default_end_time || '22:00';
  
  const [rows, setRows] = useState<BulkEventRow[]>([createEmptyRow({ start_time: seriesStartTime, end_time: seriesEndTime })]);
  const [clientName, setClientName] = useState('');
  const [defaultContactId, setDefaultContactId] = useState<string | null>(null);
  const [defaultContactInfo, setDefaultContactInfo] = useState<{ name: string; phone: string }>({ name: '', phone: '' });
  const [useDefaultContact, setUseDefaultContact] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setRows([createEmptyRow({ start_time: seriesStartTime, end_time: seriesEndTime })]);
      setClientName(series.name);
      setDefaultContactId(null);
      setDefaultContactInfo({ name: '', phone: '' });
      setUseDefaultContact(true);
    }
  }, [open, series.name, seriesStartTime, seriesEndTime]);
  
  const validRows = rows.filter(r => r.event_date && (r.city || r.venue_name));
  
  // Handle default contact selection
  const handleDefaultContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setDefaultContactId(contactId);
    if (contact) {
      const phone = contact.phone_mobile || contact.phone_office || contact.phone || '';
      setDefaultContactInfo({
        name: contact.contact_name || '',
        phone: phone,
      });
    } else {
      setDefaultContactInfo({ name: '', phone: '' });
    }
  };

  // Handle row contact selection
  const handleRowContactChange = (rowId: string, contactId: string | null, contact?: CrmContact | null) => {
    setRows(rows.map(r => {
      if (r.id !== rowId) return r;
      const phone = contact?.phone_mobile || contact?.phone_office || contact?.phone || '';
      return {
        ...r,
        onsite_contact_id: contactId,
        onsite_contact_name: contact?.contact_name || '',
        onsite_contact_phone: phone,
      };
    }));
  };
  
  const handleAddRow = () => {
    setRows([...rows, createEmptyRow({
      start_time: rows[rows.length - 1]?.start_time || seriesStartTime,
      end_time: rows[rows.length - 1]?.end_time || seriesEndTime,
      onsite_contact_id: useDefaultContact ? defaultContactId : null,
      onsite_contact_name: useDefaultContact ? defaultContactInfo.name : '',
      onsite_contact_phone: useDefaultContact ? defaultContactInfo.phone : '',
    })]);
  };
  
  const handleDuplicateRow = (rowId: string) => {
    const sourceRow = rows.find(r => r.id === rowId);
    if (!sourceRow) return;
    
    const newRow = {
      ...sourceRow,
      id: crypto.randomUUID(),
      event_date: '', // Clear date for duplicate
    };
    
    const index = rows.findIndex(r => r.id === rowId);
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    setRows(newRows);
  };
  
  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== rowId));
  };
  
  const handleUpdateRow = (rowId: string, field: keyof BulkEventRow, value: string | boolean) => {
    setRows(rows.map(r => 
      r.id === rowId ? { ...r, [field]: value } : r
    ));
  };
  
  const handleToggleExpand = (rowId: string) => {
    setRows(rows.map(r => 
      r.id === rowId ? { ...r, isExpanded: !r.isExpanded } : r
    ));
  };
  
  const handleBulkCreate = async () => {
    if (validRows.length === 0) return;
    
    const events = validRows.map(row => {
      const venueName = row.city || row.venue_name;
      // Use row-specific contact, or fall back to default if enabled
      const contactName = row.onsite_contact_name || (useDefaultContact ? defaultContactInfo.name : '');
      const contactPhone = row.onsite_contact_phone || (useDefaultContact ? defaultContactInfo.phone : '');
      
      return {
        event_name: `${series.name} - ${venueName}`,
        client_name: clientName || series.name,
        event_date: row.event_date,
        start_time: row.start_time || undefined,
        end_time: row.end_time || undefined,
        venue_name: row.venue_name || row.city,
        venue_address: row.venue_address || undefined,
        onsite_contact_name: contactName || undefined,
        onsite_contact_phone: contactPhone || undefined,
        event_type_id: series.event_type_id || undefined,
        event_series_id: series.id,
        coverage_details: series.default_coverage_details || undefined,
        delivery_method_id: series.default_delivery_method_id || undefined,
        delivery_method_guests_id: (series as any).default_delivery_method_guests_id || undefined,
        ops_status: (series as any).default_ops_status || 'confirmed',
        delivery_deadline: row.event_date 
          ? format(addDays(parseISO(row.event_date), series.default_delivery_deadline_days || 5), 'yyyy-MM-dd')
          : undefined,
        notes: row.notes || undefined,
      };
    });
    
    await bulkCreate.mutateAsync(events);
    onOpenChange(false);
  };
  
  // Group rows by city for preview
  const citiesPreview = validRows.reduce((acc, row) => {
    const city = row.city || row.venue_name || 'Unknown';
    if (!acc[city]) acc[city] = [];
    acc[city].push(row);
    return acc;
  }, {} as Record<string, BulkEventRow[]>);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Bulk Create Events
          </DialogTitle>
          <DialogDescription>
            Add multiple events across different cities and dates for <strong>{series.name}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Global Settings */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Default Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client name for all events"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Default Contact</Label>
                  <ContactSelector
                    value={defaultContactId}
                    onChange={handleDefaultContactChange}
                    placeholder="Search for a contact..."
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="useDefaultContact"
                  checked={useDefaultContact}
                  onCheckedChange={(checked) => setUseDefaultContact(!!checked)}
                />
                <Label htmlFor="useDefaultContact" className="text-sm text-muted-foreground cursor-pointer">
                  Apply default contact to all events without custom contact
                </Label>
              </div>
            </div>
            
            {/* Event Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Events ({rows.length})
                </h3>
                <Button size="sm" onClick={handleAddRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Event
                </Button>
              </div>
              
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div 
                    key={row.id} 
                    className="border border-border rounded-lg bg-card overflow-hidden"
                  >
                    {/* Main Row */}
                    <div className="p-3 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 text-center">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{index + 1}
                        </span>
                      </div>
                      
                      <div className="col-span-2">
                        <Input
                          type="date"
                          value={row.event_date}
                          onChange={(e) => handleUpdateRow(row.id, 'event_date', e.target.value)}
                          className={!row.event_date ? 'border-destructive/50' : ''}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Input
                          value={row.city}
                          onChange={(e) => handleUpdateRow(row.id, 'city', e.target.value)}
                          placeholder="City"
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <Input
                          value={row.venue_name}
                          onChange={(e) => handleUpdateRow(row.id, 'venue_name', e.target.value)}
                          placeholder="Venue name"
                          className={!row.city && !row.venue_name ? 'border-destructive/50' : ''}
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <Input
                          type="time"
                          value={row.start_time}
                          onChange={(e) => handleUpdateRow(row.id, 'start_time', e.target.value)}
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <Input
                          type="time"
                          value={row.end_time}
                          onChange={(e) => handleUpdateRow(row.id, 'end_time', e.target.value)}
                        />
                      </div>
                      
                      <div className="col-span-2 flex justify-end gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleToggleExpand(row.id)}
                          title="More options"
                        >
                          {row.isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleDuplicateRow(row.id)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={rows.length === 1}
                          className="text-destructive hover:text-destructive"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {row.isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-border bg-muted/20">
                        <div className="grid grid-cols-12 gap-2 pt-3">
                          <div className="col-span-1" />
                          <div className="col-span-4">
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Venue Address
                            </Label>
                            <Input
                              value={row.venue_address}
                              onChange={(e) => handleUpdateRow(row.id, 'venue_address', e.target.value)}
                              placeholder="Full address"
                            />
                          </div>
                          <div className="col-span-4">
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Onsite Contact
                            </Label>
                            <ContactSelector
                              value={row.onsite_contact_id}
                              onChange={(contactId, contact) => handleRowContactChange(row.id, contactId, contact)}
                              placeholder={useDefaultContact && defaultContactInfo.name ? defaultContactInfo.name : 'Search contact...'}
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Notes
                            </Label>
                            <Input
                              value={row.notes}
                              onChange={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                              placeholder="Event-specific notes"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            {/* Preview Summary */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Rocket className="h-4 w-4" />
                Preview
              </h3>
              
              {validRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Add at least one event with a date and city/venue
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(citiesPreview).map(([city, cityRows]) => (
                      <Badge key={city} variant="secondary" className="text-sm">
                        <MapPin className="h-3 w-3 mr-1" />
                        {city}: {cityRows.length} event{cityRows.length !== 1 ? 's' : ''}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <strong>{validRows.length}</strong> event{validRows.length !== 1 ? 's' : ''} will be created with:
                    </p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Event type: {eventTypes.find(t => t.id === series.event_type_id)?.name || 'Not set'}</li>
                      <li>Delivery method: {deliveryMethods.find(m => m.id === series.default_delivery_method_id)?.name || 'Not set'}</li>
                      <li>Delivery deadline: {series.default_delivery_deadline_days || 5} days after event</li>
                      {series.default_coverage_details && (
                        <li>Coverage: {series.default_coverage_details}</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleBulkCreate}
            disabled={validRows.length === 0 || bulkCreate.isPending}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {bulkCreate.isPending ? 'Creating...' : `Create ${validRows.length} Event${validRows.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
