import { Link, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Calendar, CheckCircle, ExternalLink, Link as LinkIcon, Package, QrCode } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEvent } from '@/hooks/useEvents';
import { useDeliveryRecord } from '@/hooks/useDeliveryRecords';
import { useDeliveryMethods } from '@/hooks/useLookups';
import { getPublicBaseUrl } from '@/lib/utils';

const LEGACY_DELIVERY_METHODS: Record<string, string> = {
  dropbox: 'Dropbox',
  zno_instant: 'Zno Instant',
  spotmyphotos: 'SpotMyPhotos',
  internal_gallery: 'Eventpix Gallery',
};

const formatMethod = (method?: string | null) => {
  if (!method) return 'Not set';
  return LEGACY_DELIVERY_METHODS[method] || method.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function EventDelivery() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const { data: deliveryRecord, isLoading: deliveryLoading } = useDeliveryRecord(id);
  const { data: deliveryMethods = [] } = useDeliveryMethods();

  const methodMap = deliveryMethods.reduce<Record<string, string>>((acc, method) => {
    acc[method.id] = method.name;
    return acc;
  }, {});

  const deliveryMethod = deliveryRecord?.delivery_method_id
    ? methodMap[deliveryRecord.delivery_method_id]
    : (event as any)?.delivery_method_id
      ? methodMap[(event as any).delivery_method_id]
      : formatMethod(deliveryRecord?.delivery_method || (event as any)?.delivery_method);
  const guestDeliveryMethod = (event as any)?.delivery_method_guests_id
    ? methodMap[(event as any).delivery_method_guests_id]
    : 'Not set';
  const deliveryLink = deliveryRecord?.delivery_link || (event as any)?.dropbox_link || (event as any)?.smugmug_link || null;
  const galleryUrl = deliveryRecord?.qr_token ? `${getPublicBaseUrl()}/g/${deliveryRecord.qr_token}` : null;
  const qrReference = galleryUrl || deliveryRecord?.qr_code_data || (event as any)?.qr_file_name || (event as any)?.qr_file_path || null;
  const isLoading = eventLoading || deliveryLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-muted-foreground">Loading delivery details...</div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-xl font-semibold">Event not found</h1>
          <Button variant="outline" onClick={() => navigate('/events')}>Back to Events</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-xl px-4 pb-24 sm:px-6 lg:max-w-3xl">
        <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/events/${event.id}`)} aria-label="Back to event">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Event Delivery</p>
              <h1 className="truncate text-xl font-semibold">{event.event_name}</h1>
            </div>
          </div>
        </div>

        <section className="space-y-4 py-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {event.event_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(parseISO(event.event_date), 'EEE d MMM yyyy')}
              </span>
            )}
            <Badge variant={deliveryRecord?.delivered_at ? 'default' : 'secondary'}>
              {deliveryRecord?.delivered_at ? 'Delivered' : 'Pending delivery'}
            </Badge>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Delivery method</p>
                <p className="text-lg font-semibold">{deliveryMethod || 'Not set'}</p>
                {guestDeliveryMethod !== 'Not set' && (
                  <p className="mt-1 text-sm text-muted-foreground">Guest access: {guestDeliveryMethod}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <LinkIcon className="mt-0.5 h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Delivery link</p>
                  {deliveryLink ? (
                    <p className="break-all font-mono text-sm">{deliveryLink}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No delivery link has been added.</p>
                  )}
                </div>
                {deliveryLink && (
                  <Button asChild className="w-full sm:w-auto" variant="outline">
                    <a href={deliveryLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open delivery link
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <QrCode className="mt-0.5 h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">QR code reference</p>
                  {qrReference ? (
                    <p className="break-all font-mono text-sm">{qrReference}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No QR code reference has been created.</p>
                  )}
                </div>
                {galleryUrl && deliveryRecord?.qr_enabled !== false && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="w-fit rounded-lg border border-border bg-white p-3">
                      <QRCodeSVG value={galleryUrl} size={144} level="M" includeMargin />
                    </div>
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <a href={galleryUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open QR link
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm text-muted-foreground">
            {event.delivery_deadline && <p>Deadline: {format(parseISO(event.delivery_deadline), 'EEE d MMM yyyy')}</p>}
            {deliveryRecord?.delivered_at && (
              <p className="inline-flex items-center gap-2 text-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                Delivered {format(parseISO(deliveryRecord.delivered_at), 'EEE d MMM yyyy, h:mm a')}
              </p>
            )}
          </div>

          <Button asChild variant="secondary" className="w-full">
            <Link to={`/events/${event.id}`}>View full event</Link>
          </Button>
        </section>
      </main>
    </AppLayout>
  );
}