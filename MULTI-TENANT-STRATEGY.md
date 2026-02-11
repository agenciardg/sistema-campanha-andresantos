# Estrategia Multi-Tenant - PoliticaData

> Guia completo e detalhado para transformar o PoliticaData (single-tenant, campanha unica) em uma plataforma multi-tenant que atende multiplas campanhas simultaneamente usando um unico projeto Supabase.

---

## Indice

1. [Visao Geral da Arquitetura](#1-visao-geral-da-arquitetura)
2. [Novo Projeto Supabase - Estrutura](#2-novo-projeto-supabase---estrutura)
3. [Tabelas Novas (Plataforma)](#3-tabelas-novas-plataforma)
4. [Migracao das 10 Tabelas Existentes](#4-migracao-das-10-tabelas-existentes)
5. [Sistema de Auth Multi-Tenant](#5-sistema-de-auth-multi-tenant)
6. [RLS Policies Multi-Tenant](#6-rls-policies-multi-tenant)
7. [Edge Functions Atualizadas](#7-edge-functions-atualizadas)
8. [Frontend - Mudancas Necessarias](#8-frontend---mudancas-necessarias)
9. [Painel de Gestao da Plataforma (Super Admin Global)](#9-painel-de-gestao-da-plataforma-super-admin-global)
10. [Onboarding Automatizado de Novo Tenant](#10-onboarding-automatizado-de-novo-tenant)
11. [Planos e Limites](#11-planos-e-limites)
12. [Checklist de Implementacao](#12-checklist-de-implementacao)

---

## 1. Visao Geral da Arquitetura

### Abordagem Escolhida: Coluna `tenant_id` (Row-Level Isolation)

Todas as tabelas de dados compartilham o mesmo schema e banco, isoladas por uma coluna `tenant_id` (UUID). O Supabase RLS garante que cada usuario so acessa dados do seu tenant.

```
┌──────────────────────────────────────────────────┐
│                   SUPABASE PROJECT               │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Tenant A   │  │  Tenant B   │  │ Tenant C │ │
│  │  (Renata)   │  │  (Joao)     │  │ (Maria)  │ │
│  │             │  │             │  │          │ │
│  │ cadastros   │  │ cadastros   │  │ cadastros│ │
│  │ equipes     │  │ equipes     │  │ equipes  │ │
│  │ liderancas  │  │ liderancas  │  │ ...      │ │
│  │ ...         │  │ ...         │  │          │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │         TABELAS DA PLATAFORMA               │ │
│  │  tenants, planos, platform_admins           │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │            SUPABASE AUTH                    │ │
│  │  app_metadata.tenant_id = UUID do tenant    │ │
│  │  app_metadata.role = superadmin|admin       │ │
│  │  app_metadata.platform_role = owner (opt)   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Porque esta abordagem?

| Criterio | Schema por Tenant | Coluna tenant_id | Projeto Separado |
|----------|:---:|:---:|:---:|
| Complexidade de setup | Alta | **Baixa** | Baixa |
| Isolamento de dados | Alto | Medio (RLS) | Total |
| Custo | Medio | **Baixo** | Alto |
| Escala para 100+ tenants | Dificil | **Facil** | Caro |
| Queries cross-tenant | Dificil | **Facil** | Impossivel |
| Backup individual | Facil | Medio | Facil |
| Painel unificado | Dificil | **Facil** | Impossivel |

---

## 2. Novo Projeto Supabase - Estrutura

### Pre-requisitos

| Item | Descricao |
|------|-----------|
| Novo projeto Supabase | Criar projeto dedicado multi-tenant |
| Extensoes | `uuid-ossp`, `pgcrypto`, `pg_net`, `pg_cron` |
| Plano Supabase | Pro recomendado (mais connections, edge functions) |

### Extensoes

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
```

---

## 3. Tabelas Novas (Plataforma)

Estas tabelas NAO existem no projeto atual. Sao novas e gerenciam a plataforma multi-tenant.

### 3.1 - Tabela: planos

```sql
CREATE TABLE planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  descricao TEXT,
  max_cadastros INTEGER DEFAULT 500,
  max_equipes INTEGER DEFAULT 10,
  max_liderancas INTEGER DEFAULT 50,
  max_coordenadores INTEGER DEFAULT 10,
  max_admins INTEGER DEFAULT 3,
  tem_whatsapp BOOLEAN DEFAULT false,
  tem_mapa BOOLEAN DEFAULT true,
  tem_tarefas BOOLEAN DEFAULT true,
  preco_mensal NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Planos iniciais
INSERT INTO planos (nome, slug, max_cadastros, max_equipes, max_liderancas, max_coordenadores, max_admins, tem_whatsapp, preco_mensal) VALUES
  ('Gratuito', 'free', 100, 3, 10, 3, 1, false, 0),
  ('Basico', 'basic', 500, 10, 50, 10, 3, false, 99.90),
  ('Profissional', 'pro', 2000, 50, 200, 50, 10, true, 199.90),
  ('Enterprise', 'enterprise', -1, -1, -1, -1, -1, true, 499.90);
-- Nota: -1 = ilimitado
```

### 3.2 - Tabela: tenants

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR NOT NULL UNIQUE,
  nome_campanha VARCHAR NOT NULL,
  nome_candidato VARCHAR NOT NULL,
  partido VARCHAR,
  cargo VARCHAR,
  cidade VARCHAR,
  estado VARCHAR(2),
  logo_url VARCHAR,
  cor_primaria VARCHAR DEFAULT '#1e5a8d',
  cor_secundaria VARCHAR DEFAULT '#0a0e13',
  dominio_customizado VARCHAR UNIQUE,
  plano_id UUID REFERENCES planos(id),
  owner_user_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT true,
  trial_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX idx_tenants_dominio ON tenants(dominio_customizado) WHERE dominio_customizado IS NOT NULL;
```

### 3.3 - Tabela: tenant_usage (controle de limites)

```sql
CREATE TABLE tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mes_referencia VARCHAR(7) NOT NULL,
  total_cadastros INTEGER DEFAULT 0,
  total_equipes INTEGER DEFAULT 0,
  total_liderancas INTEGER DEFAULT 0,
  total_coordenadores INTEGER DEFAULT 0,
  total_admins INTEGER DEFAULT 0,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, mes_referencia)
);

CREATE INDEX idx_tenant_usage_tenant ON tenant_usage(tenant_id);
```

---

## 4. Migracao das 10 Tabelas Existentes

### Principio: Remover prefixo + Adicionar `tenant_id`

O prefixo `pltdatarenatasene_` deixa de existir. Cada tabela recebe uma coluna `tenant_id` NOT NULL com foreign key para `tenants(id)`.

### 4.1 - Tabela: organizacoes

```sql
CREATE TABLE organizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

CREATE INDEX idx_organizacoes_tenant ON organizacoes(tenant_id);
```

### 4.2 - Tabela: responsaveis

```sql
CREATE TABLE responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR NOT NULL,
  cargo VARCHAR,
  telefone VARCHAR,
  email VARCHAR,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_responsaveis_tenant ON responsaveis(tenant_id);
```

### 4.3 - Tabela: configuracoes

```sql
CREATE TABLE configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chave VARCHAR NOT NULL,
  valor TEXT,
  descricao VARCHAR,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, chave)
);

CREATE INDEX idx_configuracoes_tenant ON configuracoes(tenant_id);
CREATE INDEX idx_configuracoes_tenant_chave ON configuracoes(tenant_id, chave);
```

### 4.4 - Tabela: evolution_config

```sql
CREATE TABLE evolution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  servidor_url VARCHAR NOT NULL,
  api_key VARCHAR NOT NULL,
  instance_name VARCHAR NOT NULL,
  instance_token VARCHAR,
  status VARCHAR DEFAULT 'disconnected',
  ultimo_check TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_evolution_config_tenant ON evolution_config(tenant_id);
```

### 4.5 - Tabela: coordenadores_master

```sql
CREATE TABLE coordenadores_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  senha VARCHAR NOT NULL,
  telefone VARCHAR,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_coordenadores_master_tenant ON coordenadores_master(tenant_id);
```

### 4.6 - Tabela: coordenadores

```sql
CREATE TABLE coordenadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR NOT NULL,
  telefone VARCHAR,
  email VARCHAR,
  regiao VARCHAR,
  organizacao_id UUID REFERENCES organizacoes(id),
  codigo_unico VARCHAR,
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
  data_nascimento DATE,
  UNIQUE(tenant_id, codigo_unico)
);

CREATE INDEX idx_coordenadores_tenant ON coordenadores(tenant_id);
```

### 4.7 - Tabela: equipes

```sql
CREATE TABLE equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR NOT NULL,
  cor VARCHAR DEFAULT '#1e5a8d',
  organizacao_id UUID REFERENCES organizacoes(id),
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

CREATE INDEX idx_equipes_tenant ON equipes(tenant_id);
```

### 4.8 - Tabela: liderancas

```sql
CREATE TABLE liderancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES equipes(id),
  organizacao_id UUID REFERENCES organizacoes(id),
  nome VARCHAR NOT NULL,
  telefone VARCHAR,
  email VARCHAR,
  codigo_unico VARCHAR,
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
  data_nascimento DATE,
  UNIQUE(tenant_id, codigo_unico)
);

CREATE INDEX idx_liderancas_tenant ON liderancas(tenant_id);
CREATE INDEX idx_liderancas_equipe ON liderancas(equipe_id);
```

### 4.9 - Tabela: cadastros

```sql
CREATE TABLE cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lideranca_id UUID REFERENCES liderancas(id),
  coordenador_id UUID REFERENCES coordenadores(id),
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

CREATE INDEX idx_cadastros_tenant ON cadastros(tenant_id);
CREATE INDEX idx_cadastros_lideranca ON cadastros(lideranca_id);
CREATE INDEX idx_cadastros_coordenador ON cadastros(coordenador_id);
```

### 4.10 - Tabela: tarefas

```sql
CREATE TABLE tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
  responsavel_id UUID REFERENCES responsaveis(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tarefas_tenant ON tarefas(tenant_id);
CREATE INDEX idx_tarefas_status ON tarefas(tenant_id, status);
```

---

## 5. Sistema de Auth Multi-Tenant

### Estrutura do `app_metadata` no Supabase Auth

Cada usuario tera no seu `app_metadata`:

```json
{
  "role": "superadmin",
  "tenant_id": "uuid-do-tenant",
  "permissions": ["dashboard", "registrations", "teams", "leaders", "coordinators", "organizations", "tasks", "maps"],
  "platform_role": "owner"
}
```

| Campo | Descricao |
|-------|-----------|
| `role` | `superadmin` ou `admin` (dentro do tenant) |
| `tenant_id` | UUID do tenant ao qual o usuario pertence |
| `permissions` | Array de paginas que o admin pode acessar (vazio = superadmin tem tudo) |
| `platform_role` | `owner` (dono da plataforma, opcional, para o super admin global) |

### Funcao SQL helper para extrair tenant_id do JWT

```sql
-- Funcao para obter tenant_id do JWT atual
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  );
$$ LANGUAGE SQL STABLE;
```

---

## 6. RLS Policies Multi-Tenant

### 6.1 - Padrao para tabelas de dados (10 tabelas)

Cada tabela de dados segue o mesmo padrao. O `tenant_id` no JWT deve bater com o `tenant_id` da row.

Para CADA uma das 10 tabelas (organizacoes, responsaveis, configuracoes, evolution_config, coordenadores_master, coordenadores, equipes, liderancas, cadastros, tarefas):

```sql
ALTER TABLE NOME_TABELA ENABLE ROW LEVEL SECURITY;

-- Leitura: autenticado + mesmo tenant
CREATE POLICY "tenant_read_NOME_TABELA"
  ON NOME_TABELA FOR SELECT
  TO authenticated
  USING (tenant_id = auth.tenant_id());

-- Insert: superadmin do mesmo tenant
CREATE POLICY "tenant_insert_NOME_TABELA"
  ON NOME_TABELA FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth.tenant_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'admin')
  );

-- Update: superadmin do mesmo tenant
CREATE POLICY "tenant_update_NOME_TABELA"
  ON NOME_TABELA FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK (tenant_id = auth.tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- Delete: superadmin do mesmo tenant
CREATE POLICY "tenant_delete_NOME_TABELA"
  ON NOME_TABELA FOR DELETE
  TO authenticated
  USING (tenant_id = auth.tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
```

### 6.2 - Excecao: cadastros (INSERT anonimo)

A tabela `cadastros` precisa permitir INSERT anonimo (pagina publica de cadastro). O `tenant_id` vem do `codigo_unico` da lideranca/coordenador:

```sql
-- Insert anonimo: qualquer um, mas o tenant_id deve existir
CREATE POLICY "anon_insert_cadastros"
  ON cadastros FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE ativo = true)
  );
```

### 6.3 - Tabelas da plataforma (tenants, planos, tenant_usage)

```sql
-- tenants: leitura do proprio tenant
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (id = auth.tenant_id() OR (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'owner');

-- planos: leitura publica
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_planos"
  ON planos FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

-- tenant_usage: leitura do proprio tenant
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_usage"
  ON tenant_usage FOR SELECT
  TO authenticated
  USING (tenant_id = auth.tenant_id() OR (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'owner');
```

---

## 7. Edge Functions Atualizadas

### Principio: Todas as Edge Functions recebem `tenant_id` via JWT

O `tenant_id` vem do `app_metadata` do JWT do usuario autenticado, ou via parametro para funcoes publicas.

### 7.1 - geocoding-proxy

**Mudanca:** Ler a Google Maps API Key da tabela `configuracoes` filtrada por `tenant_id`.

```
-- Antes:
.from("pltdatarenatasene_configuracoes").select("valor").eq("chave", "api.google_maps_key").single()

-- Depois:
.from("configuracoes").select("valor").eq("chave", "api.google_maps_key").eq("tenant_id", tenantId).single()
```

**Como obter tenant_id em funcao publica (verify_jwt: false)?**
- O frontend envia `tenant_id` no body da requisicao
- A Edge Function valida que o tenant existe e esta ativo

### 7.2 - evolution-proxy

**Mudanca:** Ler config da tabela `evolution_config` filtrada por `tenant_id`.

```
-- Antes:
.from("pltdatarenatasene_evolution_config").select("*").order("criado_em"...).single()

-- Depois:
.from("evolution_config").select("*").eq("tenant_id", tenantId).single()
```

O `tenant_id` vem do JWT (funcao com verify_jwt: true).

### 7.3 - task-reminder

**Mudanca principal:** Iterar por TODOS os tenants ativos que tem WhatsApp configurado.

```typescript
// Buscar todos os tenants com Evolution ativa
const { data: configs } = await supabase
  .from("evolution_config")
  .select("*, tenants!inner(id, ativo)")
  .eq("status", "connected")
  .eq("tenants.ativo", true);

// Para cada tenant, buscar tarefas pendentes
for (const config of configs) {
  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("*")
    .eq("tenant_id", config.tenant_id)
    .eq("ativo", true)
    .in("status", ["pendente", "em_progresso"])
    // ... mesmos filtros de antes
}
```

### 7.4 - admin-manager

**Mudanca:** Incluir `tenant_id` no `app_metadata` ao criar usuarios.

```typescript
// Antes:
app_metadata: { role: userRole, permissions: userPermissions }

// Depois:
app_metadata: { role: userRole, permissions: userPermissions, tenant_id: callerTenantId }
```

- Validar que o caller so gerencia admins do seu proprio tenant
- Na action `list`, filtrar por `app_metadata.tenant_id`

### 7.5 - Nova Edge Function: tenant-manager (para o dono da plataforma)

```typescript
// Actions:
// - create_tenant: cria tenant + admin inicial + configs padrao
// - list_tenants: lista todos os tenants (so platform_role=owner)
// - update_tenant: atualiza dados do tenant
// - toggle_tenant: ativa/desativa tenant
// - get_usage: retorna uso de cada tenant vs limites do plano
```

---

## 8. Frontend - Mudancas Necessarias

### 8.1 - Roteamento por Tenant

**Opcao A: Subdominio** (recomendado para producao)
```
renatasene.politicadata.com.br
joaosilva.politicadata.com.br
```

**Opcao B: Slug na URL** (mais simples para desenvolvimento)
```
politicadata.com.br/app/renatasene
politicadata.com.br/app/joaosilva
```

**Opcao C: Dominio customizado** (premium)
```
apoiadores.renatasene.com.br -> tenant_id resolve via tabela tenants.dominio_customizado
```

### 8.2 - Resolver Tenant no Login

```typescript
// Novo: TenantContext.tsx
interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
}

// O tenant e resolvido de 3 formas:
// 1. Pelo subdominio/slug da URL (antes do login)
// 2. Pelo app_metadata.tenant_id do JWT (apos login)
// 3. Pela tabela tenants via codigo_unico (cadastro publico)
```

### 8.3 - Supabase Client com Filtro Automatico

```typescript
// lib/supabase.ts - TODAS as queries recebem .eq('tenant_id', tenantId)
// Porem, como o RLS ja filtra, o frontend NAO precisa enviar tenant_id nas queries SELECT
// O RLS garante que so retorna dados do tenant do JWT

// Para INSERT, o tenant_id DEVE ser enviado:
await supabase.from('cadastros').insert({
  ...dados,
  tenant_id: currentTenantId, // obrigatorio
});
```

### 8.4 - Arquivo `lib/supabase.ts`

Este e o arquivo mais afetado. Mudancas necessarias:

1. **Remover prefixo** de todas as tabelas (`pltdatarenatasene_` -> nome direto)
2. **Adicionar `tenant_id`** em todos os `.insert()` e `.upsert()`
3. **NAO precisa** adicionar `.eq('tenant_id', ...)` nos `.select()` (RLS faz isso)
4. Busca-e-substitui: `pltdatarenatasene_cadastros` -> `cadastros` (para todas as 10 tabelas)

### 8.5 - Branding Dinamico

O sistema de ConfigContext ja suporta branding dinamico. A diferenca e que agora cada tenant tem suas proprias configs na tabela `configuracoes` filtrada por `tenant_id`.

```typescript
// Antes (single tenant):
const { data } = await supabase.from('pltdatarenatasene_configuracoes').select('*');

// Depois (multi-tenant):
// RLS filtra automaticamente pelo tenant_id do JWT
const { data } = await supabase.from('configuracoes').select('*');
```

### 8.6 - Pagina de Login

```typescript
// Login precisa saber qual tenant estamos acessando
// Opcoes:
// A) Resolver pelo subdominio antes de mostrar o form
// B) Campo extra "codigo da campanha" no login
// C) URL unica por campanha (recomendado)

// A tela de login carrega o branding do tenant ANTES do login:
// 1. Resolve slug do subdominio/URL
// 2. Busca tenant na tabela tenants (query publica via RLS)
// 3. Busca configs de branding desse tenant
// 4. Aplica cores, logo, nome
```

### 8.7 - Cadastro Publico (`/c/:codigo`)

```typescript
// O codigo_unico da lideranca/coordenador identifica o tenant
// Fluxo:
// 1. Buscar lideranca pelo codigo_unico (precisa expor via RLS para anon)
// 2. Obter tenant_id da lideranca
// 3. Inserir cadastro com o tenant_id correto

// RLS para SELECT anonimo na tabela liderancas (apenas codigo_unico e tenant_id):
CREATE POLICY "anon_resolve_codigo"
  ON liderancas FOR SELECT
  TO anon
  USING (true); -- limitado pelas colunas retornadas no frontend
```

### 8.8 - Sidebar e Permissoes

Nenhuma mudanca necessaria. O sistema de `app_metadata.permissions` ja funciona porque e por usuario, e o `tenant_id` no JWT garante que o usuario so veja dados do seu tenant.

---

## 9. Painel de Gestao da Plataforma (Super Admin Global)

Um painel separado (ou rota especial) para o dono da plataforma:

### URL: `/platform` ou `admin.politicadata.com.br`

### Funcionalidades:

| Funcionalidade | Descricao |
|----------------|-----------|
| **Lista de Tenants** | Ver todos os tenants, status, plano, uso |
| **Criar Tenant** | Wizard: dados da campanha + admin inicial |
| **Editar Tenant** | Alterar plano, limites, status |
| **Desativar Tenant** | Bloquear acesso (nao deleta dados) |
| **Dashboard Global** | Total de cadastros, tenants ativos, receita |
| **Monitoramento** | Uso de API, erros, limites atingidos |

### Acesso:

```typescript
// Verificar se usuario e dono da plataforma:
const isPlatformOwner = user?.app_metadata?.platform_role === 'owner';
```

---

## 10. Onboarding Automatizado de Novo Tenant

### Fluxo quando o dono da plataforma cria um novo tenant:

```
1. Criar registro na tabela `tenants`
2. Criar usuario admin via Supabase Auth com app_metadata:
   { role: "superadmin", tenant_id: "novo-uuid", permissions: [] }
3. Inserir configs padrao na tabela `configuracoes` para o novo tenant:
   - branding.app_nome = nome_campanha
   - branding.candidato_nome = nome_candidato
   - links.url_base_cadastro = "https://{slug}.politicadata.com.br/#"
   - lgpd.* = valores padrao
4. Criar registro em `tenant_usage` para o mes atual
5. Enviar email de boas-vindas com credenciais
```

### Edge Function: `tenant-onboarding`

```typescript
// Input: { nome_campanha, nome_candidato, partido, email_admin, senha_admin, plano_slug }
// Output: { tenant_id, admin_user_id, login_url }

// Passo 1: Criar tenant
// Passo 2: Criar admin user com app_metadata.tenant_id
// Passo 3: Seed configs padrao
// Passo 4: Retornar URL de acesso
```

---

## 11. Planos e Limites

### Verificacao de Limites (server-side)

Os limites devem ser verificados nas Edge Functions e/ou via database triggers:

```sql
-- Funcao para verificar limite de cadastros
CREATE OR REPLACE FUNCTION check_cadastro_limit()
RETURNS TRIGGER AS $$
DECLARE
  tenant_plan RECORD;
  current_count INTEGER;
BEGIN
  -- Buscar plano do tenant
  SELECT p.max_cadastros INTO tenant_plan
  FROM tenants t
  JOIN planos p ON t.plano_id = p.id
  WHERE t.id = NEW.tenant_id;

  -- -1 = ilimitado
  IF tenant_plan.max_cadastros = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar cadastros existentes
  SELECT COUNT(*) INTO current_count
  FROM cadastros
  WHERE tenant_id = NEW.tenant_id;

  IF current_count >= tenant_plan.max_cadastros THEN
    RAISE EXCEPTION 'Limite de cadastros atingido para este plano. Faca upgrade para continuar.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_cadastro_limit
  BEFORE INSERT ON cadastros
  FOR EACH ROW EXECUTE FUNCTION check_cadastro_limit();
```

Criar triggers similares para: `equipes`, `liderancas`, `coordenadores`.

---

## 12. Checklist de Implementacao

### Fase 1: Banco de Dados
- [ ] Criar novo projeto Supabase
- [ ] Habilitar extensoes (uuid-ossp, pgcrypto, pg_net, pg_cron)
- [ ] Criar tabela `planos` com planos iniciais
- [ ] Criar tabela `tenants`
- [ ] Criar tabela `tenant_usage`
- [ ] Criar as 10 tabelas de dados (sem prefixo, com tenant_id)
- [ ] Criar funcao `auth.tenant_id()`
- [ ] Habilitar RLS em todas as tabelas
- [ ] Criar policies multi-tenant para todas as tabelas
- [ ] Criar triggers de verificacao de limites

### Fase 2: Edge Functions
- [ ] Atualizar `geocoding-proxy` (tenant_id no body)
- [ ] Atualizar `evolution-proxy` (tenant_id do JWT)
- [ ] Atualizar `task-reminder` (iterar por todos os tenants)
- [ ] Atualizar `admin-manager` (tenant_id no app_metadata)
- [ ] Criar `tenant-manager` (CRUD de tenants, so platform_role=owner)
- [ ] Criar `tenant-onboarding` (setup automatizado)

### Fase 3: Frontend
- [ ] Criar `TenantContext.tsx` (resolver e prover tenant_id)
- [ ] Refatorar `lib/supabase.ts` (remover prefixo, adicionar tenant_id nos inserts)
- [ ] Refatorar `lib/configService.ts` (remover prefixo)
- [ ] Atualizar `lib/evolutionApi.ts` (remover prefixo)
- [ ] Atualizar `services/linkService.ts` (URL por tenant)
- [ ] Adaptar pagina de Login (resolver tenant pelo subdominio/slug)
- [ ] Adaptar `PublicRegistration.tsx` (resolver tenant pelo codigo)
- [ ] Criar pagina/rota `/platform` para gestao de tenants
- [ ] Configurar roteamento por subdominio ou slug

### Fase 4: Deploy e DNS
- [ ] Configurar DNS wildcard (*.politicadata.com.br)
- [ ] Configurar Vercel/Netlify para subdominios dinamicos
- [ ] Testar isolamento entre tenants
- [ ] Migrar dados do tenant atual (Renata Sene)
- [ ] Verificar que nenhum dado vaza entre tenants

### Fase 5: Producao
- [ ] Criar primeiro tenant via onboarding
- [ ] Testar fluxo completo (login -> dashboard -> cadastro publico)
- [ ] Monitorar RLS policies em producao
- [ ] Configurar alertas para limites de plano

---

## Notas Importantes

1. **NUNCA confie apenas no frontend** para filtrar por tenant_id. O RLS no banco e a camada de seguranca real.
2. **Teste isolamento** criando 2 tenants e verificando que usuario A nao ve dados do tenant B.
3. **O prefixo `pltdatarenatasene_` desaparece** completamente. Todas as tabelas tem nomes limpos.
4. **Migrar dados existentes**: Crie um script SQL que insere os dados atuais com o tenant_id do primeiro tenant.
5. **Performance**: Adicione indice `(tenant_id)` em todas as tabelas. O RLS usa esse indice automaticamente.
6. **Backup individual**: Para exportar dados de um tenant, use `pg_dump` com filtro WHERE ou export via API.
