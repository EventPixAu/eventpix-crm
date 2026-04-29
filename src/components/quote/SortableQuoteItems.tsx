/**
 * SORTABLE QUOTE ITEMS
 * 
 * Drag-and-drop reorderable quote line items table.
 * Uses @dnd-kit for smooth drag interactions.
 */
import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuoteItem } from '@/hooks/useQuoteItems';
import { useProductCategories } from '@/hooks/useProducts';

interface SortableRowProps {
  item: QuoteItem;
  isLocked: boolean;
  groupLabels: string[];
  formatCurrency: (value: number) => string;
  onEdit: (item: QuoteItem) => void;
  onDelete: (itemId: string) => void;
  onGroupChange: (itemId: string, group: string) => void;
  isDeleting?: boolean;
}

function SortableRow({
  item,
  isLocked,
  groupLabels,
  formatCurrency,
  onEdit,
  onDelete,
  onGroupChange,
  isDeleting = false,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${!isLocked ? 'cursor-pointer hover:bg-muted/50' : ''} ${isDragging ? 'bg-muted' : ''}`}
      onClick={() => !isLocked && onEdit(item)}
    >
      {!isLocked && (
        <TableCell className="w-8 p-2" onClick={(e) => e.stopPropagation()}>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </TableCell>
      )}
      <TableCell>
        <div>
          <div className="font-medium whitespace-pre-line">{item.description}</div>
          {item.product && (
            <div className="text-xs text-muted-foreground">
              Product: {item.product.name}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">{item.quantity}</TableCell>
      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
      <TableCell className="text-right">{(item.tax_rate * 100).toFixed(0)}%</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(item.line_total)}
      </TableCell>
      {!isLocked && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Select
            value={item.group_label || ''}
            onValueChange={(val) => onGroupChange(item.id, val)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              {groupLabels.map((label) => (
                <SelectItem key={label} value={label}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
      )}
      {!isLocked && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

interface SortableQuoteItemsProps {
  items: QuoteItem[];
  isLocked: boolean;
  formatCurrency: (value: number) => string;
  onEdit: (item: QuoteItem) => void;
  onDelete: (itemId: string) => void;
  onGroupChange: (itemId: string, group: string) => void;
  onReorder: (items: { id: string; sort_order: number }[]) => void;
  isDeleting?: boolean;
}

export function SortableQuoteItems({
  items,
  isLocked,
  formatCurrency,
  onEdit,
  onDelete,
  onGroupChange,
  onReorder,
  isDeleting = false,
}: SortableQuoteItemsProps) {
  const { data: categories = [] } = useProductCategories();
  
  // Use category names as group labels, with "Other" as fallback
  const groupLabels = useMemo(() => {
    const categoryNames = categories
      .filter(c => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => c.name);
    // Always include "Other" as a fallback option
    if (!categoryNames.includes('Other')) {
      categoryNames.push('Other');
    }
    return categoryNames;
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group items by group_label
  const groupedItems = useMemo(() => {
    const groups: Record<string, QuoteItem[]> = {};
    items.forEach((item) => {
      const groupKey = item.group_label || 'Other';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    return groups;
  }, [items]);

  // Sort group keys with custom ordering
  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      const indexA = groupLabels.indexOf(a);
      const indexB = groupLabels.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [groupedItems, groupLabels]);

  const handleDragEnd = (event: DragEndEvent, groupItems: QuoteItem[]) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = groupItems.findIndex((item) => item.id === active.id);
      const newIndex = groupItems.findIndex((item) => item.id === over.id);
      
      const reorderedGroupItems = arrayMove(groupItems, oldIndex, newIndex);
      
      // Rebuild the full items array maintaining group order
      const newItems: QuoteItem[] = [];
      sortedGroupKeys.forEach((groupKey) => {
        if (groupKey === (groupItems[0]?.group_label || 'Other')) {
          newItems.push(...reorderedGroupItems);
        } else {
          newItems.push(...(groupedItems[groupKey] || []));
        }
      });
      
      // Create reorder payload with new sort_orders
      const reorderPayload = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index,
      }));
      
      onReorder(reorderPayload);
    }
  };

  return (
    <div className="space-y-6">
      {sortedGroupKeys.map((groupKey) => {
        const groupItems = groupedItems[groupKey];
        const itemIds = groupItems.map((item) => item.id);
        
        return (
          <div key={groupKey}>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {groupKey}
            </h4>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, groupItems)}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!isLocked && <TableHead className="w-8"></TableHead>}
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {!isLocked && <TableHead className="w-[120px]">Group</TableHead>}
                      {!isLocked && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupItems.map((item) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        isLocked={isLocked}
                        groupLabels={groupLabels}
                        formatCurrency={formatCurrency}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onGroupChange={onGroupChange}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          </div>
        );
      })}
    </div>
  );
}
