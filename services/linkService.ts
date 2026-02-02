// Serviço para geração de links e QR Codes para Lideranças e Coordenadores

// Gerar código único de 8 caracteres
export const gerarCodigoUnico = (): string => {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
};

// Obter URL base da aplicação
export const getBaseUrl = (): string => {
  // Em produção, substituir por URL real
  return window.location.origin + '/#';
};

// Gerar link de cadastro
export const gerarLinkCadastro = (codigo: string): string => {
  return `${getBaseUrl()}/c/${codigo}`;
};

// Gerar link do WhatsApp com mensagem pré-formatada
export const gerarLinkWhatsApp = (
  numeroWhatsApp: string,
  nomeResponsavel: string,
  codigo: string
): string => {
  // Limpar número (remover caracteres especiais)
  const numeroLimpo = numeroWhatsApp.replace(/\D/g, '');
  
  // Mensagem pré-formatada
  const mensagem = encodeURIComponent(
    `Olá! Quero me cadastrar como apoiador.\n\nResponsável: ${nomeResponsavel}\nCódigo: ${codigo}`
  );
  
  return `https://wa.me/${numeroLimpo}?text=${mensagem}`;
};

// Interface para dados do responsável
export interface ResponsavelLink {
  id: number;
  nome: string;
  tipo: 'lideranca' | 'coordenador';
  codigo: string;
  equipeId?: number;
  equipeNome?: string;
}

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

// Verificar se código já existe (mock - em produção seria chamada à API)
export const verificarCodigoExistente = async (codigo: string): Promise<boolean> => {
  // TODO: Implementar verificação real no banco de dados
  // Por enquanto, sempre retorna false (código não existe)
  return false;
};

// Gerar código único garantindo que não existe
export const gerarCodigoUnicoSeguro = async (): Promise<string> => {
  let codigo = gerarCodigoUnico();
  let tentativas = 0;
  const maxTentativas = 10;
  
  while (await verificarCodigoExistente(codigo) && tentativas < maxTentativas) {
    codigo = gerarCodigoUnico();
    tentativas++;
  }
  
  return codigo;
};
