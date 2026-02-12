// Supabase Edge Function - Google Geocoding API Proxy
// Lê a API key do banco de dados (tabela de configurações) para máxima segurança
// Sem autenticação JWT - permite requisições públicas (cadastro de apoiadores)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==================== CORS ====================

function getCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ==================== CACHE DA API KEY ====================

let cachedApiKey: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getGoogleMapsApiKey(): Promise<string | null> {
  // Verificar cache
  if (cachedApiKey && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return cachedApiKey;
  }

  // Fallback: env var (backwards compatibility)
  const envKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  // Tentar ler do banco de dados
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("[Geocoding Proxy] SUPABASE_URL ou SERVICE_ROLE_KEY não configuradas, usando env var");
      return envKey || null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("andresantos_configuracoes")
      .select("valor")
      .eq("chave", "api.google_maps_key")
      .single();

    if (error || !data?.valor) {
      console.warn("[Geocoding Proxy] Chave não encontrada no banco:", error?.message);
      // Fallback para env var
      if (envKey) {
        cachedApiKey = envKey;
        cacheTimestamp = Date.now();
        return envKey;
      }
      return null;
    }

    cachedApiKey = data.valor;
    cacheTimestamp = Date.now();
    console.log("[Geocoding Proxy] API key carregada do banco de dados");
    return cachedApiKey;

  } catch (err) {
    console.error("[Geocoding Proxy] Erro ao ler API key do banco:", err);
    // Fallback para env var
    if (envKey) {
      cachedApiKey = envKey;
      cacheTimestamp = Date.now();
      return envKey;
    }
    return null;
  }
}

// ==================== HELPERS ====================

function extractAddressComponents(addressComponents: any[]) {
  const getComponent = (types: string[]) => {
    const component = addressComponents.find((c: any) =>
      types.some(type => c.types.includes(type))
    );
    return component?.long_name || '';
  };

  const getComponentShort = (types: string[]) => {
    const component = addressComponents.find((c: any) =>
      types.some(type => c.types.includes(type))
    );
    return component?.short_name || component?.long_name || '';
  };

  return {
    street: getComponent(['route']),
    streetNumber: getComponent(['street_number']),
    neighborhood: getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']),
    city: getComponent(['locality', 'administrative_area_level_2']),
    state: getComponentShort(['administrative_area_level_1']),
    country: getComponent(['country']),
    postalCode: getComponent(['postal_code']),
  };
}

// ==================== HANDLER ====================

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Buscar API key do banco de dados (com cache e fallback para env var)
    const googleMapsApiKey = await getGoogleMapsApiKey();

    if (!googleMapsApiKey) {
      console.error("[Geocoding Proxy] Google Maps API key não configurada (nem no banco nem como env var)");
      return new Response(
        JSON.stringify({ error: "Google Maps API key não configurada. Vá em Configurações > APIs & Integrações para definir a chave." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, address, cep } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Ação não especificada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Geocoding] action=${action}, address=${address}, cep=${cep}`);

    let responseData: any = null;

    switch (action) {
      case "geocode": {
        if (!address) {
          return new Response(
            JSON.stringify({ error: "Endereço não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const params = new URLSearchParams({
          address: address,
          key: googleMapsApiKey,
          language: "pt-BR",
          region: "br",
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
        );

        const data = await response.json();

        if (data.status === "OK" && data.results && data.results.length > 0) {
          const result = data.results[0];
          const location = result.geometry?.location;
          const locationType = result.geometry?.location_type;
          const components = extractAddressComponents(result.address_components || []);

          responseData = {
            success: true,
            latitude: location?.lat,
            longitude: location?.lng,
            locationType: locationType,
            formattedAddress: result.formatted_address,
            street: components.street,
            streetNumber: components.streetNumber,
            neighborhood: components.neighborhood,
            city: components.city,
            state: components.state,
            country: components.country,
            postalCode: components.postalCode,
          };
        } else {
          responseData = {
            success: false,
            error: data.status === "ZERO_RESULTS"
              ? "Endereço não encontrado"
              : data.error_message || `Erro: ${data.status}`,
          };
        }
        break;
      }

      case "geocodeCep":
      case "buscarCep": {
        if (!cep) {
          return new Response(
            JSON.stringify({ error: "CEP não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cepLimpo = cep.replace(/\D/g, "");

        const params = new URLSearchParams({
          address: `${cepLimpo}, Brasil`,
          key: googleMapsApiKey,
          language: "pt-BR",
          region: "br",
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
        );

        const data = await response.json();

        if (data.status === "OK" && data.results && data.results.length > 0) {
          const result = data.results[0];
          const location = result.geometry?.location;
          const locationType = result.geometry?.location_type;
          const components = extractAddressComponents(result.address_components || []);

          responseData = {
            success: true,
            latitude: location?.lat,
            longitude: location?.lng,
            locationType: locationType,
            formattedAddress: result.formatted_address,
            street: components.street,
            streetNumber: components.streetNumber,
            neighborhood: components.neighborhood,
            city: components.city,
            state: components.state,
            country: components.country,
            postalCode: components.postalCode,
          };
        } else {
          responseData = {
            success: false,
            error: "CEP não encontrado",
          };
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Geocoding Proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
