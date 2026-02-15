import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to caller JWT (for admin check)
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 2) Verify caller is admin
    const { data: roleData, error: roleErr } = await caller.rpc("current_user_role");
    if (roleErr || roleData !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin role required" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, new_password } = await req.json();

    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ error: "email and new_password required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for admin API calls
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get caller user id for audit logging
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await caller.auth.getClaims(token);
    const actorUserId = claimsData?.claims?.sub;

    // Find user by email
    const { data: users, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      return new Response(
        JSON.stringify({ error: listErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.users.find((u) => u.email === email);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset password directly
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    if (actorUserId) {
      await admin.from("audit_log").insert({
        action: "password_reset_admin",
        actor_user_id: actorUserId,
        after: { target_email: email },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: `Password reset for ${email}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
