// Supabase Edge Function - Admin Manager
// Gerencia criação/listagem/ativação de administradores do sistema

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // Verificar token do usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o usuário é superadmin
    const userRole = userData.user.app_metadata?.role;
    if (userRole !== "superadmin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas superadmins podem gerenciar administradores." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Admin Manager] Authenticated superadmin: ${userData.user.email}`);

    // Cliente admin com service_role para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { action, data } = await req.json();

    switch (action) {
      // ========== LISTAR ADMINS ==========
      case "list": {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) {
          throw error;
        }

        // Filtrar apenas usuários com role superadmin ou sem role (usuários normais)
        const admins = users.users.map((user) => ({
          id: user.id,
          email: user.email,
          nome: user.user_metadata?.nome || "",
          telefone: user.user_metadata?.telefone || "",
          role: user.app_metadata?.role || "user",
          ativo: !user.banned_until,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        }));

        return new Response(JSON.stringify({ admins }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========== CRIAR ADMIN ==========
      case "create": {
        const { email, password, nome, telefone, role } = data;

        if (!email || !password) {
          return new Response(
            JSON.stringify({ error: "Email e senha são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Criar usuário
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            nome: nome || "",
            telefone: telefone || "",
          },
          app_metadata: {
            role: role || "user",
          },
        });

        if (createError) {
          console.error("[Admin Manager] Erro ao criar usuário:", createError);
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[Admin Manager] Novo admin criado: ${email}`);

        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: newUser.user.id,
              email: newUser.user.email,
              nome: newUser.user.user_metadata?.nome,
              role: newUser.user.app_metadata?.role,
            },
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== ATUALIZAR ADMIN ==========
      case "update": {
        const { userId, nome, telefone, role } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: "ID do usuário é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            user_metadata: { nome, telefone },
            app_metadata: { role },
          }
        );

        if (updateError) {
          throw updateError;
        }

        return new Response(
          JSON.stringify({ success: true, user: updatedUser.user }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== ATIVAR/DESATIVAR ADMIN ==========
      case "toggle": {
        const { userId, ativo } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: "ID do usuário é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Se desativando, definir banned_until para uma data futura distante
        // Se ativando, remover o ban
        const { data: updatedUser, error: toggleError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            ban_duration: ativo ? "none" : "876000h", // ~100 anos se desativando
          }
        );

        if (toggleError) {
          throw toggleError;
        }

        console.log(`[Admin Manager] Usuário ${userId} ${ativo ? "ativado" : "desativado"}`);

        return new Response(
          JSON.stringify({ success: true, ativo }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== DELETAR ADMIN ==========
      case "delete": {
        const { userId } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: "ID do usuário é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Não permitir auto-exclusão
        if (userId === userData.user.id) {
          return new Response(
            JSON.stringify({ error: "Você não pode excluir sua própria conta" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
          throw deleteError;
        }

        console.log(`[Admin Manager] Usuário ${userId} excluído`);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[Admin Manager] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
