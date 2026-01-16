/**
 * CrewChecklist - Per-staff checklist component
 * 
 * Each crew member manages their own checklist independently.
 * Items can be ticked and notes added.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  CheckCircle, 
  Circle, 
  ClipboardList, 
  MessageSquare,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  useMyCrewChecklist, 
  useInitializeCrewChecklist, 
  useToggleCrewChecklistItem,
  useUpdateCrewChecklistItemNote,
} from '@/hooks/useCrewChecklists';
import { cn } from '@/lib/utils';

interface CrewChecklistProps {
  eventId: string;
}

export function CrewChecklist({ eventId }: CrewChecklistProps) {
  const { data: checklist, isLoading } = useMyCrewChecklist(eventId);
  const initializeChecklist = useInitializeCrewChecklist();
  const toggleItem = useToggleCrewChecklistItem();
  const updateNote = useUpdateCrewChecklistItemNote();
  
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');

  const handleInitialize = () => {
    initializeChecklist.mutate({ eventId });
  };

  const handleToggle = (itemId: string, currentValue: boolean) => {
    toggleItem.mutate({ itemId, isDone: !currentValue, eventId });
  };

  const handleSaveNote = (itemId: string) => {
    updateNote.mutate(
      { itemId, notes: noteValue, eventId },
      {
        onSuccess: () => {
          setExpandedItem(null);
          setNoteValue('');
        },
      }
    );
  };

  const handleOpenNote = (itemId: string, currentNotes: string | null) => {
    setExpandedItem(itemId);
    setNoteValue(currentNotes || '');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No checklist yet - show initialize button
  if (!checklist) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            My Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Initialize your personal checklist for this event
          </p>
          <Button 
            onClick={handleInitialize}
            disabled={initializeChecklist.isPending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {initializeChecklist.isPending ? 'Initializing...' : 'Start Checklist'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const completedCount = checklist.items.filter(i => i.is_done).length;
  const totalCount = checklist.items.length;
  const allDone = completedCount === totalCount && totalCount > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            My Checklist
          </div>
          <Badge 
            variant={allDone ? 'default' : 'secondary'}
            className={cn(allDone && 'bg-green-500')}
          >
            {completedCount}/{totalCount}
            {allDone && <CheckCircle className="h-3 w-3 ml-1" />}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklist.items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div
              className={cn(
                'p-3 rounded-lg border border-border bg-card transition-colors',
                item.is_done && 'bg-muted/50 opacity-70'
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={item.is_done}
                  onCheckedChange={() => handleToggle(item.id, item.is_done)}
                  disabled={toggleItem.isPending}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm',
                    item.is_done && 'line-through text-muted-foreground'
                  )}>
                    {item.item_text}
                  </p>
                  {item.notes && expandedItem !== item.id && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Note: {item.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => 
                    expandedItem === item.id 
                      ? setExpandedItem(null) 
                      : handleOpenNote(item.id, item.notes)
                  }
                  className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
              
              {/* Note input */}
              {expandedItem === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 pt-3 border-t border-border"
                >
                  <Textarea
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    placeholder="Add a note..."
                    className="min-h-[60px] text-sm resize-none mb-2"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedItem(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveNote(item.id)}
                      disabled={updateNote.isPending}
                    >
                      {updateNote.isPending ? 'Saving...' : 'Save Note'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}

        {checklist.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No checklist items
          </p>
        )}
      </CardContent>
    </Card>
  );
}
