/**
 * CrewChecklistsPanel - Consolidated crew checklist management for an event.
 *
 * Shows one row per unique assigned person (deduped across sessions),
 * with inline template picker, progress badge, and expandable items.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  ListChecks,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useEventCrewChecklists,
  useCrewChecklistTemplates,
  useToggleCrewChecklistItem,
  useDeleteCrewChecklistItem,
  useDeleteCrewChecklist,
} from '@/hooks/useCrewChecklists';
import { useCreateCrewChecklistFromTemplate } from '@/hooks/useCreateCrewChecklistFromTemplate';
import { useSyncCrewChecklistFromTemplate } from '@/hooks/useSyncCrewChecklistFromTemplate';
import type { EventAssignment } from '@/hooks/useEvents';
import { cn } from '@/lib/utils';

interface CrewChecklistsPanelProps {
  eventId: string;
  assignments: EventAssignment[];
}

interface CrewPerson {
  userId: string;
  name: string;
  role: string;
  initials: string;
}

function dedupeCrew(assignments: EventAssignment[]): CrewPerson[] {
  const map = new Map<string, CrewPerson>();
  for (const a of assignments) {
    const userId = a.user_id || (a.staff as any)?.user_id;
    if (!userId) continue;
    if (map.has(userId)) continue;
    const name =
      (a as any).profile?.full_name ||
      (a.staff as any)?.name ||
      'Unknown';
    const role =
      (a as any).staff_role?.name || a.role_on_event || 'Crew';
    const initials = name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    map.set(userId, { userId, name, role, initials });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function CrewChecklistsPanel({ eventId, assignments }: CrewChecklistsPanelProps) {
  const crew = useMemo(() => dedupeCrew(assignments), [assignments]);
  const { data: checklists = [] } = useEventCrewChecklists(eventId);
  const { data: templates = [] } = useCrewChecklistTemplates();

  if (crew.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-display font-semibold">Crew Checklists</h2>
          <Badge variant="outline" className="text-xs">
            {checklists.length}/{crew.length} created
          </Badge>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/workflows?tab=crew-checklists">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Templates
          </Link>
        </Button>
      </div>

      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {crew.map((person) => (
          <CrewChecklistRow
            key={person.userId}
            person={person}
            eventId={eventId}
            checklist={checklists.find((c) => c.user_id === person.userId)}
            templates={templates.filter((t) => t.is_active)}
          />
        ))}
      </div>
    </div>
  );
}

interface CrewChecklistRowProps {
  person: CrewPerson;
  eventId: string;
  checklist: ReturnType<typeof useEventCrewChecklists>['data'] extends Array<infer T> ? T : never;
  templates: ReturnType<typeof useCrewChecklistTemplates>['data'];
}

function CrewChecklistRow({ person, eventId, checklist, templates = [] }: CrewChecklistRowProps) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const createChecklist = useCreateCrewChecklistFromTemplate();
  const deleteChecklist = useDeleteCrewChecklist();
  const syncChecklist = useSyncCrewChecklistFromTemplate();
  const toggleItem = useToggleCrewChecklistItem();
  const deleteItem = useDeleteCrewChecklistItem();

  const completedCount = checklist?.items.filter((i) => i.is_done).length ?? 0;
  const totalCount = checklist?.items.length ?? 0;
  const currentTemplateName = checklist?.template_id
    ? templates.find((t) => t.id === checklist.template_id)?.name
    : null;

  const handleCreate = async () => {
    if (!selectedTemplateId) return;
    await createChecklist.mutateAsync({
      eventId,
      userId: person.userId,
      templateId: selectedTemplateId,
    });
    setSelectedTemplateId('');
    setChanging(false);
    setOpen(true);
  };

  const handleReplace = async () => {
    if (!selectedTemplateId) return;
    await deleteChecklist.mutateAsync({ eventId, userId: person.userId });
    await createChecklist.mutateAsync({
      eventId,
      userId: person.userId,
      templateId: selectedTemplateId,
    });
    setSelectedTemplateId('');
    setChanging(false);
  };

  const isLoading = createChecklist.isPending || deleteChecklist.isPending;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="bg-background/30">
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{person.initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{person.name}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground truncate">{person.role}</span>
          </div>
          {checklist ? (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {currentTemplateName || 'Custom checklist'}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-0.5">No checklist assigned</div>
          )}
        </div>

        {checklist ? (
          <>
            <Badge
              variant={allDone ? 'default' : 'secondary'}
              className={cn('text-xs', allDone && 'bg-emerald-600 hover:bg-emerald-600')}
            >
              {completedCount}/{totalCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              className="h-8"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 min-w-[280px]">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.name}
                    <span className="text-muted-foreground ml-1">({t.items.length})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreate}
              disabled={isLoading || !selectedTemplateId}
              className="h-8"
            >
              Assign
            </Button>
          </div>
        )}
      </div>

      {open && checklist && (
        <div className="px-3 pb-3 pl-14 space-y-3">
          {changing ? (
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Pick replacement template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                      <span className="text-muted-foreground ml-1">({t.items.length})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReplace}
                disabled={isLoading || !selectedTemplateId}
                className="h-8"
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setChanging(false);
                  setSelectedTemplateId('');
                }}
                className="h-8"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setChanging(true)}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Change template
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  deleteChecklist.mutate({ eventId, userId: person.userId })
                }
                disabled={isLoading}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            {checklist.items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No items</p>
            ) : (
              checklist.items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 py-1 group">
                  <Checkbox
                    id={`crew-item-${item.id}`}
                    checked={item.is_done}
                    onCheckedChange={() =>
                      toggleItem.mutate({
                        itemId: item.id,
                        isDone: !item.is_done,
                        eventId,
                      })
                    }
                    disabled={toggleItem.isPending}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`crew-item-${item.id}`}
                    className={cn(
                      'text-xs cursor-pointer flex-1',
                      item.is_done && 'line-through text-muted-foreground'
                    )}
                  >
                    {item.item_text}
                  </label>
                  <button
                    onClick={() => deleteItem.mutate({ itemId: item.id, eventId })}
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
        </div>
      )}
    </div>
  );
}
