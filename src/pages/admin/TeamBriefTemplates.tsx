import { EventBriefTemplatesManager } from '@/components/admin/EventBriefTemplatesManager';

export default function TeamBriefTemplates() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Team Brief Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Standard brief templates applied to events for internal team use.
        </p>
      </div>
      <EventBriefTemplatesManager />
    </div>
  );
}
