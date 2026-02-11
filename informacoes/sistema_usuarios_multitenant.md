# Sistema de Usuários Multi-Tenant com Hierarquia de Permissões

> ⚠️ **DOCUMENTO PARA IMPLEMENTAÇÃO FUTURA**
> 
> Este documento descreve como seria implementado um sistema de login com hierarquia de permissões.
> Não está implementado no momento, mas serve como referência para desenvolvimento posterior.

---

## Visão Geral

O sistema será **multi-tenant**, onde cada usuário tem acesso apenas aos dados que lhe pertencem, baseado na sua posição hierárquica.

---

## Hierarquia de Usuários

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPER ADMIN                                  │
│                      (Dono do Sistema)                               │
│                                                                      │
│  ✓ Acesso via rota especial: /#/superadmin                          │
│  ✓ Cria e gerencia COORDENADORES MASTER                             │
│  ✓ Ativa/desativa acesso de Coordenadores Master                    │
│  ✓ Senha fixa no código (alterar em produção)                       │
│  ✓ NÃO aparece no sistema normal                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      COORDENADOR MASTER                              │
│                         (Nível 1)                                    │
│                                                                      │
│  ✓ Acesso TOTAL ao sistema                                          │
│  ✓ Vê TODAS as equipes, coordenadores, lideranças e cadastros       │
│  ✓ Pode criar/editar/excluir qualquer registro                      │
│  ✓ Acesso às configurações do sistema                               │
│  ✓ Relatórios gerais e exportações                                  │
│  ✓ Gerencia Coordenadores Normais e Lideranças                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      COORDENADOR NORMAL                              │
│                         (Nível 2)                                    │
│                                                                      │
│  ✓ Vê APENAS suas equipes vinculadas                                │
│  ✓ Vê APENAS as lideranças das suas equipes                         │
│  ✓ Vê APENAS os cadastros das suas lideranças                       │
│  ✓ Pode criar lideranças nas suas equipes                           │
│  ✓ Dashboard filtrado pelos seus dados                              │
│  ✗ NÃO vê dados de outros coordenadores                             │
│  ✗ NÃO acessa configurações do sistema                              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LIDERANÇA                                    │
│                         (Nível 3)                                    │
│                                                                      │
│  ✓ Vê APENAS seus próprios cadastros                                │
│  ✓ Dashboard pessoal (meta, progresso, últimos cadastros)           │
│  ✓ Acesso ao seu Link e QR Code                                     │
│  ✓ Pode compartilhar link de cadastro                               │
│  ✗ NÃO vê cadastros de outras lideranças                            │
│  ✗ NÃO vê outras equipes                                            │
│  ✗ NÃO acessa configurações                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Dados

### Tabela: usuarios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| email | VARCHAR(255) | Email para login (único) |
| senha | VARCHAR(255) | Senha criptografada (bcrypt) |
| nome | VARCHAR(255) | Nome completo |
| tipo | ENUM | `master`, `coordenador`, `lideranca` |
| ativo | BOOLEAN | Se o usuário está ativo |
| ultimo_acesso | TIMESTAMP | Data/hora do último login |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Data da última atualização |

### Tabela: usuario_vinculos

Vincula o usuário à sua entidade correspondente (coordenador ou liderança).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| usuario_id | UUID | FK para usuarios |
| tipo_vinculo | ENUM | `coordenador`, `lideranca` |
| coordenador_id | INT | FK para coordenadores (se tipo = coordenador) |
| lideranca_id | INT | FK para liderancas (se tipo = lideranca) |
| criado_em | TIMESTAMP | Data de criação |

---

## Fluxo de Autenticação

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    LOGIN     │────►│  VALIDAÇÃO   │────►│   SESSÃO     │
│  email/senha │     │  JWT Token   │     │  + Contexto  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                     ┌───────────────────────────────────────┐
                     │         CONTEXTO DO USUÁRIO           │
                     │                                       │
                     │  - ID do usuário                      │
                     │  - Tipo (master/coordenador/lideranca)│
                     │  - IDs das equipes (se coordenador)   │
                     │  - ID da liderança (se liderança)     │
                     │  - Permissões calculadas              │
                     └───────────────────────────────────────┘
```

---

## Regras de Acesso por Recurso

### Dashboard

| Recurso | Master | Coordenador | Liderança |
|---------|--------|-------------|-----------|
| Total de cadastros | Todos | Suas equipes | Seus cadastros |
| Total de lideranças | Todas | Suas equipes | - |
| Total de equipes | Todas | Suas equipes | - |
| Gráfico de progresso | Geral | Suas equipes | Pessoal |
| Mapa eleitoral | Completo | Suas equipes | Seus cadastros |

### Equipes

| Ação | Master | Coordenador | Liderança |
|------|--------|-------------|-----------|
| Listar | Todas | Suas equipes | ❌ |
| Criar | ✅ | ❌ | ❌ |
| Editar | ✅ | Suas equipes | ❌ |
| Excluir | ✅ | ❌ | ❌ |

### Lideranças

| Ação | Master | Coordenador | Liderança |
|------|--------|-------------|-----------|
| Listar | Todas | Suas equipes | ❌ |
| Criar | ✅ | Suas equipes | ❌ |
| Editar | ✅ | Suas equipes | ❌ |
| Excluir | ✅ | ❌ | ❌ |
| Ver Link/QR | ✅ | Suas equipes | Próprio |

### Cadastros

| Ação | Master | Coordenador | Liderança |
|------|--------|-------------|-----------|
| Listar | Todos | Suas equipes | Próprios |
| Criar | ✅ | ✅ | ✅ |
| Editar | ✅ | Suas equipes | Próprios |
| Excluir | ✅ | ❌ | ❌ |
| Exportar | ✅ | Suas equipes | Próprios |

### Configurações

| Recurso | Master | Coordenador | Liderança |
|---------|--------|-------------|-----------|
| WhatsApp | ✅ | ❌ | ❌ |
| Usuários | ✅ | ❌ | ❌ |
| Sistema | ✅ | ❌ | ❌ |

---

## Implementação Técnica

### 1. Middleware de Autenticação

```typescript
// Exemplo conceitual
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization;
  const usuario = await verificarToken(token);
  
  if (!usuario) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  // Carregar contexto do usuário
  req.usuario = {
    id: usuario.id,
    tipo: usuario.tipo,
    equipesIds: await getEquipesDoUsuario(usuario),
    liderancaId: await getLiderancaDoUsuario(usuario),
  };
  
  next();
};
```

### 2. Filtro de Dados por Contexto

```typescript
// Exemplo conceitual
const getCadastros = async (usuario) => {
  switch (usuario.tipo) {
    case 'master':
      // Retorna TODOS os cadastros
      return await db.cadastros.findAll();
      
    case 'coordenador':
      // Retorna apenas cadastros das suas equipes
      return await db.cadastros.findAll({
        where: {
          lideranca: {
            equipe_id: { in: usuario.equipesIds }
          }
        }
      });
      
    case 'lideranca':
      // Retorna apenas seus cadastros
      return await db.cadastros.findAll({
        where: { lideranca_id: usuario.liderancaId }
      });
  }
};
```

### 3. Proteção de Rotas no Frontend

```typescript
// Exemplo conceitual
const RotaProtegida = ({ children, nivelMinimo }) => {
  const { usuario } = useAuth();
  
  const niveis = { master: 1, coordenador: 2, lideranca: 3 };
  
  if (niveis[usuario.tipo] > nivelMinimo) {
    return <AcessoNegado />;
  }
  
  return children;
};

// Uso
<RotaProtegida nivelMinimo={1}>
  <Configuracoes /> {/* Só master */}
</RotaProtegida>
```

---

## Fluxo de Criação de Usuários

### Coordenador Master cria Coordenador Normal:

```
1. Master acessa "Gerenciar Usuários"
2. Clica em "Novo Coordenador"
3. Preenche: nome, email, senha temporária
4. Seleciona as equipes que ele vai coordenar
5. Sistema cria:
   - Registro em `usuarios` (tipo: coordenador)
   - Registro em `coordenadores` (dados do coordenador)
   - Registro em `usuario_vinculos` (liga os dois)
   - Registros em `equipe_coordenadores` (equipes vinculadas)
6. Coordenador recebe email com credenciais
```

### Coordenador cria Liderança com acesso:

```
1. Coordenador acessa "Lideranças"
2. Clica em "Nova Liderança"
3. Preenche dados + marca "Criar acesso ao sistema"
4. Sistema cria:
   - Registro em `liderancas`
   - Registro em `usuarios` (tipo: lideranca)
   - Registro em `usuario_vinculos`
5. Liderança recebe email com credenciais
```

---

## Telas por Tipo de Usuário

### Master vê:

```
├── Dashboard (geral)
├── Equipes
├── Coordenadores
├── Lideranças
├── Cadastros
├── Organizações
├── Mapa Eleitoral
├── Configurações
│   ├── WhatsApp
│   ├── Usuários
│   └── Sistema
└── Relatórios
```

### Coordenador vê:

```
├── Dashboard (suas equipes)
├── Minhas Equipes
├── Minhas Lideranças
├── Cadastros (suas equipes)
├── Mapa Eleitoral (suas equipes)
└── Meu Perfil
```

### Liderança vê:

```
├── Meu Dashboard
├── Meus Cadastros
├── Meu Link e QR Code
├── Novo Cadastro
└── Meu Perfil
```

---

## Segurança

### Boas Práticas:

1. **Senhas:** Criptografadas com bcrypt (salt rounds: 12)
2. **Tokens:** JWT com expiração de 24h
3. **Refresh Token:** Para renovar sessão sem novo login
4. **Rate Limiting:** Máximo 5 tentativas de login por minuto
5. **Logs:** Registrar todos os acessos e ações sensíveis
6. **2FA:** Opcional para coordenadores master (futuro)

### Validações:

- Toda requisição valida se o usuário tem permissão
- IDs são verificados contra o contexto do usuário
- Não confiar apenas no frontend para esconder dados

---

## Tecnologias Sugeridas

| Componente | Tecnologia |
|------------|------------|
| Autenticação | Supabase Auth ou NextAuth.js |
| Tokens | JWT (jsonwebtoken) |
| Criptografia | bcrypt |
| Sessão | Cookies HttpOnly + Secure |
| Frontend | React Context + Hooks |
| Backend | Supabase RLS (Row Level Security) |

---

## Row Level Security (RLS) no Supabase

O Supabase permite configurar RLS diretamente no banco, garantindo que as regras de acesso sejam aplicadas mesmo em consultas diretas.

### Exemplo de política para cadastros:

```sql
-- Política: Usuário vê apenas cadastros permitidos
CREATE POLICY "Cadastros por hierarquia" ON cadastros
FOR SELECT USING (
  -- Master vê tudo
  auth.jwt() ->> 'tipo' = 'master'
  OR
  -- Coordenador vê suas equipes
  (
    auth.jwt() ->> 'tipo' = 'coordenador'
    AND lideranca_id IN (
      SELECT id FROM liderancas 
      WHERE equipe_id IN (
        SELECT equipe_id FROM equipe_coordenadores 
        WHERE coordenador_id = (auth.jwt() ->> 'coordenador_id')::int
      )
    )
  )
  OR
  -- Liderança vê seus cadastros
  (
    auth.jwt() ->> 'tipo' = 'lideranca'
    AND lideranca_id = (auth.jwt() ->> 'lideranca_id')::int
  )
);
```

---

## Próximos Passos (quando implementar)

1. ⏳ Criar tabelas `usuarios` e `usuario_vinculos`
2. ⏳ Configurar Supabase Auth
3. ⏳ Implementar RLS no Supabase
4. ⏳ Criar tela de login
5. ⏳ Criar contexto de autenticação no React
6. ⏳ Proteger rotas por nível de acesso
7. ⏳ Criar tela de gerenciamento de usuários (master)
8. ⏳ Implementar recuperação de senha
9. ⏳ Adicionar logs de acesso

---

## Resumo

| Tipo | Vê | Pode fazer |
|------|-----|------------|
| **Master** | Tudo | Tudo |
| **Coordenador** | Suas equipes e lideranças | Gerenciar suas lideranças |
| **Liderança** | Seus cadastros | Cadastrar apoiadores |

Este documento serve como referência para implementação futura do sistema de autenticação e autorização com hierarquia de permissões.
