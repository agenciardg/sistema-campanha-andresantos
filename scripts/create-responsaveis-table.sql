-- =============================================
-- TABELA DE RESPONSAVEIS
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Criar tabela de responsaveis
CREATE TABLE IF NOT EXISTS pltdataandrebueno_responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(100),
  telefone VARCHAR(20),
  email VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE pltdataandrebueno_responsaveis ENABLE ROW LEVEL SECURITY;

-- Politica para permitir todas operacoes
CREATE POLICY "Permitir todas operacoes em responsaveis" ON pltdataandrebueno_responsaveis
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indice para busca por nome
CREATE INDEX IF NOT EXISTS idx_responsaveis_nome ON pltdataandrebueno_responsaveis(nome);
CREATE INDEX IF NOT EXISTS idx_responsaveis_ativo ON pltdataandrebueno_responsaveis(ativo);

-- Adicionar coluna responsavel_id na tabela de tarefas (se ainda nao existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pltdataandrebueno_tarefas' AND column_name = 'responsavel_id'
  ) THEN
    ALTER TABLE pltdataandrebueno_tarefas ADD COLUMN responsavel_id UUID REFERENCES pltdataandrebueno_responsaveis(id);
  END IF;
END $$;

-- Indice para busca por responsavel
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON pltdataandrebueno_tarefas(responsavel_id);

-- Comentario na tabela
COMMENT ON TABLE pltdataandrebueno_responsaveis IS 'Tabela de responsaveis pelas tarefas';
