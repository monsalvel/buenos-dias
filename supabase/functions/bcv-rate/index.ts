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
    // BCV has SSL cert issues, try multiple approaches
    let html = "";
    let fetchError = "";

    // Approach 1: Try via a web cache/proxy
    try {
      const proxyRes = await fetch(
        "https://webcache.googleusercontent.com/search?q=cache:bcv.org.ve",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );
      if (proxyRes.ok) {
        html = await proxyRes.text();
      }
    } catch (e) {
      fetchError += `Proxy failed: ${e}. `;
    }

    // Approach 2: Try http (non-SSL)
    if (!html) {
      try {
        const httpRes = await fetch("http://www.bcv.org.ve/", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (httpRes.ok) {
          html = await httpRes.text();
        }
      } catch (e) {
        fetchError += `HTTP failed: ${e}. `;
      }
    }

    // Approach 3: Direct HTTPS with Deno client workaround
    if (!html) {
      try {
        const proc = new Deno.Command("curl", {
          args: ["-sSk", "https://www.bcv.org.ve/"],
          stdout: "piped",
          stderr: "piped",
        });
        const output = await proc.output();
        if (output.success) {
          html = new TextDecoder().decode(output.stdout);
        }
      } catch (e) {
        fetchError += `Curl failed: ${e}. `;
      }
    }

    if (!html) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Could not fetch BCV page. ${fetchError}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract USD rate
    let rate: number | null = null;

    // Pattern 1: field-dicom-venta
    const ventaMatch = html.match(
      /field-dicom-venta[\s\S]*?<span[^>]*>([\d.,]+)<\/span>/
    );
    if (ventaMatch) {
      rate = parseFloat(
        ventaMatch[1].replace(/\./g, "").replace(",", ".")
      );
    }

    // Pattern 2: Venta label
    if (!rate) {
      const altMatch = html.match(
        /Venta:\s*<\/span>\s*<span[^>]*>([\d.,]+)<\/span>/
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
