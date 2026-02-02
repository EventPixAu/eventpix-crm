import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "assignment" | "event_update";
  event_id: string;
  user_id?: string; // For assignment notifications
  assignment_id?: string;
}

function generateICS(event: any, sequence: number, appUrl: string): string {
  const uid = `${event.id}@eventpix.com.au`;
  const now = new Date();
  const dtstamp = formatDateToICS(now);
  
  // Parse start and end times
  let dtstart: string;
  let dtend: string;
  
  if (event.start_at) {
    dtstart = formatDateToICS(new Date(event.start_at));
    dtend = event.end_at 
      ? formatDateToICS(new Date(event.end_at))
      : formatDateToICS(new Date(new Date(event.start_at).getTime() + 2 * 60 * 60 * 1000)); // Default 2 hours
  } else {
    // Use event_date with start_time/end_time
    const startDate = new Date(event.event_date);
    if (event.start_time) {
      const [hours, minutes] = event.start_time.split(':');
      startDate.setHours(parseInt(hours), parseInt(minutes));
    }
    dtstart = formatDateToICS(startDate);
    
    if (event.end_time) {
      const endDate = new Date(event.event_date);
      const [hours, minutes] = event.end_time.split(':');
      endDate.setHours(parseInt(hours), parseInt(minutes));
      dtend = formatDateToICS(endDate);
    } else {
      dtend = formatDateToICS(new Date(startDate.getTime() + 2 * 60 * 60 * 1000));
    }
  }
  
  const location = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const description = [
    event.coverage_details,
    event.onsite_contact_name ? `On-site contact: ${event.onsite_contact_name}` : null,
    event.onsite_contact_phone ? `Phone: ${event.onsite_contact_phone}` : null,
    `View in app: ${appUrl}/events/${event.id}`
  ].filter(Boolean).join("\\n");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eventpix//Event Management//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${escapeICS(event.event_name)}
LOCATION:${escapeICS(location)}
DESCRIPTION:${escapeICS(description)}
SEQUENCE:${sequence}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

function formatDateToICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return 'TBD';
  const [hours, minutes] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://app.eventpix.com.au";

    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for actual operations after auth verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { type, event_id, user_id, assignment_id }: NotificationRequest = await req.json();

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    let recipientEmail: string | null = null;
    let recipientName: string | null = null;
    let subject: string;
    let icsContent: string;

    if (type === "assignment") {
      // Fetch assigned user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user_id)
        .single();

      if (profileError || !profile) {
        throw new Error(`Profile not found: ${profileError?.message}`);
      }

      recipientEmail = profile.email;
      recipientName = profile.full_name || profile.email;
      subject = `Eventpix - New assignment: ${event.event_name} - ${formatDate(event.event_date)}`;
      icsContent = generateICS(event, event.calendar_sequence || 0, appUrl);

      // Mark assignment as notified
      if (assignment_id) {
        await supabase
          .from("event_assignments")
          .update({ notified: true })
          .eq("id", assignment_id);
      }
    } else {
      // Event update - notify all assigned staff
      const { data: assignments, error: assignError } = await supabase
        .from("event_assignments")
        .select("user_id, profiles:user_id(email, full_name)")
        .eq("event_id", event_id);

      if (assignError) {
        throw new Error(`Failed to fetch assignments: ${assignError.message}`);
      }

      subject = `Eventpix - Updated details: ${event.event_name} - ${formatDate(event.event_date)}`;
      icsContent = generateICS(event, event.calendar_sequence || 0, appUrl);

      // Send to all assigned users
      const results = [];
      for (const assignment of assignments || []) {
        const profile = assignment.profiles as any;
        if (profile?.email) {
          results.push({
            email: profile.email,
            name: profile.full_name || profile.email
          });
        }
      }

      if (results.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No assigned staff to notify" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // For event updates, we'll loop through all recipients
      const emailPromises = results.map(async (recipient) => {
        return sendEmail(resendKey, recipient.email, recipient.name, subject, event, icsContent, appUrl);
      });

      const emailResults = await Promise.all(emailPromises);
      console.log("Email results:", emailResults);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Notified ${results.length} staff members`,
          dryRun: !resendKey
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Single recipient (assignment notification)
    const emailResult = await sendEmail(resendKey, recipientEmail!, recipientName!, subject, event, icsContent, appUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: emailResult.dryRun ? "Notification queued (prototype mode)" : "Notification sent",
        dryRun: emailResult.dryRun
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function sendEmail(
  resendKey: string | undefined,
  recipientEmail: string,
  recipientName: string,
  subject: string,
  event: any,
  icsContent: string,
  appUrl: string
): Promise<{ success: boolean; dryRun: boolean }> {
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; }
    .detail { margin-bottom: 16px; }
    .detail-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
    .detail-value { font-weight: 500; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📸 ${subject.includes('New assignment') ? 'New Assignment' : 'Event Updated'}</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p>${subject.includes('New assignment') ? 'You have been assigned to a new event:' : 'The following event details have been updated:'}</p>
      
      <div class="detail">
        <div class="detail-label">Event</div>
        <div class="detail-value">${event.event_name}</div>
      </div>
      
      <div class="detail">
        <div class="detail-label">Date & Time</div>
        <div class="detail-value">${formatDate(event.event_date)}${event.start_time ? ` at ${formatTime(event.start_time)}` : ''}${event.end_time ? ` - ${formatTime(event.end_time)}` : ''}</div>
      </div>
      
      ${event.venue_name ? `
      <div class="detail">
        <div class="detail-label">Venue</div>
        <div class="detail-value">${event.venue_name}${event.venue_address ? `<br>${event.venue_address}` : ''}</div>
      </div>
      ` : ''}
      
      ${event.onsite_contact_name ? `
      <div class="detail">
        <div class="detail-label">On-site Contact</div>
        <div class="detail-value">${event.onsite_contact_name}${event.onsite_contact_phone ? ` - ${event.onsite_contact_phone}` : ''}</div>
      </div>
      ` : ''}
      
      ${event.coverage_details ? `
      <div class="detail">
        <div class="detail-label">Coverage Details</div>
        <div class="detail-value">${event.coverage_details}</div>
      </div>
      ` : ''}
      
      <a href="${appUrl}/events/${event.id}" class="button">View Event Details</a>
    </div>
    <div class="footer">
      <p>Eventpix - Event Photography Management</p>
    </div>
  </div>
</body>
</html>
  `;

  // If no Resend key, dry run mode
  if (!resendKey) {
    console.log("=== DRY RUN: Email Notification ===");
    console.log("To:", recipientEmail);
    console.log("Subject:", subject);
    console.log("ICS Content:", icsContent);
    console.log("HTML Preview available");
    return { success: true, dryRun: true };
  }

  // Send via Resend
  try {
    const icsBase64 = btoa(icsContent);
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Eventpix <pix@rs.eventpix.com.au>",
        reply_to: "pix@eventpix.com.au",
        to: [recipientEmail],
        subject: subject,
        html: emailHtml,
        attachments: [
          {
            filename: "event.ics",
            content: icsBase64,
            type: "text/calendar",
          },
        ],
      }),
    });

    const result = await response.json();
    console.log("Resend response:", result);
    
    if (!response.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    return { success: true, dryRun: false };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

serve(handler);
