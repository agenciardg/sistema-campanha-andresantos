-- Corrige a política de RLS para a tabela de configurações
-- Permite que usuários não autenticados (visitantes na página de login) possam ler as configurações de branding
ALTER TABLE pltdataandrebueno_configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read configs" ON pltdataandrebueno_configuracoes;

CREATE POLICY "Public read access for configs"
  ON pltdataandrebueno_configuracoes FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "Public read access for configs" ON pltdataandrebueno_configuracoes IS 'Permite leitura pública das configurações de branding e sistema.';
