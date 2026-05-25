/**
 * STAFF WORKFLOW DEFAULTS
 *
 * Lets an admin pick which master workflow steps a given staff member is the
 * default assignee for. Saving toggles `workflow_master_steps.default_assignee_user_id`
 * (sets to this user when checked, clears to NULL when unchecked).
 *
 * Includes a one-click "Apply to existing open events" action that calls the
 * `apply_default_step_assignees` RPC to fill in `assigned_to` on any open,
 * unassigned event workflow steps matching the user's defaults.
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2, Search } from 'lucide-react';
import { useWorkflowMasterSteps, PHASE_CONFIG, type WorkflowMasterStep } from '@/hooks/useWorkflowMasterSteps';

interface Props {
  userId: string;
  fullName: string;
}

export function StaffWorkflowDefaults({ userId, fullName }: Props) {
  const queryClient = useQueryClient();
  const { data: steps = [], isLoading } = useWorkflowMasterSteps();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [dirty, setDirty] = useState(false);

  // Initialise selection from server state whenever steps load
  useEffect(() => {
    if (!steps.length) return;
    const initial = new Set(
      steps.filter((s) => s.default_assignee_user_id === userId).map((s) => s.id)
    );
    setSelected(initial);
    setDirty(false);
  }, [steps, userId]);

  const activeSteps = useMemo(
    () => steps.filter((s) => s.is_active),
    [steps]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return activeSteps;
    return activeSteps.filter((s) => s.label.toLowerCase().includes(q));
  }, [activeSteps, filter]);

  // Group by phase, with editor-related steps surfaced first within phase
  const grouped = useMemo(() => {
    const byPhase: Record<string, WorkflowMasterStep[]> = {
      pre_event: [],
      day_of: [],
      post_event: [],
    };
    for (const s of filtered) byPhase[s.phase]?.push(s);
    const editorRank = (label: string) =>
      /editor|retouch|zno|smp|lba|sbc/i.test(label) ? 0 : 1;
    for (const phase of Object.keys(byPhase)) {
      byPhase[phase].sort((a, b) => {
        const r = editorRank(a.label) - editorRank(b.label);
        return r !== 0 ? r : a.sort_order - b.sort_order;
      });
    }
    return byPhase;
  }, [filtered]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      // Compute additions & removals
      const currentForUser = new Set(
        steps.filter((s) => s.default_assignee_user_id === userId).map((s) => s.id)
      );
      const toAdd = [...selected].filter((id) => !currentForUser.has(id));
      const toRemove = [...currentForUser].filter((id) => !selected.has(id));

      if (toAdd.length) {
        const { error } = await supabase
          .from('workflow_master_steps')
          .update({ default_assignee_user_id: userId, updated_at: new Date().toISOString() })
          .in('id', toAdd);
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from('workflow_master_steps')
          .update({ default_assignee_user_id: null, updated_at: new Date().toISOString() })
          .in('id', toRemove);
        if (error) throw error;
      }
      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: ({ added, removed }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-master-steps'] });
      toast.success(`Saved defaults (+${added} / -${removed})`);
      setDirty(false);
    },
    onError: (err: any) => toast.error(`Save failed: ${err.message}`),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('apply_default_step_assignees', {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (count) => {
      toast.success(
        count
          ? `Assigned ${fullName} to ${count} open ${count === 1 ? 'step' : 'steps'}`
          : 'No matching open unassigned steps found'
      );
    },
    onError: (err: any) => toast.error(`Apply failed: ${err.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          Default workflow assignments
        </CardTitle>
        <CardDescription>
          Steps ticked here auto-assign to {fullName} on every newly-generated event.
          Use “Apply to open events” to retro-fit existing open events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Filter steps (e.g. editor, zno, lba)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Badge variant="outline">{selected.size} selected</Badge>
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || selected.size === 0 || dirty}
            title={dirty ? 'Save first' : 'Assign to all open unassigned matching steps'}
          >
            {apply.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Apply to open events
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading steps…</p>
        ) : (
          <div className="space-y-4">
            {(['pre_event', 'day_of', 'post_event'] as const).map((phase) => {
              const list = grouped[phase] ?? [];
              if (!list.length) return null;
              return (
                <div key={phase} className="space-y-2">
                  <h4 className={`text-xs font-semibold uppercase tracking-wide ${PHASE_CONFIG[phase].color}`}>
                    {PHASE_CONFIG[phase].label}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {list.map((s) => {
                      const ownedByOther =
                        s.default_assignee_user_id &&
                        s.default_assignee_user_id !== userId;
                      return (
                        <label
                          key={s.id}
                          className="flex items-start gap-2 p-2 rounded-md border border-border/50 hover:bg-secondary/40 cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(s.id)}
                            onCheckedChange={() => toggle(s.id)}
                          />
                          <span className="text-sm leading-snug">
                            {s.label}
                            {ownedByOther && !selected.has(s.id) && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                Currently assigned to someone else
                              </Badge>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!filtered.length && (
              <p className="text-sm text-muted-foreground italic">No steps match your filter.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
