# 💼 Casos de Uso - Claude Code para Sistema de Campanha

## 🎯 Cenários Práticos de Uso

### 1. Desenvolvimento de Nova Feature

**Cenário**: Adicionar sistema de notificações push
```
Você: "Preciso implementar um sistema de notificações push para alertar coordenadores sobre novos cadastros"

Claude Code irá:
1. Usar task-decomposition-expert para quebrar a tarefa
2. Usar backend-architect para planejar a estrutura
3. Usar frontend-developer para implementar UI
4. Usar test-engineer para criar testes
```

### 2. Debugging de Problema Crítico

**Cenário**: Login não está funcionando
```
Você: "O login está falhando após atualização do Supabase"

Claude Code irá:
1. Usar error-detective para investigar
2. Usar debugger para encontrar o problema
3. Verificar logs e configurações
4. Propor solução com code-reviewer
```

### 3. Otimização de Performance

**Cenário**: Mapa lento com muitos marcadores
```
Você: "O mapa está lento quando tem mais de 1000 cadastros"

Claude Code irá:
1. Usar frontend-developer para analisar renderização
2. Usar database-architect para otimizar queries
3. Implementar cluster de marcadores
4. Adicionar lazy loading
```

### 4. Análise de Dados Eleitorais

**Cenário**: Processar planilha de dados
```
Você: /xlsx
Depois: "Analisar planilha dados_eleitorais_2026.xlsx e gerar relatório"

Claude Code irá:
1. Ler e processar a planilha
2. Usar data-analyst para análise
3. Gerar insights e visualizações
4. Criar relatório formatado
```

### 5. Documentação Técnica

**Cenário**: Documentar APIs
```
Você: "Preciso documentar todas as funções de lib/adminService.ts"

Claude Code irá:
1. Usar api-documenter para analisar o código
2. Gerar documentação completa
3. Adicionar exemplos de uso
4. Criar guia de integração
```

### 6. Code Review Completo

**Cenário**: Revisar pull request
```
Você: "Revisar as mudanças em pages/Dashboard.tsx e components/Map/LeafletMap.tsx"

Claude Code irá:
1. Usar code-reviewer para análise
2. Verificar boas práticas
3. Identificar problemas de segurança
4. Sugerir melhorias
5. Verificar TypeScript types
```

### 7. Deploy e DevOps

**Cenário**: Preparar deploy para produção
```
Você: "Preciso fazer deploy do sistema no cPanel"

Claude Code irá:
1. Usar deployment-engineer para planejar
2. Verificar configurações de produção
3. Otimizar build
4. Criar checklist de deploy
5. Configurar variáveis de ambiente
```

### 8. Design de Interface

**Cenário**: Melhorar UX do formulário de cadastro
```
Você: "Melhorar a experiência do formulário de cadastro de eleitores"

Claude Code irá:
1. Usar ui-ux-designer para análise
2. Propor melhorias de layout
3. Sugerir validações em tempo real
4. Melhorar feedback visual
5. Otimizar para mobile
```

### 9. Integração WhatsApp

**Cenário**: Implementar envio de mensagens
```
Você: "Implementar envio de mensagens WhatsApp usando Evolution API"

Claude Code irá:
1. Usar backend-architect para estrutura
2. Implementar rate limiting
3. Criar fila de mensagens
4. Adicionar logs e monitoramento
```

### 10. Análise de Segurança

**Cenário**: Auditoria de segurança
```
Você: "Fazer auditoria de segurança do sistema"

Claude Code irá:
1. Verificar autenticação e autorização
2. Analisar proteção contra CSRF/XSS
3. Verificar validação de inputs
4. Revisar configurações Supabase RLS
5. Sugerir melhorias
```

## 🛠️ Comandos Rápidos por Situação

### Manutenção de Código
```bash
"Refatorar componente Header.tsx"           # → code-reviewer + typescript-pro
"Otimizar queries do Supabase"              # → database-architect
"Adicionar tipos TypeScript faltantes"      # → typescript-pro
```

### Novos Recursos
```bash
"Adicionar exportação PDF de relatórios"    # → /pdf-processing-pro
"Criar dashboard de analytics"              # → frontend-developer + data-analyst
"Implementar busca avançada"                # → backend-architect + search-specialist
```

### Problemas e Bugs
```bash
"Erro 'Cannot read property of undefined'" # → error-detective + debugger
"Mapa não carrega os marcadores"           # → debugger + frontend-developer
"Timeout nas requisições Supabase"         # → backend-architect + database-architect
```

### Documentação
```bash
"Criar documentação da API"                # → api-documenter
"Escrever guia de instalação"             # → content-research-writer
"Documentar estrutura do banco"            # → database-architect
```

### Análise e Relatórios
```bash
/ultra-think "Como escalar para 100k usuários?"
/xlsx "Processar relatório mensal"
"Analisar padrões de uso do sistema"       # → data-analyst
```

## 🎨 Skills em Ação

### Processamento de Documentos
```bash
/xlsx                    # Processar planilhas de cadastros
/pdf-processing-pro      # Gerar relatórios em PDF
/docx                    # Criar documentos formatados
```

### Criatividade e Design
```bash
/canvas-design           # Criar banners e artes
/image-enhancer         # Melhorar qualidade de fotos de campanha
```

### Produtividade
```bash
/file-organizer         # Organizar arquivos do projeto
/invoice-organizer      # Organizar documentos fiscais
/email-composer         # Escrever emails para equipe
```

### Desenvolvimento
```bash
/skill-creator          # Criar nova skill customizada
/mcp-builder           # Criar servidor MCP personalizado
```

## 🚀 Workflows Completos

### Workflow 1: Nova Feature Completa
```
1. /ultra-think "Planejar sistema de tarefas para coordenadores"
2. "Implementar backend com Supabase"
3. "Criar componentes React"
4. "Adicionar testes"
5. "Documentar API"
6. "Preparar para deploy"
```

### Workflow 2: Bug Fix Completo
```
1. "Investigar erro no login"          # error-detective
2. "Analisar logs do Supabase"         # debugger
3. "Propor e implementar correção"     # backend-architect
4. "Testar correção"                   # test-engineer
5. "Code review da correção"           # code-reviewer
```

### Workflow 3: Melhoria de Performance
```
1. /ultra-think "Otimizar performance do mapa"
2. "Analisar renderização React"       # frontend-developer
3. "Otimizar queries"                  # database-architect
4. "Implementar cache"                 # backend-architect
5. "Testar performance"                # test-engineer
```

## 💡 Dicas Avançadas

### Combinar Múltiplos Agentes
```
"Preciso criar um dashboard analytics com mapa de calor e exportação Excel"

Claude Code irá usar:
- frontend-developer (UI)
- data-analyst (Analytics)
- ui-ux-designer (Layout)
- /xlsx (Exportação)
```

### Análise Profunda
```
/ultra-think seguido de pergunta complexa:
- Arquitetura escalável
- Decisões de segurança
- Estratégias de otimização
```

### Automação de Tarefas Repetitivas
```
/skill-creator "Criar skill para gerar relatórios mensais automaticamente"
```

## 📊 Métricas e Monitoramento

```
"Analisar uso de recursos do sistema"      # → data-analyst
"Verificar performance das queries"         # → database-architect
"Monitorar erros de frontend"              # → error-detective
```

---

**Lembre-se**: Quanto mais específico você for no pedido, melhor será o resultado!
