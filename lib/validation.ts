/**
 * VALIDATION MODULE - Validações Robustas de Inputs
 *
 * Este módulo implementa validações rigorosas para todos os tipos de dados
 * aceitos pelo sistema, seguindo padrões brasileiros e internacionais.
 *
 * Todas as validações retornam objeto { valid: boolean, error?: string }
 */

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida email segundo RFC 5322 (padrão mais permissivo e correto)
 * Aceita emails internacionais e domínios modernos
 *
 * @example
 * validateEmail('teste@exemplo.com') // { valid: true }
 * validateEmail('invalido@') // { valid: false, error: '...' }
 */
function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email é obrigatório' };
  }

  const trimmed = email.trim().toLowerCase();

  // Verificar tamanho mínimo e máximo
  if (trimmed.length < 3) {
    return { valid: false, error: 'Email muito curto' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email muito longo (máx 254 caracteres)' };
  }

  // RFC 5322 simplificado (mais permissivo que a maioria dos validadores)
  // Aceita: letras, números, ._%+- antes do @, domínio válido após @
  const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Email inválido. Use o formato: exemplo@dominio.com' };
  }

  // Validações adicionais
  const [localPart, domain] = trimmed.split('@');

  // Local part não pode começar/terminar com ponto
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'Email inválido (pontos mal posicionados)' };
  }

  // Não pode ter pontos consecutivos
  if (localPart.includes('..') || domain.includes('..')) {
    return { valid: false, error: 'Email inválido (pontos consecutivos)' };
  }

  // Domínio deve ter ao menos um ponto
  if (!domain.includes('.')) {
    return { valid: false, error: 'Domínio inválido' };
  }

  return { valid: true };
}

/**
 * Valida telefone brasileiro (celular com DDD)
 * Formato aceito: (XX) 9XXXX-XXXX ou 11 dígitos
 * DDD válido: 11-99
 *
 * @example
 * validatePhone('11987654321') // { valid: true }
 * validatePhone('1112345678') // { valid: false } - fixo sem 9
 */
function validatePhone(phone: string | null | undefined): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Telefone é obrigatório' };
  }

  // Remove formatação
  const cleaned = phone.replace(/\D/g, '');

  // Deve ter 11 dígitos (DDD + 9 + 8 dígitos)
  if (cleaned.length !== 11) {
    return {
      valid: false,
      error: 'Telefone deve ter 11 dígitos (DDD + 9 dígitos). Ex: (11) 98765-4321',
    };
  }

  // Extrair DDD
  const ddd = parseInt(cleaned.substring(0, 2));

  // Validar DDD (11 a 99, mas existem apenas alguns válidos)
  const ddsValidos = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
    21, 22, 24, // Rio de Janeiro
    27, 28, // Espírito Santo
    31, 32, 33, 34, 35, 37, 38, // Minas Gerais
    41, 42, 43, 44, 45, 46, // Paraná
    47, 48, 49, // Santa Catarina
    51, 53, 54, 55, // Rio Grande do Sul
    61, // Distrito Federal
    62, 64, // Goiás
    63, // Tocantins
    65, 66, // Mato Grosso
    67, // Mato Grosso do Sul
    68, // Acre
    69, // Rondônia
    71, 73, 74, 75, 77, // Bahia
    79, // Sergipe
    81, 87, // Pernambuco
    82, // Alagoas
    83, // Paraíba
    84, // Rio Grande do Norte
    85, 88, // Ceará
    86, 89, // Piauí
    91, 93, 94, // Pará
    92, 97, // Amazonas
    95, // Roraima
    96, // Amapá
    98, 99, // Maranhão
  ];

  if (!ddsValidos.includes(ddd)) {
    return { valid: false, error: `DDD ${ddd} inválido` };
  }

  // Terceiro dígito deve ser 9 (celular)
  if (cleaned[2] !== '9') {
    return {
      valid: false,
      error: 'Número deve ser de celular (começar com 9 após o DDD)',
    };
  }

  // Não pode ter todos os dígitos iguais
  if (/^(\d)\1+$/.test(cleaned)) {
    return { valid: false, error: 'Número inválido (todos os dígitos iguais)' };
  }

  // Não pode ter sequências óbvias
  const sequencias = ['12345678', '87654321', '11111111', '00000000'];
  const numero = cleaned.substring(3); // Remove DDD + 9
  if (sequencias.some(seq => numero.includes(seq))) {
    return { valid: false, error: 'Número inválido (sequência suspeita)' };
  }

  return { valid: true };
}

/**
 * Valida CEP brasileiro
 * Formato: 8 dígitos, range válido: 01000-000 a 99999-999
 * Exclui CEPs reservados/inválidos
 *
 * @example
 * validateCep('01310100') // { valid: true }
 * validateCep('00000000') // { valid: false }
 */
function validateCep(cep: string | null | undefined): ValidationResult {
  if (!cep || typeof cep !== 'string') {
    return { valid: false, error: 'CEP é obrigatório' };
  }

  // Remove formatação
  const cleaned = cep.replace(/\D/g, '');

  // Deve ter exatamente 8 dígitos
  if (cleaned.length !== 8) {
    return { valid: false, error: 'CEP deve ter 8 dígitos' };
  }

  // Não pode ser 00000-000 ou sequências inválidas
  if (cleaned === '00000000' || /^(\d)\1{7}$/.test(cleaned)) {
    return { valid: false, error: 'CEP inválido' };
  }

  // CEPs brasileiros começam de 01000-000 (São Paulo)
  const cepNum = parseInt(cleaned);
  if (cepNum < 1000000 || cepNum > 99999999) {
    return { valid: false, error: 'CEP fora do range válido' };
  }

  return { valid: true };
}

/**
 * Valida data de nascimento
 * Formato: YYYY-MM-DD
 * Range: entre 1900 e hoje, idade mínima 16 anos
 *
 * @example
 * validateBirthdate('2000-01-01') // { valid: true }
 * validateBirthdate('2020-01-01') // { valid: false } - muito jovem
 */
function validateBirthdate(date: string | null | undefined): ValidationResult {
  if (!date || typeof date !== 'string') {
    return { valid: false, error: 'Data de nascimento é obrigatória' };
  }

  // Validar formato ISO (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return { valid: false, error: 'Data inválida. Use o formato AAAA-MM-DD' };
  }

  // Validar se é data real
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Data inválida' };
  }

  const year = dateObj.getFullYear();
  const currentYear = new Date().getFullYear();

  // Validar range (1900 a ano atual)
  if (year < 1900) {
    return { valid: false, error: 'Data muito antiga (anterior a 1900)' };
  }

  if (year > currentYear) {
    return { valid: false, error: 'Data no futuro não é permitida' };
  }

  // Validar idade mínima (16 anos para participação política)
  const hoje = new Date();
  const idade = hoje.getFullYear() - dateObj.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNascimento = dateObj.getMonth();
  const diaNascimento = dateObj.getDate();

  let idadeReal = idade;
  if (mesAtual < mesNascimento || (mesAtual === mesNascimento && diaAtual < diaNascimento)) {
    idadeReal--;
  }

  if (idadeReal < 16) {
    return { valid: false, error: 'Idade mínima: 16 anos' };
  }

  if (idadeReal > 120) {
    return { valid: false, error: 'Idade inválida (superior a 120 anos)' };
  }

  return { valid: true };
}

/**
 * Valida coordenadas geográficas
 * Latitude: -90 a 90
 * Longitude: -180 a 180
 * Para Brasil: lat aproximadamente -34 a 5, lon aproximadamente -74 a -34
 */
function validateCoordinates(
  lat: number | string | null | undefined,
  lon: number | string | null | undefined,
  strictBrazil: boolean = false
): ValidationResult {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return { valid: false, error: 'Coordenadas são obrigatórias' };
  }

  const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  const longitude = typeof lon === 'string' ? parseFloat(lon) : lon;

  if (isNaN(latitude) || isNaN(longitude)) {
    return { valid: false, error: 'Coordenadas inválidas (não numérico)' };
  }

  // Validar range global
  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude deve estar entre -90 e 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude deve estar entre -180 e 180' };
  }

  // Validar range Brasil (se strictBrazil = true)
  if (strictBrazil) {
    // Brasil: latitude entre -34 (RS) e 5 (RR), longitude entre -74 (AC) e -34 (PE)
    if (latitude < -34 || latitude > 6) {
      return { valid: false, error: 'Coordenadas fora do Brasil (latitude)' };
    }

    if (longitude < -75 || longitude > -33) {
      return { valid: false, error: 'Coordenadas fora do Brasil (longitude)' };
    }
  }

  // Não pode ser exatamente 0,0 (null island)
  if (latitude === 0 && longitude === 0) {
    return { valid: false, error: 'Coordenadas inválidas (0,0)' };
  }

  return { valid: true };
}

/**
 * Valida nome completo
 * Deve ter ao menos 2 partes (nome e sobrenome)
 * Cada parte deve ter ao menos 2 caracteres
 */
function validateFullName(name: string | null | undefined): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome completo é obrigatório' };
  }

  const trimmed = name.trim();

  // Tamanho mínimo e máximo
  if (trimmed.length < 3) {
    return { valid: false, error: 'Nome muito curto' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Nome muito longo (máx 100 caracteres)' };
  }

  // Deve conter apenas letras, espaços, acentos, hífens e apóstrofos
  const nameRegex = /^[a-záàâãéèêíïóôõöúçñ\s'\-]+$/i;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'Nome contém caracteres inválidos' };
  }

  // Deve ter ao menos 2 partes (nome e sobrenome)
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 2) {
    return { valid: false, error: 'Informe nome e sobrenome' };
  }

  // Cada parte deve ter ao menos 2 caracteres (exceto preposições como "de", "da")
  const preposicoes = ['de', 'da', 'do', 'dos', 'das', 'e'];
  for (const part of parts) {
    if (part.length < 2 && !preposicoes.includes(part.toLowerCase())) {
      return { valid: false, error: 'Cada parte do nome deve ter ao menos 2 letras' };
    }
  }

  return { valid: true };
}

/**
 * Valida estado brasileiro (UF)
 * Aceita sigla de 2 letras ou nome completo
 */
function validateState(state: string | null | undefined): ValidationResult {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'Estado é obrigatório' };
  }

  const trimmed = state.trim().toUpperCase();

  const estadosValidos = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ];

  // Aceitar sigla
  if (estadosValidos.includes(trimmed)) {
    return { valid: true };
  }

  // Aceitar nome completo (simplificado)
  const estadosNomes = [
    'ACRE', 'ALAGOAS', 'AMAPA', 'AMAZONAS', 'BAHIA', 'CEARA', 'DISTRITO FEDERAL',
    'ESPIRITO SANTO', 'GOIAS', 'MARANHAO', 'MATO GROSSO', 'MATO GROSSO DO SUL',
    'MINAS GERAIS', 'PARA', 'PARAIBA', 'PARANA', 'PERNAMBUCO', 'PIAUI',
    'RIO DE JANEIRO', 'RIO GRANDE DO NORTE', 'RIO GRANDE DO SUL', 'RONDONIA',
    'RORAIMA', 'SANTA CATARINA', 'SAO PAULO', 'SERGIPE', 'TOCANTINS',
  ];

  const normalized = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (estadosNomes.includes(normalized)) {
    return { valid: true };
  }

  return { valid: false, error: 'Estado inválido. Use a sigla (ex: SP) ou nome completo' };
}

/**
 * Valida formulário de cadastro completo
 * Retorna array de erros (vazio se tudo válido)
 */
export function validateRegistrationForm(form: {
  nome?: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  latitude?: number | string;
  longitude?: number | string;
}): string[] {
  const errors: string[] = [];

  // Nome
  const nameValidation = validateFullName(form.nome);
  if (!nameValidation.valid) {
    errors.push(`Nome: ${nameValidation.error}`);
  }

  // Email
  const emailValidation = validateEmail(form.email);
  if (!emailValidation.valid) {
    errors.push(`Email: ${emailValidation.error}`);
  }

  // Telefone
  const phoneValidation = validatePhone(form.telefone);
  if (!phoneValidation.valid) {
    errors.push(`Telefone: ${phoneValidation.error}`);
  }

  // Data de nascimento
  const birthdateValidation = validateBirthdate(form.data_nascimento);
  if (!birthdateValidation.valid) {
    errors.push(`Data de nascimento: ${birthdateValidation.error}`);
  }

  // CEP
  const cepValidation = validateCep(form.cep);
  if (!cepValidation.valid) {
    errors.push(`CEP: ${cepValidation.error}`);
  }

  // Estado
  const stateValidation = validateState(form.estado);
  if (!stateValidation.valid) {
    errors.push(`Estado: ${stateValidation.error}`);
  }

  // Coordenadas (se fornecidas)
  if (form.latitude !== undefined && form.longitude !== undefined) {
    const coordValidation = validateCoordinates(form.latitude, form.longitude, true);
    if (!coordValidation.valid) {
      errors.push(`Coordenadas: ${coordValidation.error}`);
    }
  }

  return errors;
}
