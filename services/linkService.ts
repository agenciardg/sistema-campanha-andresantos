// Serviço para geração de links e QR Codes para Lideranças e Coordenadores
import { getDefaultValue } from '../lib/configService';

// Obter URL base da aplicação
const getBaseUrl = (): string => {
  return getDefaultValue('links.url_base_cadastro');
};

// Gerar link de cadastro
export const gerarLinkCadastro = (codigo: string): string => {
  return `${getBaseUrl()}/c/${codigo}`;
};

// Armazenamento local das configurações
const CONFIG_KEY = 'campanha_config';

export interface ConfiguracaoSistema {
  whatsappNumero: string;
}

// Obter configurações
export const getConfiguracoes = (): ConfiguracaoSistema => {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    whatsappNumero: '',
  };
};

// Salvar configurações
export const salvarConfiguracoes = (config: ConfiguracaoSistema): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};
