import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Plus, 
  Layers, 
  Calendar, 
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  useEventSeries, 
  useCreateEventSeries, 
  useUpdateEventSeries,
} from '@/hooks/useEventSeries';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function EventSeriesList() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEventTypeId, setNewEventTypeId] = useState<string>('');
  const [newDeliveryMethodId, setNewDeliveryMethodId] = useState<string>('');
  const [newDeadlineDays, setNewDeadlineDays] = useState('5');
  const [newCoverage, setNewCoverage] = useState('');
  const [newNotes, setNewNotes] = useState('');
  
  const { data: series = [], isLoading } = useEventSeries();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const createSeries = useCreateEventSeries();
  const updateSeries = useUpdateEventSeries();
  
  // Get event counts for each series
  const { data: eventCounts = {} } = useQuery({
    queryKey: ['event-series-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('event_series_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(event => {
        if (event.event_series_id) {
          counts[event.event_series_id] = (counts[event.event_series_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    await createSeries.mutateAsync({
      name: newName.trim(),
      event_type_id: newEventTypeId || null,
      default_delivery_method_id: newDeliveryMethodId || null,
      default_delivery_deadline_days: parseInt(newDeadlineDays) || 5,
      default_coverage_details: newCoverage || null,
      notes: newNotes || null,
      is_active: true,
    });
    
    resetForm();
    setCreateOpen(false);
  };

  const resetForm = () => {
    setNewName('');
    setNewEventTypeId('');
    setNewDeliveryMethodId('');
    setNewDeadlineDays('5');
    setNewCoverage('');
    setNewNotes('');
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await updateSeries.mutateAsync({ id, is_active: !currentActive });
  };

  const activeSeries = series.filter(s => s.is_active);
  const inactiveSeries = series.filter(s => !s.is_active);

  return (
    <AppLayout>
      <PageHeader
        title="Event Series"
        description="Manage national programs and corporate event series"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Series
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Event Series</DialogTitle>
                <DialogDescription>
                  Set up a new program or series of related events.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Series Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Local Business Awards 2026"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Event Type</Label>
                    <Select value={newEventTypeId} onValueChange={setNewEventTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Delivery Method</Label>
                    <Select value={newDeliveryMethodId} onValueChange={setNewDeliveryMethodId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryMethods.map(method => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Delivery Deadline (days after event)</Label>
                  <Input
                    type="number"
                    value={newDeadlineDays}
                    onChange={(e) => setNewDeadlineDays(e.target.value)}
                    min="1"
                    max="30"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Default Coverage Details</Label>
                  <Textarea
                    value={newCoverage}
                    onChange={(e) => setNewCoverage(e.target.value)}
                    placeholder="Coverage requirements for all events in this series..."
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Internal notes about this series..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createSeries.isPending || !newName.trim()}>
                  Create Series
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading series...
        </div>
      ) : series.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Event Series Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first event series to group related events like national programs.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Series
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Series */}
          {activeSeries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Active Series
                <Badge variant="secondary">{activeSeries.length}</Badge>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSeries.map(s => (
                  <SeriesCard
                    key={s.id}
                    series={s}
                    eventCount={eventCounts[s.id] || 0}
                    eventTypes={eventTypes}
                    onToggleActive={() => handleToggleActive(s.id, s.is_active)}
                    onClick={() => navigate(`/admin/series/${s.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Inactive Series */}
          {inactiveSeries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                <EyeOff className="h-4 w-4" />
                Inactive Series
                <Badge variant="outline">{inactiveSeries.length}</Badge>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                {inactiveSeries.map(s => (
                  <SeriesCard
                    key={s.id}
                    series={s}
                    eventCount={eventCounts[s.id] || 0}
                    eventTypes={eventTypes}
                    onToggleActive={() => handleToggleActive(s.id, s.is_active)}
                    onClick={() => navigate(`/admin/series/${s.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

interface SeriesCardProps {
  series: any;
  eventCount: number;
  eventTypes: any[];
  onToggleActive: () => void;
  onClick: () => void;
}

function SeriesCard({ series, eventCount, eventTypes, onToggleActive, onClick }: SeriesCardProps) {
  const eventType = eventTypes.find(t => t.id === series.event_type_id);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{series.name}</h3>
            {eventType && (
              <p className="text-sm text-muted-foreground">{eventType.name}</p>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={series.is_active}
            onCheckedChange={onToggleActive}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {eventCount} events
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </motion.div>
  );
}
