/**
 * CLIENT TYPE PICKER
 *
 * Simple Direct/Indirect/Unassigned select.
 * - Direct: company books EventPix for their own events
 * - Indirect: company books EventPix on behalf of their clients
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  value: 'Direct' | 'Indirect' | null | undefined;
  onChange: (value: 'Direct' | 'Indirect' | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ClientTypePicker({ value, onChange, disabled, placeholder = 'Select client type' }: Props) {
  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) =>
        onChange(v === '__none__' ? null : (v as 'Direct' | 'Indirect'))
      }
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-background z-50">
        <SelectItem value="__none__">— Unassigned —</SelectItem>
        <SelectItem value="Direct">Direct (books for own events)</SelectItem>
        <SelectItem value="Indirect">Indirect (books for their clients)</SelectItem>
      </SelectContent>
    </Select>
  );
}
