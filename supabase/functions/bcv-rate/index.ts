import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GENERIC_ERROR = "No se pudo obtener la tasa del BCV. Intente más tarde.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth check (verify_jwt = false by default for Lovable functions) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await authClient.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // --- Cooldown: reuse the latest rate if it's less than 15 minutes old ---
    const { data: latest } = await supabase
      .from("bcv_rates")
      .select("rate, currency, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      const ageMs = Date.now() - new Date(latest.fetched_at).getTime();
      if (ageMs < 15 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            success: true,
            currency: latest.currency,
            rate: Number(latest.rate),
            source: "cache",
            fetched_at: latest.fetched_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let rate: number | null = null;
    let source = "";

    // Approach 1: Banco de Venezuela JSON API
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

    // Approach 2: pydolarve API fallback
    if (!rate) {
      try {
        const pyRes = await fetch(
          "https://pydolarve.org/api/v2/dollar?page=bcv",
          { headers: { Accept: "application/json" } }
        );
        if (pyRes.ok) {
          const pyData = await pyRes.json();
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
        JSON.stringify({ success: false, error: GENERIC_ERROR }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("bcv_rates").insert({ currency: "USD", rate });

    return new Response(
      JSON.stringify({
        success: true,
        currency: "USD",
        rate,
        source,
        fetched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_ERROR }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
