import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format, parseISO } from "https://esm.sh/date-fns@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format date for ICS (YYYYMMDD or YYYYMMDDTHHMMSS)
function formatICSDate(dateStr: string, timeStr?: string | null): string {
  const date = parseISO(dateStr);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0);
    return format(date, "yyyyMMdd'T'HHmmss");
  }
  return format(date, "yyyyMMdd");
}

// Escape special characters for ICS
function escapeICS(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Fold long lines per ICS spec (max 75 chars)
function foldLine(line: string): string {
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    chunks.push(remaining.substring(0, 75));
    remaining = ' ' + remaining.substring(75);
  }
  chunks.push(remaining);
  return chunks.join('\r\n');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const token = url.searchParams.get('token');
    
    // Simple token-based authentication for feed URLs
    // In production, you'd want a more secure token system
    if (!userId || !token) {
      return new Response("Missing user_id or token", { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token matches the user's feed token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, calendar_feed_token')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.calendar_feed_token !== token) {
      return new Response("Invalid token", { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Determine if this user should see ALL events (admin/operations/executive)
    // Note: this feed is protected by the user's token, not JWT.
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return new Response("Error fetching user roles", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const roleNames = new Set((roles || []).map((r: any) => r.role));
    const isPrivilegedUser =
      roleNames.has('admin') || roleNames.has('operations') || roleNames.has('executive');

    // Fetch events (next 6 months + past 1 month)
    const now = new Date();
    const pastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const futureDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);

    // For privileged users, show all events. Otherwise, only events assigned to them.
    let assignedEvents: any[] = [];
    if (isPrivilegedUser) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          client_name,
          event_date,
          start_time,
          end_time,
          venue_name,
          venue_address,
          special_instructions,
          event_sessions (
            id,
            session_date,
            start_time,
            end_time,
            label,
            venue_name,
            venue_address
          )
        `)
        .gte('event_date', format(pastDate, 'yyyy-MM-dd'))
        .lte('event_date', format(futureDate, 'yyyy-MM-dd'));

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return new Response("Error fetching events", {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Normalize to match the existing loop's shape (assignment.events)
      assignedEvents = (events || []).map((e) => ({ events: e }));
    } else {
      const { data: assignments, error: assignmentError } = await supabase
        .from('event_assignments')
        .select(`
          event_id,
          events!inner (
            id,
            event_name,
            client_name,
            event_date,
            start_time,
            end_time,
            venue_name,
            venue_address,
            special_instructions,
            event_sessions (
              id,
              session_date,
              start_time,
              end_time,
              label,
              venue_name,
              venue_address
            )
          )
        `)
        .eq('user_id', userId);

      if (assignmentError) {
        console.error('Error fetching events:', assignmentError);
        return new Response("Error fetching events", {
          status: 500,
          headers: corsHeaders,
        });
      }

      assignedEvents = assignments || [];
    }

    // Build ICS content
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Eventpix//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Eventpix Events',
      'X-WR-TIMEZONE:Australia/Sydney',
    ];

    for (const assignment of assignedEvents || []) {
      const event = assignment.events as any;
      if (!event) continue;

      const sessions = (event.event_sessions as any[]) || [];

      // If event has sessions, create one VEVENT per session
      if (sessions.length > 0) {
        for (const session of sessions) {
          const sessionDate = session.session_date;
          // Filter by date range
          if (sessionDate < format(pastDate, 'yyyy-MM-dd') || sessionDate > format(futureDate, 'yyyy-MM-dd')) {
            continue;
          }

          const dtstart = formatICSDate(sessionDate, session.start_time || event.start_time);
          const dtend = (session.end_time || event.end_time)
            ? formatICSDate(sessionDate, session.end_time || event.end_time)
            : formatICSDate(sessionDate, session.start_time || event.start_time || '11:00:00');

          const location = [session.venue_name || event.venue_name, session.venue_address || event.venue_address]
            .filter(Boolean)
            .join(', ');

          const eventTitle = session.label ? `${event.event_name} - ${session.label}` : event.event_name;

          const description = [
            `Client: ${event.client_name || 'TBC'}`,
            event.special_instructions ? `Notes: ${event.special_instructions}` : ''
          ].filter(Boolean).join('\\n');

          icsLines.push('BEGIN:VEVENT');
          icsLines.push(`UID:${session.id}@eventpix.app`);
          icsLines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
          
          if (session.start_time || event.start_time) {
            icsLines.push(`DTSTART:${dtstart}`);
            icsLines.push(`DTEND:${dtend}`);
          } else {
            icsLines.push(`DTSTART;VALUE=DATE:${formatICSDate(sessionDate)}`);
            icsLines.push(`DTEND;VALUE=DATE:${formatICSDate(sessionDate)}`);
          }
          
          icsLines.push(foldLine(`SUMMARY:${escapeICS(eventTitle)}`));
          
          if (description) {
            icsLines.push(foldLine(`DESCRIPTION:${escapeICS(description)}`));
          }
          
          if (location) {
            icsLines.push(foldLine(`LOCATION:${escapeICS(location)}`));
          }
          
          icsLines.push('END:VEVENT');
        }
      } else {
        // No sessions - use main event date (if in range)
        if (event.event_date < format(pastDate, 'yyyy-MM-dd') || event.event_date > format(futureDate, 'yyyy-MM-dd')) {
          continue;
        }

        const dtstart = formatICSDate(event.event_date, event.start_time);
        const dtend = event.end_time 
          ? formatICSDate(event.event_date, event.end_time)
          : formatICSDate(event.event_date, event.start_time || '11:00:00');

        const location = [event.venue_name, event.venue_address]
          .filter(Boolean)
          .join(', ');

        const description = [
          `Client: ${event.client_name || 'TBC'}`,
          event.special_instructions ? `Notes: ${event.special_instructions}` : ''
        ].filter(Boolean).join('\\n');

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:${event.id}@eventpix.app`);
        icsLines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
        
        if (event.start_time) {
          icsLines.push(`DTSTART:${dtstart}`);
          icsLines.push(`DTEND:${dtend}`);
        } else {
          icsLines.push(`DTSTART;VALUE=DATE:${formatICSDate(event.event_date)}`);
          icsLines.push(`DTEND;VALUE=DATE:${formatICSDate(event.event_date)}`);
        }
        
        icsLines.push(foldLine(`SUMMARY:${escapeICS(event.event_name)}`));
        
        if (description) {
          icsLines.push(foldLine(`DESCRIPTION:${escapeICS(description)}`));
        }
        
        if (location) {
          icsLines.push(foldLine(`LOCATION:${escapeICS(location)}`));
        }
        
        icsLines.push('END:VEVENT');
      }
    }

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');

    return new Response(icsContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="eventpix-calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Calendar feed error:', error);
    return new Response("Internal server error", { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
