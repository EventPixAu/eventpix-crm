/**
 * ADMIN TRAINING TOOLS
 * 
 * Admin-only panel for creating and managing training/sample data.
 * All generated data is clearly marked as [TRAINING] and can be easily deleted.
 */
import { useState } from 'react';
import { 
  Beaker, 
  Building2, 
  Calendar, 
  FileText, 
  Layers, 
  Loader2, 
  Plus, 
  Trash2,
  AlertTriangle,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  useCreateSampleClient,
  useCreateSampleLeadWithQuote,
  useCreateSampleEvent,
  useCreateSampleSeries,
  useDeleteTrainingData,
  useTrainingClients,
  useTrainingLeads,
  useTrainingEvents,
} from '@/hooks/useTrainingData';

interface TrainingActionButtonProps {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  isLoading: boolean;
}

function TrainingActionButton({ 
  icon: Icon, 
  label, 
  description, 
  onClick, 
  isLoading 
}: TrainingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left w-full disabled:opacity-50"
    >
      <div className="p-2 rounded-lg bg-primary/10">
        {isLoading ? (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        ) : (
          <Icon className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{label}</p>
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
            Training
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Plus className="h-4 w-4 text-muted-foreground mt-1" />
    </button>
  );
}

export function AdminTrainingTools() {
  const [deleteType, setDeleteType] = useState<'clients' | 'leads' | 'events' | 'all' | null>(null);

  const createClient = useCreateSampleClient();
  const createLead = useCreateSampleLeadWithQuote();
  const createEvent = useCreateSampleEvent();
  const createSeries = useCreateSampleSeries();
  const deleteData = useDeleteTrainingData();

  const { data: trainingClients = [] } = useTrainingClients();
  const { data: trainingLeads = [] } = useTrainingLeads();
  const { data: trainingEvents = [] } = useTrainingEvents();

  const totalTrainingData = trainingClients.length + trainingLeads.length + trainingEvents.length;

  const handleDelete = (type: 'clients' | 'leads' | 'events' | 'all') => {
    deleteData.mutate(type);
    setDeleteType(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-amber-500" />
              Training Data Generator
            </CardTitle>
            <CardDescription>
              Create sample data for training and testing. All data is marked as [TRAINING].
            </CardDescription>
          </div>
          {totalTrainingData > 0 && (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {totalTrainingData} training items
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Create Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Create Sample Data</h3>
          
          <div className="grid gap-3 sm:grid-cols-2">
            <TrainingActionButton
              icon={Building2}
              label="Sample Client"
              description="Create a training client with contact details"
              onClick={() => createClient.mutate()}
              isLoading={createClient.isPending}
            />
            
            <TrainingActionButton
              icon={FileText}
              label="Lead + Quote"
              description="Create a lead with client and draft quote"
              onClick={() => createLead.mutate()}
              isLoading={createLead.isPending}
            />
            
            <TrainingActionButton
              icon={Calendar}
              label="Event with Sessions"
              description="Create an event with sessions and contacts"
              onClick={() => createEvent.mutate()}
              isLoading={createEvent.isPending}
            />
            
            <TrainingActionButton
              icon={Layers}
              label="Series with Events"
              description="Create a series with 5 events across cities"
              onClick={() => createSeries.mutate()}
              isLoading={createSeries.isPending}
            />
          </div>
        </div>

        <Separator />

        {/* Current Training Data */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Current Training Data</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border bg-secondary/50">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-semibold">{trainingClients.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Training Clients</p>
            </div>
            <div className="p-3 rounded-lg border bg-secondary/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-semibold">{trainingLeads.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Training Leads</p>
            </div>
            <div className="p-3 rounded-lg border bg-secondary/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-semibold">{trainingEvents.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Training Events</p>
            </div>
          </div>
        </div>

        {/* Cleanup Actions */}
        {totalTrainingData > 0 && (
          <>
            <Separator />
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Cleanup Training Data</h3>
              
              <div className="flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Training Events
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Training Events?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete {trainingEvents.length} training event(s) and their sessions, 
                        assignments, and related data. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete('events')}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete Events
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Training Leads
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Training Leads?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete {trainingLeads.length} training lead(s) and their quotes. 
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete('leads')}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete Leads
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete All Training Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Training Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete ALL training data including {trainingEvents.length} events, 
                        {trainingLeads.length} leads, and {trainingClients.length} clients. 
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete('all')}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        )}

        {/* Safety Note */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Training Data Safety</p>
              <p className="text-amber-700 mt-0.5">
                All training data is prefixed with [TRAINING] and marked with <code className="px-1 py-0.5 bg-amber-500/20 rounded text-xs">is_training=true</code>. 
                Training data never affects real client records and can be filtered out of reports.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
