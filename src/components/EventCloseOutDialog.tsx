import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle2 } from 'lucide-react';
import { useUpdateEvent } from '@/hooks/useEvents';
import { useCreateFeedback, useEventFeedback } from '@/hooks/useStaffFeedback';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface StaffMember {
  userId: string;
  name: string;
}

interface EventCloseOutDialogProps {
  eventId: string;
  eventName: string;
  assignedStaff: StaffMember[];
  trigger?: React.ReactNode;
}

export function EventCloseOutDialog({ eventId, eventName, assignedStaff, trigger }: EventCloseOutDialogProps) {
  const { user } = useAuth();
  const updateEvent = useUpdateEvent();
  const createFeedback = useCreateFeedback();
  const { data: existingFeedback } = useEventFeedback(eventId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState<Record<string, { rating: number; notes: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alreadyRated = existingFeedback?.map((f) => f.user_id) || [];
  const staffToRate = assignedStaff.filter((s) => !alreadyRated.includes(s.userId));

  const handleRatingChange = (userId: string, rating: number) => {
    setStaffFeedback((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], rating, notes: prev[userId]?.notes || '' },
    }));
  };

  const handleNotesChange = (userId: string, notes: string) => {
    setStaffFeedback((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], notes, rating: prev[userId]?.rating || 0 },
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // Update event status
      await updateEvent.mutateAsync({
        id: eventId,
        ops_status: 'completed',
      });

      // Submit feedback for each staff member
      for (const [userId, feedback] of Object.entries(staffFeedback)) {
        if (feedback.rating > 0) {
          await createFeedback.mutateAsync({
            event_id: eventId,
            user_id: userId,
            rating: feedback.rating,
            notes: feedback.notes || null,
            created_by: user.id,
          });
        }
      }

      setDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Close Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close Event: {eventName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
            <Checkbox
              id="delivery-confirmed"
              checked={deliveryConfirmed}
              onCheckedChange={(checked) => setDeliveryConfirmed(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="delivery-confirmed" className="font-medium cursor-pointer">
                Confirm delivery completed
              </Label>
              <p className="text-sm text-muted-foreground">
                Check this box to confirm that all deliverables have been sent to the client.
              </p>
            </div>
          </div>

          {staffToRate.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Staff Feedback (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Rate each staff member's performance on this event.
                </p>
              </div>

              {staffToRate.map((staff) => (
                <div key={staff.userId} className="border rounded-lg p-4 space-y-3">
                  <div className="font-medium">{staff.name}</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingChange(staff.userId, star)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            'h-6 w-6 transition-colors',
                            star <= (staffFeedback[staff.userId]?.rating || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground/30 hover:text-yellow-400/50'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  {staffFeedback[staff.userId]?.rating > 0 && (
                    <Textarea
                      placeholder="Add notes (optional)..."
                      value={staffFeedback[staff.userId]?.notes || ''}
                      onChange={(e) => handleNotesChange(staff.userId, e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {alreadyRated.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {alreadyRated.length} staff member(s) have already been rated.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Closing...' : 'Close Event'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
