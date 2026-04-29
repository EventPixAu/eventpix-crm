import { useState, useRef } from 'react';
import { FileText, Pencil, Check, X, ChevronDown, Download, Upload, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useEventBriefTemplates,
  useApplyBriefToEvent,
} from '@/hooks/useEventBriefTemplates';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EventBriefPanelProps {
  eventId: string;
  briefTemplateId: string | null;
  briefContent: string | null;
  briefFileName?: string | null;
  briefFilePath?: string | null;
  isAdmin: boolean;
}

export function EventBriefPanel({
  eventId,
  briefTemplateId,
  briefContent,
  briefFileName,
  briefFilePath,
  isAdmin,
}: EventBriefPanelProps) {
  const queryClient = useQueryClient();
  const { data: templates = [] } = useEventBriefTemplates();
  const applyBrief = useApplyBriefToEvent();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(briefContent || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(briefTemplateId || '');
  const [isUploading, setIsUploading] = useState(false);

  const currentTemplate = templates.find((t) => t.id === briefTemplateId);

  const handleTemplateChange = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    setEditContent(template.content);

    await applyBrief.mutateAsync({
      eventId,
      templateId: template.id,
      content: template.content,
    });
  };

  const handleSaveEdit = async () => {
    await applyBrief.mutateAsync({
      eventId,
      templateId: selectedTemplateId || null,
      content: editContent.trim() || null,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(briefContent || '');
    setIsEditing(false);
  };

  const handleClearBrief = async () => {
    if (!confirm('Remove the brief from this event?')) return;

    await applyBrief.mutateAsync({
      eventId,
      templateId: null,
      content: null,
    });
    setSelectedTemplateId('');
    setEditContent('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `team-briefs/${eventId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('event-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('events')
        .update({
          brief_file_name: file.name,
          brief_file_path: filePath,
        } as any)
        .eq('id', eventId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Brief document uploaded');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadFile = async () => {
    if (!briefFilePath) return;
    const { data } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(briefFilePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleRemoveFile = async () => {
    if (!briefFilePath || !confirm('Remove the uploaded document?')) return;

    try {
      await supabase.storage.from('event-documents').remove([briefFilePath]);
      const { error } = await supabase
        .from('events')
        .update({
          brief_file_name: null,
          brief_file_path: null,
        } as any)
        .eq('id', eventId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Document removed');
    } catch (err: any) {
      toast.error('Failed to remove document: ' + err.message);
    }
  };

  const hasContent = briefContent?.trim();

  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold">Team Brief</h2>
                {currentTemplate && (
                  <p className="text-sm text-muted-foreground">
                    {currentTemplate.name}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border pt-4">
            {isAdmin && !isEditing && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1">
                  <Select
                    value={selectedTemplateId}
                    onValueChange={handleTemplateChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a brief template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            )}

            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  placeholder="Enter brief content..."
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleClearBrief}
                  >
                    Remove Brief
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : hasContent ? (
              <div className="space-y-3">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm">{briefContent}</p>
                </div>
                {currentTemplate?.pdf_file_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { data } = await supabase.storage
                        .from('brief-template-files')
                        .createSignedUrl(currentTemplate.pdf_file_path!, 3600);
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {currentTemplate.pdf_file_name || 'Download PDF'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No brief assigned</p>
                {isAdmin && templates.length > 0 && (
                  <p className="text-xs mt-1">
                    Select a template above to add a brief
                  </p>
                )}
              </div>
            )}

            {/* Uploaded document section */}
            {isAdmin && (
              <div className="mt-4 pt-3 border-t border-border">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                />
                {briefFilePath ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                    <button
                      onClick={handleDownloadFile}
                      className="flex items-center gap-2 text-sm text-primary hover:underline truncate min-w-0"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="truncate">{briefFileName || 'Document'}</span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        title="Replace document"
                      >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={handleRemoveFile}
                        title="Remove document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload Brief Document
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
