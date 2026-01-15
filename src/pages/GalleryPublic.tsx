import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Download, ExternalLink, Lock, AlertCircle, Image, Loader2, FolderDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeliveryRecordByToken } from '@/hooks/useDeliveryRecords';
import { useGalleryAssetsByEventId, getPublicUrl } from '@/hooks/useGalleryAssets';
import { useState } from 'react';
import JSZip from 'jszip';

const deliveryMethodLabels: Record<string, { label: string; action: string }> = {
  dropbox: { label: 'Dropbox', action: 'Open Gallery' },
  zno_instant: { label: 'Zno Instant', action: 'View Photos' },
  spotmyphotos: { label: 'SpotMyPhotos', action: 'Download Photos' },
  internal_gallery: { label: 'Eventpix Gallery', action: 'View Gallery' },
};

export default function GalleryPublic() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { data: deliveryRecord, isLoading, error } = useDeliveryRecordByToken(qrToken);
  const { data: galleryAssets = [] } = useGalleryAssetsByEventId(
    deliveryRecord?.delivery_method === 'internal_gallery' ? deliveryRecord?.event_id : undefined
  );
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
      const folder = zip.folder('eventpix-photos');
      
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
      link.download = 'eventpix-photos.zip';
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
      <main className="container max-w-4xl py-16 px-4 pb-24">
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
            {isInternalGallery 
              ? 'Browse and download your event photos below.'
              : `Click the button below to access your photo gallery via ${methodInfo.label}.`
            }
          </p>
        </motion.div>

        {/* Internal Gallery Grid */}
        {isInternalGallery && galleryAssets.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {galleryAssets.map((asset, index) => {
                const url = getPublicUrl(asset.storage_path);
                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * index }}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted shadow-lg"
                  >
                    <img
                      src={url}
                      alt={asset.file_name}
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => setPreviewImage(url)}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(url, asset.file_name);
                        }}
                        className="p-3 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-lg"
                      >
                        <Download className="h-5 w-5 text-foreground" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
              >
                {isDownloadingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Downloading... {downloadProgress}%
                  </>
                ) : (
                  <>
                    <FolderDown className="h-5 w-5 mr-2" />
                    Download All Photos
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>This gallery is private. Do not share publicly.</span>
            </div>
          </motion.div>
        ) : isInternalGallery && galleryAssets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl p-8 text-center shadow-xl shadow-black/5 max-w-lg mx-auto"
          >
            <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Photos are being prepared.</p>
            <p className="text-sm mt-2 text-muted-foreground">Please check back soon.</p>
          </motion.div>
        ) : (
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
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm border-t border-border/50">
        <p>Photos by Eventpix • Event Photography Australia</p>
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
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/90 rounded-full hover:bg-white shadow-lg flex items-center gap-2"
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
