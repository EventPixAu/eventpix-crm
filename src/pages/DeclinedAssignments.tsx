import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';
import { XCircle, Users, Calendar, MessageSquare } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

type DeclinedAssignment = {
  id: string;
  declined_at: string | null;
  decline_reason: string | null;
  role_on_event: string | null;
  staff_roles: { name: string } | null;
  staff: { name: string } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  events: { id: string; event_name: string; event_date: string } | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = value.length <= 10 ? parseISO(value) : new Date(value);
  return isValid(d) ? format(d, 'EEE d MMM yyyy') : null;
};

export default function DeclinedAssignments() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['declined-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`id, declined_at, decline_reason, role_on_event,
          staff_roles:staff_roles!event_assignments_staff_role_id_fkey(name),
          staff:staff!event_assignments_staff_id_fkey(name),
          profiles:profiles!event_assignments_user_id_fkey(first_name, last_name),
          events:events!event_assignments_event_id_fkey(id, event_name, event_date)`)
        .eq('confirmation_status', 'declined')
        .order('declined_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as DeclinedAssignment[];
    },
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = a.declined_at ? new Date(a.declined_at).getTime() : 0;
      const db = b.declined_at ? new Date(b.declined_at).getTime() : 0;
      return db - da;
    });
  }, [rows]);

  const personName = (row: DeclinedAssignment) => {
    const staffName = row.staff?.name?.trim();
    if (staffName) return staffName;
    const first = row.profiles?.first_name?.trim() || '';
    const last = row.profiles?.last_name?.trim() || '';
    const full = `${first} ${last}`.trim();
    return full || 'Unknown team member';
  };

  const roleName = (row: DeclinedAssignment) =>
    row.staff_roles?.name || row.role_on_event || 'Team member';

  return (
    <AppLayout>
      <PageHeader
        title="Declined"
        subtitle="Team members who have marked themselves unavailable for an event"
      />
      <div className="p-4 md:p-6 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <XCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="font-medium">No declined assignments</p>
              <p className="text-sm text-muted-foreground">
                When a team member taps "Not available" on an assignment, it will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {sorted.length} declined assignment{sorted.length === 1 ? '' : 's'}
            </p>
            {sorted.map((row) => {
              const eventDate = formatDate(row.events?.event_date);
              const declinedDate = row.declined_at ? format(new Date(row.declined_at), 'd MMM yyyy, h:mm a') : null;
              return (
                <Card key={row.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {personName(row)}
                          </span>
                          <Badge variant="outline">{roleName(row)}</Badge>
                        </div>
                        {row.events && (
                          <Link
                            to={`/events/${row.events.id}`}
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {row.events.event_name}
                            {eventDate ? ` · ${eventDate}` : ''}
                          </Link>
                        )}
                      </div>
                      <div className="md:w-80 shrink-0 space-y-1">
                        {row.decline_reason ? (
                          <p className="text-sm flex items-start gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <span>{row.decline_reason}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No reason given</p>
                        )}
                        {declinedDate && (
                          <p className="text-xs text-muted-foreground">Declined {declinedDate}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
