import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import { coordenadoresService, organizacoesService, liderancasService, cadastrosService, equipesService, gerarCodigoUnico, Coordenador, Organizacao, Lideranca, Cadastro, Equipe, supabase } from '../lib/supabase';
import { geocodificarEndereco, reGeocodificarRegistro } from '../lib/geocoding';
import { notificarNovoCoordenador, isNotificationServiceAvailable } from '../lib/notificationService';

interface NewCoordinatorForm {
  name: string;
  region: string;
  phone: string;
  email: string;
  birthdate: string;
  goal: string;
  organization: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
}

const Coordinators: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCoordenador, setEditingCoordenador] = useState<Coordenador | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reGeocodificando, setReGeocodificando] = useState(false);
  const [coordenadores, setCoordenadores] = useState<Coordenador[]>([]);
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeCoordenadores, setEquipeCoordenadores] = useState<{ equipe_id: string, coordenador_id: string }[]>([]);
  const [notificationAvailable, setNotificationAvailable] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [renotifyingId, setRenotifyingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [formData, setFormData] = useState<NewCoordinatorForm>({
    name: '',
    region: '',
    phone: '',
    email: '',
    birthdate: '',
    goal: '',
    organization: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
  });
  const [loadingCep, setLoadingCep] = useState(false);
  const [selectedEquipeIds, setSelectedEquipeIds] = useState<string[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [coordData, orgData, liderData, cadData, equipesData, ecData, notifAvailable] = await Promise.all([
        coordenadoresService.listar(),
        organizacoesService.listar(),
        liderancasService.listar(),
        cadastrosService.listar(),
        equipesService.listar(),
        supabase.from('pltdataandrebueno_equipe_coordenadores').select('equipe_id, coordenador_id'),
        isNotificationServiceAvailable(),
      ]);
      setCoordenadores(coordData);
      setOrganizacoes(orgData);
      setLiderancas(liderData);
      setCadastros(cadData);
      setEquipes(equipesData);
      setEquipeCoordenadores(ecData.data || []);
      setNotificationAvailable(notifAvailable);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-[#1e5a8d]';
    return 'bg-amber-500';
  };

  const getProgressTextColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-400';
    if (percentage >= 50) return 'text-gray-300';
    return 'text-amber-400';
  };

  const buscarEnderecoPorCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);
      const data = await response.json();

      setFormData(prev => ({
        ...prev,
        street: data.street || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, cep: value });

    if (value.replace(/\D/g, '').length === 8) {
      buscarEnderecoPorCep(value);
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.birthdate) {
      alert('Data de Nascimento obrigatória! Por favor, informe a data de nascimento.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitStep('Localizando endereço...');

      // Geocodificar endereço usando serviço centralizado
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (formData.street && formData.city) {
        const resultado = await geocodificarEndereco({
          cep: formData.cep,
          rua: formData.street,
          numero: formData.number,
          bairro: formData.neighborhood,
          cidade: formData.city,
          estado: 'SP'
        });

        if (resultado.sucesso && resultado.coordenadas) {
          latitude = resultado.coordenadas.latitude;
          longitude = resultado.coordenadas.longitude;
        }
      }

      setSubmitStep('Salvando coordenador...');

      const novoCoordenador = await coordenadoresService.criar({
        nome: formData.name,
        telefone: formData.phone,
        email: formData.email,
        data_nascimento: formData.birthdate,
        regiao: formData.region,
        organizacao_id: formData.organization || null,
        codigo_unico: gerarCodigoUnico(),
        cep: formData.cep || null,
        endereco: formData.street || null,
        numero: formData.number || null,
        bairro: formData.neighborhood || null,
        cidade: formData.city || null,
        estado: 'SP',
        latitude,
        longitude,
        meta: parseInt(formData.goal) || 1000,
        ativo: true,
      });

      // Vincular coordenador às equipes selecionadas
      if (selectedEquipeIds.length > 0 && novoCoordenador?.id) {
        setSubmitStep('Vinculando equipes...');
        const vinculos = selectedEquipeIds.map(equipeId => ({
          equipe_id: equipeId,
          coordenador_id: novoCoordenador.id,
        }));
        await supabase.from('pltdataandrebueno_equipe_coordenadores').insert(vinculos);
      }

      // Coordenador criado com sucesso - fechar modal imediatamente
      const shouldNotify = sendNotification && notificationAvailable && novoCoordenador && novoCoordenador.telefone && novoCoordenador.codigo_unico;

      setShowModal(false);
      setSubmitting(false);
      setSubmitStep('');
      setSendNotification(true);
      setSelectedEquipeIds([]);
      setFormData({ name: '', region: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });

      setToast({ message: `Coordenador "${novoCoordenador.nome}" criado com sucesso!`, type: 'success' });

      // Recarregar dados em background
      carregarDados();

      // Enviar notificação WhatsApp em background (não bloqueia a UI)
      if (shouldNotify) {
        setToast({ message: `Coordenador criado! Enviando WhatsApp para ${novoCoordenador.nome}...`, type: 'info' });
        notificarNovoCoordenador({
          nome: novoCoordenador.nome,
          telefone: novoCoordenador.telefone!,
          codigo_unico: novoCoordenador.codigo_unico!,
        }).then(() => {
          setToast({ message: `WhatsApp enviado para ${novoCoordenador.nome}!`, type: 'success' });
        }).catch((notifError) => {
          console.error('Falha ao enviar notificação WhatsApp:', notifError);
          setToast({ message: `Coordenador criado, mas falha ao enviar WhatsApp.`, type: 'error' });
        });
      }
    } catch (error) {
      console.error('Erro ao criar coordenador:', error);
      setSubmitting(false);
      setSubmitStep('');
      setToast({ message: 'Erro ao criar coordenador. Tente novamente.', type: 'error' });
    }
  };

  // Abrir modal de edição
  const abrirModalEditar = (e: React.MouseEvent, coordenador: Coordenador) => {
    e.stopPropagation();
    setEditingCoordenador(coordenador);
    setFormData({
      name: coordenador.nome,
      region: coordenador.regiao || '',
      phone: coordenador.telefone || '',
      email: coordenador.email || '',
      birthdate: (coordenador as any).data_nascimento || '',
      goal: coordenador.meta?.toString() || '',
      organization: coordenador.organizacao_id || '',
      cep: coordenador.cep || '',
      street: coordenador.endereco || '',
      number: coordenador.numero || '',
      neighborhood: coordenador.bairro || '',
      city: coordenador.cidade || '',
    });
    setShowEditModal(true);
  };

  // Processar edição
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCoordenador) return;

    try {
      setLoading(true);

      // Verificar se endereço mudou para re-geocodificar
      const enderecoMudou =
        formData.street !== editingCoordenador.endereco ||
        formData.number !== editingCoordenador.numero ||
        formData.city !== editingCoordenador.cidade ||
        formData.cep !== editingCoordenador.cep;

      let latitude = editingCoordenador.latitude;
      let longitude = editingCoordenador.longitude;

      if (enderecoMudou && formData.street && formData.city) {
        const resultado = await geocodificarEndereco({
          cep: formData.cep,
          rua: formData.street,
          numero: formData.number,
          bairro: formData.neighborhood,
          cidade: formData.city,
          estado: 'SP'
        });

        if (resultado.sucesso && resultado.coordenadas) {
          latitude = resultado.coordenadas.latitude;
          longitude = resultado.coordenadas.longitude;
        }
      }

      await coordenadoresService.atualizar(editingCoordenador.id, {
        nome: formData.name,
        telefone: formData.phone,
        email: formData.email || null,
        data_nascimento: formData.birthdate,
        regiao: formData.region || null,
        organizacao_id: formData.organization || null,
        cep: formData.cep || null,
        endereco: formData.street || null,
        numero: formData.number || null,
        bairro: formData.neighborhood || null,
        cidade: formData.city || null,
        latitude,
        longitude,
        meta: parseInt(formData.goal) || 1000,
      });

      await carregarDados();
      setShowEditModal(false);
      setEditingCoordenador(null);
      setFormData({ name: '', region: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });
      alert('✅ Coordenador atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar coordenador:', error);
      alert('Erro ao atualizar coordenador. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de exclusão
  const abrirModalExcluir = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setDeleteTarget({ id, nome });
    setShowDeleteModal(true);
  };

  // Confirmar exclusão
  const confirmarExclusao = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await coordenadoresService.excluir(deleteTarget.id);
      await carregarDados();
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Erro ao excluir coordenador:', error);
      alert('Erro ao excluir coordenador. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  // Renotificar coordenador
  const handleRenotifyCoordinator = async (e: React.MouseEvent, coord: Coordenador) => {
    e.stopPropagation();

    if (!coord.telefone || !coord.codigo_unico) {
      alert('Coordenador não possui telefone ou código cadastrado.');
      return;
    }

    if (!notificationAvailable) {
      alert('WhatsApp não está conectado.');
      return;
    }

    setRenotifyingId(coord.id);
    try {
      await notificarNovoCoordenador({
        nome: coord.nome,
        telefone: coord.telefone,
        codigo_unico: coord.codigo_unico,
      });
      alert('Notificação enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao renotificar:', error);
      alert('Erro ao enviar notificação.');
    } finally {
      setRenotifyingId(null);
    }
  };

  // Re-geocodificar todos os coordenadores com TomTom
  const reGeocodificarTodos = async () => {
    if (!confirm('Isso irá atualizar as coordenadas de todos os coordenadores usando TomTom. Continuar?')) return;

    setReGeocodificando(true);
    let atualizados = 0;
    let erros = 0;

    for (const coord of coordenadores) {
      if (!coord.endereco || !coord.cidade) continue;

      try {
        const novasCoordenadas = await reGeocodificarRegistro({
          endereco: coord.endereco,
          numero: coord.numero,
          bairro: coord.bairro,
          cidade: coord.cidade,
          estado: coord.estado,
          cep: coord.cep
        });

        if (novasCoordenadas) {
          await coordenadoresService.atualizar(coord.id, {
            latitude: novasCoordenadas.latitude,
            longitude: novasCoordenadas.longitude
          });
          atualizados++;
        }
      } catch (error) {
        console.error(`Erro ao re-geocodificar ${coord.nome}:`, error);
        erros++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await carregarDados();
    setReGeocodificando(false);
    alert(`Re-geocodificação concluída!\n✅ Atualizados: ${atualizados}\n❌ Erros: ${erros}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight mb-1">
            Coordenadores
          </h1>
          <p className="text-sm dark:text-gray-400 light:text-gray-600 font-light">
            Gerencie os coordenadores e suas regiões
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="group relative px-5 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <Icon name="add" className="text-[18px]" />
              <span>Novo Coordenador</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tabela com design minimalista */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white light:shadow-sm backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="dark:bg-white/[0.02] light:bg-gray-50 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Coordenador</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Região</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Lideranças</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Cadastros</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Meta</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                <th className="px-6 py-4 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-white rounded-full"></div>
                      <span className="text-gray-400">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : coordenadores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="badge_off" className="text-4xl text-gray-500" />
                      <p className="text-gray-400">Nenhum coordenador cadastrado</p>
                      <p className="text-xs text-gray-500">Clique em "Novo Coordenador" para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                coordenadores.map((coord) => {
                  const initials = coord.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  // Buscar equipes do coordenador
                  const equipesDoCoord = equipeCoordenadores
                    .filter(ec => ec.coordenador_id === coord.id)
                    .map(ec => ec.equipe_id);
                  // Buscar lideranças das equipes do coordenador
                  const liderancasDoCoord = liderancas.filter(l => equipesDoCoord.includes(l.equipe_id));
                  const totalLiderancas = liderancasDoCoord.length;
                  // Buscar cadastros das lideranças do coordenador
                  const liderancaIds = liderancasDoCoord.map(l => l.id);
                  const totalCadastros = cadastros.filter(c => c.lideranca_id && liderancaIds.includes(c.lideranca_id)).length;
                  const percentage = coord.meta ? Math.round((totalCadastros / coord.meta) * 100) : 0;
                  return (
                    <tr
                      key={coord.id}
                      onClick={() => navigate(`/coordinators/${coord.id}`)}
                      className="dark:hover:bg-white/[0.02] light:hover:bg-gray-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a5f]/30 text-gray-400 border border-white/10 text-xs font-medium">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium dark:text-white light:text-gray-900">{coord.nome}</p>
                            <p className="text-[10px] text-gray-500">{coord.codigo_unico}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-400">{coord.regiao || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium dark:text-white light:text-gray-900">{totalLiderancas}</div>
                        <div className="text-[10px] text-gray-500">lideranças</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium dark:text-white light:text-gray-900">{totalCadastros}</div>
                        <div className="text-[10px] text-gray-500">cadastros</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-400">{coord.meta || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[120px]">
                            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressColor(percentage)} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-medium ${getProgressTextColor(percentage)} min-w-[45px]`}>
                            {percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {notificationAvailable && coord.telefone && (
                            <button
                              onClick={(e) => handleRenotifyCoordinator(e, coord)}
                              disabled={renotifyingId === coord.id}
                              className="text-gray-400 hover:text-emerald-500 dark:text-gray-500 dark:hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50"
                              title="Notificar"
                            >
                              {renotifyingId === coord.id ? (
                                <div className="w-[18px] h-[18px] border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Icon name="send" className="text-[18px]" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => abrirModalEditar(e, coord)}
                            className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            title="Editar"
                          >
                            <Icon name="edit" className="text-[18px]" />
                          </button>
                          <button
                            onClick={(e) => abrirModalExcluir(e, coord.id, coord.nome)}
                            className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                            title="Excluir"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Novo Coordenador */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-gradient-to-br from-[#1a1f2e] to-[#151923] rounded-2xl border dark:border-white/10 light:border-gray-300 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight">Novo Coordenador</h3>
                <p className="text-xs text-gray-400 mt-1 font-light">Adicione um novo coordenador ao sistema</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 dark:hover:text-white light:hover:text-gray-900 transition-colors p-2 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Roberto Silva"
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Equipe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="group" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <select
                      required={selectedEquipeIds.length === 0}
                      value=""
                      onChange={(e) => {
                        const equipeId = e.target.value;
                        if (equipeId && !selectedEquipeIds.includes(equipeId)) {
                          setSelectedEquipeIds([...selectedEquipeIds, equipeId]);
                          const equipe = equipes.find(eq => eq.id === equipeId);
                          const nomes = [...selectedEquipeIds, equipeId].map(id => equipes.find(eq => eq.id === id)?.nome).filter(Boolean).join(', ');
                          setFormData({ ...formData, region: nomes });
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all cursor-pointer appearance-none"
                    >
                      <option value="" className="bg-white dark:bg-[#1a1f2e] text-gray-400">Selecione equipe(s)</option>
                      {equipes.filter(eq => !selectedEquipeIds.includes(eq.id)).map((equipe: Equipe) => (
                        <option key={equipe.id} value={equipe.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">
                          {equipe.nome}
                        </option>
                      ))}
                    </select>
                    <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
                  </div>
                  {selectedEquipeIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedEquipeIds.map(id => {
                        const equipe = equipes.find(eq => eq.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: equipe?.cor || '#1e3a5f' }}>
                            {equipe?.nome}
                            <button type="button" onClick={() => {
                              const newIds = selectedEquipeIds.filter(eid => eid !== id);
                              setSelectedEquipeIds(newIds);
                              const nomes = newIds.map(eid => equipes.find(eq => eq.id === eid)?.nome).filter(Boolean).join(', ');
                              setFormData({ ...formData, region: nomes });
                            }} className="hover:text-red-200 transition-colors">
                              <Icon name="close" className="text-[14px]" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Telefone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Meta Regional
                    </label>
                    <div className="relative">
                      <Icon name="flag" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="number"
                        value={formData.goal}
                        onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                        placeholder="Ex: 1500"
                        className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ex: roberto@email.com"
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="cake" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="date"
                      required
                      value={formData.birthdate}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    CEP <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.cep}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                    />
                    {loadingCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rua
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 relative">
                      <Icon name="signpost" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Preenchido automaticamente pelo CEP"
                        className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                        readOnly={loadingCep}
                      />
                    </div>
                    <div className="relative">
                      <Icon name="pin" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        placeholder="Nº"
                        className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Bairro
                    </label>
                    <div className="relative">
                      <Icon name="home" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        placeholder="Preenchido automaticamente"
                        className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                        readOnly={loadingCep}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Cidade
                    </label>
                    <div className="relative">
                      <Icon name="location_city" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Preenchido automaticamente"
                        className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                        readOnly={loadingCep}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Organização (Opcional)
                  </label>
                  <div className="relative">
                    <Icon name="business" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <select
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all cursor-pointer appearance-none"
                    >
                      <option value="" className="bg-white dark:bg-[#1a1f2e] text-gray-400">Nenhuma organização</option>
                      {organizacoes.map((org: Organizacao) => (
                        <option key={org.id} value={org.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">
                          {org.nome}
                        </option>
                      ))}
                    </select>
                    <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
                  </div>
                </div>

                {/* Notificação WhatsApp */}
                {notificationAvailable && formData.phone && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <input
                      type="checkbox"
                      id="sendNotificationCoord"
                      checked={sendNotification}
                      onChange={(e) => setSendNotification(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 bg-transparent border-emerald-500/50 rounded focus:ring-emerald-500/50"
                    />
                    <label htmlFor="sendNotificationCoord" className="text-sm text-emerald-300 cursor-pointer">
                      Notificar coordenador via WhatsApp
                    </label>
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-white/5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '', region: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });
                    }}
                    className="flex-1 px-5 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-gray-300 light:text-gray-600 dark:hover:bg-white/[0.05] light:hover:bg-gray-100 dark:hover:text-white light:hover:text-gray-900 transition-all font-light disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span className="text-sm">{submitStep || 'Criando...'}</span></>
                    ) : (
                      <><Icon name="check" className="text-[18px]" />Criar Coordenador</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && editingCoordenador && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setShowEditModal(false); setEditingCoordenador(null); }}
        >
          <div
            className="bg-white dark:bg-[#1a2632] rounded-2xl border border-gray-200 dark:border-white/10 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Editar Coordenador</h3>
                <p className="text-xs text-white/70 mt-1">Atualize os dados do coordenador</p>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingCoordenador(null); }}
                className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Região <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="map" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="Ex: Zona Sul"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Telefone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Meta
                    </label>
                    <div className="relative">
                      <Icon name="flag" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="number"
                        value={formData.goal}
                        onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="cake" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <input
                      type="date"
                      required
                      value={formData.birthdate}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      CEP
                    </label>
                    <input
                      type="text"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      maxLength={9}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Rua
                    </label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Número
                    </label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingCoordenador(null);
                      setFormData({ name: '', region: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });
                    }}
                    className="flex-1 px-5 py-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Icon name="check" className="text-[18px]" />
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmarExclusao}
        title="Excluir Coordenador"
        message={`Tem certeza que deseja excluir o coordenador "${deleteTarget?.nome}"? As equipes vinculadas a este coordenador também serão afetadas. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleting}
      />

      {/* Toast de feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-slide-up">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-sm max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-500/90 border-emerald-400/30 text-white'
                : toast.type === 'error'
                ? 'bg-red-500/90 border-red-400/30 text-white'
                : 'bg-blue-500/90 border-blue-400/30 text-white'
            }`}
          >
            {toast.type === 'success' && <Icon name="check_circle" className="text-[20px] flex-shrink-0" />}
            {toast.type === 'error' && <Icon name="error" className="text-[20px] flex-shrink-0" />}
            {toast.type === 'info' && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 flex-shrink-0">
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coordinators;
