import { useState } from 'react';
import { FileText, Pencil, Check, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

interface EventBriefPanelProps {
  eventId: string;
  briefTemplateId: string | null;
  briefContent: string | null;
  isAdmin: boolean;
}

export function EventBriefPanel({
  eventId,
  briefTemplateId,
  briefContent,
  isAdmin,
}: EventBriefPanelProps) {
  const { data: templates = [] } = useEventBriefTemplates();
  const applyBrief = useApplyBriefToEvent();

  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(briefContent || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(briefTemplateId || '');

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
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-sm">{briefContent}</p>
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
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
