# Estrutura do Banco de Dados - Sistema de Gestão de Campanha

## Visão Geral

Este documento descreve todas as tabelas necessárias para o funcionamento completo do sistema, incluindo a hierarquia de equipes, lideranças, cadastros, organizações e a integração com o mapa eleitoral.

---

## Diagrama de Relacionamentos

```
┌─────────────────┐
│   USUÁRIOS      │
│   (usuarios)    │
└────────┬────────┘
         │ 1:1 (opcional)
         ▼
┌─────────────────┐                    ┌─────────────────┐
│  COORDENADORES  │◄───── N:1 ────────►│  ORGANIZAÇÕES   │
│ (coordenadores) │                    │  (organizacoes) │
└────────┬────────┘                    └────────▲────────┘
         │ N:N                                  │
         ▼                                      │ N:1
┌─────────────────┐                             │
│    EQUIPES      │─────────── N:1 ─────────────┘
│   (equipes)     │
└────────┬────────┘
         │ 1:N                    ┌─────────────────┐
         ▼                        │  ORGANIZAÇÕES   │
┌─────────────────┐◄─── N:1 ─────│  (organizacoes) │
│   LIDERANÇAS    │               └─────────────────┘
│  (liderancas)   │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│   CADASTROS     │
│  (cadastros)    │
└─────────────────┘
```

**Legenda:**
- Organização é criada de forma independente (só nome + endereço)
- Depois é vinculada a Equipes, Lideranças ou Coordenadores
- Cada vínculo é opcional (N:1)

---

## Tabelas do Sistema

> **Nota sobre Sistema de Login:**
> O sistema completo de autenticação com hierarquia (Coordenador Normal, Liderança) 
> será implementado futuramente. Consulte o arquivo `sistema_usuarios_multitenant.md`.
> 
> **Já implementado:** Painel Super Admin para criar Coordenadores Master.

---

### 1. COORDENADORES_MASTER (coordenadores_master)

**Descrição:** Armazena os Coordenadores Master que têm acesso total ao sistema. São criados pelo Super Admin (dono do sistema).

| Campo | Descrição |
|-------|-----------|
| id | Identificador único (UUID) |
| nome | Nome completo |
| email | Email para login (único) |
| senha | Senha criptografada (bcrypt) |
| telefone | Telefone de contato |
| ativo | Se o acesso está ativo ou bloqueado |
| ultimo_acesso | Data/hora do último login |
| criado_em | Data de criação |
| atualizado_em | Data da última atualização |

**Permissões do Coordenador Master:**
- ✅ Acesso total ao sistema
- ✅ Gerencia todas as equipes, coordenadores, lideranças e cadastros
- ✅ Acesso às configurações (WhatsApp, etc.)
- ✅ Exportação de dados
- ✅ Visualização do mapa completo

**Quem cria:** Super Admin (via painel `/#/superadmin`)

---

### 2. ORGANIZAÇÕES (organizacoes)

**Descrição:** Armazena as organizações parceiras (igrejas, sindicatos, associações, etc.). A organização é criada de forma simples e depois vinculada a equipes, lideranças ou coordenadores.

**Criação simplificada:** Na hora de criar, só informa o nome e endereço (via CEP). As demais configurações (responsável, meta, etc.) são definidas quando a organização é vinculada a uma equipe, liderança ou coordenador.

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| nome | Nome da organização |
| tipo | Tipo: `Religioso`, `Sindicato`, `Comunitário`, `Empresarial`, `Associação`, `Educacional`, `Esportivo`, `Outros` |
| tipo_personalizado | Nome personalizado quando tipo = "Outros" (ex: ONG, Cooperativa, Movimento Social) |
| cep | CEP da sede |
| endereco | Endereço |
| numero | Número |
| bairro | Bairro |
| cidade | Cidade |
| estado | Estado (UF) |
| latitude | Coordenada para o mapa |
| longitude | Coordenada para o mapa |
| ativo | Se está ativa |
| criado_em | Data de criação |

**Relacionamentos:**
- Uma organização pode ser vinculada a várias equipes
- Uma organização pode ser vinculada a várias lideranças
- Uma organização pode ser vinculada a vários coordenadores

**Representação no Mapa:**
- **Ícone:** Diferente dos demais (ícone de prédio/instituição)
- **Tamanho:** Grande (similar à equipe, mas com formato distinto)
- **Cor:** Cor própria baseada no tipo (ex: roxo para religioso, laranja para sindicato)
- **Tooltip:** Nome da organização, tipo, quantidade de vínculos

---

### 3. COORDENADORES (coordenadores)

**Descrição:** Armazena os coordenadores que gerenciam equipes e lideranças.

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| usuario_id | Vínculo com tabela de usuários (opcional) |
| nome | Nome completo |
| telefone | WhatsApp/telefone |
| email | Email |
| regiao | Região de atuação |
| organizacao_id | Organização vinculada (opcional) |
| codigo_unico | Código único para link/QR Code (8 caracteres) |
| cep | CEP |
| endereco | Endereço |
| bairro | Bairro |
| cidade | Cidade |
| estado | Estado (UF) |
| latitude | Coordenada para o mapa |
| longitude | Coordenada para o mapa |
| meta | Meta de cadastros |
| ativo | Se está ativo |
| criado_em | Data de criação |

**Relacionamentos:**
- Um coordenador pode gerenciar várias equipes
- Um coordenador pertence a uma organização (opcional)
- Um coordenador tem um código único para gerar link/QR Code

---

### 4. EQUIPES (equipes)

**Descrição:** Armazena as equipes de trabalho da campanha.

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| nome | Nome da equipe (ex: "Equipe Norte") |
| cor | Cor da equipe em hexadecimal (ex: "#1e5a8d") |
| organizacao_id | Organização vinculada (opcional) |
| cep | CEP da sede/base da equipe |
| endereco | Endereço |
| numero | Número |
| bairro | Bairro |
| cidade | Cidade |
| estado | Estado (UF) |
| latitude | Coordenada para o mapa (ícone grande) |
| longitude | Coordenada para o mapa |
| meta | Meta de cadastros da equipe |
| ativo | Se está ativa |
| criado_em | Data de criação |

**Relacionamentos:**
- Uma equipe pertence a uma organização (opcional)
- Uma equipe tem vários coordenadores
- Uma equipe tem várias lideranças
- A cor da equipe é herdada pelas lideranças e cadastros no mapa

---

### 5. EQUIPE_COORDENADORES (equipe_coordenadores)

**Descrição:** Tabela de relacionamento N:N entre equipes e coordenadores.

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| equipe_id | ID da equipe |
| coordenador_id | ID do coordenador |
| criado_em | Data de criação |

**Relacionamentos:**
- Uma equipe pode ter vários coordenadores
- Um coordenador pode coordenar várias equipes

---

### 6. LIDERANÇAS (liderancas)

**Descrição:** Armazena as lideranças que fazem os cadastros de apoiadores.

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| usuario_id | Vínculo com tabela de usuários (opcional) |
| equipe_id | Equipe à qual pertence |
| nome | Nome completo |
| telefone | WhatsApp/telefone |
| email | Email |
| organizacao_id | Organização vinculada (opcional) |
| codigo_unico | Código único para link/QR Code (8 caracteres) |
| cep | CEP |
| endereco | Endereço |
| bairro | Bairro |
| cidade | Cidade |
| estado | Estado (UF) |
| latitude | Coordenada para o mapa (ícone médio) |
| longitude | Coordenada para o mapa |
| meta | Meta de cadastros |
| ativo | Se está ativa |
| criado_em | Data de criação |

**Relacionamentos:**
- Uma liderança pertence a uma equipe
- Uma liderança pode pertencer a uma organização (opcional)
- Uma liderança faz vários cadastros
- Uma liderança tem um código único para gerar link/QR Code
- A cor no mapa é herdada da equipe

---

### 7. CADASTROS (cadastros)

**Descrição:** Armazena os apoiadores cadastrados (leads).

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| lideranca_id | Liderança que fez o cadastro |
| coordenador_id | Coordenador que fez o cadastro (se não foi liderança) |
| nome | Nome completo do apoiador |
| data_nascimento | Data de nascimento |
| telefone | WhatsApp/telefone |
| email | Email |
| cep | CEP |
| endereco | Endereço |
| numero | Número da residência |
| bairro | Bairro |
| cidade | Cidade |
| estado | Estado (UF) |
| latitude | Coordenada para o mapa (bolinha pequena) |
| longitude | Coordenada para o mapa |
| aceite_politica | Se aceitou a política de privacidade |
| origem | Origem do cadastro: `link`, `qrcode`, `manual` |
| criado_em | Data do cadastro |

**Relacionamentos:**
- Um cadastro pertence a uma liderança OU coordenador
- A cor no mapa é herdada da equipe (via liderança)

---

### 8. CONFIGURAÇÕES (configuracoes)

**Descrição:** Armazena configurações gerais do sistema.

| Campo | Descrição |
|-------|-----------|
| id | Identificador único |
| chave | Nome da configuração (ex: "whatsapp_numero") |
| valor | Valor da configuração |
| descricao | Descrição da configuração |
| atualizado_em | Data da última atualização |

**Configurações previstas:**
- `whatsapp_numero`: Número de WhatsApp para receber mensagens do QR Code
- `url_base`: URL base do sistema para geração de links

---

## Relacionamentos para o Mapa

### Hierarquia Visual

```
ORGANIZAÇÃO (ícone PRÉDIO - 36px) ─────────────────────────────────────┐
   │                                                                    │
   │  cor: baseada no tipo (roxo=religioso, laranja=sindicato, etc.)   │
   │  posição: latitude/longitude da organização                       │
   │  formato: DIFERENTE (ícone de prédio/instituição)                 │
   │                                                                    │
   │  * Não faz parte da hierarquia de cores                           │
   │  * É um ponto independente no mapa                                │
   └────────────────────────────────────────────────────────────────────┘

EQUIPE (ícone GRANDE - 40px)
   │
   │  cor: definida na equipe
   │  posição: latitude/longitude da equipe
   │  formato: ícone de grupo (groups)
   │
   └── LIDERANÇA (ícone MÉDIO - 24px)
          │
          │  cor: HERDADA da equipe
          │  posição: latitude/longitude da liderança
          │  formato: ícone de pessoa (person)
          │
          └── CADASTRO (bolinha PEQUENA - 10px)
                 │
                 │  cor: HERDADA da equipe (via liderança)
                 │  posição: latitude/longitude do cadastro
                 │  formato: círculo simples
```

### Cores por Tipo de Organização

| Tipo | Cor Sugerida | Hex |
|------|--------------|-----|
| Religioso | Roxo | #9333ea |
| Sindicato | Laranja | #f97316 |
| Comunitário | Verde | #10b981 |
| Empresarial | Azul | #3b82f6 |
| Associação | Amarelo | #eab308 |

### Consulta para o Mapa

Para exibir os dados no mapa, a consulta deve:

1. **Buscar Organizações:** Trazer todas as organizações com suas coordenadas e cor baseada no tipo
2. **Buscar Equipes:** Trazer todas as equipes com suas coordenadas e cores
3. **Buscar Lideranças:** Trazer lideranças com suas coordenadas, vinculando à equipe para obter a cor
4. **Buscar Cadastros:** Trazer cadastros com suas coordenadas, vinculando à liderança → equipe para obter a cor

**Observação:** Organizações são exibidas de forma independente no mapa, com ícone diferente (prédio) e cor baseada no tipo.

---

## Fluxo de Dados

### Criação de Organização
```
1. Usuário cria organização com nome, tipo e CEP
2. Sistema busca endereço pelo CEP (BrasilAPI)
3. Sistema faz geocoding para obter latitude/longitude (Nominatim)
4. Organização é salva com coordenadas
5. Organização aparece no mapa como ícone de prédio (cor baseada no tipo)
6. Posteriormente, organização pode ser vinculada a equipes, lideranças ou coordenadores
```

### Criação de Equipe
```
1. Usuário cria equipe com nome, cor e CEP
2. Opcionalmente, vincula a uma organização existente
3. Sistema busca endereço pelo CEP (BrasilAPI)
4. Sistema faz geocoding para obter latitude/longitude (Nominatim)
5. Equipe é salva com coordenadas
6. Equipe aparece no mapa como ícone grande
```

### Criação de Liderança
```
1. Usuário cria liderança vinculada a uma equipe
2. Sistema gera código único (8 caracteres)
3. Sistema busca endereço pelo CEP
4. Sistema faz geocoding para obter latitude/longitude
5. Liderança é salva com código e coordenadas
6. Link e QR Code ficam disponíveis
7. Liderança aparece no mapa com cor da equipe
```

### Criação de Cadastro (via link)
```
1. Pessoa acessa link com código da liderança
2. Sistema identifica liderança pelo código
3. Pessoa preenche formulário (nome, nascimento, telefone, email, CEP)
4. Sistema busca endereço pelo CEP
5. Sistema faz geocoding para obter latitude/longitude
6. Cadastro é salvo vinculado à liderança
7. Cadastro aparece no mapa como bolinha com cor da equipe
```

---

## Índices Recomendados

| Tabela | Campo(s) | Motivo |
|--------|----------|--------|
| usuarios | email | Login rápido |
| coordenadores | codigo_unico | Busca por código do link |
| liderancas | codigo_unico | Busca por código do link |
| liderancas | equipe_id | Listagem por equipe |
| cadastros | lideranca_id | Listagem por liderança |
| cadastros | coordenador_id | Listagem por coordenador |
| cadastros | cidade | Filtro por cidade |
| equipes | organizacao_id | Listagem por organização |

---

## Resumo das Tabelas

| Tabela | Descrição | Aparece no Mapa |
|--------|-----------|-----------------|
| usuarios | Usuários do sistema (login) | ❌ Não |
| organizacoes | Organizações parceiras | ✅ Sim (ícone de prédio) |
| coordenadores | Coordenadores de equipes | ✅ Sim (ícone médio) |
| equipes | Equipes de trabalho | ✅ Sim (ícone grande) |
| equipe_coordenadores | Relação equipe-coordenador | ❌ Não |
| liderancas | Lideranças que cadastram | ✅ Sim (ícone médio) |
| cadastros | Apoiadores cadastrados | ✅ Sim (bolinha pequena) |
| configuracoes | Configurações do sistema | ❌ Não |

---

## Campos de Geolocalização

Todas as entidades que aparecem no mapa precisam ter:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| cep | VARCHAR(10) | CEP para busca de endereço |
| endereco | VARCHAR(255) | Rua/Avenida |
| numero | VARCHAR(20) | Número (opcional) |
| bairro | VARCHAR(100) | Bairro |
| cidade | VARCHAR(100) | Cidade |
| estado | VARCHAR(2) | Estado (UF) |
| latitude | DECIMAL(10,8) | Latitude para o mapa |
| longitude | DECIMAL(11,8) | Longitude para o mapa |

**Processo de Geocoding:**
1. Usuário informa o CEP
2. Sistema busca endereço na BrasilAPI
3. Sistema faz geocoding no Nominatim (OpenStreetMap)
4. Coordenadas são salvas no banco

---

## Código Único (Link/QR Code)

| Campo | Descrição |
|-------|-----------|
| codigo_unico | 8 caracteres alfanuméricos |
| Caracteres | A-Z, a-z, 2-9 (sem 0, O, I, l, 1 para evitar confusão) |
| Único | Deve ser único em todo o sistema |
| Usado por | Coordenadores e Lideranças |

**Exemplo:** `AC7x9Kp2`

**Uso:**
- Link: `https://sistema.com/#/c/AC7x9Kp2`
- QR Code: Abre WhatsApp com mensagem contendo o código

---

## Estatísticas e Contagens

### Por Equipe
- Total de lideranças
- Total de cadastros (soma dos cadastros de todas as lideranças)
- Meta vs realizado

### Por Liderança
- Total de cadastros
- Meta vs realizado
- Último cadastro

### Por Coordenador
- Total de equipes
- Total de lideranças (soma de todas as equipes)
- Total de cadastros (soma de todas as lideranças)

### Por Organização
- Total de equipes vinculadas
- Total de cadastros (soma de todas as equipes)

---

## Próximos Passos

1. ⏳ Definir tecnologia do banco (PostgreSQL, MySQL, etc.)
2. ⏳ Criar migrations/scripts de criação das tabelas
3. ⏳ Criar API para CRUD de cada entidade
4. ⏳ Integrar frontend com API
5. ⏳ Implementar autenticação (login)
6. ⏳ Implementar geocoding automático
