import { useRef, useState, useCallback } from 'react';
import { ImagePlus, Loader2, Trash2, X, Upload, CheckCircle2, GripVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGalleryAssets, useUploadGalleryAsset, useDeleteGalleryAsset, useReorderGalleryAssets, useUpdateGalleryAsset, getPublicUrl, GalleryAsset } from '@/hooks/useGalleryAssets';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface SortableImageProps {
  asset: GalleryAsset;
  isAdmin: boolean;
  onPreview: (url: string) => void;
  onDelete: (asset: { id: string; storagePath: string }) => void;
  onEdit: (asset: GalleryAsset) => void;
}

function SortableImage({ asset, isAdmin, onPreview, onDelete, onEdit }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const url = getPublicUrl(asset.storage_path);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted",
        isDragging && "opacity-50 ring-2 ring-primary z-50"
      )}
    >
      <img
        src={url}
        alt={asset.alt_text || asset.file_name}
        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
        onClick={() => onPreview(url)}
        loading="lazy"
      />
      {/* Caption overlay */}
      {asset.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
          <p className="text-white text-xs line-clamp-2">{asset.caption}</p>
        </div>
      )}
      {isAdmin && (
        <>
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 p-1.5 bg-background/90 text-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          {/* Edit Button */}
          <button
            onClick={() => onEdit(asset)}
            className="absolute top-2 right-10 p-1.5 bg-background/90 text-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {/* Delete Button */}
          <button
            onClick={() => onDelete({ id: asset.id, storagePath: asset.storage_path })}
            className="absolute top-2 right-2 p-1.5 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export function GalleryUploader({ eventId, isAdmin }: GalleryUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: assets = [], isLoading } = useGalleryAssets(eventId);
  const uploadMutation = useUploadGalleryAsset();
  const deleteMutation = useDeleteGalleryAsset();
  const reorderMutation = useReorderGalleryAssets();
  const updateMutation = useUpdateGalleryAsset();
  
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; storagePath: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [localAssets, setLocalAssets] = useState<GalleryAsset[]>([]);
  const [editingAsset, setEditingAsset] = useState<GalleryAsset | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editAltText, setEditAltText] = useState('');

  const handleEditOpen = (asset: GalleryAsset) => {
    setEditingAsset(asset);
    setEditCaption(asset.caption || '');
    setEditAltText(asset.alt_text || '');
  };

  const handleEditSave = async () => {
    if (!editingAsset) return;
    await updateMutation.mutateAsync({
      id: editingAsset.id,
      eventId,
      caption: editCaption || null,
      alt_text: editAltText || null,
    });
    setEditingAsset(null);
  };

  // Sync local assets with server assets
  const displayAssets = localAssets.length > 0 ? localAssets : assets;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = assets.findIndex((item) => item.id === active.id);
      const newIndex = assets.findIndex((item) => item.id === over.id);
      
      const newOrder = arrayMove(assets, oldIndex, newIndex);
      setLocalAssets(newOrder);
      
      // Persist the new order
      reorderMutation.mutate(
        { eventId, orderedIds: newOrder.map(a => a.id) },
        {
          onSuccess: () => {
            setLocalAssets([]);
          },
          onError: () => {
            setLocalAssets([]);
          },
        }
      );
    }
  }, [assets, eventId, reorderMutation]);

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

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdmin) {
      setIsDragOver(true);
    }
  }, [isAdmin]);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
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
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground">Gallery Images</h4>
          {isAdmin && displayAssets.length > 1 && (
            <span className="text-xs text-muted-foreground">(drag to reorder)</span>
          )}
        </div>
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
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
          className={cn(
            "border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer",
            isDragOver 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-border hover:border-primary/50",
            displayAssets.length === 0 ? "py-12" : "py-6"
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
      {!isAdmin && displayAssets.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <ImagePlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No images uploaded yet</p>
        </div>
      )}

      {/* Image Grid with Drag & Drop */}
      {displayAssets.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={displayAssets.map(a => a.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {displayAssets.map((asset) => (
                <SortableImage
                  key={asset.id}
                  asset={asset}
                  isAdmin={isAdmin}
                  onPreview={setPreviewImage}
                  onDelete={setDeleteTarget}
                  onEdit={handleEditOpen}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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

      {/* Edit Caption/Alt Text Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Image Details</DialogTitle>
            <DialogDescription>
              Add a caption and alt text to improve accessibility.
            </DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <div className="space-y-4 py-2">
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                <img
                  src={getPublicUrl(editingAsset.storage_path)}
                  alt={editingAsset.alt_text || editingAsset.file_name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Input
                  id="caption"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Describe this image briefly..."
                />
                <p className="text-xs text-muted-foreground">
                  Visible caption displayed below the image
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alt-text">Alt Text</Label>
                <Textarea
                  id="alt-text"
                  value={editAltText}
                  onChange={(e) => setEditAltText(e.target.value)}
                  placeholder="Describe the image for screen readers..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  For accessibility - read by screen readers
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAsset(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
