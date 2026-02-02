# 📚 Índice - Documentação Claude Code

## 📁 Estrutura de Arquivos

```
.claude/
├── INDEX.md                 # Este arquivo - índice geral
├── README.md               # Visão geral completa
├── QUICK_START.md          # Guia rápido de início
├── USE_CASES.md            # Casos de uso práticos
├── project-config.json     # Configuração do projeto
├── agents.json             # Lista de agentes disponíveis
├── commands.json           # Comandos disponíveis
├── mcp-servers.json        # Servidores MCP configurados
└── skills.json             # Skills disponíveis
```

## 🎯 Navegação Rápida

### Para Começar
1. **Novo no Claude Code?** → Leia `README.md`
2. **Quer usar agora?** → Vá para `QUICK_START.md`
3. **Busca exemplos?** → Veja `USE_CASES.md`

### Referência Técnica
- **Agentes** → `agents.json`
- **Comandos** → `commands.json`
- **MCPs** → `mcp-servers.json`
- **Skills** → `skills.json`
- **Config do Projeto** → `project-config.json`

## 🚀 Início Rápido por Perfil

### 👨‍💻 Desenvolvedor Frontend
```markdown
1. Leia: QUICK_START.md (seção Frontend)
2. Foco: frontend-developer, typescript-pro, ui-ux-designer
3. Skills: canvas-design, image-enhancer
```

### 👨‍💻 Desenvolvedor Backend
```markdown
1. Leia: QUICK_START.md (seção Backend)
2. Foco: backend-architect, database-architect
3. Skills: api-documenter
```

### 🔍 Analista/QA
```markdown
1. Leia: USE_CASES.md (seção Debugging)
2. Foco: test-engineer, code-reviewer, error-detective
3. Skills: xlsx, data-analyst
```

### 📊 Gestor de Projeto
```markdown
1. Leia: USE_CASES.md (seção Workflows)
2. Comandos: /todo, /ultra-think
3. Skills: content-research-writer, email-composer
```

### 🎨 Designer
```markdown
1. Leia: QUICK_START.md (seção Design)
2. Foco: ui-ux-designer, frontend-developer
3. Skills: canvas-design, image-enhancer
```

## 📖 Guia de Leitura Recomendado

### Nível Iniciante
1. `README.md` (15 min) - Visão geral
2. `QUICK_START.md` (10 min) - Primeiros passos
3. Testar com exemplos simples

### Nível Intermediário
1. `USE_CASES.md` (20 min) - Casos práticos
2. `agents.json` (5 min) - Entender agentes
3. `skills.json` (5 min) - Explorar skills

### Nível Avançado
1. `project-config.json` - Configuração profunda
2. `mcp-servers.json` - MCPs avançados
3. Criar skills customizadas com `/skill-creator`

## 🎯 Busca Rápida

### Por Funcionalidade

#### Desenvolvimento
- Criar componente → `QUICK_START.md` → "Frontend"
- Criar API → `QUICK_START.md` → "Backend"
- Testes → `USE_CASES.md` → "Testing"

#### Debugging
- Erro no código → `USE_CASES.md` → "Debugging"
- Performance → `USE_CASES.md` → "Otimização"
- Segurança → `USE_CASES.md` → "Segurança"

#### Documentação
- API Docs → `USE_CASES.md` → "Documentação"
- Guias → `QUICK_START.md` → "Documentação"

#### Análise
- Dados → `QUICK_START.md` → "Skills Úteis"
- Planilhas → `/xlsx` skill
- Relatórios → `USE_CASES.md` → "Análise"

### Por Tecnologia

#### React
- Componentes → `agents.json` → "frontend-developer"
- TypeScript → `agents.json` → "typescript-pro"
- UI/UX → `agents.json` → "ui-ux-designer"

#### Supabase
- Database → `agents.json` → "database-architect"
- Backend → `agents.json` → "backend-architect"
- Auth → `USE_CASES.md` → "Segurança"

#### Mapas (Leaflet)
- Otimização → `USE_CASES.md` → "Performance"
- Componentes → `QUICK_START.md` → "Frontend"

## 🔧 Recursos por Categoria

### 🤖 Agentes (25 disponíveis)
Ver detalhes em: `agents.json`

**Mais usados neste projeto:**
1. frontend-developer
2. typescript-pro
3. backend-architect
4. database-architect
5. code-reviewer

### 🎯 Comandos (3 disponíveis)
Ver detalhes em: `commands.json`

1. `/ultra-think` - Análise profunda
2. `/todo` - Gerenciamento de tarefas
3. `/init-project` - Inicialização

### 🔌 MCPs (5 ativos)
Ver detalhes em: `mcp-servers.json`

1. context7 - Documentação
2. memory-integration - Memória
3. playwright-mcp-server - Automação
4. chrome-devtools - DevTools
5. filesystem-access - Arquivos

### 🛠️ Skills (17 disponíveis)
Ver detalhes em: `skills.json`

**Mais relevantes:**
1. `/xlsx` - Excel
2. `/pdf-processing-pro` - PDFs
3. `/api-documenter` - APIs
4. `/skill-creator` - Criar skills
5. `/canvas-design` - Design

## 📝 Glossário

- **Agente**: Especialista em uma área específica
- **Comando**: Atalho para funcionalidades
- **MCP**: Model Context Protocol - servidor de contexto
- **Skill**: Habilidade específica ativada com /comando

## 🆘 Ajuda

### Problemas Comuns

**"Não sei qual agente usar"**
→ Apenas descreva o que precisa, o Claude escolhe automaticamente

**"Como usar uma skill?"**
→ Digite `/nome-da-skill` (ex: `/xlsx`)

**"Preciso de análise profunda"**
→ Use `/ultra-think` seguido da pergunta

**"Como documentar código?"**
→ Mencione "documentar" + arquivo

### Onde Buscar Ajuda

1. **Dúvidas gerais** → `README.md`
2. **Como fazer X** → `QUICK_START.md`
3. **Exemplos práticos** → `USE_CASES.md`
4. **Lista de recursos** → Arquivos `.json`

## 🔄 Manutenção

### Atualizar Recursos
```bash
npx claude-code-templates@latest --update
```

### Adicionar Novo Agente
Edite: `agents.json`

### Adicionar Nova Skill
Edite: `skills.json`

### Configurar Projeto
Edite: `project-config.json`

## 📊 Estatísticas

```
Total de Agentes:    25
Total de Comandos:   3
Total de MCPs:       5
Total de Skills:     17
```

## 🎓 Aprendizado Contínuo

### Semana 1
- [ ] Ler README.md
- [ ] Ler QUICK_START.md
- [ ] Testar 3 exemplos básicos

### Semana 2
- [ ] Ler USE_CASES.md
- [ ] Testar workflows completos
- [ ] Experimentar skills

### Semana 3
- [ ] Criar skill customizada
- [ ] Otimizar uso de agentes
- [ ] Integrar no workflow diário

---

**Última atualização**: 2026-02-02
**Versão**: 1.0.0
**Projeto**: Sistema de Controle de Campanha
