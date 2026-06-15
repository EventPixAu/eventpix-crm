/**
 * INLINE CATEGORY EDITOR
 *
 * Clickable category badge that opens a dropdown for Admin users.
 * Saves immediately on selection.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, Tag, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useCompanyCategories } from '@/hooks/useCompanyCategories';

interface InlineCategoryEditorProps {
  companyId: string;
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  onCategoryChange?: () => void;
}

export function InlineCategoryEditor({
  companyId,
  currentCategoryId,
  currentCategoryName,
  onCategoryChange,
}: InlineCategoryEditorProps) {
  const { isAdmin } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: categories = [], isLoading } = useCompanyCategories();

  const canEdit = isAdmin;

  const handleSelect = async (newCategoryId: string | null) => {
    if (newCategoryId === currentCategoryId) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ category_id: newCategoryId })
        .eq('id', companyId);
      if (error) throw error;
      toast.success('Category updated');
      onCategoryChange?.();
    } catch (err) {
      console.error('Error updating category:', err);
      toast.error('Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!canEdit) {
    return currentCategoryName ? (
      <Badge variant="outline" className="gap-1">
        <Tag className="h-3 w-3" />
        {currentCategoryName}
      </Badge>
    ) : (
      <span className="text-muted-foreground text-sm">—</span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isUpdating}>
        <button className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded">
          {currentCategoryName ? (
            <Badge variant="outline" className="gap-1 cursor-pointer hover:opacity-80">
              <Tag className="h-3 w-3" />
              {currentCategoryName}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 cursor-pointer hover:opacity-80 text-muted-foreground">
              Set category
              <ChevronDown className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-background z-50 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-2 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            {categories.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => handleSelect(c.id)}
                className="flex items-center justify-between"
              >
                <span>{c.name}</span>
                {currentCategoryId === c.id && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
            {currentCategoryId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleSelect(null)}
                  className="text-muted-foreground text-sm"
                >
                  Clear category
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
