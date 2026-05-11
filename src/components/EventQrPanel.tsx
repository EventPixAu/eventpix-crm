/**
 * Panel for uploading/displaying a QR code (PDF or PNG) for an event,
 * plus a pre-registration link field.
 */
import { useState, useRef, useCallback } from 'react';
import { QrCode, Upload, Trash2, Loader2, Download, FileText, Image as ImageIcon, Link2, ExternalLink, Copy, Check, Pencil, Droplets, Camera, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EventQrPanelProps {
  eventId: string;
  qrFilePath: string | null;
  qrFileName: string | null;
  preRegistrationLink?: string | null;
  dropboxLink?: string | null;
  smugmugLink?: string | null;
  artworkDriveLink?: string | null;
  isAdmin?: boolean;
}

export function EventQrPanel({ eventId, qrFilePath, qrFileName, preRegistrationLink, dropboxLink, smugmugLink, artworkDriveLink, isAdmin = false }: EventQrPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const [linkValue, setLinkValue] = useState(preRegistrationLink || '');
  const [savingLink, setSavingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingDropbox, setEditingDropbox] = useState(false);
  const [dropboxValue, setDropboxValue] = useState(dropboxLink || '');
  const [savingDropbox, setSavingDropbox] = useState(false);
  const [copiedDropbox, setCopiedDropbox] = useState(false);
  const [editingSmugmug, setEditingSmugmug] = useState(false);
  const [smugmugValue, setSmugmugValue] = useState(smugmugLink || '');
  const [savingSmugmug, setSavingSmugmug] = useState(false);
  const [copiedSmugmug, setCopiedSmugmug] = useState(false);
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
    if (!qrFilePath || deleting || !confirm('Remove QR file?')) return;
    setDeleting(true);
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
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveLink = async () => {
    setSavingLink(true);
    try {
      const value = linkValue.trim() || null;
      const { error } = await supabase
        .from('events')
        .update({ pre_registration_link: value } as any)
        .eq('id', eventId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      setEditingLink(false);
      toast.success(value ? 'Registration link saved' : 'Registration link removed');
    } catch {
      toast.error('Failed to save link');
    } finally {
      setSavingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!preRegistrationLink) return;
    navigator.clipboard.writeText(preRegistrationLink);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveGenericLink = async (column: string, value: string, setSaving: (b: boolean) => void, setEditing: (b: boolean) => void, label: string) => {
    setSaving(true);
    try {
      const v = value.trim() || null;
      const { error } = await supabase
        .from('events')
        .update({ [column]: v } as any)
        .eq('id', eventId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      setEditing(false);
      toast.success(v ? `${label} saved` : `${label} removed`);
    } catch {
      toast.error(`Failed to save ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const isPdf = qrFileName?.toLowerCase().endsWith('.pdf');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR & Registration
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
                {qrFilePath ? 'Replace QR' : 'Upload QR'}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* QR File Section */}
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
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No QR file uploaded yet.</p>
        )}

        {/* Pre-Registration Link Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Registration & Live Feed Link
            </p>
            {isAdmin && !editingLink && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setLinkValue(preRegistrationLink || '');
                  setEditingLink(true);
                }}
              >
                <Pencil className="h-3 w-3 mr-1" />
                {preRegistrationLink ? 'Edit' : 'Add'}
              </Button>
            )}
          </div>

          {editingLink ? (
            <div className="flex gap-2">
              <Input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://eventpixau.mypixhome.com/instant-gallery/..."
                className="text-sm"
              />
              <Button size="sm" onClick={handleSaveLink} disabled={savingLink}>
                {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingLink(false)}>
                Cancel
              </Button>
            </div>
          ) : preRegistrationLink ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <a
                href={preRegistrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate flex-1"
              >
                {preRegistrationLink}
              </a>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => window.open(preRegistrationLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No registration link set.</p>
          )}
        </div>

        {/* Dropbox Link */}
        <LinkField
          label="Dropbox Link"
          icon={<Droplets className="h-3.5 w-3.5" />}
          currentValue={dropboxLink}
          editValue={dropboxValue}
          setEditValue={setDropboxValue}
          editing={editingDropbox}
          setEditing={setEditingDropbox}
          saving={savingDropbox}
          copied={copiedDropbox}
          setCopied={setCopiedDropbox}
          isAdmin={isAdmin}
          placeholder="https://www.dropbox.com/..."
          onSave={() => handleSaveGenericLink('dropbox_link', dropboxValue, setSavingDropbox, setEditingDropbox, 'Dropbox link')}
        />

        {/* SmugMug Link */}
        <LinkField
          label="SmugMug Link"
          icon={<Camera className="h-3.5 w-3.5" />}
          currentValue={smugmugLink}
          editValue={smugmugValue}
          setEditValue={setSmugmugValue}
          editing={editingSmugmug}
          setEditing={setEditingSmugmug}
          saving={savingSmugmug}
          copied={copiedSmugmug}
          setCopied={setCopiedSmugmug}
          isAdmin={isAdmin}
          placeholder="https://www.smugmug.com/..."
          onSave={() => handleSaveGenericLink('smugmug_link', smugmugValue, setSavingSmugmug, setEditingSmugmug, 'SmugMug link')}
        />
      </CardContent>
    </Card>
  );
}

/** Reusable inline link field */
function LinkField({ label, icon, currentValue, editValue, setEditValue, editing, setEditing, saving, copied, setCopied, isAdmin, placeholder, onSave }: {
  label: string;
  icon: React.ReactNode;
  currentValue?: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  saving: boolean;
  copied: boolean;
  setCopied: (v: boolean) => void;
  isAdmin: boolean;
  placeholder: string;
  onSave: () => void;
}) {
  const handleCopy = () => {
    if (!currentValue) return;
    navigator.clipboard.writeText(currentValue);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5">
          {icon}
          {label}
        </p>
        {isAdmin && !editing && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setEditValue(currentValue || '');
              setEditing(true);
            }}
          >
            <Pencil className="h-3 w-3 mr-1" />
            {currentValue ? 'Edit' : 'Add'}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="text-sm"
          />
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : currentValue ? (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          <a
            href={currentValue}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate flex-1"
          >
            {currentValue}
          </a>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(currentValue, '_blank')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No {label.toLowerCase()} set.</p>
      )}
    </div>
  );
}
