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

    // Use Places API (New) - Autocomplete endpoint
    const body: any = {
      input,
      includedPrimaryTypes: ['establishment'],
      includedRegionCodes: ['au'],
    };
    if (sessionToken) body.sessionToken = sessionToken;

    const autocompleteRes = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify(body),
      }
    );
    const autocompleteData = await autocompleteRes.json();

    if (!autocompleteRes.ok) {
      console.error('Places Autocomplete error:', autocompleteData);
      return new Response(JSON.stringify({ predictions: [], error: autocompleteData.error?.message || 'API error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map new API response format to our expected format
    const predictions = (autocompleteData.suggestions || [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => {
        const p = s.placePrediction;
        return {
          place_id: p.placeId || p.place?.split('/').pop(),
          description: p.text?.text || '',
          structured_formatting: {
            main_text: p.structuredFormat?.mainText?.text || '',
            secondary_text: p.structuredFormat?.secondaryText?.text || '',
          },
        };
      });

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
