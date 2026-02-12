-- ====================================================================================
-- FIX: Criar Tabela de Junção Equipe-Coordenadores faltante
-- ====================================================================================

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS andresantos_equipe_coordenadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES andresantos_equipes(id) ON DELETE CASCADE,
  coordenador_id UUID NOT NULL REFERENCES andresantos_coordenadores(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(equipe_id, coordenador_id)
);

-- 2. Habilitar RLS
ALTER TABLE andresantos_equipe_coordenadores ENABLE ROW LEVEL SECURITY;

-- 3. Criar Policies de Acesso
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'andresantos_equipe_coordenadores' 
        AND policyname = 'Authenticated users can read equipe_coordenadores'
    ) THEN
        CREATE POLICY "Authenticated users can read equipe_coordenadores"
          ON andresantos_equipe_coordenadores FOR SELECT
          TO authenticated
          USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'andresantos_equipe_coordenadores' 
        AND policyname = 'Superadmin can manage equipe_coordenadores'
    ) THEN
        CREATE POLICY "Superadmin can manage equipe_coordenadores"
          ON andresantos_equipe_coordenadores FOR ALL
          TO authenticated
          USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text)
          WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);
    END IF;
END
$$;

-- ====================================================================================
-- Instruções:
-- 1. Copie todo este conteúdo.
-- 2. Vá no SQL Editor do seu Supabase Dashboard.
-- 3. Cole e clique em 'Run'.
-- ====================================================================================
