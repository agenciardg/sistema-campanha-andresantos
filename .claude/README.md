# Configuração Claude Code - Sistema de Controle de Campanha

Este diretório contém as configurações e recursos disponíveis para o Claude Code neste projeto.

## 📁 Estrutura

```
.claude/
├── agents.json          # Agentes especializados disponíveis
├── commands.json        # Comandos de gerenciamento
├── mcp-servers.json     # Servidores MCP configurados
├── skills.json          # Skills para automação e processamento
└── README.md           # Este arquivo
```

## 🤖 Agentes Disponíveis

### Ferramentas de Desenvolvimento
- **code-reviewer**: Revisão de código e boas práticas
- **debugger**: Depuração e resolução de problemas
- **context-manager**: Gerenciamento de contexto do projeto
- **error-detective**: Investigação de erros
- **mcp-expert**: Especialista em MCP
- **command-expert**: Especialista em comandos
- **test-engineer**: Engenharia de testes

### Equipe de Desenvolvimento
- **ui-ux-designer**: Design de interface e experiência
- **frontend-developer**: Desenvolvimento frontend
- **backend-architect**: Arquitetura backend
- **devops-engineer**: DevOps e infraestrutura

### Especialistas em IA
- **prompt-engineer**: Engenharia de prompts
- **task-decomposition-expert**: Decomposição de tarefas
- **search-specialist**: Especialista em buscas
- **ai-engineer**: Engenharia de IA

### Linguagens de Programação
- **python-pro**: Especialista Python
- **typescript-pro**: Especialista TypeScript
- **javascript-pro**: Especialista JavaScript

### Banco de Dados
- **database-architect**: Arquitetura de banco de dados

### Documentação
- **api-documenter**: Documentação de APIs

### Análise e Marketing
- **data-analyst**: Análise de dados
- **content-marketer**: Marketing de conteúdo

## 🎯 Comandos

### Utilidades
- **ultra-think**: Análise profunda e estruturada de problemas complexos

### Gerenciamento de Projetos
- **todo**: Sistema de gerenciamento de tarefas
- **init-project**: Inicialização de novos projetos

## 🔌 Servidores MCP

### DevTools
- **context7**: Documentação atualizada de bibliotecas
- **chrome-devtools**: Integração com Chrome DevTools

### Integração
- **memory-integration**: Sistema de memória e grafo de conhecimento

### Automação
- **playwright-mcp-server**: Automação de navegador

### Sistema de Arquivos
- **filesystem-access**: Acesso ao sistema de arquivos

## 🛠️ Skills

### Desenvolvimento
- **skill-creator**: Criação de skills personalizadas
- **mcp-builder**: Construção de servidores MCP

### Processamento de Documentos
- **docx**: Manipulação de documentos Word
- **pdf-processing-pro**: Processamento avançado de PDFs
- **xlsx**: Processamento de planilhas Excel
- **pptx**: Manipulação de apresentações PowerPoint
- **pdf-anthropic**: Processamento de PDF com Anthropic
- **pdf-processing**: Processamento básico de PDF

### Design Criativo
- **canvas-design**: Design e criação visual

### Comunicação Empresarial
- **excel-analysis**: Análise de dados Excel
- **email-composer**: Composição de emails profissionais

### Marketing e Conteúdo
- **content-research-writer**: Pesquisa e criação de conteúdo

### Mídia
- **image-enhancer**: Melhoria de imagens
- **video-downloader**: Download de vídeos

### Produtividade
- **file-organizer**: Organização de arquivos
- **invoice-organizer**: Organização de faturas

## 💡 Como Usar

### Invocar um Agente
```javascript
// Exemplo: usar o code-reviewer para revisar código
// O Claude Code automaticamente utilizará o agente apropriado
```

### Usar uma Skill
```javascript
// Exemplo: processar uma planilha Excel
// Use: /xlsx para invocar a skill de processamento Excel
```

### Executar um Comando
```javascript
// Exemplo: usar ultra-think para análise profunda
// Use: /ultra-think para análise detalhada
```

## 📝 Notas

- Todos os recursos estão configurados e prontos para uso
- Os servidores MCP estão ativos e funcionando
- As skills podem ser invocadas através de comandos slash (/)
- Consulte a documentação específica de cada recurso para detalhes avançados

## 🔄 Atualização

Para atualizar os templates e recursos:
```bash
npx claude-code-templates@latest --update
```

---

**Última atualização**: 2026-02-02
**Versão do Claude Code**: Latest
