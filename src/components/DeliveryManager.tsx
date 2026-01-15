import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format, differenceInHours } from 'date-fns';
import { Check, Copy, Download, ExternalLink, QrCode, ToggleLeft, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useDeliveryRecord, useCreateDeliveryRecord, useUpdateDeliveryRecord } from '@/hooks/useDeliveryRecords';
import { useDeliveryMethods } from '@/hooks/useLookups';
import { useDeliveryGuardrails } from '@/hooks/useGuardrails';
import { useEvent } from '@/hooks/useEvents';
import { GalleryUploader } from '@/components/GalleryUploader';
import type { Database } from '@/integrations/supabase/types';

type DeliveryMethod = Database['public']['Enums']['delivery_method'];

interface DeliveryManagerProps {
  eventId: string;
  isAdmin: boolean;
}

export function DeliveryManager({ eventId, isAdmin }: DeliveryManagerProps) {
  const { toast } = useToast();
  const { data: record, isLoading } = useDeliveryRecord(eventId);
  const { data: event } = useEvent(eventId);
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const createRecord = useCreateDeliveryRecord();
  const updateRecord = useUpdateDeliveryRecord();
  
  // Delivery guardrails
  const { data: guardrails } = useDeliveryGuardrails(eventId);
  const guardrailWarnings = guardrails?.warnings || [];

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('dropbox');
  const [deliveryLink, setDeliveryLink] = useState('');
  const [copiedLink, setCopiedLink] = useState<'public' | 'delivery' | null>(null);
  
  // Calculate deadline status
  const deliveryDeadline = event?.delivery_deadline ? new Date(event.delivery_deadline) : null;
  const hoursUntilDeadline = deliveryDeadline ? differenceInHours(deliveryDeadline, new Date()) : null;
  const isDeadlineApproaching = hoursUntilDeadline !== null && hoursUntilDeadline > 0 && hoursUntilDeadline <= 24;
  const isDeadlinePassed = hoursUntilDeadline !== null && hoursUntilDeadline <= 0;

  // Get the public URL from the origin
  const publicUrl = `${window.location.origin}/g/${record?.qr_token}`;

  const handleSave = async () => {
    if (record) {
      await updateRecord.mutateAsync({
        id: record.id,
        delivery_method: deliveryMethod,
        delivery_link: deliveryLink,
        delivery_method_id: deliveryMethods.find(m => m.name.toLowerCase().replace(/\s+/g, '_') === deliveryMethod)?.id,
      });
    } else {
      await createRecord.mutateAsync({
        event_id: eventId,
        delivery_method: deliveryMethod,
        delivery_link: deliveryLink,
        delivery_method_id: deliveryMethods.find(m => m.name.toLowerCase().replace(/\s+/g, '_') === deliveryMethod)?.id,
      });
    }
  };

  const handleToggleQR = async () => {
    if (!record) return;
    await updateRecord.mutateAsync({
      id: record.id,
      qr_enabled: !record.qr_enabled,
    });
  };

  const handleMarkDelivered = async () => {
    if (!record) return;
    
    // Check guardrail: Cannot mark delivered without a link
    if (!record.delivery_link && !deliveryLink) {
      toast({
        variant: 'destructive',
        title: 'Delivery link required',
        description: 'You must provide a delivery link before marking as delivered.',
      });
      return;
    }
    
    await updateRecord.mutateAsync({
      id: record.id,
      delivered_at: new Date().toISOString(),
    });
    
    toast({
      title: 'Marked as delivered',
      description: 'The delivery has been marked as complete.',
    });
  };

  const copyToClipboard = async (text: string, type: 'public' | 'delivery') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      toast({ title: 'Copied to clipboard' });
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('delivery-qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx!.fillStyle = 'white';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const link = document.createElement('a');
      link.download = `event-qr-${eventId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  // Initialize form with existing record data
  if (record && !deliveryLink && record.delivery_link) {
    setDeliveryLink(record.delivery_link);
  }
  if (record && record.delivery_method) {
    if (deliveryMethod !== record.delivery_method) {
      setDeliveryMethod(record.delivery_method);
    }
  }

  return (
    <div className="space-y-6">
      {/* Delivery Guardrail Warnings */}
      {(guardrailWarnings.length > 0 || isDeadlineApproaching || isDeadlinePassed) && (
        <div className="space-y-3">
          {/* Deadline Warning */}
          {isDeadlinePassed && !record?.delivered_at && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Delivery Deadline Passed</AlertTitle>
              <AlertDescription>
                The delivery deadline was {deliveryDeadline && format(deliveryDeadline, 'MMM d, yyyy h:mm a')}.
                Please complete the delivery as soon as possible.
              </AlertDescription>
            </Alert>
          )}
          
          {isDeadlineApproaching && !record?.delivered_at && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600">Deadline Approaching</AlertTitle>
              <AlertDescription>
                Delivery deadline is in {hoursUntilDeadline} hour{hoursUntilDeadline !== 1 && 's'} 
                ({deliveryDeadline && format(deliveryDeadline, 'MMM d, yyyy h:mm a')}).
              </AlertDescription>
            </Alert>
          )}
          
          {/* Link Missing Warning */}
          {!record?.delivery_link && !deliveryLink && record && !record.delivered_at && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600">Delivery Link Required</AlertTitle>
              <AlertDescription>
                A delivery link must be provided before marking this event as delivered.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Delivered Without Link Warning */}
          {record?.delivered_at && !record?.delivery_link && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Missing Delivery Link</AlertTitle>
              <AlertDescription>
                This delivery was marked complete but no delivery link was stored. 
                Please add the link for record keeping.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      {/* Delivery Method & Link */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <h3 className="text-lg font-display font-semibold mb-4">Delivery Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="delivery-method">Delivery Method</Label>
            <Select 
              value={deliveryMethod} 
              onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
              disabled={!isAdmin}
            >
              <SelectTrigger id="delivery-method" className="mt-1">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dropbox">Dropbox</SelectItem>
                <SelectItem value="zno_instant">Zno Instant</SelectItem>
                <SelectItem value="spotmyphotos">SpotMyPhotos</SelectItem>
                <SelectItem value="internal_gallery">Internal Gallery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="delivery-link">Gallery/Delivery Link</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="delivery-link"
                placeholder="https://..."
                value={deliveryLink}
                onChange={(e) => setDeliveryLink(e.target.value)}
                disabled={!isAdmin}
              />
              {deliveryLink && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(deliveryLink, 'delivery')}
                >
                  {copiedLink === 'delivery' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={createRecord.isPending || updateRecord.isPending}>
                {record ? 'Update' : 'Create'} Delivery Record
              </Button>
              {record && !record.delivered_at && (
                <Button 
                  variant="outline" 
                  onClick={handleMarkDelivered}
                  disabled={!record.delivery_link && !deliveryLink}
                  title={!record.delivery_link && !deliveryLink ? 'Delivery link required' : undefined}
                >
                  Mark as Delivered
                </Button>
              )}
            </div>
          )}

          {record?.delivered_at && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Delivered on {format(new Date(record.delivered_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      </div>

      {/* QR Code Section */}
      {/* Internal Gallery Section - shown when method is internal_gallery */}
      {record && deliveryMethod === 'internal_gallery' && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h3 className="text-lg font-display font-semibold mb-4">Internal Gallery</h3>
          <GalleryUploader eventId={eventId} isAdmin={isAdmin} />
        </div>
      )}

      {/* QR Code Section */}
      {record && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-display font-semibold flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code Access
            </h3>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Label htmlFor="qr-toggle" className="text-sm text-muted-foreground">
                  {record.qr_enabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="qr-toggle"
                  checked={record.qr_enabled ?? true}
                  onCheckedChange={handleToggleQR}
                />
              </div>
            )}
          </div>

          {record.qr_enabled ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <QRCodeSVG 
                    id="delivery-qr-code"
                    value={publicUrl} 
                    size={160}
                    level="M"
                    includeMargin
                  />
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Public Gallery Link</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input value={publicUrl} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(publicUrl, 'public')}
                      >
                        {copiedLink === 'public' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadQR}>
                      <Download className="h-4 w-4 mr-2" />
                      Download QR
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Clients can scan this QR code to access the gallery without logging in.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ToggleLeft className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>QR code access is currently disabled.</p>
              {isAdmin && (
                <p className="text-sm mt-1">Enable it to allow clients to access the gallery.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
