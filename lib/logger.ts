/**
 * SECURE LOGGER MODULE - Logging Seguro
 *
 * Este módulo implementa logging seguro que:
 * - Remove dados sensíveis automaticamente
 * - Desabilita logs em produção (ou envia para serviço externo)
 * - Formata logs de forma consistente
 * - Adiciona contexto e timestamps
 */

/**
 * Níveis de log disponíveis
 */
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SECURITY = 'SECURITY', // Para eventos de segurança
}

/**
 * Configuração do logger
 */
interface LoggerConfig {
  enableConsole: boolean;
  enableProduction: boolean;
  minLevel: LogLevel;
  redactSensitiveData: boolean;
}

/**
 * Campos considerados sensíveis que devem ser redactados
 */
const SENSITIVE_FIELDS = [
  'senha',
  'password',
  'pass',
  'pwd',
  'token',
  'api_key',
  'apikey',
  'secret',
  'authorization',
  'auth',
  'bearer',
  'jwt',
  'session',
  'cookie',
  'ssn',
  'cpf',
  'cnpj',
  'credit_card',
  'card_number',
  'cvv',
  'pin',
];

/**
 * Palavras-chave que indicam dados pessoais sensíveis (LGPD)
 */
const PII_FIELDS = [
  'email',
  'phone',
  'telefone',
  'whatsapp',
  'endereco',
  'address',
  'cep',
  'rg',
  'identity',
];

/**
 * Configuração padrão
 */
const defaultConfig: LoggerConfig = {
  enableConsole: !import.meta.env.PROD, // Console apenas em dev
  enableProduction: false, // Desabilitar logs em produção (ou enviar para serviço externo)
  minLevel: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO,
  redactSensitiveData: true,
};

/**
 * Classe principal do Logger
 */
class SecureLogger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Redacta dados sensíveis de um objeto
   */
  private redactSensitiveData(data: any): any {
    if (!this.config.redactSensitiveData) {
      return data;
    }

    // Primitivos
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    // Arrays
    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    // Objetos
    const redacted: any = {};

    for (const key in data) {
      const lowerKey = key.toLowerCase();

      // Verificar se é campo sensível
      const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field));

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      }
      // Verificar se é PII (mostrar apenas parte)
      else if (PII_FIELDS.some(field => lowerKey.includes(field))) {
        const value = data[key];
        if (typeof value === 'string') {
          // Mostrar apenas primeiros/últimos caracteres
          if (value.length > 6) {
            redacted[key] = `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
          } else {
            redacted[key] = '***';
          }
        } else {
          redacted[key] = value;
        }
      }
      // Recursivo para objetos aninhados
      else if (typeof data[key] === 'object') {
        redacted[key] = this.redactSensitiveData(data[key]);
      }
      // Outros campos normais
      else {
        redacted[key] = data[key];
      }
    }

    return redacted;
  }

  /**
   * Formata mensagem de log
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    data?: any,
    context?: string
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const dataStr = data ? `\n${JSON.stringify(this.redactSensitiveData(data), null, 2)}` : '';

    return `[${timestamp}] [${level}] ${contextStr} ${message}${dataStr}`;
  }

  /**
   * Verifica se deve logar baseado no nível
   */
  private shouldLog(level: LogLevel): boolean {
    if (import.meta.env.PROD && !this.config.enableProduction) {
      return false;
    }

    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.SECURITY];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.config.minLevel);

    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * Log genérico
   */
  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, data, context);

    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
        case LogLevel.SECURITY:
          console.error(formatted);
          break;
      }
    }

    // TODO: Enviar para serviço de logging externo em produção
    // (ex: Sentry, LogRocket, CloudWatch, etc)
    if (import.meta.env.PROD && level === LogLevel.ERROR) {
      this.sendToExternalService(level, message, data, context);
    }
  }

  /**
   * Envia log para serviço externo (stub para implementação futura)
   */
  private sendToExternalService(
    level: LogLevel,
    message: string,
    data?: any,
    context?: string
  ): void {
    // TODO: Implementar integração com Sentry, LogRocket, etc
    // Exemplo com Sentry:
    // if (window.Sentry) {
    //   window.Sentry.captureException(new Error(message), {
    //     level: level.toLowerCase(),
    //     contexts: { custom: { data, context } }
    //   });
    // }
  }

  /**
   * Métodos públicos de log
   */

  debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  error(message: string, error?: any, context?: string): void {
    // Extrair informações úteis de erros
    let errorData = error;
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.log(LogLevel.ERROR, message, errorData, context);
  }

  /**
   * Log de evento de segurança
   * Use para: tentativas de login, acessos suspeitos, violações de rate limit, etc
   */
  security(message: string, data?: any, context?: string): void {
    this.log(LogLevel.SECURITY, `🔒 SECURITY EVENT: ${message}`, data, context);

    // Eventos de segurança sempre devem ser enviados para serviço externo
    if (import.meta.env.PROD) {
      this.sendToExternalService(LogLevel.SECURITY, message, data, context);
    }
  }

  /**
   * Log de geocodificação
   */
  geocoding(message: string, data?: any): void {
    this.debug(message, data, 'Geocoding');
  }

  /**
   * Log de autenticação
   */
  auth(message: string, data?: any): void {
    this.info(message, data, 'Auth');
  }

  /**
   * Log de banco de dados
   */
  database(message: string, data?: any): void {
    this.debug(message, data, 'Database');
  }

  /**
   * Log de API
   */
  api(message: string, data?: any): void {
    this.debug(message, data, 'API');
  }

  /**
   * Atualiza configuração do logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Instância global do logger
 */
export const logger = new SecureLogger();

export default logger;
