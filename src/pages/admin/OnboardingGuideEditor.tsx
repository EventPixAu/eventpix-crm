import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Plus, Trash2, ExternalLink } from 'lucide-react';
import {
  useOnboardingGuideSections,
  useUpsertOnboardingGuideSection,
  useDeleteOnboardingGuideSection,
  type OnboardingGuideSection,
} from '@/hooks/useOnboardingGuideSections';
import { markdownToHtml } from '@/lib/markdown';
import { Link } from 'react-router-dom';

const ICON_OPTIONS = [
  'User', 'Smartphone', 'Calendar', 'Camera', 'CheckSquare',
  'MapPin', 'Clock', 'Bell', 'Shield', 'Wrench', 'FileText', 'Star',
];

type DraftSection = Partial<OnboardingGuideSection>;

export default function OnboardingGuideEditor() {
  const { data: sections = [], isLoading } = useOnboardingGuideSections({ includeInactive: true });
  const upsert = useUpsertOnboardingGuideSection();
  const del = useDeleteOnboardingGuideSection();

  const [editing, setEditing] = useState<DraftSection | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => {
    const nextOrder = sections.length
      ? Math.max(...sections.map(s => s.sort_order)) + 10
      : 10;
    setEditing({
      section_key: '',
      title: '',
      icon: 'User',
      sort_order: nextOrder,
      body_markdown: '',
      is_active: true,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title?.trim() || !editing.section_key?.trim()) return;
    await upsert.mutateAsync(editing);
    setEditing(null);
  };

  const toggleActive = (s: OnboardingGuideSection) => {
    upsert.mutate({ id: s.id, is_active: !s.is_active });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Onboarding Guide Editor"
        description="Edit the content shown on the Team Onboarding Guide at /onboarding."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/onboarding" target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Guide
              </Link>
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              New Section
            </Button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : sections.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
            No sections yet. Click "New Section" to get started.
          </CardContent></Card>
        ) : (
          sections.map((s) => (
            <Card key={s.id}>
              <CardContent className="py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{s.title}</h3>
                    <Badge variant="outline" className="text-xs">{s.section_key}</Badge>
                    <Badge variant="outline" className="text-xs">order {s.sort_order}</Badge>
                    {!s.is_active && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                    {s.body_markdown.slice(0, 200)}{s.body_markdown.length > 200 ? '…' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Section' : 'New Section'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={editing.title ?? ''}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Key (stable id)</Label>
                  <Input
                    value={editing.section_key ?? ''}
                    onChange={(e) => setEditing({ ...editing, section_key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    placeholder="e.g. getting_started"
                  />
                </div>
                <div>
                  <Label>Icon (lucide name)</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editing.icon ?? 'User'}
                    onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  >
                    {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || '0', 10) })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label className="cursor-pointer">Visible on guide</Label>
              </div>

              <div>
                <Label>Content (Markdown)</Label>
                <Tabs defaultValue="edit" className="mt-1">
                  <TabsList>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit">
                    <Textarea
                      value={editing.body_markdown ?? ''}
                      onChange={(e) => setEditing({ ...editing, body_markdown: e.target.value })}
                      rows={18}
                      className="font-mono text-sm"
                      placeholder="### Subheading&#10;Body text. Use **bold**, lists with -, links [text](url)."
                    />
                  </TabsContent>
                  <TabsContent value="preview">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none border rounded-md p-4 bg-muted/30 min-h-[300px]"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(editing.body_markdown ?? '') }}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) await del.mutateAsync(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
