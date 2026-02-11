/**
 * RATE LIMITER MODULE - Controle de Taxa de Requisições
 *
 * Este módulo implementa rate limiting para prevenir:
 * - Abuso de APIs externas (TomTom, HERE, Nominatim)
 * - Ataques de força bruta
 * - Requisições excessivas que podem custar dinheiro
 *
 * Implementa algoritmo Token Bucket para controle eficiente
 */

/**
 * Configuração de rate limit
 */
interface RateLimitConfig {
  maxTokens: number; // Máximo de tokens no bucket
  refillRate: number; // Tokens por segundo
  refillInterval: number; // Intervalo de refill em ms
}

/**
 * Estado interno do rate limiter
 */
interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

/**
 * Classe RateLimiter usando algoritmo Token Bucket
 * Suporta múltiplos limitadores identificados por chave
 */
export class RateLimiter {
  private configs: Map<string, RateLimitConfig>;
  private states: Map<string, RateLimitState>;

  constructor() {
    this.configs = new Map();
    this.states = new Map();
  }

  /**
   * Registra um novo limitador
   */
  register(
    key: string,
    maxTokens: number,
    refillRate: number,
    refillInterval: number = 1000
  ): void {
    this.configs.set(key, { maxTokens, refillRate, refillInterval });
    this.states.set(key, {
      tokens: maxTokens,
      lastRefill: Date.now(),
    });
  }

  /**
   * Tenta consumir um token
   * Retorna true se permitido, false se rate limit excedido
   */
  tryConsume(key: string, cost: number = 1): boolean {
    const config = this.configs.get(key);
    const state = this.states.get(key);

    if (!config || !state) {
      console.warn(`RateLimiter: chave "${key}" não registrada`);
      return true; // Permitir se não configurado
    }

    // Refill tokens baseado no tempo decorrido
    this.refillTokens(key);

    // Verificar se há tokens suficientes
    if (state.tokens >= cost) {
      state.tokens -= cost;
      return true;
    }

    return false;
  }

  /**
   * Aguarda até que tokens estejam disponíveis
   * Retorna Promise que resolve quando permitido
   */
  async waitForToken(key: string, cost: number = 1): Promise<void> {
    const config = this.configs.get(key);

    if (!config) {
      return; // Permitir se não configurado
    }

    while (!this.tryConsume(key, cost)) {
      // Calcular quanto tempo esperar
      const timeToNextToken = config.refillInterval / config.refillRate;
      await new Promise(resolve => setTimeout(resolve, timeToNextToken));
    }
  }

  /**
   * Refill tokens baseado no tempo decorrido
   */
  private refillTokens(key: string): void {
    const config = this.configs.get(key);
    const state = this.states.get(key);

    if (!config || !state) return;

    const now = Date.now();
    const timePassed = now - state.lastRefill;

    // Calcular quantos tokens devem ser adicionados
    const intervalsPassados = Math.floor(timePassed / config.refillInterval);
    const tokensToAdd = intervalsPassados * config.refillRate;

    if (tokensToAdd > 0) {
      state.tokens = Math.min(config.maxTokens, state.tokens + tokensToAdd);
      state.lastRefill = now;
    }
  }

  /**
   * Obtém informações sobre o estado atual do limitador
   */
  getInfo(key: string): { available: number; max: number } | null {
    const config = this.configs.get(key);
    const state = this.states.get(key);

    if (!config || !state) return null;

    this.refillTokens(key);

    return {
      available: Math.floor(state.tokens),
      max: config.maxTokens,
    };
  }

  /**
   * Reseta um limitador específico
   */
  reset(key: string): void {
    const config = this.configs.get(key);
    if (config) {
      this.states.set(key, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
      });
    }
  }

  /**
   * Reseta todos os limitadores
   */
  resetAll(): void {
    this.configs.forEach((config, key) => {
      this.reset(key);
    });
  }
}

/**
 * Instância global do rate limiter
 */
export const globalRateLimiter = new RateLimiter();

/**
 * Configurações padrão para APIs de geocodificação
 */
export function setupGeocodingRateLimiters(): void {
  // TomTom: 5 requisições por segundo (plano gratuito)
  // Configuramos de forma conservadora: 3 req/s para ter margem
  globalRateLimiter.register(
    'tomtom',
    10, // 10 tokens no bucket (burst)
    3, // 3 tokens/segundo
    1000 // Refill a cada 1 segundo
  );

  // HERE: 5 requisições por segundo (plano gratuito)
  // Configuramos: 3 req/s
  globalRateLimiter.register(
    'here',
    10, // 10 tokens no bucket
    3, // 3 tokens/segundo
    1000
  );

  // Nominatim: 1 requisição por segundo (política de uso justo)
  // Configuramos: 1 req/s exato
  globalRateLimiter.register(
    'nominatim',
    2, // 2 tokens no bucket (mínimo burst)
    1, // 1 token/segundo
    1000
  );

  // BrasilAPI: 10 requisições por segundo (estimativa)
  // Configuramos: 5 req/s
  globalRateLimiter.register(
    'brasilapi',
    20, // 20 tokens no bucket
    5, // 5 tokens/segundo
    1000
  );

  // ViaCEP: 300 requisições por 5 minutos = 1 req/segundo
  // Configuramos: 1 req/s
  globalRateLimiter.register(
    'viacep',
    5, // 5 tokens no bucket
    1, // 1 token/segundo
    1000
  );
}

/**
 * Rate limiter para tentativas de login (prevenir brute force)
 */
export function setupLoginRateLimiter(): void {
  // 5 tentativas de login por minuto por IP/usuário
  globalRateLimiter.register(
    'login',
    5, // 5 tentativas permitidas
    1, // 1 nova tentativa a cada 12 segundos
    12000 // Refill a cada 12 segundos
  );
}

/**
 * Rate limiter para cadastros públicos (prevenir spam)
 */
export function setupPublicRegistrationRateLimiter(): void {
  // 3 cadastros por minuto por IP
  globalRateLimiter.register(
    'public-registration',
    3, // 3 cadastros no burst
    1, // 1 novo cadastro a cada 20 segundos
    20000
  );
}

/**
 * Wrapper para APIs de geocodificação com rate limiting automático
 */
export async function rateLimitedFetch(
  apiKey: 'tomtom' | 'here' | 'nominatim' | 'brasilapi' | 'viacep',
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Aguardar token disponível
  await globalRateLimiter.waitForToken(apiKey);

  // Fazer requisição
  const response = await fetch(url, options);

  // Log para debug
  if (!import.meta.env.PROD) {
    const info = globalRateLimiter.getInfo(apiKey);
    console.log(
      `[RateLimit] ${apiKey.toUpperCase()}: ${info?.available}/${info?.max} tokens disponíveis`
    );
  }

  return response;
}

/**
 * Decorator/wrapper para funções que fazem requisições limitadas
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  key: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    await globalRateLimiter.waitForToken(key);
    return fn(...args);
  }) as T;
}

/**
 * Middleware de rate limit para express (se usar backend Node.js no futuro)
 * Por enquanto apenas referência
 */
export function expressRateLimitMiddleware(limitKey: string) {
  return async (req: any, res: any, next: any) => {
    // Usar IP do cliente como identificador
    const clientId = req.ip || req.connection.remoteAddress;
    const key = `${limitKey}:${clientId}`;

    // Registrar limitador para este cliente se não existir
    if (!globalRateLimiter.getInfo(key)) {
      globalRateLimiter.register(key, 10, 1, 1000);
    }

    // Tentar consumir token
    if (!globalRateLimiter.tryConsume(key)) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 1,
      });
    }

    next();
  };
}

/**
 * Inicializa todos os rate limiters do sistema
 */
export function initializeRateLimiters(): void {
  setupGeocodingRateLimiters();
  setupLoginRateLimiter();
  setupPublicRegistrationRateLimiter();

  if (!import.meta.env.PROD) {
    console.log('[RateLimiter] Todos os limitadores inicializados');
  }
}

// Auto-inicializar quando módulo é importado
initializeRateLimiters();
