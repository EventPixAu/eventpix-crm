import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Plus, 
  ClipboardList, 
  Copy, 
  Eye, 
  EyeOff,
  Edit,
  ChevronRight,
  Briefcase,
  Settings2
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { 
  useAllWorkflowTemplates, 
  useCreateTemplate, 
  useUpdateTemplate,
  useDuplicateTemplate,
  WorkflowDomain,
} from '@/hooks/useWorkflowTemplates';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const phases = [
  { key: 'pre_event', label: 'Pre-Event', color: 'bg-info/10 text-info' },
  { key: 'day_of', label: 'Day Of', color: 'bg-warning/10 text-warning' },
  { key: 'post_event', label: 'Post-Event', color: 'bg-success/10 text-success' },
] as const;

const domains: { key: WorkflowDomain | 'all'; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All Templates', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'sales', label: 'Sales', icon: <Briefcase className="h-4 w-4" /> },
  { key: 'operations', label: 'Operations', icon: <Settings2 className="h-4 w-4" /> },
];

export default function WorkflowsList() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhase, setNewPhase] = useState<'pre_event' | 'day_of' | 'post_event'>('pre_event');
  const [newDomain, setNewDomain] = useState<WorkflowDomain>('operations');
  const [domainFilter, setDomainFilter] = useState<WorkflowDomain | 'all'>('all');
  
  const { data: templates = [], isLoading } = useAllWorkflowTemplates(
    domainFilter === 'all' ? undefined : domainFilter
  );
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  
  // Get item counts for each template
  const { data: itemCounts = {} } = useQuery({
    queryKey: ['workflow-template-item-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_template_items')
        .select('template_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(item => {
        counts[item.template_id] = (counts[item.template_id] || 0) + 1;
      });
      return counts;
    },
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    await createTemplate.mutateAsync({
      template_name: newName.trim(),
      phase: newPhase,
      workflow_domain: newDomain,
    });
    
    setNewName('');
    setNewPhase('pre_event');
    setNewDomain('operations');
    setCreateOpen(false);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await updateTemplate.mutateAsync({ id, is_active: !currentActive });
  };

  const handleDuplicate = async (id: string) => {
    await duplicateTemplate.mutateAsync(id);
  };

  const getPhaseInfo = (phase: string) => {
    return phases.find(p => p.key === phase) || phases[0];
  };

  const getDomainBadge = (domain: string) => {
    if (domain === 'sales') {
      return <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Sales</Badge>;
    }
    return <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">Operations</Badge>;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Workflow Templates"
        description="Manage reusable checklists for event workflows"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Add a new workflow template for event checklists.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Wedding Setup Checklist"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select value={newDomain} onValueChange={(v) => setNewDomain(v as WorkflowDomain)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">
                        <span className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Sales
                        </span>
                      </SelectItem>
                      <SelectItem value="operations">
                        <span className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          Operations
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phase</Label>
                  <Select value={newPhase} onValueChange={(v) => setNewPhase(v as typeof newPhase)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map(phase => (
                        <SelectItem key={phase.key} value={phase.key}>
                          {phase.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createTemplate.isPending || !newName.trim()}>
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      {/* Domain Filter Tabs */}
      <Tabs value={domainFilter} onValueChange={(v) => setDomainFilter(v as typeof domainFilter)} className="mb-6">
        <TabsList>
          {domains.map((domain) => (
            <TabsTrigger key={domain.key} value={domain.key} className="flex items-center gap-2">
              {domain.icon}
              {domain.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          {domainFilter === 'all' 
            ? 'No templates yet. Create your first workflow template.'
            : `No ${domainFilter} templates found.`
          }
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
                <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
                  <span className={phase.color.split(' ')[1]}>{phase.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {phaseTemplates.length}
                  </Badge>
                </h2>
                
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                     <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Template</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Domain</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Items</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Updated</th>
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">Active</th>
                        <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {phaseTemplates.map((template) => {
                        const phaseInfo = getPhaseInfo(template.phase);
                        return (
                          <tr 
                            key={template.id} 
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/admin/workflows/${template.id}`)}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${phaseInfo.color}`}>
                                  <ClipboardList className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-medium">{template.template_name}</p>
                                  {!template.is_active && (
                                    <Badge variant="outline" className="text-xs mt-1">
                                      <EyeOff className="h-3 w-3 mr-1" />
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {getDomainBadge((template as any).workflow_domain || 'operations')}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {itemCounts[template.id] || 0} items
                            </td>
                            <td className="p-4 text-muted-foreground text-sm">
                              {template.updated_at 
                                ? format(new Date(template.updated_at), 'MMM d, yyyy')
                                : '-'
                              }
                            </td>
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={template.is_active ?? true}
                                onCheckedChange={() => handleToggleActive(template.id, template.is_active ?? true)}
                              />
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDuplicate(template.id)}
                                  title="Duplicate"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/admin/workflows/${template.id}`)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
