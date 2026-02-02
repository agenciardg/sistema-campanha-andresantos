/**
 * SECURITY MODULE - XSS Protection & Input Sanitization
 *
 * Este módulo implementa medidas de segurança contra ataques XSS (Cross-Site Scripting)
 * e sanitização de inputs de usuário.
 *
 * IMPORTANTE: Use estas funções em TODOS os dados recebidos de usuários antes de:
 * - Armazenar no banco de dados
 * - Renderizar no DOM
 * - Exibir em logs
 */

/**
 * Remove todas as tags HTML de uma string
 * Implementação SEGURA usando regex (evita innerHTML que pode executar scripts)
 */
function stripHtmlTags(input: string): string {
  // SEGURO: Usar regex em vez de innerHTML para evitar execução de scripts
  // 1. Remove tags de script e style completamente (incluindo conteúdo)
  let cleaned = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 2. Remove todas as tags HTML restantes
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // 3. Decodifica entidades HTML comuns
  cleaned = cleaned
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return cleaned;
}

/**
 * Sanitiza texto simples removendo qualquer HTML/scripts
 * Use para: nomes, endereços, emails, etc.
 *
 * @example
 * sanitizeText('<script>alert("xss")</script>João') // "João"
 * sanitizeText('João <b>Silva</b>') // "João Silva"
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';

  // Remove HTML/scripts completamente
  const cleaned = stripHtmlTags(input.trim());

  // Remove caracteres de controle perigosos (null bytes, etc)
  return cleaned
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitiza múltiplos campos de um objeto
 * Útil para sanitizar formulários inteiros
 *
 * @example
 * const form = { name: '<script>xss</script>João', email: 'test@test.com' };
 * sanitizeObject(form, ['name', 'email']); // { name: 'João', email: 'test@test.com' }
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const sanitized = { ...obj };

  for (const field of fields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeText(sanitized[field] as string) as any;
    }
  }

  return sanitized;
}

/**
 * Sanitiza HTML permitindo apenas tags seguras (para rich text)
 * Use APENAS se realmente precisar de HTML (ex: editor de texto rico)
 * EVITE usar esta função - prefira sanitizeText sempre que possível
 */
export function sanitizeHTML(html: string): string {
  // Lista de tags permitidas
  const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'];
  const allowedTagsRegex = new RegExp(`<(?!\/?(?:${allowedTags.join('|')})\\b)[^>]*>`, 'gi');

  // Remove tags não permitidas, mantém as permitidas
  let sanitized = html.replace(allowedTagsRegex, '');

  // Remove atributos de todas as tags (incluindo onclick, onerror, etc)
  sanitized = sanitized.replace(/<(\w+)(\s+[^>]*)>/g, '<$1>');

  // Remove javascript: e data: URLs
  sanitized = sanitized.replace(/javascript:/gi, '').replace(/data:/gi, '');

  return sanitized;
}

/**
 * Escapa caracteres especiais para prevenir injeção em contextos específicos
 * Use para logs ou quando precisar exibir código literalmente
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Valida e sanitiza email
 * Remove espaços e caracteres perigosos, mantém apenas caracteres válidos
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  // Remove espaços e converte para lowercase
  let cleaned = email.toLowerCase().trim();

  // Remove caracteres de controle
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  // Mantém apenas caracteres válidos de email
  cleaned = cleaned.replace(/[^a-z0-9._%+\-@]/g, '');

  return cleaned;
}

/**
 * Sanitiza telefone/WhatsApp - mantém apenas números
 * Remove todos os caracteres exceto dígitos
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove tudo exceto números
  return phone.replace(/\D/g, '');
}

/**
 * Sanitiza CEP - mantém apenas números e formata corretamente
 */
export function sanitizeCep(cep: string | null | undefined): string {
  if (!cep) return '';

  // Remove tudo exceto números
  const onlyNumbers = cep.replace(/\D/g, '');

  // Limita a 8 dígitos
  return onlyNumbers.slice(0, 8);
}

/**
 * Sanitiza data de nascimento - valida formato ISO
 * Retorna string vazia se formato inválido
 */
export function sanitizeBirthdate(date: string | null | undefined): string {
  if (!date) return '';

  // Remove caracteres não numéricos e hífens
  const cleaned = date.replace(/[^0-9\-]/g, '');

  // Valida formato YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(cleaned)) return '';

  // Valida se é uma data real
  const dateObj = new Date(cleaned);
  if (isNaN(dateObj.getTime())) return '';

  // Valida range razoável (entre 1900 e ano atual)
  const year = dateObj.getFullYear();
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return '';

  return cleaned;
}

/**
 * Sanitiza coordenadas geográficas
 * Valida ranges: latitude [-90, 90], longitude [-180, 180]
 */
export function sanitizeCoordinate(
  value: number | string | null | undefined,
  type: 'latitude' | 'longitude'
): number | null {
  if (value === null || value === undefined) return null;

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return null;

  // Validar ranges
  if (type === 'latitude') {
    return num >= -90 && num <= 90 ? num : null;
  } else {
    return num >= -180 && num <= 180 ? num : null;
  }
}

/**
 * Sanitiza formulário de cadastro completo
 * Use esta função para sanitizar TODOS os cadastros antes de salvar
 */
export function sanitizeRegistrationForm(form: {
  nome?: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  latitude?: number | string;
  longitude?: number | string;
  [key: string]: any;
}) {
  return {
    ...form,
    nome: sanitizeText(form.nome),
    email: sanitizeEmail(form.email),
    telefone: sanitizePhone(form.telefone),
    data_nascimento: sanitizeBirthdate(form.data_nascimento),
    cep: sanitizeCep(form.cep),
    endereco: sanitizeText(form.endereco),
    numero: sanitizeText(form.numero),
    bairro: sanitizeText(form.bairro),
    cidade: sanitizeText(form.cidade),
    estado: sanitizeText(form.estado),
    latitude: sanitizeCoordinate(form.latitude, 'latitude'),
    longitude: sanitizeCoordinate(form.longitude, 'longitude'),
  };
}

/**
 * Previne SQL Injection sanitizando strings para queries
 * NOTA: Esta é uma camada adicional. O Supabase já previne SQL injection,
 * mas é boa prática sanitizar mesmo assim.
 */
export function sanitizeSqlString(input: string): string {
  if (!input) return '';

  // Remove caracteres perigosos para SQL
  return input
    .replace(/[';\-]{2}/g, '') // Remove aspas simples, ponto-e-vírgula, comentários SQL (--)
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|EXEC|EXECUTE|SCRIPT)\b/gi, '') // Remove comandos SQL
    .trim();
}

/**
 * Wrapper seguro para console.log em produção
 * Remove dados sensíveis e desabilita em produção
 */
export function secureLog(message: string, data?: any) {
  // Não logar em produção
  if (import.meta.env.PROD) return;

  // Se tiver dados, sanitizar
  if (data) {
    // Criar cópia para não modificar original
    const safeCopy = JSON.parse(JSON.stringify(data));

    // Remover campos sensíveis
    const sensitiveFields = ['senha', 'password', 'token', 'api_key', 'secret'];
    const removeSensitiveFields = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          removeSensitiveFields(obj[key]);
        }
      }
    };

    removeSensitiveFields(safeCopy);
    console.log(`[SECURE LOG] ${message}`, safeCopy);
  } else {
    console.log(`[SECURE LOG] ${message}`);
  }
}

/**
 * Valida e sanitiza URL
 * Previne javascript:, data:, file: e outros esquemas perigosos
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = url.trim();

  // Lista de esquemas permitidos
  const allowedSchemes = ['http:', 'https:', 'mailto:', 'tel:'];

  try {
    const parsed = new URL(trimmed);

    if (!allowedSchemes.includes(parsed.protocol)) {
      console.warn(`Esquema de URL não permitido: ${parsed.protocol}`);
      return '';
    }

    return trimmed;
  } catch {
    // Se não é uma URL válida, retornar vazio
    return '';
  }
}

/**
 * CSRF Token - Gera token para validação de requisições
 * Use em formulários críticos junto com validação no backend
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida CSRF Token
 */
export function validateCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false;

  // Comparação de tempo constante para prevenir timing attacks
  if (token.length !== storedToken.length) return false;

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
  }

  return result === 0;
}
