/**
 * LEAD COLLAPSIBLE PANEL
 * 
 * Studio Ninja-style collapsible panel with:
 * - Icon and title
 * - Optional count badge
 * - Plus button for adding items
 * - Collapsible content
 */
import { useState, ReactNode } from 'react';
import { Plus, ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LeadCollapsiblePanelProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  badge?: string;
  onAdd?: () => void;
  addLabel?: string;
  extraActions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function LeadCollapsiblePanel({
  icon: Icon,
  title,
  count,
  badge,
  onAdd,
  addLabel = 'Add',
  extraActions,
  children,
  defaultOpen = false,
  emptyMessage = 'No items yet',
  isEmpty = false,
}: LeadCollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
          {badge && (
            <Badge variant="outline" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onAdd && (
            <Button 
              variant="default" 
              size="icon" 
              className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="px-4 pb-4 border-t">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {emptyMessage}
            </p>
          ) : (
            <div className="pt-4">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
