/**
 * SeriesLevelStepsPanel - checklist of workflow steps that apply once to the
 * whole series (e.g. contract, invoice, portal link) instead of to every event.
 */
import { RefreshCw, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Series Steps
          </CardTitle>
          <CardDescription>
            These steps apply once to the whole series and are not repeated on individual events.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {steps.length > 0 && (
            <Badge variant="secondary">
              {completed}/{steps.length} done
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncSteps.mutate(seriesId)}
            disabled={syncSteps.isPending}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', syncSteps.isPending && 'animate-spin')} />
            Refresh from workflows
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No series-level steps yet. Mark steps as “Series-level” in Administration &rarr; Workflows,
            then click “Refresh from workflows”.
          </p>
        ) : (
          PHASE_ORDER.map((phase) => {
            const phaseSteps = steps.filter((s) => s.phase === phase);
            if (phaseSteps.length === 0) return null;
            return (
              <div key={phase}>
                <h4 className={cn('text-sm font-medium mb-3', PHASE_CONFIG[phase].color)}>
                  {PHASE_CONFIG[phase].label}
                </h4>
                <div className="space-y-2">
                  {phaseSteps.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border',
                        step.is_completed ? 'border-primary/40 bg-primary/5' : 'border-border'
                      )}
                    >
                      <Checkbox
                        checked={step.is_completed}
                        onCheckedChange={(checked) =>
                          toggleStep.mutate({ id: step.id, seriesId, isCompleted: !!checked })
                        }
                      />
                      <span
                        className={cn(
                          'flex-1 text-sm',
                          step.is_completed && 'line-through text-muted-foreground'
                        )}
                      >
                        {step.step_label}
                      </span>
                      {step.is_completed && step.completed_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(step.completed_at), 'd MMM yyyy')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
