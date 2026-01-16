/**
 * PhotographySection - Display photography-specific instructions for crew
 * 
 * Shows:
 * - Photography brief
 * - Camera settings
 * - Delivery method and instructions
 * 
 * Read-only for crew members.
 */

import { motion } from 'framer-motion';
import { Camera, Clapperboard, Upload, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PhotographySectionProps {
  photographyBrief?: string | null;
  cameraSettings?: string | null;
  deliveryMethod?: string | null;
  deliveryDeadline?: string | null;
  dressCode?: string | null;
}

const DELIVERY_METHOD_LABELS: Record<string, { label: string; icon: typeof Send; description: string }> = {
  send_files: {
    label: 'Send Files',
    icon: Send,
    description: 'Upload files to the designated folder after the event',
  },
  zno_live: {
    label: 'Zno Live',
    icon: Upload,
    description: 'Upload directly to Zno Live during/after the event',
  },
  spotmyphotos: {
    label: 'SpotMyPhotos',
    icon: Camera,
    description: 'Use SpotMyPhotos for real-time gallery sharing',
  },
  digital_delivery: {
    label: 'Digital Delivery',
    icon: Send,
    description: 'Standard digital delivery post-event',
  },
  usb: {
    label: 'USB Delivery',
    icon: Clapperboard,
    description: 'Prepare files for USB delivery',
  },
};

export function PhotographySection({
  photographyBrief,
  cameraSettings,
  deliveryMethod,
  deliveryDeadline,
  dressCode,
}: PhotographySectionProps) {
  const methodInfo = deliveryMethod ? DELIVERY_METHOD_LABELS[deliveryMethod] : null;
  const MethodIcon = methodInfo?.icon || Send;

  const hasContent = photographyBrief || cameraSettings || deliveryMethod || dressCode;

  if (!hasContent) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Photography Brief */}
      {photographyBrief && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photography Brief
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{photographyBrief}</p>
          </CardContent>
        </Card>
      )}

      {/* Camera Settings */}
      {cameraSettings && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clapperboard className="h-4 w-4" />
              Camera Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg">
              {cameraSettings}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Dress Code */}
      {dressCode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              👔 Dress Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{dressCode}</p>
          </CardContent>
        </Card>
      )}

      {/* Delivery Method */}
      {deliveryMethod && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MethodIcon className="h-4 w-4" />
              Delivery Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default">{methodInfo?.label || deliveryMethod}</Badge>
              {deliveryDeadline && (
                <span className="text-sm text-muted-foreground">
                  Due: {new Date(deliveryDeadline).toLocaleDateString()}
                </span>
              )}
            </div>
            {methodInfo?.description && (
              <p className="text-sm text-muted-foreground">
                {methodInfo.description}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
