import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { getConfiguracoes, salvarConfiguracoes, ConfiguracaoSistema } from '../services/linkService';
import { cadastrosService, equipesService, liderancasService, Cadastro, Equipe } from '../lib/supabase';
import { reGeocodificarRegistro } from '../lib/geocoding';
import { adminService, Admin, PAGINAS_PERMISSOES, PaginaPermissao } from '../lib/adminService';
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
import {
  SETORES_CONFIG,
  getAllConfigs,
  saveConfigs,
  invalidateCache,
} from '../lib/configService';
import { globalRateLimiter } from '../lib/rateLimiter';

// Registrar rate limiter para saves de configuração
if (!globalRateLimiter.getInfo('config-save')) {
  globalRateLimiter.register('config-save', 5, 1, 12000);
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const { reloadConfigs } = useConfig();

  // Auth state
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Setor ativo (tab navigation)
  const [setorAtivo, setSetorAtivo] = useState('branding');

  // Config values
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());

  // Password visibility toggle per field
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  // Legacy config
  const [config, setConfig] = useState<ConfiguracaoSistema>({ whatsappNumero: '' });
  const [corrigindoCoordenadas, setCorrigindoCoordenadas] = useState(false);
  const [progressoCorrecao, setProgressoCorrecao] = useState({ atual: 0, total: 0, corrigidos: 0 });
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeSelecionada, setEquipeSelecionada] = useState<string>('todas');

  // Inline superadmin login (on restricted screen)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Evolution API States
  const [evolutionConfig, setEvolutionConfig] = useState<Partial<EvolutionConfig>>({
    servidor_url: '', api_key: '', instance_name: '', status: 'disconnected',
  });
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);
  const [evolutionSuccess, setEvolutionSuccess] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testingMessage, setTestingMessage] = useState(false);

  // Admin management states
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: '', password: '', nome: '', telefone: '',
    role: 'admin' as 'superadmin' | 'admin',
    permissions: [] as PaginaPermissao[],
  });
  const [adminFormLoading, setAdminFormLoading] = useState(false);
  const [adminFormPasswordVisible, setAdminFormPasswordVisible] = useState(false);

  // ==================== AUTH CHECK ====================

  useEffect(() => {
    if (!user) { setAuthChecking(false); return; }
    const role = (user as any).app_metadata?.role;
    setIsAuthorized(role === 'superadmin');
    setAuthChecking(false);
  }, [user]);

  // ==================== LOAD CONFIGS ====================

  const carregarConfigs = useCallback(async () => {
    try {
      setConfigLoading(true);
      const allConfigs = await getAllConfigs();
      setConfigValues(allConfigs);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setConfigLoading(false);
      setModifiedKeys(new Set());
    }
  }, []);

  const carregarEvolutionConfig = useCallback(async () => {
    try {
      const cfg = await getEvolutionConfig();
      if (cfg) setEvolutionConfig(cfg);
    } catch (error) {
      console.error('Erro ao carregar config Evolution:', error);
    }
  }, []);

  const carregarAdmins = useCallback(async () => {
    setAdminsLoading(true);
    setAdminError(null);
    try {
      const lista = await adminService.listar();
      setAdmins(lista);
    } catch (error) {
      console.error('Erro ao carregar admins:', error);
      setAdminError('Erro ao carregar administradores.');
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      carregarConfigs();
      const storedConfig = getConfiguracoes();
      setConfig(storedConfig);
      carregarEquipes();
      carregarEvolutionConfig();
      carregarAdmins();
    }
  }, [isAuthorized, carregarConfigs, carregarEvolutionConfig, carregarAdmins]);

  const carregarEquipes = async () => {
    try {
      const equipesData = await equipesService.listarTodos();
      setEquipes(equipesData);
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
    }
  };

  // ==================== CONFIG HANDLERS ====================

  const handleConfigChange = (chave: string, valor: string) => {
    setConfigValues(prev => ({ ...prev, [chave]: valor }));
    setModifiedKeys(prev => {
      const next = new Set(prev);
      next.add(chave);
      return next;
    });
    setConfigSaved(false);
    setConfigError(null);
  };

  const handleSaveConfigs = async () => {
    if (!globalRateLimiter.tryConsume('config-save')) {
      setConfigError('Muitas alterações em pouco tempo. Aguarde alguns segundos.');
      setTimeout(() => setConfigError(null), 5000);
      return;
    }
    if (modifiedKeys.size === 0) {
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      return;
    }

    setConfigSaving(true);
    setConfigError(null);
    try {
      // Filtrar apenas o que realmente mudou para enviar ao service
      const updates: Record<string, string> = {};
      modifiedKeys.forEach(key => {
        updates[key] = configValues[key];
      });

      // Timeout de 15s para evitar spinning infinito
      const saveWithTimeout = Promise.race([
        saveConfigs(updates),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout: servidor não respondeu em 15 segundos.')), 15000)
        ),
      ]);
      await saveWithTimeout;
      invalidateCache();
      await reloadConfigs();
      setModifiedKeys(new Set());
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      setConfigError(error?.message || 'Erro ao salvar configurações. Tente novamente.');
      setTimeout(() => setConfigError(null), 8000);
    } finally {
      setConfigSaving(false);
    }
  };

  const toggleFieldVisibility = (chave: string) => {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave); else next.add(chave);
      return next;
    });
  };

  // ==================== MAINTENANCE ====================

  const corrigirCoordenadasCadastros = async () => {
    const equipeNome = equipeSelecionada === 'todas'
      ? 'TODOS os cadastros'
      : equipes.find(e => e.id === equipeSelecionada)?.nome || 'equipe selecionada';

    const mensagemConfirmacao = equipeSelecionada === 'todas'
      ? 'ATENÇÃO: Você está prestes a re-geocodificar TODOS OS CADASTROS do sistema!\n\nIsso pode levar bastante tempo.\nRecomendamos processar por equipe.\n\nDeseja continuar?'
      : `Deseja re-geocodificar os cadastros da equipe "${equipeNome}" usando BrasilAPI?`;

    if (!confirm(mensagemConfirmacao)) return;

    setCorrigindoCoordenadas(true);
    setProgressoCorrecao({ atual: 0, total: 0, corrigidos: 0 });

    try {
      let cadastros: Cadastro[] = [];
      if (equipeSelecionada === 'todas') {
        cadastros = await cadastrosService.listarTodos();
      } else {
        cadastros = await cadastrosService.listarPorEquipe(equipeSelecionada);
      }

      setProgressoCorrecao({ atual: 0, total: cadastros.length, corrigidos: 0 });
      if (cadastros.length === 0) { alert('Nenhum cadastro encontrado.'); return; }

      let corrigidos = 0;
      for (let i = 0; i < cadastros.length; i++) {
        const cadastro = cadastros[i];
        const resultado = await reGeocodificarRegistro({
          cep: cadastro.cep, endereco: cadastro.endereco, numero: cadastro.numero,
          bairro: cadastro.bairro, cidade: cadastro.cidade, estado: cadastro.estado
        });
        if (resultado) {
          const latMudou = Math.abs(resultado.latitude - (cadastro.latitude || 0)) > 0.0001;
          const lonMudou = Math.abs(resultado.longitude - (cadastro.longitude || 0)) > 0.0001;
          if (latMudou || lonMudou || !cadastro.latitude || !cadastro.longitude) {
            await cadastrosService.atualizar(cadastro.id, { latitude: resultado.latitude, longitude: resultado.longitude });
            corrigidos++;
          }
        }
        setProgressoCorrecao({ atual: i + 1, total: cadastros.length, corrigidos });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      alert(`Correção concluída!\nTotal: ${cadastros.length}\nCorrigidos: ${corrigidos}`);
    } catch (error) {
      console.error('Erro ao corrigir coordenadas:', error);
      alert('Erro ao corrigir coordenadas.');
    } finally {
      setCorrigindoCoordenadas(false);
    }
  };

  // ==================== ADMIN MANAGEMENT HANDLERS ====================

  const openAdminModal = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin);
      setAdminForm({
        email: admin.email,
        password: '',
        nome: admin.nome,
        telefone: admin.telefone,
        role: admin.role,
        permissions: [...admin.permissions],
      });
    } else {
      setEditingAdmin(null);
      setAdminForm({
        email: '', password: '', nome: '', telefone: '',
        role: 'admin',
        permissions: PAGINAS_PERMISSOES.map(p => p.id) as PaginaPermissao[],
      });
    }
    setShowAdminModal(true);
    setAdminFormPasswordVisible(false);
  };

  const handleAdminFormSubmit = async () => {
    setAdminFormLoading(true);
    setAdminError(null);
    try {
      if (editingAdmin) {
        await adminService.atualizar(editingAdmin.id, {
          nome: adminForm.nome,
          telefone: adminForm.telefone,
          role: adminForm.role,
          permissions: adminForm.role === 'superadmin' ? [] : adminForm.permissions,
        });
        setAdminSuccess('Admin atualizado com sucesso!');
      } else {
        if (!adminForm.email || !adminForm.password) {
          setAdminError('Email e senha são obrigatórios.');
          setAdminFormLoading(false);
          return;
        }
        await adminService.criar({
          email: adminForm.email,
          password: adminForm.password,
          nome: adminForm.nome,
          telefone: adminForm.telefone,
          role: adminForm.role,
          permissions: adminForm.role === 'superadmin' ? [] : adminForm.permissions,
        });
        setAdminSuccess('Admin criado com sucesso!');
      }
      setShowAdminModal(false);
      await carregarAdmins();
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Erro ao salvar admin.');
      setTimeout(() => setAdminError(null), 5000);
    } finally {
      setAdminFormLoading(false);
    }
  };

  const handleToggleAdmin = async (admin: Admin) => {
    if (admin.id === user?.id) return;
    const acao = admin.ativo ? 'desativar' : 'ativar';
    if (!confirm(`Deseja ${acao} o admin "${admin.nome || admin.email}"?`)) return;
    try {
      await adminService.toggle(admin.id, !admin.ativo);
      setAdminSuccess(`Admin ${admin.ativo ? 'desativado' : 'ativado'}!`);
      await carregarAdmins();
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Erro ao alterar status.');
      setTimeout(() => setAdminError(null), 5000);
    }
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (admin.id === user?.id) return;
    if (!confirm(`ATENÇÃO: Excluir permanentemente "${admin.nome || admin.email}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await adminService.excluir(admin.id);
      setAdminSuccess('Admin excluído com sucesso!');
      await carregarAdmins();
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Erro ao excluir admin.');
      setTimeout(() => setAdminError(null), 5000);
    }
  };

  const togglePermission = (permId: PaginaPermissao) => {
    setAdminForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  // ==================== EVOLUTION API HANDLERS ====================

  const handleEvolutionConfigChange = (field: keyof EvolutionConfig, value: string) => {
    if (field === 'instance_name') {
      const sanitized = value.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '')
        .replace(/--+/g, '-').replace(/^-|-$/g, '');
      setEvolutionConfig(prev => ({ ...prev, [field]: sanitized }));
    } else {
      setEvolutionConfig(prev => ({ ...prev, [field]: value }));
    }
    setEvolutionError(null);
    setEvolutionSuccess(null);
  };

  const handleSaveEvolutionConfig = async () => {
    if (!evolutionConfig.servidor_url || !evolutionConfig.api_key || !evolutionConfig.instance_name) {
      setEvolutionError('Preencha todos os campos obrigatórios'); return;
    }
    setEvolutionLoading(true); setEvolutionError(null);
    try {
      await saveEvolutionConfig(evolutionConfig as EvolutionConfig);
      setEvolutionSuccess('Configuração salva com sucesso!');
      setTimeout(() => setEvolutionSuccess(null), 3000);
    } catch { setEvolutionError('Erro ao salvar configuração'); }
    finally { setEvolutionLoading(false); }
  };

  const handleCreateInstance = async () => {
    if (!evolutionConfig.instance_name) { setEvolutionError('Digite o nome da instância'); setTimeout(() => setEvolutionError(null), 3000); return; }
    setEvolutionLoading(true); setEvolutionError(null); setEvolutionSuccess(null); setQrCodeData(null);
    try {
      await saveEvolutionConfig(evolutionConfig as EvolutionConfig);
      const result = await createInstance(evolutionConfig as EvolutionConfig);
      if (result.success && result.qrcode) {
        const qrData = result.qrcode.base64 || result.qrcode.qr;
        setQrCodeData(qrData || null); setShowQrCode(!!qrData);
        setEvolutionConfig(prev => ({ ...prev, status: 'qr_pending' }));
        setEvolutionSuccess('Instância criada! Escaneie o QR Code.'); startStatusPolling();
      } else {
        const msg = result.error || 'Erro ao criar instância';
        if (msg.includes('Token inválido') || msg.includes('Invalid JWT')) setEvolutionError('Sessão expirada. Faça logout e login novamente.');
        else if (msg.includes('already exists') || msg.includes('já existe')) setEvolutionError('Instância já existe. Use "Verificar Conexão" ou delete primeiro.');
        else setEvolutionError(msg);
        setTimeout(() => setEvolutionError(null), 5000);
      }
    } catch (error) { setEvolutionError(error instanceof Error ? error.message : 'Erro ao criar instância.'); setTimeout(() => setEvolutionError(null), 5000); }
    finally { setEvolutionLoading(false); }
  };

  const handleCheckStatus = async () => {
    if (!evolutionConfig.servidor_url || !evolutionConfig.api_key || !evolutionConfig.instance_name) {
      setEvolutionError('Preencha todos os campos obrigatórios antes de verificar');
      setTimeout(() => setEvolutionError(null), 3000);
      return;
    }
    setEvolutionLoading(true); setEvolutionError(null); setEvolutionSuccess(null);
    try {
      // SALVAR ANTES DE VERIFICAR (A Edge Function precisa dos dados no banco)
      const saved = await saveEvolutionConfig(evolutionConfig as EvolutionConfig);
      if (saved) setEvolutionConfig(saved);

      const result = await getConnectionStatus(evolutionConfig as EvolutionConfig);
      if (result.success && result.status) {
        setEvolutionConfig(prev => ({ ...prev, status: result.status!.state }));
        if (result.status.state === 'connected') {
          setShowQrCode(false); setQrCodeData(null);
          setEvolutionSuccess('WhatsApp conectado com sucesso!'); setTimeout(() => setEvolutionSuccess(null), 3000);
        } else { setEvolutionError(`Status: ${result.status.state}`); setTimeout(() => setEvolutionError(null), 5000); }
      } else {
        const msg = result.error || 'Erro ao verificar conexão';
        if (msg.includes('Token inválido') || msg.includes('Invalid JWT')) setEvolutionError('Sessão expirada.');
        else if (msg.includes('not found')) setEvolutionError('Instância não encontrada. Crie uma nova.');
        else setEvolutionError(msg);
        setTimeout(() => setEvolutionError(null), 5000);
      }
    } catch (error) { setEvolutionError(error instanceof Error ? error.message : 'Erro desconhecido'); setTimeout(() => setEvolutionError(null), 5000); }
    finally { setEvolutionLoading(false); }
  };

  const startStatusPolling = () => {
    const interval = setInterval(async () => {
      try {
        const result = await getConnectionStatus(evolutionConfig as EvolutionConfig);
        if (result.success && result.status?.state === 'connected') {
          setEvolutionConfig(prev => ({ ...prev, status: 'connected' }));
          setShowQrCode(false); setQrCodeData(null);
          setEvolutionSuccess('WhatsApp conectado!'); setTimeout(() => setEvolutionSuccess(null), 3000);
          clearInterval(interval);
        }
      } catch { /* polling */ }
    }, 5000);
    setTimeout(() => clearInterval(interval), 120000);
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;
    setEvolutionLoading(true); setEvolutionError(null);
    try {
      const result = await logoutInstance(evolutionConfig as EvolutionConfig);
      if (result.success) { setEvolutionConfig(prev => ({ ...prev, status: 'disconnected' })); setEvolutionSuccess('WhatsApp desconectado'); setTimeout(() => setEvolutionSuccess(null), 3000); }
      else setEvolutionError(result.error || 'Erro ao desconectar');
    } catch { setEvolutionError('Erro ao desconectar'); } finally { setEvolutionLoading(false); }
  };

  const handleDeleteInstance = async () => {
    if (!confirm('ATENÇÃO: Isso irá deletar a instância permanentemente. Continuar?')) return;
    setEvolutionLoading(true); setEvolutionError(null);
    try {
      const result = await deleteInstance(evolutionConfig as EvolutionConfig);
      if (result.success) {
        setEvolutionConfig(prev => ({ ...prev, status: 'disconnected', instance_name: '' }));
        setShowQrCode(false); setQrCodeData(null);
        setEvolutionSuccess('Instância deletada!'); setTimeout(() => setEvolutionSuccess(null), 3000);
      } else setEvolutionError(result.error || 'Erro ao deletar instância');
    } catch { setEvolutionError('Erro ao deletar instância'); } finally { setEvolutionLoading(false); }
  };

  const handleTestMessage = async () => {
    if (!testPhone) { setEvolutionError('Digite um número para testar'); return; }
    if (evolutionConfig.status !== 'connected') { setEvolutionError('WhatsApp não está conectado'); return; }
    setTestingMessage(true); setEvolutionError(null);
    try {
      const formattedPhone = formatPhoneNumber(testPhone);
      const result = await sendTextMessage(evolutionConfig as EvolutionConfig, formattedPhone,
        '✅ *Teste de Conexão*\n\nSua integração com Evolution API está funcionando!\n\n_Mensagem enviada pelo sistema PoliticaData_');
      if (result.success) { setEvolutionSuccess('Mensagem enviada!'); setTestPhone(''); setTimeout(() => setEvolutionSuccess(null), 3000); }
      else setEvolutionError(result.error || 'Erro ao enviar mensagem');
    } catch { setEvolutionError('Erro ao enviar mensagem de teste'); } finally { setTestingMessage(false); }
  };

  // ==================== INLINE SUPERADMIN LOGIN ====================

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');

    if (!globalRateLimiter.tryConsume('login')) {
      setAdminLoginError('Muitas tentativas. Aguarde alguns segundos.');
      return;
    }

    setAdminLoginLoading(true);
    try {
      const { error: signInError } = await signIn(adminEmail, adminPassword);
      if (signInError) {
        setAdminLoginError('Credenciais inválidas.');
        return;
      }
      // Re-fetch user to check role
      const { data: { user: freshUser } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());
      const role = (freshUser as any)?.app_metadata?.role;
      if (role === 'superadmin') {
        setIsAuthorized(true);
        setAdminEmail('');
        setAdminPassword('');
        setShowAdminLogin(false);
      } else {
        setAdminLoginError('Esta conta não possui permissão de superadmin.');
      }
    } catch {
      setAdminLoginError('Erro ao autenticar. Tente novamente.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  // ==================== AUTH SCREENS ====================

  if (authChecking) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#1e5a8d]/20 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-[#1e5a8d] border-t-transparent rounded-full"></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md w-full text-center px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <Icon name="lock" className="text-red-400 text-3xl" />
          </div>
          <h1 className="text-xl font-light text-gray-900 dark:text-white tracking-tight mb-2">Acesso Restrito</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            As configurações são acessíveis apenas para <strong className="text-gray-900 dark:text-white">superadmin</strong>.
          </p>
          <div className="light:bg-white dark:bg-white/[0.03] rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-5">
            <p className="text-xs text-gray-500 mb-4">Usuário: {user?.email || 'Não identificado'}</p>
            <button onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.05] rounded-xl transition-all flex items-center justify-center gap-2">
              <Icon name="arrow_back" className="text-[18px]" />
              Voltar ao Dashboard
            </button>
          </div>

          {/* Inline superadmin login */}
          <div className="mt-6">
            {!showAdminLogin ? (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-1.5 mx-auto"
              >
                <Icon name="admin_panel_settings" className="text-[14px]" />
                Entrar como Superadmin
              </button>
            ) : (
              <div className="light:bg-white dark:bg-white/[0.03] rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-5 text-left">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon name="shield" className="text-[16px] text-[#1e5a8d]" />
                    Login Superadmin
                  </h2>
                  <button onClick={() => { setShowAdminLogin(false); setAdminLoginError(''); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>
                <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <Icon name="mail" className="text-[16px]" />
                    </div>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="Email do superadmin"
                      required
                      autoComplete="email"
                      className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-[#1e5a8d] focus:ring-1 focus:ring-[#1e5a8d] outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <Icon name="lock" className="text-[16px]" />
                    </div>
                    <input
                      type={adminPasswordVisible ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Senha"
                      required
                      autoComplete="current-password"
                      className="w-full h-10 pl-9 pr-9 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-[#1e5a8d] focus:ring-1 focus:ring-[#1e5a8d] outline-none transition-all"
                    />
                    <button type="button" onClick={() => setAdminPasswordVisible(!adminPasswordVisible)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      <Icon name={adminPasswordVisible ? 'visibility' : 'visibility_off'} className="text-[16px]" />
                    </button>
                  </div>
                  {adminLoginError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                      <Icon name="error" className="text-[14px]" />
                      {adminLoginError}
                    </div>
                  )}
                  <button type="submit" disabled={adminLoginLoading}
                    className="w-full h-10 bg-[#1e5a8d] hover:bg-[#174a75] text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {adminLoginLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Autenticando...
                      </>
                    ) : (
                      <>
                        <Icon name="login" className="text-[16px]" />
                        Autenticar
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== TABS ====================

  const allSections = [
    ...SETORES_CONFIG.map(s => ({ id: s.id, nome: s.nome, icone: s.icone, cor: s.cor })),
    { id: 'admins', nome: 'Administradores', icone: 'admin_panel_settings', cor: '#ef4444' },
    { id: 'evolution', nome: 'WhatsApp Evolution', icone: 'send', cor: '#22c55e' },
    { id: 'manutencao', nome: 'Manutenção', icone: 'build', cor: '#f59e0b' },
  ];

  // ==================== RENDER ====================

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light light:text-gray-900 dark:text-white tracking-tight mb-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e5a8d]/20 flex items-center justify-center">
              <Icon name="settings" className="text-[22px] text-[#1e5a8d]" />
            </div>
            Configurações
          </h1>
          <p className="text-sm light:text-gray-600 dark:text-gray-400 font-light ml-[52px]">
            Gerencie todas as configurações do sistema por setor
          </p>
        </div>
        <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <Icon name="verified" className="text-[14px]" />
          Superadmin
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {allSections.map((section) => (
          <button key={section.id} onClick={() => setSetorAtivo(section.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${setorAtivo === section.id
              ? 'text-white shadow-lg'
              : 'light:bg-white dark:bg-white/[0.03] light:text-gray-600 dark:text-gray-400 light:hover:bg-gray-50 dark:hover:bg-white/[0.05] border light:border-gray-200 dark:border-white/[0.05]'
              }`}
            style={setorAtivo === section.id ? { backgroundColor: section.cor, boxShadow: `0 4px 14px ${section.cor}40` } : {}}>
            <Icon name={section.icone} className="text-[18px]" />
            {section.nome}
          </button>
        ))}
      </div>

      {/* Global messages */}
      {configError && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-sm">
          <Icon name="error" className="text-[18px]" />{configError}
        </div>
      )}
      {configSaved && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 dark:text-green-400 text-sm">
          <Icon name="check_circle" className="text-[18px]" />Configurações salvas com sucesso!
        </div>
      )}

      {/* Config sectors (key-value) */}
      {SETORES_CONFIG.map(setor => setor.id).includes(setorAtivo) && (() => {
        const setor = SETORES_CONFIG.find(s => s.id === setorAtivo)!;
        return (
          <div key={setor.id} className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
            <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${setor.cor}20` }}>
                  <Icon name={setor.icone} className="text-[20px]" style={{ color: setor.cor }} />
                </div>
                <div>
                  <h2 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight">{setor.nome}</h2>
                  <p className="text-xs light:text-gray-500 dark:text-gray-500">{setor.descricao}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#1e5a8d] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {setor.campos.map((campo) => (
                    <div key={campo.chave} className="space-y-1.5">
                      <label className="text-sm font-medium light:text-gray-900 dark:text-white flex items-center gap-2">
                        {campo.label}
                        {campo.sensivel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-normal">SENSÍVEL</span>
                        )}
                      </label>
                      <p className="text-xs light:text-gray-500 dark:text-gray-500 mb-1">{campo.descricao}</p>

                      {campo.tipo === 'info' ? (
                        <div className="px-4 py-3 rounded-xl text-sm light:bg-gray-50 dark:bg-white/[0.02] light:text-gray-500 dark:text-gray-500 border light:border-gray-200 dark:border-white/5 flex items-center gap-2">
                          <Icon name="info" className="text-[16px]" />
                          <span>Configuração gerenciada no servidor (Edge Function env vars) por segurança.</span>
                        </div>
                      ) : campo.tipo === 'color' ? (
                        <div className="flex items-center gap-3">
                          <input type="color" value={configValues[campo.chave] || campo.padrao}
                            onChange={(e) => handleConfigChange(campo.chave, e.target.value)}
                            className="w-12 h-10 rounded-lg cursor-pointer border light:border-gray-300 dark:border-white/10" />
                          <input type="text" value={configValues[campo.chave] || campo.padrao}
                            onChange={(e) => handleConfigChange(campo.chave, e.target.value)}
                            className="flex-1 max-w-xs px-4 py-2.5 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-[#1e5a8d] transition-all font-mono"
                            placeholder={campo.padrao} />
                        </div>
                      ) : campo.tipo === 'password' ? (
                        <div className="relative max-w-lg">
                          <input type={visibleFields.has(campo.chave) ? 'text' : 'password'}
                            value={configValues[campo.chave] || ''}
                            onChange={(e) => handleConfigChange(campo.chave, e.target.value)}
                            className="w-full px-4 py-2.5 pr-12 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-[#1e5a8d] transition-all font-mono"
                            placeholder={campo.padrao || 'Digite o valor...'} />
                          <button type="button" onClick={() => toggleFieldVisibility(campo.chave)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                            <Icon name={visibleFields.has(campo.chave) ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                          </button>
                        </div>
                      ) : campo.tipo === 'textarea' ? (
                        <textarea
                          value={configValues[campo.chave] || campo.padrao || ''}
                          onChange={(e) => handleConfigChange(campo.chave, e.target.value)}
                          rows={6}
                          className="w-full px-4 py-2.5 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-[#1e5a8d] transition-all resize-y font-mono"
                          placeholder={campo.padrao || 'Digite o texto...'} />
                      ) : (
                        <input type={campo.tipo === 'email' ? 'email' : campo.tipo === 'url' ? 'url' : 'text'}
                          value={configValues[campo.chave] || ''}
                          onChange={(e) => handleConfigChange(campo.chave, e.target.value)}
                          className="w-full max-w-lg px-4 py-2.5 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-[#1e5a8d] transition-all"
                          placeholder={campo.padrao || 'Digite o valor...'} />
                      )}
                    </div>
                  ))}

                  <div className="pt-4 border-t light:border-gray-200 dark:border-white/5">
                    <button onClick={handleSaveConfigs} disabled={configSaving}
                      className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
                      style={{ backgroundColor: setor.cor, boxShadow: `0 4px 14px ${setor.cor}40` }}>
                      {configSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="save" className="text-[18px]" />}
                      Salvar Configurações
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Administradores */}
      {setorAtivo === 'admins' && (
        <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
          <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Icon name="admin_panel_settings" className="text-[20px] text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight">Administradores</h2>
                  <p className="text-xs light:text-gray-500 dark:text-gray-500">Gerencie acessos e permissões de administradores</p>
                </div>
              </div>
              <button onClick={() => openAdminModal()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all flex items-center gap-2 shadow-lg"
                style={{ boxShadow: '0 4px 14px #ef444440' }}>
                <Icon name="person_add" className="text-[18px]" />
                Novo Admin
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {adminError && (
              <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-sm">
                <Icon name="error" className="text-[18px]" />{adminError}
              </div>
            )}
            {adminSuccess && (
              <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 dark:text-green-400 text-sm">
                <Icon name="check_circle" className="text-[18px]" />{adminSuccess}
              </div>
            )}

            {adminsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="group" className="text-[48px] text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">Nenhum administrador encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => {
                  const isCurrentUser = admin.id === user?.id;
                  return (
                    <div key={admin.id}
                      className={`rounded-xl border light:border-gray-200 dark:border-white/[0.05] p-4 transition-all ${!admin.ativo ? 'opacity-50' : ''
                        } ${isCurrentUser ? 'light:bg-blue-50 dark:bg-blue-500/5 light:border-blue-200 dark:border-blue-500/20' : 'light:bg-gray-50 dark:bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${admin.role === 'superadmin'
                            ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                            : 'bg-gradient-to-br from-[#1e3a5f] to-[#1e5a8d]'
                            }`}>
                            <span className="text-white font-medium text-sm">
                              {(admin.nome || admin.email).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium light:text-gray-900 dark:text-white truncate">
                                {admin.nome || 'Sem nome'}
                              </p>
                              {isCurrentUser && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">VOCÊ</span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${admin.role === 'superadmin'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-[#1e5a8d]/20 text-[#1e5a8d] dark:text-blue-400'
                                }`}>
                                {admin.role === 'superadmin' ? 'SUPERADMIN' : 'ADMIN'}
                              </span>
                              {!admin.ativo && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 font-medium">INATIVO</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{admin.email}</p>
                            {admin.role === 'admin' && admin.permissions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {admin.permissions.map(p => {
                                  const pag = PAGINAS_PERMISSOES.find(pp => pp.id === p);
                                  return pag ? (
                                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded light:bg-gray-200 dark:bg-white/[0.06] light:text-gray-600 dark:text-gray-400">
                                      {pag.nome}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                            {admin.role === 'superadmin' && (
                              <p className="text-[10px] text-amber-500 mt-1">Acesso total a todas as páginas</p>
                            )}
                          </div>
                        </div>

                        {!isCurrentUser && (
                          <div className="flex items-center gap-1.5 ml-3">
                            <button onClick={() => openAdminModal(admin)} title="Editar"
                              className="p-2 rounded-lg light:hover:bg-gray-200 dark:hover:bg-white/[0.05] text-gray-500 hover:text-[#1e5a8d] transition-all">
                              <Icon name="edit" className="text-[18px]" />
                            </button>
                            <button onClick={() => handleToggleAdmin(admin)} title={admin.ativo ? 'Desativar' : 'Ativar'}
                              className={`p-2 rounded-lg transition-all ${admin.ativo
                                ? 'light:hover:bg-amber-100 dark:hover:bg-amber-500/10 text-gray-500 hover:text-amber-600'
                                : 'light:hover:bg-green-100 dark:hover:bg-green-500/10 text-gray-500 hover:text-green-600'
                                }`}>
                              <Icon name={admin.ativo ? 'block' : 'check_circle'} className="text-[18px]" />
                            </button>
                            <button onClick={() => handleDeleteAdmin(admin)} title="Excluir"
                              className="p-2 rounded-lg light:hover:bg-red-100 dark:hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-all">
                              <Icon name="delete" className="text-[18px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="light:bg-gray-50 dark:bg-white/[0.02] rounded-xl p-4 border light:border-gray-200 dark:border-white/5">
              <h4 className="text-sm font-medium light:text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Icon name="info" className="text-[16px] text-red-500" />Como funciona
              </h4>
              <ul className="text-xs light:text-gray-600 dark:text-gray-500 space-y-1.5 ml-6">
                <li className="flex items-start gap-2"><span className="text-red-500">1.</span><span><strong>Superadmin</strong> tem acesso total a todas as páginas e configurações</span></li>
                <li className="flex items-start gap-2"><span className="text-red-500">2.</span><span><strong>Admin</strong> tem acesso apenas às páginas selecionadas nas permissões</span></li>
                <li className="flex items-start gap-2"><span className="text-red-500">3.</span><span>Páginas como <strong>Configurações</strong> e <strong>SuperAdmin</strong> são exclusivas do superadmin</span></li>
                <li className="flex items-start gap-2"><span className="text-red-500">4.</span><span>Admins desativados não conseguem fazer login no sistema</span></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdminModal(false)} />
          <div className="relative w-full max-w-lg light:bg-white dark:bg-[#141a22] rounded-2xl border light:border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium light:text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon name={editingAdmin ? 'edit' : 'person_add'} className="text-[20px] text-red-500" />
                  {editingAdmin ? 'Editar Admin' : 'Novo Admin'}
                </h3>
                <button onClick={() => setShowAdminModal(false)} className="p-2 rounded-lg light:hover:bg-gray-100 dark:hover:bg-white/[0.05] text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all">
                  <Icon name="close" className="text-[20px]" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {!editingAdmin && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium light:text-gray-900 dark:text-white">Email *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <Icon name="mail" className="text-[16px]" />
                      </div>
                      <input type="email" value={adminForm.email}
                        onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="admin@exemplo.com" required
                        className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border light:border-gray-300 dark:border-white/10 light:bg-gray-50 dark:bg-white/[0.03] light:text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium light:text-gray-900 dark:text-white">Senha *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <Icon name="lock" className="text-[16px]" />
                      </div>
                      <input type={adminFormPasswordVisible ? 'text' : 'password'} value={adminForm.password}
                        onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres" required
                        className="w-full h-11 pl-9 pr-10 text-sm rounded-xl border light:border-gray-300 dark:border-white/10 light:bg-gray-50 dark:bg-white/[0.03] light:text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" />
                      <button type="button" onClick={() => setAdminFormPasswordVisible(!adminFormPasswordVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <Icon name={adminFormPasswordVisible ? 'visibility_off' : 'visibility'} className="text-[16px]" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium light:text-gray-900 dark:text-white">Nome</label>
                  <input type="text" value={adminForm.nome}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome completo"
                    className="w-full h-11 px-4 text-sm rounded-xl border light:border-gray-300 dark:border-white/10 light:bg-gray-50 dark:bg-white/[0.03] light:text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium light:text-gray-900 dark:text-white">Telefone</label>
                  <input type="tel" value={adminForm.telefone}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full h-11 px-4 text-sm rounded-xl border light:border-gray-300 dark:border-white/10 light:bg-gray-50 dark:bg-white/[0.03] light:text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium light:text-gray-900 dark:text-white">Tipo de Acesso</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAdminForm(prev => ({ ...prev, role: 'admin' }))}
                    className={`p-3 rounded-xl border text-left transition-all ${adminForm.role === 'admin'
                      ? 'border-red-500 light:bg-red-50 dark:bg-red-500/10'
                      : 'light:border-gray-200 dark:border-white/10 light:hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                      }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="person" className={`text-[18px] ${adminForm.role === 'admin' ? 'text-red-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${adminForm.role === 'admin' ? 'light:text-gray-900 dark:text-white' : 'text-gray-500'}`}>Admin</span>
                    </div>
                    <p className="text-[11px] text-gray-500">Acesso limitado às páginas selecionadas</p>
                  </button>
                  <button onClick={() => setAdminForm(prev => ({ ...prev, role: 'superadmin' }))}
                    className={`p-3 rounded-xl border text-left transition-all ${adminForm.role === 'superadmin'
                      ? 'border-amber-500 light:bg-amber-50 dark:bg-amber-500/10'
                      : 'light:border-gray-200 dark:border-white/10 light:hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                      }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="shield" className={`text-[18px] ${adminForm.role === 'superadmin' ? 'text-amber-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${adminForm.role === 'superadmin' ? 'light:text-gray-900 dark:text-white' : 'text-gray-500'}`}>Superadmin</span>
                    </div>
                    <p className="text-[11px] text-gray-500">Acesso total ao sistema</p>
                  </button>
                </div>
              </div>

              {adminForm.role === 'admin' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium light:text-gray-900 dark:text-white">Permissões de Páginas</label>
                    <div className="flex gap-2">
                      <button onClick={() => setAdminForm(prev => ({ ...prev, permissions: PAGINAS_PERMISSOES.map(p => p.id) as PaginaPermissao[] }))}
                        className="text-[11px] text-red-500 hover:text-red-600 transition-colors">Marcar todas</button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button onClick={() => setAdminForm(prev => ({ ...prev, permissions: [] }))}
                        className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Desmarcar</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PAGINAS_PERMISSOES.map((pag) => (
                      <button key={pag.id} onClick={() => togglePermission(pag.id as PaginaPermissao)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${adminForm.permissions.includes(pag.id as PaginaPermissao)
                          ? 'border-red-500/50 light:bg-red-50 dark:bg-red-500/10'
                          : 'light:border-gray-200 dark:border-white/[0.05] light:hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                          }`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${adminForm.permissions.includes(pag.id as PaginaPermissao)
                          ? 'bg-red-500 border-red-500'
                          : 'light:border-gray-300 dark:border-white/20'
                          }`}>
                          {adminForm.permissions.includes(pag.id as PaginaPermissao) && (
                            <Icon name="check" className="text-[12px] text-white" />
                          )}
                        </div>
                        <Icon name={pag.icone} className={`text-[16px] ${adminForm.permissions.includes(pag.id as PaginaPermissao) ? 'text-red-500' : 'text-gray-400'
                          }`} />
                        <span className={`text-sm ${adminForm.permissions.includes(pag.id as PaginaPermissao) ? 'light:text-gray-900 dark:text-white' : 'text-gray-500'
                          }`}>{pag.nome}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium light:bg-gray-100 dark:bg-white/[0.05] light:text-gray-700 dark:text-gray-300 light:hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-all">
                  Cancelar
                </button>
                <button onClick={handleAdminFormSubmit} disabled={adminFormLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {adminFormLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name={editingAdmin ? 'save' : 'person_add'} className="text-[18px]" />
                  )}
                  {editingAdmin ? 'Salvar Alterações' : 'Criar Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evolution API / WhatsApp */}
      {setorAtivo === 'evolution' && (
        <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b dark:border-white/5 light:border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Icon name="send" className="text-[20px] text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight">WhatsApp Evolution API</h2>
                  <p className="text-xs light:text-gray-500 dark:text-gray-500">Envio automático de mensagens de boas-vindas</p>
                </div>
              </div>
              {evolutionConfig.status === 'connected' ? (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></span>Conectado
                </span>
              ) : evolutionConfig.status === 'qr_pending' ? (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>Aguardando
                </span>
              ) : (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>Desconectado
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {evolutionError && (
              <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-sm">
                <Icon name="error" className="text-[18px]" />{evolutionError}
              </div>
            )}
            {evolutionSuccess && (
              <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 dark:text-green-400 text-sm">
                <Icon name="check_circle" className="text-[18px]" />{evolutionSuccess}
              </div>
            )}

            {/* Server config */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-white light:text-gray-900 flex items-center gap-2">
                  <Icon name="dns" className="text-[16px] text-green-500" />URL do Servidor
                </label>
                <input type="url" value={evolutionConfig.servidor_url || ''}
                  onChange={(e) => handleEvolutionConfigChange('servidor_url', e.target.value)}
                  placeholder="https://evolution.seudominio.com"
                  className="w-full max-w-lg px-4 py-3 rounded-xl text-sm dark:bg-white/5 light:bg-gray-50 dark:text-white light:text-gray-900 border dark:border-white/10 light:border-gray-300 focus:outline-none focus:border-green-500 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-white light:text-gray-900 flex items-center gap-2">
                  <Icon name="vpn_key" className="text-[16px] text-green-500" />API Key
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-normal">SENSÍVEL</span>
                </label>
                <div className="relative max-w-lg">
                  <input type={visibleFields.has('evolution_api_key') ? 'text' : 'password'}
                    value={evolutionConfig.api_key || ''}
                    onChange={(e) => handleEvolutionConfigChange('api_key', e.target.value)}
                    placeholder="Sua API Key"
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm dark:bg-white/5 light:bg-gray-50 dark:text-white light:text-gray-900 border dark:border-white/10 light:border-gray-300 focus:outline-none focus:border-green-500 transition-all font-mono" />
                  <button type="button" onClick={() => toggleFieldVisibility('evolution_api_key')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                    <Icon name={visibleFields.has('evolution_api_key') ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-white light:text-gray-900 flex items-center gap-2">
                  <Icon name="smartphone" className="text-[16px] text-green-500" />Nome da Instância
                </label>
                <input type="text" value={evolutionConfig.instance_name || ''}
                  onChange={(e) => handleEvolutionConfigChange('instance_name', e.target.value)}
                  placeholder="ex: campanha-2026" disabled={evolutionConfig.status === 'connected'}
                  className="w-full max-w-md px-4 py-3 rounded-xl text-sm dark:bg-white/5 light:bg-gray-50 dark:text-white light:text-gray-900 border dark:border-white/10 light:border-gray-300 focus:outline-none focus:border-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                <p className="text-xs light:text-gray-500 dark:text-gray-500">Apenas letras minúsculas, números e hífens.</p>
              </div>

              <button onClick={handleSaveEvolutionConfig} disabled={evolutionLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-all flex items-center gap-2 disabled:opacity-50">
                <Icon name="save" className="text-[18px]" />Salvar Configuração
              </button>
            </div>

            <div className="border-t light:border-gray-200 dark:border-white/5 pt-6">
              <h3 className="text-sm font-medium light:text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Icon name="power_settings_new" className="text-[18px] text-green-500" />Status da Conexão
              </h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleCheckStatus} disabled={evolutionLoading || !evolutionConfig.instance_name}
                  className="px-5 py-3 rounded-xl text-sm font-medium light:bg-gray-100 dark:bg-white/5 light:hover:bg-gray-200 dark:hover:bg-white/10 light:text-gray-900 dark:text-white transition-all flex items-center gap-2 disabled:opacity-50">
                  {evolutionLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="refresh" className="text-[18px]" />}
                  Verificar Conexão
                </button>
              </div>
            </div>

            {evolutionConfig.status === 'connected' && (
              <div className="light:bg-green-50 dark:bg-green-500/10 border light:border-green-200 dark:border-green-500/20 rounded-xl p-4">
                <h4 className="text-sm font-medium light:text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                  <Icon name="send" className="text-[18px]" />Testar Envio
                </h4>
                <div className="flex items-center gap-3">
                  <input type="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="(85) 99999-9999"
                    className="flex-1 max-w-xs px-4 py-3 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-green-500 transition-all" />
                  <button onClick={handleTestMessage} disabled={testingMessage || !testPhone}
                    className="px-5 py-3 rounded-xl text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-all flex items-center gap-2 disabled:opacity-50">
                    {testingMessage ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="send" className="text-[18px]" />}
                    Enviar
                  </button>
                </div>
              </div>
            )}

            <div className="dark:bg-white/[0.02] light:bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium dark:text-white light:text-gray-900 mb-3 flex items-center gap-2">
                <Icon name="info" className="text-[16px] text-green-500" />Como funciona
              </h4>
              <ul className="text-xs light:text-gray-600 dark:text-gray-500 space-y-2 ml-6">
                <li className="flex items-start gap-2"><span className="text-green-500">1.</span><span>Configure URL do servidor, API Key e Nome da Instância, depois salve</span></li>
                <li className="flex items-start gap-2"><span className="text-green-500">2.</span><span>Clique em "Verificar Conexão" para confirmar que a instância está ativa</span></li>
                <li className="flex items-start gap-2"><span className="text-green-500">3.</span><span>Ao criar <strong>Liderança</strong>, <strong>Coordenador</strong> ou <strong>Tarefa</strong>, a notificação é enviada automaticamente</span></li>
                <li className="flex items-start gap-2"><span className="text-green-500">4.</span><span>Personalize as mensagens em <strong>WhatsApp & Notificações</strong></span></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Manutenção */}
      {setorAtivo === 'manutencao' && (
        <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
          <div className="p-6 border-b light:border-gray-200 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Icon name="build" className="text-[20px] text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight">Manutenção</h2>
                <p className="text-xs light:text-gray-500 dark:text-gray-500">Ferramentas de manutenção e correção de dados</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="map" className="text-[20px] text-amber-500" />
                <label className="text-sm font-medium light:text-gray-900 dark:text-white">Corrigir Coordenadas dos Cadastros</label>
              </div>
              <p className="text-xs light:text-gray-500 dark:text-gray-500 ml-7">Re-geocodifica usando BrasilAPI (dados oficiais dos Correios).</p>

              {!corrigindoCoordenadas ? (
                <div className="ml-7 space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs light:text-gray-500 dark:text-gray-400 min-w-[80px]">Processar:</label>
                    <select value={equipeSelecionada} onChange={(e) => setEquipeSelecionada(e.target.value)}
                      className="flex-1 max-w-sm px-4 py-2.5 rounded-xl text-sm light:bg-gray-50 dark:bg-white/5 light:text-gray-900 dark:text-white border light:border-gray-300 dark:border-white/10 focus:outline-none focus:border-amber-500 transition-all">
                      <option value="todas">Todas as Equipes (pode demorar!)</option>
                      {equipes.map(equipe => (<option key={equipe.id} value={equipe.id}>{equipe.nome}</option>))}
                    </select>
                  </div>
                  <button onClick={corrigirCoordenadasCadastros}
                    className={`px-5 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${equipeSelecionada === 'todas' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                    <Icon name="refresh" className="text-[18px]" />
                    {equipeSelecionada === 'todas' ? 'Corrigir TODAS as Coordenadas' : 'Corrigir desta Equipe'}
                  </button>
                  {equipeSelecionada === 'todas' && (
                    <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-xs">
                      <Icon name="warning" className="text-[16px]" /><span>Pode levar muito tempo. Recomendamos por equipe.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="ml-7 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs light:text-gray-600 dark:text-gray-400 mb-1">
                        <span>Processando...</span><span>{progressoCorrecao.atual} / {progressoCorrecao.total}</span>
                      </div>
                      <div className="h-2 light:bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${progressoCorrecao.total > 0 ? (progressoCorrecao.atual / progressoCorrecao.total) * 100 : 0}%` }}></div>
                      </div>
                      <div className="text-xs light:text-gray-500 dark:text-gray-500 mt-1">{progressoCorrecao.corrigidos} corrigidas</div>
                    </div>
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              )}

              <div className="ml-7 light:bg-amber-50 dark:bg-amber-500/10 border light:border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
                <h4 className="text-sm font-medium light:text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                  <Icon name="info" className="text-[16px]" />Sobre esta operação
                </h4>
                <ul className="text-xs light:text-gray-700 dark:text-gray-400 space-y-1.5 ml-6">
                  <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span>BrasilAPI (Correios) como fonte principal</span></li>
                  <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span>Valida cidade/estado para evitar erros</span></li>
                  <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span>Pode levar alguns minutos</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security footer */}
      <div className="light:bg-gray-50 dark:bg-white/[0.02] rounded-xl p-4 border light:border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2 text-xs light:text-gray-500 dark:text-gray-500">
          <Icon name="security" className="text-[14px] text-green-500" />
          <span>Protegido por autenticação superadmin. Dados sanitizados e armazenados com segurança via Supabase RLS.</span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
