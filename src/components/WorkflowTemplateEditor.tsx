import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  GripVertical,
  Trash2,
  Zap,
  Clock,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useAllTemplateItems,
  useCreateTemplateItem,
  useUpdateTemplateItem,
  useDeleteTemplateItem,
  useReorderTemplateItems,
} from '@/hooks/useWorkflowTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WorkflowTemplateEditorProps {
  templateId: string;
  isEditable?: boolean;
}

const AUTO_TRIGGER_OPTIONS = [
  { value: 'quote_accepted', label: 'Quote Accepted' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'invoice_paid', label: 'Invoice Paid' },
];

const DATE_REFERENCE_OPTIONS = [
  { value: 'event_date', label: 'Main Shoot Date' },
  { value: 'booking_date', label: 'Booking Date' },
  { value: 'delivery_deadline', label: 'Delivery Deadline' },
];

export function WorkflowTemplateEditor({ 
  templateId, 
  isEditable = true 
}: WorkflowTemplateEditorProps) {
  const { data: items = [], isLoading } = useAllTemplateItems(templateId);
  const createItem = useCreateTemplateItem();
  const updateItem = useUpdateTemplateItem();
  const deleteItem = useDeleteTemplateItem();
  const reorderItems = useReorderTemplateItems();
  
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  
  const handleAddItem = async () => {
    if (!newItemLabel.trim()) return;
    
    await createItem.mutateAsync({
      template_id: templateId,
      label: newItemLabel.trim(),
      sort_order: items.length,
    });
    
    setNewItemLabel('');
  };
  
  const handleUpdateItem = async (
    itemId: string, 
    updates: Record<string, any>
  ) => {
    await supabase
      .from('workflow_template_items')
      .update(updates)
      .eq('id', itemId);
    
    // Refetch items
    toast.success('Step updated');
  };
  
  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const reordered = [...items];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    
    await reorderItems.mutateAsync({
      template_id: templateId,
      items: reordered.map((item, i) => ({ id: item.id, sort_order: i })),
    });
  };
  
  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" />;
  }
  
  return (
    <div className="space-y-4">
      {/* Items List */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <Collapsible
            key={item.id}
            open={expandedItem === item.id}
            onOpenChange={() => setExpandedItem(
              expandedItem === item.id ? null : item.id
            )}
          >
            <motion.div
              layout
              className="border border-border rounded-lg bg-card overflow-hidden"
            >
              {/* Item Header */}
              <div className="flex items-center gap-2 p-3">
                {isEditable && (
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleMoveItem(index, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleMoveItem(index, 'down')}
                      disabled={index === items.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.completion_type === 'auto' && (
                      <span className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Auto
                      </span>
                    )}
                    {item.date_offset_days !== null && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.date_offset_days > 0 ? '+' : ''}{item.date_offset_days}d
                      </span>
                    )}
                  </div>
                </div>
                
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                
                {isEditable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteItem.mutate({ 
                      id: item.id, 
                      template_id: templateId 
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* Expanded Settings */}
              <CollapsibleContent>
                <div className="border-t border-border p-4 space-y-4 bg-muted/30">
                  {/* Label */}
                  <div className="space-y-2">
                    <Label>Step Label</Label>
                    <Input
                      value={item.label}
                      onChange={(e) => handleUpdateItem(item.id, { 
                        label: e.target.value 
                      })}
                      disabled={!isEditable}
                    />
                  </div>
                  
                  {/* Help Text */}
                  <div className="space-y-2">
                    <Label>Help Text / Notes</Label>
                    <Textarea
                      value={item.help_text || ''}
                      onChange={(e) => handleUpdateItem(item.id, { 
                        help_text: e.target.value || null 
                      })}
                      placeholder="Additional instructions for this step"
                      disabled={!isEditable}
                      rows={2}
                    />
                  </div>
                  
                  {/* Completion Type */}
                  <div className="space-y-2">
                    <Label>Completion Type</Label>
                    <Select
                      value={item.completion_type || 'manual'}
                      onValueChange={(value) => handleUpdateItem(item.id, { 
                        completion_type: value,
                        auto_trigger_event: value === 'manual' ? null : item.auto_trigger_event,
                      })}
                      disabled={!isEditable}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="auto">Automatic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Auto Trigger Event */}
                  {item.completion_type === 'auto' && (
                    <div className="space-y-2">
                      <Label>Trigger Event</Label>
                      <Select
                        value={item.auto_trigger_event || ''}
                        onValueChange={(value) => handleUpdateItem(item.id, { 
                          auto_trigger_event: value 
                        })}
                        disabled={!isEditable}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select trigger..." />
                        </SelectTrigger>
                        <SelectContent>
                          {AUTO_TRIGGER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Date Offset Settings */}
                  <div className="border-t border-border pt-4 mt-4">
                    <Label className="mb-2 block">Due Date (Optional)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Days Offset
                        </Label>
                        <Input
                          type="number"
                          value={item.date_offset_days ?? ''}
                          onChange={(e) => handleUpdateItem(item.id, { 
                            date_offset_days: e.target.value 
                              ? parseInt(e.target.value) 
                              : null 
                          })}
                          placeholder="e.g., -7 (before) or 3 (after)"
                          disabled={!isEditable}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Relative To
                        </Label>
                        <Select
                          value={item.date_offset_reference || 'event_date'}
                          onValueChange={(value) => handleUpdateItem(item.id, { 
                            date_offset_reference: value 
                          })}
                          disabled={!isEditable}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATE_REFERENCE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use negative numbers for days before (e.g., -7 = 7 days before)
                    </p>
                  </div>
                  
                  {/* Required Toggle */}
                  <div className="flex items-center justify-between pt-2">
                    <Label>Required Step</Label>
                    <Switch
                      checked={item.is_required || false}
                      onCheckedChange={(checked) => handleUpdateItem(item.id, { 
                        is_required: checked 
                      })}
                      disabled={!isEditable}
                    />
                  </div>
                  
                  {/* Active Toggle */}
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={item.is_active ?? true}
                      onCheckedChange={(checked) => handleUpdateItem(item.id, { 
                        is_active: checked 
                      })}
                      disabled={!isEditable}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </motion.div>
          </Collapsible>
        ))}
      </div>
      
      {/* Add New Item */}
      {isEditable && (
        <div className="flex gap-2">
          <Input
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            placeholder="New step label..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <Button
            onClick={handleAddItem}
            disabled={!newItemLabel.trim() || createItem.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
