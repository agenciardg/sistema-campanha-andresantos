-- =============================================
-- TABELA DE CONFIGURACAO EVOLUTION API
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Criar tabela de configuracao
CREATE TABLE IF NOT EXISTS pltdataandrebueno_evolution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados da conexao
  servidor_url VARCHAR(500) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  instance_name VARCHAR(100) NOT NULL,
  instance_token VARCHAR(255),

  -- Status da conexao
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'connecting', 'qr_pending')),
  ultimo_check TIMESTAMP WITH TIME ZONE,

  -- Controle
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice para busca rapida
CREATE INDEX IF NOT EXISTS idx_evolution_config_status ON pltdataandrebueno_evolution_config(status);

-- Habilitar RLS
ALTER TABLE pltdataandrebueno_evolution_config ENABLE ROW LEVEL SECURITY;

-- Politica para permitir todas operacoes
CREATE POLICY "Permitir todas operacoes em evolution_config" ON pltdataandrebueno_evolution_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentario na tabela
COMMENT ON TABLE pltdataandrebueno_evolution_config IS 'Configuracao da integracao com Evolution API (WhatsApp)';
