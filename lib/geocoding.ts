// lib/geocoding.ts
// Serviço centralizado de geocodificação com Google (via Edge Function) e BrasilAPI (fallback)

import { rateLimitedFetch } from './rateLimiter';
import logger from './logger';
import { supabase } from './supabase';

// ==================== CONFIGURAÇÃO DAS APIs ====================

// URL da Edge Function de Geocoding (protege a chave do Google Maps)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const GEOCODING_PROXY_URL = `${SUPABASE_URL}/functions/v1/geocoding-proxy`;

// NOTA: TomTom e HERE APIs foram removidas por segurança
// O sistema agora usa apenas Google (via Edge Function) e BrasilAPI/Nominatim (gratuitos)

// ==================== VALIDAÇÃO DE LOCALIZAÇÃO ====================

/**
 * Normaliza string removendo acentos, pontuação e espaços extras
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' '); // Normaliza espaços
}

/**
 * Verifica se duas cidades são equivalentes (considera variações comuns)
 */
function cidadesEquivalentes(cidade1: string, cidade2: string): boolean {
  const c1 = normalizarTexto(cidade1);
  const c2 = normalizarTexto(cidade2);

  // Exata
  if (c1 === c2) return true;

  // São Paulo pode vir como "Sao Paulo", "São Paulo", "SP" (menos comum)
  if ((c1.includes('sao paulo') || c1 === 'sp') && (c2.includes('sao paulo') || c2 === 'sp')) {
    return true;
  }

  // Verificar se uma contém a outra (ex: "Sao Paulo" vs "Sao Paulo - SP")
  if (c1.includes(c2) || c2.includes(c1)) {
    return true;
  }

  return false;
}

/**
 * Valida se o endereço retornado pela API corresponde ao endereço solicitado
 */
function validarLocalidade(
  enderecoPedido: EnderecoCompleto,
  enderecoRetornado: { cidade?: string; estado?: string; pais?: string }
): { valido: boolean; motivo?: string } {

  // Verificar país (deve ser Brasil)
  if (enderecoRetornado.pais) {
    const paisNorm = normalizarTexto(enderecoRetornado.pais);
    if (!paisNorm.includes('brasil') && !paisNorm.includes('brazil')) {
      const motivo = `País incorreto: esperado Brasil, recebido ${enderecoRetornado.pais}`;
      console.error(`❌ ${motivo}`);
      return { valido: false, motivo };
    }
  }

  // Verificar cidade (CRÍTICO)
  if (enderecoRetornado.cidade) {
    if (!cidadesEquivalentes(enderecoPedido.cidade, enderecoRetornado.cidade)) {
      const motivo = `Cidade incorreta: esperado "${enderecoPedido.cidade}", recebido "${enderecoRetornado.cidade}"`;
      console.error(`❌ ${motivo}`);
      return { valido: false, motivo };
    }
  }

  // Verificar estado
  if (enderecoRetornado.estado) {
    const estadoPedidoNorm = normalizarTexto(enderecoPedido.estado);
    const estadoRetornadoNorm = normalizarTexto(enderecoRetornado.estado);

    // Aceitar "SP" ou "Sao Paulo" como equivalentes
    const estadosEquivalentes =
      estadoPedidoNorm === estadoRetornadoNorm ||
      (estadoPedidoNorm === 'sp' && estadoRetornadoNorm.includes('sao paulo')) ||
      (estadoPedidoNorm.includes('sao paulo') && estadoRetornadoNorm === 'sp');

    if (!estadosEquivalentes) {
      const motivo = `Estado incorreto: esperado "${enderecoPedido.estado}", recebido "${enderecoRetornado.estado}"`;
      console.error(`❌ ${motivo}`);
      return { valido: false, motivo };
    }
  }

  console.log(`✅ Localidade validada: ${enderecoRetornado.cidade}/${enderecoRetornado.estado} corresponde ao esperado`);
  return { valido: true };
}

// ==================== INTERFACES ====================

export interface EnderecoCompleto {
  cep: string;
  rua: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  estado: string;
}

export interface Coordenadas {
  latitude: number;
  longitude: number;
  precisao: 'exata' | 'rua' | 'bairro' | 'cidade' | 'aproximada';
  fonte: 'brasilapi' | 'google' | 'tomtom' | 'here' | 'nominatim' | 'cache';
  confianca?: number; // Score de confiança (0-1)
}

export interface ResultadoGeocodificacao {
  sucesso: boolean;
  coordenadas: Coordenadas | null;
  erro?: string;
}

export interface DadosEndereco {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
}

// ==================== CACHE ====================

const CACHE_KEY = 'geocoding_cache_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

interface CacheEntry {
  coordenadas: Coordenadas;
  timestamp: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

function getCacheKey(endereco: EnderecoCompleto): string {
  const partes = [
    endereco.cep.replace(/\D/g, ''),
    endereco.numero || 'sn',
    endereco.cidade.toLowerCase().trim()
  ];
  return partes.join('-');
}

function carregarCache(): CacheStore {
  try {
    const dados = sessionStorage.getItem(CACHE_KEY);
    return dados ? JSON.parse(dados) : {};
  } catch {
    return {};
  }
}

function salvarCache(endereco: EnderecoCompleto, coords: Coordenadas): void {
  try {
    const cache = carregarCache();
    const key = getCacheKey(endereco);
    cache[key] = {
      coordenadas: { ...coords, fonte: 'cache' as const },
      timestamp: Date.now()
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignorar erros de storage
  }
}

function buscarCache(endereco: EnderecoCompleto): Coordenadas | null {
  try {
    const cache = carregarCache();
    const key = getCacheKey(endereco);
    const entry = cache[key];

    if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
      return entry.coordenadas;
    }

    return null;
  } catch {
    return null;
  }
}

// ==================== RATE LIMITER ====================

let ultimaRequisicaoNominatim = 0;

async function aguardarRateLimitNominatim(): Promise<void> {
  const agora = Date.now();
  const tempoDesdeUltima = agora - ultimaRequisicaoNominatim;
  const INTERVALO_MINIMO = 1100; // 1.1 segundo (margem de segurança)

  if (tempoDesdeUltima < INTERVALO_MINIMO) {
    await new Promise(resolve =>
      setTimeout(resolve, INTERVALO_MINIMO - tempoDesdeUltima)
    );
  }

  ultimaRequisicaoNominatim = Date.now();
}

// ==================== APIS ====================

/**
 * Busca endereço pelo CEP usando BrasilAPI (principal) e ViaCEP (fallback)
 */
export async function buscarEnderecoPorCep(cep: string): Promise<DadosEndereco | null> {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return null;

  try {
    // Tentar BrasilAPI v2 primeiro (pode ter coordenadas)
    let response = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${cepLimpo}`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        rua: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || ''
      };
    }

    // Fallback para BrasilAPI v1
    response = await fetch(
      `https://brasilapi.com.br/api/cep/v1/${cepLimpo}`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        rua: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || ''
      };
    }

    // Último recurso: ViaCEP
    console.warn('BrasilAPI falhou, tentando ViaCEP...');
    const viaCepResponse = await fetch(
      `https://viacep.com.br/ws/${cepLimpo}/json/`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (viaCepResponse.ok) {
      const data = await viaCepResponse.json();

      // ViaCEP retorna {erro: true} para CEPs não encontrados
      if (data.erro) {
        console.warn('CEP não encontrado no ViaCEP');
        return null;
      }

      return {
        rua: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || ''
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    return null;
  }
}

/**
 * Geocodifica usando BrasilAPI v2 (PRINCIPAL para endereços brasileiros com CEP)
 * A v2 retorna coordenadas junto com o CEP dos Correios - MUITO MAIS CONFIÁVEL para Brasil
 */
async function geocodificarBrasilAPI(
  endereco: EnderecoCompleto
): Promise<Coordenadas | null> {
  const cepLimpo = endereco.cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return null;

  try {
    console.log(`📍 Tentando BrasilAPI v2 (Correios) com CEP ${cepLimpo}...`);

    const response = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${cepLimpo}`
    );

    if (!response.ok) {
      console.warn('BrasilAPI v2 não retornou sucesso:', response.status);
      return null;
    }

    const data = await response.json();

    // Verificar se tem coordenadas
    if (data.location?.coordinates?.latitude && data.location?.coordinates?.longitude) {
      const lat = parseFloat(data.location.coordinates.latitude);
      const lon = parseFloat(data.location.coordinates.longitude);

      console.log(`📍 BrasilAPI retornou: ${data.city || '?'}, ${data.state || '?'}`);
      console.log(`📍 Coordenadas: [${lat.toFixed(6)}, ${lon.toFixed(6)}]`);

      // VALIDAR LOCALIDADE
      const validacao = validarLocalidade(endereco, {
        cidade: data.city,
        estado: data.state,
        pais: 'Brasil'
      });

      if (!validacao.valido) {
        console.error(`❌ BrasilAPI: resultado rejeitado - ${validacao.motivo}`);
        return null;
      }

      // Determinar precisão - BrasilAPI retorna coordenadas do CEP (nível de rua geralmente)
      let precisao: Coordenadas['precisao'] = 'rua';

      // Se tem número e bairro específico, pode ser mais preciso
      if (endereco.numero && data.street) {
        precisao = 'exata';
      }

      console.log(`✅ BrasilAPI (Correios): Coordenadas oficiais do CEP ${cepLimpo}, precisão=${precisao}`);

      return {
        latitude: lat,
        longitude: lon,
        precisao,
        fonte: 'brasilapi', // Dados oficiais dos Correios
        confianca: 1.0 // Dados dos Correios = máxima confiança
      };
    } else {
      console.warn('⚠️ BrasilAPI v2 não retornou coordenadas para este CEP');
      return null;
    }

  } catch (error) {
    console.error('Erro BrasilAPI:', error);
    return null;
  }
}

// ==================== GOOGLE GEOCODING API (VIA EDGE FUNCTION) ====================

/**
 * Geocodifica usando Google Geocoding API via Edge Function
 * A chave da API fica protegida no servidor (Supabase Edge Function)
 *
 * Vantagens:
 * - Chave da API protegida (não exposta no frontend)
 * - Rate limiting no servidor
 * - Validação de origem (CORS)
 * - Precisão global excelente
 */
async function geocodificarGoogle(
  endereco: EnderecoCompleto
): Promise<Coordenadas | null> {
  if (!SUPABASE_URL) {
    console.warn('SUPABASE_URL não configurada - não é possível usar geocoding via proxy');
    return null;
  }

  try {
    console.log(`📍 Tentando Google Geocoding API (via Edge Function)...`);

    // Obter token de autenticação (se disponível)
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // ESTRATÉGIA 1: Só o CEP (mais confiável para endereços brasileiros)
    let result: any = null;

    if (endereco.cep) {
      const cepLimpo = endereco.cep.replace(/\D/g, '');
      console.log(`   Tentativa 1: Só CEP ${cepLimpo}`);

      const response1 = await fetch(GEOCODING_PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'geocode',
          address: `${cepLimpo}, Brasil`,
        }),
      });

      if (response1.ok) {
        const data = await response1.json();
        if (data.success && data.latitude && data.longitude) {
          console.log(`   ✅ Encontrado com CEP!`);
          result = data;
        }
      }
    }

    // ESTRATÉGIA 2: Endereço completo
    if (!result && endereco.rua) {
      const componentesEndereco = [
        endereco.rua,
        endereco.numero,
        endereco.bairro,
        endereco.cidade,
        endereco.estado,
        'Brasil'
      ].filter(Boolean);

      const enderecoFormatado = componentesEndereco.join(', ');
      console.log(`   Tentativa 2: Endereço completo "${enderecoFormatado}"`);

      const response2 = await fetch(GEOCODING_PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'geocode',
          address: enderecoFormatado,
        }),
      });

      if (response2.ok) {
        const data = await response2.json();
        if (data.success && data.latitude && data.longitude) {
          console.log(`   ✅ Encontrado com endereço completo!`);
          result = data;
        }
      }
    }

    // ESTRATÉGIA 3: Sem número
    if (!result && endereco.rua) {
      const componentesSemNumero = [
        endereco.rua,
        endereco.bairro,
        endereco.cidade,
        endereco.estado,
        'Brasil'
      ].filter(Boolean);

      const enderecoSemNumero = componentesSemNumero.join(', ');
      console.log(`   Tentativa 3: Sem número "${enderecoSemNumero}"`);

      const response3 = await fetch(GEOCODING_PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'geocode',
          address: enderecoSemNumero,
        }),
      });

      if (response3.ok) {
        const data = await response3.json();
        if (data.success && data.latitude && data.longitude) {
          console.log(`   ✅ Encontrado sem número!`);
          result = data;
        }
      }
    }

    if (!result) {
      console.warn('⚠️ Google (proxy): Nenhuma estratégia retornou resultados');
      return null;
    }

    console.log(`📍 Google retornou: ${result.city || '?'}, ${result.state || '?'}, ${result.country || '?'}`);
    console.log(`📍 Coordenadas: [${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}]`);

    // VALIDAR LOCALIDADE (cidade/estado/país devem corresponder)
    const validacao = validarLocalidade(endereco, {
      cidade: result.city,
      estado: result.state,
      pais: result.country
    });

    if (!validacao.valido) {
      console.error(`❌ Google (proxy): resultado rejeitado - ${validacao.motivo}`);
      return null;
    }

    // Determinar precisão baseado no tipo de localização
    let precisao: Coordenadas['precisao'] = 'aproximada';
    const locationType = result.locationType;

    if (locationType === 'ROOFTOP') {
      precisao = 'exata';
    } else if (locationType === 'RANGE_INTERPOLATED') {
      precisao = 'rua';
    } else if (locationType === 'GEOMETRIC_CENTER') {
      precisao = 'rua';
    } else if (locationType === 'APPROXIMATE') {
      precisao = 'bairro';
    }

    // Calcular confiança baseado no tipo
    let confianca = 0.5;
    if (locationType === 'ROOFTOP') {
      confianca = 1.0;
    } else if (locationType === 'RANGE_INTERPOLATED') {
      confianca = 0.9;
    } else if (locationType === 'GEOMETRIC_CENTER') {
      confianca = 0.7;
    }

    console.log(`✅ Google (proxy): tipo=${locationType}, precisão=${precisao}, confiança=${confianca.toFixed(2)}`);

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      precisao,
      fonte: 'google',
      confianca
    };

  } catch (error) {
    console.error('Erro Google Geocoding (proxy):', error);
    return null;
  }
}

// ==================== TOMTOM E HERE REMOVIDOS POR SEGURANÇA ====================
// Essas APIs foram removidas pois requeriam chaves expostas no frontend.
// O sistema agora usa apenas:
// - Google Maps (via Edge Function - chave protegida no servidor)
// - BrasilAPI (gratuita, sem chave)
// - Nominatim/OpenStreetMap (gratuito, sem chave)

/**
 * Geocodifica usando Nominatim com parâmetros estruturados
 */
async function geocodificarNominatimEstruturado(
  endereco: EnderecoCompleto
): Promise<Coordenadas | null> {
  await aguardarRateLimitNominatim();

  try {
    // Montar a query com número incluído
    const rua = endereco.numero
      ? `${endereco.rua}, ${endereco.numero}`
      : endereco.rua;

    const params = new URLSearchParams({
      format: 'json',
      street: rua,
      city: endereco.cidade,
      state: endereco.estado,
      country: 'Brazil',
      limit: '1',
      addressdetails: '1'
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { 'User-Agent': 'CampaignManager/1.0' } }
    );

    const data = await response.json();

    if (data?.[0]) {
      const addressDetails = data[0].address || {};
      const temNumero = !!addressDetails.house_number;

      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        precisao: temNumero ? 'exata' : 'rua',
        fonte: 'nominatim'
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Geocodifica usando Nominatim com query livre
 */
async function geocodificarNominatimQuery(
  query: string
): Promise<Coordenadas | null> {
  await aguardarRateLimitNominatim();

  try {
    const params = new URLSearchParams({
      format: 'json',
      q: query,
      limit: '1',
      countrycodes: 'br'
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { 'User-Agent': 'CampaignManager/1.0' } }
    );

    const data = await response.json();

    if (data?.[0]) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        precisao: 'aproximada',
        fonte: 'nominatim'
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ==================== FUNÇÃO PRINCIPAL ====================

/**
 * Geocodifica um endereço completo usando múltiplas fontes em cascata
 *
 * Ordem de tentativas:
 * 1. Cache local (session storage)
 * 2. BrasilAPI v2 - Correios (PRINCIPAL - 100% para endereços brasileiros) ⭐ OFICIAL
 * 3. Google Geocoding API (FALLBACK - preciso e confiável, 10k grátis/mês)
 *
 * @param endereco - Dados completos do endereço
 * @returns Resultado com coordenadas ou erro
 */
export async function geocodificarEndereco(
  endereco: EnderecoCompleto
): Promise<ResultadoGeocodificacao> {
  // Validação básica
  if (!endereco.cep && !endereco.rua) {
    return {
      sucesso: false,
      coordenadas: null,
      erro: 'CEP ou rua são obrigatórios'
    };
  }

  console.log(`📍 Iniciando geocodificação para: ${endereco.rua}, ${endereco.numero || 'S/N'} - ${endereco.bairro}, ${endereco.cidade}/${endereco.estado} - CEP: ${endereco.cep}`);

  // 1. Verificar cache
  const cached = buscarCache(endereco);
  if (cached) {
    console.log('📍 Geocodificação: usando cache');
    return { sucesso: true, coordenadas: cached };
  }

  try {
    let coords: Coordenadas | null = null;

    // 2. GOOGLE GEOCODING (via Edge Function) - PRINCIPAL
    // Precisão excelente, chave protegida no servidor
    if (SUPABASE_URL) {
      console.log('📍 Tentando Google Geocoding (via Edge Function)...');
      coords = await geocodificarGoogle(endereco);

      if (coords) {
        console.log('✅ Google retornou coordenadas!');
      } else {
        console.warn('⚠️ Google não encontrou coordenadas');
      }
    } else {
      console.warn('⚠️ SUPABASE_URL não configurada - geocoding via proxy indisponível');
    }

    // 3. BRASILAPI - FALLBACK (dados oficiais dos Correios, mas nem sempre tem coordenadas)
    if (!coords && endereco.cep && endereco.cep.replace(/\D/g, '').length === 8) {
      console.log('📍 Google falhou, tentando BrasilAPI (fallback - Correios)...');
      coords = await geocodificarBrasilAPI(endereco);

      if (coords) {
        console.log('✅ BrasilAPI retornou coordenadas oficiais dos Correios!');
      } else {
        console.warn('⚠️ BrasilAPI também não retornou coordenadas');
      }
    } else if (!coords) {
      console.warn('⚠️ CEP inválido ou não fornecido - sem mais fallbacks disponíveis');
    }

    // Resultado
    if (coords) {
      const msgPrecisao = coords.precisao === 'exata'
        ? '✅ Coordenadas com NÚMERO ESPECÍFICO'
        : coords.precisao === 'rua'
        ? '⚠️ Coordenadas no nível da RUA (número aproximado)'
        : '⚠️ Coordenadas APROXIMADAS (bairro/cidade)';

      const confiancaPct = ((coords.confianca || 0) * 100).toFixed(0);
      console.log(`${msgPrecisao} via ${coords.fonte.toUpperCase()} - Confiança: ${confiancaPct}%`);

      // Cachear apenas resultados de alta confiança (>= 70%) ou de fontes oficiais
      if ((coords.confianca || 0) >= 0.7 || coords.fonte === 'brasilapi' || coords.fonte === 'google') {
        salvarCache(endereco, coords);
        console.log('💾 Resultado cacheado (alta confiança)');
      } else {
        console.warn('⚠️ Resultado NÃO cacheado (confiança baixa)');
      }

      return { sucesso: true, coordenadas: coords };
    }

    console.error('❌ Geocodificação falhou em todas as APIs');
    return {
      sucesso: false,
      coordenadas: null,
      erro: 'Endereço não encontrado. Verifique se o CEP e endereço estão corretos.'
    };

  } catch (error) {
    console.error('Erro na geocodificação:', error);
    return {
      sucesso: false,
      coordenadas: null,
      erro: error instanceof Error ? error.message : 'Erro desconhecido na geocodificação'
    };
  }
}

/**
 * Limpa o cache de geocodificação
 * Útil para testes ou quando o usuário quer forçar nova busca
 */
export function limparCacheGeocodificacao(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignorar
  }
}

/**
 * Re-geocodifica um registro existente usando BrasilAPI (prioridade) e TomTom (fallback)
 * Útil para atualizar coordenadas de registros antigos ou incorretos
 */
export async function reGeocodificarRegistro(registro: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}): Promise<{ latitude: number; longitude: number; precisao: string; fonte: string } | null> {
  // Limpar cache para forçar nova busca
  limparCacheGeocodificacao();

  if (!registro.cep && !registro.endereco) {
    console.warn('Re-geocodificação: CEP e endereço não fornecidos');
    return null;
  }

  if (!registro.cidade) {
    console.warn('Re-geocodificação: cidade não fornecida');
    return null;
  }

  console.log(`🔄 Re-geocodificando: ${registro.endereco}, ${registro.numero || 'S/N'} - ${registro.cidade}/${registro.estado} - CEP: ${registro.cep}`);

  const resultado = await geocodificarEndereco({
    rua: registro.endereco || '',
    numero: registro.numero || undefined,
    bairro: registro.bairro || undefined,
    cidade: registro.cidade,
    estado: registro.estado || 'SP',
    cep: registro.cep || ''
  });

  if (resultado.sucesso && resultado.coordenadas) {
    console.log(`✅ Re-geocodificação bem-sucedida via ${resultado.coordenadas.fonte}`);
    return {
      latitude: resultado.coordenadas.latitude,
      longitude: resultado.coordenadas.longitude,
      precisao: resultado.coordenadas.precisao,
      fonte: resultado.coordenadas.fonte
    };
  }

  console.error('❌ Re-geocodificação falhou');
  return null;
}
