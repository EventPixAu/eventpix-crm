import { useMemo } from 'react';
import { getPublicBaseUrl } from '@/lib/utils';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useEvent, useEventAssignments } from '@/hooks/useEvents';
import { useDeliveryRecord } from '@/hooks/useDeliveryRecords';
import { useEventWorksheets, useAllWorksheetItems } from '@/hooks/useWorksheets';
import { useEventWorkflowSteps } from '@/hooks/useEventWorkflowSteps';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEventTypes, useDeliveryMethods, useStaffRoles } from '@/hooks/useLookups';
import { useEventDocuments } from '@/hooks/useEventDocuments';

const phases = [
  { key: 'pre_event', label: 'Pre-Event' },
  { key: 'day_of', label: 'Day-Of' },
  { key: 'post_event', label: 'Post-Event' },
] as const;

export default function EventRunSheet() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  
  const { data: event, isLoading } = useEvent(id);
  const { data: assignments = [] } = useEventAssignments(id);
  const { data: allDocuments = [] } = useEventDocuments(id);
  // Crew should NOT see admin workflow worksheets; they have their own role-based checklist.
  // Disable worksheet queries for crew to avoid mixing old/general checklist items into their printout.
  const worksheetsEventId = isAdmin ? id : undefined;
  const { data: worksheets = [] } = useEventWorksheets(worksheetsEventId);
  const { data: deliveryRecord } = useDeliveryRecord(id);
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const { data: staffRoles = [] } = useStaffRoles();
  // For crew: get their assigned workflow steps instead of old crew checklists
  const { data: allWorkflowSteps = [] } = useEventWorkflowSteps(id);
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });
  const myWorkflowSteps = allWorkflowSteps.filter(s => s.assigned_to === currentUser);
  
  // Filter documents to only show crew-visible ones for non-admin users
  const crewDocuments = useMemo(() => {
    if (isAdmin) return allDocuments;
    return allDocuments.filter(doc => doc.is_visible_to_crew);
  }, [allDocuments, isAdmin]);
  const worksheetIds = useMemo(() => worksheets.map((w) => w.id), [worksheets]);
  const { data: worksheetItems = [] } = useAllWorksheetItems(worksheetIds);

  const handlePrint = () => {
    window.print();
  };

  // Helper functions
  const getEventTypeName = () => {
    if (!event) return '';
    if (event.event_type_id) {
      const et = eventTypes.find((t) => t.id === event.event_type_id);
      return et?.name || event.event_type;
    }
    return event.event_type?.replace('_', ' ') || '';
  };

  const getDeliveryMethodName = () => {
    if (!event?.delivery_method_id) return '';
    const dm = deliveryMethods.find((d) => d.id === event.delivery_method_id);
    return dm?.name || event.delivery_method?.replace('_', ' ') || '';
  };

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return '';
    const role = staffRoles.find((r) => r.id === roleId);
    return role?.name || '';
  };

  const getItemsForWorksheet = (worksheetId: string) => {
    return worksheetItems.filter((item) => item.worksheet_id === worksheetId);
  };

  const getWorksheetsForPhase = (phase: string) => {
    return worksheets.filter((w) => w.phase === phase);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Event not found</p>
        <Link to="/events">
          <Button variant="outline">Back to Events</Button>
        </Link>
      </div>
    );
  }

  const eventDate = parseISO(event.event_date);

  return (
    <>
      {/* Screen-only header */}
      <div className="print:hidden p-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            to={`/events/${id}/day-of`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Day-Of
          </Link>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Printable content */}
      <div className="max-w-3xl mx-auto p-8 print:p-0 print:max-w-none">
        <style>{`
          @media print {
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
              font-size: 12pt;
            }
            .print-section { 
              page-break-inside: avoid; 
              margin-bottom: 1rem;
            }
            h1 { font-size: 18pt; }
            h2 { font-size: 14pt; margin-top: 1rem; }
            h3 { font-size: 12pt; }
            .checklist-item {
              page-break-inside: avoid;
            }
          }
        `}</style>

        {/* Header */}
        <header className="mb-6 print-section border-b border-black pb-4">
          <h1 className="text-2xl font-bold mb-1">{event.event_name}</h1>
          <p className="text-lg">{event.client_name}</p>
          <p className="text-muted-foreground print:text-black capitalize">
            {getEventTypeName()}
          </p>
        </header>

        {/* Event Overview */}
        <section className="mb-6 print-section">
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Event Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground print:text-gray-600">Date</p>
              <p className="font-medium">{format(eventDate, 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground print:text-gray-600">Time</p>
              <p className="font-medium">
                {event.start_time
                  ? `${format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}${
                      event.end_time
                        ? ` – ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`
                        : ''
                    }`
                  : 'TBD'}
              </p>
            </div>
          </div>
        </section>

        {/* Venue Details */}
        <section className="mb-6 print-section">
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Venue</h2>
          {event.venue_name && <p className="font-medium">{event.venue_name}</p>}
          {event.venue_address && (
            <p className="text-muted-foreground print:text-gray-600">{event.venue_address}</p>
          )}
          {(event as any).venue_access_notes && (
            <div className="mt-2">
              <p className="text-sm font-medium">Access Notes</p>
              <p className="text-sm">{(event as any).venue_access_notes}</p>
            </div>
          )}
          {(event as any).venue_parking_notes && (
            <div className="mt-2">
              <p className="text-sm font-medium">Parking Notes</p>
              <p className="text-sm">{(event as any).venue_parking_notes}</p>
            </div>
          )}
          {event.notes && (
            <p className="text-sm mt-2 italic">{event.notes}</p>
          )}
        </section>

        {/* On-Site Contact */}
        {(event.onsite_contact_name || event.onsite_contact_phone) && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">On-Site Contact</h2>
            {event.onsite_contact_name && <p className="font-medium">{event.onsite_contact_name}</p>}
            {event.onsite_contact_phone && <p>{event.onsite_contact_phone}</p>}
          </section>
        )}

        {/* Coverage Details */}
        {event.coverage_details && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Coverage Details</h2>
            <p className="whitespace-pre-wrap">{event.coverage_details}</p>
          </section>
        )}

        {/* Team Brief */}
        {(event as any).brief_content && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Team Brief</h2>
            <div className="whitespace-pre-wrap text-sm">{(event as any).brief_content}</div>
          </section>
        )}

        {/* Photography Instructions */}
        {(event as any).photography_brief && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Photography Instructions</h2>
            <p className="whitespace-pre-wrap text-sm">{(event as any).photography_brief}</p>
          </section>
        )}

        {/* Dress Code */}
        {(event as any).dress_code && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Dress Code</h2>
            <p className="text-sm">{(event as any).dress_code}</p>
          </section>
        )}

        {/* Team Documents */}
        {crewDocuments.length > 0 && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Documents</h2>
            <ul className="space-y-1 text-sm">
              {crewDocuments.map((doc) => (
                <li key={doc.id} className="flex items-start gap-2 py-1">
                  <span className="text-muted-foreground print:text-gray-600">•</span>
                  <div>
                    <span className="font-medium">{doc.file_name}</span>
                    {doc.description && (
                      <span className="text-muted-foreground print:text-gray-600"> — {doc.description}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground print:text-gray-500 mt-2 italic">
              Download documents from the app before heading to the event.
            </p>
          </section>
        )}

        {/* Assignments */}
        <section className="mb-6 print-section">
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Assigned Staff</h2>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground">No staff assigned</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Name</th>
                  <th className="text-left py-2 font-medium">Role</th>
                  <th className="text-left py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-gray-200">
                    <td className="py-2">
                      {assignment.profile?.full_name || assignment.staff?.name || 'Unknown'}
                    </td>
                    <td className="py-2 capitalize">
                      {getRoleName(assignment.staff_role_id) ||
                        assignment.role_on_event ||
                        assignment.staff?.role ||
                        'Staff'}
                    </td>
                    <td className="py-2 text-muted-foreground print:text-gray-600">
                      {assignment.assignment_notes || '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Checklist */}
        <section className="mb-6 print-section">
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Checklist</h2>
          {!isAdmin ? (
            myWorkflowSteps.length > 0 ? (
              <div className="space-y-2">
                {myWorkflowSteps.map((step) => (
                  <div key={step.id} className="checklist-item flex items-start gap-2 py-1">
                    <span className={`inline-block w-4 h-4 border border-black mt-0.5 shrink-0 ${step.is_completed ? 'bg-black' : ''}`} />
                    <span className="text-sm">{step.step_label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No checklist steps assigned</p>
            )
          ) : worksheets.length === 0 ? (
            <p className="text-muted-foreground">No worksheets</p>
          ) : (
            <div className="space-y-4">
              {phases.map((phase) => {
                const phaseWorksheets = getWorksheetsForPhase(phase.key);
                if (phaseWorksheets.length === 0) return null;

                return (
                  <div key={phase.key}>
                    <h3 className="font-medium mb-2">{phase.label}</h3>
                    {phaseWorksheets.map((worksheet) => (
                      <div key={worksheet.id} className="mb-3">
                        <p className="text-sm text-muted-foreground print:text-gray-600 mb-1">
                          {worksheet.template_name}
                        </p>
                        <div className="space-y-1">
                          {getItemsForWorksheet(worksheet.id).map((item) => (
                            <div
                              key={item.id}
                              className="checklist-item flex items-start gap-2 py-1"
                            >
                              <span className="inline-block w-4 h-4 border border-black mt-0.5 shrink-0" />
                              <span className="text-sm">{item.item_text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Admin-only: Delivery Info */}
        {isAdmin && (
          <section className="mb-6 print-section">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Delivery (Admin Only)</h2>
            <div className="space-y-2 text-sm">
              {event.delivery_method_id && (
                <div>
                  <span className="text-muted-foreground print:text-gray-600">Method: </span>
                  <span className="capitalize">{getDeliveryMethodName()}</span>
                </div>
              )}
              {event.delivery_deadline && (
                <div>
                  <span className="text-muted-foreground print:text-gray-600">Deadline: </span>
                  <span>{format(parseISO(event.delivery_deadline), 'MMM d, yyyy')}</span>
                </div>
              )}
              {deliveryRecord?.delivery_link && (
                <div>
                  <span className="text-muted-foreground print:text-gray-600">Link: </span>
                  <span className="break-all">{deliveryRecord.delivery_link}</span>
                </div>
              )}
              {deliveryRecord?.qr_token && (
                <div>
                  <span className="text-muted-foreground print:text-gray-600">Gallery URL: </span>
                  <span className="break-all">
                    {getPublicBaseUrl()}/g/{deliveryRecord.qr_token}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground print:text-gray-500 border-t pt-4 mt-8">
          <p>Generated by Eventpix • {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
        </footer>
      </div>
    </>
  );
}
