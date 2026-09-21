/**
 * SeriesLevelStepsPanel - checklist of workflow steps that apply once to the
 * whole series (e.g. contract, invoice, portal link) instead of to every event.
 *
 * Compact by design: every phase sits on one line with the steps rendered as
 * small chips, each with a tick box in front of its label.
 */
import { RefreshCw, Layers, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PHASE_CONFIG, type WorkflowPhase } from '@/hooks/useWorkflowMasterSteps';
import {
  useSeriesWorkflowSteps,
  useToggleSeriesWorkflowStep,
  useSyncSeriesWorkflowSteps,
} from '@/hooks/useSeriesWorkflowSteps';
import { cn } from '@/lib/utils';

const PHASE_ORDER: WorkflowPhase[] = ['pre_event', 'day_of', 'post_event'];

interface SeriesLevelStepsPanelProps {
  seriesId: string;
}

export function SeriesLevelStepsPanel({ seriesId }: SeriesLevelStepsPanelProps) {
  const { data: steps = [], isLoading } = useSeriesWorkflowSteps(seriesId);
  const toggleStep = useToggleSeriesWorkflowStep();
  const syncSteps = useSyncSeriesWorkflowSteps();

  const completed = steps.filter((s) => s.is_completed).length;

  const toggle = (id: string, isCompleted: boolean) =>
    toggleStep.mutate({ id, seriesId, isCompleted });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" />
              Series Steps
            </CardTitle>
            <CardDescription className="text-xs">
              Applies once to the series &mdash; not repeated on individual events.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {steps.length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {completed}/{steps.length} done
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => syncSteps.mutate(seriesId)}
              disabled={syncSteps.isPending}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 mr-1.5', syncSteps.isPending && 'animate-spin')}
              />
              Refresh from workflows
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No series-level steps yet. Mark steps as &ldquo;Series-level&rdquo; in Administration
            &rarr; Workflows, then click &ldquo;Refresh from workflows&rdquo;.
          </p>
        ) : (
          PHASE_ORDER.map((phase) => {
            const phaseSteps = steps.filter((s) => s.phase === phase);
            if (phaseSteps.length === 0) return null;
            return (
              <div key={phase} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className={cn(
                    'w-[86px] shrink-0 text-[11px] font-semibold uppercase tracking-wider',
                    PHASE_CONFIG[phase].color
                  )}
                >
                  {PHASE_CONFIG[phase].label}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {phaseSteps.map((step) => {
                    const done = step.is_completed;
                    return (
                      <div
                        key={step.id}
                        role="checkbox"
                        aria-checked={done}
                        tabIndex={0}
                        title={
                          done && step.completed_at
                            ? `Completed ${format(new Date(step.completed_at), 'd MMM yyyy')}`
                            : 'Mark as done'
                        }
                        onClick={() => toggle(step.id, !done)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            toggle(step.id, !done);
                          }
                        }}
                        className={cn(
                          'group inline-flex cursor-pointer select-none items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          done
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/70'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                            done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background group-hover:border-primary/60'
                          )}
                        >
                          {done && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span
                          className={cn(
                            'whitespace-nowrap',
                            done && 'text-muted-foreground line-through'
                          )}
                        >
                          {step.step_label}
                        </span>
                        {done && step.completed_at && (
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {format(new Date(step.completed_at), 'd MMM')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
