import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch BCV page
    const response = await fetch("https://www.bcv.org.ve/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`BCV fetch failed: ${response.status}`);
    }

    const html = await response.text();

    // Extract USD rate from "Tipo de Cambio de Referencia" section
    // Look for the "Venta:" value in the tipo-cambio block
    let rate: number | null = null;

    // Try to find the official exchange rate
    // Pattern: field-dicom-venta followed by the rate value
    const ventaMatch = html.match(
      /field-dicom-venta[^>]*>.*?<span[^>]*>([0-9.,]+)<\/span>/s
    );
    if (ventaMatch) {
      // BCV uses comma as decimal separator and dot as thousands
      rate = parseFloat(
        ventaMatch[1].replace(/\./g, "").replace(",", ".")
      );
    }

    // Fallback: try to find any USD rate pattern
    if (!rate) {
      const altMatch = html.match(
        /USD[\s\S]*?<strong>([\d.,]+)<\/strong>/i
      );
      if (altMatch) {
        rate = parseFloat(
          altMatch[1].replace(/\./g, "").replace(",", ".")
        );
      }
    }

    if (!rate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not parse USD rate from BCV",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from("bcv_rates").insert({
      currency: "USD",
      rate,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        currency: "USD",
        rate,
        fetched_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
