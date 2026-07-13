/**
 * ProposedServicesEditor
 *
 * Reusable Scope-of-Services (Proposed Services) HTML editor.
 * - Rich-text-style contentEditable surface (sanitised on render)
 * - "Generate with AI" button → calls `generate-proposed-services` edge function
 * - Save persists to either `events.proposed_services` or `quotes.proposed_services`
 * - On quotes, supports an "override / use event default" toggle
 */
import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Sparkles, Save, Eye, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ProposedServicesEditorProps {
  target: 'event' | 'quote';
  targetId: string;
  /** Current saved HTML value */
  value: string | null | undefined;
  /** Event-level default to fall back to when target='quote' has no override */
  eventFallback?: string | null;
  /** Optional event id for AI context when editing a quote (auto-passed via quote_id) */
  eventIdForAi?: string | null;
  /** Invalidate keys after save */
  invalidateKeys?: string[][];
  /** Hide the AI button (e.g. read-only contexts) */
  disableAi?: boolean;
  className?: string;
}

export function ProposedServicesEditor({
  target,
  targetId,
  value,
  eventFallback,
  eventIdForAi,
  invalidateKeys = [],
  disableAi = false,
  className,
}: ProposedServicesEditorProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string>(value || '');
  const [mode, setMode] = useState<'preview' | 'html'>('preview');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value || '');
  }, [value, targetId]);

  const dirty = (draft || '') !== (value || '');
  const usingFallback = target === 'quote' && !draft && !!eventFallback;
  const displayHtml = draft || (target === 'quote' ? (eventFallback || '') : '');

  const handleSave = async () => {
    setSaving(true);
    try {
      const table = target === 'event' ? 'events' : 'quotes';
      const { error } = await supabase
        .from(table)
        .update({ proposed_services: draft || null })
        .eq('id', targetId);
      if (error) throw error;
      toast.success('Proposed services saved');
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e: any) {
      toast.error('Failed to save', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payload: Record<string, unknown> = {};
      if (target === 'quote') payload.quote_id = targetId;
      else payload.event_id = targetId;
      if (target === 'quote' && eventIdForAi) payload.event_id = eventIdForAi;

      const { data, error } = await supabase.functions.invoke('generate-proposed-services', {
        body: payload,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const html: string = (data as any)?.html || '';
      if (!html) throw new Error('AI returned an empty response');
      setDraft(html);
      setMode('preview');
      toast.success('Draft generated — review and save');
    } catch (e: any) {
      toast.error('AI generation failed', { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevertToEventDefault = () => {
    setDraft('');
    toast.info('Reverted to event default — click Save to persist');
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Proposed Services
              {usingFallback && <Badge variant="secondary" className="text-xs">Using event default</Badge>}
              {target === 'quote' && draft && <Badge variant="outline" className="text-xs">Quote override</Badge>}
            </CardTitle>
            <CardDescription>
              {target === 'event'
                ? 'Default description of services we will provide for this event. Used in budgets and contracts.'
                : 'Override the event-level description for this quote. Leave blank to inherit the event default.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!disableAi && (
              <Button type="button" size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {generating ? 'Generating…' : 'Generate with AI'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMode(mode === 'preview' ? 'html' : 'preview')}
            >
              {mode === 'preview' ? <Pencil className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              {mode === 'preview' ? 'Edit HTML' : 'Preview'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'preview' ? (
          <div
            ref={editableRef}
            className="border rounded-md p-3 bg-background text-foreground min-h-[140px] max-h-[400px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-sm focus:outline-none focus:ring-2 focus:ring-ring [&_*]:text-foreground"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setDraft(e.currentTarget.innerHTML)}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(displayHtml || '<p class="text-muted-foreground">No description yet. Click <em>Generate with AI</em> or start typing here…</p>'),
            }}
          />
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-xs min-h-[200px]"
            placeholder="<p>Describe the services you will provide…</p>"
          />
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Tip: click in the box above to edit directly. Saved HTML appears on the budget PDF and is auto-inserted into generated contracts.
          </div>
          <div className="flex items-center gap-2">
            {target === 'quote' && draft && (
              <Button type="button" size="sm" variant="ghost" onClick={handleRevertToEventDefault}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Use event default
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
