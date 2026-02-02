import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../components/Icon';
import { getConfiguracoes, salvarConfiguracoes, ConfiguracaoSistema } from '../services/linkService';
import { cadastrosService, equipesService, liderancasService, Cadastro, Equipe } from '../lib/supabase';
import { reGeocodificarRegistro } from '../lib/geocoding';
import {
  EvolutionConfig,
  getEvolutionConfig,
  saveEvolutionConfig,
  createInstance,
  getQRCode,
  getConnectionStatus,
  logoutInstance,
  deleteInstance,
  sendTextMessage,
  formatPhoneNumber,
} from '../lib/evolutionApi';

const Settings: React.FC = () => {
  const [config, setConfig] = useState<ConfiguracaoSistema>({
    whatsappNumero: '',
  });
  const [saved, setSaved] = useState(false);
  const [corrigindoCoordenadas, setCorrigindoCoordenadas] = useState(false);
  const [progressoCorrecao, setProgressoCorrecao] = useState({ atual: 0, total: 0, corrigidos: 0 });
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeSelecionada, setEquipeSelecionada] = useState<string>('todas');

  // Evolution API States
  const [evolutionConfig, setEvolutionConfig] = useState<Partial<EvolutionConfig>>({
    servidor_url: '',
    api_key: '',
    instance_name: '',
    status: 'disconnected',
  });
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);
  const [evolutionSuccess, setEvolutionSuccess] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testingMessage, setTestingMessage] = useState(false);

  // Carregar configuração Evolution
  const carregarEvolutionConfig = useCallback(async () => {
    try {
      const config = await getEvolutionConfig();
      if (config) {
        setEvolutionConfig(config);
      }
    } catch (error) {
      console.error('Erro ao carregar config Evolution:', error);
    }
  }, []);

  useEffect(() => {
    const storedConfig = getConfiguracoes();
    setConfig(storedConfig);
    carregarEquipes();
    carregarEvolutionConfig();
  }, [carregarEvolutionConfig]);

  const carregarEquipes = async () => {
    try {
      const equipesData = await equipesService.listarTodos();
      setEquipes(equipesData);
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 13) {
      if (numbers.length <= 2) return `+${numbers}`;
      if (numbers.length <= 4) return `+${numbers.slice(0, 2)} (${numbers.slice(2)}`;
      if (numbers.length <= 9) return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4)}`;
      return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 9)}-${numbers.slice(9)}`;
    }
    return value;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, whatsappNumero: formatPhone(e.target.value) });
    setSaved(false);
  };

  const handleSave = () => {
    salvarConfiguracoes(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const corrigirCoordenadasCadastros = async () => {
    const equipeNome = equipeSelecionada === 'todas'
      ? 'TODOS os cadastros'
      : equipes.find(e => e.id === equipeSelecionada)?.nome || 'equipe selecionada';

    const mensagemConfirmacao = equipeSelecionada === 'todas'
      ? '⚠️ ATENÇÃO: Você está prestes a re-geocodificar TODOS OS CADASTROS do sistema!\n\nIsso pode levar bastante tempo dependendo da quantidade.\n\nRecomendamos processar por equipe para melhor controle.\n\nDeseja continuar mesmo assim?'
      : `Deseja re-geocodificar os cadastros da equipe "${equipeNome}" usando BrasilAPI?`;

    if (!confirm(mensagemConfirmacao)) {
      return;
    }

    setCorrigindoCoordenadas(true);
    setProgressoCorrecao({ atual: 0, total: 0, corrigidos: 0 });

    try {
      // Buscar cadastros conforme seleção
      console.log(`🔍 Buscando cadastros${equipeSelecionada === 'todas' ? ' de todas as equipes' : ` da equipe ${equipeNome}`}...`);

      let cadastros: Cadastro[] = [];

      if (equipeSelecionada === 'todas') {
        cadastros = await cadastrosService.listarTodos();
      } else {
        // Buscar lideranças da equipe
        const liderancas = await liderancasService.listarTodos();
        const liderancasDaEquipe = liderancas.filter(l => l.equipe_id === equipeSelecionada);
        const liderancaIds = liderancasDaEquipe.map(l => l.id);

        // Buscar todos os cadastros e filtrar
        const todosCadastros = await cadastrosService.listarTodos();
        cadastros = todosCadastros.filter(c => c.lideranca_id && liderancaIds.includes(c.lideranca_id));
      }

      console.log(`📊 Total de cadastros: ${cadastros.length}`);
      setProgressoCorrecao({ atual: 0, total: cadastros.length, corrigidos: 0 });

      if (cadastros.length === 0) {
        alert('Nenhum cadastro encontrado para processar.');
        return;
      }

      let corrigidos = 0;

      for (let i = 0; i < cadastros.length; i++) {
        const cadastro = cadastros[i];

        console.log(`\n📍 [${i + 1}/${cadastros.length}] Processando: ${cadastro.nome}`);

        // Tentar re-geocodificar
        const resultado = await reGeocodificarRegistro({
          cep: cadastro.cep,
          endereco: cadastro.endereco,
          numero: cadastro.numero,
          bairro: cadastro.bairro,
          cidade: cadastro.cidade,
          estado: cadastro.estado
        });

        if (resultado) {
          // Verificar se as coordenadas mudaram
          const latMudou = Math.abs((resultado.latitude) - (cadastro.latitude || 0)) > 0.0001;
          const lonMudou = Math.abs((resultado.longitude) - (cadastro.longitude || 0)) > 0.0001;

          if (latMudou || lonMudou || !cadastro.latitude || !cadastro.longitude) {
            console.log(`🔄 Atualizando cadastro ${cadastro.id}...`);
            console.log(`   Antes: [${cadastro.latitude}, ${cadastro.longitude}]`);
            console.log(`   Depois: [${resultado.latitude}, ${resultado.longitude}]`);
            console.log(`   Fonte: ${resultado.fonte}, Precisão: ${resultado.precisao}`);

            // Atualizar no banco
            await cadastrosService.atualizar(cadastro.id, {
              latitude: resultado.latitude,
              longitude: resultado.longitude
            });

            corrigidos++;
            console.log(`✅ Cadastro atualizado!`);
          } else {
            console.log(`✓ Coordenadas já estavam corretas`);
          }
        } else {
          console.warn(`⚠️ Não foi possível geocodificar: ${cadastro.nome}`);
        }

        setProgressoCorrecao({ atual: i + 1, total: cadastros.length, corrigidos });

        // Pequeno delay para não sobrecarregar as APIs
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const mensagemSucesso = equipeSelecionada === 'todas'
        ? `✅ Correção concluída em TODOS os cadastros!\n\nTotal processado: ${cadastros.length}\nCoordenadas corrigidas: ${corrigidos}`
        : `✅ Correção concluída na equipe "${equipeNome}"!\n\nTotal processado: ${cadastros.length}\nCoordenadas corrigidas: ${corrigidos}`;

      alert(mensagemSucesso);
      console.log(`\n✅ CORREÇÃO CONCLUÍDA! ${corrigidos} cadastros atualizados de ${cadastros.length} processados.`);

    } catch (error) {
      console.error('❌ Erro ao corrigir coordenadas:', error);
      alert('Erro ao corrigir coordenadas. Verifique o console para mais detalhes.');
    } finally {
      setCorrigindoCoordenadas(false);
    }
  };

  // ==================== EVOLUTION API HANDLERS ====================

  const handleEvolutionConfigChange = (field: keyof EvolutionConfig, value: string) => {
    // Validação especial para nome da instância
    if (field === 'instance_name') {
      // Remove caracteres inválidos automaticamente (só permite a-z, 0-9, hífen)
      const sanitized = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9-]/g, '') // Remove tudo exceto letras, números e hífen
        .replace(/--+/g, '-') // Remove hífens duplicados
        .replace(/^-|-$/g, ''); // Remove hífen no início/fim

      setEvolutionConfig(prev => ({ ...prev, [field]: sanitized }));
    } else {
      setEvolutionConfig(prev => ({ ...prev, [field]: value }));
    }
    setEvolutionError(null);
    setEvolutionSuccess(null);
  };

  const handleSaveEvolutionConfig = async () => {
    if (!evolutionConfig.servidor_url || !evolutionConfig.api_key || !evolutionConfig.instance_name) {
      setEvolutionError('Preencha todos os campos obrigatórios');
      return;
    }

    setEvolutionLoading(true);
    setEvolutionError(null);

    try {
      await saveEvolutionConfig(evolutionConfig as EvolutionConfig);
      setEvolutionSuccess('Configuração salva com sucesso!');
      setTimeout(() => setEvolutionSuccess(null), 3000);
    } catch (error) {
      setEvolutionError('Erro ao salvar configuração');
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!evolutionConfig.instance_name) {
      setEvolutionError('Digite o nome da instância');
      setTimeout(() => setEvolutionError(null), 3000);
      return;
    }

    setEvolutionLoading(true);
    setEvolutionError(null);
    setEvolutionSuccess(null);
    setQrCodeData(null);

    try {
      // Salvar config primeiro
      await saveEvolutionConfig(evolutionConfig as EvolutionConfig);

      // Criar instância
      const result = await createInstance(evolutionConfig as EvolutionConfig);

      if (result.success && result.qrcode) {
        // A API retorna base64 ou qr dependendo da versão
        const qrData = result.qrcode.base64 || result.qrcode.qr;
        setQrCodeData(qrData || null);
        setShowQrCode(!!qrData);
        setEvolutionConfig(prev => ({ ...prev, status: 'qr_pending' }));
        setEvolutionSuccess('Instância criada! Escaneie o QR Code para conectar.');

        // Iniciar polling de status
        startStatusPolling();
      } else {
        // Melhorar mensagens de erro
        const errorMsg = result.error || 'Erro ao criar instância';

        if (errorMsg.includes('Token inválido') || errorMsg.includes('Invalid JWT')) {
          setEvolutionError('Sessão expirada. Faça logout e login novamente.');
        } else if (errorMsg.includes('already exists') || errorMsg.includes('já existe')) {
          setEvolutionError('Instância já existe. Use "Verificar Conexão" ou delete a instância primeiro.');
        } else {
          setEvolutionError(errorMsg);
        }

        setTimeout(() => setEvolutionError(null), 5000);
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      setEvolutionError(error instanceof Error ? error.message : 'Erro ao criar instância. Verifique a configuração.');
      setTimeout(() => setEvolutionError(null), 5000);
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleGetQRCode = async () => {
    if (!evolutionConfig.instance_name) {
      setEvolutionError('Digite o nome da instância primeiro');
      return;
    }

    setEvolutionLoading(true);
    setEvolutionError(null);

    try {
      const result = await getQRCode(evolutionConfig as EvolutionConfig);

      if (result.success && result.qrcode) {
        const qrData = result.qrcode.base64 || result.qrcode.qr;
        setQrCodeData(qrData || null);
        setShowQrCode(!!qrData);
        startStatusPolling();
      } else {
        setEvolutionError(result.error || 'Erro ao obter QR Code');
      }
    } catch (error) {
      setEvolutionError('Erro ao obter QR Code');
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!evolutionConfig.instance_name) {
      setEvolutionError('Configure o nome da instância primeiro');
      setTimeout(() => setEvolutionError(null), 3000);
      return;
    }

    setEvolutionLoading(true);
    setEvolutionError(null);
    setEvolutionSuccess(null);

    try {
      const result = await getConnectionStatus(evolutionConfig as EvolutionConfig);

      if (result.success && result.status) {
        setEvolutionConfig(prev => ({ ...prev, status: result.status!.state }));

        if (result.status.state === 'connected') {
          setShowQrCode(false);
          setQrCodeData(null);
          setEvolutionSuccess('WhatsApp conectado com sucesso!');
          setTimeout(() => setEvolutionSuccess(null), 3000);
        } else {
          setEvolutionError(`Status: ${result.status.state}`);
          setTimeout(() => setEvolutionError(null), 5000);
        }
      } else {
        // Erro retornado pela API
        const errorMsg = result.error || 'Erro ao verificar conexão';

        // Melhorar mensagem de erro para casos comuns
        if (errorMsg.includes('Token inválido') || errorMsg.includes('Invalid JWT')) {
          setEvolutionError('Sessão expirada. Faça logout e login novamente.');
        } else if (errorMsg.includes('Instance not found') || errorMsg.includes('not found')) {
          setEvolutionError('Instância não encontrada. Crie uma nova instância.');
        } else {
          setEvolutionError(errorMsg);
        }

        setTimeout(() => setEvolutionError(null), 5000);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setEvolutionError(error instanceof Error ? error.message : 'Erro desconhecido');
      setTimeout(() => setEvolutionError(null), 5000);
    } finally {
      setEvolutionLoading(false);
    }
  };

  const startStatusPolling = () => {
    const interval = setInterval(async () => {
      try {
        const result = await getConnectionStatus(evolutionConfig as EvolutionConfig);

        if (result.success && result.status?.state === 'connected') {
          setEvolutionConfig(prev => ({ ...prev, status: 'connected' }));
          setShowQrCode(false);
          setQrCodeData(null);
          setEvolutionSuccess('WhatsApp conectado com sucesso!');
          setTimeout(() => setEvolutionSuccess(null), 3000);
          clearInterval(interval);
        }
      } catch {
        // Ignora erros no polling
      }
    }, 5000);

    // Para o polling após 2 minutos (QR Code expira)
    setTimeout(() => clearInterval(interval), 120000);
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;

    setEvolutionLoading(true);
    setEvolutionError(null);

    try {
      const result = await logoutInstance(evolutionConfig as EvolutionConfig);

      if (result.success) {
        setEvolutionConfig(prev => ({ ...prev, status: 'disconnected' }));
        setEvolutionSuccess('WhatsApp desconectado');
        setTimeout(() => setEvolutionSuccess(null), 3000);
      } else {
        setEvolutionError(result.error || 'Erro ao desconectar');
      }
    } catch (error) {
      setEvolutionError('Erro ao desconectar');
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá deletar a instância permanentemente. Continuar?')) return;

    setEvolutionLoading(true);
    setEvolutionError(null);

    try {
      const result = await deleteInstance(evolutionConfig as EvolutionConfig);

      if (result.success) {
        setEvolutionConfig(prev => ({ ...prev, status: 'disconnected', instance_name: '' }));
        setShowQrCode(false);
        setQrCodeData(null);
        setEvolutionSuccess('Instância deletada! Você pode criar uma nova.');
        setTimeout(() => setEvolutionSuccess(null), 3000);
      } else {
        setEvolutionError(result.error || 'Erro ao deletar instância');
      }
    } catch (error) {
      setEvolutionError('Erro ao deletar instância');
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) {
      setEvolutionError('Digite um número para testar');
      return;
    }

    if (evolutionConfig.status !== 'connected') {
      setEvolutionError('WhatsApp não está conectado');
      return;
    }

    setTestingMessage(true);
    setEvolutionError(null);

    try {
      const formattedPhone = formatPhoneNumber(testPhone);
      const result = await sendTextMessage(
        evolutionConfig as EvolutionConfig,
        formattedPhone,
        '✅ *Teste de Conexão*\n\nSua integração com Evolution API está funcionando corretamente!\n\n_Mensagem enviada pelo sistema Vote Manager_'
      );

      if (result.success) {
        setEvolutionSuccess('Mensagem de teste enviada com sucesso!');
        setTestPhone('');
        setTimeout(() => setEvolutionSuccess(null), 3000);
      } else {
        setEvolutionError(result.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      setEvolutionError('Erro ao enviar mensagem de teste');
    } finally {
      setTestingMessage(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-light light:text-gray-900 dark:text-white tracking-tight mb-1">
          Configurações
        </h1>
        <p className="text-sm light:text-gray-600 dark:text-gray-400 font-light">
          Configure as opções gerais do sistema
        </p>
      </div>

      {/* Configurações Gerais */}
      <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
        <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
          <h2 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Icon name="settings" className="text-[20px] text-[#1e5a8d]" />
            Geral
          </h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Informações sobre Links de Cadastro */}
          <div className="light:bg-gray-50 dark:bg-white/[0.02] rounded-xl p-4">
            <h4 className="text-sm font-medium light:text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Icon name="info" className="text-[16px] text-[#1e5a8d]" />
              Como funciona o Link de Cadastro
            </h4>
            <ul className="text-xs light:text-gray-500 dark:text-gray-400 space-y-2 ml-6">
              <li className="flex items-start gap-2">
                <span className="text-[#1e5a8d]">1.</span>
                <span>Cada liderança e coordenador tem um link único de cadastro</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1e5a8d]">2.</span>
                <span>O link pode ser compartilhado via WhatsApp, e-mail ou outras redes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1e5a8d]">3.</span>
                <span>Ao acessar, a pessoa preenche o formulário de cadastro</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1e5a8d]">4.</span>
                <span>O cadastro é vinculado automaticamente ao responsável do link</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Links de Cadastro */}
      <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
        <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
          <h2 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Icon name="link" className="text-[20px] text-[#1e5a8d]" />
            Links de Cadastro
          </h2>
        </div>

        <div className="p-6">
          <div className="dark:bg-white/[0.02] light:bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#1e5a8d]/20 flex items-center justify-center">
                <Icon name="link" className="text-[20px] text-[#1e5a8d]" />
              </div>
              <div>
                <h4 className="text-sm font-medium light:text-gray-900 dark:text-white">Link de Cadastro</h4>
                <p className="text-xs light:text-gray-500 dark:text-gray-500">Página web independente</p>
              </div>
            </div>
            <p className="text-xs light:text-gray-600 dark:text-gray-400 mt-2">
              Cada liderança e coordenador possui um link único que direciona para uma página de cadastro
              com o nome do responsável já fixado. A pessoa preenche o formulário e o cadastro é
              vinculado automaticamente ao responsável.
            </p>
            <p className="text-xs light:text-gray-500 dark:text-gray-500 mt-3 flex items-center gap-2">
              <Icon name="info" className="text-[14px]" />
              Acesse a página de detalhes de cada liderança ou coordenador para copiar o link.
            </p>
          </div>
        </div>
      </div>

      {/* Manutenção */}
      <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
        <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
          <h2 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Icon name="build" className="text-[20px] text-[#1e5a8d]" />
            Manutenção
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Corrigir Coordenadas */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="map" className="text-[20px] text-amber-500" />
              <label className="text-sm font-medium light:text-gray-900 dark:text-white">
                Corrigir Coordenadas dos Cadastros
              </label>
            </div>
            <p className="text-xs light:text-gray-500 dark:text-gray-500 ml-7">
              Re-geocodifica os cadastros usando BrasilAPI (dados oficiais dos Correios).
              Isso corrige coordenadas incorretas que foram geocodificadas com APIs imprecisas.
            </p>

            {!corrigindoCoordenadas ? (
              <div className="ml-7 space-y-3">
                {/* Seleção de Equipe */}
                <div className="flex items-center gap-3">
                  <label className="text-xs light:text-gray-500 dark:text-gray-400 min-w-[80px]">
                    Processar:
                  </label>
                  <select
                    value={equipeSelecionada}
                    onChange={(e) => setEquipeSelecionada(e.target.value)}
                    className="flex-1 max-w-sm px-4 py-2.5 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="todas">🌐 Todas as Equipes (pode demorar!)</option>
                    {equipes.map(equipe => (
                      <option key={equipe.id} value={equipe.id}>
                        {equipe.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botão de Ação */}
                <button
                  onClick={corrigirCoordenadasCadastros}
                  className={`px-5 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    equipeSelecionada === 'todas'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  <Icon name="refresh" className="text-[18px]" />
                  {equipeSelecionada === 'todas'
                    ? '⚠️ Corrigir TODAS as Coordenadas'
                    : 'Corrigir Coordenadas desta Equipe'}
                </button>

                {equipeSelecionada === 'todas' && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <Icon name="warning" className="text-[16px]" />
                    <span>Processar tudo pode levar muito tempo. Recomendamos processar por equipe.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="ml-7 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs light:text-gray-600 dark:text-gray-400 mb-1">
                      <span>Processando cadastros...</span>
                      <span>{progressoCorrecao.atual} / {progressoCorrecao.total}</span>
                    </div>
                    <div className="h-2 light:bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${(progressoCorrecao.atual / progressoCorrecao.total) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs light:text-gray-500 dark:text-gray-500 mt-1">
                      {progressoCorrecao.corrigidos} coordenadas corrigidas
                    </div>
                  </div>
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            )}

            <div className="ml-7 light:bg-amber-50 dark:bg-amber-500/10 border light:border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
              <h4 className="text-sm font-medium light:text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                <Icon name="info" className="text-[16px]" />
                Sobre esta operação
              </h4>
              <ul className="text-xs light:text-gray-700 dark:text-gray-400 space-y-1.5 ml-6">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>Usa BrasilAPI (Correios) como fonte principal - dados oficiais</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>TomTom é usado apenas como fallback se BrasilAPI falhar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>Valida cidade/estado para evitar coordenadas erradas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>Pode levar alguns minutos dependendo da quantidade de cadastros</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Evolution API - Integração WhatsApp */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 overflow-hidden">
        <div className="p-6 border-b dark:border-white/5 light:border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight flex items-center gap-2">
              <Icon name="send" className="text-[20px] text-green-500" />
              Notificações WhatsApp
            </h2>
            {evolutionConfig.status === 'connected' ? (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Conectado
              </span>
            ) : evolutionConfig.status === 'qr_pending' ? (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                Aguardando Conexão
              </span>
            ) : (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                Desconectado
              </span>
            )}
          </div>
          <p className="text-xs light:text-gray-500 dark:text-gray-500 mt-2">
            Envio automático de mensagens de boas-vindas para lideranças e coordenadores.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Mensagens de Erro/Sucesso */}
          {evolutionError && (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <Icon name="error" className="text-[18px]" />
              {evolutionError}
            </div>
          )}
          {evolutionSuccess && (
            <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
              <Icon name="check_circle" className="text-[18px]" />
              {evolutionSuccess}
            </div>
          )}

          {/* Campo para Nome da Instância */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-white light:text-gray-900 flex items-center gap-2">
                <Icon name="smartphone" className="text-[16px] text-green-500" />
                Nome da Instância
              </label>
              <input
                type="text"
                value={evolutionConfig.instance_name || ''}
                onChange={(e) => handleEvolutionConfigChange('instance_name', e.target.value)}
                placeholder="ex: campanha-2024"
                disabled={evolutionConfig.status === 'connected'}
                className="w-full max-w-md px-4 py-3 rounded-xl text-sm dark:bg-white/5 light:bg-gray-50 dark:text-white light:text-gray-900 border dark:border-white/10 light:border-gray-300 focus:outline-none focus:border-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs light:text-gray-500 dark:text-gray-500">
                Apenas letras minúsculas, números e hífens. Este nome será usado para criar a instância na Evolution API.
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap gap-3">
            {evolutionConfig.status !== 'connected' && (
              <>
                <button
                  onClick={handleCreateInstance}
                  disabled={evolutionLoading || !evolutionConfig.instance_name}
                  className="px-5 py-3 rounded-xl text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {evolutionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="qr_code_2" className="text-[18px]" />
                  )}
                  Conectar WhatsApp
                </button>
              </>
            )}

            <button
              onClick={handleCheckStatus}
              disabled={evolutionLoading || !evolutionConfig.instance_name}
              className="px-5 py-3 rounded-xl text-sm font-medium light:bg-gray-100 dark:bg-white/5 light:hover:bg-gray-200 dark:hover:bg-white/10 light:text-gray-900 dark:text-white transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Icon name="refresh" className="text-[18px]" />
              Verificar Conexão
            </button>

            {evolutionConfig.instance_name && (
              <button
                onClick={handleDeleteInstance}
                disabled={evolutionLoading}
                className="px-5 py-3 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Icon name="delete" className="text-[18px]" />
                Deletar Instância
              </button>
            )}
          </div>

          {/* QR Code Display */}
          {showQrCode && qrCodeData && (
            <div className="light:bg-gray-50 dark:bg-white/[0.02] rounded-xl p-6 text-center">
              <h4 className="text-sm font-medium light:text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-2">
                <Icon name="qr_code_2" className="text-[20px] text-green-500" />
                Escaneie o QR Code com o WhatsApp
              </h4>
              <div className="inline-block p-4 light:bg-white dark:bg-white/10 rounded-xl shadow-lg">
                <img
                  src={qrCodeData}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-xs light:text-gray-500 dark:text-gray-500 mt-4">
                Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar Aparelho
              </p>
              <p className="text-xs text-amber-400 mt-2">
                O QR Code expira em 2 minutos.
              </p>
            </div>
          )}

          {/* Teste de Mensagem */}
          {evolutionConfig.status === 'connected' && (
            <div className="light:bg-green-50 dark:bg-green-500/10 border light:border-green-200 dark:border-green-500/20 rounded-xl p-4">
              <h4 className="text-sm font-medium light:text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                <Icon name="send" className="text-[18px]" />
                Testar Envio
              </h4>
              <div className="flex items-center gap-3">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="(85) 99999-9999"
                  className="flex-1 max-w-xs px-4 py-3 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-green-500 transition-all"
                />
                <button
                  onClick={handleTestMessage}
                  disabled={testingMessage || !testPhone}
                  className="px-5 py-3 rounded-xl text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {testingMessage ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="send" className="text-[18px]" />
                  )}
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* Informações */}
          <div className="dark:bg-white/[0.02] light:bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-medium dark:text-white light:text-gray-900 mb-3 flex items-center gap-2">
              <Icon name="info" className="text-[16px] text-green-500" />
              Como funciona
            </h4>
            <ul className="text-xs light:text-gray-600 dark:text-gray-500 space-y-2 ml-6">
              <li className="flex items-start gap-2">
                <span className="text-green-500">1.</span>
                <span>Clique em "Conectar WhatsApp" e escaneie o QR Code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">2.</span>
                <span>Quando criar uma <strong>Liderança</strong> ou <strong>Coordenador</strong>, o sistema envia automaticamente uma mensagem de boas-vindas com o link de cadastro</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">3.</span>
                <span>O telefone precisa estar no formato: (XX) XXXXX-XXXX</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
