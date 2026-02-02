// Supabase Edge Function - Google Geocoding API Proxy
// Versão SEM autenticação - Permite requisições públicas (cadastro de apoiadores)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS aberto para permitir qualquer domínio
function getCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Extrair componentes do endereço do resultado do Google
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

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Apenas POST é permitido
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!googleMapsApiKey) {
      console.error("[Geocoding Proxy] GOOGLE_MAPS_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
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

    console.log(`[Geocoding] Recebido: action=${action}, address=${address}, cep=${cep}`);

    let responseData: any = null;

    switch (action) {
      case "geocode": {
        // Geocodificar endereço completo
        if (!address) {
          return new Response(
            JSON.stringify({ error: "Endereço não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[Geocoding Proxy] Geocoding address: ${address}`);

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
            // Componentes do endereço
            street: components.street,
            streetNumber: components.streetNumber,
            neighborhood: components.neighborhood,
            city: components.city,
            state: components.state,
            country: components.country,
            postalCode: components.postalCode,
          };

          console.log(`[Geocoding Proxy] Found: ${responseData.formattedAddress}`);
        } else {
          responseData = {
            success: false,
            error: data.status === "ZERO_RESULTS"
              ? "Endereço não encontrado"
              : data.error_message || `Erro: ${data.status}`,
          };
          console.warn(`[Geocoding Proxy] Google API error: ${data.status}`);
        }
        break;
      }

      case "geocodeCep":
      case "buscarCep": {
        // Buscar endereço pelo CEP (retorna todos os componentes)
        if (!cep) {
          return new Response(
            JSON.stringify({ error: "CEP não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cepLimpo = cep.replace(/\D/g, "");
        console.log(`[Geocoding Proxy] Buscando CEP: ${cepLimpo}`);

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
            // Componentes do endereço
            street: components.street,
            streetNumber: components.streetNumber,
            neighborhood: components.neighborhood,
            city: components.city,
            state: components.state,
            country: components.country,
            postalCode: components.postalCode,
          };

          console.log(`[Geocoding Proxy] CEP encontrado: ${responseData.city}/${responseData.state} - ${responseData.street}`);
        } else {
          responseData = {
            success: false,
            error: "CEP não encontrado",
          };
          console.warn(`[Geocoding Proxy] CEP não encontrado: ${cepLimpo}`);
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
