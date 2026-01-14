import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Camera, Calendar, ExternalLink, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function GalleryAccess() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      // This would need a public RLS policy or an edge function
      // For now, showing the structure
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, venue_name, delivery_method')
        .eq('id', eventId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: deliveryRecord } = useQuery({
    queryKey: ['public-delivery', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('delivery_records')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading gallery...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Camera className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Gallery Not Found</h1>
          <p className="text-muted-foreground">
            This gallery link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  const deliveryLink = deliveryRecord?.delivery_link || '#';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-4xl py-6">
          <div className="flex items-center gap-3 mb-4">
            <Camera className="h-8 w-8 text-primary" />
            <span className="font-display font-bold text-xl">Eventpix</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl lg:text-4xl font-display font-bold mb-4">
            {event.event_name}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(parseISO(event.event_date), 'MMMM d, yyyy')}
            </span>
            {event.venue_name && (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.venue_name}
              </span>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8 text-center shadow-card"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Camera className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-display font-semibold mb-2">
            Your Photos Are Ready
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Click below to access your photo gallery. You can view, download, and share your photos.
          </p>
          <a href={deliveryLink} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-gradient-primary hover:opacity-90">
              <ExternalLink className="h-5 w-5 mr-2" />
              Open Gallery
            </Button>
          </a>
        </motion.div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Photos by Eventpix • Australia & New Zealand
        </p>
      </main>
    </div>
  );
}
