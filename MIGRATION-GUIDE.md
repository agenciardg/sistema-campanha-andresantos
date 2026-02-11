# Guia de Migração - PoliticaData para Novo Projeto Supabase

> Guia passo a passo para um agente migrar o projeto PoliticaData completo para um novo projeto Supabase, incluindo tabelas, RLS policies, Edge Functions, cron jobs e credenciais de admin.

---

## Pré-requisitos

Antes de iniciar, o agente precisa receber do usuário:

| Item | Descrição | Exemplo |
|------|-----------|---------|
| `NOVO_SUPABASE_URL` | URL do novo projeto Supabase | `https://xxxxx.supabase.co` |
| `NOVO_SUPABASE_ANON_KEY` | Chave anônima do novo projeto | `eyJhbGciOi...` |
| `NOVO_SUPABASE_SERVICE_ROLE_KEY` | Service role key (nunca expor no frontend) | `eyJhbGciOi...` |
| `NOVO_PROJECT_REF` | Ref do projeto (parte da URL) | `xxxxx` |
| `ADMIN_EMAIL` | Email do novo superadmin | `admin@novocliente.com.br` |
| `ADMIN_SENHA` | Senha do novo superadmin | `SenhaSegura123` |
| `PREFIXO_TABELAS` | Prefixo das tabelas (manter ou mudar) | `pltdatarenatasene_` |

---

## Etapa 1: Habilitar Extensões Necessárias

Execute os seguintes SQLs no novo projeto (via SQL Editor ou MCP `execute_sql`):

```sql
-- Extensões obrigatórias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
```

> **Nota:** `pg_cron` e `pg_net` são necessários para o sistema de lembretes automáticos de tarefas via WhatsApp.

---

## Etapa 2: Criar as 11 Tabelas

**IMPORTANTE:** A ordem de criação importa por causa das foreign keys. Siga esta sequência exata.

### 2.1 - Tabela: organizacoes (sem dependências)

```sql
CREATE TABLE pltdatarenatasene_organizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  tipo VARCHAR NOT NULL,
  tipo_personalizado VARCHAR,
  cep VARCHAR,
  endereco VARCHAR,
  numero VARCHAR,
  bairro VARCHAR,
  cidade VARCHAR,
  estado VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 - Tabela: responsaveis (sem dependências)

```sql
CREATE TABLE pltdatarenatasene_responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  cargo VARCHAR,
  telefone VARCHAR,
  email VARCHAR,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 - Tabela: configuracoes (sem dependências)

```sql
CREATE TABLE pltdatarenatasene_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR NOT NULL UNIQUE,
  valor TEXT,
  descricao VARCHAR,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.4 - Tabela: evolution_config (sem dependências)

```sql
CREATE TABLE pltdatarenatasene_evolution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_url VARCHAR NOT NULL,
  api_key VARCHAR NOT NULL,
  instance_name VARCHAR NOT NULL,
  instance_token VARCHAR,
  status VARCHAR DEFAULT 'disconnected',
  ultimo_check TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.5 - Tabela: coordenadores_master (sem dependências)

```sql
CREATE TABLE pltdatarenatasene_coordenadores_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  senha VARCHAR NOT NULL,
  telefone VARCHAR,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.6 - Tabela: coordenadores (depende de: organizacoes)

```sql
CREATE TABLE pltdatarenatasene_coordenadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  telefone VARCHAR,
  email VARCHAR,
  regiao VARCHAR,
  organizacao_id UUID REFERENCES pltdatarenatasene_organizacoes(id),
  codigo_unico VARCHAR UNIQUE,
  cep VARCHAR,
  endereco VARCHAR,
  numero VARCHAR,
  bairro VARCHAR,
  cidade VARCHAR,
  estado VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  meta INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  data_nascimento DATE
);
```

### 2.7 - Tabela: equipes (depende de: organizacoes)

```sql
CREATE TABLE pltdatarenatasene_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  cor VARCHAR DEFAULT '#1e5a8d',
  organizacao_id UUID REFERENCES pltdatarenatasene_organizacoes(id),
  cep VARCHAR,
  endereco VARCHAR,
  numero VARCHAR,
  bairro VARCHAR,
  cidade VARCHAR,
  estado VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  meta INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.8 - Tabela: liderancas (depende de: equipes, organizacoes)

```sql
CREATE TABLE pltdatarenatasene_liderancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES pltdatarenatasene_equipes(id),
  organizacao_id UUID REFERENCES pltdatarenatasene_organizacoes(id),
  nome VARCHAR NOT NULL,
  telefone VARCHAR,
  email VARCHAR,
  codigo_unico VARCHAR UNIQUE,
  cep VARCHAR,
  endereco VARCHAR,
  numero VARCHAR,
  bairro VARCHAR,
  cidade VARCHAR,
  estado VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  meta INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  data_nascimento DATE
);
```

### 2.9 - Tabela: cadastros (depende de: liderancas, coordenadores)

```sql
CREATE TABLE pltdatarenatasene_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lideranca_id UUID REFERENCES pltdatarenatasene_liderancas(id),
  coordenador_id UUID REFERENCES pltdatarenatasene_coordenadores(id),
  nome VARCHAR NOT NULL,
  data_nascimento DATE,
  telefone VARCHAR,
  email VARCHAR,
  cep VARCHAR,
  endereco VARCHAR,
  numero VARCHAR,
  bairro VARCHAR,
  cidade VARCHAR,
  estado VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  aceite_politica BOOLEAN DEFAULT false,
  origem VARCHAR DEFAULT 'manual',
  criado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.10 - Tabela: tarefas (depende de: responsaveis)

```sql
CREATE TABLE pltdatarenatasene_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR NOT NULL,
  descricao TEXT,
  status VARCHAR DEFAULT 'pendente',
  prioridade VARCHAR DEFAULT 'media',
  data_vencimento TIMESTAMPTZ,
  data_lembrete TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  coordenador_id UUID,
  lideranca_id UUID,
  equipe_id UUID,
  criado_por UUID,
  responsavel_id UUID REFERENCES pltdatarenatasene_responsaveis(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 2.11 - Tabela: equipe_coordenadores (depende de: equipes, coordenadores)

```sql
CREATE TABLE pltdatarenatasene_equipe_coordenadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES pltdatarenatasene_equipes(id) ON DELETE CASCADE,
  coordenador_id UUID NOT NULL REFERENCES pltdatarenatasene_coordenadores(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(equipe_id, coordenador_id)
);
```

---

## Etapa 3: Habilitar RLS e Criar Policies

**Todas as 11 tabelas possuem RLS habilitado.** O padrão de segurança usa `app_metadata.role = 'superadmin'` no JWT do Supabase Auth.

### 3.1 - Padrão para a maioria das tabelas

As seguintes tabelas seguem o mesmo padrão (SELECT para authenticated, INSERT/UPDATE/DELETE para superadmin):

- `pltdatarenatasene_coordenadores`
- `pltdatarenatasene_coordenadores_master`
- `pltdatarenatasene_equipes`
- `pltdatarenatasene_equipe_coordenadores`
- `pltdatarenatasene_liderancas`
- `pltdatarenatasene_organizacoes`
- `pltdatarenatasene_responsaveis`
- `pltdatarenatasene_tarefas`

Para cada uma destas tabelas, execute (substituindo `NOME_TABELA` pelo nome da tabela):

```sql
ALTER TABLE pltdatarenatasene_NOME_TABELA ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY "Authenticated users can read pltdatarenatasene_NOME_TABELA"
  ON pltdatarenatasene_NOME_TABELA FOR SELECT
  TO authenticated
  USING (true);

-- Insert: apenas superadmin
CREATE POLICY "Superadmin can insert pltdatarenatasene_NOME_TABELA"
  ON pltdatarenatasene_NOME_TABELA FOR INSERT
  TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

-- Update: apenas superadmin
CREATE POLICY "Superadmin can update pltdatarenatasene_NOME_TABELA"
  ON pltdatarenatasene_NOME_TABELA FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

-- Delete: apenas superadmin
CREATE POLICY "Superadmin can delete pltdatarenatasene_NOME_TABELA"
  ON pltdatarenatasene_NOME_TABELA FOR DELETE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);
```

### 3.2 - Tabela cadastros (permite INSERT anônimo para cadastro público)

```sql
ALTER TABLE pltdatarenatasene_cadastros ENABLE ROW LEVEL SECURITY;

-- Insert: anônimo E autenticado (página pública de cadastro)
CREATE POLICY "Anyone can insert pltdatarenatasene_cadastros"
  ON pltdatarenatasene_cadastros FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Leitura: apenas autenticados
CREATE POLICY "Authenticated users can read pltdatarenatasene_cadastros"
  ON pltdatarenatasene_cadastros FOR SELECT
  TO authenticated
  USING (true);

-- Update: apenas superadmin
CREATE POLICY "Superadmin can update pltdatarenatasene_cadastros"
  ON pltdatarenatasene_cadastros FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

-- Delete: apenas superadmin
CREATE POLICY "Superadmin can delete pltdatarenatasene_cadastros"
  ON pltdatarenatasene_cadastros FOR DELETE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);
```

### 3.3 - Tabela configuracoes (leitura para todos autenticados, escrita para superadmin)

```sql
ALTER TABLE pltdatarenatasene_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read configs"
  ON pltdatarenatasene_configuracoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmins can insert configs"
  ON pltdatarenatasene_configuracoes FOR INSERT
  TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

CREATE POLICY "Superadmins can update configs"
  ON pltdatarenatasene_configuracoes FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);
```

### 3.4 - Tabela evolution_config (acesso total apenas para superadmin)

```sql
ALTER TABLE pltdatarenatasene_evolution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can read evolution config"
  ON pltdatarenatasene_evolution_config FOR SELECT
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

CREATE POLICY "Superadmins can insert evolution config"
  ON pltdatarenatasene_evolution_config FOR INSERT
  TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

CREATE POLICY "Superadmins can update evolution config"
  ON pltdatarenatasene_evolution_config FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);

### 3.5 - Tabela equipe_coordenadores (acesso total apenas para superadmin)

```sql
ALTER TABLE pltdatarenatasene_equipe_coordenadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read equipe_coordenadores"
  ON pltdatarenatasene_equipe_coordenadores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmin can manage equipe_coordenadores"
  ON pltdatarenatasene_equipe_coordenadores FOR ALL
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'::text);
```

---

## Etapa 4: Criar Usuário Admin (Superadmin)

O sistema usa Supabase Auth com `app_metadata.role = 'superadmin'` para controle de acesso.

Execute via SQL Editor (requer service_role):

```sql
-- Criar o usuário admin via Supabase Auth Admin API
-- Use a Edge Function abaixo OU o Supabase Dashboard > Authentication > Users > Add User
```

**Opção A: Via Supabase Dashboard**
1. Vá em Authentication > Users > Add User
2. Email: `ADMIN_EMAIL` | Senha: `ADMIN_SENHA`
3. Marque "Auto confirm user"
4. Após criar, execute o SQL abaixo para definir o role:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "superadmin"}'::jsonb
WHERE email = 'ADMIN_EMAIL';
```

**Opção B: Via Edge Function (deploy temporário)**

Faça deploy de uma Edge Function temporária `create-admin`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password } = await req.json();

    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "superadmin" },
      user_metadata: { nome: "Administrador" }
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, userId: user.user.id }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, status: 400 }
    );
  }
});
```

Deploy com `verify_jwt: false`, chame com:
```bash
curl -X POST https://NOVO_PROJECT_REF.supabase.co/functions/v1/create-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "ADMIN_EMAIL", "password": "ADMIN_SENHA"}'
```

Após confirmar que o admin foi criado, **delete essa Edge Function** por segurança.

**Opção C: Via Edge Function `admin-manager` (se já deployada)**

Se a Edge Function `admin-manager` (seção 5.4) já estiver deployada, o superadmin pode criar novos admins diretamente pela aba **Administradores** na página de Configurações. Neste caso, o primeiro admin ainda precisa ser criado via Opção A ou B.

---

## Etapa 5: Deploy das Edge Functions

O projeto usa **4 Edge Functions** principais. Faça deploy via MCP `deploy_edge_function` ou CLI `supabase functions deploy`.

### 5.1 - geocoding-proxy (verify_jwt: false)

**Motivo:** Permite requisições do cadastro público de apoiadores (sem auth).

```typescript
// Supabase Edge Function - Google Geocoding API Proxy
// Lê a API key do banco de dados (tabela de configurações) para máxima segurança
// Sem autenticação JWT - permite requisições públicas (cadastro de apoiadores)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==================== CORS ====================

function getCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ==================== CACHE DA API KEY ====================

let cachedApiKey: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getGoogleMapsApiKey(): Promise<string | null> {
  if (cachedApiKey && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return cachedApiKey;
  }

  const envKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("[Geocoding Proxy] SUPABASE_URL ou SERVICE_ROLE_KEY não configuradas, usando env var");
      return envKey || null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("pltdatarenatasene_configuracoes")
      .select("valor")
      .eq("chave", "api.google_maps_key")
      .single();

    if (error || !data?.valor) {
      console.warn("[Geocoding Proxy] Chave não encontrada no banco:", error?.message);
      if (envKey) {
        cachedApiKey = envKey;
        cacheTimestamp = Date.now();
        return envKey;
      }
      return null;
    }

    cachedApiKey = data.valor;
    cacheTimestamp = Date.now();
    console.log("[Geocoding Proxy] API key carregada do banco de dados");
    return cachedApiKey;

  } catch (err) {
    console.error("[Geocoding Proxy] Erro ao ler API key do banco:", err);
    if (envKey) {
      cachedApiKey = envKey;
      cacheTimestamp = Date.now();
      return envKey;
    }
    return null;
  }
}

// ==================== HELPERS ====================

function extractAddressComponents(addressComponents: any[]) {
  const getComponent = (types: string[]) => {
    const component = addressComponents.find((c: any) =>
      types.some(type => c.types.includes(type))
    );
    return component?.long_name || '';
  };

  const getComponentShort = (types: string[]) => {
    const component = addressComponents.find((c: any) =>
      types.some(type => c.types.includes(type))
    );
    return component?.short_name || component?.long_name || '';
  };

  return {
    street: getComponent(['route']),
    streetNumber: getComponent(['street_number']),
    neighborhood: getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']),
    city: getComponent(['locality', 'administrative_area_level_2']),
    state: getComponentShort(['administrative_area_level_1']),
    country: getComponent(['country']),
    postalCode: getComponent(['postal_code']),
  };
}

// ==================== HANDLER ====================

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
    const googleMapsApiKey = await getGoogleMapsApiKey();

    if (!googleMapsApiKey) {
      console.error("[Geocoding Proxy] Google Maps API key não configurada");
      return new Response(
        JSON.stringify({ error: "Google Maps API key não configurada. Vá em Configurações > APIs & Integrações para definir a chave." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, address, cep } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Ação não especificada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Geocoding] action=${action}, address=${address}, cep=${cep}`);

    let responseData: any = null;

    switch (action) {
      case "geocode": {
        if (!address) {
          return new Response(
            JSON.stringify({ error: "Endereço não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const params = new URLSearchParams({
          address: address,
          key: googleMapsApiKey,
          language: "pt-BR",
          region: "br",
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
        );

        const data = await response.json();

        if (data.status === "OK" && data.results && data.results.length > 0) {
          const result = data.results[0];
          const location = result.geometry?.location;
          const locationType = result.geometry?.location_type;
          const components = extractAddressComponents(result.address_components || []);

          responseData = {
            success: true,
            latitude: location?.lat,
            longitude: location?.lng,
            locationType: locationType,
            formattedAddress: result.formatted_address,
            street: components.street,
            streetNumber: components.streetNumber,
            neighborhood: components.neighborhood,
            city: components.city,
            state: components.state,
            country: components.country,
            postalCode: components.postalCode,
          };
        } else {
          responseData = {
            success: false,
            error: data.status === "ZERO_RESULTS"
              ? "Endereço não encontrado"
              : data.error_message || `Erro: ${data.status}`,
          };
        }
        break;
      }

      case "geocodeCep":
      case "buscarCep": {
        if (!cep) {
          return new Response(
            JSON.stringify({ error: "CEP não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cepLimpo = cep.replace(/\D/g, "");

        const params = new URLSearchParams({
          address: `${cepLimpo}, Brasil`,
          key: googleMapsApiKey,
          language: "pt-BR",
          region: "br",
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
        );

        const data = await response.json();

        if (data.status === "OK" && data.results && data.results.length > 0) {
          const result = data.results[0];
          const location = result.geometry?.location;
          const locationType = result.geometry?.location_type;
          const components = extractAddressComponents(result.address_components || []);

          responseData = {
            success: true,
            latitude: location?.lat,
            longitude: location?.lng,
            locationType: locationType,
            formattedAddress: result.formatted_address,
            street: components.street,
            streetNumber: components.streetNumber,
            neighborhood: components.neighborhood,
            city: components.city,
            state: components.state,
            country: components.country,
            postalCode: components.postalCode,
          };
        } else {
          responseData = {
            success: false,
            error: "CEP não encontrado",
          };
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Geocoding Proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 5.2 - evolution-proxy (verify_jwt: true)

**Motivo:** Proxy para Evolution API (WhatsApp). Requer autenticação JWT do usuário logado.

```typescript
// Supabase Edge Function - Evolution API Proxy
// Resolve o problema de CORS fazendo as chamadas pelo servidor
// Lê configuração (servidor_url, api_key, instance_name) do banco de dados

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ==================== CACHE DA CONFIG ====================

let cachedConfig: { servidor_url: string; api_key: string; instance_name: string; id: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getEvolutionConfigFromDB(): Promise<typeof cachedConfig> {
  if (cachedConfig && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[Evolution Proxy] SUPABASE_URL ou SERVICE_ROLE_KEY não configuradas");
      return null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("pltdatarenatasene_evolution_config")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn("[Evolution Proxy] Config não encontrada no banco:", error?.message);
      return null;
    }

    cachedConfig = {
      id: data.id,
      servidor_url: data.servidor_url,
      api_key: data.api_key,
      instance_name: data.instance_name,
    };
    cacheTimestamp = Date.now();
    console.log("[Evolution Proxy] Config carregada do banco de dados");
    return cachedConfig;

  } catch (err) {
    console.error("[Evolution Proxy] Erro ao ler config do banco:", err);
    return null;
  }
}

// ==================== HANDLER ====================

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      console.error("[Evolution Proxy] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Evolution Proxy] Authenticated user: ${userData.user.email}`);

    const { action, instanceName, data } = await req.json();

    const config = await getEvolutionConfigFromDB();

    if (!config || !config.servidor_url || !config.api_key) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada. Vá em Configurações > Evolution para definir URL, API Key e Instância." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = config.servidor_url.replace(/\/+$/, "");
    const apiKey = config.api_key;
    const effectiveInstanceName = instanceName || config.instance_name;

    let evolutionResponse;
    let endpoint = "";
    let method = "GET";
    let body = null;

    switch (action) {
      case "create":
        endpoint = "/instance/create";
        method = "POST";
        body = JSON.stringify({
          instanceName: effectiveInstanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        });
        break;
      case "connect":
        endpoint = `/instance/connect/${effectiveInstanceName}`;
        method = "GET";
        break;
      case "status":
        endpoint = `/instance/connectionState/${effectiveInstanceName}`;
        method = "GET";
        break;
      case "logout":
        endpoint = `/instance/logout/${effectiveInstanceName}`;
        method = "DELETE";
        break;
      case "delete":
        endpoint = `/instance/delete/${effectiveInstanceName}`;
        method = "DELETE";
        break;
      case "restart":
        endpoint = `/instance/restart/${effectiveInstanceName}`;
        method = "PUT";
        break;
      case "sendText":
        endpoint = `/message/sendText/${effectiveInstanceName}`;
        method = "POST";
        body = JSON.stringify({
          number: data.number,
          text: data.text,
          delay: 1200,
          linkPreview: false,
        });
        break;
      case "fetchInstances":
        endpoint = "/instance/fetchInstances";
        method = "GET";
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[Evolution Proxy] ${method} ${baseUrl}${endpoint}`);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      fetchOptions.body = body;
    }

    evolutionResponse = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    const responseData = await evolutionResponse.json();

    // Se verificou status, atualizar no banco
    if (action === "status" && evolutionResponse.ok && config.id) {
      const state = responseData.instance?.state || responseData.state || "disconnected";
      const newStatus = state === "open" || state === "connected" ? "connected" : "disconnected";

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient
        .from("pltdatarenatasene_evolution_config")
        .update({
          status: newStatus,
          ultimo_check: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", config.id);
    }

    if ((action === "logout" || action === "delete") && evolutionResponse.ok && config.id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient
        .from("pltdatarenatasene_evolution_config")
        .update({
          status: "disconnected",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", config.id);
    }

    return new Response(JSON.stringify(responseData), {
      status: evolutionResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Evolution Proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 5.3 - task-reminder (verify_jwt: false)

**Motivo:** Chamada por cron job (pg_cron), não por browser. Autenticação via service_role_key no header.

```typescript
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
  let limpo = telefone.replace(/\D/g, "");
  if (limpo.startsWith("0")) {
    limpo = limpo.substring(1);
  }
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

    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");

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

    const agora = new Date();
    const daqui35min = new Date(agora.getTime() + 35 * 60 * 1000);

    const { data: tarefas, error: tarefasError } = await supabase
      .from("pltdatarenatasene_tarefas")
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

    const { data: evolutionConfig, error: configError } = await supabase
      .from("pltdatarenatasene_evolution_config")
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

    const { data: templateConfig } = await supabase
      .from("pltdatarenatasene_configuracoes")
      .select("valor")
      .eq("chave", "whatsapp.msg_lembrete_tarefa")
      .single();

    const template = templateConfig?.valor ||
      "⏰ *Lembrete de Tarefa!*\n\nOlá, *{nome}*!\n\nSua tarefa começa em *30 minutos*:\n\n📌 *{titulo}*\n📝 {descricao}\n{prioridade}\n🕐 *Horário:* {horario}\n\nPrepare-se! 💪";

    const resultados: { tarefa_id: string; sucesso: boolean; erro?: string }[] = [];
    const baseUrl = evolutionConfig.servidor_url.replace(/\/+$/, "");
    const apiKey = evolutionConfig.api_key;
    const instanceName = evolutionConfig.instance_name;

    for (const tarefa of tarefas) {
      try {
        let nomeResponsavel = "";
        let telefoneResponsavel = "";

        if (tarefa.responsavel_id) {
          const { data: resp } = await supabase
            .from("pltdatarenatasene_responsaveis")
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
            .from("pltdatarenatasene_coordenadores")
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
            .from("pltdatarenatasene_liderancas")
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
          await supabase
            .from("pltdatarenatasene_tarefas")
            .update({ data_lembrete: new Date().toISOString() })
            .eq("id", tarefa.id);
          resultados.push({ tarefa_id: tarefa.id, sucesso: false, erro: "Sem telefone" });
          continue;
        }

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

        await supabase
          .from("pltdatarenatasene_tarefas")
          .update({ data_lembrete: new Date().toISOString() })
          .eq("id", tarefa.id);

        console.log(`[Task Reminder] Lembrete enviado para ${nomeResponsavel} (tarefa: ${tarefa.titulo})`);
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
```

### 5.4 - admin-manager (verify_jwt: true)

**Motivo:** Gerenciamento de administradores (criar, listar, editar, ativar/desativar, excluir). Requer autenticação JWT e que o chamador seja superadmin (`app_metadata.role === 'superadmin'`).

```typescript
// Supabase Edge Function - Admin Manager
// Gerencia administradores do sistema: criar, listar, editar, toggle, excluir
// Apenas superadmins podem chamar esta função

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
```

**Actions disponíveis:**

| Action | Descrição | Dados esperados |
|--------|-----------|-----------------|
| `list` | Lista todos os admins/superadmins | Nenhum |
| `create` | Cria novo admin | `{ email, password, nome?, telefone?, role?, permissions? }` |
| `update` | Atualiza admin existente | `{ userId, nome?, telefone?, role?, permissions? }` |
| `toggle` | Ativa/desativa admin | `{ userId, ativo: boolean }` |
| `delete` | Exclui admin | `{ userId }` |

**Permissões disponíveis** (array de IDs em `app_metadata.permissions`):

| ID | Página |
|----|--------|
| `dashboard` | Dashboard |
| `registrations` | Cadastros |
| `teams` | Equipes |
| `leaders` | Líderes |
| `coordinators` | Coordenadores |
| `organizations` | Organizações |
| `tasks` | Tarefas |
| `maps` | Mapa Eleitoral |

> **Proteções:** A função impede que o superadmin se auto-demova, auto-desative ou auto-exclua.

---

## Etapa 6: Configurar Cron Job (Task Reminder)

Após o deploy da Edge Function `task-reminder`, configure o cron job:

```sql
-- Cron job que chama task-reminder a cada 5 minutos
SELECT cron.schedule(
  'task-reminder-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://NOVO_PROJECT_REF.supabase.co/functions/v1/task-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

> **IMPORTANTE:** Substitua `NOVO_PROJECT_REF` pelo ref do novo projeto Supabase.

---

## Etapa 7: Atualizar Variáveis de Ambiente do Frontend

Edite o arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://NOVO_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=NOVA_ANON_KEY
VITE_ENVIRONMENT=production
```

---

## Etapa 8: Configurações Pós-Deploy (via Página de Settings)

Após o primeiro login como superadmin, acesse **Configurações** (sidebar) para configurar:

| Aba | O que configurar |
|-----|-----------------|
| **Branding** | Nome do app, candidato, cores, textos de login |
| **Links** | URL base de cadastro público de apoiadores |
| **LGPD** | Email de contato, nome do controlador de dados, copyright |
| **APIs** | Google Maps API Key (obrigatório para geocoding) |
| **WhatsApp** | Templates de mensagens (liderança, coordenador, tarefa, lembrete) |
| **Evolution** | URL do servidor, API Key, nome da instância WhatsApp |
| **Administradores** | Criar/editar admins, definir permissões por página, ativar/desativar |
| **Manutenção** | Modo manutenção e configurações avançadas |

---

## Etapa 9: Verificação Final (Checklist)

- [ ] Todas as 11 tabelas criadas com sucesso
- [ ] RLS habilitado em todas as tabelas
- [ ] Todas as policies criadas corretamente
- [ ] Usuário superadmin criado e consegue fazer login
- [ ] Edge Function `geocoding-proxy` deployada e respondendo
- [ ] Edge Function `evolution-proxy` deployada e respondendo
- [ ] Edge Function `task-reminder` deployada e respondendo
- [ ] Edge Function `admin-manager` deployada e respondendo
- [ ] Cron job `task-reminder-check` ativo (verificar em `SELECT * FROM cron.job;`)
- [ ] `.env.local` atualizado com novas credenciais
- [ ] Página de Settings acessível e funcional
- [ ] Aba Administradores funcional (criar, editar, ativar/desativar, excluir admins)
- [ ] Permissões de admin funcionando (sidebar filtra páginas, rotas protegidas redirecionam)
- [ ] Cadastro público de apoiadores funcionando (testar URL pública)
- [ ] Geocoding (busca por CEP) funcionando com Google Maps API Key configurada

---

## Referência Rápida: Nomes das Tabelas

| # | Tabela | Descrição |
|---|--------|-----------|
| 1 | `pltdatarenatasene_organizacoes` | Organizações/partidos |
| 2 | `pltdatarenatasene_responsaveis` | Responsáveis por tarefas |
| 3 | `pltdatarenatasene_configuracoes` | Configurações key-value do sistema |
| 4 | `pltdatarenatasene_evolution_config` | Config da Evolution API (WhatsApp) |
| 5 | `pltdatarenatasene_coordenadores_master` | Coordenadores master (admin alt) |
| 6 | `pltdatarenatasene_coordenadores` | Coordenadores de campanha |
| 7 | `pltdatarenatasene_equipes` | Equipes de campanha |
| 8 | `pltdatarenatasene_liderancas` | Lideranças (vinculadas a equipes) |
| 9 | `pltdatarenatasene_cadastros` | Apoiadores cadastrados |
| 10 | `pltdatarenatasene_tarefas` | Tarefas com lembretes automáticos |
| 11 | `pltdatarenatasene_equipe_coordenadores` | Junção entre equipes e coordenadores |

---

## Sistema de Permissões por Página

O sistema possui controle de acesso baseado em **permissões por página** armazenadas no `app_metadata` do Supabase Auth.

### Como funciona

- **Superadmin** (`app_metadata.role = 'superadmin'`): Acesso total a todas as páginas, incluindo Settings e SuperAdmin
- **Admin** (`app_metadata.role = 'admin'`): Acesso apenas às páginas listadas em `app_metadata.permissions[]`
- Páginas **Settings** e **SuperAdmin** são exclusivas do superadmin (nunca aparecem para admin)

### Camadas de proteção

1. **Sidebar** ([components/ui/modern-side-bar.tsx](components/ui/modern-side-bar.tsx)): Filtra itens de navegação baseado em `app_metadata.permissions`
2. **PermissionGuard** ([App.tsx](App.tsx)): Componente wrapper em cada rota que verifica permissão e redireciona para `/dashboard` se não autorizado
3. **AuthGuard** ([components/AuthGuard.tsx](components/AuthGuard.tsx)): Prop `requiredPermission` para verificação adicional

### Arquivos envolvidos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `lib/adminService.ts` | Serviço CRUD de admins (chama Edge Function `admin-manager`) |
| `pages/Settings.tsx` | Aba "Administradores" para gerenciar admins e permissões |
| `components/ui/modern-side-bar.tsx` | Filtragem visual dos itens do menu |
| `App.tsx` | `PermissionGuard` envolvendo cada rota |
| `components/AuthGuard.tsx` | Verificação de permissão a nível de rota |

---

## Nota sobre Prefixo de Tabelas

Se quiser usar um prefixo diferente (ex: `pltdatanovocliente_`), basta fazer busca e substituição em:

1. **Todos os SQLs deste guia** - substituir `pltdatarenatasene_` pelo novo prefixo
2. **`lib/supabase.ts`** - arquivo principal com todas as queries (buscar/substituir)
3. **`lib/configService.ts`** - referências na config
4. **`lib/adminService.ts`** - URL da Edge Function (se mudar o nome)
5. **Todas as 4 Edge Functions** - cada uma referencia as tabelas pelo nome completo
6. **Cron job SQL** - referências indiretas (as Edge Functions que acessam as tabelas)

> Basta usar find-and-replace global: `pltdatarenatasene_` -> `novoprefixo_`
