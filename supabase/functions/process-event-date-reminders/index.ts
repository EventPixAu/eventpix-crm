import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WorkflowStep {
  id: string;
  event_id: string;
  step_label: string;
  due_date: string;
  auto_trigger_event: string;
  is_completed: boolean;
}

interface EventDetails {
  id: string;
  event_name: string;
  event_date: string;
  venue_name: string | null;
  start_time: string | null;
}

interface StaffAssignment {
  user_id: string | null;
  staff_id: string | null;
  role_name: string | null;
  profile: {
    id: string;
    email: string;
    display_name: string | null;
  }[] | null;
  staff: {
    id: string;
    name: string;
    email: string | null;
  }[] | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    console.log(`Processing event date reminders for ${today}`);

    // Find workflow steps with event_date trigger that are due today and not completed
    const { data: dueSteps, error: stepsError } = await supabase
      .from("event_workflow_steps")
      .select(`
        id,
        event_id,
        step_label,
        due_date,
        auto_trigger_event,
        is_completed
      `)
      .eq("auto_trigger_event", "event_date")
      .eq("due_date", today)
      .eq("is_completed", false);

    if (stepsError) {
      throw new Error(`Failed to fetch workflow steps: ${stepsError.message}`);
    }

    console.log(`Found ${dueSteps?.length || 0} steps due today`);

    if (!dueSteps || dueSteps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No reminders to send", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const step of dueSteps as WorkflowStep[]) {
      try {
        // Get event details
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("id, event_name, event_date, venue_name, start_time")
          .eq("id", step.event_id)
          .single();

        if (eventError || !event) {
          console.error(`Event not found for step ${step.id}`);
          continue;
        }

        const eventDetails = event as EventDetails;

        // Get all assigned staff for this event
        const { data: assignments, error: assignError } = await supabase
          .from("event_assignments")
          .select(`
            user_id,
            staff_id,
            role_name,
            profile:profiles!event_assignments_user_id_fkey(id, email, display_name),
            staff:staff!event_assignments_staff_id_fkey(id, name, email)
          `)
          .eq("event_id", step.event_id);

        if (assignError) {
          console.error(`Failed to fetch assignments: ${assignError.message}`);
          continue;
        }

        if (!assignments || assignments.length === 0) {
          console.log(`No staff assigned to event ${step.event_id}`);
          // Still mark as complete - no one to notify
          await supabase
            .from("event_workflow_steps")
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              notes: `[Auto-completed: No staff assigned to notify]`,
            })
            .eq("id", step.id);
          continue;
        }

        // Format event date nicely
        const eventDate = new Date(eventDetails.event_date);
        const formattedDate = eventDate.toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        let staffNotified = 0;

        // Send email to each assigned staff member
        for (const assignment of assignments as StaffAssignment[]) {
          let recipientEmail: string | null = null;
          let recipientName: string | null = null;

          if (assignment.user_id && assignment.profile && assignment.profile.length > 0) {
            recipientEmail = assignment.profile[0].email;
            recipientName = assignment.profile[0].display_name || "Team Member";
          } else if (assignment.staff_id && assignment.staff && assignment.staff.length > 0) {
            recipientEmail = assignment.staff[0].email;
            recipientName = assignment.staff[0].name || "Team Member";
          }

          if (!recipientEmail) {
            console.log(`No email for assignment`, assignment);
            continue;
          }

          const roleLine = assignment.role_name ? ` (${assignment.role_name})` : "";

          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a; margin-bottom: 20px;">📸 Event Reminder</h2>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Hi ${recipientName}${roleLine},
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                This is a friendly reminder that you have an upcoming event:
              </p>
              
              <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1a1a1a; margin: 0 0 12px 0;">${eventDetails.event_name}</h3>
                <p style="color: #666; margin: 8px 0;">
                  <strong>Date:</strong> ${formattedDate}
                </p>
                ${eventDetails.start_time ? `
                <p style="color: #666; margin: 8px 0;">
                  <strong>Time:</strong> ${eventDetails.start_time}
                </p>
                ` : ""}
                ${eventDetails.venue_name ? `
                <p style="color: #666; margin: 8px 0;">
                  <strong>Location:</strong> ${eventDetails.venue_name}
                </p>
                ` : ""}
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Please ensure you're prepared and have reviewed the job sheet for any specific requirements.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              
              <p style="color: #999; font-size: 12px;">
                This is an automated reminder from EventPix.
              </p>
            </div>
          `;

          // Send with retry for rate limits
          let sent = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "EventPix <pix@rs.eventpix.com.au>",
                reply_to: "pix@eventpix.com.au",
                to: [recipientEmail],
                subject: `Reminder: ${eventDetails.event_name} on ${formattedDate}`,
                html: emailHtml,
              }),
            });

            if (response.ok) {
              sent = true;
              emailsSent.push(recipientEmail);
              staffNotified++;
              console.log(`Sent reminder to ${recipientEmail} for event ${eventDetails.event_name}`);
              break;
            } else if (response.status === 429 && attempt < 2) {
              // Rate limited, wait and retry
              const waitTime = Math.pow(2, attempt) * 500;
              console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              const errorResult = await response.text();
              console.error(`Failed to send email: ${errorResult}`);
              errors.push(`Failed to send to ${recipientEmail}: ${errorResult}`);
              break;
            }
          }

          // Log to email_logs
          await supabase.from("email_logs").insert({
            email_type: "staff_reminder",
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            subject: `Reminder: ${eventDetails.event_name} on ${formattedDate}`,
            body_html: emailHtml,
            body_preview: `Event reminder for ${eventDetails.event_name}`,
            event_id: step.event_id,
            status: sent ? "sent" : "failed",
            direction: "outbound",
            sent_at: sent ? new Date().toISOString() : null,
          });
        }

        // Mark the workflow step as completed
        await supabase
          .from("event_workflow_steps")
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            notes: `[Auto-completed: Event date reminder sent to ${staffNotified} staff member(s)]`,
          })
          .eq("id", step.id);

      } catch (stepError: unknown) {
        const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
        console.error(`Error processing step ${step.id}:`, stepError);
        errors.push(`Step ${step.id}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${dueSteps.length} reminder steps`,
        emailsSent: emailsSent.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in process-event-date-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
