import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO, isToday, isBefore, addDays, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  HelpCircle,
  MapPin,
  MessageSquarePlus,
  Phone,
  Printer,
  Send,
  Trash2,
  WifiOff,
  ShieldAlert,
  Package,
  AlertTriangle,
  Car,
  DoorOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/lib/auth';
import { useEvent, useEventAssignments } from '@/hooks/useEvents';
import { useDeliveryRecord } from '@/hooks/useDeliveryRecords';
import { useEventWorksheets, useAllWorksheetItems, useUpdateWorksheetItem } from '@/hooks/useWorksheets';
import { useStaffRoles } from '@/hooks/useLookups';
import { useDayOfCache } from '@/hooks/useDayOfCache';
import { useEventNotes, useCreateEventNote, useDeleteEventNote } from '@/hooks/useEventNotes';
import { useEventAllocations } from '@/hooks/useEquipmentAllocations';
import { useEventDocuments, useGetDocumentUrl } from '@/hooks/useEventDocuments';
import { downloadICS } from '@/lib/icsGenerator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSameDayEvents } from '@/hooks/useStaffAvailability';
import { TodaysSchedule } from '@/components/TodaysSchedule';
import { JobSheetEquipmentSection } from '@/components/JobSheetEquipmentSection';
import { CrewChecklist } from '@/components/crew/CrewChecklist';
import { PhotographySection } from '@/components/crew/PhotographySection';
import { CrewEventContacts } from '@/components/crew/CrewEventContacts';
import { CrewTeamList } from '@/components/crew/CrewTeamList';
import { DeliveryInfo } from '@/components/crew/DeliveryInfo';
import { AllEventContacts } from '@/components/crew/AllEventContacts';
import { EventEquipmentByRole } from '@/components/crew/EventEquipmentByRole';
import { PhotographerChecklist } from '@/components/crew/PhotographerChecklist';

const phases = [
  { key: 'pre_event', label: 'Pre-Event' },
  { key: 'day_of', label: 'Day-Of' },
  { key: 'post_event', label: 'Post-Event' },
] as const;

function safeParseISO(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function safeFormatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const d = new Date(`2000-01-01T${time}`);
  if (Number.isNaN(d.getTime())) return time;
  return format(d, 'h:mm a');
}

export default function EventDayOf() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  // Data fetching
  const { data: event, isLoading: eventLoading, error: eventError } = useEvent(id);
  const { data: assignments = [], isLoading: assignmentsLoading } = useEventAssignments(id);
  const { data: worksheets = [] } = useEventWorksheets(id);
  const { data: deliveryRecord } = useDeliveryRecord(id);
  const { data: staffRoles = [] } = useStaffRoles();
  const { data: eventNotes = [] } = useEventNotes(id);
  const { data: allDocuments = [] } = useEventDocuments(id);
  const getDocumentUrl = useGetDocumentUrl();
  
  // Filter documents to only show crew-visible ones for non-admin users
  const crewDocuments = useMemo(() => {
    if (isAdmin) return allDocuments;
    return allDocuments.filter(doc => doc.is_visible_to_crew);
  }, [allDocuments, isAdmin]);
  
  // Fetch same-day events for multi-event routing display
  const { data: sameDayEvents = [] } = useSameDayEvents(user?.id, event?.event_date);
  
  // Equipment allocations for guardrail check
  const { data: equipmentAllocations = [] } = useEventAllocations(id);
  
  const worksheetIds = useMemo(() => worksheets.map((w) => w.id), [worksheets]);
  const { data: worksheetItems = [] } = useAllWorksheetItems(worksheetIds);
  
  // Equipment guardrail checks
  const hasRequiredKit = !!event?.recommended_kit_id;
  const hasAllocatedEquipment = equipmentAllocations.length > 0;
  const equipmentNotAllocated = hasRequiredKit && !hasAllocatedEquipment;
  
  // Check if any allocated equipment hasn't been picked up (for day-of warning)
  const unpickedEquipment = useMemo(() => {
    const eventDate = safeParseISO(event?.event_date);
    if (!eventDate || !isToday(eventDate)) return [];
    return equipmentAllocations.filter((a) => a.status === 'allocated');
  }, [equipmentAllocations, event?.event_date]);
  
  const updateItem = useUpdateWorksheetItem();
  const createNote = useCreateEventNote();
  const deleteNote = useDeleteEventNote();
  
  // Offline caching
  const { cachedData, isOffline, saveToCache, setOfflineMode } = useDayOfCache(id);
  
  // Collapsible state for checklist phases
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    day_of: true,
    pre_event: false,
    post_event: false,
  });
  
  // Quick note input state
  const [noteContent, setNoteContent] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Handle fetch errors (offline mode)
  useEffect(() => {
    if (eventError) {
      setOfflineMode(true);
    }
  }, [eventError, setOfflineMode]);

  // Save to cache when data loads
  useEffect(() => {
    if (event && !eventLoading && !assignmentsLoading) {
      saveToCache({
        event,
        assignments,
        worksheets,
        worksheetItems,
        deliveryRecord: deliveryRecord || null,
      });
      setOfflineMode(false);
    }
  }, [event, assignments, worksheets, worksheetItems, deliveryRecord, eventLoading, assignmentsLoading, saveToCache, setOfflineMode]);

  // Use cached data if offline
  const displayEvent = isOffline && cachedData ? cachedData.event : event;
  const displayAssignments = isOffline && cachedData ? cachedData.assignments : assignments;
  const displayWorksheets = isOffline && cachedData ? cachedData.worksheets : worksheets;
  const displayWorksheetItems = isOffline && cachedData ? cachedData.worksheetItems : worksheetItems;

  // Find current user's assignment
  const myAssignment = useMemo(() => {
    if (!user) return null;
    return displayAssignments.find((a) => a.user_id === user.id);
  }, [displayAssignments, user]);

  // Get my role name
  const myRoleName = useMemo(() => {
    if (!myAssignment) return null;
    if (myAssignment.staff_role_id) {
      const role = staffRoles.find((r) => r.id === myAssignment.staff_role_id);
      return role?.name || null;
    }
    return myAssignment.role_on_event || null;
  }, [myAssignment, staffRoles]);

  // Status badges
  const getStatusBadges = () => {
    if (!displayEvent) return [];
    const badges: { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }[] = [];
    
    const eventDate = safeParseISO(displayEvent.event_date);
    
    if (eventDate && isToday(eventDate)) {
      badges.push({ label: 'Today', variant: 'default' });
    }
    
    if (displayEvent.delivery_deadline) {
      const deadline = safeParseISO(displayEvent.delivery_deadline);
      if (deadline) {
        const inSevenDays = addDays(new Date(), 7);
        if (isBefore(deadline, inSevenDays) && !deliveryRecord?.delivered_at) {
          badges.push({ label: 'Delivery Due', variant: 'destructive' });
        }
      }
    }
    
    return badges;
  };

  // Quick actions
  const handleCall = () => {
    if (displayEvent?.onsite_contact_phone) {
      window.location.href = `tel:${displayEvent.onsite_contact_phone}`;
    }
  };

  const handleOpenMaps = () => {
    if (displayEvent?.venue_address) {
      const query = encodeURIComponent(displayEvent.venue_address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const handleCopyAddress = async () => {
    if (displayEvent?.venue_address) {
      try {
        await navigator.clipboard.writeText(displayEvent.venue_address);
        toast({ title: 'Address copied to clipboard' });
      } catch {
        toast({ title: 'Failed to copy address', variant: 'destructive' });
      }
    }
  };

  const handleAddToCalendar = () => {
    if (!displayEvent) return;
    downloadICS({
      title: displayEvent.event_name,
      description: displayEvent.coverage_details || '',
      location: displayEvent.venue_address || displayEvent.venue_name || '',
      startDate: displayEvent.event_date,
      startTime: displayEvent.start_time || undefined,
      endTime: displayEvent.end_time || undefined,
      eventId: displayEvent.id,
    });
    toast({ title: 'Calendar invite downloaded' });
  };

  // Checklist toggle
  const handleToggleItem = (itemId: string, isDone: boolean) => {
    if (isOffline) {
      toast({ title: 'Cannot update while offline', variant: 'destructive' });
      return;
    }
    updateItem.mutate({
      itemId,
      isDone: !isDone,
      doneBy: user?.id,
    });
  };

  // Quick note handlers
  const handleAddNote = () => {
    if (!noteContent.trim() || !id || !user) return;
    if (isOffline) {
      toast({ title: 'Cannot add note while offline', variant: 'destructive' });
      return;
    }
    createNote.mutate({
      eventId: id,
      content: noteContent.trim(),
      createdBy: user.id,
    }, {
      onSuccess: () => {
        setNoteContent('');
        setShowNoteInput(false);
      },
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!id) return;
    if (isOffline) {
      toast({ title: 'Cannot delete note while offline', variant: 'destructive' });
      return;
    }
    deleteNote.mutate({ noteId, eventId: id });
  };
  const getItemsForWorksheet = (worksheetId: string) => {
    return displayWorksheetItems.filter((item) => item.worksheet_id === worksheetId);
  };

  // Get worksheets for a phase
  const getWorksheetsForPhase = (phase: string) => {
    return displayWorksheets.filter((w) => w.phase === phase);
  };

  // Loading state
  if (eventLoading && !cachedData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state - show specific error message
  if (eventError && !cachedData) {
    console.error('EventDayOf error:', eventError);
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Unable to load event</p>
        <p className="text-xs text-muted-foreground/60 mb-4">{(eventError as Error)?.message}</p>
        <Link to="/">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // Not found
  if (!displayEvent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Event not found</p>
        <Link to="/">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const eventDate = safeParseISO(displayEvent.event_date);
  const statusBadges = getStatusBadges();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-amber-950 py-2 px-4 flex items-center justify-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" />
          Offline – showing last saved details
        </div>
      )}

      <div className={cn('max-w-lg mx-auto', isOffline && 'pt-10')}>
        {/* Equipment Guardrail Warnings */}
        {(equipmentNotAllocated || unpickedEquipment.length > 0) && (
          <div className="px-4 pt-4 space-y-3">
            {/* Kit required but no equipment allocated */}
            {equipmentNotAllocated && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Equipment Not Allocated</AlertTitle>
                <AlertDescription>
                  This event requires an equipment kit but no equipment has been allocated. 
                  Please contact your manager before starting.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Equipment allocated but not picked up (only shown on day of event) */}
            {unpickedEquipment.length > 0 && !equipmentNotAllocated && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <Package className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-600">Equipment Not Picked Up</AlertTitle>
                <AlertDescription>
                  {unpickedEquipment.length} item{unpickedEquipment.length > 1 && 's'} allocated but not yet marked as picked up. 
                  Please confirm equipment pickup before leaving for the event.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Link
                  to={`/events/${id}`}
                  className="p-1 -ml-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <span className="text-sm text-muted-foreground">
                  {isAdmin ? 'Day-Of View' : 'Job Sheet'}
                </span>
              </div>
              {!isAdmin && (
                <Link to="/knowledge-base">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Help
                  </Button>
                </Link>
              )}
            </div>
            <h1 className="text-xl font-display font-bold mb-1">{displayEvent.event_name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {eventDate ? format(eventDate, 'EEE, MMM d, yyyy') : 'Date TBD'}
            </div>
            {statusBadges.length > 0 && (
              <div className="flex gap-2 mt-2">
                {statusBadges.map((badge) => (
                  <Badge key={badge.label} variant={badge.variant}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Today's Schedule - shown when photographer has multiple events */}
        {sameDayEvents.length > 1 && (
          <section className="px-4 pt-4">
            <TodaysSchedule events={sameDayEvents} currentEventId={id} />
          </section>
        )}

        {/* Primary Actions */}
        <section className="p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              className="h-14"
              onClick={handleCall}
              disabled={!displayEvent.onsite_contact_phone}
            >
              <Phone className="h-5 w-5 mr-2" />
              Call Contact
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-14"
              onClick={handleOpenMaps}
              disabled={!displayEvent.venue_address}
            >
              <MapPin className="h-5 w-5 mr-2" />
              Open Maps
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={handleAddToCalendar}>
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add to Calendar
            </Button>
            <Button variant="outline" className="h-12" onClick={handleCopyAddress} disabled={!displayEvent.venue_address}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Address
            </Button>
          </div>
          <Link to={`/events/${id}/run-sheet`}>
            <Button variant="ghost" className="w-full h-10">
              <Printer className="h-4 w-4 mr-2" />
              Print Run Sheet
            </Button>
          </Link>
        </section>

        {/* Venue Card - Enhanced with access/parking notes */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold mb-1">Venue</h3>
              {displayEvent.venue_name && (
                <p className="font-medium">{displayEvent.venue_name}</p>
              )}
              {displayEvent.venue_address && (
                <p className="text-sm text-muted-foreground">{displayEvent.venue_address}</p>
              )}
              {(displayEvent as any).venue_access_notes && (
                <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-1">
                    <DoorOpen className="h-3 w-3" />
                    Access Notes
                  </div>
                  <p className="text-sm">{(displayEvent as any).venue_access_notes}</p>
                </div>
              )}
              {(displayEvent as any).venue_parking_notes && (
                <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-1">
                    <Car className="h-3 w-3" />
                    Parking Notes
                  </div>
                  <p className="text-sm">{(displayEvent as any).venue_parking_notes}</p>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* Dress Code Card */}
        {(displayEvent as any).dress_code && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="mx-4 mb-4 bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-lg shrink-0">
                <span className="text-lg">👔</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold mb-1">Dress Code</h3>
                <p className="text-sm">{(displayEvent as any).dress_code}</p>
              </div>
            </div>
          </motion.section>
        )}

        {/* All Event Contacts - replaces simple on-site contact */}
        {id && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mx-4 mb-4"
          >
            <AllEventContacts 
              eventId={id} 
              onsiteContact={{
                name: displayEvent.onsite_contact_name,
                phone: displayEvent.onsite_contact_phone,
              }}
            />
          </motion.section>
        )}

        {/* Coverage Card */}
        {(displayEvent.coverage_details || myAssignment) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-4 mb-4 bg-card border border-border rounded-xl p-4"
          >
            <h3 className="font-semibold mb-2">Coverage Details</h3>
            {displayEvent.coverage_details && (
              <p className="text-sm whitespace-pre-wrap mb-3">{displayEvent.coverage_details}</p>
            )}
            {myAssignment && (
              <div className="bg-primary/10 rounded-lg p-3 mt-2">
                <p className="text-sm font-medium">Your Role</p>
                <p className="text-sm text-muted-foreground">
                  {myRoleName || 'Staff'}
                  {myAssignment.assignment_notes && (
                    <span className="block mt-1">{myAssignment.assignment_notes}</span>
                  )}
                </p>
              </div>
            )}
          </motion.section>
        )}

        {/* Photography Section - Brief, Camera Settings, Delivery */}
        {((displayEvent as any).photography_brief || 
          (displayEvent as any).camera_settings || 
          displayEvent.delivery_method) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mx-4 mb-4"
          >
            <PhotographySection
              photographyBrief={(displayEvent as any).photography_brief}
              cameraSettings={(displayEvent as any).camera_settings}
              deliveryMethod={displayEvent.delivery_method}
              deliveryDeadline={displayEvent.delivery_deadline}
              dressCode={(displayEvent as any).dress_code}
            />
          </motion.section>
        )}

        {/* Assignments Snapshot */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-4 mb-4 bg-card border border-border rounded-xl p-4"
        >
          <h3 className="font-semibold mb-3">Team ({displayAssignments.length})</h3>
          {displayAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff assigned</p>
          ) : (
            <div className="space-y-2">
              {displayAssignments.map((assignment) => {
                const name = assignment.profile?.full_name || assignment.staff?.name || 'Unknown';
                const role = assignment.staff_role?.name || assignment.role_on_event || 'Staff';
                const isMe = assignment.user_id === user?.id;
                
                return (
                  <div
                    key={assignment.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg',
                      isMe && 'bg-primary/10'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium">{name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {name}
                        {isMe && <span className="text-primary ml-1">(You)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Quick Notes */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mx-4 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Notes</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="h-8"
            >
              <MessageSquarePlus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          
          {showNoteInput && (
            <div className="bg-card border border-border rounded-xl p-3 mb-3">
              <Textarea
                placeholder="Quick observation, issue, or note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[80px] resize-none mb-2"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNoteContent('');
                    setShowNoteInput(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteContent.trim() || createNote.isPending || isOffline}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {createNote.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
          
          {eventNotes.length === 0 && !showNoteInput ? (
            <p className="text-sm text-muted-foreground">No notes yet. Tap Add to capture observations.</p>
          ) : (
            <div className="space-y-2">
              {eventNotes.map((note) => {
                const authorName = note.profile?.full_name || note.profile?.email || 'Unknown';
                const isMyNote = note.created_by === user?.id;
                
                return (
                  <div
                    key={note.id}
                    className="bg-card border border-border rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                      {(isMyNote || isAdmin) && (
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                          disabled={deleteNote.isPending || isOffline}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{authorName}</span>
                      <span>•</span>
                      <span>
                        {(() => {
                          const d = note.created_at ? new Date(note.created_at) : null;
                          if (!d || Number.isNaN(d.getTime())) return '';
                          return formatDistanceToNow(d, { addSuffix: true });
                        })()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Documents Section - Files visible to crew */}
        {crewDocuments.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.19 }}
            className="mx-4 mb-4"
          >
            <h3 className="font-semibold mb-3">Documents</h3>
            <div className="space-y-2">
              {crewDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const url = await getDocumentUrl(doc.file_path);
                        window.open(url, '_blank');
                      } catch (error) {
                        toast({
                          title: 'Failed to open document',
                          variant: 'destructive',
                        });
                      }
                    }}
                    className="shrink-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Equipment Section - Split by Role */}
        {id && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-4 mb-4"
          >
            <EventEquipmentByRole eventId={id} />
          </motion.section>
        )}

        {/* Personal Equipment Checklist */}
        {id && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.21 }}
            className="mx-4 mb-4"
          >
            <JobSheetEquipmentSection eventId={id} />
          </motion.section>
        )}

        {/* Personal Crew Checklist - Role-specific tasks for this team member */}
        {id && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mx-4 mb-4"
          >
            <PhotographerChecklist 
              eventId={id} 
              staffRoleId={myAssignment?.staff_role_id || undefined} 
            />
          </motion.section>
        )}

        {/* Note: Admin workflow worksheets are NOT shown on the crew Day-Of view. 
            Crew members only see their personal role-based checklist above. */}
      </div>
    </div>
  );
}
