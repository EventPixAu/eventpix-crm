/**
 * XERO TOKEN REFRESH CRON
 * 
 * Scheduled function that refreshes the Xero OAuth token
 * to prevent it from expiring due to inactivity.
 * Xero refresh tokens expire after 60 days if unused.
 * This runs daily to keep the connection alive.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';

Deno.serve(async (req) => {
  // This function is called by pg_cron — no auth needed for cron calls
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
  const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');

  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    console.log('Xero credentials not configured, skipping refresh.');
    return new Response(JSON.stringify({ skipped: true, reason: 'no_credentials' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get stored tokens
  const { data: tokens } = await supabase
    .from('xero_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!tokens?.length) {
    console.log('No Xero tokens stored, skipping refresh.');
    return new Response(JSON.stringify({ skipped: true, reason: 'no_tokens' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const storedToken = tokens[0];
  console.log(`Refreshing Xero token for tenant: ${storedToken.tenant_name}`);

  try {
    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedToken.refresh_token
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Xero token refresh failed:', errorText);
      return new Response(JSON.stringify({ success: false, error: errorText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newTokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    // Update all stored tokens
    const { error: updateError } = await supabase
      .from('xero_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (updateError) {
      console.error('Failed to store refreshed token:', updateError);
      return new Response(JSON.stringify({ success: false, error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Xero token refreshed successfully. New expiry: ${expiresAt}`);
    return new Response(JSON.stringify({ success: true, expires_at: expiresAt }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Xero cron refresh error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
