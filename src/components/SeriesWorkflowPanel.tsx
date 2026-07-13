import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  useActiveWorkflowMasterSteps,
  useAllEventTypeStepDefaults,
  PHASE_CONFIG,
  WorkflowPhase,
} from '@/hooks/useWorkflowMasterSteps';
import { useAllEditorEventTypeStepDefaults } from '@/hooks/useEditorWorkflowMasterSteps';
import { useAllStaffRoles } from '@/hooks/useAdminStaffRoles';
import { useEventTypes } from '@/hooks/useLookups';
import { useEventSeriesDetail, useUpdateEventSeries, useSeriesEvents } from '@/hooks/useEventSeries';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NONE = '__none__';

const isEditorRoleName = (name?: string | null) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('editor') && !n.includes('admin') && !n.includes('video');
};

interface SeriesWorkflowPanelProps {
  seriesId: string;
}

export function SeriesWorkflowPanel({ seriesId }: SeriesWorkflowPanelProps) {
  const { data: series, isLoading: seriesLoading } = useEventSeriesDetail(seriesId);
  const { data: masterSteps = [], isLoading: stepsLoading } = useActiveWorkflowMasterSteps();
  const { data: adminDefaults = [] } = useAllEventTypeStepDefaults();
  const { data: editorDefaults = [] } = useAllEditorEventTypeStepDefaults();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: staffRoles = [] } = useAllStaffRoles();
  const { data: events = [] } = useSeriesEvents(seriesId);
  const updateSeries = useUpdateEventSeries();
  const queryClient = useQueryClient();

  const [adminEventTypeId, setAdminEventTypeId] = useState<string>(NONE);
  const [editorEventTypeId, setEditorEventTypeId] = useState<string>(NONE);
  const [initialAdmin, setInitialAdmin] = useState<string>(NONE);
  const [initialEditor, setInitialEditor] = useState<string>(NONE);
  const [isSyncing, setIsSyncing] = useState(false);

  const editorRoleIds = useMemo(
    () => new Set(staffRoles.filter((r: any) => isEditorRoleName(r.name)).map((r: any) => r.id)),
    [staffRoles]
  );
  const editorStepIdSet = useMemo(
    () => new Set(masterSteps.filter(s => s.default_staff_role_id && editorRoleIds.has(s.default_staff_role_id)).map(s => s.id)),
    [masterSteps, editorRoleIds]
  );

  // Event types that actually have admin/editor defaults configured
  const adminEventTypeIds = useMemo(() => {
    const s = new Set<string>();
    adminDefaults.forEach(d => {
      // Only count as an "admin workflow" if this default references a non-editor step
      if (!editorStepIdSet.has(d.master_step_id)) s.add(d.event_type_id);
    });
    return s;
  }, [adminDefaults, editorStepIdSet]);

  const editorEventTypeIds = useMemo(() => {
    const s = new Set<string>();
    editorDefaults.forEach(d => s.add(d.event_type_id));
    // Also include event types whose admin defaults reference editor steps (legacy)
    adminDefaults.forEach(d => {
      if (editorStepIdSet.has(d.master_step_id)) s.add(d.event_type_id);
    });
    return s;
  }, [editorDefaults, adminDefaults, editorStepIdSet]);

  // Reverse-derive the selected event type from currently-saved step IDs
  useEffect(() => {
    if (!series || masterSteps.length === 0) return;
    const savedIds: string[] = (series as any).default_workflow_step_ids || [];
    if (savedIds.length === 0) {
      setAdminEventTypeId(NONE);
      setEditorEventTypeId(NONE);
      setInitialAdmin(NONE);
      setInitialEditor(NONE);
      return;
    }

    const savedSet = new Set(savedIds);
    const savedAdmin = savedIds.filter(id => !editorStepIdSet.has(id));
    const savedEditor = savedIds.filter(id => editorStepIdSet.has(id));

    // Find an event type whose admin defaults exactly match savedAdmin
    const matchType = (defaults: typeof adminDefaults, target: string[], filterFn?: (id: string) => boolean) => {
      if (target.length === 0) return NONE;
      const targetSet = new Set(target);
      const grouped = new Map<string, Set<string>>();
      defaults.forEach(d => {
        if (filterFn && !filterFn(d.master_step_id)) return;
        if (!grouped.has(d.event_type_id)) grouped.set(d.event_type_id, new Set());
        grouped.get(d.event_type_id)!.add(d.master_step_id);
      });
      for (const [etId, ids] of grouped) {
        if (ids.size === targetSet.size && [...ids].every(x => targetSet.has(x))) return etId;
      }
      return NONE;
    };

    const admin = matchType(adminDefaults, savedAdmin, (id) => !editorStepIdSet.has(id));
    // Editor could come from editorDefaults OR legacy adminDefaults (editor-role steps)
    let editor = matchType(editorDefaults, savedEditor);
    if (editor === NONE) editor = matchType(adminDefaults, savedEditor, (id) => editorStepIdSet.has(id));

    setAdminEventTypeId(admin);
    setEditorEventTypeId(editor);
    setInitialAdmin(admin);
    setInitialEditor(editor);
  }, [series, masterSteps, adminDefaults, editorDefaults, editorStepIdSet]);

  const resolvedStepIds = useMemo(() => {
    const ids = new Set<string>();
    if (adminEventTypeId !== NONE) {
      adminDefaults
        .filter(d => d.event_type_id === adminEventTypeId && !editorStepIdSet.has(d.master_step_id))
        .forEach(d => ids.add(d.master_step_id));
    }
    if (editorEventTypeId !== NONE) {
      editorDefaults
        .filter(d => d.event_type_id === editorEventTypeId)
        .forEach(d => ids.add(d.master_step_id));
      // Also pull legacy editor-role steps from admin defaults on this event type
      adminDefaults
        .filter(d => d.event_type_id === editorEventTypeId && editorStepIdSet.has(d.master_step_id))
        .forEach(d => ids.add(d.master_step_id));
    }
    // Only keep step IDs that still exist as active master steps
    const activeIds = new Set(masterSteps.map(s => s.id));
    return [...ids].filter(id => activeIds.has(id));
  }, [adminEventTypeId, editorEventTypeId, adminDefaults, editorDefaults, editorStepIdSet, masterSteps]);

  const hasChanges = adminEventTypeId !== initialAdmin || editorEventTypeId !== initialEditor;

  const stepsByPhase = useMemo(() => {
    const grouped: Record<WorkflowPhase, typeof masterSteps> = {
      pre_event: [], day_of: [], post_event: [],
    };
    const idSet = new Set(resolvedStepIds);
    masterSteps.forEach(s => {
      if (idSet.has(s.id) && grouped[s.phase]) grouped[s.phase].push(s);
    });
    return grouped;
  }, [resolvedStepIds, masterSteps]);

  const handleSave = async () => {
    try {
      await updateSeries.mutateAsync({
        id: seriesId,
        default_workflow_step_ids: resolvedStepIds.length > 0 ? resolvedStepIds : null,
      });
      setInitialAdmin(adminEventTypeId);
      setInitialEditor(editorEventTypeId);
      toast.success('Workflow selection saved');
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    }
  };

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => e.event_date >= today);
  }, [events]);

  const handleSyncToEvents = async () => {
    if (resolvedStepIds.length === 0) {
      toast.error('Please select a workflow first');
      return;
    }
    if (upcomingEvents.length === 0) {
      toast.info('No upcoming events to sync');
      return;
    }

    setIsSyncing(true);
    try {
      await updateSeries.mutateAsync({
        id: seriesId,
        default_workflow_step_ids: resolvedStepIds,
      });

      const selectedSteps = masterSteps
        .filter(s => resolvedStepIds.includes(s.id))
        .sort((a, b) => {
          const order = { pre_event: 0, day_of: 1, post_event: 2 };
          if (a.phase !== b.phase) return (order[a.phase] || 0) - (order[b.phase] || 0);
          return a.sort_order - b.sort_order;
        });

      let synced = 0, preserved = 0, failed = 0;

      for (const event of upcomingEvents) {
        const { data: existingSteps } = await supabase
          .from('event_workflow_steps')
          .select('step_label, is_completed, completed_at, completed_by')
          .eq('event_id', event.id);

        const completedByLabel = new Map<string, any>();
        (existingSteps || []).forEach((s: any) => {
          if (s.is_completed) completedByLabel.set(s.step_label, s);
        });

        const eventDate = new Date(event.event_date);
        const bookingDate = new Date(event.created_at || new Date());

        const steps = selectedSteps.map((step, index) => {
          let dueDate: string | null = null;
          if (step.date_offset_days !== null && step.date_offset_reference) {
            const ref =
              step.date_offset_reference === 'job_accepted' ? bookingDate : eventDate;
            const d = new Date(ref);
            d.setDate(d.getDate() + step.date_offset_days);
            dueDate = d.toISOString().split('T')[0];
          }
          const preservedState = completedByLabel.get(step.label);
          if (preservedState) preserved++;
          return {
            event_id: event.id,
            template_item_id: null,
            step_label: step.label,
            step_order: index + 1,
            completion_type: step.completion_type || 'manual',
            auto_trigger_event: step.auto_trigger_event,
            due_date: dueDate,
            is_completed: preservedState?.is_completed ?? false,
            completed_at: preservedState?.completed_at ?? null,
            completed_by: preservedState?.completed_by ?? null,
            notes: step.help_text,
          };
        });

        const { error: delErr } = await supabase
          .from('event_workflow_steps').delete().eq('event_id', event.id);
        if (delErr) { failed++; continue; }

        const { error } = await supabase.from('event_workflow_steps').insert(steps);
        if (!error) synced++; else failed++;
      }

      setInitialAdmin(adminEventTypeId);
      setInitialEditor(editorEventTypeId);
      toast.success(
        `Synced workflow to ${synced} event(s)` +
          (preserved > 0 ? `, preserved ${preserved} completed step(s)` : '') +
          (failed > 0 ? `, ${failed} failed` : '')
      );
    } catch (error: any) {
      toast.error('Failed to sync: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (seriesLoading || stepsLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading workflow configuration...
      </div>
    );
  }

  const eventTypeName = (id: string) => eventTypes.find((et: any) => et.id === id)?.name || 'Unknown';

  const adminOptions = eventTypes.filter((et: any) => adminEventTypeIds.has(et.id));
  const editorOptions = eventTypes.filter((et: any) => editorEventTypeIds.has(et.id));

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Series Workflow</AlertTitle>
        <AlertDescription>
          Choose a pre-existing Admin Workflow and Editor Workflow. All events in this series will
          be initialized with the combined steps.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Selection</CardTitle>
              <CardDescription>
                Pick the workflows configured under Administration → Workflows.
              </CardDescription>
            </div>
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={updateSeries.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Admin Workflow</Label>
              <Select value={adminEventTypeId} onValueChange={setAdminEventTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an admin workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {adminOptions.map((et: any) => (
                    <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {adminOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No admin workflows found. Configure them in Administration → Workflows → Admin Workflows.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Editor Workflow</Label>
              <Select value={editorEventTypeId} onValueChange={setEditorEventTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an editor workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {editorOptions.map((et: any) => (
                    <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editorOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No editor workflows found. Configure them in Administration → Workflows → Editor Workflows.
                </p>
              )}
            </div>
          </div>

          {resolvedStepIds.length > 0 && (
            <div className="pt-2">
              <div className="text-sm font-medium mb-2">
                Preview — {resolvedStepIds.length} step{resolvedStepIds.length !== 1 ? 's' : ''} will be applied
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(PHASE_CONFIG) as WorkflowPhase[]).map(phase => {
                  const list = stepsByPhase[phase];
                  return (
                    <div key={phase} className="border rounded-lg p-3">
                      <div className={cn('text-xs font-semibold mb-2 flex items-center gap-2', PHASE_CONFIG[phase].color)}>
                        {PHASE_CONFIG[phase].label}
                        <Badge variant="secondary" className="text-xs">{list.length}</Badge>
                      </div>
                      {list.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No steps</p>
                      ) : (
                        <ul className="space-y-1">
                          {list.map(s => (
                            <li key={s.id} className="text-xs text-muted-foreground truncate">
                              • {s.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync to Events</CardTitle>
          <CardDescription>
            Apply the selected workflow to upcoming events in this series.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''} in this series
              {(adminEventTypeId !== NONE || editorEventTypeId !== NONE) && (
                <span className="ml-2">
                  · {adminEventTypeId !== NONE && <>Admin: <strong>{eventTypeName(adminEventTypeId)}</strong></>}
                  {adminEventTypeId !== NONE && editorEventTypeId !== NONE && ' · '}
                  {editorEventTypeId !== NONE && <>Editor: <strong>{eventTypeName(editorEventTypeId)}</strong></>}
                </span>
              )}
            </div>
            <Button
              onClick={handleSyncToEvents}
              disabled={isSyncing || resolvedStepIds.length === 0 || upcomingEvents.length === 0}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing...' : 'Sync Workflow to Events'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
