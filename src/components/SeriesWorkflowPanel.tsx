 import { useState, useMemo, useEffect } from 'react';
 import { CheckCircle, Circle, Info, Save, RefreshCw } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Badge } from '@/components/ui/badge';
 import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import { Separator } from '@/components/ui/separator';
 import { useActiveWorkflowMasterSteps, PHASE_CONFIG, WorkflowPhase } from '@/hooks/useWorkflowMasterSteps';
 import { useEventSeriesDetail, useUpdateEventSeries, useSeriesEvents } from '@/hooks/useEventSeries';
 import { supabase } from '@/lib/supabase';
 import { toast } from 'sonner';
 import { cn } from '@/lib/utils';
 
 interface SeriesWorkflowPanelProps {
   seriesId: string;
 }
 
 export function SeriesWorkflowPanel({ seriesId }: SeriesWorkflowPanelProps) {
   const { data: series, isLoading: seriesLoading } = useEventSeriesDetail(seriesId);
   const { data: masterSteps = [], isLoading: stepsLoading } = useActiveWorkflowMasterSteps();
   const { data: events = [] } = useSeriesEvents(seriesId);
   const updateSeries = useUpdateEventSeries();
 
   const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
   const [hasChanges, setHasChanges] = useState(false);
   const [isSyncing, setIsSyncing] = useState(false);
 
   // Load existing selections when series data loads
   useEffect(() => {
     if (series) {
       const existingIds = (series as any).default_workflow_step_ids || [];
       setSelectedStepIds(existingIds);
       setHasChanges(false);
     }
   }, [series]);
 
   // Group steps by phase
   const stepsByPhase = useMemo(() => {
     const grouped: Record<WorkflowPhase, typeof masterSteps> = {
       pre_event: [],
       day_of: [],
       post_event: [],
     };
     
     masterSteps.forEach(step => {
       if (grouped[step.phase]) {
         grouped[step.phase].push(step);
       }
     });
     
     return grouped;
   }, [masterSteps]);
 
   const handleToggleStep = (stepId: string) => {
     setSelectedStepIds(prev => {
       const next = prev.includes(stepId)
         ? prev.filter(id => id !== stepId)
         : [...prev, stepId];
       setHasChanges(true);
       return next;
     });
   };
 
   const handleTogglePhase = (phase: WorkflowPhase) => {
     const phaseStepIds = stepsByPhase[phase].map(s => s.id);
     const allSelected = phaseStepIds.every(id => selectedStepIds.includes(id));
     
     setSelectedStepIds(prev => {
       let next: string[];
       if (allSelected) {
         // Deselect all in phase
         next = prev.filter(id => !phaseStepIds.includes(id));
       } else {
         // Select all in phase
         next = [...new Set([...prev, ...phaseStepIds])];
       }
       setHasChanges(true);
       return next;
     });
   };
 
   const handleSelectAll = () => {
     const allIds = masterSteps.map(s => s.id);
     const allSelected = allIds.length === selectedStepIds.length;
     
     if (allSelected) {
       setSelectedStepIds([]);
     } else {
       setSelectedStepIds(allIds);
     }
     setHasChanges(true);
   };
 
   const handleSave = async () => {
     try {
       await updateSeries.mutateAsync({
         id: seriesId,
         default_workflow_step_ids: selectedStepIds.length > 0 ? selectedStepIds : null,
       });
       setHasChanges(false);
       toast.success('Workflow settings saved');
     } catch (error: any) {
       toast.error('Failed to save workflow settings: ' + error.message);
     }
   };
 
   // Get upcoming events that could be synced
   const upcomingEvents = useMemo(() => {
     const today = new Date().toISOString().split('T')[0];
     return events.filter(e => e.event_date >= today);
   }, [events]);
 
   const handleSyncToEvents = async () => {
     if (selectedStepIds.length === 0) {
       toast.error('Please select workflow steps first');
       return;
     }
 
     if (upcomingEvents.length === 0) {
       toast.info('No upcoming events to sync');
       return;
     }
 
     setIsSyncing(true);
     try {
       // Save current selections first
       await updateSeries.mutateAsync({
         id: seriesId,
         default_workflow_step_ids: selectedStepIds,
       });
 
       // Get selected master steps in order
       const selectedSteps = masterSteps
         .filter(s => selectedStepIds.includes(s.id))
         .sort((a, b) => {
           const phaseOrder = { pre_event: 0, day_of: 1, post_event: 2 };
           if (a.phase !== b.phase) {
             return (phaseOrder[a.phase] || 0) - (phaseOrder[b.phase] || 0);
           }
           return a.sort_order - b.sort_order;
         });
 
       let synced = 0;
       let skipped = 0;
 
       for (const event of upcomingEvents) {
         // Check if event already has workflow steps
         const { data: existingSteps } = await supabase
           .from('event_workflow_steps')
           .select('id')
           .eq('event_id', event.id)
           .limit(1);
 
         if (existingSteps && existingSteps.length > 0) {
           skipped++;
           continue;
         }
 
         // Initialize workflow for this event
         const eventDate = new Date(event.event_date);
         const bookingDate = new Date(event.created_at || new Date());
 
         const steps = selectedSteps.map((step, index) => {
           let dueDate: string | null = null;
           
           if (step.date_offset_days !== null && step.date_offset_reference) {
             let referenceDate: Date;
             switch (step.date_offset_reference) {
               case 'job_accepted':
                 referenceDate = bookingDate;
                 break;
               case 'event_date':
                 referenceDate = eventDate;
                 break;
               default:
                 referenceDate = eventDate;
             }
             const calculated = new Date(referenceDate);
             calculated.setDate(calculated.getDate() + step.date_offset_days);
             dueDate = calculated.toISOString().split('T')[0];
           }
           
           return {
             event_id: event.id,
             template_item_id: null,
             step_label: step.label,
             step_order: index + 1,
             completion_type: step.completion_type || 'manual',
             auto_trigger_event: step.auto_trigger_event,
             due_date: dueDate,
             is_completed: false,
             notes: step.help_text,
           };
         });
 
         const { error } = await supabase
           .from('event_workflow_steps')
           .insert(steps);
 
         if (!error) {
           synced++;
         }
       }
 
       setHasChanges(false);
       toast.success(`Synced workflow to ${synced} event(s)${skipped > 0 ? `, ${skipped} already had workflows` : ''}`);
     } catch (error: any) {
       toast.error('Failed to sync workflow: ' + error.message);
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
 
   const allSelected = masterSteps.length > 0 && masterSteps.length === selectedStepIds.length;
 
   return (
     <div className="space-y-6">
       <Alert>
         <Info className="h-4 w-4" />
         <AlertTitle>Series Workflow</AlertTitle>
         <AlertDescription>
           Select the workflow steps that will be initialized for all events in this series.
           Individual events can still modify their workflow after creation.
         </AlertDescription>
       </Alert>
 
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle>Default Workflow Steps</CardTitle>
               <CardDescription>
                 {selectedStepIds.length} of {masterSteps.length} steps selected
               </CardDescription>
             </div>
             <div className="flex gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleSelectAll}
               >
                 {allSelected ? 'Deselect All' : 'Select All'}
               </Button>
               {hasChanges && (
                 <Button size="sm" onClick={handleSave} disabled={updateSeries.isPending}>
                   <Save className="h-4 w-4 mr-2" />
                   Save
                 </Button>
               )}
             </div>
           </div>
         </CardHeader>
         <CardContent>
           <Accordion type="multiple" defaultValue={['pre_event', 'day_of', 'post_event']} className="space-y-2">
             {(Object.keys(PHASE_CONFIG) as WorkflowPhase[]).map(phase => {
               const phaseSteps = stepsByPhase[phase];
               const selectedInPhase = phaseSteps.filter(s => selectedStepIds.includes(s.id)).length;
               const allPhaseSelected = phaseSteps.length > 0 && selectedInPhase === phaseSteps.length;
               
               return (
                 <AccordionItem key={phase} value={phase} className="border rounded-lg px-4">
                   <AccordionTrigger className="hover:no-underline">
                     <div className="flex items-center gap-3">
                       <Checkbox
                         checked={allPhaseSelected}
                         onCheckedChange={() => handleTogglePhase(phase)}
                         onClick={(e) => e.stopPropagation()}
                       />
                       <span className={cn('font-medium', PHASE_CONFIG[phase].color)}>
                         {PHASE_CONFIG[phase].label}
                       </span>
                       <Badge variant="secondary" className="ml-2">
                         {selectedInPhase}/{phaseSteps.length}
                       </Badge>
                     </div>
                   </AccordionTrigger>
                   <AccordionContent>
                     <div className="space-y-2 pt-2">
                       {phaseSteps.length === 0 ? (
                         <p className="text-sm text-muted-foreground py-2">
                           No steps configured for this phase
                         </p>
                       ) : (
                         phaseSteps.map(step => (
                           <div
                             key={step.id}
                             className={cn(
                               'flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer',
                               selectedStepIds.includes(step.id) && 'bg-primary/5'
                             )}
                             onClick={() => handleToggleStep(step.id)}
                           >
                             <Checkbox
                               checked={selectedStepIds.includes(step.id)}
                               onCheckedChange={() => handleToggleStep(step.id)}
                               onClick={(e) => e.stopPropagation()}
                               className="mt-0.5"
                             />
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 {selectedStepIds.includes(step.id) ? (
                                   <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                                 ) : (
                                   <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                                 )}
                                 <span className="text-sm font-medium">{step.label}</span>
                                 {step.completion_type === 'auto' && (
                                   <Badge variant="outline" className="text-xs">Auto</Badge>
                                 )}
                               </div>
                               {step.date_offset_days !== null && step.date_offset_reference && (
                                 <p className="text-xs text-muted-foreground mt-1 ml-6">
                                   {step.date_offset_days >= 0 ? '+' : ''}{step.date_offset_days} days from{' '}
                                   {step.date_offset_reference.replace(/_/g, ' ')}
                                 </p>
                               )}
                               {step.help_text && (
                                 <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1">
                                   {step.help_text}
                                 </p>
                               )}
                             </div>
                           </div>
                         ))
                       )}
                     </div>
                   </AccordionContent>
                 </AccordionItem>
               );
             })}
           </Accordion>
         </CardContent>
       </Card>
 
       <Separator />
 
       <Card>
         <CardHeader>
           <CardTitle className="text-base">Sync to Events</CardTitle>
           <CardDescription>
             Apply the selected workflow to upcoming events in this series that don't yet have a workflow.
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="flex items-center justify-between">
             <div className="text-sm text-muted-foreground">
               {upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''} in this series
             </div>
             <Button
               onClick={handleSyncToEvents}
               disabled={isSyncing || selectedStepIds.length === 0 || upcomingEvents.length === 0}
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