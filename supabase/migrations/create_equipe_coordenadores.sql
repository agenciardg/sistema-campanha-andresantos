-- Criar tabela de relacionamento N:N entre equipes e coordenadores
CREATE TABLE IF NOT EXISTS andresantos_equipe_coordenadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES andresantos_equipes(id) ON DELETE CASCADE,
  coordenador_id UUID NOT NULL REFERENCES andresantos_coordenadores(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipe_id, coordenador_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ec_equipe_id ON andresantos_equipe_coordenadores(equipe_id);
CREATE INDEX IF NOT EXISTS idx_ec_coordenador_id ON andresantos_equipe_coordenadores(coordenador_id);
