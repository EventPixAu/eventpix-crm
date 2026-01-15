/**
 * DEPRECATED: Job Intake Detail
 * 
 * This page is deprecated. Use the unified Sales workflow instead:
 * - Leads (/sales/leads) for opportunities
 * - Quotes (/sales/quotes) for proposals
 * 
 * Kept for backward compatibility with legacy intake records.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, FileText, Calendar, Building2, Mail, ExternalLink, Trash2, ArrowRight, CheckCircle2, Clock, ArrowRightCircle, XCircle, Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useJobIntake, useUpdateJobIntake, useConvertJobToEvent, useMarkReadyForOps, HandoffStatus } from '@/hooks/useJobIntake';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';

export default function JobIntakeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: intake, isLoading } = useJobIntake(id);
  const { data: eventTypes } = useEventTypes();
  const { data: deliveryMethods } = useDeliveryMethods();
  const updateIntake = useUpdateJobIntake();
  const convertToEvent = useConvertJobToEvent();
  const markReadyForOps = useMarkReadyForOps();

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [eventData, setEventData] = useState({
    event_name: '',
    event_date: '',
    start_time: '',
    end_time: '',
    event_type_id: '',
    delivery_method_id: '',
    venue_name: '',
    venue_address: '',
    notes: '',
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!intake) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">Job not found</h2>
          <Button variant="outline" onClick={() => navigate('/job-intake')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleConvert = async () => {
    await convertToEvent.mutateAsync({
      intakeId: intake.id,
      eventData: {
        event_name: eventData.event_name || intake.job_name,
        client_name: intake.client_name,
        event_date: eventData.event_date || intake.proposed_event_date,
        start_time: eventData.start_time || null,
        end_time: eventData.end_time || null,
        event_type_id: eventData.event_type_id || null,
        delivery_method_id: eventData.delivery_method_id || null,
        venue_name: eventData.venue_name || null,
        venue_address: eventData.venue_address || null,
        notes: eventData.notes || intake.notes || null,
        ops_status: 'awaiting_details',
        invoice_status: 'not_invoiced',
      },
    });
    setConvertDialogOpen(false);
    navigate('/events');
  };

  const handleCancel = async () => {
    await updateIntake.mutateAsync({
      id: intake.id,
      status: 'cancelled',
      handoff_status: 'cancelled',
    });
  };

  const handleMarkReady = async () => {
    await markReadyForOps.mutateAsync(intake.id);
  };

  const getHandoffStatusBadge = (status: HandoffStatus) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', icon: Clock, className: 'bg-muted text-muted-foreground border-muted' };
      case 'ready_for_ops':
        return { label: 'Ready for Ops', icon: ArrowRightCircle, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/50' };
      case 'converted':
        return { label: 'Converted', icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/50' };
      case 'cancelled':
        return { label: 'Cancelled', icon: XCircle, className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/50' };
      default:
        return { label: status, icon: Clock, className: '' };
    }
  };

  const isConverted = intake.handoff_status === 'converted';
  const isCancelled = intake.handoff_status === 'cancelled';
  const isDraft = intake.handoff_status === 'draft';
  const isReadyForOps = intake.handoff_status === 'ready_for_ops';
  const canConvert = isReadyForOps || isDraft; // Allow conversion from draft for backward compatibility

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/job-intake')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{intake.job_name}</h1>
              {(() => {
                const badge = getHandoffStatusBadge(intake.handoff_status);
                const IconComponent = badge.icon;
                return (
                  <Badge variant="secondary" className={badge.className}>
                    <IconComponent className="h-3 w-3 mr-1" />
                    {badge.label}
                  </Badge>
                );
              })()}
              {isConverted && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Lock className="h-3 w-3 mr-1" />
                  Read-only
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{intake.client_name}</p>
          </div>
        </div>
        
        {!isConverted && !isCancelled && (
          <div className="flex gap-2">
            {/* Mark Ready for Ops button - only show for drafts */}
            {isDraft && (
              <Button 
                variant="outline" 
                onClick={handleMarkReady}
                disabled={markReadyForOps.isPending}
              >
                <ArrowRightCircle className="h-4 w-4 mr-2" />
                Mark Ready for Ops
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancel Job
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the job as cancelled. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Job</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-destructive">
                    Cancel Job
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canConvert}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Convert to Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Sales → Operations Handoff</DialogTitle>
                  <DialogDescription>
                    Create an event from this job. After conversion, the job intake record becomes read-only.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="event_name">Event Name</Label>
                    <Input
                      id="event_name"
                      value={eventData.event_name}
                      onChange={(e) => setEventData({ ...eventData, event_name: e.target.value })}
                      placeholder={intake.job_name}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="event_date">Event Date *</Label>
                      <Input
                        id="event_date"
                        type="date"
                        value={eventData.event_date}
                        onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
                        defaultValue={intake.proposed_event_date || ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event_type_id">Event Type</Label>
                      <Select
                        value={eventData.event_type_id}
                        onValueChange={(v) => setEventData({ ...eventData, event_type_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventTypes?.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_time">Start Time</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={eventData.start_time}
                        onChange={(e) => setEventData({ ...eventData, start_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_time">End Time</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={eventData.end_time}
                        onChange={(e) => setEventData({ ...eventData, end_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue_name">Venue Name</Label>
                    <Input
                      id="venue_name"
                      value={eventData.venue_name}
                      onChange={(e) => setEventData({ ...eventData, venue_name: e.target.value })}
                      placeholder="Venue name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue_address">Venue Address</Label>
                    <Input
                      id="venue_address"
                      value={eventData.venue_address}
                      onChange={(e) => setEventData({ ...eventData, venue_address: e.target.value })}
                      placeholder="Full address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_method_id">Delivery Method</Label>
                    <Select
                      value={eventData.delivery_method_id}
                      onValueChange={(v) => setEventData({ ...eventData, delivery_method_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryMethods?.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={eventData.notes}
                      onChange={(e) => setEventData({ ...eventData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConvert}
                    disabled={!eventData.event_date && !intake.proposed_event_date || convertToEvent.isPending}
                  >
                    Create Event
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{intake.client_name}</p>
              </div>
            </div>
            {intake.client_email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{intake.client_email}</p>
                </div>
              </div>
            )}
            {intake.proposed_event_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Proposed Date</p>
                  <p className="font-medium">
                    {format(new Date(intake.proposed_event_date), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            )}
            {intake.external_job_id && (
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">External Reference</p>
                  <Badge variant="outline">
                    {intake.source}: {intake.external_job_id}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {intake.notes ? (
              <p className="text-sm whitespace-pre-wrap">{intake.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes added</p>
            )}
          </CardContent>
        </Card>

        {isConverted && (
          <Card className="md:col-span-2 border-green-500/50 bg-green-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Converted to Event
                  </p>
                  {intake.converted_at && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(intake.converted_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={() => navigate('/events')}>
                  View Events
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isCancelled && (
          <Card className="md:col-span-2 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="font-medium text-destructive">This job has been cancelled</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
              <div>
                <p className="text-sm font-medium">Job Created</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(intake.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
            {intake.converted_at && (
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium">Converted to Event</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(intake.converted_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
