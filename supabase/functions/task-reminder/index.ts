// Supabase Edge Function - Task Reminder
// Envia lembretes via WhatsApp 30 min antes do horário agendado de uma tarefa
// Executada via pg_cron a cada 5 minutos

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ==================== HELPERS ====================

function limparTelefone(telefone: string): string {
  // Remove tudo que não é dígito
  let limpo = telefone.replace(/\D/g, "");

  // Se começa com 0, remove
  if (limpo.startsWith("0")) {
    limpo = limpo.substring(1);
  }

  // Se não tem código do país, adiciona 55 (Brasil)
  if (!limpo.startsWith("55")) {
    limpo = "55" + limpo;
  }

  return limpo;
}

function formatarHorario(dataISO: string): string {
  const data = new Date(dataISO);
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ==================== HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Validar autenticação via header secreto (chamada do pg_cron)
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");

    // Aceita: x-cron-secret OU Bearer com service_role key
    const isAuthorized =
      (cronSecret && headerSecret === cronSecret) ||
      (authHeader && authHeader === `Bearer ${serviceRoleKey}`);

    if (!isAuthorized) {
      console.error("[Task Reminder] Acesso não autorizado");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========== 1. Buscar tarefas que precisam de lembrete ==========
    // Tarefas ativas, pendentes/em_progresso, com vencimento nos próximos 35 min
    // e que ainda não receberam lembrete (data_lembrete IS NULL)

    const agora = new Date();
    const daqui35min = new Date(agora.getTime() + 35 * 60 * 1000);

    const { data: tarefas, error: tarefasError } = await supabase
      .from("pltdataandrebueno_tarefas")
      .select("*")
      .eq("ativo", true)
      .in("status", ["pendente", "em_progresso"])
      .not("data_vencimento", "is", null)
      .is("data_lembrete", null)
      .gte("data_vencimento", agora.toISOString())
      .lte("data_vencimento", daqui35min.toISOString());

    if (tarefasError) {
      console.error("[Task Reminder] Erro ao buscar tarefas:", tarefasError.message);
      return new Response(
        JSON.stringify({ error: tarefasError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tarefas || tarefas.length === 0) {
      console.log("[Task Reminder] Nenhuma tarefa para lembrar");
      return new Response(
        JSON.stringify({ message: "Nenhuma tarefa para lembrar", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Task Reminder] ${tarefas.length} tarefa(s) encontrada(s) para lembrete`);

    // ========== 2. Buscar config da Evolution API ==========
    const { data: evolutionConfig, error: configError } = await supabase
      .from("pltdataandrebueno_evolution_config")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (configError || !evolutionConfig) {
      console.error("[Task Reminder] Evolution API não configurada:", configError?.message);
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (evolutionConfig.status !== "connected") {
      console.warn("[Task Reminder] Evolution API desconectada:", evolutionConfig.status);
      return new Response(
        JSON.stringify({ error: "Evolution API desconectada" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== 3. Buscar template de mensagem ==========
    const { data: templateConfig } = await supabase
      .from("pltdataandrebueno_configuracoes")
      .select("valor")
      .eq("chave", "whatsapp.msg_lembrete_tarefa")
      .single();

    const template = templateConfig?.valor ||
      "⏰ *Lembrete de Tarefa!*\n\nOlá, *{nome}*!\n\nSua tarefa começa em *30 minutos*:\n\n📌 *{titulo}*\n📝 {descricao}\n{prioridade}\n🕐 *Horário:* {horario}\n\nPrepare-se! 💪";

    // ========== 4. Processar cada tarefa ==========
    const resultados: { tarefa_id: string; sucesso: boolean; erro?: string }[] = [];
    const baseUrl = evolutionConfig.servidor_url.replace(/\/+$/, "");
    const apiKey = evolutionConfig.api_key;
    const instanceName = evolutionConfig.instance_name;

    for (const tarefa of tarefas) {
      try {
        // Buscar telefone do responsável (prioridade: responsavel > coordenador > lideranca)
        let nomeResponsavel = "";
        let telefoneResponsavel = "";

        if (tarefa.responsavel_id) {
          const { data: resp } = await supabase
            .from("pltdataandrebueno_responsaveis")
            .select("nome, telefone")
            .eq("id", tarefa.responsavel_id)
            .single();
          if (resp) {
            nomeResponsavel = resp.nome || "";
            telefoneResponsavel = resp.telefone || "";
          }
        }

        if (!telefoneResponsavel && tarefa.coordenador_id) {
          const { data: coord } = await supabase
            .from("pltdataandrebueno_coordenadores")
            .select("nome, telefone")
            .eq("id", tarefa.coordenador_id)
            .single();
          if (coord) {
            nomeResponsavel = coord.nome || "";
            telefoneResponsavel = coord.telefone || "";
          }
        }

        if (!telefoneResponsavel && tarefa.lideranca_id) {
          const { data: lid } = await supabase
            .from("pltdataandrebueno_liderancas")
            .select("nome, telefone")
            .eq("id", tarefa.lideranca_id)
            .single();
          if (lid) {
            nomeResponsavel = lid.nome || "";
            telefoneResponsavel = lid.telefone || "";
          }
        }

        if (!telefoneResponsavel) {
          console.warn(`[Task Reminder] Tarefa ${tarefa.id} - sem telefone do responsável`);
          // Marca data_lembrete mesmo assim para não tentar de novo
          await supabase
            .from("pltdataandrebueno_tarefas")
            .update({ data_lembrete: new Date().toISOString() })
            .eq("id", tarefa.id);
          resultados.push({ tarefa_id: tarefa.id, sucesso: false, erro: "Sem telefone" });
          continue;
        }

        // Montar mensagem
        const prioridadeEmoji: Record<string, string> = { alta: "🔴", media: "🟡", baixa: "🟢" };
        const prioridadeTexto: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
        const prioridadeStr = `${prioridadeEmoji[tarefa.prioridade] || "⚪"} *Prioridade:* ${prioridadeTexto[tarefa.prioridade] || tarefa.prioridade}`;
        const horarioStr = formatarHorario(tarefa.data_vencimento);

        const mensagem = template
          .replace(/\{nome\}/g, nomeResponsavel)
          .replace(/\{titulo\}/g, tarefa.titulo || "Sem título")
          .replace(/\{descricao\}/g, tarefa.descricao || "Sem descrição")
          .replace(/\{prioridade\}/g, prioridadeStr)
          .replace(/\{horario\}/g, horarioStr);

        // Enviar WhatsApp via Evolution API
        const telefoneFormatado = limparTelefone(telefoneResponsavel);

        const sendResponse = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            apikey: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: telefoneFormatado,
            text: mensagem,
            delay: 1200,
            linkPreview: false,
          }),
        });

        if (!sendResponse.ok) {
          const errorData = await sendResponse.text();
          console.error(`[Task Reminder] Erro ao enviar para ${nomeResponsavel}:`, errorData);
          resultados.push({ tarefa_id: tarefa.id, sucesso: false, erro: `HTTP ${sendResponse.status}` });
          continue;
        }

        // Marcar lembrete como enviado
        await supabase
          .from("pltdataandrebueno_tarefas")
          .update({ data_lembrete: new Date().toISOString() })
          .eq("id", tarefa.id);

        console.log(`[Task Reminder] ✅ Lembrete enviado para ${nomeResponsavel} (tarefa: ${tarefa.titulo})`);
        resultados.push({ tarefa_id: tarefa.id, sucesso: true });

      } catch (err) {
        console.error(`[Task Reminder] Erro na tarefa ${tarefa.id}:`, err);
        resultados.push({ tarefa_id: tarefa.id, sucesso: false, erro: String(err) });
      }
    }

    const enviados = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    console.log(`[Task Reminder] Concluído: ${enviados} enviados, ${falhas} falhas`);

    return new Response(
      JSON.stringify({
        message: `Lembretes processados: ${enviados} enviados, ${falhas} falhas`,
        count: tarefas.length,
        enviados,
        falhas,
        detalhes: resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Task Reminder] Erro fatal:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
