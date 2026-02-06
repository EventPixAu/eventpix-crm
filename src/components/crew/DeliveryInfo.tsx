/**
 * DeliveryInfo - Display delivery expectations for crew
 * 
 * Shows:
 * - Delivery method
 * - Deadline
 * - Upload instructions
 * 
 * Read-only for crew members.
 */

import { format, parseISO, isBefore, addDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Upload, Clock, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DeliveryInfoProps {
  deliveryMethod?: string | null;
  deliveryDeadline?: string | null;
  isDelivered?: boolean;
}

const MASV_UPLOAD_URL = 'https://www.eventpix.com.au/masv/';

const DELIVERY_INSTRUCTIONS: Record<string, string[]> = {
  send_files: [
    'Transfer files to the designated shared folder',
    'Follow the standard naming convention',
    'Notify ops once upload is complete',
  ],
  zno_live: [
    'Login to Zno Live with your credentials',
    'Create/select the event gallery',
    'Upload selected images during or after event',
    'Enable client access when ready',
  ],
  spotmyphotos: [
    'Open SpotMyPhotos app on your device',
    'Scan the event QR code or enter event ID',
    'Upload images in real-time during the event',
    'Guests can view and share immediately',
  ],
  digital_delivery: [
    'Upload all final images to the delivery folder',
    'Apply standard edits as per guidelines',
    'Confirm delivery in the system',
  ],
  usb: [
    'Prepare final images in the standard folder structure',
    'Copy to USB drive with event name label',
    'Return USB to office for client delivery',
  ],
  masv: [
    'Use the MASV upload portal link below',
    'Upload all final images and files',
    'You will receive a confirmation once upload is complete',
  ],
};

export function DeliveryInfo({ 
  deliveryMethod, 
  deliveryDeadline, 
  isDelivered 
}: DeliveryInfoProps) {
  if (!deliveryMethod && !deliveryDeadline) {
    return null;
  }

  const instructions = deliveryMethod ? DELIVERY_INSTRUCTIONS[deliveryMethod] || [] : [];
  
  const isDueSoon = deliveryDeadline && 
    isBefore(parseISO(deliveryDeadline), addDays(new Date(), 7)) && 
    !isDelivered;

  const isOverdue = deliveryDeadline && 
    isBefore(parseISO(deliveryDeadline), new Date()) && 
    !isDelivered;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn(
        isOverdue && 'border-destructive/50 bg-destructive/5',
        isDueSoon && !isOverdue && 'border-amber-500/50 bg-amber-500/5'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Delivery
            </div>
            {isDelivered ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Delivered
              </Badge>
            ) : isOverdue ? (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            ) : isDueSoon ? (
              <Badge variant="secondary" className="bg-amber-500 text-amber-950">
                <Clock className="h-3 w-3 mr-1" />
                Due Soon
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Deadline */}
          {deliveryDeadline && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Deadline: <strong>{format(parseISO(deliveryDeadline), 'EEE, MMM d, yyyy')}</strong>
              </span>
            </div>
          )}

          {/* Method */}
          {deliveryMethod && (
            <div>
              <p className="text-sm font-medium mb-1">Method</p>
              <Badge variant="outline" className="capitalize">
                {deliveryMethod.replace(/_/g, ' ')}
              </Badge>
            </div>
          )}

          {/* Instructions */}
          {instructions.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Upload Instructions</p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                {instructions.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ol>
            </div>
          )}

          {/* MASV Upload Link */}
          {deliveryMethod?.toLowerCase() === 'masv' && (
            <div className="pt-2">
              <a 
                href={MASV_UPLOAD_URL} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open MASV Upload Portal
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
