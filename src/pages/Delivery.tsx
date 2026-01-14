import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ExternalLink, Package, QrCode } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useEvents } from '@/hooks/useEvents';

interface DeliveryRecord {
  id: string;
  event_id: string;
  delivery_method: string;
  delivery_link: string | null;
  qr_code_data: string | null;
  delivered_at: string | null;
  notes: string | null;
}

export default function Delivery() {
  const { data: events = [] } = useEvents();
  const { data: deliveryRecords = [], isLoading } = useQuery({
    queryKey: ['delivery-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_records')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DeliveryRecord[];
    },
  });

  const eventsWithDelivery = useMemo(() => {
    return events
      .filter((e) => e.delivery_method)
      .map((event) => ({
        ...event,
        deliveryRecord: deliveryRecords.find((r) => r.event_id === event.id),
      }));
  }, [events, deliveryRecords]);

  const deliveryMethods: Record<string, string> = {
    dropbox: 'Dropbox',
    zno_instant: 'Zno Instant',
    spotmyphotos: 'SpotMyPhotos',
    internal_gallery: 'Internal Gallery',
  };

  return (
    <AppLayout>
      <PageHeader
        title="Delivery"
        description="Track photo delivery for all events"
      />

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading delivery records...
        </div>
      ) : eventsWithDelivery.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No events with delivery methods</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Event
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Date
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Method
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Deadline
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {eventsWithDelivery.map((event, index) => (
                  <motion.tr
                    key={event.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-border hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/events/${event.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {event.event_name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{event.client_name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {format(parseISO(event.event_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {deliveryMethods[event.delivery_method || ''] || event.delivery_method}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {event.delivery_deadline
                        ? format(parseISO(event.delivery_deadline), 'MMM d, yyyy')
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={event.deliveryRecord?.delivered_at ? 'completed' : 'pending'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/events/${event.id}`}>
                          <Button variant="ghost" size="sm">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </Link>
                        {event.deliveryRecord?.delivery_link && (
                          <a
                            href={event.deliveryRecord.delivery_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
