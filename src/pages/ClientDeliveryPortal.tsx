import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Camera, 
  Download, 
  ExternalLink, 
  Lock, 
  AlertCircle, 
  Image, 
  Loader2, 
  FolderDown,
  Calendar,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDeliveryRecordByToken } from '@/hooks/useDeliveryRecords';
import { useGalleryAssetsByEventId, getPublicUrl, getThumbnailUrl } from '@/hooks/useGalleryAssets';
import { useState } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const deliveryMethodLabels: Record<string, { label: string; action: string }> = {
  dropbox: { label: 'Dropbox', action: 'Open Gallery' },
  zno_instant: { label: 'Zno Instant', action: 'View Photos' },
  spotmyphotos: { label: 'SpotMyPhotos', action: 'Download Photos' },
  internal_gallery: { label: 'Photo Gallery', action: 'View Gallery' },
};

export default function ClientDeliveryPortal() {
  const { token } = useParams<{ token: string }>();
  const { data: deliveryRecord, isLoading: isLoadingDelivery, error: deliveryError } = useDeliveryRecordByToken(token);
  
  // Fetch event details for branding
  const { data: eventDetails } = useQuery({
    queryKey: ['event-public', deliveryRecord?.event_id],
    queryFn: async () => {
      if (!deliveryRecord?.event_id) return null;
      const { data, error } = await supabase
        .from('events')
        .select('event_name, event_date, client_name, venue_name')
        .eq('id', deliveryRecord.event_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!deliveryRecord?.event_id,
  });

  const { data: galleryAssets = [] } = useGalleryAssetsByEventId(
    deliveryRecord?.delivery_method === 'internal_gallery' ? deliveryRecord?.event_id : undefined
  );
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  if (isLoadingDelivery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your photos...</p>
        </div>
      </div>
    );
  }

  if (deliveryError || !deliveryRecord || !deliveryRecord.qr_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Link Not Available</h1>
          <p className="text-muted-foreground">
            This delivery link may have expired, been disabled, or is invalid. 
            Please contact your photographer for assistance.
          </p>
        </motion.div>
      </div>
    );
  }

  const methodInfo = deliveryMethodLabels[deliveryRecord.delivery_method] || { 
    label: 'Photo Gallery', 
    action: 'Open Gallery' 
  };

  const isInternalGallery = deliveryRecord.delivery_method === 'internal_gallery';

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDownloadAll = async () => {
    if (galleryAssets.length === 0 || isDownloadingAll) return;
    
    setIsDownloadingAll(true);
    setDownloadProgress(0);
    
    try {
      const zip = new JSZip();
      const folderName = eventDetails?.event_name?.replace(/[^a-zA-Z0-9]/g, '-') || 'photos';
      const folder = zip.folder(folderName);
      
      for (let i = 0; i < galleryAssets.length; i++) {
        const asset = galleryAssets[i];
        const url = getPublicUrl(asset.storage_path);
        
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          folder?.file(asset.file_name, blob);
        } catch (err) {
          console.error(`Failed to fetch ${asset.file_name}:`, err);
        }
        
        setDownloadProgress(Math.round(((i + 1) / galleryAssets.length) * 100));
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Zip download failed:', err);
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Branded Header */}
      <header className="border-b border-slate-200/80 backdrop-blur-sm bg-white/80 sticky top-0 z-10">
        <div className="container max-w-5xl py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <span className="font-bold text-xl">EventPix</span>
                <p className="text-xs text-muted-foreground">Professional Event Photography</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-5xl py-12 px-4 pb-24">
        {/* Event Info Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/10">
            <Camera className="h-12 w-12 text-primary" />
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-bold mb-3">
            Your Photos Are Ready
          </h1>
          
          {eventDetails && (
            <Card className="max-w-md mx-auto mt-6 border-slate-200 bg-white/70 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg mb-2">{eventDetails.event_name}</h2>
                <div className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
                  {eventDetails.event_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(eventDetails.event_date), 'MMMM d, yyyy')}
                    </div>
                  )}
                  {eventDetails.venue_name && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {eventDetails.venue_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-muted-foreground max-w-md mx-auto mt-6">
            {isInternalGallery 
              ? 'Browse and download your event photos below. Click any photo to view full size.'
              : `Click the button below to access your photos via ${methodInfo.label}.`
            }
          </p>
        </motion.div>

        {/* Internal Gallery Grid */}
        {isInternalGallery && galleryAssets.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            {/* Gallery Count & Download All */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white/70 rounded-xl border border-slate-200 backdrop-blur">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{galleryAssets.length}</span> photos available
              </p>
              <Button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
              >
                {isDownloadingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing... {downloadProgress}%
                  </>
                ) : (
                  <>
                    <FolderDown className="h-4 w-4 mr-2" />
                    Download All Photos
                  </>
                )}
              </Button>
            </div>

            {/* Photo Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {galleryAssets.map((asset, index) => {
                const thumbnailUrl = getThumbnailUrl(asset);
                const fullUrl = getPublicUrl(asset.storage_path);
                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.03 * Math.min(index, 20) }}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm hover:shadow-lg transition-all"
                  >
                    <img
                      src={thumbnailUrl}
                      alt={asset.alt_text || asset.file_name}
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => setPreviewImage(fullUrl)}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(fullUrl, asset.file_name);
                        }}
                        className="p-2.5 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-lg"
                      >
                        <Download className="h-4 w-4 text-slate-700" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
              <Lock className="h-4 w-4" />
              <span>This gallery is private. Please do not share publicly.</span>
            </div>
          </motion.div>
        ) : isInternalGallery && galleryAssets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto"
          >
            <Image className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Photos Are Being Prepared</h3>
            <p className="text-muted-foreground">
              Your photos are currently being processed. Please check back soon.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm max-w-lg mx-auto"
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
                  <span>This link is private. Please do not share publicly.</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                <p className="font-medium">Gallery link is being prepared.</p>
                <p className="text-sm mt-2">Please check back soon or contact your photographer.</p>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-sm text-muted-foreground bg-white/80 backdrop-blur-sm border-t border-slate-200/50">
        <p>Photos by <strong>EventPix</strong> • Professional Event Photography</p>
      </footer>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            onClick={() => setPreviewImage(null)}
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white rounded-full hover:bg-slate-100 shadow-lg flex items-center gap-2 text-slate-800 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(previewImage, 'photo.jpg');
            }}
          >
            <Download className="h-5 w-5" />
            Download
          </button>
        </div>
      )}
    </div>
  );
}
