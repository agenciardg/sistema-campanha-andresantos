# Guia de Deploy para cPanel

## Passos para Deploy no cPanel

### 1. Preparar o Build de Produção

Execute o comando para gerar os arquivos otimizados:

```bash
npm run build
```

Isso criará uma pasta `dist/` com todos os arquivos otimizados para produção.

### 2. Configurar Variáveis de Ambiente no cPanel

**IMPORTANTE:** Você precisa criar um arquivo `.env.production` com as variáveis de ambiente para produção:

```env
VITE_SUPABASE_URL=https://arzoiwlinsswslhokwxk.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
VITE_ENVIRONMENT=production
```

**NOTA:** As chaves de API (Google Maps, Evolution) são gerenciadas via Supabase Secrets (Edge Functions).

**ATENÇÃO:** Nunca commite suas chaves reais no Git!

### 3. Fazer o Build com as Variáveis Corretas

```bash
npm run build
```

### 4. Upload dos Arquivos para o cPanel

#### Opção A: Via File Manager do cPanel

1. Acesse o cPanel
2. Vá em "File Manager"
3. Navegue até a pasta `public_html` (ou a pasta raiz do seu domínio)
4. **DELETE** todos os arquivos antigos da pasta
5. **UPLOAD** todo o conteúdo da pasta `dist/` para `public_html/`
6. Certifique-se de que o arquivo `.htaccess` foi enviado

#### Opção B: Via FTP

1. Conecte-se ao servidor via FTP (usando FileZilla, por exemplo)
2. Navegue até `public_html/`
3. **DELETE** todos os arquivos antigos
4. **UPLOAD** todo o conteúdo da pasta `dist/` para `public_html/`
5. Certifique-se de que o arquivo `.htaccess` foi enviado

### 5. Estrutura de Arquivos no Servidor

Após o upload, sua estrutura deve ficar assim:

```
public_html/
├── .htaccess                 ← IMPORTANTE!
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── images/
    └── ...
```

### 6. Verificar Permissões

Certifique-se de que as permissões dos arquivos estão corretas:
- Arquivos: `644`
- Diretórios: `755`

### 7. Testar a Aplicação

1. Acesse seu domínio no navegador
2. Teste as rotas (navegação entre páginas)
3. Verifique se as imagens carregam
4. Teste o cadastro público
5. Verifique o console do navegador para erros

## Problemas Comuns e Soluções

### Problema 1: Página em branco

**Causa:** Caminhos de arquivos incorretos ou build não foi feito

**Solução:**
1. Verifique se o arquivo `.htaccess` foi enviado
2. Abra o Console do navegador (F12) e veja os erros
3. Refaça o build: `npm run build`
4. Envie novamente os arquivos

### Problema 2: Rotas não funcionam (erro 404)

**Causa:** Arquivo `.htaccess` ausente ou configurado incorretamente

**Solução:**
1. Certifique-se de que o arquivo `.htaccess` está na raiz do `public_html/`
2. Verifique se o módulo `mod_rewrite` está ativo no Apache

### Problema 3: Imagens não carregam

**Causa:** Caminhos incorretos ou arquivos não foram enviados

**Solução:**
1. Verifique se a pasta `images/` foi enviada corretamente
2. Verifique se os caminhos no código estão corretos (devem ser relativos)
3. Verifique as permissões dos arquivos

### Problema 4: API do Supabase não funciona

**Causa:** Variáveis de ambiente não foram configuradas no build

**Solução:**
1. Crie o arquivo `.env.production` com as variáveis corretas
2. Refaça o build: `npm run build`
3. Envie novamente os arquivos

### Problema 5: Erro CORS

**Causa:** Domínio não configurado no Supabase

**Solução:**
1. Acesse o painel do Supabase
2. Vá em Settings > API
3. Adicione seu domínio em "Allowed Origins"

## Checklist Pré-Deploy

- [ ] Criar arquivo `.env.production` com variáveis corretas
- [ ] Executar `npm run build`
- [ ] Verificar se a pasta `dist/` foi criada
- [ ] Verificar se o arquivo `.htaccess` existe
- [ ] Backup dos arquivos antigos do servidor (se houver)
- [ ] Limpar pasta `public_html/` no cPanel
- [ ] Upload de todos os arquivos da pasta `dist/`
- [ ] Verificar se `.htaccess` foi enviado
- [ ] Verificar permissões dos arquivos
- [ ] Testar a aplicação no navegador
- [ ] Verificar Console do navegador para erros
- [ ] Testar todas as rotas principais
- [ ] Testar funcionalidades críticas

## Scripts Úteis

### Build de Produção
```bash
npm run build
```

### Visualizar Build Localmente
```bash
npm run preview
```

### Limpar e Rebuild
```bash
rm -rf dist/
npm run build
```

## Suporte

Se encontrar problemas:
1. Verifique o Console do navegador (F12)
2. Verifique os logs de erro do cPanel
3. Verifique se todas as variáveis de ambiente estão corretas
4. Verifique se o Supabase está acessível

## Observações Importantes

- **NUNCA** commite arquivos `.env` com chaves reais
- Sempre faça backup antes de substituir arquivos
- Teste localmente com `npm run preview` antes de fazer deploy
- Mantenha as dependências atualizadas
- Use HTTPS em produção (certificado SSL)
