/**
 * Panel for managing event documents split into Team and Internal sections.
 * Team documents are visible to crew; Internal documents are admin-only.
 */
import { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Loader2,
  File,
  FileSpreadsheet,
  Image as ImageIcon,
  MoreVertical,
  Lock,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/** Renders a list of documents with download/delete actions */
function DocumentList({
  documents,
  isAdmin,
  onDownload,
  onDelete,
  downloading,
}: {
  documents: EventDocument[];
  isAdmin: boolean;
  onDownload: (doc: EventDocument) => void;
  onDelete: (doc: EventDocument) => void;
  downloading: string | null;
}) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No documents yet.
      </p>
    );
  }

  return (
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
              onClick={() => onDownload(doc)}
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
                  <DropdownMenuItem
                    onClick={() => onDelete(doc)}
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
  );
}

export function EventDocumentsPanel({ eventId, isAdmin = false }: EventDocumentsPanelProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'team' | 'internal'>('team');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const teamFileRef = useRef<HTMLInputElement>(null);
  const internalFileRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading } = useEventDocuments(eventId);
  const uploadDocument = useUploadEventDocument();
  const deleteDocument = useDeleteEventDocument();
  const getDocumentUrl = useGetDocumentUrl();

  const teamDocs = documents.filter((d) => d.is_visible_to_crew);
  const internalDocs = documents.filter((d) => !d.is_visible_to_crew);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'team' | 'internal') => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadTarget(target);
      setUploadDialogOpen(true);
    }
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await uploadDocument.mutateAsync({
      eventId,
      file: selectedFile,
      description: description.trim() || undefined,
      isVisibleToCrew: uploadTarget === 'team',
    });
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setDescription('');
  };

  const handleDownload = async (doc: EventDocument) => {
    setDownloading(doc.id);
    try {
      const url = await getDocumentUrl(doc.file_path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (doc: EventDocument) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    await deleteDocument.mutateAsync({
      id: doc.id,
      eventId: doc.event_id,
      filePath: doc.file_path,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Documents – Team */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Documents – Team
              {teamDocs.length > 0 && (
                <Badge variant="secondary" className="ml-1">{teamDocs.length}</Badge>
              )}
            </CardTitle>
            {isAdmin && (
              <>
                <input
                  ref={teamFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => handleFileSelect(e, 'team')}
                />
                <Button size="sm" variant="outline" onClick={() => teamFileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <DocumentList
            documents={teamDocs}
            isAdmin={isAdmin}
            onDownload={handleDownload}
            onDelete={handleDelete}
            downloading={downloading}
          />
        </CardContent>
      </Card>

      {/* Documents – Internal (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Documents – Internal
                {internalDocs.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{internalDocs.length}</Badge>
                )}
              </CardTitle>
              <input
                ref={internalFileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => handleFileSelect(e, 'internal')}
              />
              <Button size="sm" variant="outline" onClick={() => internalFileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Private documents not visible to crew (e.g. signed addendums, internal contracts)
            </p>
            <DocumentList
              documents={internalDocs}
              isAdmin={isAdmin}
              onDownload={handleDownload}
              onDelete={handleDelete}
              downloading={downloading}
            />
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Upload to {uploadTarget === 'team' ? 'Documents – Team' : 'Documents – Internal'}
            </DialogTitle>
            <DialogDescription>
              {uploadTarget === 'team'
                ? 'This document will be visible to assigned crew members.'
                : 'This document is internal only — not visible to crew.'}
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
                  placeholder={
                    uploadTarget === 'internal'
                      ? 'e.g., Signed copyright addendum'
                      : 'e.g., Run sheet for Day 1'
                  }
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
