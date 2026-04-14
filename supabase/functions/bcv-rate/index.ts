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
    let rate: number | null = null;
    let source = "";

    // Approach 1: Banco de Venezuela JSON API (most reliable, no SSL issues)
    try {
      const bdvRes = await fetch(
        "https://www.bancodevenezuela.com/files/tasas/tasas2.json",
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json",
          },
        }
      );
      if (bdvRes.ok) {
        const bdvData = await bdvRes.json();
        // Path: menudeo.compra.dolares
        const rawRate = bdvData?.menudeo?.compra?.dolares;
        if (rawRate) {
          rate = parseFloat(
            String(rawRate).replace(/\./g, "").replace(",", ".")
          );
          source = "BDV";
        }
      }
    } catch (e) {
      console.error("BDV fetch failed:", e);
    }

    // Approach 2: Try pydolarve API (community API)
    if (!rate) {
      try {
        const pyRes = await fetch(
          "https://pydolarve.org/api/v2/dollar?page=bcv",
          {
            headers: { Accept: "application/json" },
          }
        );
        if (pyRes.ok) {
          const pyData = await pyRes.json();
          // Try to get BCV rate from the response
          if (pyData?.monitors?.usd?.price) {
            rate = pyData.monitors.usd.price;
            source = "pydolarve";
          }
        }
      } catch (e) {
        console.error("pydolarve fetch failed:", e);
      }
    }

    if (!rate) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "No se pudo obtener la tasa del BCV. Intente más tarde.",
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

    await supabase.from("bcv_rates").insert({
      currency: "USD",
      rate,
    });

    return new Response(
      JSON.stringify({
        success: true,
        currency: "USD",
        rate,
        source,
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
