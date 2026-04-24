import { useState, useRef } from 'react';
import { FileText, Pencil, Check, X, ChevronDown, Sparkles, Loader2, Upload, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEventBriefTemplates } from '@/hooks/useEventBriefTemplates';
import { useApplyClientBriefToEvent } from '@/hooks/useClientBriefTemplates';

interface ClientBriefPanelProps {
  eventId: string;
  clientBriefContent: string | null;
  clientBriefTemplateId?: string | null;
  clientBriefFileName?: string | null;
  clientBriefFilePath?: string | null;
  isAdmin: boolean;
}

export function ClientBriefPanel({
  eventId,
  clientBriefContent,
  clientBriefTemplateId,
  clientBriefFileName,
  clientBriefFilePath,
  isAdmin,
}: ClientBriefPanelProps) {
  const queryClient = useQueryClient();
  const { data: templates = [] } = useClientBriefTemplates();
  const applyBrief = useApplyClientBriefToEvent();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(clientBriefContent || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(clientBriefTemplateId || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const currentTemplate = templates.find((t) => t.id === clientBriefTemplateId);

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

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-client-brief`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ eventId }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate brief');
      }

      const data = await response.json();
      setEditContent(data.content);
      setIsEditing(true);
      toast.success('AI brief generated — review and save');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate brief');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    await applyBrief.mutateAsync({
      eventId,
      templateId: selectedTemplateId || null,
      content: editContent.trim() || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(clientBriefContent || '');
    setIsEditing(false);
  };

  const handleClear = async () => {
    if (!confirm('Remove the event brief?')) return;
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
      const filePath = `client-briefs/${eventId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('event-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('events')
        .update({
          client_brief_file_name: file.name,
          client_brief_file_path: filePath,
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
    if (!clientBriefFilePath) return;
    const { data } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(clientBriefFilePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleRemoveFile = async () => {
    if (!clientBriefFilePath || !confirm('Remove the uploaded document?')) return;

    try {
      await supabase.storage.from('event-documents').remove([clientBriefFilePath]);
      const { error } = await supabase
        .from('events')
        .update({
          client_brief_file_name: null,
          client_brief_file_path: null,
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

  const hasContent = clientBriefContent?.trim();

  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold">Event Brief</h2>
                <p className="text-xs text-muted-foreground">
                  {currentTemplate ? currentTemplate.name : 'Shared with client'}
                </p>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                  title="Generate brief from event data using AI"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
                {hasContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
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
                  placeholder="Enter event brief for the client..."
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleClear}
                  >
                    Remove Brief
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      <Check className="h-4 w-4 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : hasContent ? (
              <div className="space-y-3">
                <p className="whitespace-pre-wrap text-sm">{clientBriefContent}</p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            ) : clientBriefFilePath ? null : (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No event brief for client</p>
                {isAdmin && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Write Manually
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAI}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      Generate with AI
                    </Button>
                  </div>
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
                {clientBriefFilePath ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                    <button
                      onClick={handleDownloadFile}
                      className="flex items-center gap-2 text-sm text-primary hover:underline truncate min-w-0"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="truncate">{clientBriefFileName || 'Document'}</span>
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
