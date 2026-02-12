-- SQL para permitir leitura pública das configurações (necessário para branding no login)
-- Permite que usuários não autenticados vejam as configurações básicas
-- SEGURANÇA: Apenas chaves não sensíveis devem ser lidas publicamente? 
-- No momento o sistema filtra no frontend, mas o ideal é RLS.
-- Por enquanto, habilitamos leitura total para 'anon' para garantir que o site carregue.

DROP POLICY IF EXISTS "Permitir leitura pública de configurações" ON andresantos_configuracoes;

CREATE POLICY "Permitir leitura pública de configurações"
ON andresantos_configuracoes
FOR SELECT
TO anon, authenticated
USING (true);

-- Garantir que superadmin possa fazer tudo
DROP POLICY IF EXISTS "Superadmin full access on configs" ON andresantos_configuracoes;
CREATE POLICY "Superadmin full access on configs"
ON andresantos_configuracoes
FOR ALL
TO authenticated
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin')
WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin');
