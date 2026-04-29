import { useRef } from 'react';
import { FolderOpen, Upload, Trash2, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLeadFiles, useUploadLeadFile, useDeleteLeadFile } from '@/hooks/useLeadFiles';
import { LeadCollapsiblePanel } from './LeadCollapsiblePanel';
import { supabase } from '@/integrations/supabase/client';

interface LeadFilesPanelProps {
  leadId: string;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadFilesPanel({ leadId }: LeadFilesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: files = [] } = useLeadFiles(leadId);
  const uploadFile = useUploadLeadFile();
  const deleteFile = useDeleteLeadFile();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File too large', { description: `${file.name} exceeds 50 MB` });
        continue;
      }
      try {
        await uploadFile.mutateAsync({ leadId, file });
        toast.success('Uploaded', { description: file.name });
      } catch (e: any) {
        toast.error('Upload failed', { description: e.message });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('lead-files').createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Download failed', { description: error?.message || 'Could not generate download link' });
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <LeadCollapsiblePanel
        icon={FolderOpen}
        title="Files"
        badge="UP TO 50MB"
        count={files.length}
        onAdd={() => inputRef.current?.click()}
        isEmpty={files.length === 0}
        emptyMessage="No files uploaded yet"
        defaultOpen={files.length > 0}
      >
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{f.file_name}</span>
                {f.file_size && (
                  <span className="text-muted-foreground text-xs shrink-0">{formatFileSize(f.file_size)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownload(f.file_path, f.file_name)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteFile.mutate({ file: f })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </LeadCollapsiblePanel>
    </>
  );
}
