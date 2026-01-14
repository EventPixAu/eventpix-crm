import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowTemplate {
  id: string;
  template_name: string;
  phase: 'pre_event' | 'day_of' | 'post_event';
  is_active: boolean;
}

interface WorkflowTemplateItem {
  id: string;
  template_id: string;
  item_text: string;
  sort_order: number;
}

export default function Workflows() {
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_active', true)
        .order('phase');
      if (error) throw error;
      return data as WorkflowTemplate[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['workflow-template-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_template_items')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as WorkflowTemplateItem[];
    },
  });

  const phases = [
    { key: 'pre_event', label: 'Pre-Event', color: 'text-info' },
    { key: 'day_of', label: 'Day Of', color: 'text-warning' },
    { key: 'post_event', label: 'Post-Event', color: 'text-success' },
  ] as const;

  const getTemplateItems = (templateId: string) => {
    return items.filter((item) => item.template_id === templateId);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Workflow Templates"
        description="Reusable checklists for event management"
      />

      {templatesLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading workflows...
        </div>
      ) : (
        <div className="space-y-8">
          {phases.map((phase) => {
            const phaseTemplates = templates.filter((t) => t.phase === phase.key);
            if (phaseTemplates.length === 0) return null;

            return (
              <motion.div
                key={phase.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className={`text-lg font-display font-semibold mb-4 ${phase.color}`}>
                  {phase.label}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {phaseTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-card border border-border rounded-xl p-5 shadow-card"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <ClipboardList className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-medium">{template.template_name}</h3>
                      </div>
                      <div className="space-y-2">
                        {getTemplateItems(template.id).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Circle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">{item.item_text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
