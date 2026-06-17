/**
 * INLINE CATEGORY EDITOR
 *
 * Compact two-step (Parent + Sub) editor displayed inline in tables.
 * Saves immediately on selection. Admin only.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown, Tag, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { CompanyCategoryPicker } from './CompanyCategoryPicker';

interface InlineCategoryEditorProps {
  companyId: string;
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  currentSubcategoryId?: string | null;
  currentSubcategoryName?: string | null;
  onCategoryChange?: () => void;
}

export function InlineCategoryEditor({
  companyId,
  currentCategoryId,
  currentCategoryName,
  currentSubcategoryId,
  currentSubcategoryName,
  onCategoryChange,
}: InlineCategoryEditorProps) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (parentId: string | null, subcategoryId: string | null) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ category_id: parentId, subcategory_id: subcategoryId } as any)
        .eq('id', companyId);
      if (error) throw error;
      toast.success('Category updated');
      onCategoryChange?.();
    } catch (e) {
      console.error('Category update', e);
      toast.error('Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  };

  const display = currentCategoryName || currentSubcategoryName;

  if (!isAdmin) {
    return display ? (
      <div className="flex flex-col gap-1">
        {currentCategoryName && (
          <Badge variant="outline" className="gap-1 w-fit">
            <Tag className="h-3 w-3" />{currentCategoryName}
          </Badge>
        )}
        {currentSubcategoryName && (
          <Badge variant="secondary" className="text-xs w-fit">{currentSubcategoryName}</Badge>
        )}
      </div>
    ) : <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isUpdating}
          className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded text-left"
        >
          {display ? (
            <div className="flex flex-col gap-1">
              {currentCategoryName && (
                <Badge variant="outline" className="gap-1 cursor-pointer hover:opacity-80 w-fit">
                  <Tag className="h-3 w-3" />{currentCategoryName}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Badge>
              )}
              {currentSubcategoryName && (
                <Badge variant="secondary" className="text-xs w-fit">{currentSubcategoryName}</Badge>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="gap-1 cursor-pointer hover:opacity-80 text-muted-foreground">
              Set category
              <ChevronDown className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-background z-50 p-3" align="start">
        {isUpdating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </div>
        )}
        <CompanyCategoryPicker
          parentId={currentCategoryId}
          subcategoryId={currentSubcategoryId || null}
          onChange={handleChange}
          disabled={isUpdating}
        />
      </PopoverContent>
    </Popover>
  );
}
