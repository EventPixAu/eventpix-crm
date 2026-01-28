/**
 * AssignmentChecklistPanel - Admin UI to view/edit crew checklist for a specific assignment
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  useEventCrewChecklists, 
  useToggleCrewChecklistItem,
  useCreateCrewChecklistForUser,
  useDeleteCrewChecklistItem,
} from '@/hooks/useCrewChecklists';
import type { EventAssignment } from '@/hooks/useEvents';

interface AssignmentChecklistPanelProps {
  eventId: string;
  assignment: EventAssignment;
}

export function AssignmentChecklistPanel({ eventId, assignment }: AssignmentChecklistPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: checklists = [] } = useEventCrewChecklists(eventId);
  const toggleItem = useToggleCrewChecklistItem();
  const createChecklist = useCreateCrewChecklistForUser();
  const deleteItem = useDeleteCrewChecklistItem();
  
  // Find checklist for this assignment's user
  const userId = assignment.user_id || (assignment.staff as any)?.user_id;
  const checklist = checklists.find(c => c.user_id === userId);
  
  const completedCount = checklist?.items.filter(i => i.is_done).length || 0;
  const totalCount = checklist?.items.length || 0;

  const handleCreateChecklist = async () => {
    if (!userId) return;
    
    console.log('Creating checklist for assignment:', {
      eventId,
      userId,
      staffRoleId: assignment.staff_role_id,
      assignmentId: assignment.id,
    });
    
    await createChecklist.mutateAsync({
      eventId,
      userId,
      staffRoleId: assignment.staff_role_id || undefined,
    });
  };

  const handleToggleItem = async (itemId: string, currentState: boolean) => {
    await toggleItem.mutateAsync({
      itemId,
      isDone: !currentState,
      eventId,
    });
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem.mutateAsync({
      itemId,
      eventId,
    });
  };

  // Can't create checklist without a linked user
  if (!userId) {
    return (
      <div className="mt-2 text-xs text-muted-foreground italic">
        Checklist unavailable (no linked account)
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between mt-2 h-8 px-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" />
            <span className="text-xs">Checklist</span>
          </div>
          <div className="flex items-center gap-2">
            {checklist ? (
              <Badge variant={completedCount === totalCount && totalCount > 0 ? "default" : "secondary"} className="text-xs">
                {completedCount}/{totalCount}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Not created</Badge>
            )}
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        {!checklist ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">No checklist for this assignment</p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleCreateChecklist}
              disabled={createChecklist.isPending}
            >
              Create Checklist
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5 pl-2">
            {checklist.items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No checklist items</p>
            ) : (
              checklist.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 py-1 group"
                >
                  <Checkbox
                    id={item.id}
                    checked={item.is_done}
                    onCheckedChange={() => handleToggleItem(item.id, item.is_done)}
                    disabled={toggleItem.isPending}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={item.id}
                    className={`text-xs cursor-pointer flex-1 ${
                      item.is_done ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.item_text}
                  </label>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={deleteItem.isPending}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Remove item"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}