-- =============================================
-- TABELA DE TAREFAS E AGENDAMENTOS
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Criar tabela de tarefas
CREATE TABLE IF NOT EXISTS pltdataandrebueno_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados da tarefa
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,

  -- Status e prioridade
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_progresso', 'concluida', 'cancelada')),
  prioridade VARCHAR(10) NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('alta', 'media', 'baixa')),

  -- Datas
  data_vencimento TIMESTAMP WITH TIME ZONE,
  data_lembrete TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,

  -- Campos removidos (não usamos atribuição)
  coordenador_id UUID DEFAULT NULL,
  lideranca_id UUID DEFAULT NULL,
  equipe_id UUID DEFAULT NULL,
  criado_por UUID DEFAULT NULL,

  -- Controle
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON pltdataandrebueno_tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_prioridade ON pltdataandrebueno_tarefas(prioridade);
CREATE INDEX IF NOT EXISTS idx_tarefas_data_vencimento ON pltdataandrebueno_tarefas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_ativo ON pltdataandrebueno_tarefas(ativo);
CREATE INDEX IF NOT EXISTS idx_tarefas_criado_em ON pltdataandrebueno_tarefas(criado_em);

-- Habilitar RLS (Row Level Security)
ALTER TABLE pltdataandrebueno_tarefas ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (ajuste conforme necessário)
CREATE POLICY "Permitir todas operações em tarefas" ON pltdataandrebueno_tarefas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentário na tabela
COMMENT ON TABLE pltdataandrebueno_tarefas IS 'Tabela de tarefas e agendamentos do coordenador master';
