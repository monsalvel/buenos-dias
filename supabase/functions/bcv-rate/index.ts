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
    // Use Deno's fetch with certificate verification disabled for BCV
    // BCV has known SSL certificate issues
    const client = Deno.createHttpClient({
      caCerts: [],
    });

    const response = await fetch("https://www.bcv.org.ve/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      // @ts-ignore - Deno-specific option
      client,
    });

    if (!response.ok) {
      throw new Error(`BCV fetch failed: ${response.status}`);
    }

    const html = await response.text();
    client.close();

    // Extract USD rate from BCV page
    // The official rate is in the "Tipos de Cambio" section
    let rate: number | null = null;

    // Look for "field-dicom-venta" which contains the official selling rate
    const ventaMatch = html.match(
      /field-dicom-venta[^>]*>[\s\S]*?<span[^>]*>([\d.,]+)<\/span>/
    );
    if (ventaMatch) {
      // BCV uses dot as thousands separator and comma as decimal
      rate = parseFloat(
        ventaMatch[1].replace(/\./g, "").replace(",", ".")
      );
    }

    // Fallback: try alternative pattern
    if (!rate) {
      const altMatch = html.match(
        /Venta:[\s\S]*?<span[^>]*>([\d.,]+)<\/span>/
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
          error: "Could not parse USD rate from BCV page",
          debug: html.substring(0, 500),
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
