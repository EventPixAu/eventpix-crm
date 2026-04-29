/**
 * CLIENT NOTES PANEL
 * 
 * Studio Ninja-style collapsible notes panel with add, edit, and delete
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Plus, ChevronDown, ChevronRight, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientNote {
  id: string;
  note: string;
  created_at: string | null;
  created_by?: string | null;
}

interface ClientNotesPanelProps {
  clientId: string;
  notes: ClientNote[];
}

export function ClientNotesPanel({ clientId, notes }: ClientNotesPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          note: newNote.trim(),
        });
      
      if (error) throw error;
      
      setNewNote('');
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success('Note added');
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (note: ClientNote) => {
    setEditingId(note.id);
    setEditingText(note.note);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_notes')
        .update({ note: editingText.trim() })
        .eq('id', editingId);
      
      if (error) throw error;
      
      setEditingId(null);
      setEditingText('');
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success('Note updated');
    } catch (error) {
      toast.error('Failed to update note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', deleteId);
      
      if (error) throw error;
      
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <StickyNote className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Client Notes</CardTitle>
                </button>
              </CollapsibleTrigger>
              <Button 
                size="icon" 
                className="h-7 w-7 rounded-full bg-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdding(true);
                  setIsOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {/* Add Note Form */}
              {isAdding && (
                <div className="space-y-2 pb-3 border-b">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setIsAdding(false);
                        setNewNote('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Notes List */}
              {notes.length === 0 && !isAdding ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notes yet
                </p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="p-3 border rounded-lg bg-muted/30 group">
                    {editingId === note.id ? (
                      // Edit mode
                      <div className="space-y-2">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={!editingText.trim() || isSaving}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm whitespace-pre-wrap flex-1">{note.note}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleStartEdit(note)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(note.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {note.created_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
