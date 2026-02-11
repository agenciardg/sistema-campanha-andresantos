/**
 * SECURITY MODULE - XSS Protection & Input Sanitization
 *
 * Funções de sanitização para dados de usuários.
 * Usado por: configService.ts, PublicRegistration.tsx
 */

/**
 * Remove todas as tags HTML de uma string
 */
function stripHtmlTags(input: string): string {
  let cleaned = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  cleaned = cleaned.replace(/<[^>]*>/g, '');

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
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';

  const cleaned = stripHtmlTags(input.trim());

  return cleaned
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Valida e sanitiza email
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  let cleaned = email.toLowerCase().trim();
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  cleaned = cleaned.replace(/[^a-z0-9._%+\-@]/g, '');

  return cleaned;
}

/**
 * Valida e sanitiza URL
 * Previne javascript:, data:, file: e outros esquemas perigosos
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = url.trim();
  const allowedSchemes = ['http:', 'https:', 'mailto:', 'tel:'];

  try {
    const parsed = new URL(trimmed);

    if (!allowedSchemes.includes(parsed.protocol)) {
      console.warn(`Esquema de URL não permitido: ${parsed.protocol}`);
      return '';
    }

    return trimmed;
  } catch {
    return '';
  }
}

// --- Funções internas usadas por sanitizeRegistrationForm ---

function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function sanitizeCep(cep: string | null | undefined): string {
  if (!cep) return '';
  const onlyNumbers = cep.replace(/\D/g, '');
  return onlyNumbers.slice(0, 8);
}

function sanitizeBirthdate(date: string | null | undefined): string {
  if (!date) return '';

  const cleaned = date.replace(/[^0-9\-]/g, '');
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(cleaned)) return '';

  const dateObj = new Date(cleaned);
  if (isNaN(dateObj.getTime())) return '';

  const year = dateObj.getFullYear();
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return '';

  return cleaned;
}

function sanitizeCoordinate(
  value: number | string | null | undefined,
  type: 'latitude' | 'longitude'
): number | null {
  if (value === null || value === undefined) return null;

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return null;

  if (type === 'latitude') {
    return num >= -90 && num <= 90 ? num : null;
  } else {
    return num >= -180 && num <= 180 ? num : null;
  }
}

/**
 * Sanitiza formulário de cadastro completo
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
