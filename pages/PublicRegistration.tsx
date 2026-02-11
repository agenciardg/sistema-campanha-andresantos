import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { liderancasService, coordenadoresService, equipesService, organizacoesService, cadastrosService } from '../lib/supabase';
import { geocodificarEndereco } from '../lib/geocoding';
import { sanitizeRegistrationForm } from '../lib/security';
import { validateRegistrationForm } from '../lib/validation';
import logger from '../lib/logger';
import { useConfig } from '../contexts/ConfigContext';

interface FormData {
  nomeCompleto: string;
  dataNascimento: string;
  whatsapp: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  aceitaPolitica: boolean;
}

interface ResponsavelData {
  id: string;
  nome: string;
  tipo: 'lideranca' | 'coordenador';
  equipeId: string | null;
  equipeNome: string | null;
  organizacaoId: string | null;
  organizacaoNome: string | null;
}

const PublicRegistration: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const { getConfigValue } = useConfig();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPolitica, setShowPolitica] = useState(false);

  const [responsavel, setResponsavel] = useState<ResponsavelData | null>(null);

  const [formData, setFormData] = useState<FormData>({
    nomeCompleto: '',
    dataNascimento: '',
    whatsapp: '',
    email: '',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    aceitaPolitica: false,
  });

  // Buscar dados do responsável pelo código
  useEffect(() => {
    const fetchResponsavel = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!codigo) {
          setError('Código de cadastro não fornecido.');
          setIsLoading(false);
          return;
        }

        // Tentar buscar liderança primeiro
        const lideranca = await liderancasService.buscarPorCodigo(codigo);

        if (lideranca) {
          // Buscar equipe da liderança
          const equipe = lideranca.equipe_id ? await equipesService.buscarPorId(lideranca.equipe_id) : null;

          // Buscar organização da liderança
          const organizacao = lideranca.organizacao_id ? await organizacoesService.buscarPorId(lideranca.organizacao_id) : null;

          setResponsavel({
            id: lideranca.id,
            nome: lideranca.nome,
            tipo: 'lideranca',
            equipeId: lideranca.equipe_id,
            equipeNome: equipe?.nome || null,
            organizacaoId: lideranca.organizacao_id,
            organizacaoNome: organizacao?.nome || null,
          });
        } else {
          // Se não encontrou liderança, tentar buscar coordenador pelo código único
          const coordenador = await coordenadoresService.buscarPorCodigo(codigo);

          if (coordenador) {
            // Buscar organização do coordenador
            const organizacao = coordenador.organizacao_id ? await organizacoesService.buscarPorId(coordenador.organizacao_id) : null;

            setResponsavel({
              id: coordenador.id,
              nome: coordenador.nome,
              tipo: 'coordenador',
              equipeId: null,
              equipeNome: null,
              organizacaoId: coordenador.organizacao_id,
              organizacaoNome: organizacao?.nome || null,
            });
          } else {
            setError('Código de cadastro inválido ou não encontrado.');
          }
        }
      } catch (err) {
        console.error('Erro ao buscar responsável:', err);
        setError('Erro ao carregar dados. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResponsavel();
  }, [codigo]);

  // Máscara de telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  // Máscara de CEP
  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  // Buscar endereço pelo CEP - Google API primeiro, BrasilAPI fallback
  const buscarCep = async (cepValue?: string, showAlerts: boolean = true): Promise<boolean> => {
    const cepLimpo = (cepValue || formData.cep).replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      if (showAlerts) alert('CEP inválido. Digite 8 números.');
      return false;
    }

    setIsCepLoading(true);
    try {
      // 1. GOOGLE API (via Edge Function) - Principal
      console.log('📍 Buscando CEP via Google API...');
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const googleResponse = await fetch(`${SUPABASE_URL}/functions/v1/geocoding-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buscarCep', cep: cepLimpo }),
        signal: AbortSignal.timeout(10000)
      });

      if (googleResponse.ok) {
        const data = await googleResponse.json();
        if (data.success && (data.street || data.city)) {
          console.log('✅ Google API encontrou:', data.formattedAddress);
          setFormData(prev => ({
            ...prev,
            endereco: data.street || '',
            bairro: data.neighborhood || '',
            cidade: data.city || '',
            estado: data.state || '',
          }));
          return true;
        }
      }
      console.warn('⚠️ Google API não encontrou, tentando BrasilAPI...');

      // 2. BRASILAPI - Fallback
      let response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`, {
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`, {
          signal: AbortSignal.timeout(8000)
        });
      }

      if (response.ok) {
        const data = await response.json();
        console.log('✅ BrasilAPI encontrou:', data.street, data.city);
        setFormData(prev => ({
          ...prev,
          endereco: data.street || '',
          bairro: data.neighborhood || '',
          cidade: data.city || '',
          estado: data.state || '',
        }));
        return true;
      }

      // 3. VIACEP - Último fallback
      console.warn('⚠️ BrasilAPI falhou, tentando ViaCEP...');
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
        signal: AbortSignal.timeout(8000)
      });

      if (viaCepResponse.ok) {
        const data = await viaCepResponse.json();

        if (data.erro) {
          if (showAlerts) {
            alert('⚠️ CEP não encontrado!\n\nEste CEP não foi localizado.\n\nVocê pode preencher o endereço MANUALMENTE nos campos abaixo.');
          }
          return false;
        }

        console.log('✅ ViaCEP encontrou:', data.logradouro, data.localidade);
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        }));
        return true;
      }

      if (showAlerts) {
        alert('⚠️ CEP não encontrado!\n\nNão foi possível localizar este CEP em nenhuma API.\n\nVocê pode preencher o endereço MANUALMENTE.');
      }
      return false;
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
      if (showAlerts) {
        alert('❌ Erro ao buscar CEP!\n\nOcorreu um erro na busca. Verifique sua conexão e tente novamente.');
      }
      return false;
    } finally {
      setIsCepLoading(false);
    }
  };

  // Atualizar campo do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'whatsapp') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else if (name === 'cep') {
      const formattedCep = formatCep(value);
      setFormData(prev => ({ ...prev, [name]: formattedCep }));
      // Buscar endereço automaticamente quando o CEP tiver 8 dígitos
      const cepLimpo = value.replace(/\D/g, '');
      if (cepLimpo.length === 8) {
        buscarCep(cepLimpo, false);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Log de tentativa de cadastro
    logger.info('Tentativa de cadastro público', {
      responsavel: responsavel?.nome,
      tipo: responsavel?.tipo,
    });

    // VALIDAÇÃO DETALHADA - Mostrar campos faltando
    const camposFaltando: string[] = [];

    // Dados pessoais
    if (!formData.nomeCompleto.trim()) {
      camposFaltando.push('• Nome Completo');
    }
    if (!formData.dataNascimento) {
      camposFaltando.push('• Data de Nascimento');
    }
    if (!formData.whatsapp || formData.whatsapp.replace(/\D/g, '').length < 10) {
      camposFaltando.push('• WhatsApp (número completo com DDD)');
    }
    if (!formData.email || !formData.email.includes('@')) {
      camposFaltando.push('• E-mail válido');
    }

    // Endereço
    if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
      camposFaltando.push('• CEP (8 dígitos)');
    }
    if (!formData.endereco.trim()) {
      camposFaltando.push('• Logradouro/Rua');
    }
    if (!formData.cidade.trim()) {
      camposFaltando.push('• Cidade');
    }
    if (!formData.estado.trim()) {
      camposFaltando.push('• Estado');
    }

    // Consentimento
    if (!formData.aceitaPolitica) {
      camposFaltando.push('• Aceitar a Política de Privacidade');
    }

    // Se houver campos faltando, mostrar pop-up
    if (camposFaltando.length > 0) {
      alert(
        '⚠️ Complete os campos obrigatórios!\n\n' +
        'Para concluir seu cadastro, preencha:\n\n' +
        camposFaltando.join('\n')
      );
      logger.warn('Campos obrigatórios faltando', { campos: camposFaltando });
      return;
    }

    // VALIDAÇÕES ADICIONAIS (formato)
    const validationErrors = validateRegistrationForm({
      nome: formData.nomeCompleto,
      email: formData.email,
      telefone: formData.whatsapp,
      data_nascimento: formData.dataNascimento,
      cep: formData.cep,
      cidade: formData.cidade,
      estado: formData.estado,
    });

    if (validationErrors.length > 0) {
      const errorMessage = '❌ Corrija os seguintes erros:\n\n' + validationErrors.join('\n');
      alert(errorMessage);
      logger.warn('Validação falhou no cadastro público', { errors: validationErrors });
      return;
    }

    setIsSubmitting(true);
    try {
      // SANITIZAR TODOS OS INPUTS ANTES DE PROCESSAR
      const sanitizedData = sanitizeRegistrationForm({
        nome: formData.nomeCompleto,
        email: formData.email,
        telefone: formData.whatsapp,
        data_nascimento: formData.dataNascimento,
        cep: formData.cep,
        endereco: formData.endereco,
        numero: formData.numero,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
      });

      logger.debug('Dados sanitizados para cadastro', { sanitizedData });
      // Geocodificar endereço usando serviço centralizado
      logger.geocoding('Geocodificando endereço antes de salvar');
      const resultado = await geocodificarEndereco({
        cep: sanitizedData.cep!,
        rua: sanitizedData.endereco!,
        numero: sanitizedData.numero,
        bairro: sanitizedData.bairro,
        cidade: sanitizedData.cidade!,
        estado: sanitizedData.estado!
      });

      if (!resultado.sucesso || !resultado.coordenadas) {
        alert('❌ Não foi possível obter as coordenadas!\n\nNão conseguimos localizar este endereço no mapa. Verifique se o CEP e endereço estão corretos.');
        logger.error('Geocodificação falhou no cadastro público', { endereco: sanitizedData });
        setIsSubmitting(false);
        return;
      }

      const { latitude, longitude } = resultado.coordenadas;
      logger.info('Coordenadas obtidas com sucesso', { latitude, longitude, fonte: resultado.coordenadas.fonte });

      // Salvar cadastro no Supabase com DADOS SANITIZADOS
      await cadastrosService.criarPublico({
        nome: sanitizedData.nome!,
        data_nascimento: sanitizedData.data_nascimento!,
        telefone: sanitizedData.telefone!,
        email: sanitizedData.email!,
        cep: sanitizedData.cep!,
        endereco: sanitizedData.endereco!,
        numero: sanitizedData.numero,
        bairro: sanitizedData.bairro,
        cidade: sanitizedData.cidade!,
        estado: sanitizedData.estado!,
        latitude,
        longitude,
        aceite_politica: formData.aceitaPolitica,
        origem: 'link',
        // Vincular ao responsável correto
        lideranca_id: responsavel?.tipo === 'lideranca' ? responsavel.id : null,
        coordenador_id: responsavel?.tipo === 'coordenador' ? responsavel.id : null,
      });

      logger.info('Cadastro público realizado com sucesso', {
        responsavel: responsavel?.nome,
        tipo: responsavel?.tipo,
      });

      setSubmitSuccess(true);
    } catch (err) {
      logger.error('Erro ao salvar cadastro público', err);
      alert('Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== TELA DE CARREGAMENTO ====================
  if (isLoading) {
    return (
      <div className="font-display min-h-screen flex items-center justify-center bg-gradient-to-b from-[#e3f0fb] to-[#f5faff]">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-[#3a9ad9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#3a6b8c] text-lg font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  // ==================== TELA DE ERRO ====================
  if (error || !responsavel) {
    return (
      <div className="font-display min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#e3f0fb] to-[#f5faff]">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-10 border border-[#d6e8f5]">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="error" className="text-[48px] text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a3a52] mb-3">Link Inválido</h1>
          <p className="text-[#5a7d95] text-base leading-relaxed">{error || 'Este link de cadastro não é válido ou expirou.'}</p>
        </div>
      </div>
    );
  }

  // ==================== TELA DE SUCESSO ====================
  if (submitSuccess) {
    return (
      <div className="font-display min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#e3f0fb] to-[#f5faff]">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-10 border border-[#d6e8f5]">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Icon name="check_circle" className="text-[48px] text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a3a52] mb-3">Cadastro Realizado!</h1>
          <p className="text-[#5a7d95] mb-8 text-base leading-relaxed">Obrigado por se cadastrar. Seus dados foram registrados com sucesso.</p>
          <div className="bg-[#f0f7fd] rounded-2xl p-5 border border-[#d6e8f5]">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="verified" className="text-[20px] text-[#3a9ad9]" />
              <p className="text-xs text-[#5a7d95]">Responsável pelo cadastro:</p>
            </div>
            <p className="text-[#1a3a52] font-semibold text-lg">{responsavel.nome}</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== FORMULÁRIO PRINCIPAL ====================
  return (
    <div className="font-display min-h-screen bg-gradient-to-b from-[#e3f0fb] via-[#eef6fc] to-[#f5faff] py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[640px] mx-auto flex flex-col gap-6">

        {/* ====== HERO / CABEÇALHO ====== */}
        <div className="relative bg-white rounded-3xl shadow-lg border border-[#d6e8f5] overflow-hidden">
          {/* Faixa decorativa superior */}
          <div className="h-2 bg-gradient-to-r from-[#3a9ad9] via-[#5bb8f0] to-[#3a9ad9]"></div>

          <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
            {/* Logo */}
            <div className="mb-5">
              <img
                src="/images/campanha/logo.png"
                alt="Logo da Campanha"
                className="h-24 sm:h-28 md:h-36 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              {/* Fallback */}
              <div className="hidden w-20 h-20 rounded-full bg-gradient-to-br from-[#3a9ad9] to-[#5bb8f0] items-center justify-center shadow-lg">
                <Icon name="how_to_reg" className="text-[40px] text-white" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a3a52] tracking-tight">
              Cadastro de Apoiadores
            </h1>
            <p className="text-[#5a7d95] text-sm sm:text-base mt-2 max-w-sm leading-relaxed">
              Faça parte do nosso movimento
            </p>
          </div>

          {/* Badge do Responsável */}
          <div className="bg-[#f0f7fd] border-t border-[#d6e8f5] px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#3a9ad9]/15 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="person" className="text-[18px] text-[#3a9ad9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#5a7d95] uppercase tracking-wider font-medium">
                  {responsavel.tipo === 'lideranca' ? 'Liderança Responsável' : 'Coordenador Responsável'}
                </p>
                <p className="text-[#1a3a52] text-sm font-semibold truncate">{responsavel.nome}</p>
                {responsavel.equipeNome && (
                  <p className="text-[11px] text-[#5a7d95] truncate">Equipe: {responsavel.equipeNome}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ====== FORMULÁRIO ====== */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* SEÇÃO 1: DADOS PESSOAIS */}
          <div className="bg-white rounded-2xl shadow-md border border-[#d6e8f5] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#3a9ad9] to-[#5bb8f0] px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Icon name="badge" className="text-[20px] text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Dados Pessoais</h2>
                <p className="text-white/70 text-xs">Informações básicas do apoiador</p>
              </div>
            </div>

            {/* Campos */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Nome Completo */}
              <div className="space-y-1.5">
                <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="nomeCompleto">
                  Nome Completo <span className="text-red-400 text-xs">*</span>
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Icon name="person" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                  </div>
                  <input
                    className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                    id="nomeCompleto"
                    name="nomeCompleto"
                    value={formData.nomeCompleto}
                    onChange={handleChange}
                    placeholder="Digite seu nome completo"
                    type="text"
                    required
                  />
                </div>
              </div>

              {/* Data de Nascimento e WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="dataNascimento">
                    Data de Nascimento <span className="text-red-400 text-xs">*</span>
                  </label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <Icon name="cake" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                    </div>
                    <input
                      className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                      id="dataNascimento"
                      name="dataNascimento"
                      value={formData.dataNascimento}
                      onChange={handleChange}
                      type="date"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="whatsapp">
                    WhatsApp <span className="text-red-400 text-xs">*</span>
                  </label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <Icon name="phone" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                    </div>
                    <input
                      className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                      id="whatsapp"
                      name="whatsapp"
                      value={formData.whatsapp}
                      onChange={handleChange}
                      placeholder="(11) 99999-9999"
                      type="tel"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="email">
                  Email <span className="text-red-400 text-xs">*</span>
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Icon name="email" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                  </div>
                  <input
                    className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="seuemail@exemplo.com"
                    type="email"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: ENDEREÇO */}
          <div className="bg-white rounded-2xl shadow-md border border-[#d6e8f5] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#3a9ad9] to-[#5bb8f0] px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Icon name="location_on" className="text-[20px] text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Endereço</h2>
                <p className="text-white/70 text-xs">Localização para mapeamento</p>
              </div>
            </div>

            {/* Campos */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* CEP e Número */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="cep">
                    CEP <span className="text-red-400 text-xs">*</span>
                  </label>
                  <div className="flex items-stretch group/cep">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                        <Icon name="pin_drop" className="text-[20px] text-[#9dc4de] group-focus-within/cep:text-[#3a9ad9] transition-colors" />
                      </div>
                      <input
                        className="w-full rounded-l-xl rounded-r-none text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] border-r-0 focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                        id="cep"
                        name="cep"
                        value={formData.cep}
                        onChange={handleChange}
                        placeholder="00000-000"
                        type="text"
                        maxLength={9}
                        required
                      />
                    </div>
                    <button
                      className="flex items-center justify-center px-5 bg-[#3a9ad9] hover:bg-[#2d87c4] text-white rounded-r-xl border border-[#3a9ad9] transition-all cursor-pointer disabled:opacity-50 active:scale-95 disabled:cursor-not-allowed"
                      type="button"
                      onClick={() => buscarCep()}
                      disabled={isCepLoading}
                    >
                      {isCepLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Icon name="search" className="text-[22px]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="numero">
                    Número
                  </label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <Icon name="tag" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                    </div>
                    <input
                      className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                      id="numero"
                      name="numero"
                      value={formData.numero}
                      onChange={handleChange}
                      placeholder="123"
                      type="text"
                    />
                  </div>
                </div>
              </div>

              {/* Logradouro */}
              <div className="space-y-1.5">
                <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="endereco">
                  Logradouro
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Icon name="signpost" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                  </div>
                  <input
                    className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                    id="endereco"
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleChange}
                    placeholder="Preencha ou busque pelo CEP"
                    type="text"
                  />
                </div>
              </div>

              {/* Bairro, Cidade, Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-5">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="bairro">
                    Bairro
                  </label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <Icon name="home_work" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                    </div>
                    <input
                      className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                      id="bairro"
                      name="bairro"
                      value={formData.bairro}
                      onChange={handleChange}
                      placeholder="Bairro"
                      type="text"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 lg:col-span-4">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="cidade">
                    Cidade
                  </label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <Icon name="location_city" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                    </div>
                    <input
                      className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none"
                      id="cidade"
                      name="cidade"
                      value={formData.cidade}
                      onChange={handleChange}
                      placeholder="Cidade"
                      type="text"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 lg:col-span-3">
                  <label className="text-[#1a3a52] text-sm font-semibold flex items-center gap-1" htmlFor="estado">
                    Estado
                  </label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                      <Icon name="map" className="text-[20px] text-[#9dc4de] group-focus-within/input:text-[#3a9ad9] transition-colors" />
                    </div>
                    <input
                      className="w-full rounded-xl text-[#1a3a52] bg-[#f5faff] border border-[#d6e8f5] focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 focus:bg-white h-12 pl-11 pr-4 text-sm placeholder:text-[#9dc4de] transition-all outline-none uppercase"
                      id="estado"
                      name="estado"
                      value={formData.estado}
                      onChange={handleChange}
                      placeholder="UF"
                      type="text"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: CONFIRMAÇÃO E ENVIO */}
          <div className="bg-white rounded-2xl shadow-md border border-[#d6e8f5] overflow-hidden">
            <div className="p-5 sm:p-6 space-y-5">
              {/* Política de Privacidade */}
              <div className="bg-[#f0f7fd] border border-[#d6e8f5] rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      name="aceitaPolitica"
                      checked={formData.aceitaPolitica}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-2 border-[#9dc4de] bg-white text-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/30 focus:ring-offset-0 cursor-pointer transition-all hover:border-[#3a9ad9]"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name="policy" className="text-[18px] text-[#3a9ad9]" />
                      <span className="text-[#1a3a52] font-semibold text-sm">Consentimento de Dados</span>
                    </div>
                    <p className="text-sm text-[#5a7d95] leading-relaxed">
                      Li e aceito a{' '}
                      <button
                        type="button"
                        onClick={() => setShowPolitica(true)}
                        className="text-[#3a9ad9] hover:text-[#2d87c4] hover:underline font-semibold transition-colors inline-flex items-center gap-0.5"
                      >
                        Política de Privacidade
                        <Icon name="open_in_new" className="text-[13px]" />
                      </button>
                      {' '}e autorizo o uso dos meus dados para fins de comunicação da campanha.
                      <span className="text-red-400 font-bold"> *</span>
                    </p>
                  </div>
                </label>
              </div>

              {/* Botão Cadastrar */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#3a9ad9] to-[#5bb8f0] hover:from-[#2d87c4] hover:to-[#4aa8e0] text-white font-bold h-14 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-base"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Cadastrando...</span>
                  </>
                ) : (
                  <>
                    <Icon name="how_to_reg" className="text-[22px]" />
                    <span>Cadastrar Agora</span>
                    <Icon name="arrow_forward" className="text-[18px]" />
                  </>
                )}
              </button>

              {/* Info de segurança */}
              <p className="text-center text-xs text-[#9dc4de] flex items-center justify-center gap-1.5">
                <Icon name="lock" className="text-[14px]" />
                Seus dados estão protegidos e serão usados apenas para fins da campanha
              </p>
            </div>
          </div>
        </form>

        {/* ====== FOOTER ====== */}
        <div className="text-center space-y-3 pb-4">
          <div className="flex flex-wrap justify-center items-center gap-3">
            <div className="flex items-center gap-1.5 text-[#5a7d95] text-xs bg-white/70 px-3 py-1.5 rounded-full border border-[#d6e8f5]">
              <Icon name="lock" className="text-[16px] text-[#3a9ad9]" />
              <span>Dados Criptografados</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#5a7d95] text-xs bg-white/70 px-3 py-1.5 rounded-full border border-[#d6e8f5]">
              <Icon name="verified_user" className="text-[16px] text-[#3a9ad9]" />
              <span>100% Seguro</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#5a7d95] text-xs bg-white/70 px-3 py-1.5 rounded-full border border-[#d6e8f5]">
              <Icon name="policy" className="text-[16px] text-[#3a9ad9]" />
              <span>Conforme LGPD</span>
            </div>
          </div>
          <p className="text-[#9dc4de] text-[11px]">
            © 2026 Sistema de Gestão de Campanha. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ====== MODAL POLÍTICA DE PRIVACIDADE ====== */}
      {showPolitica && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-[#d6e8f5] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-slideUp">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8f0f7] bg-[#f5faff]">
              <div className="flex items-center gap-2.5">
                <Icon name="policy" className="text-[24px] text-[#3a9ad9]" />
                <h2 className="text-lg font-bold text-[#1a3a52]">Política de Privacidade</h2>
              </div>
              <button
                onClick={() => setShowPolitica(false)}
                className="text-[#9dc4de] hover:text-[#5a7d95] transition-colors hover:bg-[#e8f0f7] rounded-lg p-1.5"
              >
                <Icon name="close" className="text-[24px]" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 overflow-y-auto text-[#5a7d95] space-y-4 text-sm custom-scrollbar">
              {/* Cabeçalho */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[#1a3a52] mb-1">{getConfigValue('lgpd.nome_controlador')}</h2>
                <p className="text-xs text-[#9dc4de]">Última atualização: 28 de janeiro de 2026</p>
              </div>

              {/* 1. INFORMAÇÕES GERAIS */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">1. INFORMAÇÕES GERAIS</h3>
              <p>
                Esta Política de Privacidade estabelece como {getConfigValue('lgpd.nome_controlador')} coleta, usa, armazena e protege os dados pessoais dos usuários que se cadastram em nossa plataforma digital.
              </p>
              <p>
                Ao realizar o cadastro, você concorda com os termos desta política e autoriza o tratamento de seus dados pessoais conforme descrito abaixo.
              </p>

              {/* 2. DADOS COLETADOS */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">2. DADOS COLETADOS</h3>
              <p>Coletamos as seguintes informações através do formulário de cadastro:</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">2.1. Dados Pessoais Básicos</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Nome Completo:</strong> para identificação e personalização da comunicação</li>
                <li><strong>Data de Nascimento:</strong> para felicitações, segmentação de conteúdo por faixa etária e cumprimento de legislação de proteção a menores e idosos</li>
                <li><strong>WhatsApp:</strong> para envio de mensagens, informações sobre ações, eventos e conteúdos do mandato</li>
                <li><strong>Email:</strong> para envio de newsletters, informações sobre ações, eventos e conteúdos do mandato</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">2.2. Dados de Localização</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>CEP:</strong> para identificação regional e direcionamento de conteúdo local</li>
                <li><strong>Logradouro:</strong> para mapeamento e planejamento de ações na região</li>
                <li><strong>Número:</strong> complemento do endereço para mapeamento</li>
                <li><strong>Bairro:</strong> para segmentação regional de ações e conteúdos</li>
                <li><strong>Cidade:</strong> para identificação da localidade do apoiador</li>
                <li><strong>Estado (UF):</strong> para identificação do estado de residência</li>
              </ul>

              {/* 3. FINALIDADE DO USO DOS DADOS */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">3. FINALIDADE DO USO DOS DADOS</h3>
              <p>Seus dados pessoais serão utilizados exclusivamente para as seguintes finalidades:</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">3.1. Comunicação Institucional</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Envio de conteúdos informativos sobre as atividades de {getConfigValue('lgpd.nome_controlador')}</li>
                <li>Divulgação de ações, projetos e eventos realizados</li>
                <li>Compartilhamento de notícias e informações relevantes para a comunidade</li>
                <li>Prestação de contas das atividades</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">3.2. Envio de Conteúdo via WhatsApp</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Mensagens informativas sobre as atividades</li>
                <li>Convites para eventos e ações comunitárias</li>
                <li>Notícias e atualizações relevantes</li>
                <li>Pesquisas de opinião (quando aplicável)</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">3.3. Envio de Conteúdo via Email</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Newsletters com informações das atividades</li>
                <li>Convites para eventos e ações comunitárias</li>
                <li>Relatórios de atividades</li>
                <li>Informações sobre projetos e iniciativas</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">3.4. Segmentação de Conteúdo</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Direcionamento de informações específicas por região (bairro, cidade, estado)</li>
                <li>Segmentação por faixa etária quando relevante</li>
                <li>Personalização da comunicação de acordo com o perfil do apoiador</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">3.5. Mapeamento e Planejamento</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Identificação de regiões de atuação prioritária</li>
                <li>Planejamento de ações comunitárias por localidade</li>
                <li>Análise de distribuição geográfica dos apoiadores</li>
              </ul>

              {/* 4. BASE LEGAL */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">4. BASE LEGAL PARA O TRATAMENTO DE DADOS</h3>
              <p>O tratamento de seus dados pessoais é realizado com base em:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li><strong>Consentimento:</strong> Ao preencher o formulário de cadastro, você consente expressa e livremente com o tratamento de seus dados para as finalidades descritas</li>
                <li><strong>Legítimo Interesse:</strong> Para comunicação institucional e prestação de contas das atividades</li>
              </ol>

              {/* 5. COMPARTILHAMENTO */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">5. COMPARTILHAMENTO DE DADOS</h3>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">5.1. Não Compartilhamento com Terceiros</h4>
              <p>Seus dados pessoais <strong>NÃO</strong> serão vendidos, alugados ou compartilhados com terceiros para fins comerciais ou publicitários.</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">5.2. Compartilhamento Permitido</h4>
              <p>Os dados poderão ser compartilhados apenas nas seguintes situações:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Com prestadores de serviços contratados para envio de mensagens (WhatsApp Business API, ferramentas de email marketing), sempre sob cláusulas de confidencialidade</li>
                <li>Quando exigido por lei ou por ordem judicial</li>
                <li>Para cumprimento de obrigações legais ou regulatórias</li>
              </ul>

              {/* 6. ARMAZENAMENTO */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">6. ARMAZENAMENTO E SEGURANÇA DOS DADOS</h3>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">6.1. Prazo de Armazenamento</h4>
              <p>Seus dados serão armazenados enquanto você mantiver seu cadastro ativo.</p>
              <p>Após esse período, os dados poderão ser mantidos apenas para:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Cumprimento de obrigações legais</li>
                <li>Exercício de direitos em processos judiciais ou administrativos</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">6.2. Medidas de Segurança</h4>
              <p>Adotamos medidas técnicas e organizacionais para proteger seus dados contra:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Acesso não autorizado</li>
                <li>Perda, destruição ou alteração acidental</li>
                <li>Uso indevido ou divulgação não autorizada</li>
              </ul>
              <p className="mt-2">As medidas incluem:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Criptografia de dados sensíveis</li>
                <li>Controle de acesso restrito</li>
                <li>Backups regulares</li>
                <li>Monitoramento de segurança</li>
              </ul>

              {/* 7. DIREITOS */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">7. SEUS DIREITOS COMO TITULAR DOS DADOS</h3>
              <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes direitos:</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.1. Direito de Acesso</h4>
              <p>Solicitar confirmação sobre o tratamento de seus dados e acessar seus dados armazenados</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.2. Direito de Retificação</h4>
              <p>Corrigir dados incompletos, inexatos ou desatualizados</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.3. Direito de Eliminação</h4>
              <p>Solicitar a exclusão de seus dados pessoais (direito ao esquecimento)</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.4. Direito de Oposição</h4>
              <p>Opor-se ao tratamento de seus dados pessoais</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.5. Direito de Cancelamento do Consentimento</h4>
              <p>Revogar seu consentimento a qualquer momento, sem comprometer a licitude do tratamento realizado anteriormente</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.6. Direito de Portabilidade</h4>
              <p>Solicitar a transferência de seus dados para outro fornecedor de serviço</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">7.7. Direito de Limitação</h4>
              <p>Limitar o uso de seus dados pessoais</p>

              {/* 8. COMO EXERCER DIREITOS */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">8. COMO EXERCER SEUS DIREITOS</h3>
              <p>Para exercer qualquer um dos direitos acima, você pode:</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">8.1. Por Email</h4>
              <p>Enviar solicitação para: <strong className="text-[#3a9ad9]">{getConfigValue('lgpd.email_contato')}</strong></p>
              <p>Assunto: "LGPD - Exercício de Direitos"</p>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">8.2. Informações Necessárias</h4>
              <p>Ao fazer uma solicitação, inclua:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Nome completo</li>
                <li>CPF</li>
                <li>Email de contato</li>
                <li>Descrição clara do direito que deseja exercer</li>
                <li>Documentos que comprovem sua identidade (se necessário)</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">8.3. Prazo de Resposta</h4>
              <p>Responderemos sua solicitação em até 15 (quinze) dias úteis.</p>

              {/* 9. CANCELAMENTO */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">9. CANCELAMENTO DE CADASTRO E OPT-OUT</h3>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">9.1. Cancelamento Automático</h4>
              <p>Você pode cancelar seu cadastro a qualquer momento através de:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Link "Descadastrar" presente em todos os emails enviados</li>
                <li>Responder "SAIR" ou "CANCELAR" nas mensagens do WhatsApp</li>
                <li>Solicitação através dos canais de contato mencionados no item 8</li>
              </ul>

              <h4 className="text-[#1a3a52] font-semibold text-sm mt-4 mb-2">9.2. Efeitos do Cancelamento</h4>
              <p>Após o cancelamento:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Você deixará de receber conteúdos via WhatsApp e email</li>
                <li>Seus dados serão mantidos apenas pelo período necessário para cumprimento de obrigações legais</li>
                <li>Você pode solicitar a exclusão completa conforme item 7.3</li>
              </ul>

              {/* 10. COOKIES */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">10. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h3>
              <p>Caso o cadastro seja realizado através de site ou aplicativo, podemos utilizar cookies e tecnologias similares para melhorar sua experiência. Você pode gerenciar suas preferências de cookies nas configurações do seu navegador.</p>

              {/* 11. RESPONSÁVEL */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">11. RESPONSÁVEL PELO TRATAMENTO DE DADOS</h3>
              <p><strong>Controlador de Dados:</strong><br/>{getConfigValue('lgpd.nome_controlador')}<br/>Email: {getConfigValue('lgpd.email_contato')}</p>
              <p className="mt-2"><strong>Encarregado de Proteção de Dados (DPO):</strong><br/>Email: {getConfigValue('lgpd.email_contato')}</p>

              {/* 12. ALTERAÇÕES */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">12. ALTERAÇÕES NESTA POLÍTICA</h3>
              <p>Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças em nossas práticas ou na legislação aplicável.</p>
              <p>Alterações significativas serão comunicadas através dos nossos canais de comunicação (WhatsApp e/ou email).</p>
              <p>A data da última atualização está sempre indicada no início deste documento.</p>

              {/* 13. LEGISLAÇÃO */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">13. LEGISLAÇÃO APLICÁVEL</h3>
              <p>Esta Política de Privacidade é regida pela Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e demais legislações brasileiras aplicáveis.</p>

              {/* 14. DÚVIDAS */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">14. DÚVIDAS E CONTATO</h3>
              <p>Se você tiver qualquer dúvida sobre esta Política de Privacidade ou sobre o tratamento de seus dados pessoais, entre em contato conosco:</p>
              <p className="mt-2"><strong>Email:</strong> {getConfigValue('lgpd.email_contato')}</p>

              {/* 15. CONSENTIMENTO */}
              <h3 className="text-[#1a3a52] font-bold text-base mt-6 mb-2">15. CONSENTIMENTO</h3>
              <p>Ao preencher e enviar o formulário de cadastro, você declara que:</p>
              <ul className="list-none space-y-1 ml-4">
                <li>✓ Leu e compreendeu esta Política de Privacidade</li>
                <li>✓ Concorda com o tratamento de seus dados pessoais conforme descrito</li>
                <li>✓ Autoriza o recebimento de conteúdos via WhatsApp e email</li>
                <li>✓ Tem ciência de que pode revogar seu consentimento a qualquer momento</li>
                <li>✓ Forneceu dados verdadeiros e atualizados</li>
              </ul>

              {/* Rodapé */}
              <div className="text-center mt-8 pt-6 border-t border-[#e8f0f7]">
                <p className="text-[#1a3a52] font-bold">{getConfigValue('lgpd.nome_controlador')}</p>
                <p className="text-xs italic text-[#9dc4de]">Comprometido com a transparência e proteção dos seus dados pessoais</p>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-[#e8f0f7] bg-[#f5faff]">
              <button
                onClick={() => setShowPolitica(false)}
                className="w-full bg-gradient-to-r from-[#3a9ad9] to-[#5bb8f0] hover:from-[#2d87c4] hover:to-[#4aa8e0] text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos customizados */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f5faff;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #9dc4de;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3a9ad9;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PublicRegistration;
