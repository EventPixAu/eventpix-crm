import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format, parseISO } from "https://esm.sh/date-fns@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VTIMEZONE definitions for AU/NZ timezones
const VTIMEZONE_DEFS: Record<string, string> = {
  'Australia/Sydney': `BEGIN:VTIMEZONE
TZID:Australia/Sydney
X-LIC-LOCATION:Australia/Sydney
BEGIN:STANDARD
DTSTART:19700405T030000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
TZOFFSETFROM:+1100
TZOFFSETTO:+1000
TZNAME:AEST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19701004T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU
TZOFFSETFROM:+1000
TZOFFSETTO:+1100
TZNAME:AEDT
END:DAYLIGHT
END:VTIMEZONE`,
  'Australia/Melbourne': `BEGIN:VTIMEZONE
TZID:Australia/Melbourne
X-LIC-LOCATION:Australia/Melbourne
BEGIN:STANDARD
DTSTART:19700405T030000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
TZOFFSETFROM:+1100
TZOFFSETTO:+1000
TZNAME:AEST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19701004T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU
TZOFFSETFROM:+1000
TZOFFSETTO:+1100
TZNAME:AEDT
END:DAYLIGHT
END:VTIMEZONE`,
  'Australia/Brisbane': `BEGIN:VTIMEZONE
TZID:Australia/Brisbane
X-LIC-LOCATION:Australia/Brisbane
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+1000
TZOFFSETTO:+1000
TZNAME:AEST
END:STANDARD
END:VTIMEZONE`,
  'Australia/Adelaide': `BEGIN:VTIMEZONE
TZID:Australia/Adelaide
X-LIC-LOCATION:Australia/Adelaide
BEGIN:STANDARD
DTSTART:19700405T030000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
TZOFFSETFROM:+1030
TZOFFSETTO:+0930
TZNAME:ACST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19701004T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU
TZOFFSETFROM:+0930
TZOFFSETTO:+1030
TZNAME:ACDT
END:DAYLIGHT
END:VTIMEZONE`,
  'Australia/Darwin': `BEGIN:VTIMEZONE
TZID:Australia/Darwin
X-LIC-LOCATION:Australia/Darwin
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0930
TZOFFSETTO:+0930
TZNAME:ACST
END:STANDARD
END:VTIMEZONE`,
  'Australia/Perth': `BEGIN:VTIMEZONE
TZID:Australia/Perth
X-LIC-LOCATION:Australia/Perth
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:AWST
END:STANDARD
END:VTIMEZONE`,
  'Australia/Hobart': `BEGIN:VTIMEZONE
TZID:Australia/Hobart
X-LIC-LOCATION:Australia/Hobart
BEGIN:STANDARD
DTSTART:19700405T030000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
TZOFFSETFROM:+1100
TZOFFSETTO:+1000
TZNAME:AEST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19701004T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU
TZOFFSETFROM:+1000
TZOFFSETTO:+1100
TZNAME:AEDT
END:DAYLIGHT
END:VTIMEZONE`,
  'Pacific/Auckland': `BEGIN:VTIMEZONE
TZID:Pacific/Auckland
X-LIC-LOCATION:Pacific/Auckland
BEGIN:STANDARD
DTSTART:19700405T030000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
TZOFFSETFROM:+1300
TZOFFSETTO:+1200
TZNAME:NZST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700927T020000
RRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=-1SU
TZOFFSETFROM:+1200
TZOFFSETTO:+1300
TZNAME:NZDT
END:DAYLIGHT
END:VTIMEZONE`,
};

// Get timezone abbreviation for display
function getTzAbbr(tz: string): string {
  const abbrs: Record<string, string> = {
    'Australia/Sydney': 'SYD',
    'Australia/Melbourne': 'MEL',
    'Australia/Brisbane': 'BNE',
    'Australia/Adelaide': 'ADL',
    'Australia/Darwin': 'DRW',
    'Australia/Perth': 'PER',
    'Australia/Hobart': 'HBA',
    'Pacific/Auckland': 'AKL',
  };
  return abbrs[tz] || 'SYD';
}

// Format date for ICS with timezone (YYYYMMDD or YYYYMMDDTHHMMSS)
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

    // For privileged users, show all events AND leads. Otherwise, only events assigned to them.
    let assignedEvents: any[] = [];
    let leads: any[] = [];
    
    if (isPrivilegedUser) {
      // Fetch all confirmed events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          client_name,
          event_date,
          start_time,
          end_time,
          timezone,
          venue_name,
          venue_address,
          special_instructions,
          event_sessions (
            id,
            session_date,
            start_time,
            end_time,
            arrival_time,
            timezone,
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
      
      // Fetch active leads (not converted, not lost) with proposed dates
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          lead_name,
          client_name,
          proposed_event_date,
          event_type,
          timezone,
          venue_name,
          venue_address,
          status,
          lead_proposed_dates (
            id,
            proposed_date,
            start_time,
            end_time,
            notes
          )
        `)
        .in('status', ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating'])
        .or(`proposed_event_date.gte.${format(pastDate, 'yyyy-MM-dd')},lead_proposed_dates.proposed_date.gte.${format(pastDate, 'yyyy-MM-dd')}`);

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
        // Don't fail - just proceed without leads
      } else {
        leads = leadsData || [];
      }
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
            timezone,
            venue_name,
            venue_address,
            special_instructions,
            event_sessions (
              id,
              session_date,
              start_time,
              end_time,
              arrival_time,
              timezone,
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

    // Collect all unique timezones used
    const usedTimezones = new Set<string>();
    usedTimezones.add('Australia/Sydney'); // Always include default

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

    // First pass: collect all timezones
    for (const assignment of assignedEvents || []) {
      const event = assignment.events as any;
      if (!event) continue;
      
      const eventTz = event.timezone || 'Australia/Sydney';
      usedTimezones.add(eventTz);
      
      const sessions = (event.event_sessions as any[]) || [];
      for (const session of sessions) {
        const sessionTz = session.timezone || eventTz;
        usedTimezones.add(sessionTz);
      }
    }

    // Add VTIMEZONE definitions for all used timezones
    for (const tz of usedTimezones) {
      if (VTIMEZONE_DEFS[tz]) {
        icsLines.push(VTIMEZONE_DEFS[tz]);
      }
    }

    // Second pass: generate events
    for (const assignment of assignedEvents || []) {
      const event = assignment.events as any;
      if (!event) continue;

      const sessions = (event.event_sessions as any[]) || [];
      const eventTz = event.timezone || 'Australia/Sydney';

      // If event has sessions, create one VEVENT per session
      if (sessions.length > 0) {
        for (const session of sessions) {
          const sessionDate = session.session_date;
          // Filter by date range
          if (sessionDate < format(pastDate, 'yyyy-MM-dd') || sessionDate > format(futureDate, 'yyyy-MM-dd')) {
            continue;
          }

          const sessionTz = session.timezone || eventTz;
          const tzAbbr = getTzAbbr(sessionTz);

          // Use arrival_time (Crew Call Time) as calendar start if available, otherwise fall back to start_time
          const calendarStartTime = session.arrival_time || session.start_time || event.start_time;
          const dtstart = formatICSDate(sessionDate, calendarStartTime);
          const dtend = (session.end_time || event.end_time)
            ? formatICSDate(sessionDate, session.end_time || event.end_time)
            : formatICSDate(sessionDate, calendarStartTime || '11:00:00');

          const location = [session.venue_name || event.venue_name, session.venue_address || event.venue_address]
            .filter(Boolean)
            .join(', ');

          // Include timezone abbreviation in title if not Sydney
          const eventTitle = sessionTz !== 'Australia/Sydney'
            ? (session.label ? `[${tzAbbr}] ${event.event_name} - ${session.label}` : `[${tzAbbr}] ${event.event_name}`)
            : (session.label ? `${event.event_name} - ${session.label}` : event.event_name);

          // Build description with event start/end times and timezone info
          const eventStartTime = session.start_time || event.start_time;
          const eventEndTime = session.end_time || event.end_time;
          const descriptionParts = [
            `Client: ${event.client_name || 'TBC'}`,
          ];
          
          // Add timezone info if not Sydney
          if (sessionTz !== 'Australia/Sydney') {
            descriptionParts.push(`Timezone: ${sessionTz}`);
          }
          
          // Add event timing info
          if (eventStartTime) {
            const startFormatted = eventStartTime.substring(0, 5); // HH:mm
            const endFormatted = eventEndTime ? eventEndTime.substring(0, 5) : null;
            descriptionParts.push(`Event: ${startFormatted}${endFormatted ? ' - ' + endFormatted : ''}`);
          }
          
          if (event.special_instructions) {
            descriptionParts.push(`Notes: ${event.special_instructions}`);
          }
          
          const description = descriptionParts.join('\\n');

          icsLines.push('BEGIN:VEVENT');
          icsLines.push(`UID:${session.id}@eventpix.app`);
          icsLines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
          
          if (calendarStartTime) {
            // Use TZID parameter for timezone-aware times
            icsLines.push(`DTSTART;TZID=${sessionTz}:${dtstart}`);
            icsLines.push(`DTEND;TZID=${sessionTz}:${dtend}`);
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

        const tzAbbr = getTzAbbr(eventTz);
        const dtstart = formatICSDate(event.event_date, event.start_time);
        const dtend = event.end_time 
          ? formatICSDate(event.event_date, event.end_time)
          : formatICSDate(event.event_date, event.start_time || '11:00:00');

        const location = [event.venue_name, event.venue_address]
          .filter(Boolean)
          .join(', ');

        // Include timezone abbreviation in title if not Sydney
        const eventTitle = eventTz !== 'Australia/Sydney'
          ? `[${tzAbbr}] ${event.event_name}`
          : event.event_name;

        const descriptionParts = [
          `Client: ${event.client_name || 'TBC'}`,
        ];
        
        if (eventTz !== 'Australia/Sydney') {
          descriptionParts.push(`Timezone: ${eventTz}`);
        }
        
        if (event.special_instructions) {
          descriptionParts.push(`Notes: ${event.special_instructions}`);
        }
        
        const description = descriptionParts.join('\\n');

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:${event.id}@eventpix.app`);
        icsLines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
        
        if (event.start_time) {
          icsLines.push(`DTSTART;TZID=${eventTz}:${dtstart}`);
          icsLines.push(`DTEND;TZID=${eventTz}:${dtend}`);
        } else {
          icsLines.push(`DTSTART;VALUE=DATE:${formatICSDate(event.event_date)}`);
          icsLines.push(`DTEND;VALUE=DATE:${formatICSDate(event.event_date)}`);
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
    }

    // Generate VEVENT entries for leads (privileged users only)
    for (const lead of leads) {
      const leadTz = lead.timezone || 'Australia/Sydney';
      usedTimezones.add(leadTz);
      
      const proposedDates = (lead.lead_proposed_dates as any[]) || [];
      
      // If lead has proposed dates, create one VEVENT per proposed date
      if (proposedDates.length > 0) {
        for (const proposedDate of proposedDates) {
          const dateStr = proposedDate.proposed_date;
          // Filter by date range
          if (dateStr < format(pastDate, 'yyyy-MM-dd') || dateStr > format(futureDate, 'yyyy-MM-dd')) {
            continue;
          }

          const tzAbbr = getTzAbbr(leadTz);
          const dtstart = formatICSDate(dateStr, proposedDate.start_time);
          const dtend = proposedDate.end_time
            ? formatICSDate(dateStr, proposedDate.end_time)
            : formatICSDate(dateStr, proposedDate.start_time || '10:00:00');

          const location = [lead.venue_name, lead.venue_address]
            .filter(Boolean)
            .join(', ');

          // Prefix with [LEAD] and timezone if not Sydney
          const leadTitle = leadTz !== 'Australia/Sydney'
            ? `[LEAD ${tzAbbr}] ${lead.lead_name}`
            : `[LEAD] ${lead.lead_name}`;

          const descriptionParts = [
            `Client: ${lead.client_name || 'TBC'}`,
            `Status: ${lead.status}`,
          ];
          
          if (lead.event_type) {
            descriptionParts.push(`Type: ${lead.event_type}`);
          }
          
          if (leadTz !== 'Australia/Sydney') {
            descriptionParts.push(`Timezone: ${leadTz}`);
          }
          
          if (proposedDate.notes) {
            descriptionParts.push(`Notes: ${proposedDate.notes}`);
          }
          
          const description = descriptionParts.join('\\n');

          icsLines.push('BEGIN:VEVENT');
          icsLines.push(`UID:lead-${lead.id}-date-${proposedDate.id}@eventpix.app`);
          icsLines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
          
          if (proposedDate.start_time) {
            icsLines.push(`DTSTART;TZID=${leadTz}:${dtstart}`);
            icsLines.push(`DTEND;TZID=${leadTz}:${dtend}`);
          } else {
            icsLines.push(`DTSTART;VALUE=DATE:${formatICSDate(dateStr)}`);
            icsLines.push(`DTEND;VALUE=DATE:${formatICSDate(dateStr)}`);
          }
          
          icsLines.push(foldLine(`SUMMARY:${escapeICS(leadTitle)}`));
          
          if (description) {
            icsLines.push(foldLine(`DESCRIPTION:${escapeICS(description)}`));
          }
          
          if (location) {
            icsLines.push(foldLine(`LOCATION:${escapeICS(location)}`));
          }
          
          icsLines.push('END:VEVENT');
        }
      } else if (lead.proposed_event_date) {
        // No proposed dates table entries - use main proposed_event_date
        const dateStr = lead.proposed_event_date;
        if (dateStr < format(pastDate, 'yyyy-MM-dd') || dateStr > format(futureDate, 'yyyy-MM-dd')) {
          continue;
        }

        const tzAbbr = getTzAbbr(leadTz);
        
        const location = [lead.venue_name, lead.venue_address]
          .filter(Boolean)
          .join(', ');

        // Prefix with [LEAD] and timezone if not Sydney
        const leadTitle = leadTz !== 'Australia/Sydney'
          ? `[LEAD ${tzAbbr}] ${lead.lead_name}`
          : `[LEAD] ${lead.lead_name}`;

        const descriptionParts = [
          `Client: ${lead.client_name || 'TBC'}`,
          `Status: ${lead.status}`,
        ];
        
        if (lead.event_type) {
          descriptionParts.push(`Type: ${lead.event_type}`);
        }
        
        if (leadTz !== 'Australia/Sydney') {
          descriptionParts.push(`Timezone: ${leadTz}`);
        }
        
        const description = descriptionParts.join('\\n');

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:lead-${lead.id}@eventpix.app`);
        icsLines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
        icsLines.push(`DTSTART;VALUE=DATE:${formatICSDate(dateStr)}`);
        icsLines.push(`DTEND;VALUE=DATE:${formatICSDate(dateStr)}`);
        icsLines.push(foldLine(`SUMMARY:${escapeICS(leadTitle)}`));
        
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
