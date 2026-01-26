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

    // Fetch events assigned to this user (next 6 months + past 1 month)
    const now = new Date();
    const pastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const futureDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);

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
          special_instructions
        )
      `)
      .eq('user_id', userId)
      .gte('events.event_date', format(pastDate, 'yyyy-MM-dd'))
      .lte('events.event_date', format(futureDate, 'yyyy-MM-dd'));

    if (assignmentError) {
      console.error('Error fetching events:', assignmentError);
      return new Response("Error fetching events", { 
        status: 500, 
        headers: corsHeaders 
      });
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

    for (const assignment of assignments || []) {
      const event = assignment.events as any;
      if (!event) continue;

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
        // All-day event
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
