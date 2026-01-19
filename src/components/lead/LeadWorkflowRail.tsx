/**
 * LEAD WORKFLOW RAIL
 * 
 * Studio Ninja-style workflow checklist for leads.
 * Displays steps grouped by section (Lead, Production, Post Production).
 * Supports manual steps, auto-triggered steps, and date-relative scheduling.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  Check,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MoreVertical,
  Plus,
  Calendar,
  Mail,
  Clock,
  Zap,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useLeadWorkflowItems,
  useAddWorkflowItem,
  useToggleWorkflowItem,
  useUpdateWorkflowItemOrder,
  useDeleteWorkflowItem,
  LeadWorkflowItem,
} from '@/hooks/useSalesWorkflow';

interface LeadWorkflowRailProps {
  leadId: string;
  mainShootDate?: string | null;
  onApplyTemplate?: () => void;
}

// Determine step section based on workflow position or metadata
function getStepSection(item: LeadWorkflowItem, index: number, total: number): string {
  // Use title keywords to categorize
  const title = item.title.toLowerCase();
  
  if (title.includes('lead') || title.includes('enquiry') || title.includes('initial') || 
      title.includes('quote') || title.includes('booking') || title.includes('job accepted')) {
    return 'LEAD';
  }
  if (title.includes('pre shoot') || title.includes('pre-shoot') || title.includes('reminder') ||
      title.includes('confirmation') || title.includes('shoot') || title.includes('main shoot')) {
    return 'PRODUCTION';
  }
  if (title.includes('post') || title.includes('upload') || title.includes('cull') || 
      title.includes('edit') || title.includes('deliver') || title.includes('gallery') ||
      title.includes('invoice') || title.includes('retouch') || title.includes('complete')) {
    return 'POST PRODUCTION';
  }
  
  // Default based on position
  if (index < total * 0.3) return 'LEAD';
  if (index < total * 0.6) return 'PRODUCTION';
  return 'POST PRODUCTION';
}

const SECTION_COLORS: Record<string, string> = {
  'LEAD': 'bg-amber-400',
  'PRODUCTION': 'bg-sky-400',
  'POST PRODUCTION': 'bg-emerald-400',
};

interface WorkflowStepProps {
  item: LeadWorkflowItem;
  leadId: string;
  index: number;
  totalItems: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showSectionLabel: boolean;
  section: string;
  mainShootDate?: string | null;
}

function WorkflowStep({
  item,
  leadId,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  showSectionLabel,
  section,
  mainShootDate,
}: WorkflowStepProps) {
  const toggleItem = useToggleWorkflowItem();
  const deleteItem = useDeleteWorkflowItem();
  
  const isAutoStep = item.title.toLowerCase().includes('job accepted');
  const hasEmailAction = item.title.toLowerCase().includes('email');
  const isAutoSendEmail = item.title.toLowerCase().includes('auto') && hasEmailAction;
  const isMainShoot = item.title.toLowerCase().includes('main shoot') || 
                       item.title.toLowerCase().includes('shoot date');

  // Calculate date display based on main shoot
  const getDateDisplay = (): string | null => {
    if (item.done_at) {
      return format(new Date(item.done_at), 'd MMM yyyy');
    }
    // TODO: Calculate from main shoot date if we have offset info
    return null;
  };

  const dateDisplay = getDateDisplay();

  return (
    <div className="relative">
      {/* Section Label */}
      {showSectionLabel && (
        <div 
          className={`absolute -left-4 top-0 bottom-0 w-1 ${SECTION_COLORS[section]}`}
          style={{ borderRadius: '0 2px 2px 0' }}
        />
      )}
      
      <div className="flex items-start gap-2 py-3 px-3 hover:bg-muted/50 rounded-lg group border-b border-border/50 last:border-b-0">
        {/* Checkbox */}
        <Checkbox
          checked={item.is_done}
          disabled={isAutoStep && !item.is_done}
          onCheckedChange={(checked) => 
            toggleItem.mutate({ id: item.id, leadId, is_done: !!checked })
          }
          className="mt-1"
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${item.is_done ? 'text-muted-foreground line-through' : ''}`}>
            {item.title}
          </div>
          
          {/* Badges and metadata */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {/* Completion date */}
            {item.is_done && item.done_at && (
              <Badge variant="outline" className="text-xs bg-muted">
                <Check className="h-3 w-3 mr-1" />
                {format(new Date(item.done_at), 'd MMM yyyy')}
              </Badge>
            )}
            
            {/* Send email action */}
            {hasEmailAction && !isAutoSendEmail && !item.is_done && (
              <Badge className="text-xs bg-emerald-500 hover:bg-emerald-600 cursor-pointer">
                Send email
              </Badge>
            )}
            
            {/* Auto send email */}
            {isAutoSendEmail && (
              <Badge className="text-xs bg-sky-500">
                Auto send email
              </Badge>
            )}
            
            {/* Date badge */}
            {dateDisplay && !item.is_done && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <Calendar className="h-3 w-3 mr-1" />
                {dateDisplay}
              </Badge>
            )}
            
            {/* Main shoot indicator */}
            {isMainShoot && (
              <Badge className="text-xs bg-teal-500">
                Main Shoot
              </Badge>
            )}
            
            {/* Auto-step explanation */}
            {isAutoStep && !item.is_done && (
              <p className="text-xs text-muted-foreground w-full mt-1">
                This checks automatically when a quote is accepted OR a contract is signed OR an invoice is paid. Once checked this lead becomes a job.
              </p>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={onMoveUp} 
                disabled={isFirst}
              >
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={onMoveDown}
                disabled={isLast}
              >
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => deleteItem.mutate({ id: item.id, leadId })}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-move">
            <GripVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LeadWorkflowRail({ leadId, mainShootDate, onApplyTemplate }: LeadWorkflowRailProps) {
  const { data: items = [], isLoading } = useLeadWorkflowItems(leadId);
  const addItem = useAddWorkflowItem();
  const updateOrder = useUpdateWorkflowItemOrder();
  
  const [newItemTitle, setNewItemTitle] = useState('');

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    const maxOrder = items.length > 0 
      ? Math.max(...items.map(i => i.sort_order)) + 1 
      : 0;
    await addItem.mutateAsync({ lead_id: leadId, title: newItemTitle.trim(), sort_order: maxOrder });
    setNewItemTitle('');
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    
    const currentItem = items[idx];
    const targetItem = items[targetIdx];
    
    await Promise.all([
      updateOrder.mutateAsync({ id: currentItem.id, leadId, sort_order: targetItem.sort_order }),
      updateOrder.mutateAsync({ id: targetItem.id, leadId, sort_order: currentItem.sort_order }),
    ]);
  };

  // Group items by section
  const itemsWithSections = items.map((item, idx) => ({
    ...item,
    section: getStepSection(item, idx, items.length),
  }));

  // Determine which items show section labels
  let lastSection = '';
  const enrichedItems = itemsWithSections.map((item) => {
    const showLabel = item.section !== lastSection;
    lastSection = item.section;
    return { ...item, showSectionLabel: showLabel };
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Workflow
        </h3>
        <Button 
          variant="default" 
          size="icon" 
          className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600"
          onClick={onApplyTemplate}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Workflow Steps */}
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">No workflow items yet</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onApplyTemplate}
          >
            Apply Template
          </Button>
        </div>
      ) : (
        <div className="relative pl-4">
          {enrichedItems.map((item, idx) => (
            <div key={item.id}>
              {/* Section Label Vertical Bar */}
              {item.showSectionLabel && (
                <div className="flex items-center gap-2 mb-2 -ml-4">
                  <div className={`w-1 h-4 rounded ${SECTION_COLORS[item.section]}`} />
                  <span className="text-xs font-medium text-muted-foreground tracking-wider">
                    {item.section}
                  </span>
                </div>
              )}
              
              <WorkflowStep
                item={item}
                leadId={leadId}
                index={idx}
                totalItems={items.length}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                onMoveUp={() => handleMoveItem(item.id, 'up')}
                onMoveDown={() => handleMoveItem(item.id, 'down')}
                showSectionLabel={false}
                section={item.section}
                mainShootDate={mainShootDate}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      <div className="flex gap-2 pt-2">
        <Input
          placeholder="Add checklist item..."
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          className="text-sm"
        />
        <Button 
          size="icon" 
          onClick={handleAddItem} 
          disabled={!newItemTitle.trim()}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
