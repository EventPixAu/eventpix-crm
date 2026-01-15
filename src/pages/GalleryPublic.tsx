import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, ExternalLink, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeliveryRecordByToken } from '@/hooks/useDeliveryRecords';

const deliveryMethodLabels: Record<string, { label: string; action: string }> = {
  dropbox: { label: 'Dropbox', action: 'Open Gallery' },
  zno_instant: { label: 'Zno Instant', action: 'View Photos' },
  spotmyphotos: { label: 'SpotMyPhotos', action: 'Download Photos' },
  internal_gallery: { label: 'Eventpix Gallery', action: 'View Gallery' },
};

export default function GalleryPublic() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { data: deliveryRecord, isLoading, error } = useDeliveryRecordByToken(qrToken);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error || !deliveryRecord || !deliveryRecord.qr_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">Link Not Found</h1>
          <p className="text-muted-foreground">
            This gallery link may have expired, been disabled, or is invalid.
          </p>
        </motion.div>
      </div>
    );
  }

  const methodInfo = deliveryMethodLabels[deliveryRecord.delivery_method] || { 
    label: 'Photo Gallery', 
    action: 'Open Gallery' 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-10">
        <div className="container max-w-4xl py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <span className="font-display font-bold text-xl">Eventpix</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/10">
            <Camera className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold mb-4">
            Your Photos Are Ready
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Click the button below to access your photo gallery via {methodInfo.label}.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8 text-center shadow-xl shadow-black/5 max-w-lg mx-auto"
        >
          {deliveryRecord.delivery_link ? (
            <>
              <a 
                href={deliveryRecord.delivery_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <Button size="lg" className="w-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 h-14 text-lg">
                  <ExternalLink className="h-5 w-5 mr-2" />
                  {methodInfo.action}
                </Button>
              </a>
              <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>This link is private. Do not share publicly.</span>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">
              <p>Gallery link is being prepared.</p>
              <p className="text-sm mt-2">Please check back soon.</p>
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm border-t border-border/50">
        <p>Photos by Eventpix • Event Photography Australia</p>
      </footer>
    </div>
  );
}
