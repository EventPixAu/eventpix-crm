/**
 * CLIENT NOTES PANEL
 * 
 * Studio Ninja-style collapsible notes panel with add button
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
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

  return (
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
                <div key={note.id} className="p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  {note.created_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
