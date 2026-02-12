# Guia de Replicacao - PoliticaData para Novo Cliente

## Visao Geral

Este documento descreve como replicar o sistema PoliticaData para um novo cliente. O sistema e uma plataforma de gestao de campanha politica com:

- Painel administrativo (React + Vite + Tailwind)
- Backend Supabase (Postgres + Auth + Edge Functions)
- Integracao WhatsApp (Evolution API)
- Geocodificacao (Google Maps + BrasilAPI)
- Mapa interativo (Leaflet)
- QR Codes para cadastro publico de apoiadores

---

## 1. Pre-requisitos

| Ferramenta     | Versao     | Uso                             |
|----------------|------------|---------------------------------|
| Node.js        | >= 18      | Runtime do frontend             |
| npm             | >= 9       | Gerenciador de pacotes          |
| Git            | qualquer   | Controle de versao              |
| Supabase CLI   | >= 1.x     | Deploy de Edge Functions        |
| Conta Supabase | Free/Pro   | Backend (DB + Auth + Functions) |

---

## 2. Criar Projeto no Supabase

1. Acesse https://app.supabase.com e crie um novo projeto
2. Anote:
   - **Project URL**: `https://SEU_PROJECT_REF.supabase.co`
   - **Anon Key**: chave publica (Settings > API)
   - **Service Role Key**: chave privada (para Edge Functions)
   - **Project Ref**: identificador do projeto (ex: `bnyjhvcmasloqunstjoz`)

---

## 3. Prefixo de Tabelas

**IMPORTANTE**: Todas as tabelas usam prefixo por cliente para isolamento.

No projeto atual o prefixo e `pltdataandrebueno_`. Para um novo cliente, defina um novo prefixo, exemplo:

```
pltdataNOMECLIENTE_
```

Voce precisara substituir `pltdataandrebueno_` pelo novo prefixo em:

| Arquivo                           | Descricao                          |
|-----------------------------------|------------------------------------|
| `lib/supabase.ts`                 | Todas as queries (servicos CRUD)   |
| `lib/configService.ts`            | Referencia a tabela configuracoes  |
| `lib/evolutionApi.ts`             | Referencia a evolution_config      |
| `pages/*.tsx`                     | Queries diretas ao Supabase        |
| `supabase/functions/*/index.ts`   | Edge Functions (geocoding, admin)  |

**Dica**: use buscar/substituir global `pltdataandrebueno_` -> `pltdataNOMECLIENTE_`

---

## 4. Criar Tabelas no Supabase

Execute o SQL abaixo no **SQL Editor** do Supabase. Substitua `PREFIXO_` pelo prefixo escolhido.

### 4.1 Tabela: Organizacoes

```sql
CREATE TABLE PREFIXO_organizacoes (
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

### 4.2 Tabela: Equipes

```sql
CREATE TABLE PREFIXO_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  cor VARCHAR DEFAULT '#1e5a8d',
  organizacao_id UUID REFERENCES PREFIXO_organizacoes(id),
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

### 4.3 Tabela: Coordenadores

```sql
CREATE TABLE PREFIXO_coordenadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  telefone VARCHAR,
  email VARCHAR,
  regiao VARCHAR,
  organizacao_id UUID REFERENCES PREFIXO_organizacoes(id),
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

### 4.4 Tabela: Equipe-Coordenadores (junction N:N)

```sql
CREATE TABLE PREFIXO_equipe_coordenadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES PREFIXO_equipes(id) ON DELETE CASCADE,
  coordenador_id UUID NOT NULL REFERENCES PREFIXO_coordenadores(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT now()
);
```

### 4.5 Tabela: Liderancas

```sql
CREATE TABLE PREFIXO_liderancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID REFERENCES PREFIXO_equipes(id),  -- NULLABLE (desvinculacao ao excluir equipe)
  organizacao_id UUID REFERENCES PREFIXO_organizacoes(id),
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

### 4.6 Tabela: Cadastros (apoiadores)

```sql
CREATE TABLE PREFIXO_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lideranca_id UUID REFERENCES PREFIXO_liderancas(id),
  coordenador_id UUID REFERENCES PREFIXO_coordenadores(id),
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

### 4.7 Tabela: Configuracoes (key-value)

```sql
CREATE TABLE PREFIXO_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR NOT NULL UNIQUE,
  valor TEXT,
  descricao VARCHAR,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

### 4.8 Tabela: Evolution Config (WhatsApp)

```sql
CREATE TABLE PREFIXO_evolution_config (
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

### 4.9 Tabela: Coordenadores Master (legado, opcional)

```sql
CREATE TABLE PREFIXO_coordenadores_master (
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

### 4.10 Tabela: Responsaveis

```sql
CREATE TABLE PREFIXO_responsaveis (
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

### 4.11 Tabela: Tarefas

```sql
CREATE TABLE PREFIXO_tarefas (
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
  responsavel_id UUID REFERENCES PREFIXO_responsaveis(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Funcao RPC: Verificacao de Duplicidade

```sql
CREATE OR REPLACE FUNCTION check_cadastro_duplicidade(p_telefone TEXT, p_email TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado json;
BEGIN
  -- Verificar telefone
  IF p_telefone IS NOT NULL AND p_telefone != '' THEN
    IF EXISTS (SELECT 1 FROM PREFIXO_cadastros WHERE telefone = p_telefone LIMIT 1) THEN
      RETURN json_build_object('duplicado', true, 'campo', 'telefone');
    END IF;
  END IF;

  -- Verificar email
  IF p_email IS NOT NULL AND p_email != '' THEN
    IF EXISTS (SELECT 1 FROM PREFIXO_cadastros WHERE email = p_email LIMIT 1) THEN
      RETURN json_build_object('duplicado', true, 'campo', 'email');
    END IF;
  END IF;

  RETURN json_build_object('duplicado', false, 'campo', null);
END;
$$;

-- Permissao para anon (cadastro publico precisa verificar duplicidade)
GRANT EXECUTE ON FUNCTION check_cadastro_duplicidade TO anon;
GRANT EXECUTE ON FUNCTION check_cadastro_duplicidade TO authenticated;
```

---

## 6. RLS Policies (Row Level Security)

Ative RLS em **todas** as tabelas e aplique as policies:

```sql
-- ========== HABILITAR RLS ==========
ALTER TABLE PREFIXO_organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_coordenadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_equipe_coordenadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_liderancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_evolution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_coordenadores_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE PREFIXO_tarefas ENABLE ROW LEVEL SECURITY;

-- ========== POLICIES: authenticated (admin logado) - FULL ACCESS ==========
CREATE POLICY allow_all_authenticated ON PREFIXO_organizacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_equipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_coordenadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_equipe_coordenadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_liderancas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_cadastros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_evolution_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_coordenadores_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_responsaveis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_authenticated ON PREFIXO_tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== POLICIES: configuracoes ==========
CREATE POLICY allow_read_anon_authenticated ON PREFIXO_configuracoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY allow_write_authenticated ON PREFIXO_configuracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== POLICIES: anon (pagina publica de cadastro) ==========
-- SELECT para que a pagina publica possa buscar lideranca/coordenador pelo codigo_unico
CREATE POLICY allow_select_anon ON PREFIXO_coordenadores FOR SELECT TO anon USING (true);
CREATE POLICY allow_select_anon ON PREFIXO_liderancas FOR SELECT TO anon USING (true);
CREATE POLICY allow_select_anon ON PREFIXO_equipes FOR SELECT TO anon USING (true);
CREATE POLICY allow_select_anon ON PREFIXO_organizacoes FOR SELECT TO anon USING (true);

-- INSERT para que anon possa criar cadastros (apoiadores via link publico)
CREATE POLICY allow_insert_anon ON PREFIXO_cadastros FOR INSERT TO anon, authenticated WITH CHECK (true);

-- SELECT para verificacao de duplicidade (anon precisa ler cadastros)
CREATE POLICY allow_select_anon ON PREFIXO_cadastros FOR SELECT TO anon USING (true);
```

---

## 7. Configurar Variaveis de Ambiente

### 7.1 Frontend (.env.local)

Crie o arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_ENVIRONMENT=development
```

### 7.2 Producao (.env.production)

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_ENVIRONMENT=production
```

---

## 8. Substituir Prefixo no Codigo

Execute a substituicao global em todos os arquivos do projeto:

```
Buscar:    pltdataandrebueno_
Substituir: PREFIXO_NOVO_CLIENTE_
```

Arquivos afetados (principais):
- `lib/supabase.ts` (~50 ocorrencias)
- `lib/evolutionApi.ts`
- `lib/configService.ts`
- `pages/Coordinators.tsx`
- `pages/Leaders.tsx`
- `pages/Teams.tsx`
- `pages/TeamDetails.tsx`
- `pages/CoordinatorDetails.tsx`
- `pages/Dashboard.tsx`
- `pages/Registrations.tsx`
- `pages/Organizations.tsx`
- `pages/Maps.tsx`
- `pages/Tasks.tsx`
- `pages/PublicRegistration.tsx`
- `pages/Settings.tsx`
- `pages/SuperAdmin.tsx`
- `supabase/functions/geocoding-proxy/index.ts`
- `supabase/functions/admin-manager/index.ts`

---

## 9. Configurar Valores Padrao do Cliente

Edite `lib/configService.ts` para ajustar os valores padrao:

```typescript
// Branding
{ chave: 'branding.app_nome', padrao: 'NOME_DO_APP' },
{ chave: 'branding.app_subtitulo', padrao: 'SUBTITULO' },
{ chave: 'branding.candidato_nome', padrao: 'Nome do Candidato' },
{ chave: 'branding.login_titulo', padrao: 'Titulo do Login' },
{ chave: 'branding.cor_primaria', padrao: '#1e5a8d' },

// Links
{ chave: 'links.url_base_cadastro', padrao: 'https://apoiadores.DOMINIO_CLIENTE.com.br' },

// LGPD
{ chave: 'lgpd.email_contato', padrao: 'contato@DOMINIO_CLIENTE.com.br' },
{ chave: 'lgpd.nome_controlador', padrao: 'Nome do Controlador' },
```

Esses valores sao apenas fallback - o admin pode alterar tudo via **Configuracoes** no painel.

---

## 10. Deploy das Edge Functions

### 10.1 Vincular projeto

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

### 10.2 Configurar Secrets (Google Maps API Key)

```bash
npx supabase secrets set GOOGLE_MAPS_API_KEY=sua_chave_google_maps --project-ref SEU_PROJECT_REF
```

Ou salve a chave via painel: **Configuracoes > APIs & Integracoes > Google Maps API Key**
(a Edge Function le do banco de dados com fallback para env var)

### 10.3 Deploy

```bash
# Geocoding Proxy (SEM autenticacao JWT - usado na pagina publica)
npx supabase functions deploy geocoding-proxy --no-verify-jwt --project-ref SEU_PROJECT_REF

# Admin Manager (COM autenticacao JWT - apenas superadmin)
npx supabase functions deploy admin-manager --project-ref SEU_PROJECT_REF

# Evolution Proxy (COM autenticacao JWT)
npx supabase functions deploy evolution-proxy --project-ref SEU_PROJECT_REF

# Task Reminder (COM autenticacao JWT)
npx supabase functions deploy task-reminder --project-ref SEU_PROJECT_REF
```

---

## 11. Criar Primeiro Usuario Admin

No **Supabase Dashboard** > **Authentication** > **Users**, crie um usuario com:

- Email: `admin@dominiocliente.com.br`
- Password: senha forte
- Auto Confirm: ON

Depois, via SQL Editor, defina o role como superadmin:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"superadmin"'
)
WHERE email = 'admin@dominiocliente.com.br';

-- Adicionar todas as permissoes
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{permissions}',
  '["dashboard","teams","coordinators","leaders","organizations","registrations","tasks","maps"]'
)
WHERE email = 'admin@dominiocliente.com.br';
```

Apos isso, novos admins podem ser criados pelo painel (SuperAdmin).

---

## 12. Build e Deploy do Frontend

### 12.1 Instalar dependencias

```bash
npm install
```

### 12.2 Build de producao

```bash
npm run build
```

Isso gera a pasta `dist/` com os arquivos estaticos.

### 12.3 Deploy

O frontend e 100% estatico (SPA com HashRouter). Pode ser hospedado em:

- **cPanel** (upload da pasta `dist/` para `public_html/`)
- **Vercel / Netlify** (apontar para o repositorio)
- **Cloudflare Pages**
- Qualquer servidor que sirva arquivos estaticos

**IMPORTANTE**: O sistema usa `HashRouter` (`/#/rota`), entao nao precisa de configuracao de rewrite no servidor.

Se usar cPanel, inclua o `.htaccess` ja presente no projeto na raiz do site.

---

## 13. Configurar Dominios

O sistema usa **2 dominios** (opcional, pode ser 1 so):

| Dominio                              | Uso                         |
|--------------------------------------|-----------------------------|
| `gestaoNOMECLIENTE.dominio.com.br`   | Painel admin (login)        |
| `apoiadoresNOMECLIENTE.dominio.com.br`| Links publicos de cadastro |

O dominio de apoiadores e definido em **Configuracoes > Links > URL Base de Cadastro**.

Se usar apenas 1 dominio, defina a URL base como o mesmo dominio do painel.

---

## 14. Integracoes Opcionais

### 14.1 WhatsApp (Evolution API)

1. Tenha uma instancia da Evolution API rodando (self-hosted ou cloud)
2. No painel, va em **Configuracoes** e preencha:
   - URL do servidor Evolution
   - API Key
   - Nome da instancia
3. Conecte escaneando o QR Code
4. Mensagens automaticas serao enviadas ao criar liderancas/coordenadores

### 14.2 Google Maps (Geocodificacao)

1. Crie uma API Key no Google Cloud Console com a API **Geocoding** habilitada
2. Salve a chave via **Configuracoes > APIs & Integracoes** no painel
3. A Edge Function `geocoding-proxy` usara essa chave automaticamente

Se nao tiver Google Maps, o sistema usa **BrasilAPI** (gratuito) como fallback.

---

## 15. Hierarquia de Entidades

```
Organizacao (opcional)
  |
  +-- Equipe
  |     |
  |     +-- Coordenador (N:N via equipe_coordenadores)
  |     |
  |     +-- Lideranca (1:N)
  |           |
  |           +-- Cadastro (apoiador) (1:N)
  |
  +-- Coordenador (pode ter cadastros diretos)
        |
        +-- Cadastro (apoiador) (1:N)
```

### Regras de exclusao:

| Entidade     | Ao excluir...                                                   |
|--------------|-----------------------------------------------------------------|
| Equipe       | Liderancas sao **desvinculadas** (equipe_id = null). Vinculos com coordenadores sao removidos via CASCADE. |
| Coordenador  | Cadastros sao **desvinculados** (coordenador_id = null). Vinculos com equipes removidos via CASCADE. |
| Lideranca    | Cadastros sao **desvinculados** (lideranca_id = null).          |
| Cadastro     | Excluido diretamente.                                           |

---

## 16. Estrutura de Arquivos do Projeto

```
/
|-- App.tsx                    # Router principal (HashRouter)
|-- index.tsx                  # Entry point
|-- types.ts                   # Tipos compartilhados
|-- vite.config.ts             # Config do Vite (porta 3000)
|-- tailwind.config.js         # Config do Tailwind
|-- package.json               # Dependencias
|
|-- /components/
|   |-- AuthGuard.tsx          # Protecao de rotas
|   |-- Header.tsx             # Cabecalho
|   |-- Icon.tsx               # Wrapper Material Icons
|   |-- QRCodeCard.tsx         # Card de QR Code
|   |-- ConfirmModal.tsx       # Modal de confirmacao
|   |-- /ui/
|       |-- modern-side-bar.tsx # Sidebar moderna
|
|-- /contexts/
|   |-- AuthContext.tsx         # Autenticacao Supabase
|   |-- ConfigContext.tsx       # Configuracoes do sistema
|   |-- ThemeContext.tsx        # Tema claro/escuro
|
|-- /lib/
|   |-- supabase.ts            # Cliente Supabase + servicos CRUD
|   |-- configService.ts       # Servico de configuracoes (key-value)
|   |-- evolutionApi.ts        # Integracao Evolution API (WhatsApp)
|   |-- notificationService.ts # Envio de notificacoes WhatsApp
|   |-- geocoding.ts           # Geocodificacao multi-fonte
|   |-- adminService.ts        # CRUD de admins via Edge Function
|   |-- logger.ts              # Logger centralizado
|   |-- security.ts            # Sanitizacao de inputs
|   |-- validation.ts          # Validacoes
|   |-- rateLimiter.ts         # Rate limiter para APIs
|
|-- /pages/
|   |-- Login.tsx              # Tela de login
|   |-- Dashboard.tsx          # Dashboard com metricas
|   |-- Teams.tsx              # CRUD de equipes
|   |-- TeamDetails.tsx        # Detalhes de equipe
|   |-- Coordinators.tsx       # CRUD de coordenadores
|   |-- CoordinatorDetails.tsx # Detalhes de coordenador
|   |-- Leaders.tsx            # CRUD de liderancas
|   |-- LeaderDetails.tsx      # Detalhes de lideranca
|   |-- Organizations.tsx      # CRUD de organizacoes
|   |-- Registrations.tsx      # Lista de cadastros
|   |-- Tasks.tsx              # Tarefas e agendamentos
|   |-- Maps.tsx               # Mapa interativo
|   |-- Settings.tsx           # Configuracoes do sistema
|   |-- SuperAdmin.tsx         # Gerenciamento de admins
|   |-- PublicRegistration.tsx # Pagina publica de cadastro
|
|-- /services/
|   |-- linkService.ts         # Geracao de links e QR codes
|
|-- /supabase/functions/
|   |-- geocoding-proxy/       # Proxy para Google Maps API
|   |-- admin-manager/         # CRUD de admins (Edge Function)
|   |-- evolution-proxy/       # Proxy para Evolution API
|   |-- task-reminder/         # Lembretes de tarefas
|
|-- /styles/
|   |-- globals.css            # Estilos globais + animacoes
```

---

## 17. Stack Tecnologica

| Camada      | Tecnologia                                       |
|-------------|--------------------------------------------------|
| Frontend    | React 19 + TypeScript 5.8 + Vite 6               |
| UI          | Tailwind CSS + Material Icons                    |
| Routing     | React Router DOM 7 (HashRouter)                  |
| Graficos    | Recharts 3                                       |
| Mapas       | Leaflet 1.9 + React-Leaflet 5 + MarkerCluster   |
| QR Code     | qrcode + qrcode.react                            |
| Excel       | SheetJS (xlsx)                                   |
| Backend     | Supabase (Postgres + Auth + Edge Functions)      |
| WhatsApp    | Evolution API (via Edge Function proxy)          |
| Geocoding   | Google Maps API (proxy) + BrasilAPI (fallback)   |
| Auth        | Supabase Auth (email/password, JWT, RBAC)        |

---

## 18. Permissoes (RBAC)

O sistema usa `app_metadata` do Supabase Auth para controle de acesso:

```json
{
  "role": "superadmin",
  "permissions": ["dashboard","teams","coordinators","leaders","organizations","registrations","tasks","maps"]
}
```

Roles:
- **superadmin**: acesso total + gerenciar admins
- **admin**: acesso conforme `permissions`

Permissoes disponiveis:
- `dashboard` - Dashboard
- `teams` - Equipes
- `coordinators` - Coordenadores
- `leaders` - Liderancas
- `organizations` - Organizacoes
- `registrations` - Cadastros
- `tasks` - Tarefas
- `maps` - Mapas

---

## 19. Checklist de Replicacao

- [ ] Criar projeto no Supabase
- [ ] Executar SQL para criar todas as tabelas (com PREFIXO novo)
- [ ] Executar SQL para funcao `check_cadastro_duplicidade`
- [ ] Executar SQL para habilitar RLS e criar policies
- [ ] Substituir prefixo `pltdataandrebueno_` no codigo
- [ ] Configurar `.env.local` com credenciais do Supabase
- [ ] Atualizar valores padrao em `lib/configService.ts`
- [ ] Atualizar `package.json` > scripts > `supabase:link` com novo project-ref
- [ ] Fazer deploy das Edge Functions
- [ ] Criar primeiro usuario admin (superadmin)
- [ ] Testar login no painel
- [ ] Configurar dominio(s)
- [ ] Build e deploy do frontend
- [ ] Configurar branding pelo painel (Configuracoes)
- [ ] Configurar URL base de cadastro (Configuracoes > Links)
- [ ] (Opcional) Configurar Evolution API para WhatsApp
- [ ] (Opcional) Configurar Google Maps API Key para geocodificacao
- [ ] Testar criacao de equipe, coordenador, lideranca, cadastro
- [ ] Testar link publico de cadastro
- [ ] Testar exclusao com verificacao de dependencias

---

## 20. Configuracoes Iniciais via SQL (opcional)

Para pre-popular configuracoes do novo cliente:

```sql
INSERT INTO PREFIXO_configuracoes (chave, valor) VALUES
  ('branding.app_nome', 'NOME_APP'),
  ('branding.app_subtitulo', 'SUBTITULO'),
  ('branding.candidato_nome', 'Nome do Candidato'),
  ('branding.login_titulo', 'Sistema de Campanha'),
  ('branding.login_subtitulo', 'Acesso seguro para coordenadores e equipe'),
  ('branding.cor_primaria', '#1e5a8d'),
  ('links.url_base_cadastro', 'https://apoiadores.dominiocliente.com.br'),
  ('lgpd.email_contato', 'contato@dominiocliente.com.br'),
  ('lgpd.nome_controlador', 'Nome do Controlador')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
```
