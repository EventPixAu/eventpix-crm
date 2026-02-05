import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { invitation_id, resend_access_for_user_id, email } = body;

    if (!invitation_id && !resend_access_for_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invitation_id or resend_access_for_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to caller JWT (for Admin check)
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for Admin API calls
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1) Verify caller is admin (via DB function)
    const { data: roleData, error: roleErr } = await caller.rpc("current_user_role");
    console.log("Role check result:", { roleData, roleErr });
    
    if (roleErr || roleData !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - admin role required" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Base URL for auth redirects (no trailing slash)
    const appBaseUrl = (Deno.env.get("INVITE_REDIRECT_URL") || supabaseUrl.replace('.supabase.co', '.lovable.app'))
      .replace(/\/+$/, "");

    // Keep existing behavior for brand-new invites (lands user in-app after accepting)
    const inviteRedirectTo = `${appBaseUrl}/`;

    // For already-registered users, send a password-set (recovery) link to our reset page
    const passwordRedirectTo = `${appBaseUrl}/reset-password`;

    // Handle resend access email for existing user (no invitation record needed)
    if (resend_access_for_user_id && email) {
      console.log("Sending access email for existing user:", email);
      
      // IMPORTANT: `type: 'invite'` fails for existing users with
      // "A user with this email address has already been registered".
      // Use a recovery link so they can set/reset their password.
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: { redirectTo: passwordRedirectTo },
      });

      if (linkErr || !linkData?.properties?.action_link) {
        console.error("Generate link error:", linkErr);
        return new Response(
          JSON.stringify({ success: false, error: linkErr?.message ?? "Failed to generate access link" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "EventPix <pix@rs.eventpix.com.au>",
            to: [email],
            subject: "Set your EventPix password",
            html: `
              <h2>Welcome to EventPix</h2>
              <p>Click the link below to set your password and access your account:</p>
              <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set My Password</a></p>
              <p><strong>Before you get started:</strong> Check out our <a href="https://app.eventpix.com.au/onboarding">Team Onboarding Guide</a>.</p>
              <hr>
              <p>Looking forward to working with you,<br>
              <strong>Trevor Connell</strong><br>
              EventPix Operations</p>
            `,
          }),
        });
        const emailResult = await emailRes.json();
        console.log("Resend email result:", emailResult);

        if (!emailRes.ok) {
          return new Response(
            JSON.stringify({ success: false, error: emailResult.message || "Failed to send email" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "Email service not configured" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, user_id: resend_access_for_user_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Original invitation flow - Read invitation (including staff_id for linking)
    const { data: inv, error: invErr } = await admin
      .from("user_invitations")
      .select("id, email, role, status, staff_id")
      .eq("id", invitation_id)
      .single();

    console.log("Invitation lookup:", { inv, invErr });

    if (invErr || !inv) {
      return new Response(
        JSON.stringify({ success: false, error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inv.status === "accepted") {
      return new Response(
        JSON.stringify({ success: false, error: "Invitation already accepted" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inv.status === "revoked") {
      return new Response(
        JSON.stringify({ success: false, error: "Invitation has been revoked" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow resending for invitations already marked as 'emailed' (generate a fresh invite link).

    // 3) Create Auth user and send invitation email
    console.log("Creating user with email:", inv.email, "redirectTo:", inviteRedirectTo);

    // First, check if user already exists in auth using listUsers with filter
    let existingUser = null;
    try {
      const { data: usersData } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Increase to catch more users
      });
      existingUser = usersData?.users?.find((u: { email?: string }) => 
        u.email?.toLowerCase() === inv.email.toLowerCase()
      );
    } catch (e) {
      console.log("Error checking for existing user:", e);
    }

    let userId: string;

    if (existingUser) {
      // User already exists - generate a new invite link instead
      console.log("User already exists, generating new invite link for:", inv.email);
      
      // Existing user: send a recovery link (invite links cannot be generated for existing users)
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: inv.email,
        options: {
          redirectTo: passwordRedirectTo,
        },
      });

      console.log("Generate link result:", { linkData, linkErr });

      if (linkErr || !linkData?.properties?.action_link) {
        await admin.from("user_invitations").update({
          status: "failed",
          error: linkErr?.message ?? "Failed to generate invite link",
          updated_at: new Date().toISOString(),
        }).eq("id", invitation_id);

        return new Response(
          JSON.stringify({ success: false, error: linkErr?.message ?? "Failed to generate invite link" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = existingUser.id;

      // Send email manually via Resend if available, or just update status
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "EventPix <pix@rs.eventpix.com.au>",
              to: [inv.email],
                subject: "Set your EventPix password",
              html: `
                  <h2>Welcome to EventPix</h2>
                  <p>Click the link below to set your password and access your account:</p>
                  <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set My Password</a></p>
                <p><strong>Before you get started:</strong> Check out our <a href="https://app.eventpix.com.au/onboarding">Team Onboarding Guide</a>.</p>
                <hr>
                <p>Looking forward to working with you,<br>
                <strong>Trevor Connell</strong><br>
                EventPix Operations</p>
              `,
            }),
          });
          const emailResult = await emailRes.json();
          console.log("Resend email result:", emailResult);
        } catch (emailErr) {
          console.error("Failed to send email via Resend:", emailErr);
        }
      }
    } else {
      // New user - use inviteUserByEmail
      const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(inv.email, {
        redirectTo: inviteRedirectTo,
        data: { role: inv.role },
      });

      console.log("User creation result:", { created, createErr });

      if (createErr || !created?.user) {
        // Mark invitation as failed
        await admin.from("user_invitations").update({
          status: "failed",
          error: createErr?.message ?? "Unknown error creating user",
          updated_at: new Date().toISOString(),
        }).eq("id", invitation_id);

        return new Response(
          JSON.stringify({ success: false, error: createErr?.message ?? "Failed to create user" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = created.user.id;
    }

    

    // 4) If this invitation has a linked staff record, fetch that data for the profile
    let staffData: { name?: string; phone?: string; notes?: string; location?: string; role?: string } | null = null;
    if (inv.staff_id) {
      const { data: staff, error: staffErr } = await admin
        .from("staff")
        .select("name, phone, notes, location, role")
        .eq("id", inv.staff_id)
        .single();
      
      if (!staffErr && staff) {
        staffData = staff;
        console.log("Found linked staff record:", staffData);
      }
    }

    // 4.5) Look up the staff_roles id if we have a role name from staff record
    let defaultRoleId: string | null = null;
    if (staffData?.role) {
      // Map legacy role enum to staff_roles table
      // Legacy roles: 'photographer', 'videographer', 'assistant'
      // We need to find the best matching staff_role
      const roleName = staffData.role.toLowerCase();
      let searchName: string;
      
      if (roleName === 'assistant') {
        searchName = 'Assistant';
      } else if (roleName === 'videographer') {
        searchName = 'Videographer';
      } else {
        // Default photographers to 'Photographer' role
        searchName = 'Photographer';
      }
      
      const { data: roleRow, error: roleSearchErr } = await admin
        .from("staff_roles")
        .select("id")
        .eq("name", searchName)
        .maybeSingle();
      
      if (roleRow && !roleSearchErr) {
        defaultRoleId = roleRow.id;
        console.log(`Mapped staff role '${staffData.role}' to staff_role id: ${defaultRoleId}`);
      }
    }

    // 5) Upsert profile (with staff data if available)
    // Note: onboarding_status must be one of: 'incomplete', 'pending_review', 'active', 'suspended'
    const { error: profErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email: inv.email,
        full_name: staffData?.name || null,
        phone: staffData?.phone || null,
        notes_internal: staffData?.notes || null,
        home_city: staffData?.location || null,
        default_role_id: defaultRoleId,
        is_active: true,
        onboarding_status: 'incomplete',
        updated_at: new Date().toISOString(),
      });

    if (profErr) {
      console.error("Profile upsert error:", profErr);
      await admin.from("user_invitations").update({
        status: "failed",
        auth_user_id: userId,
        error: profErr.message,
        updated_at: new Date().toISOString(),
      }).eq("id", invitation_id);

      return new Response(
        JSON.stringify({ success: false, error: profErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5.5) If there's a linked staff record, update it to point to the new user_id
    if (inv.staff_id) {
      const { error: staffUpdateErr } = await admin
        .from("staff")
        .update({ user_id: userId })
        .eq("id", inv.staff_id);
      
      if (staffUpdateErr) {
        console.error("Failed to link staff record to user:", staffUpdateErr);
        // Don't fail the whole operation for this
      } else {
        console.log("Linked staff record", inv.staff_id, "to user", userId);
      }
    }

    // 5) Set role in user_roles table
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: inv.role,
      });

    if (roleInsertErr) {
      console.error("Role insert error:", roleInsertErr);
    }

    // 6) Mark invitation as emailed
    await admin.from("user_invitations").update({
      status: "emailed",
      auth_user_id: userId,
      error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", invitation_id);

    console.log("User created successfully:", userId);

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
