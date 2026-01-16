import { useState } from 'react';
import { 
  Settings2,
  Calendar,
  Truck,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import {
  useBulkSetEventType,
  useBulkSetDeliveryMethod,
  useBulkSetDeliveryDeadline,
  useBulkAddNote,
} from '@/hooks/useSeriesControlCentre';
import { useAuth } from '@/lib/auth';

type ActionType = 'event_type' | 'delivery_method' | 'delivery_deadline' | 'add_note';

interface SeriesBulkActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: ActionType;
  selectedEventIds: string[];
  onComplete?: () => void;
}

export function SeriesBulkActionsDialog({
  open,
  onOpenChange,
  actionType,
  selectedEventIds,
  onComplete,
}: SeriesBulkActionsDialogProps) {
  const { user } = useAuth();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();

  // State
  const [eventTypeId, setEventTypeId] = useState('');
  const [deliveryMethodId, setDeliveryMethodId] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('5');
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'internal' | 'public'>('internal');
  const [overwrite, setOverwrite] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [doubleConfirmed, setDoubleConfirmed] = useState(false);

  // Mutations
  const bulkSetEventType = useBulkSetEventType();
  const bulkSetDeliveryMethod = useBulkSetDeliveryMethod();
  const bulkSetDeliveryDeadline = useBulkSetDeliveryDeadline();
  const bulkAddNote = useBulkAddNote();

  const isLargeAction = selectedEventIds.length >= 10;
  const isProcessing = 
    bulkSetEventType.isPending || 
    bulkSetDeliveryMethod.isPending || 
    bulkSetDeliveryDeadline.isPending ||
    bulkAddNote.isPending;

  const canProceed = confirmed && (!isLargeAction || doubleConfirmed);

  const handleClose = () => {
    setEventTypeId('');
    setDeliveryMethodId('');
    setDeadlineDays('5');
    setNoteText('');
    setNoteType('internal');
    setOverwrite(false);
    setConfirmed(false);
    setDoubleConfirmed(false);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    try {
      switch (actionType) {
        case 'event_type':
          if (!eventTypeId) return;
          await bulkSetEventType.mutateAsync({
            eventIds: selectedEventIds,
            eventTypeId,
            overwrite,
          });
          break;

        case 'delivery_method':
          if (!deliveryMethodId) return;
          await bulkSetDeliveryMethod.mutateAsync({
            eventIds: selectedEventIds,
            deliveryMethodId,
            overwrite,
          });
          break;

        case 'delivery_deadline':
          await bulkSetDeliveryDeadline.mutateAsync({
            eventIds: selectedEventIds,
            daysAfterEvent: parseInt(deadlineDays) || 5,
          });
          break;

        case 'add_note':
          if (!noteText.trim() || !user) return;
          await bulkAddNote.mutateAsync({
            eventIds: selectedEventIds,
            noteText: noteText.trim(),
            noteType,
            userId: user.id,
          });
          break;
      }

      handleClose();
      onComplete?.();
    } catch (error) {
      // Error is handled by mutation
    }
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'event_type': return 'Set Event Type';
      case 'delivery_method': return 'Set Delivery Method';
      case 'delivery_deadline': return 'Set Delivery Deadline';
      case 'add_note': return 'Add Note';
      default: return 'Bulk Action';
    }
  };

  const getActionIcon = () => {
    switch (actionType) {
      case 'event_type': return Settings2;
      case 'delivery_method': return Truck;
      case 'delivery_deadline': return Calendar;
      case 'add_note': return FileText;
      default: return Settings2;
    }
  };

  const isFormValid = () => {
    switch (actionType) {
      case 'event_type': return !!eventTypeId;
      case 'delivery_method': return !!deliveryMethodId;
      case 'delivery_deadline': return !!deadlineDays && parseInt(deadlineDays) > 0;
      case 'add_note': return !!noteText.trim();
      default: return false;
    }
  };

  const ActionIcon = getActionIcon();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon className="h-5 w-5" />
            {getActionTitle()}
          </DialogTitle>
          <DialogDescription>
            Apply to {selectedEventIds.length} selected event{selectedEventIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action-specific form fields */}
          {actionType === 'event_type' && (
            <>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={eventTypeId} onValueChange={setEventTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={overwrite} onCheckedChange={setOverwrite} />
                <Label className="text-sm">Overwrite existing event types</Label>
              </div>
            </>
          )}

          {actionType === 'delivery_method' && (
            <>
              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <Select value={deliveryMethodId} onValueChange={setDeliveryMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryMethods.map(method => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={overwrite} onCheckedChange={setOverwrite} />
                <Label className="text-sm">Overwrite existing delivery methods</Label>
              </div>
            </>
          )}

          {actionType === 'delivery_deadline' && (
            <div className="space-y-2">
              <Label>Days after event</Label>
              <Input
                type="number"
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(e.target.value)}
                min="1"
                max="30"
              />
              <p className="text-xs text-muted-foreground">
                Delivery deadline will be set to this many days after each event date
              </p>
            </div>
          )}

          {actionType === 'add_note' && (
            <>
              <div className="space-y-2">
                <Label>Note Type</Label>
                <Select value={noteType} onValueChange={(v) => setNoteType(v as 'internal' | 'public')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal (Admin only)</SelectItem>
                    <SelectItem value="public">Public (Visible to photographers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note Content</Label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter note text..."
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Large action warning */}
          {isLargeAction && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Large Bulk Action</AlertTitle>
              <AlertDescription className="text-sm">
                This action affects {selectedEventIds.length} events.
                Please confirm twice before proceeding.
              </AlertDescription>
            </Alert>
          )}

          {/* Confirmation checkboxes */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-start gap-2">
              <Checkbox
                id="confirm-action"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(!!checked)}
              />
              <Label htmlFor="confirm-action" className="text-sm cursor-pointer">
                I have reviewed the settings and want to proceed
              </Label>
            </div>

            {isLargeAction && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="double-confirm"
                  checked={doubleConfirmed}
                  onCheckedChange={(checked) => setDoubleConfirmed(!!checked)}
                  disabled={!confirmed}
                />
                <Label htmlFor="double-confirm" className="text-sm cursor-pointer">
                  I confirm this large action affecting {selectedEventIds.length} events is intentional
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed || !isFormValid() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply to {selectedEventIds.length} Event{selectedEventIds.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
