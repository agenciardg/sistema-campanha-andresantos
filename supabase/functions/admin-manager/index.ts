import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é superadmin
    const callerRole = userData.user.app_metadata?.role;
    if (callerRole !== "superadmin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas superadmins podem gerenciar administradores." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== SUPABASE ADMIN CLIENT ==========
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action, data } = await req.json();

    switch (action) {
      // ========== LISTAR ADMINS ==========
      case "list": {
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const admins = (listData.users || [])
          .filter((u: any) => {
            const role = u.app_metadata?.role;
            return role === "superadmin" || role === "admin";
          })
          .map((u: any) => ({
            id: u.id,
            email: u.email,
            nome: u.user_metadata?.nome || "",
            telefone: u.user_metadata?.telefone || "",
            role: u.app_metadata?.role || "admin",
            permissions: u.app_metadata?.permissions || [],
            ativo: !u.banned_until || new Date(u.banned_until) < new Date(),
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
          }));

        return new Response(
          JSON.stringify({ admins }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== CRIAR ADMIN ==========
      case "create": {
        const { email, password, nome, telefone, role, permissions } = data;

        if (!email || !password) {
          return new Response(
            JSON.stringify({ error: "Email e senha são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: {
            role: role || "admin",
            permissions: permissions || [],
          },
          user_metadata: {
            nome: nome || "",
            telefone: telefone || "",
          },
        });

        if (createError) throw createError;

        return new Response(
          JSON.stringify({
            user: {
              id: newUser.user.id,
              email: newUser.user.email,
              nome: nome || "",
              telefone: telefone || "",
              role: role || "admin",
              permissions: permissions || [],
              ativo: true,
              created_at: newUser.user.created_at,
              last_sign_in_at: null,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== ATUALIZAR ADMIN ==========
      case "update": {
        const { userId, nome, telefone, role: newRole, permissions: newPermissions } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevenir auto-demoção
        if (userId === userData.user.id && newRole && newRole !== "superadmin") {
          return new Response(
            JSON.stringify({ error: "Você não pode rebaixar seu próprio role" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updatePayload: any = {};

        // User metadata
        if (nome !== undefined || telefone !== undefined) {
          updatePayload.user_metadata = {};
          if (nome !== undefined) updatePayload.user_metadata.nome = nome;
          if (telefone !== undefined) updatePayload.user_metadata.telefone = telefone;
        }

        // App metadata (role e permissions)
        if (newRole !== undefined || newPermissions !== undefined) {
          // Buscar metadata atual para preservar
          const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          const currentAppMeta = currentUser?.user?.app_metadata || {};

          updatePayload.app_metadata = {
            ...currentAppMeta,
          };
          if (newRole !== undefined) updatePayload.app_metadata.role = newRole;
          if (newPermissions !== undefined) updatePayload.app_metadata.permissions = newPermissions;
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updatePayload);
        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== TOGGLE (ATIVAR/DESATIVAR) ==========
      case "toggle": {
        const { userId: toggleUserId, ativo } = data;

        if (!toggleUserId) {
          return new Response(
            JSON.stringify({ error: "userId é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevenir auto-desativação
        if (toggleUserId === userData.user.id && !ativo) {
          return new Response(
            JSON.stringify({ error: "Você não pode desativar sua própria conta" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: toggleError } = await supabaseAdmin.auth.admin.updateUserById(toggleUserId, {
          ban_duration: ativo ? "none" : "876600h", // ~100 anos = ban permanente
        });
        if (toggleError) throw toggleError;

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== EXCLUIR ADMIN ==========
      case "delete": {
        const { userId: deleteUserId } = data;

        if (!deleteUserId) {
          return new Response(
            JSON.stringify({ error: "userId é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevenir auto-exclusão
        if (deleteUserId === userData.user.id) {
          return new Response(
            JSON.stringify({ error: "Você não pode excluir sua própria conta" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(deleteUserId);
        if (deleteError) throw deleteError;

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
