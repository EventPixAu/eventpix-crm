import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSkills } from '@/hooks/useStaffCapabilities';
import { 
  useGenerateRecommendations, 
  useApplyAssignmentDraft,
  DraftAssignment,
  RoleRequirement,
  StaffRecommendation,
  EventRecommendation,
} from '@/hooks/useRecommendationEngine';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { 
  Wand2, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Star,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RecommendCrewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventIds: string[];
  scope?: 'single_event' | 'bulk' | 'series';
  seriesDefaults?: RoleRequirement[];
  onApplied?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-red-100 text-red-800 border-red-200',
  };
  
  return (
    <Badge variant="outline" className={colors[confidence]}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
    </Badge>
  );
}

function WarningsList({ warnings }: { warnings: StaffRecommendation['warnings'] }) {
  if (warnings.length === 0) return null;
  
  return (
    <div className="space-y-1 mt-2">
      {warnings.map((warning, idx) => (
        <div 
          key={idx} 
          className={`flex items-center gap-2 text-xs ${
            warning.severity === 'error' ? 'text-destructive' : 'text-yellow-600'
          }`}
        >
          {warning.severity === 'error' ? (
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          )}
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}

function RecommendationCard({ 
  recommendation, 
  isSelected, 
  onToggle 
}: { 
  recommendation: StaffRecommendation; 
  isSelected: boolean;
  onToggle: () => void;
}) {
  const hasErrors = recommendation.warnings.some(w => w.severity === 'error');
  
  return (
    <div 
      className={`border rounded-lg p-3 ${
        hasErrors ? 'border-destructive/50 bg-destructive/5' : 'border-border'
      } ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox 
            checked={isSelected} 
            onCheckedChange={onToggle}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{recommendation.candidate.fullName}</span>
              <Badge variant="secondary" className="text-xs">
                {recommendation.role}
              </Badge>
              <ConfidenceBadge confidence={recommendation.confidence} />
            </div>
            
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {recommendation.rationale.map((r, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
            
            <WarningsList warnings={recommendation.warnings} />
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-semibold">{Math.round(recommendation.score)}</div>
          <div className="text-xs text-muted-foreground">score</div>
        </div>
      </div>
    </div>
  );
}

function EventRecommendationSection({ 
  eventRec,
  selectedRecommendations,
  onToggleRecommendation,
  expanded,
  onToggleExpand,
}: { 
  eventRec: EventRecommendation;
  selectedRecommendations: Set<string>;
  onToggleRecommendation: (eventId: string, userId: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const hasErrors = eventRec.recommendations.some(r => 
    r.warnings.some(w => w.severity === 'error')
  );
  const hasWarnings = eventRec.recommendations.some(r => 
    r.warnings.some(w => w.severity === 'warning')
  );
  
  return (
    <Card className={hasErrors ? 'border-destructive/50' : ''}>
      <CardHeader 
        className="cursor-pointer py-3"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{eventRec.eventName}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(parseISO(eventRec.eventDate + 'T00:00:00'), 'EEE, MMM d')}
              {eventRec.city && (
                <>
                  <MapPin className="h-3.5 w-3.5 ml-2" />
                  {eventRec.city}
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasErrors && <AlertCircle className="h-4 w-4 text-destructive" />}
            {!hasErrors && hasWarnings && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
            <Badge variant="secondary">
              {eventRec.recommendations.length} recommended
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {eventRec.recommendations.map((rec) => (
              <RecommendationCard
                key={`${eventRec.eventId}-${rec.candidate.userId}`}
                recommendation={rec}
                isSelected={selectedRecommendations.has(`${eventRec.eventId}-${rec.candidate.userId}`)}
                onToggle={() => onToggleRecommendation(eventRec.eventId, rec.candidate.userId)}
              />
            ))}
            
            {eventRec.recommendations.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No suitable candidates found for this event
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function RecommendCrewDialog({
  open,
  onOpenChange,
  eventIds,
  scope = 'single_event',
  seriesDefaults,
  onApplied,
}: RecommendCrewDialogProps) {
  const [draft, setDraft] = useState<DraftAssignment | null>(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [roleRequirements, setRoleRequirements] = useState<RoleRequirement[]>(
    seriesDefaults || [{ role: 'Photographer', count: 1 }]
  );
  const [overrideUnavailable, setOverrideUnavailable] = useState(false);
  const [overrideConflicts, setOverrideConflicts] = useState(false);
  const [overrideTight, setOverrideTight] = useState(false);
  
  const { data: skills } = useSkills();
  const generateMutation = useGenerateRecommendations();
  const applyMutation = useApplyAssignmentDraft();
  
  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDraft(null);
      setSelectedRecommendations(new Set());
      setExpandedEvents(new Set());
      setOverrideUnavailable(false);
      setOverrideConflicts(false);
      setOverrideTight(false);
      if (seriesDefaults) {
        setRoleRequirements(seriesDefaults);
      }
    }
  }, [open, seriesDefaults]);
  
  // Auto-expand single event
  useEffect(() => {
    if (draft && draft.eventRecommendations.length === 1) {
      setExpandedEvents(new Set([draft.eventRecommendations[0].eventId]));
    }
  }, [draft]);
  
  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        eventIds,
        roleRequirements,
        scope,
      });
      
      setDraft(result);
      
      // Auto-select all recommendations without errors
      const autoSelected = new Set<string>();
      for (const eventRec of result.eventRecommendations) {
        for (const rec of eventRec.recommendations) {
          const hasError = rec.warnings.some(w => w.severity === 'error');
          if (!hasError) {
            autoSelected.add(`${eventRec.eventId}-${rec.candidate.userId}`);
          }
        }
      }
      setSelectedRecommendations(autoSelected);
      
      // Expand all events
      setExpandedEvents(new Set(result.eventRecommendations.map(e => e.eventId)));
    } catch (error) {
      toast.error('Failed to generate recommendations');
    }
  };
  
  const handleToggleRecommendation = (eventId: string, userId: string) => {
    const key = `${eventId}-${userId}`;
    const newSelected = new Set(selectedRecommendations);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedRecommendations(newSelected);
  };
  
  const handleApply = async () => {
    if (!draft) return;
    
    // Filter draft to only selected recommendations
    const filteredDraft: DraftAssignment = {
      ...draft,
      eventRecommendations: draft.eventRecommendations.map(eventRec => ({
        ...eventRec,
        recommendations: eventRec.recommendations.filter(rec => 
          selectedRecommendations.has(`${eventRec.eventId}-${rec.candidate.userId}`)
        ),
      })).filter(eventRec => eventRec.recommendations.length > 0),
    };
    
    try {
      const result = await applyMutation.mutateAsync({
        draft: filteredDraft,
        overrideWarnings: {
          unavailable: overrideUnavailable,
          conflicts: overrideConflicts,
          tight: overrideTight,
        },
      });
      
      toast.success(`Created ${result.assignmentsCreated} assignments`);
      onApplied?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to apply assignments');
    }
  };
  
  const addRole = () => {
    setRoleRequirements([...roleRequirements, { role: '', count: 1 }]);
  };
  
  const updateRole = (index: number, updates: Partial<RoleRequirement>) => {
    const newRoles = [...roleRequirements];
    newRoles[index] = { ...newRoles[index], ...updates };
    setRoleRequirements(newRoles);
  };
  
  const removeRole = (index: number) => {
    setRoleRequirements(roleRequirements.filter((_, i) => i !== index));
  };
  
  // Count warnings
  const warningCounts = draft ? {
    unavailable: draft.eventRecommendations.flatMap(e => e.recommendations)
      .filter(r => selectedRecommendations.has(`${draft.eventRecommendations.find(er => er.recommendations.includes(r))?.eventId}-${r.candidate.userId}`))
      .filter(r => r.warnings.some(w => w.type === 'unavailable')).length,
    conflicts: draft.eventRecommendations.flatMap(e => e.recommendations)
      .filter(r => selectedRecommendations.has(`${draft.eventRecommendations.find(er => er.recommendations.includes(r))?.eventId}-${r.candidate.userId}`))
      .filter(r => r.warnings.some(w => w.type === 'time_conflict')).length,
    tight: draft.eventRecommendations.flatMap(e => e.recommendations)
      .filter(r => selectedRecommendations.has(`${draft.eventRecommendations.find(er => er.recommendations.includes(r))?.eventId}-${r.candidate.userId}`))
      .filter(r => r.warnings.some(w => w.type === 'tight_changeover')).length,
  } : { unavailable: 0, conflicts: 0, tight: 0 };
  
  const hasRisks = warningCounts.unavailable > 0 || warningCounts.conflicts > 0 || warningCounts.tight > 0;
  const allRisksConfirmed = 
    (warningCounts.unavailable === 0 || overrideUnavailable) &&
    (warningCounts.conflicts === 0 || overrideConflicts) &&
    (warningCounts.tight === 0 || overrideTight);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Recommend Crew
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!draft ? (
            // Configuration view
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Role Requirements</Label>
                <div className="space-y-2 mt-2">
                  {roleRequirements.map((role, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Role name (e.g., Lead Photographer)"
                        value={role.role}
                        onChange={(e) => updateRole(index, { role: e.target.value })}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={role.count}
                        onChange={(e) => updateRole(index, { count: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                      <Select
                        value={role.required_skills?.join(',') || ''}
                        onValueChange={(value) => updateRole(index, { 
                          required_skills: value && value !== 'none' ? value.split(',') : undefined 
                        })}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Skills (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific skills</SelectItem>
                          {skills?.map((skill) => (
                            <SelectItem key={skill.id} value={skill.name}>
                              {skill.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {roleRequirements.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeRole(index)}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addRole}>
                    + Add Role
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <Users className="h-4 w-4 inline mr-1" />
                Generating recommendations for {eventIds.length} event{eventIds.length > 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            // Results view
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3">
                {draft.eventRecommendations.map((eventRec) => (
                  <EventRecommendationSection
                    key={eventRec.eventId}
                    eventRec={eventRec}
                    selectedRecommendations={selectedRecommendations}
                    onToggleRecommendation={handleToggleRecommendation}
                    expanded={expandedEvents.has(eventRec.eventId)}
                    onToggleExpand={() => {
                      const newExpanded = new Set(expandedEvents);
                      if (newExpanded.has(eventRec.eventId)) {
                        newExpanded.delete(eventRec.eventId);
                      } else {
                        newExpanded.add(eventRec.eventId);
                      }
                      setExpandedEvents(newExpanded);
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
          
          {/* Risk confirmations */}
          {draft && hasRisks && (
            <div className="border-t pt-4 space-y-2">
              <Label className="text-sm font-medium text-destructive">
                Confirm Overrides
              </Label>
              
              {warningCounts.unavailable > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="override-unavailable"
                    checked={overrideUnavailable}
                    onCheckedChange={(checked) => setOverrideUnavailable(!!checked)}
                  />
                  <Label htmlFor="override-unavailable" className="text-sm">
                    Override {warningCounts.unavailable} unavailable staff assignment{warningCounts.unavailable > 1 ? 's' : ''}
                  </Label>
                </div>
              )}
              
              {warningCounts.conflicts > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="override-conflicts"
                    checked={overrideConflicts}
                    onCheckedChange={(checked) => setOverrideConflicts(!!checked)}
                  />
                  <Label htmlFor="override-conflicts" className="text-sm">
                    Override {warningCounts.conflicts} time conflict{warningCounts.conflicts > 1 ? 's' : ''}
                  </Label>
                </div>
              )}
              
              {warningCounts.tight > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="override-tight"
                    checked={overrideTight}
                    onCheckedChange={(checked) => setOverrideTight(!!checked)}
                  />
                  <Label htmlFor="override-tight" className="text-sm">
                    Confirm {warningCounts.tight} tight changeover{warningCounts.tight > 1 ? 's' : ''}
                  </Label>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {!draft ? (
            <Button 
              onClick={handleGenerate}
              disabled={generateMutation.isPending || roleRequirements.some(r => !r.role)}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Recommendations
                </>
              )}
            </Button>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={() => setDraft(null)}
              >
                Back to Config
              </Button>
              <Button 
                onClick={handleApply}
                disabled={
                  applyMutation.isPending || 
                  selectedRecommendations.size === 0 ||
                  (hasRisks && !allRisksConfirmed)
                }
              >
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Apply {selectedRecommendations.size} Assignment{selectedRecommendations.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
