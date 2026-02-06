/**
 * XERO OAUTH HANDLER
 * 
 * Handles OAuth authorization flow for Xero:
 * - /authorize - Redirects to Xero login
 * - /callback - Handles OAuth callback and stores tokens
 * - /status - Returns current connection status
 * - /disconnect - Removes stored tokens
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
  const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Get redirect URI from request origin or use default
  const origin = req.headers.get('origin') || url.origin;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  // Include apikey in callback URL so Xero's redirect works without auth headers
  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/xero-auth/callback?apikey=${SUPABASE_ANON_KEY}`;

  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Xero credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Verify admin access for protected endpoints
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader && path !== 'callback') {
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
      
      if (claimsError || !claimsData.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = claimsData.user.id;

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const isAdmin = roles?.some(r => r.role === 'admin');
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    switch (path) {
      case 'authorize': {
        // Generate state for CSRF protection
        const state = crypto.randomUUID();
        
        // Store state in URL for now (in production, use session/cookie)
        const scopes = [
          'openid',
          'profile',
          'email',
          'accounting.transactions.read',
          'accounting.contacts.read',
          'offline_access'
        ].join(' ');

        const authUrl = new URL(XERO_AUTH_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', XERO_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('state', state);

        return new Response(
          JSON.stringify({ url: authUrl.toString(), state }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'callback': {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          // Redirect back to app with error
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/admin/invoices?xero_error=${error}` }
          });
        }

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/admin/invoices?xero_error=no_code` }
          });
        }

        // Exchange code for tokens
        const tokenResponse = await fetch(XERO_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token exchange failed:', errorText);
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/admin/invoices?xero_error=token_exchange_failed` }
          });
        }

        const tokens = await tokenResponse.json();

        // Get connected tenants (organizations)
        const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (!connectionsResponse.ok) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/admin/invoices?xero_error=connections_failed` }
          });
        }

        const connections = await connectionsResponse.json();
        
        if (!connections.length) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/admin/invoices?xero_error=no_organizations` }
          });
        }

        // Store tokens for each tenant
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        for (const conn of connections) {
          await supabase
            .from('xero_tokens')
            .upsert({
              tenant_id: conn.tenantId,
              tenant_name: conn.tenantName,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: expiresAt,
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id' });
        }

        // Redirect back to app with success
        return new Response(null, {
          status: 302,
          headers: { Location: `${origin}/admin/invoices?xero_connected=true` }
        });
      }

      case 'status': {
        const { data: tokens, error: tokensError } = await supabase
          .from('xero_tokens')
          .select('tenant_id, tenant_name, expires_at, updated_at')
          .order('updated_at', { ascending: false });

        if (tokensError) {
          throw tokensError;
        }

        const connected = tokens && tokens.length > 0;
        const isExpired = connected && new Date(tokens[0].expires_at) < new Date();

        return new Response(
          JSON.stringify({
            connected,
            isExpired,
            tenants: tokens || [],
            needsRefresh: isExpired
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: deleteError } = await supabase
          .from('xero_tokens')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
          throw deleteError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'refresh': {
        // Refresh tokens for all tenants
        const { data: storedTokens } = await supabase
          .from('xero_tokens')
          .select('*')
          .limit(1);

        if (!storedTokens?.length) {
          return new Response(
            JSON.stringify({ error: 'No tokens to refresh' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenResponse = await fetch(XERO_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: storedTokens[0].refresh_token
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token refresh failed:', errorText);
          return new Response(
            JSON.stringify({ error: 'Token refresh failed', details: errorText }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = await tokenResponse.json();
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Update all stored tokens
        const { error: updateError } = await supabase
          .from('xero_tokens')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          })
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (updateError) {
          throw updateError;
        }

        return new Response(
          JSON.stringify({ success: true, expires_at: expiresAt }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Xero auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
