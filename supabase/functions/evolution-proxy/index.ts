// Supabase Edge Function - Evolution API Proxy
// Resolve o problema de CORS fazendo as chamadas pelo servidor
// Lê configuração (servidor_url, api_key, instance_name) do banco de dados

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

async function getEvolutionConfigFromDB(): Promise<{ servidor_url: string; api_key: string; instance_name: string; id: string } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[Evolution Proxy] SUPABASE_URL ou SERVICE_ROLE_KEY não configuradas");
      return null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("pltdataandrebueno_evolution_config")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn("[Evolution Proxy] Config não encontrada no banco:", error?.message);
      return null;
    }

    console.log("[Evolution Proxy] Config carregada do banco de dados");
    return {
      id: data.id,
      servidor_url: data.servidor_url,
      api_key: data.api_key,
      instance_name: data.instance_name,
    };

  } catch (err) {
    console.error("[Evolution Proxy] Erro ao ler config do banco:", err);
    return null;
  }
}

// ==================== HANDLER ====================

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // DIAGNOSTICO: Se o usuario ver este header, a funcao foi atingida.
    const diagnosticHeaders = { ...corsHeaders, "X-Proxy-Reached": "true", "Content-Type": "application/json" };

    // Descomente abaixo para testar apenas a conectividade
    // return new Response(JSON.stringify({ message: "Proxy atingido com sucesso!" }), { headers: diagnosticHeaders });

    // ========== VALIDAÇÃO DE AUTENTICAÇÃO ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[Evolution Proxy] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Cabeçalho de autorização ausente.", source: "supabase_auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente Supabase com Service Role para validar o usuário de forma mais robusta
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[Evolution Proxy] Supabase Auth error:", authError?.message || "User not found");
      return new Response(
        JSON.stringify({
          error: "Sessão inválida ou expirada. Faça login novamente.",
          source: "supabase_auth",
          detail: authError?.message || "User not found",
          token_prefix: token.substring(0, 10) + "..."
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Evolution Proxy] Usuário autenticado: ${user.email}`);
    // ========== FIM DA VALIDAÇÃO ==========

    const { action, instanceName, data } = await req.json();

    // Buscar configuração da Evolution API do banco de dados
    const config = await getEvolutionConfigFromDB();

    if (!config || !config.servidor_url || !config.api_key) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada. Vá em Configurações > Evolution para definir URL, API Key e Instância." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = config.servidor_url.trim().replace(/\/+$/, ""); // remove trailing slash and whitespace
    const apiKey = config.api_key.trim();
    const effectiveInstanceName = (instanceName || config.instance_name || "").trim();

    if (!baseUrl || !apiKey || !effectiveInstanceName) {
      return new Response(
        JSON.stringify({ error: "Configuração incompleta. Verifique URL, API Key e Nome da Instância no banco." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let evolutionResponse;
    let endpoint = "";
    let method = "GET";
    let body = null;

    switch (action) {
      case "create":
        endpoint = "/instance/create";
        method = "POST";
        body = JSON.stringify({
          instanceName: effectiveInstanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        });
        break;

      case "connect":
        endpoint = `/instance/connect/${effectiveInstanceName}`;
        method = "GET";
        break;

      case "status":
        endpoint = `/instance/connectionState/${effectiveInstanceName}`;
        method = "GET";
        break;

      case "logout":
        endpoint = `/instance/logout/${effectiveInstanceName}`;
        method = "DELETE";
        break;

      case "delete":
        endpoint = `/instance/delete/${effectiveInstanceName}`;
        method = "DELETE";
        break;

      case "restart":
        endpoint = `/instance/restart/${effectiveInstanceName}`;
        method = "PUT";
        break;

      case "sendText":
        endpoint = `/message/sendText/${effectiveInstanceName}`;
        method = "POST";
        body = JSON.stringify({
          number: data.number,
          text: data.text,
          delay: 1200,
          linkPreview: false,
        });
        break;

      case "sendMedia":
        endpoint = `/message/sendMedia/${effectiveInstanceName}`;
        method = "POST";
        body = JSON.stringify({
          number: data.number,
          mediatype: data.mediatype || "image",
          mimetype: data.mimetype || "image/png",
          caption: data.caption || "",
          media: data.media,
          fileName: data.fileName || "qrcode.png",
          delay: 1200,
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

    // Se verificou status, atualizar no banco
    if (action === "status" && evolutionResponse.ok && config.id) {
      const state = responseData.instance?.state || responseData.state || "disconnected";
      const newStatus = state === "open" || state === "connected" ? "connected" : "disconnected";

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient
        .from("pltdataandrebueno_evolution_config")
        .update({
          status: newStatus,
          ultimo_check: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", config.id);
    }

    // Se desconectou, atualizar status
    if ((action === "logout" || action === "delete") && evolutionResponse.ok && config.id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient
        .from("pltdataandrebueno_evolution_config")
        .update({
          status: "disconnected",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", config.id);
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
