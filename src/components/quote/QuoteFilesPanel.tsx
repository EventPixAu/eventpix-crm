/**
 * Panel for uploading PDF/document attachments to a budget (quote).
 * Mirrors LeadFilesPanel pattern but stored in the private `quote-files` bucket.
 */
import { useRef } from 'react';
import { FolderOpen, Upload, Trash2, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  useQuoteFiles,
  useUploadQuoteFile,
  useDeleteQuoteFile,
  QuoteFile,
} from '@/hooks/useQuoteFiles';

interface QuoteFilesPanelProps {
  quoteId: string;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function QuoteFilesPanel({ quoteId }: QuoteFilesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: files = [], isLoading } = useQuoteFiles(quoteId);
  const uploadFile = useUploadQuoteFile();
  const deleteFile = useDeleteQuoteFile();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File too large', { description: `${file.name} exceeds 50 MB` });
        continue;
      }
      try {
        await uploadFile.mutateAsync({ quoteId, file });
        toast.success('Uploaded', { description: file.name });
      } catch (e: any) {
        toast.error('Upload failed', { description: e.message });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async (file: QuoteFile) => {
    const { data, error } = await supabase.storage
      .from('quote-files')
      .createSignedUrl(file.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Download failed', {
        description: error?.message || 'Could not generate download link',
      });
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = file.file_name;
    a.target = '_blank';
    a.click();
  };

  const handleDelete = async (file: QuoteFile) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;
    try {
      await deleteFile.mutateAsync({ file });
      toast.success('Deleted');
    } catch (e: any) {
      toast.error('Delete failed', { description: e.message });
    }
  };

  return (
    <Card>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Documents
            {files.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {files.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-2">
          Attach PDFs or supporting documents to this budget (max 50 MB each). Internal — not
          shown on the client proposal page.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 p-2 border rounded-lg hover:bg-muted/50 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{f.file_name}</span>
                  {f.file_size && (
                    <span className="text-muted-foreground text-xs shrink-0">
                      {formatFileSize(f.file_size)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(f)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(f)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
