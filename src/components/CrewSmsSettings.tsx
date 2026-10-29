import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  setup: boolean | null;
  delivery: boolean | null;
  onChange: (kind: 'setup' | 'delivery', value: boolean | null) => void;
  inherit?: boolean;
  disabled?: boolean;
  lba?: boolean;
}

export function CrewSmsSettings({ setup, delivery, onChange, inherit = false, disabled = false, lba = false }: Props) {
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">Team SMS reminders</h3>
    {lba && <p className="text-sm text-muted-foreground">Not required for LBA — all work is completed onsite.</p>}
    {(['setup', 'delivery'] as const).map(kind => {
      const value = kind === 'setup' ? setup : delivery;
      const label = kind === 'setup' ? 'Setup reminder' : 'File-delivery reminder';
      return <div key={kind} className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        {inherit && !lba ? <Select value={value === null ? 'inherit' : value ? 'on' : 'off'} disabled={disabled} onValueChange={v => onChange(kind, v === 'inherit' ? null : v === 'on')}>
          <SelectTrigger aria-label={label} className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="inherit">Series / default</SelectItem><SelectItem value="on">On</SelectItem><SelectItem value="off">Off</SelectItem></SelectContent>
        </Select> : <Switch aria-label={label} checked={!lba && (value ?? true)} disabled={disabled || lba} onCheckedChange={v => onChange(kind, v)} />}
      </div>;
    })}
  </section>;
}