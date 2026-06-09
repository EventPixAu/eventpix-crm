import { ClientBriefTemplatesManager } from '@/components/admin/ClientBriefTemplatesManager';

export default function EventBriefTemplates() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Event Brief Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Client-facing brief templates shared via the Client Portal.
        </p>
      </div>
      <ClientBriefTemplatesManager />
    </div>
  );
}
