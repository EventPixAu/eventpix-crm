import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  type: "assignment" | "event_update";
  event_id: string;
  user_id?: string;
  assignment_id?: string;
}

// ── Gmail API helpers ──

async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth2 credentials not configured");
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMimeWithIcs(to: string, subject: string, html: string, icsContent: string): string {
  const boundary = `b_${crypto.randomUUID().replace(/-/g, "")}`;
  const from = '"EventPix" <pix@eventpix.com.au>';
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));

  let mime = `From: ${from}\r\nTo: ${to}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\n`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  // HTML part
  mime += `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  mime += btoa(unescape(encodeURIComponent(html))) + "\r\n";

  // ICS calendar part (inline)
  mime += `--${boundary}\r\nContent-Type: text/calendar; charset=UTF-8; method=REQUEST\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  mime += icsBase64 + "\r\n";

  // ICS attachment
  mime += `--${boundary}\r\nContent-Type: text/calendar; name="event.ics"\r\nContent-Disposition: attachment; filename="event.ics"\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  mime += icsBase64 + "\r\n";

  mime += `--${boundary}--`;
  return mime;
}

async function sendViaGmailApi(to: string, subject: string, html: string, icsContent: string): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const mime = buildMimeWithIcs(to, subject, html, icsContent);
  const raw = base64UrlEncode(mime);
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!resp.ok) throw new Error(`Gmail API error: ${await resp.text()}`);
}

// ── ICS helpers ──

function generateICS(event: any, sequence: number, appUrl: string, sessionId?: string): string {
  const uid = sessionId ? `${event.id}-${sessionId}@eventpix.com.au` : `${event.id}@eventpix.com.au`;
  const dtstamp = formatDateToICS(new Date());
  let dtstart: string, dtend: string;
  const timezone = event.timezone || 'Australia/Sydney';
  const timezoneBlock = getVTimezone(timezone);

  if (event.start_at) {
    dtstart = formatDateToICS(new Date(event.start_at));
    dtend = event.end_at ? formatDateToICS(new Date(event.end_at))
      : formatDateToICS(new Date(new Date(event.start_at).getTime() + 2 * 3600000));
  } else {
    dtstart = formatLocalDateTimeToICS(event.event_date, event.start_time || '09:00:00');
    if (event.end_time) {
      const endDate = shouldEndNextDay(event.start_time, event.end_time) ? addDays(event.event_date, 1) : event.event_date;
      dtend = formatLocalDateTimeToICS(endDate, event.end_time);
    } else { dtend = formatLocalDateTimeToICS(event.event_date, addHoursToTime(event.start_time || '09:00:00', 2)); }
  }

  const location = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const description = [
    event.coverage_details,
    event.onsite_contact_name ? `On-site contact: ${event.onsite_contact_name}` : null,
    event.onsite_contact_phone ? `Phone: ${event.onsite_contact_phone}` : null,
    `View in app: ${appUrl}/events/${event.id}`,
  ].filter(Boolean).join("\\n");

  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Eventpix//Event Management//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\n${timezoneBlock ? `${timezoneBlock}\r\n` : ''}BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:${dtstamp}\r\nDTSTART;TZID=${timezone}:${dtstart}\r\nDTEND;TZID=${timezone}:${dtend}\r\nSUMMARY:${escapeICS(event.event_name)}\r\nLOCATION:${escapeICS(location)}\r\nDESCRIPTION:${escapeICS(description)}\r\nSEQUENCE:${sequence}\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR`;
}

function formatDateToICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function formatLocalDateTimeToICS(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const [hour = '00', minute = '00', second = '00'] = timeStr.split(':');
  return `${year}${month}${day}T${hour.padStart(2, '0')}${minute.padStart(2, '0')}${second.padStart(2, '0')}`;
}
function shouldEndNextDay(startTime?: string | null, endTime?: string | null): boolean {
  if (!startTime || !endTime) return false;
  return endTime < startTime;
}
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
function addHoursToTime(timeStr: string, hoursToAdd: number): string {
  const [hours = '0', minutes = '0', seconds = '0'] = timeStr.split(':');
  const totalMinutes = Number(hours) * 60 + Number(minutes) + hoursToAdd * 60;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60).toString().padStart(2, '0');
  const minute = (wrapped % 60).toString().padStart(2, '0');
  return `${hour}:${minute}:${seconds.padStart(2, '0')}`;
}
function getVTimezone(tz: string): string {
  const defs: Record<string, string> = {
    'Australia/Sydney': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Sydney\r\nX-LIC-LOCATION:Australia/Sydney\r\nBEGIN:STANDARD\r\nDTSTART:19700405T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU\r\nTZOFFSETFROM:+1100\r\nTZOFFSETTO:+1000\r\nTZNAME:AEST\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19701004T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU\r\nTZOFFSETFROM:+1000\r\nTZOFFSETTO:+1100\r\nTZNAME:AEDT\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE',
    'Australia/Melbourne': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Melbourne\r\nX-LIC-LOCATION:Australia/Melbourne\r\nBEGIN:STANDARD\r\nDTSTART:19700405T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU\r\nTZOFFSETFROM:+1100\r\nTZOFFSETTO:+1000\r\nTZNAME:AEST\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19701004T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU\r\nTZOFFSETFROM:+1000\r\nTZOFFSETTO:+1100\r\nTZNAME:AEDT\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE',
    'Australia/Brisbane': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Brisbane\r\nX-LIC-LOCATION:Australia/Brisbane\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+1000\r\nTZOFFSETTO:+1000\r\nTZNAME:AEST\r\nEND:STANDARD\r\nEND:VTIMEZONE',
    'Australia/Adelaide': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Adelaide\r\nX-LIC-LOCATION:Australia/Adelaide\r\nBEGIN:STANDARD\r\nDTSTART:19700405T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU\r\nTZOFFSETFROM:+1030\r\nTZOFFSETTO:+0930\r\nTZNAME:ACST\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19701004T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU\r\nTZOFFSETFROM:+0930\r\nTZOFFSETTO:+1030\r\nTZNAME:ACDT\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE',
    'Australia/Darwin': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Darwin\r\nX-LIC-LOCATION:Australia/Darwin\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0930\r\nTZOFFSETTO:+0930\r\nTZNAME:ACST\r\nEND:STANDARD\r\nEND:VTIMEZONE',
    'Australia/Perth': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Perth\r\nX-LIC-LOCATION:Australia/Perth\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0800\r\nTZOFFSETTO:+0800\r\nTZNAME:AWST\r\nEND:STANDARD\r\nEND:VTIMEZONE',
    'Australia/Hobart': 'BEGIN:VTIMEZONE\r\nTZID:Australia/Hobart\r\nX-LIC-LOCATION:Australia/Hobart\r\nBEGIN:STANDARD\r\nDTSTART:19700405T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU\r\nTZOFFSETFROM:+1100\r\nTZOFFSETTO:+1000\r\nTZNAME:AEST\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19701004T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU\r\nTZOFFSETFROM:+1000\r\nTZOFFSETTO:+1100\r\nTZNAME:AEDT\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE',
    'Pacific/Auckland': 'BEGIN:VTIMEZONE\r\nTZID:Pacific/Auckland\r\nX-LIC-LOCATION:Pacific/Auckland\r\nBEGIN:STANDARD\r\nDTSTART:19700405T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU\r\nTZOFFSETFROM:+1300\r\nTZOFFSETTO:+1200\r\nTZNAME:NZST\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19700927T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=-1SU\r\nTZOFFSETFROM:+1200\r\nTZOFFSETTO:+1300\r\nTZNAME:NZDT\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE',
  };
  return defs[tz] || '';
}
function escapeICS(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(timeStr: string | null): string {
  if (!timeStr) return 'TBD';
  const [h, m] = timeStr.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function buildEmailHtml(recipientName: string, subject: string, event: any, appUrl: string): string {
  return `<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333}
.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:12px 12px 0 0}
.header h1{color:white;margin:0;font-size:24px}.content{background:#f9fafb;padding:24px;border-radius:0 0 12px 12px}
.detail{margin-bottom:16px}.detail-label{font-size:12px;color:#6b7280;text-transform:uppercase;margin-bottom:4px}
.detail-value{font-weight:500}.button{display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px}
.footer{text-align:center;margin-top:24px;font-size:12px;color:#9ca3af}
</style></head><body><div class="container"><div class="header"><h1>📸 ${subject.includes('New assignment') ? 'New Assignment' : 'Event Updated'}</h1></div>
<div class="content"><p>Hi ${recipientName},</p>
<p>${subject.includes('New assignment') ? 'You have been assigned to the following event.' : 'The following event details have been updated:'}</p>
<div class="detail"><div class="detail-label">Event</div><div class="detail-value">${event.event_name}</div></div>
<div class="detail"><div class="detail-label">Date & Time</div><div class="detail-value">${formatDate(event.event_date)}${event.start_time ? ` at ${formatTime(event.start_time)}` : ''}${event.end_time ? ` - ${formatTime(event.end_time)}` : ''}</div></div>
${event.venue_name ? `<div class="detail"><div class="detail-label">Venue</div><div class="detail-value">${event.venue_name}${event.venue_address ? `<br>${event.venue_address}` : ''}</div></div>` : ''}
${event.onsite_contact_name ? `<div class="detail"><div class="detail-label">On-site Contact</div><div class="detail-value">${event.onsite_contact_name}${event.onsite_contact_phone ? ` - ${event.onsite_contact_phone}` : ''}</div></div>` : ''}
${event.coverage_details ? `<div class="detail"><div class="detail-label">Coverage Details</div><div class="detail-value">${event.coverage_details}</div></div>` : ''}
<a href="${appUrl}/events/${event.id}" class="button">View Event Details</a>
${subject.includes('New assignment') ? '<p style="margin-top:20px;font-weight:500;">Please confirm your availability by return email.</p>' : ''}
</div><div class="footer"><p>EventPix - Event Photography Management</p></div></div></body></html>`;
}

// ── Main handler ──

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || "https://app.eventpix.com.au";

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Server-side role check: only admin, operations, or sales may trigger notifications
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowedRoles = new Set(["admin", "operations", "sales"]);
    if (!(roleRows || []).some((r: any) => allowedRoles.has(r.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { type, event_id, user_id, assignment_id }: NotificationRequest = await req.json();

    const { data: event, error: eventError } = await supabase.from("events").select("*").eq("id", event_id).single();
    if (eventError || !event) throw new Error(`Event not found: ${eventError?.message}`);

    let recipientEmail: string | null = null;
    let recipientName: string | null = null;
    let subject: string;
    let icsContent: string;

    if (type === "assignment") {
      if (!user_id) throw new Error("user_id is required for assignment notifications");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("email, full_name").eq("id", user_id).maybeSingle();
      if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
      if (!profile) throw new Error(`No profile found for user_id: ${user_id}`);

      recipientEmail = profile.email;
      recipientName = profile.full_name || profile.email;

      // If this assignment is tied to a specific session, override event date/time/venue with session data
      let assignmentSessionId: string | undefined;
      if (assignment_id) {
        const { data: assignment } = await supabase
          .from("event_assignments")
          .select("session_id")
          .eq("id", assignment_id)
          .maybeSingle();
        if (assignment?.session_id) {
          assignmentSessionId = assignment.session_id;
          const { data: session } = await supabase
            .from("event_sessions")
            .select("session_date, start_time, end_time, venue_name, venue_address, timezone, label")
            .eq("id", assignment.session_id)
            .maybeSingle();
          if (session) {
            event.event_date = session.session_date || event.event_date;
            event.start_time = session.start_time || event.start_time;
            event.end_time = session.end_time || event.end_time;
            event.venue_name = session.venue_name || event.venue_name;
            event.venue_address = session.venue_address || event.venue_address;
            event.timezone = session.timezone || event.timezone;
          }
        }
      }

      subject = `Eventpix - New assignment: ${event.event_name} - ${formatDate(event.event_date)}`;
      icsContent = generateICS(event, event.calendar_sequence || 0, appUrl, assignmentSessionId);

      if (assignment_id) {
        await supabase.from("event_assignments").update({ notified: true }).eq("id", assignment_id);
      }
    } else {
      const { data: assignments, error: assignError } = await supabase
        .from("event_assignments").select("user_id, profiles:user_id(email, full_name)").eq("event_id", event_id);
      if (assignError) throw new Error(`Failed to fetch assignments: ${assignError.message}`);

      subject = `Eventpix - Updated details: ${event.event_name} - ${formatDate(event.event_date)}`;
      icsContent = generateICS(event, event.calendar_sequence || 0, appUrl);

      const results: { email: string; name: string }[] = [];
      for (const a of assignments || []) {
        const p = a.profiles as any;
        if (p?.email) results.push({ email: p.email, name: p.full_name || p.email });
      }

      if (results.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No assigned staff to notify" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      for (const r of results) {
        const html = buildEmailHtml(r.name, subject, event, appUrl);
        await sendViaGmailApi(`"${r.name}" <${r.email}>`, subject, html, icsContent);
        await logNotificationEmail(supabase, { recipientEmail: r.email, recipientName: r.name, subject, eventId: event_id, sentBy: user.id });
      }

      return new Response(JSON.stringify({ success: true, message: `Notified ${results.length} staff members` }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const html = buildEmailHtml(recipientName!, subject, event, appUrl);
    await sendViaGmailApi(`"${recipientName}" <${recipientEmail}>`, subject, html, icsContent);
    await logNotificationEmail(supabase, { recipientEmail: recipientEmail!, recipientName: recipientName!, subject, eventId: event_id, sentBy: user.id });

    return new Response(JSON.stringify({ success: true, message: "Notification sent via Gmail API" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function logNotificationEmail(supabase: any, params: { recipientEmail: string; recipientName: string; subject: string; eventId: string; sentBy: string }) {
  try {
    await supabase.from("email_logs").insert({
      email_type: "crew_notification", recipient_email: params.recipientEmail, recipient_name: params.recipientName,
      subject: params.subject, body_preview: params.subject, event_id: params.eventId, sent_by: params.sentBy,
      status: "sent", sent_at: new Date().toISOString(), direction: "outbound",
    });
  } catch (e) { console.error("Failed to log notification email:", e); }
}

serve(handler);
