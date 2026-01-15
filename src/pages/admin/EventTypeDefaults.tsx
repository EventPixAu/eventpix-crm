import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings2, 
  ClipboardList,
  Check,
  Save,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useEventTypes } from '@/hooks/useLookups';
import { useAllWorkflowTemplates } from '@/hooks/useWorkflowTemplates';
import { useAllEventTypeDefaults, useSetEventTypeDefaults } from '@/hooks/useEventTypeDefaults';
import { toast } from 'sonner';

const phases = [
  { key: 'pre_event', label: 'Pre-Event', color: 'text-info' },
  { key: 'day_of', label: 'Day Of', color: 'text-warning' },
  { key: 'post_event', label: 'Post-Event', color: 'text-success' },
] as const;

export default function EventTypeDefaults() {
  const { data: eventTypes = [], isLoading: typesLoading } = useEventTypes();
  const { data: templates = [], isLoading: templatesLoading } = useAllWorkflowTemplates();
  const { data: allDefaults = [], isLoading: defaultsLoading } = useAllEventTypeDefaults();
  const setDefaults = useSetEventTypeDefaults();
  
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Active templates only
  const activeTemplates = templates.filter(t => t.is_active);

  // Load defaults when event type is selected
  useEffect(() => {
    if (selectedEventType && allDefaults) {
      const typeDefaults = allDefaults
        .filter(d => d.event_type_id === selectedEventType)
        .map(d => d.template_id);
      setSelectedTemplates(typeDefaults);
      setHasChanges(false);
    }
  }, [selectedEventType, allDefaults]);

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplates(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId);
      } else {
        return [...prev, templateId];
      }
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedEventType) return;
    
    await setDefaults.mutateAsync({
      eventTypeId: selectedEventType,
      templateIds: selectedTemplates,
    });
    
    setHasChanges(false);
  };

  const getDefaultCount = (eventTypeId: string) => {
    return allDefaults.filter(d => d.event_type_id === eventTypeId).length;
  };

  const isLoading = typesLoading || templatesLoading || defaultsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title="Event Type Defaults"
          description="Configure which workflow templates apply to each event type"
        />
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Event Type Defaults"
        description="Configure which workflow templates apply to each event type"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Event Types List */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold">Event Types</h2>
              <p className="text-sm text-muted-foreground">
                Select an event type to configure
              </p>
            </div>
            
            <div className="divide-y divide-border">
              {eventTypes.map(type => {
                const defaultCount = getDefaultCount(type.id);
                const isSelected = selectedEventType === type.id;
                
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedEventType(type.id)}
                    className={`w-full p-4 text-left transition-colors flex items-center justify-between ${
                      isSelected 
                        ? 'bg-primary/10 border-l-2 border-l-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Settings2 className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={isSelected ? 'font-medium' : ''}>{type.name}</span>
                    </div>
                    {defaultCount > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {defaultCount} templates
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        All templates
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Template Selection */}
        <div className="lg:col-span-2">
          {selectedEventType ? (
            <div className="bg-card border border-border rounded-xl">
              <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    Templates for {eventTypes.find(t => t.id === selectedEventType)?.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplates.length === 0 
                      ? 'No templates selected - all active templates will be used'
                      : `${selectedTemplates.length} template(s) selected`
                    }
                  </p>
                </div>
                {hasChanges && (
                  <Button onClick={handleSave} disabled={setDefaults.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                )}
              </div>

              <div className="p-4 space-y-6">
                {phases.map(phase => {
                  const phaseTemplates = activeTemplates.filter(t => t.phase === phase.key);
                  if (phaseTemplates.length === 0) return null;
                  
                  return (
                    <motion.div
                      key={phase.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <h3 className={`text-sm font-medium mb-3 ${phase.color}`}>
                        {phase.label}
                      </h3>
                      <div className="space-y-2">
                        {phaseTemplates.map(template => {
                          const isChecked = selectedTemplates.includes(template.id);
                          
                          return (
                            <label
                              key={template.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                isChecked 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:bg-muted/50'
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => handleTemplateToggle(template.id)}
                              />
                              <ClipboardList className="h-4 w-4 text-muted-foreground" />
                              <span className="flex-1">{template.template_name}</span>
                              {isChecked && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}

                {activeTemplates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No active templates available. Create templates first.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select an event type to configure its default templates</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-muted/30 border border-border rounded-xl p-4">
        <h3 className="font-medium mb-2">How Event Type Defaults Work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• When you create a new event, worksheets are automatically generated from templates.</li>
          <li>• If specific templates are selected for an event type, only those templates are used.</li>
          <li>• If no templates are selected (empty), all active templates are used as a fallback.</li>
          <li>• Changes only affect new events - existing events keep their current worksheets.</li>
        </ul>
      </div>
    </AppLayout>
  );
}
