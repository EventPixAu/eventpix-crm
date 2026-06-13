/**
 * CONTACT NOTES PANEL
 * Multi-note timestamped history with author attribution.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useContactNotes, useCreateContactNote, useUpdateContactNote, useDeleteContactNote } from '@/hooks/useContactNotes';

export function ContactNotesPanel({ contactId }: { contactId: string }) {
  const { data: notes = [], isLoading } = useContactNotes(contactId);
  const createNote = useCreateContactNote();
  const updateNote = useUpdateContactNote();
  const deleteNote = useDeleteContactNote();

  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    await createNote.mutateAsync({ contact_id: contactId, note: newNote.trim() });
    setNewNote('');
    setIsAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    await updateNote.mutateAsync({ id: editingId, note: editingText.trim(), contact_id: contactId });
    setEditingId(null);
    setEditingText('');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-muted-foreground" />
              Notes
              <Badge variant="secondary">{notes.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdding && (
            <div className="space-y-2 pb-3 border-b">
              <Textarea placeholder="Add a note…" value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} autoFocus />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setIsAdding(false); setNewNote(''); }}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={!newNote.trim() || createNote.isPending}>
                  {createNote.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : notes.length === 0 && !isAdding ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="p-3 border rounded-lg bg-muted/30 group">
                {editingId === n.id ? (
                  <div className="space-y-2">
                    <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} autoFocus />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditingText(''); }}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={!editingText.trim() || updateNote.isPending}>
                        <Check className="h-4 w-4 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{n.note}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditingId(n.id); setEditingText(n.note); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(n.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {n.author?.full_name || n.author?.email || 'Unknown user'}
                      {' · '}
                      {format(new Date(n.created_at), 'MMM d, yyyy h:mm a')}
                      {n.updated_at && n.updated_at !== n.created_at && ' · edited'}
                    </p>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (deleteId) { await deleteNote.mutateAsync({ id: deleteId, contact_id: contactId }); setDeleteId(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
