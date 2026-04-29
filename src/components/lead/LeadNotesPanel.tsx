import { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLeadNotes, useAddLeadNote, useDeleteLeadNote } from '@/hooks/useLeadNotes';
import { toast } from 'sonner';

interface LeadNotesPanelProps {
  leadId: string;
}

export function LeadNotesPanel({ leadId }: LeadNotesPanelProps) {
  const { data: notes = [] } = useLeadNotes(leadId);
  const addNote = useAddLeadNote();
  const deleteNote = useDeleteLeadNote();
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    await addNote.mutateAsync({ leadId, content: newNote.trim() });
    setNewNote('');
    setIsAdding(false);
    setIsOpen(true);
    toast.success('Note added');
  };

  const handleDelete = async (noteId: string) => {
    await deleteNote.mutateAsync({ id: noteId, leadId });
    toast.success('Note deleted');
  };

  return (
    <div className="border rounded-lg bg-card">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Notes</span>
          {notes.length > 0 && (
            <Badge variant="secondary" className="text-xs">{notes.length}</Badge>
          )}
        </div>
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
            setIsOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 border-t">
          {isAdding && (
            <div className="pt-3 space-y-2">
              <Textarea
                placeholder="Write a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewNote(''); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={!newNote.trim() || addNote.isPending}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {notes.length === 0 && !isAdding ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          ) : (
            <div className="space-y-2 pt-3">
              {notes.map((note) => (
                <div key={note.id} className="p-3 border rounded-lg bg-muted/30 group">
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), 'dd MMM yyyy, h:mm a')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
