# 🗳️ Roadmap - Sistema de Controle de Campanha

## 📋 Visão Geral do Projeto

Sistema multi-tenant para gestão de campanhas políticas com hierarquia de usuários, cadastro de eleitores e dashboard centralizado.

---

## 🎯 Fase 1: Planejamento e Estruturação

### 1.1 Definição da Arquitetura
- [ ] Definir stack tecnológico (Supabase + Stitch)
- [ ] Desenhar arquitetura do sistema
- [ ] Definir fluxo de autenticação e autorização
- [ ] Mapear regras de negócio

### 1.2 Design System
- [ ] Definir paleta de cores (Azul e Branco)
- [ ] Criar componentes base (botões, inputs, cards, modais)
- [ ] Definir tipografia e espaçamentos
- [ ] Criar protótipo de alta fidelidade (opcional)

---

## 🗄️ Fase 2: Estrutura do Banco de Dados (Supabase)

### 2.1 Tabelas Principais

#### **Tabela: `usuarios`**
```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  tipo_usuario VARCHAR(50) NOT NULL, -- 'politico', 'coordenador_master', 'coordenador', 'lideranca'
  whatsapp VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'ativo', 'inativo'
  politico_id UUID REFERENCES usuarios(id), -- ID do político (tenant)
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `organizacoes`**
```sql
CREATE TABLE organizacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(100), -- 'igreja', 'convencao', 'associacao', etc
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `equipes`**
```sql
CREATE TABLE equipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  coordenador_id UUID REFERENCES usuarios(id),
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `coordenadores`**
```sql
CREATE TABLE coordenadores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  equipe_id UUID REFERENCES equipes(id),
  tipo VARCHAR(50) DEFAULT 'coordenador', -- 'coordenador_master', 'coordenador'
  link_cadastro VARCHAR(500) UNIQUE NOT NULL,
  qr_code_url TEXT,
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `liderancas`**
```sql
CREATE TABLE liderancas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  organizacao_id UUID REFERENCES organizacoes(id),
  coordenador_id UUID REFERENCES coordenadores(id),
  link_cadastro VARCHAR(500) UNIQUE NOT NULL,
  qr_code_url TEXT,
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `cadastros_eleitores`**
```sql
CREATE TABLE cadastros_eleitores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_completo VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  cep VARCHAR(10) NOT NULL,
  endereco VARCHAR(500) NOT NULL,
  numero VARCHAR(20),
  complemento VARCHAR(255),
  bairro VARCHAR(255) NOT NULL,
  cidade VARCHAR(255) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  status_voto VARCHAR(50) DEFAULT 'possivel', -- 'garantido', 'possivel', 'duvida'
  responsavel_tipo VARCHAR(50) NOT NULL, -- 'coordenador', 'lideranca'
  responsavel_id UUID NOT NULL, -- ID do coordenador ou liderança
  organizacao_id UUID REFERENCES organizacoes(id),
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  origem_cadastro VARCHAR(50) DEFAULT 'link', -- 'link', 'qrcode', 'manual'
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `tarefas`**
```sql
CREATE TABLE tarefas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) DEFAULT 'tarefa', -- 'tarefa', 'checklist'
  status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluida'
  atribuido_para UUID REFERENCES usuarios(id) NOT NULL,
  atribuido_por UUID REFERENCES usuarios(id) NOT NULL,
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  data_conclusao TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### **Tabela: `convites_usuarios`**
```sql
CREATE TABLE convites_usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(500) UNIQUE NOT NULL,
  tipo_usuario VARCHAR(50) NOT NULL,
  politico_id UUID REFERENCES usuarios(id) NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  expira_em TIMESTAMP NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Índices e Otimizações
```sql
-- Índices para performance
CREATE INDEX idx_usuarios_politico_id ON usuarios(politico_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_cadastros_eleitores_responsavel ON cadastros_eleitores(responsavel_id);
CREATE INDEX idx_cadastros_eleitores_politico ON cadastros_eleitores(politico_id);
CREATE INDEX idx_coordenadores_link ON coordenadores(link_cadastro);
CREATE INDEX idx_liderancas_link ON liderancas(link_cadastro);
```

### 2.3 Row Level Security (RLS)
- [ ] Configurar políticas RLS para multi-tenant
- [ ] Garantir que usuários só vejam dados do próprio político
- [ ] Criar políticas específicas por tipo de usuário

### 2.4 Functions e Triggers
```sql
-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.atualizado_em = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function para gerar link único de cadastro
CREATE OR REPLACE FUNCTION gerar_link_cadastro(nome TEXT, tipo TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
  random_string TEXT;
BEGIN
  -- Normalizar nome: lowercase, remover acentos, substituir espaços por hífen
  slug := lower(unaccent(nome));
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := trim(both '-' from slug);
  
  -- Gerar string aleatória
  random_string := substr(md5(random()::text), 1, 8);
  
  RETURN slug || '-' || random_string;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎨 Fase 3: Frontend (Stitch)

### 3.1 Páginas Públicas
- [ ] **Página de Login** (`/`)
  - Form de autenticação
  - Esqueci minha senha
  - Validação de campos

- [ ] **Página de Cadastro Público** (`/cadastro/:link`)
  - Formulário de cadastro de eleitor
  - Integração com BrasilAPI (CEP)
  - Captura automática do responsável via link
  - Feedback de sucesso

- [ ] **Página de Confirmação de Email** (`/confirmar-email/:token`)
  - Validação de token
  - Criação de senha
  - Primeiro acesso

### 3.2 Páginas Internas (Área Logada)

- [ ] **Dashboard** (`/dashboard`)
  - Cards com métricas principais
  - Gráficos de evolução
  - Atividades recentes
  - Visão geral do sistema

- [ ] **Equipes** (`/equipes`)
  - Listagem de equipes
  - Criar nova equipe
  - Editar equipe
  - Deletar equipe
  - Ver membros da equipe

- [ ] **Coordenadores** (`/coordenadores`)
  - Listagem de coordenadores
  - Criar novo coordenador
  - Gerar link e QR Code automaticamente
  - Copiar link de cadastro
  - Baixar QR Code
  - Visualizar cadastros por coordenador

- [ ] **Lideranças** (`/liderancas`)
  - Listagem de lideranças
  - Criar nova liderança
  - Gerar link e QR Code automaticamente
  - Associar a organização
  - Visualizar cadastros por liderança

- [ ] **Organizações/Setores** (`/organizacoes`)
  - Listagem de organizações
  - Criar nova organização
  - Editar organização
  - Ver cadastros por organização

- [ ] **Cadastros/CRM** (`/cadastros`)
  - Visão Kanban por responsável
  - Filtros avançados
  - Pesquisa global
  - Editar status do voto
  - Editar informações do eleitor
  - Exportar para Excel
  - Ver detalhes completos

- [ ] **Tarefas** (`/tarefas`)
  - Criar tarefas
  - Atribuir para coordenadores/lideranças
  - Acompanhar status
  - Checklists

- [ ] **Configurações** (`/configuracoes`)
  - Dados do político
  - Configurações da campanha
  - Gerenciar usuários
  - Logs do sistema

### 3.3 Componentes Reutilizáveis
- [ ] Sidebar de navegação
- [ ] Header com perfil do usuário
- [ ] Cards de métricas
- [ ] Tabelas com paginação
- [ ] Modais
- [ ] Forms com validação
- [ ] Botões de ação
- [ ] Alerts e Toasts
- [ ] Loading states
- [ ] Empty states

---

## ⚙️ Fase 4: Backend/Lógica (Supabase Functions)

### 4.1 Autenticação e Autorização
- [ ] Implementar login com Supabase Auth
- [ ] Sistema de convites por email
- [ ] Recuperação de senha
- [ ] Middleware de autorização por tipo de usuário
- [ ] Validação de tokens

### 4.2 API Endpoints

#### Usuários
- [ ] `POST /auth/login` - Login
- [ ] `POST /auth/register` - Registro (via convite)
- [ ] `POST /auth/forgot-password` - Recuperar senha
- [ ] `POST /auth/reset-password` - Redefinir senha
- [ ] `GET /usuarios/me` - Dados do usuário logado
- [ ] `PUT /usuarios/me` - Atualizar perfil

#### Equipes
- [ ] `GET /equipes` - Listar equipes
- [ ] `POST /equipes` - Criar equipe
- [ ] `PUT /equipes/:id` - Atualizar equipe
- [ ] `DELETE /equipes/:id` - Deletar equipe
- [ ] `GET /equipes/:id/membros` - Membros da equipe

#### Coordenadores
- [ ] `GET /coordenadores` - Listar coordenadores
- [ ] `POST /coordenadores` - Criar coordenador (gera link e QR Code)
- [ ] `PUT /coordenadores/:id` - Atualizar coordenador
- [ ] `DELETE /coordenadores/:id` - Deletar coordenador
- [ ] `GET /coordenadores/:id/cadastros` - Cadastros do coordenador

#### Lideranças
- [ ] `GET /liderancas` - Listar lideranças
- [ ] `POST /liderancas` - Criar liderança (gera link e QR Code)
- [ ] `PUT /liderancas/:id` - Atualizar liderança
- [ ] `DELETE /liderancas/:id` - Deletar liderança
- [ ] `GET /liderancas/:id/cadastros` - Cadastros da liderança

#### Organizações
- [ ] `GET /organizacoes` - Listar organizações
- [ ] `POST /organizacoes` - Criar organização
- [ ] `PUT /organizacoes/:id` - Atualizar organização
- [ ] `DELETE /organizacoes/:id` - Deletar organização

#### Cadastros
- [ ] `GET /cadastros` - Listar todos os cadastros (com filtros)
- [ ] `POST /cadastros` - Criar cadastro (via link público)
- [ ] `PUT /cadastros/:id` - Atualizar cadastro
- [ ] `DELETE /cadastros/:id` - Deletar cadastro
- [ ] `GET /cadastros/export` - Exportar para Excel
- [ ] `GET /cadastros/stats` - Estatísticas gerais

#### Dashboard
- [ ] `GET /dashboard/stats` - Métricas do dashboard
- [ ] `GET /dashboard/graficos` - Dados para gráficos
- [ ] `GET /dashboard/atividades` - Atividades recentes

#### Tarefas
- [ ] `GET /tarefas` - Listar tarefas
- [ ] `POST /tarefas` - Criar tarefa
- [ ] `PUT /tarefas/:id` - Atualizar tarefa
- [ ] `DELETE /tarefas/:id` - Deletar tarefa
- [ ] `PUT /tarefas/:id/concluir` - Marcar como concluída

### 4.3 Serviços Externos
- [ ] Integração com BrasilAPI (buscar CEP)
- [ ] Geração de QR Code (biblioteca)
- [ ] Envio de emails (Supabase Email ou SendGrid)
- [ ] Template de mensagem WhatsApp
- [ ] Exportação para Excel

### 4.4 Realtime
- [ ] Configurar realtime para novos cadastros
- [ ] Notificações em tempo real
- [ ] Atualização automática de métricas

---

## 🔒 Fase 5: Segurança e Validações

### 5.1 Segurança
- [ ] Implementar RLS completo em todas as tabelas
- [ ] Validação de dados no backend
- [ ] Sanitização de inputs
- [ ] Rate limiting em endpoints públicos
- [ ] Proteção contra SQL injection
- [ ] Proteção contra XSS
- [ ] CORS configurado corretamente
- [ ] HTTPS obrigatório

### 5.2 Validações
- [ ] Validação de email
- [ ] Validação de WhatsApp (formato brasileiro)
- [ ] Validação de CEP
- [ ] Validação de links únicos
- [ ] Validação de permissões por tipo de usuário
- [ ] Validação de campos obrigatórios

---

## 🧪 Fase 6: Testes

### 6.1 Testes Unitários
- [ ] Testes de functions do Supabase
- [ ] Testes de validações
- [ ] Testes de geração de links

### 6.2 Testes de Integração
- [ ] Fluxo completo de criação de coordenador
- [ ] Fluxo completo de criação de liderança
- [ ] Fluxo de cadastro de eleitor via link
- [ ] Fluxo de cadastro de eleitor via QR Code

### 6.3 Testes E2E
- [ ] Login e navegação
- [ ] Criação de equipe completa
- [ ] Cadastro público funcionando
- [ ] Dashboard carregando corretamente

### 6.4 Testes de Performance
- [ ] Teste de carga no cadastro público
- [ ] Performance de listagens grandes
- [ ] Otimização de queries

---

## 🚀 Fase 7: Deploy e Infraestrutura

### 7.1 Supabase
- [ ] Criar projeto de produção
- [ ] Configurar variáveis de ambiente
- [ ] Configurar backup automático
- [ ] Configurar monitoramento

### 7.2 Frontend
- [ ] Build de produção
- [ ] Deploy em Vercel/Netlify
- [ ] Configurar domínio customizado
- [ ] Configurar SSL

### 7.3 Monitoramento
- [ ] Configurar logs de erro
- [ ] Monitoramento de performance
- [ ] Alertas de falhas
- [ ] Analytics de uso

---

## 📱 Fase 8: Recursos Adicionais (Futuro)

### 8.1 Features Avançadas
- [ ] App mobile (React Native)
- [ ] Sistema de mensagens internas
- [ ] Relatórios avançados em PDF
- [ ] Importação em massa de cadastros
- [ ] Integração com WhatsApp Business API
- [ ] Sistema de gamificação (ranking de cadastros)
- [ ] Mapas de calor geográficos
- [ ] Previsões e análises com IA

### 8.2 Melhorias de UX
- [ ] Tutorial interativo no primeiro acesso
- [ ] Modo offline (PWA)
- [ ] Atalhos de teclado
- [ ] Temas customizáveis por campanha
- [ ] Widgets para incorporar em sites externos

---

## 📊 Estrutura de Diretórios do Projeto

```
controle-campanha/
│
├── frontend/                    # Stitch (Frontend)
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── assets/
│   │       ├── images/
│   │       └── icons/
│   │
│   ├── src/
│   │   ├── pages/              # Páginas do sistema
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Equipes.js
│   │   │   ├── Coordenadores.js
│   │   │   ├── Liderancas.js
│   │   │   ├── Organizacoes.js
│   │   │   ├── Cadastros.js
│   │   │   ├── CadastroPublico.js
│   │   │   └── Configuracoes.js
│   │   │
│   │   ├── components/         # Componentes reutilizáveis
│   │   │   ├── Sidebar.js
│   │   │   ├── Header.js
│   │   │   ├── Modal.js
│   │   │   ├── Table.js
│   │   │   ├── Card.js
│   │   │   ├── Button.js
│   │   │   ├── Input.js
│   │   │   └── ...
│   │   │
│   │   ├── layouts/            # Layouts
│   │   │   ├── AuthLayout.js
│   │   │   ├── DashboardLayout.js
│   │   │   └── PublicLayout.js
│   │   │
│   │   ├── services/           # Serviços e API
│   │   │   ├── api.js
│   │   │   ├── auth.js
│   │   │   ├── supabase.js
│   │   │   └── brasilapi.js
│   │   │
│   │   ├── hooks/              # Custom hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useCadastros.js
│   │   │   └── ...
│   │   │
│   │   ├── utils/              # Utilidades
│   │   │   ├── validators.js
│   │   │   ├── formatters.js
│   │   │   └── constants.js
│   │   │
│   │   ├── styles/             # Estilos globais
│   │   │   ├── global.css
│   │   │   ├── variables.css
│   │   │   └── themes.css
│   │   │
│   │   └── App.js
│   │
│   ├── package.json
│   └── README.md
│
├── backend/                     # Antigravity (Backend)
│   │
│   ├── supabase/
│   │   ├── migrations/         # Migrations SQL
│   │   │   ├── 001_create_usuarios.sql
│   │   │   ├── 002_create_organizacoes.sql
│   │   │   ├── 003_create_equipes.sql
│   │   │   └── ...
│   │   │
│   │   ├── functions/          # Edge Functions
│   │   │   ├── auth/
│   │   │   ├── coordenadores/
│   │   │   ├── liderancas/
│   │   │   ├── cadastros/
│   │   │   └── dashboard/
│   │   │
│   │   └── config.toml
│   │
│   ├── scripts/                # Scripts utilitários
│   │   ├── seed.sql           # Dados de teste
│   │   └── backup.sh
│   │
│   └── README.md
│
├── docs/                        # Documentação
│   ├── API.md                  # Documentação da API
│   ├── DATABASE.md             # Estrutura do banco
│   ├── DEPLOYMENT.md           # Guia de deploy
│   └── USER_GUIDE.md           # Manual do usuário
│
├── .gitignore
├── README.md
└── ROADMAP.md                  # Este arquivo
```

---

## 📅 Timeline Estimado

| Fase | Descrição | Duração Estimada |
|------|-----------|------------------|
| 1 | Planejamento e Estruturação | 2-3 dias |
| 2 | Estrutura do Banco de Dados | 3-4 dias |
| 3 | Frontend (Páginas e Componentes) | 10-14 dias |
| 4 | Backend/Lógica | 10-14 dias |
| 5 | Segurança e Validações | 3-5 dias |
| 6 | Testes | 5-7 dias |
| 7 | Deploy e Infraestrutura | 2-3 dias |
| 8 | Recursos Adicionais | Variável |

**Total Estimado: 35-50 dias de desenvolvimento**

---

## ✅ Checklist de Conclusão

### MVP (Produto Mínimo Viável)
- [ ] Login funcional
- [ ] Criação de coordenadores e lideranças
- [ ] Geração automática de links e QR Codes
- [ ] Página pública de cadastro funcionando
- [ ] Dashboard com métricas básicas
- [ ] Listagem de cadastros
- [ ] Sistema multi-tenant funcionando

### Versão 1.0
- [ ] Todas as funcionalidades do MVP
- [ ] Tarefas e checklists
- [ ] Exportação de dados
- [ ] Sistema de notificações
- [ ] Filtros e buscas avançadas
- [ ] RLS completo
- [ ] Testes básicos implementados

### Versão 2.0
- [ ] App mobile
- [ ] Relatórios avançados
- [ ] Integração WhatsApp Business
- [ ] Analytics avançado
- [ ] Sistema de gamificação

---

## 🆘 Suporte e Contatos

- **Documentação Supabase:** https://supabase.com/docs
- **Documentação Stitch:** [Link quando disponível]
- **API BrasilAPI:** https://brasilapi.com.br/docs

---

## 📝 Notas Importantes

1. **Multi-tenancy:** Todos os dados devem ser isolados por `politico_id`
2. **Links Únicos:** Usar função para gerar links amigáveis e únicos
3. **QR Codes:** Gerar no momento da criação do coordenador/liderança
4. **CEP:** Sempre validar e buscar endereço via BrasilAPI
5. **Emails:** Usar templates profissionais para convites
6. **Segurança:** RLS é obrigatório em todas as tabelas
7. **Performance:** Criar índices em campos frequentemente consultados
8. **Backup:** Configurar backup diário automático
9. **Logs:** Manter log de ações importantes dos usuários
10. **LGPD:** Implementar opções de exclusão de dados pessoais

---

**Última atualização:** 2025-01-22
**Versão do Roadmap:** 1.0