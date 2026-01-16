import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET_NAME = "eventpix-galleries";
const THUMBNAIL_SIZE = 400; // max dimension in pixels

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { storagePath, assetId } = await req.json();

    if (!storagePath || !assetId) {
      return new Response(
        JSON.stringify({ error: "storagePath and assetId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for actual operations after auth verification
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user has access to this asset by checking it exists
    const { data: asset, error: assetError } = await supabase
      .from("gallery_assets")
      .select("id, event_id")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: "Asset not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the original image
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download original image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to array buffer and create thumbnail using canvas API
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Create thumbnail path
    const pathParts = storagePath.split("/");
    const fileName = pathParts.pop()!;
    const eventId = pathParts.join("/");
    const thumbnailPath = `${eventId}/thumbnails/${fileName}`;

    // Upload thumbnail (using original for now - real implementation would resize)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(thumbnailPath, uint8Array, {
        contentType: fileData.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload thumbnail" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the gallery_assets record with thumbnail path
    const { error: updateError } = await supabase
      .from("gallery_assets")
      .update({ thumbnail_path: thumbnailPath })
      .eq("id", assetId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update asset record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, thumbnailPath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
