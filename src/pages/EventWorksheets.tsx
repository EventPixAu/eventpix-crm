import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  ClipboardList,
  Plus,
  Trash2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { useEvent } from '@/hooks/useEvents';
import {
  useEventWorksheets,
  useAllWorksheetItems,
  useWorkflowTemplates,
  useUpdateWorksheetItem,
  useCreateWorksheetFromTemplate,
  useDeleteWorksheet,
} from '@/hooks/useWorksheets';
import { toast } from 'sonner';

const phases = [
  { key: 'pre_event', label: 'Pre-Event', color: 'text-info', bgColor: 'bg-info/10' },
  { key: 'day_of', label: 'Day Of', color: 'text-warning', bgColor: 'bg-warning/10' },
  { key: 'post_event', label: 'Post-Event', color: 'text-success', bgColor: 'bg-success/10' },
] as const;

export default function EventWorksheets() {
  const { id: eventId } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: worksheets = [], isLoading: worksheetsLoading } = useEventWorksheets(eventId);
  const { data: allItems = [] } = useAllWorksheetItems(worksheets.map(w => w.id));
  const { data: templates = [] } = useWorkflowTemplates();
  
  const updateItem = useUpdateWorksheetItem();
  const createWorksheet = useCreateWorksheetFromTemplate();
  const deleteWorksheet = useDeleteWorksheet();

  const handleToggleItem = async (itemId: string, currentIsDone: boolean) => {
    const newIsDone = !currentIsDone;
    try {
      await updateItem.mutateAsync({
        itemId,
        isDone: newIsDone,
        doneBy: user?.id,
      });
      toast.success(newIsDone ? 'Task completed!' : 'Task marked as pending');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleAddWorksheet = async (templateId: string) => {
    if (!eventId) return;
    try {
      await createWorksheet.mutateAsync({ eventId, templateId });
      toast.success('Worksheet added!');
      setAddDialogOpen(false);
    } catch (error) {
      toast.error('Failed to add worksheet');
    }
  };

  const handleDeleteWorksheet = async (worksheetId: string) => {
    try {
      await deleteWorksheet.mutateAsync(worksheetId);
      toast.success('Worksheet deleted');
    } catch (error) {
      toast.error('Failed to delete worksheet');
    }
  };

  const getItemsForWorksheet = (worksheetId: string) => {
    return allItems.filter(item => item.worksheet_id === worksheetId);
  };

  const getProgress = (worksheetId: string) => {
    const items = getItemsForWorksheet(worksheetId);
    if (items.length === 0) return 0;
    const completed = items.filter(i => i.is_done).length;
    return Math.round((completed / items.length) * 100);
  };

  const existingTemplateIds = worksheets.map(w => w.template_id);
  const availableTemplates = templates.filter(t => !existingTemplateIds.includes(t.id));

  if (eventLoading || worksheetsLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Event not found</p>
          <Link to="/events">
            <Button variant="outline" className="mt-4">Back to Events</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Link>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">
            Worksheets
          </h1>
          <p className="text-muted-foreground">{event.event_name}</p>
        </div>
        
        {isAdmin && availableTemplates.length > 0 && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Worksheet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Worksheet from Template</DialogTitle>
                <DialogDescription>
                  Choose a workflow template to create a worksheet for this event.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-4">
                {availableTemplates.map(template => {
                  const phase = phases.find(p => p.key === template.phase);
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleAddWorksheet(template.id)}
                      className="w-full p-4 text-left bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 ${phase?.bgColor} rounded-lg`}>
                          <ClipboardList className={`h-4 w-4 ${phase?.color}`} />
                        </div>
                        <div>
                          <p className="font-medium">{template.template_name}</p>
                          <p className={`text-sm ${phase?.color}`}>{phase?.label}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {worksheets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No worksheets for this event yet</p>
          {isAdmin && availableTemplates.length > 0 && (
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Worksheet
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {phases.map(phase => {
            const phaseWorksheets = worksheets.filter(w => w.phase === phase.key);
            if (phaseWorksheets.length === 0) return null;

            return (
              <div key={phase.key}>
                <h2 className={`text-lg font-display font-semibold mb-4 ${phase.color}`}>
                  {phase.label}
                </h2>
                <div className="space-y-4">
                  {phaseWorksheets.map(worksheet => {
                    const items = getItemsForWorksheet(worksheet.id);
                    const progress = getProgress(worksheet.id);

                    return (
                      <motion.div
                        key={worksheet.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-xl p-5 shadow-card"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${phase.bgColor} rounded-lg`}>
                              <ClipboardList className={`h-5 w-5 ${phase.color}`} />
                            </div>
                            <div>
                              <h3 className="font-medium">{worksheet.template_name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {items.filter(i => i.is_done).length} of {items.length} completed
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-2xl font-bold">{progress}%</span>
                            </div>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Worksheet</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will delete this worksheet and all its items. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteWorksheet(worksheet.id)}
                                      disabled={deleteWorksheet.isPending}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      {deleteWorksheet.isPending ? 'Deleting...' : 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-muted rounded-full mb-4 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progress === 100 ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                item.is_done
                                  ? 'bg-success/10'
                                  : 'bg-muted/50 hover:bg-muted'
                              }`}
                            >
                              <Checkbox
                                checked={item.is_done ?? false}
                                onCheckedChange={() => handleToggleItem(item.id, item.is_done ?? false)}
                                className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                              />
                              <span className={`flex-1 ${
                                item.is_done ? 'line-through text-muted-foreground' : ''
                              }`}>
                                {item.item_text}
                              </span>
                              {item.is_done ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
