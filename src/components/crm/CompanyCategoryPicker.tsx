/**
 * COMPANY CATEGORY PICKER
 *
 * Two-step select: Parent → Sub-category.
 * Controlled component. Pass null/'' for unset.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCompanyCategories, useCompanySubcategories } from '@/hooks/useCompanyCategories';

interface Props {
  parentId: string | null | undefined;
  subcategoryId: string | null | undefined;
  onChange: (parentId: string | null, subcategoryId: string | null) => void;
  disabled?: boolean;
  parentPlaceholder?: string;
  subPlaceholder?: string;
}

export function CompanyCategoryPicker({
  parentId,
  subcategoryId,
  onChange,
  disabled,
  parentPlaceholder = 'Select parent category',
  subPlaceholder = 'Select sub-category',
}: Props) {
  const { data: parents = [] } = useCompanyCategories();
  const { data: subs = [] } = useCompanySubcategories(parentId || undefined);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={parentId || '__none__'}
        onValueChange={(v) => onChange(v === '__none__' ? null : v, null)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={parentPlaceholder} />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="__none__">— None —</SelectItem>
          {parents.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={subcategoryId || '__none__'}
        onValueChange={(v) => onChange(parentId || null, v === '__none__' ? null : v)}
        disabled={disabled || !parentId}
      >
        <SelectTrigger>
          <SelectValue placeholder={parentId ? subPlaceholder : 'Pick parent first'} />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="__none__">— None —</SelectItem>
          {subs.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
