/**
 * LEAD PROPOSED DATES PANEL
 * 
 * Displays and manages multiple proposed dates/times for a lead.
 * Uses EventSessionsEditor for full CRUD functionality.
 */
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLeadSessions } from '@/hooks/useEventSessions';
import { EventSessionsEditor } from '@/components/EventSessionsEditor';

interface LeadProposedDatesPanelProps {
  leadId: string;
  disabled?: boolean;
}

export function LeadProposedDatesPanel({ leadId, disabled = false }: LeadProposedDatesPanelProps) {
  const { data: sessions = [], isLoading } = useLeadSessions(leadId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Event Sessions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Event Sessions</CardTitle>
            {sessions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {sessions.length}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <EventSessionsEditor 
          leadId={leadId} 
          disabled={disabled}
          hideHeader
        />
      </CardContent>
    </Card>
  );
}
