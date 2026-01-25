import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, MessageSquarePlus } from 'lucide-react';
import { useCreateFeedback, useEventFeedback } from '@/hooks/useStaffFeedback';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface StaffFeedbackFormProps {
  eventId: string;
  userId: string;
  staffName: string;
}

export function StaffFeedbackForm({ eventId, userId, staffName }: StaffFeedbackFormProps) {
  const { user } = useAuth();
  const { data: existingFeedback } = useEventFeedback(eventId);
  const createFeedback = useCreateFeedback();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [notes, setNotes] = useState('');

  const existingForUser = existingFeedback?.find((f) => f.user_id === userId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating === 0) return;

    await createFeedback.mutateAsync({
      event_id: eventId,
      user_id: userId,
      rating,
      notes: notes || null,
      created_by: user.id,
    });

    setDialogOpen(false);
    setRating(0);
    setNotes('');
  };

  if (existingForUser) {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'h-3 w-3',
                star <= existingForUser.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
              )}
            />
          ))}
        </div>
        <span className="text-xs ml-1">Rated</span>
      </div>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2">
          <MessageSquarePlus className="h-3 w-3 mr-1" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate {staffName}'s Performance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground/30 hover:text-yellow-400/50'
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {rating === 1 && 'Poor - Significant issues'}
              {rating === 2 && 'Below expectations'}
              {rating === 3 && 'Meets expectations'}
              {rating === 4 && 'Above expectations'}
              {rating === 5 && 'Excellent - Outstanding performance'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this team member's performance..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This feedback is internal only and will not be visible to the team member.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={rating === 0 || createFeedback.isPending}>
              Submit Feedback
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
