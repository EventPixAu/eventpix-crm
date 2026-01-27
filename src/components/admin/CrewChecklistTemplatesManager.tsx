/**
 * CrewChecklistTemplatesManager - Admin UI for managing role-based crew checklist templates
 * 
 * Located in the Workflows section. Allows admins to:
 * - Create/edit/delete checklist templates
 * - Assign templates to specific staff roles (Lead Photographer, Assistant, etc.)
 * - Define checklist items for each template
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ChecklistItem {
  item_text: string;
  sort_order: number;
}

interface CrewChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  items: ChecklistItem[];
  is_active: boolean;
  staff_role_id: string | null;
  created_at: string | null;
}

interface StaffRole {
  id: string;
  name: string;
}

export function CrewChecklistTemplatesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<CrewChecklistTemplate | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRoleId, setFormRoleId] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formItems, setFormItems] = useState<ChecklistItem[]>([]);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['crew-checklist-templates-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_checklist_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []).map((t) => ({
        ...t,
        items: (t.items as unknown as ChecklistItem[]) || [],
      })) as CrewChecklistTemplate[];
    },
  });

  // Fetch staff roles
  const { data: staffRoles = [] } = useQuery({
    queryKey: ['staff-roles-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_roles')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order, name');
      if (error) throw error;
      return data as StaffRole[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      name: string;
      description: string | null;
      items: ChecklistItem[];
      is_active: boolean;
      staff_role_id: string | null;
    }) => {
      if (data.id) {
        const { error } = await supabase
          .from('crew_checklist_templates')
          .update({
            name: data.name,
            description: data.description,
            items: data.items as any,
            is_active: data.is_active,
            staff_role_id: data.staff_role_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crew_checklist_templates')
          .insert({
            name: data.name,
            description: data.description,
            items: data.items as any,
            is_active: data.is_active,
            staff_role_id: data.staff_role_id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-checklist-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['crew-checklist-templates'] });
      toast({ title: isCreateMode ? 'Template created' : 'Template updated' });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving template', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crew_checklist_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-checklist-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['crew-checklist-templates'] });
      toast({ title: 'Template deleted' });
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting template', description: error.message, variant: 'destructive' });
    },
  });

  const openCreate = () => {
    setIsCreateMode(true);
    setFormName('');
    setFormDescription('');
    setFormRoleId('');
    setFormIsActive(true);
    setFormItems([{ item_text: '', sort_order: 1 }]);
    setEditingTemplate({} as CrewChecklistTemplate);
  };

  const openEdit = (template: CrewChecklistTemplate) => {
    setIsCreateMode(false);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormRoleId(template.staff_role_id || '');
    setFormIsActive(template.is_active);
    setFormItems(template.items.length > 0 ? template.items : [{ item_text: '', sort_order: 1 }]);
    setEditingTemplate(template);
  };

  const closeDialog = () => {
    setEditingTemplate(null);
    setIsCreateMode(false);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast({ title: 'Template name is required', variant: 'destructive' });
      return;
    }

    const validItems = formItems
      .filter((item) => item.item_text.trim())
      .map((item, index) => ({ item_text: item.item_text.trim(), sort_order: index + 1 }));

    if (validItems.length === 0) {
      toast({ title: 'At least one checklist item is required', variant: 'destructive' });
      return;
    }

    saveMutation.mutate({
      id: isCreateMode ? undefined : editingTemplate?.id,
      name: formName.trim(),
      description: formDescription.trim() || null,
      items: validItems,
      is_active: formIsActive,
      staff_role_id: formRoleId || null,
    });
  };

  const addItem = () => {
    setFormItems([...formItems, { item_text: '', sort_order: formItems.length + 1 }]);
  };

  const updateItem = (index: number, text: string) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], item_text: text };
    setFormItems(updated);
  };

  const removeItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedTemplates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedTemplates(newSet);
  };

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return 'All Roles';
    return staffRoles.find((r) => r.id === roleId)?.name || 'Unknown Role';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading templates...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Crew Checklist Templates
          </CardTitle>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No checklist templates yet. Create one to get started.
            </p>
          ) : (
            templates.map((template) => (
              <Collapsible
                key={template.id}
                open={expandedTemplates.has(template.id)}
                onOpenChange={() => toggleExpanded(template.id)}
              >
                <div className="border border-border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {getRoleName(template.staff_role_id)}
                            </Badge>
                            <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-xs">
                              {template.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {template.items.length} items
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(template);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(template.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        {expandedTemplates.has(template.id) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                      )}
                      <div className="space-y-2">
                        {template.items.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground w-6">{index + 1}.</span>
                            <span>{item.item_text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? 'Create Checklist Template' : 'Edit Checklist Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Lead Photographer Checklist"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Assigned Role</Label>
                <Select value={formRoleId || 'none'} onValueChange={(val) => setFormRoleId(val === 'none' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All roles (default)</SelectItem>
                    {staffRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of when to use this checklist"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="active" checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label htmlFor="active">Active (visible to crew)</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Checklist Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {formItems.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                      <Input
                        value={item.item_text}
                        onChange={(e) => updateItem(index, e.target.value)}
                        placeholder="Checklist item text"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={formItems.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checklist Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this checklist template. Existing crew checklists that used this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
