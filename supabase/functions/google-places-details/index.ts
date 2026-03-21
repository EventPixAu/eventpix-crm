import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!GOOGLE_PLACES_API_KEY) {
    return new Response(JSON.stringify({ error: 'Google Places API key not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { placeId, sessionToken } = await req.json();
    if (!placeId) {
      return new Response(JSON.stringify({ error: 'placeId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'name,formatted_address,address_components,geometry',
      key: GOOGLE_PLACES_API_KEY,
    });
    if (sessionToken) params.set('sessiontoken', sessionToken);

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );
    const detailsData = await detailsRes.json();

    if (detailsData.status !== 'OK') {
      console.error('Places Details error:', detailsData);
      return new Response(JSON.stringify({ error: detailsData.status }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = detailsData.result;
    return new Response(JSON.stringify({
      name: result.name,
      formatted_address: result.formatted_address,
      address_components: result.address_components,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
