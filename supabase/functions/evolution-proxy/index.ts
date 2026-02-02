// Supabase Edge Function - Evolution API Proxy
// Resolve o problema de CORS fazendo as chamadas pelo servidor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS aberto para permitir qualquer domínio (segurança via JWT)
function getCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Buscar config do banco de dados
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ========== VALIDAÇÃO DE AUTENTICAÇÃO ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Criar cliente Supabase e verificar o token
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      console.error("[Evolution Proxy] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Evolution Proxy] Authenticated user: ${userData.user.email}`);
    // ========== FIM DA VALIDAÇÃO ==========

    const { action, instanceName, data } = await req.json();

    // Buscar configuração da Evolution API do banco
    const configResponse = await fetch(
      `${supabaseUrl}/rest/v1/andresantos_evolution_config?order=criado_em.desc&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const configs = await configResponse.json();
    // Config pode estar vazia - vamos criar automaticamente quando necessário

    // URL e API Key do servidor Evolution (de variáveis de ambiente)
    const baseUrl = Deno.env.get("EVOLUTION_API_URL") || "https://taca.rdg.one";
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!apiKey) {
      console.error("[Evolution Proxy] EVOLUTION_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pegar instance_name do banco ou do request
    const config = configs.length > 0 ? configs[0] : null;

    let evolutionResponse;
    let endpoint = "";
    let method = "GET";
    let body = null;

    switch (action) {
      case "create":
        endpoint = "/instance/create";
        method = "POST";
        body = JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        });
        break;

      case "connect":
        endpoint = `/instance/connect/${instanceName}`;
        method = "GET";
        break;

      case "status":
        endpoint = `/instance/connectionState/${instanceName}`;
        method = "GET";
        break;

      case "logout":
        endpoint = `/instance/logout/${instanceName}`;
        method = "DELETE";
        break;

      case "delete":
        endpoint = `/instance/delete/${instanceName}`;
        method = "DELETE";
        break;

      case "restart":
        endpoint = `/instance/restart/${instanceName}`;
        method = "PUT";
        break;

      case "sendText":
        endpoint = `/message/sendText/${instanceName}`;
        method = "POST";
        body = JSON.stringify({
          number: data.number,
          text: data.text,
          delay: 1200,
          linkPreview: false,
        });
        break;

      case "fetchInstances":
        endpoint = "/instance/fetchInstances";
        method = "GET";
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[Evolution Proxy] ${method} ${baseUrl}${endpoint}`);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      fetchOptions.body = body;
    }

    evolutionResponse = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    const responseData = await evolutionResponse.json();

    // Se criou instância, criar ou atualizar config no banco
    if (action === "create" && evolutionResponse.ok) {
      if (config && config.id) {
        // Atualizar existente
        await fetch(
          `${supabaseUrl}/rest/v1/andresantos_evolution_config?id=eq.${config.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              instance_name: instanceName,
              instance_token: responseData.hash || null,
              status: "qr_pending",
              atualizado_em: new Date().toISOString(),
            }),
          }
        );
      } else {
        // Criar novo registro
        await fetch(
          `${supabaseUrl}/rest/v1/andresantos_evolution_config`,
          {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              servidor_url: baseUrl,
              // API key não é armazenada no banco - usa variável de ambiente
              instance_name: instanceName,
              instance_token: responseData.hash || null,
              status: "qr_pending",
              criado_em: new Date().toISOString(),
              atualizado_em: new Date().toISOString(),
            }),
          }
        );
      }
    }

    // Se verificou status, atualizar no banco (se config existir)
    if (action === "status" && evolutionResponse.ok && config && config.id) {
      const state = responseData.instance?.state || responseData.state || "disconnected";
      const newStatus = state === "open" || state === "connected" ? "connected" : "disconnected";

      await fetch(
        `${supabaseUrl}/rest/v1/andresantos_evolution_config?id=eq.${config.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: newStatus,
            ultimo_check: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          }),
        }
      );
    }

    // Se desconectou, atualizar status (se config existir)
    if ((action === "logout" || action === "delete") && evolutionResponse.ok && config && config.id) {
      await fetch(
        `${supabaseUrl}/rest/v1/andresantos_evolution_config?id=eq.${config.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: "disconnected",
            atualizado_em: new Date().toISOString(),
          }),
        }
      );
    }

    return new Response(JSON.stringify(responseData), {
      status: evolutionResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Evolution Proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
