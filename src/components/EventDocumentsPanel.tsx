/**
 * Panel for managing event documents (PDFs, run sheets, etc.)
 * Admins/Ops can upload, delete, and toggle crew visibility
 * Crew can view and download documents marked visible
 */
import { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  EyeOff, 
  Loader2,
  File,
  FileSpreadsheet,
  Image as ImageIcon,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useEventDocuments,
  useUploadEventDocument,
  useUpdateEventDocument,
  useDeleteEventDocument,
  useGetDocumentUrl,
  EventDocument,
} from '@/hooks/useEventDocuments';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface EventDocumentsPanelProps {
  eventId: string;
  isAdmin?: boolean;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5" />;
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (mimeType.includes('image')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (mimeType.includes('word')) return <FileText className="h-5 w-5 text-blue-600" />;
  return <File className="h-5 w-5" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EventDocumentsPanel({ eventId, isAdmin = false }: EventDocumentsPanelProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [visibleToCrew, setVisibleToCrew] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading } = useEventDocuments(eventId);
  const uploadDocument = useUploadEventDocument();
  const updateDocument = useUpdateEventDocument();
  const deleteDocument = useDeleteEventDocument();
  const getDocumentUrl = useGetDocumentUrl();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    await uploadDocument.mutateAsync({
      eventId,
      file: selectedFile,
      description: description.trim() || undefined,
      isVisibleToCrew: visibleToCrew,
    });
    
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setDescription('');
    setVisibleToCrew(true);
  };

  const handleDownload = async (doc: EventDocument) => {
    setDownloading(doc.id);
    try {
      const url = await getDocumentUrl(doc.file_path);
      // Open in new tab or trigger download
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloading(null);
    }
  };

  const handleToggleVisibility = async (doc: EventDocument) => {
    await updateDocument.mutateAsync({
      id: doc.id,
      eventId: doc.event_id,
      isVisibleToCrew: !doc.is_visible_to_crew,
    });
  };

  const handleDelete = async (doc: EventDocument) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    
    await deleteDocument.mutateAsync({
      id: doc.id,
      eventId: doc.event_id,
      filePath: doc.file_path,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-1">{documents.length}</Badge>
              )}
            </CardTitle>
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No documents attached to this event.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getFileIcon(doc.mime_type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                        <span>•</span>
                        <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                        {!doc.is_visible_to_crew && isAdmin && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs py-0">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hidden from crew
                            </Badge>
                          </>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                    >
                      {downloading === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleToggleVisibility(doc)}>
                            {doc.is_visible_to_crew ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide from Crew
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Show to Crew
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(doc)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document to this event for the team to access.
            </DialogDescription>
          </DialogHeader>
          
          {selectedFile && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                {getFileIcon(selectedFile.type)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Run sheet for Day 1"
                />
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div>
                  <Label htmlFor="visibleToCrew" className="cursor-pointer">
                    Visible to Crew
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Crew members assigned to this event can view
                  </p>
                </div>
                <Switch
                  id="visibleToCrew"
                  checked={visibleToCrew}
                  onCheckedChange={setVisibleToCrew}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploadDocument.isPending}
            >
              {uploadDocument.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
