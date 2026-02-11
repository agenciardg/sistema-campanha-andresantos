# 🔧 Troubleshooting - cPanel Deploy

## Problema: Site não abre após deploy no cPanel

### 1️⃣ VERIFICAÇÕES BÁSICAS

#### Checklist Essencial
- [ ] Executei `npm run build` antes de enviar
- [ ] Enviei o CONTEÚDO da pasta `dist/` (não a pasta dist em si)
- [ ] O arquivo `.htaccess` está em `public_html/`
- [ ] Todos os arquivos de `dist/` foram enviados
- [ ] A pasta `assets/` foi enviada

#### Estrutura Correta no Servidor

```
public_html/
├── .htaccess          ← DEVE ESTAR AQUI!
├── index.html         ← DEVE ESTAR AQUI!
├── assets/            ← Pasta com JS e CSS
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── images/            ← Suas imagens
```

**❌ ERRADO:**
```
public_html/
└── dist/              ← NÃO ENVIE A PASTA DIST!
    ├── index.html
    └── ...
```

---

### 2️⃣ DIAGNÓSTICO POR SINTOMA

#### 🔴 Sintoma: Página Completamente em Branco

**Possíveis Causas:**
1. Build não foi feito
2. Arquivos enviados incorretamente
3. Variáveis de ambiente não configuradas
4. Erro de JavaScript

**Soluções:**

**A. Verifique o Console do Navegador (F12)**
- Abra o site
- Pressione F12
- Vá na aba "Console"
- Procure por erros em vermelho

**Erros Comuns:**
- `Failed to load module` → Arquivos não foram enviados
- `Cannot find module` → Build incorreto
- `Supabase` erros → Variáveis de ambiente não configuradas

**B. Refaça o Build Corretamente**
```bash
# 1. Limpar build antigo
npm run clean

# 2. Criar .env.production se não tiver
cp .env.local .env.production

# 3. Build novamente
npm run build

# 4. Verificar se criou a pasta dist
ls dist/
```

**C. Verifique se enviou os arquivos corretos**
No cPanel File Manager, verifique se `public_html/` tem:
- `index.html` na raiz
- `.htaccess` na raiz
- Pasta `assets/` com arquivos JS e CSS

---

#### 🔴 Sintoma: Erro 404 (Not Found)

**Causa:** Arquivo `.htaccess` não está presente ou não está funcionando

**Soluções:**

**A. Verificar se .htaccess foi enviado**
1. No cPanel File Manager, vá em `public_html/`
2. Clique em "Settings" (ícone de engrenagem no canto superior direito)
3. Marque "Show Hidden Files"
4. Verifique se `.htaccess` aparece na listagem

**B. Se .htaccess não estiver lá:**
1. No seu computador, vá na pasta `dist/`
2. Certifique-se que `.htaccess` está lá
3. Envie novamente para `public_html/`

**C. Criar .htaccess manualmente no cPanel:**
1. No File Manager, vá em `public_html/`
2. Clique em "+ File"
3. Nome: `.htaccess`
4. Edite e cole o conteúdo:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
```

**D. Verificar se mod_rewrite está ativo:**
- Entre em contato com o suporte do cPanel
- Peça para verificar se o módulo `mod_rewrite` do Apache está ativo

---

#### 🔴 Sintoma: Erro 500 (Internal Server Error)

**Causa:** Problema no `.htaccess` ou configuração do servidor

**Soluções:**

**A. Testar .htaccess simplificado:**
Substitua o conteúdo do `.htaccess` por uma versão mais simples:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**B. Verificar logs de erro:**
No cPanel:
1. Vá em "Error Log" ou "Logs"
2. Procure pelo erro específico
3. Envie a mensagem de erro aqui para análise

---

#### 🔴 Sintoma: Página inicial carrega, mas rotas dão 404

**Causa:** `.htaccess` não está configurado corretamente

**Solução:**
Use a versão completa do `.htaccess` fornecida no projeto ou adicione:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Não reescrever arquivos reais
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Redirecionar tudo para index.html
  RewriteRule ^ index.html [L]
</IfModule>
```

---

#### 🔴 Sintoma: Imagens não aparecem

**Possíveis Causas:**
1. Pasta `images/` não foi enviada
2. Caminhos incorretos
3. Permissões de arquivo

**Soluções:**

**A. Verificar se a pasta existe:**
- No File Manager, vá em `public_html/`
- Verifique se a pasta `images/` está lá
- Verifique se tem as imagens dentro

**B. Verificar permissões:**
- Selecione a pasta `images/`
- Clique em "Permissions"
- Deve estar: `755` (drwxr-xr-x)
- Arquivos dentro devem estar: `644` (-rw-r--r--)

**C. Enviar pasta novamente:**
Se não estiver lá, envie a pasta `images/` do seu projeto

---

#### 🔴 Sintoma: API/Supabase não funciona

**Possíveis Causas:**
1. Variáveis de ambiente não configuradas no build
2. CORS bloqueado
3. Credenciais incorretas

**Soluções:**

**A. Verificar variáveis de ambiente:**

1. Certifique-se que `.env.production` existe com:
```env
VITE_SUPABASE_URL=https://arzoiwlinsswslhokwxk.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
VITE_ENVIRONMENT=production
```
**Nota:** API keys (Google Maps, Evolution) são gerenciadas via Supabase Secrets.

2. Refaça o build:
```bash
npm run rebuild
```

3. Envie novamente os arquivos

**B. Configurar CORS no Supabase:**

1. Acesse [app.supabase.com](https://app.supabase.com)
2. Vá no seu projeto
3. Settings → API
4. Em "API Settings" ou "CORS", adicione seu domínio:
   - `https://seudominio.com`
   - `http://seudominio.com`

---

### 3️⃣ COMANDOS PARA REBUILD COMPLETO

Se nada funcionou, tente rebuild completo:

```bash
# 1. Limpar tudo
rm -rf dist/ node_modules/

# 2. Reinstalar dependências
npm install

# 3. Criar .env.production
cp .env.local .env.production

# 4. Build
npm run build

# 5. Verificar se criou
ls -la dist/

# 6. Testar localmente
npm run preview
```

Se funcionar no preview local, o problema está no upload ou configuração do cPanel.

---

### 4️⃣ CHECKLIST FINAL ANTES DE ENVIAR

- [ ] `npm run build` executado com sucesso
- [ ] Pasta `dist/` criada
- [ ] `.htaccess` está dentro de `dist/`
- [ ] Testei com `npm run preview` e funcionou
- [ ] `.env.production` configurado com chaves corretas
- [ ] Limpei `public_html/` antes de enviar
- [ ] Enviei CONTEÚDO de `dist/` (não a pasta)
- [ ] `.htaccess` está em `public_html/`
- [ ] `index.html` está em `public_html/`
- [ ] Pasta `assets/` está em `public_html/`

---

### 5️⃣ TESTE RÁPIDO

**Depois de enviar, teste:**

1. Acesse `https://seudominio.com`
   - Deve abrir a página inicial

2. Acesse `https://seudominio.com/teams`
   - Deve abrir a página de equipes (não deve dar 404)

3. Abra Console (F12)
   - Não deve ter erros em vermelho

4. Teste o menu
   - Deve navegar entre páginas

---

### 🆘 AINDA NÃO FUNCIONA?

**Me envie essas informações:**

1. O que aparece quando você acessa o site?
2. Screenshot do Console (F12) com os erros
3. Screenshot da estrutura de pastas no `public_html/`
4. Conteúdo do `.htaccess` que está no servidor
5. Output do comando `npm run build`

Com essas informações consigo te ajudar melhor!
