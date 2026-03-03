/**
 * Panel for uploading/displaying a QR code (PDF or PNG) for an event.
 */
import { useState, useRef } from 'react';
import { QrCode, Upload, Trash2, Loader2, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EventQrPanelProps {
  eventId: string;
  qrFilePath: string | null;
  qrFileName: string | null;
  isAdmin?: boolean;
}

export function EventQrPanel({ eventId, qrFilePath, qrFileName, isAdmin = false }: EventQrPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF or image file');
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${eventId}/qr_${Date.now()}_${safeName}`;

      // Remove old file if exists
      if (qrFilePath) {
        await supabase.storage.from('event-documents').remove([qrFilePath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('event-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('events')
        .update({ qr_file_path: filePath, qr_file_name: file.name })
        .eq('id', eventId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('QR file uploaded');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload QR file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!qrFilePath) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('event-documents')
        .createSignedUrl(qrFilePath, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Failed to download');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!qrFilePath || !confirm('Remove QR file?')) return;
    try {
      await supabase.storage.from('event-documents').remove([qrFilePath]);
      await supabase
        .from('events')
        .update({ qr_file_path: null, qr_file_name: null })
        .eq('id', eventId);
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('QR file removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const isPdf = qrFileName?.toLowerCase().endsWith('.pdf');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR for this Event
          </CardTitle>
          {isAdmin && (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                {qrFilePath ? 'Replace' : 'Upload'}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {qrFilePath && qrFileName ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isPdf ? (
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
              )}
              <p className="text-sm font-medium truncate">{qrFileName}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              {isAdmin && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No QR file uploaded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
