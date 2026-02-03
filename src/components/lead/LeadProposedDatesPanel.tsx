/**
 * LEAD PROPOSED DATES PANEL
 * 
 * Displays and manages multiple proposed dates/times for a lead.
 * Leads are read-only, so this only shows dates received from website form.
 */
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLeadSessions } from '@/hooks/useEventSessions';

interface LeadProposedDatesPanelProps {
  leadId: string;
}

export function LeadProposedDatesPanel({ leadId }: LeadProposedDatesPanelProps) {
  const { data: sessions = [], isLoading } = useLeadSessions(leadId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Proposed Dates</CardTitle>
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
          <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
            <Lock className="h-3 w-3" />
            From enquiry
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No proposed dates submitted
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, index) => (
              <div key={session.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {index + 1}
                      </div>
                    <div>
                        <span className="font-medium">
                          {session.label || `Day ${index + 1}`}
                        </span>
                        {session.session_date && (
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(session.session_date), 'EEEE, d MMMM yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                    {session.session_date && (
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(session.session_date), 'MMM d')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground ml-8">
                    {(session.start_time || session.end_time) && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {session.start_time && format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a')}
                        {session.start_time && session.end_time && ' – '}
                        {session.end_time && format(new Date(`2000-01-01T${session.end_time}`), 'h:mm a')}
                      </div>
                    )}
                    
                    {session.venue_name && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.venue_name}
                      </div>
                    )}
                  </div>
                  
                  {session.notes && (
                    <div className="text-sm text-muted-foreground ml-8 italic">
                      {session.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
