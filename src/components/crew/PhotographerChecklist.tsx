/**
 * PhotographerChecklist - Personal checklist for photographers organized by phase
 * 
 * Phases:
 * - Pre-Event: Tasks before leaving for the event
 * - On the Day: Tasks at the venue
 * - Post-Event: Tasks after the event
 * 
 * This is separate from admin workflows - it's for individual crew tracking.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useMyCrewChecklist,
  useInitializeCrewChecklist,
  useToggleCrewChecklistItem,
  useUpdateCrewChecklistItemNote,
} from '@/hooks/useCrewChecklists';
import { cn } from '@/lib/utils';

interface PhotographerChecklistProps {
  eventId: string;
}

// Phase configuration
const PHASES = [
  {
    key: 'pre_event',
    label: 'Pre-Event',
    description: 'Before leaving for the event',
    defaultOpen: true,
  },
  {
    key: 'on_the_day',
    label: 'On the Day',
    description: 'At the venue',
    defaultOpen: true,
  },
  {
    key: 'post_event',
    label: 'Post-Event',
    description: 'After the event',
    defaultOpen: false,
  },
] as const;

export function PhotographerChecklist({ eventId }: PhotographerChecklistProps) {
  const { data: checklist, isLoading } = useMyCrewChecklist(eventId);
  const initializeChecklist = useInitializeCrewChecklist();
  const toggleItem = useToggleCrewChecklistItem();
  const updateNote = useUpdateCrewChecklistItemNote();

  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    PHASES.forEach((p) => {
      initial[p.key] = p.defaultOpen;
    });
    return initial;
  });
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');

  // Group items by phase (using sort_order to determine phase)
  // Items 0-3: pre_event, 4-7: on_the_day, 8+: post_event
  const itemsByPhase = useMemo(() => {
    if (!checklist?.items) return {};

    const grouped: Record<string, typeof checklist.items> = {
      pre_event: [],
      on_the_day: [],
      post_event: [],
    };

    checklist.items.forEach((item, index) => {
      // Simple phase assignment based on item text keywords or position
      const text = item.item_text.toLowerCase();
      if (
        text.includes('pre-event') ||
        text.includes('battery') ||
        text.includes('format') ||
        text.includes('pack') ||
        text.includes('charge') ||
        text.includes('test') ||
        index < 4
      ) {
        grouped.pre_event.push(item);
      } else if (
        text.includes('post') ||
        text.includes('backup') ||
        text.includes('upload') ||
        text.includes('deliver') ||
        text.includes('return')
      ) {
        grouped.post_event.push(item);
      } else {
        grouped.on_the_day.push(item);
      }
    });

    return grouped;
  }, [checklist?.items]);

  const handleInitialize = () => {
    initializeChecklist.mutate({ eventId });
  };

  const handleToggle = (itemId: string, currentValue: boolean) => {
    toggleItem.mutate({ itemId, isDone: !currentValue, eventId });
  };

  const handleOpenNote = (itemId: string, currentNotes: string | null) => {
    setExpandedItem(itemId);
    setNoteValue(currentNotes || '');
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
            Start your personal checklist to track pre-event, on-the-day, and post-event tasks.
          </p>
          <Button
            onClick={handleInitialize}
            disabled={initializeChecklist.isPending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {initializeChecklist.isPending ? 'Setting up...' : 'Start Checklist'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalItems = checklist.items.length;
  const completedItems = checklist.items.filter((i) => i.is_done).length;
  const allDone = totalItems > 0 && completedItems === totalItems;

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
            className={cn(allDone && 'bg-green-600')}
          >
            {completedItems}/{totalItems}
            {allDone && <CheckCircle className="h-3 w-3 ml-1" />}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PHASES.map((phase) => {
          const phaseItems = itemsByPhase[phase.key] || [];
          if (phaseItems.length === 0) return null;

          const phaseCompleted = phaseItems.filter((i) => i.is_done).length;
          const phaseTotal = phaseItems.length;
          const phaseAllDone = phaseTotal > 0 && phaseCompleted === phaseTotal;

          return (
            <Collapsible
              key={phase.key}
              open={expandedPhases[phase.key]}
              onOpenChange={(open) =>
                setExpandedPhases((prev) => ({ ...prev, [phase.key]: open }))
              }
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{phase.label}</span>
                    <Badge
                      variant={phaseAllDone ? 'default' : 'outline'}
                      className={cn('text-xs', phaseAllDone && 'bg-green-600')}
                    >
                      {phaseCompleted}/{phaseTotal}
                    </Badge>
                  </div>
                  {expandedPhases[phase.key] ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <AnimatePresence>
                  {phaseItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: index * 0.03 }}
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
                            <p
                              className={cn(
                                'text-sm',
                                item.is_done && 'line-through text-muted-foreground'
                              )}
                            >
                              {item.item_text}
                            </p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenNote(item.id, item.notes)}
                            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Note input */}
                        <AnimatePresence>
                          {expandedItem === item.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 pt-3 border-t border-border"
                            >
                              <Textarea
                                placeholder="Add a note..."
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                className="min-h-[60px] text-sm resize-none"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setExpandedItem(null);
                                    setNoteValue('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNote(item.id)}
                                  disabled={updateNote.isPending}
                                >
                                  {updateNote.isPending ? 'Saving...' : 'Save'}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
