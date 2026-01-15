import { useRef, useState, useCallback } from 'react';
import { ImagePlus, Loader2, Trash2, X, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useGalleryAssets, useUploadGalleryAsset, useDeleteGalleryAsset, getPublicUrl } from '@/hooks/useGalleryAssets';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface GalleryUploaderProps {
  eventId: string;
  isAdmin: boolean;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
}

export function GalleryUploader({ eventId, isAdmin }: GalleryUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: assets = [], isLoading } = useGalleryAssets(eventId);
  const uploadMutation = useUploadGalleryAsset();
  const deleteMutation = useDeleteGalleryAsset();
  
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; storagePath: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    // Initialize upload state for all files
    const initialFiles: UploadingFile[] = fileArray.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      progress: 0,
      status: 'pending',
    }));
    
    setUploadingFiles(prev => [...prev, ...initialFiles]);

    // Upload files sequentially with progress updates
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const uploadId = initialFiles[i].id;

      try {
        // Update status to uploading
        setUploadingFiles(prev =>
          prev.map(f => f.id === uploadId ? { ...f, status: 'uploading', progress: 10 } : f)
        );

        // Simulate progress during upload
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev =>
            prev.map(f => {
              if (f.id === uploadId && f.status === 'uploading' && f.progress < 90) {
                return { ...f, progress: Math.min(f.progress + 15, 90) };
              }
              return f;
            })
          );
        }, 200);

        await uploadMutation.mutateAsync({ eventId, file });

        clearInterval(progressInterval);

        // Mark as complete
        setUploadingFiles(prev =>
          prev.map(f => f.id === uploadId ? { ...f, status: 'complete', progress: 100 } : f)
        );

        // Remove from list after a short delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
        }, 1500);
      } catch (error) {
        setUploadingFiles(prev =>
          prev.map(f => f.id === uploadId ? { ...f, status: 'error', progress: 0 } : f)
        );
        
        // Remove error state after delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
        }, 3000);
      }
    }
  }, [eventId, uploadMutation]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    processFiles(files);
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdmin) {
      setIsDragOver(true);
    }
  }, [isAdmin]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!isAdmin) return;

    const files = e.dataTransfer.files;
    if (files?.length) {
      processFiles(files);
    }
  }, [isAdmin, processFiles]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync({
      id: deleteTarget.id,
      eventId,
      storagePath: deleteTarget.storagePath,
    });
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const isUploading = uploadingFiles.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground">Gallery Images</h4>
        {isAdmin && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 mr-2" />
              )}
              Upload Images
            </Button>
          </>
        )}
      </div>

      {/* Upload Progress Indicators */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm font-medium text-foreground mb-3">
            Uploading {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}...
          </p>
          {uploadingFiles.map((file) => (
            <div key={file.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[200px]">{file.name}</span>
                <span className={cn(
                  "text-xs",
                  file.status === 'complete' && "text-green-600",
                  file.status === 'error' && "text-destructive",
                  file.status === 'uploading' && "text-primary"
                )}>
                  {file.status === 'complete' && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Done
                    </span>
                  )}
                  {file.status === 'uploading' && `${file.progress}%`}
                  {file.status === 'pending' && 'Waiting...'}
                  {file.status === 'error' && 'Failed'}
                </span>
              </div>
              <Progress 
                value={file.progress} 
                className={cn(
                  "h-1.5",
                  file.status === 'complete' && "[&>div]:bg-green-600",
                  file.status === 'error' && "[&>div]:bg-destructive"
                )}
              />
            </div>
          ))}
        </div>
      )}

      {/* Drag and Drop Zone */}
      {isAdmin && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer",
            isDragOver 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-border hover:border-primary/50",
            assets.length === 0 ? "py-12" : "py-6"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center text-center px-4">
            <div className={cn(
              "p-3 rounded-full mb-3 transition-colors",
              isDragOver ? "bg-primary/10" : "bg-muted"
            )}>
              <Upload className={cn(
                "h-6 w-6 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <p className={cn(
              "font-medium transition-colors",
              isDragOver ? "text-primary" : "text-foreground"
            )}>
              {isDragOver ? 'Drop images here' : 'Drag & drop images here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
        </div>
      )}

      {/* Empty state for non-admin */}
      {!isAdmin && assets.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <ImagePlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No images uploaded yet</p>
        </div>
      )}

      {/* Image Grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const url = getPublicUrl(asset.storage_path);
            return (
              <div key={asset.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={url}
                  alt={asset.file_name}
                  className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                  onClick={() => setPreviewImage(url)}
                  loading="lazy"
                />
                {isAdmin && (
                  <button
                    onClick={() => setDeleteTarget({ id: asset.id, storagePath: asset.storage_path })}
                    className="absolute top-2 right-2 p-1.5 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the image from the gallery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
