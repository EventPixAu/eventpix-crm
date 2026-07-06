import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: roleData, error: roleErr } = await caller.rpc("current_user_role");
    if (roleErr || roleData !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://app.eventpix.com.au/reset-password' },
    });
    if (error || !data?.properties?.action_link) {
      return new Response(JSON.stringify({ error: error?.message ?? "Failed to generate link" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      email,
      link: data.properties.action_link,
      expires_in: '1 hour',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
