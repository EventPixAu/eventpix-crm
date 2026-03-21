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
    const { input, sessionToken } = await req.json();
    if (!input || input.length < 3) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use Places Autocomplete API
    const params = new URLSearchParams({
      input,
      types: 'establishment',
      components: 'country:au',
      key: GOOGLE_PLACES_API_KEY,
    });
    if (sessionToken) params.set('sessiontoken', sessionToken);

    const autocompleteRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );
    const autocompleteData = await autocompleteRes.json();

    if (autocompleteData.status !== 'OK' && autocompleteData.status !== 'ZERO_RESULTS') {
      console.error('Places Autocomplete error:', autocompleteData);
      return new Response(JSON.stringify({ predictions: [], error: autocompleteData.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const predictions = (autocompleteData.predictions || []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
      structured_formatting: p.structured_formatting,
    }));

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
