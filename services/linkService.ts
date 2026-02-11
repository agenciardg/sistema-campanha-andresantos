// Serviço para geração de links e QR Codes para Lideranças e Coordenadores

// Gerar link de cadastro usando a URL base fornecida pelo contexto de configuração
// Garante que o link use hash routing (/#/c/...) para compatibilidade com HashRouter
export const gerarLinkCadastro = (baseUrl: string, codigo: string): string => {
  const url = baseUrl.replace(/\/+$/, '').replace(/#$/, '');
  return `${url}/#/c/${codigo}`;
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
