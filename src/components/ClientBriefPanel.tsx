import { useState } from 'react';
import { FileText, Pencil, Check, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientBriefPanelProps {
  eventId: string;
  clientBriefContent: string | null;
  isAdmin: boolean;
}

export function ClientBriefPanel({
  eventId,
  clientBriefContent,
  isAdmin,
}: ClientBriefPanelProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(clientBriefContent || '');

  const saveMutation = useMutation({
    mutationFn: async (content: string | null) => {
      const { error } = await supabase
        .from('events')
        .update({ client_brief_content: content })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event brief updated');
    },
    onError: (error) => {
      toast.error('Failed to update brief: ' + error.message);
    },
  });

  const handleSave = async () => {
    await saveMutation.mutateAsync(editContent.trim() || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(clientBriefContent || '');
    setIsEditing(false);
  };

  const handleClear = async () => {
    if (!confirm('Remove the event brief?')) return;
    await saveMutation.mutateAsync(null);
    setEditContent('');
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
                <p className="text-xs text-muted-foreground">Shared with client</p>
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
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No event brief for client</p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Add Brief
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
