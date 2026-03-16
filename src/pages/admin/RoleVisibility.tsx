import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EVENT_SECTIONS, useRoleSectionVisibility, useToggleSectionVisibility } from '@/hooks/useRoleSectionVisibility';
import { toast } from 'sonner';

const CONFIGURABLE_ROLES = [
  { key: 'operations', label: 'Operations' },
] as const;

export default function RoleVisibility() {
  const activeRole = CONFIGURABLE_ROLES[0].key;
  const { data: rules = [], isLoading } = useRoleSectionVisibility(activeRole);
  const toggleMutation = useToggleSectionVisibility();

  const isVisible = (sectionKey: string) => {
    const rule = rules.find(r => r.section_key === sectionKey);
    return rule ? rule.is_visible : true; // default visible
  };

  const handleToggle = (sectionKey: string, currentValue: boolean) => {
    toggleMutation.mutate(
      { role: activeRole, sectionKey, isVisible: !currentValue },
      {
        onSuccess: () => toast.success(`Section ${!currentValue ? 'shown' : 'hidden'} for ${activeRole}`),
        onError: (err) => toast.error('Failed to update: ' + err.message),
      }
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Event Page Visibility"
        subtitle="Control which sections of the Event page are visible to each role. Admins always see all sections."
      />

      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Configuring for:</span>
          <Badge variant="default" className="text-sm px-3 py-1 capitalize">{activeRole}</Badge>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))
          ) : (
            EVENT_SECTIONS.map((section) => {
              const visible = isVisible(section.key);
              return (
                <div key={section.key} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>
                  <Switch
                    checked={visible}
                    onCheckedChange={() => handleToggle(section.key, visible)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
