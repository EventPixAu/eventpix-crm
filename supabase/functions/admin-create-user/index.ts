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
    const { invitation_id } = await req.json();

    if (!invitation_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invitation_id is required' }),
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

    // 2) Read invitation
    const { data: inv, error: invErr } = await admin
      .from("user_invitations")
      .select("id, email, role, status")
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

    if (inv.status === "emailed") {
      return new Response(
        JSON.stringify({ success: false, error: "User has already been invited via email" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Create Auth user and send invitation email
    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/`;
    
    console.log("Creating user with email:", inv.email, "redirectTo:", redirectTo);

    const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo,
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

    const userId = created.user.id;

    // 4) Upsert profile
    const { error: profErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email: inv.email,
        is_active: true,
        onboarding_status: 'pending',
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
