import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VISIBILITY_PAGES, PAGE_SECTIONS, useRoleSectionVisibility, useToggleSectionVisibility, type PageKey } from '@/hooks/useRoleSectionVisibility';
import { toast } from 'sonner';

const CONFIGURABLE_ROLES = [
  { key: 'operations', label: 'Operations' },
  { key: 'photographer', label: 'Photographers' },
  { key: 'assistant', label: 'Assistants' },
  { key: 'client', label: 'Clients' },
] as const;

export default function RoleVisibility() {
  const [activeRole, setActiveRole] = useState<string>(CONFIGURABLE_ROLES[0].key);
  const [activePage, setActivePage] = useState<PageKey>('event_detail');
  const { data: rules = [], isLoading } = useRoleSectionVisibility(activeRole);
  const toggleMutation = useToggleSectionVisibility();

  const sections = PAGE_SECTIONS[activePage] || [];

  const isVisible = (sectionKey: string) => {
    const rule = rules.find(r => r.section_key === sectionKey && (r as any).page_key === activePage);
    // Also check legacy rules without page_key for event_detail
    if (!rule && activePage === 'event_detail') {
      const legacyRule = rules.find(r => r.section_key === sectionKey && !(r as any).page_key);
      return legacyRule ? legacyRule.is_visible : true;
    }
    return rule ? rule.is_visible : true;
  };

  const handleToggle = (sectionKey: string, currentValue: boolean) => {
    toggleMutation.mutate(
      { role: activeRole, sectionKey, isVisible: !currentValue, pageKey: activePage },
      {
        onSuccess: () => toast.success(`Section ${!currentValue ? 'shown' : 'hidden'} for ${activeRole}`),
        onError: (err) => toast.error('Failed to update: ' + err.message),
      }
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Page Visibility"
        description="Control which sections are visible to each role across different pages. Admins always see all sections."
      />

      <div className="max-w-3xl mx-auto">
        {/* Role selector */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Role:</span>
          <div className="flex gap-2 flex-wrap">
            {CONFIGURABLE_ROLES.map((role) => (
              <Badge
                key={role.key}
                variant={activeRole === role.key ? 'default' : 'outline'}
                className="text-sm px-3 py-1 cursor-pointer capitalize"
                onClick={() => setActiveRole(role.key)}
              >
                {role.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Page tabs */}
        <Tabs value={activePage} onValueChange={(v) => setActivePage(v as PageKey)} className="mb-6">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {VISIBILITY_PAGES.map((page) => (
              <TabsTrigger key={page.key} value={page.key} className="text-xs sm:text-sm">
                {page.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Sections list */}
        <div className="bg-card border border-border rounded-xl shadow-card divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))
          ) : sections.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No sections configured for this page yet.
            </div>
          ) : (
            sections.map((section) => {
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
