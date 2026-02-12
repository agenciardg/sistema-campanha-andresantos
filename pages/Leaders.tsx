import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import { liderancasService, equipesService, organizacoesService, cadastrosService, gerarCodigoUnico, Lideranca, Equipe, Organizacao, Cadastro } from '../lib/supabase';
import { geocodificarEndereco, reGeocodificarRegistro } from '../lib/geocoding';
import { notificarNovaLideranca, isNotificationServiceAvailable } from '../lib/notificationService';

interface NewLeaderForm {
  name: string;
  team: string;
  organization: string;
  phone: string;
  email: string;
  birthdate: string;
  goal: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
}

const Leaders: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLideranca, setEditingLideranca] = useState<Lideranca | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reGeocodificando, setReGeocodificando] = useState(false);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [notificationAvailable, setNotificationAvailable] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [renotifyingId, setRenotifyingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [formData, setFormData] = useState<NewLeaderForm>({
    name: '',
    team: '',
    organization: '',
    phone: '',
    email: '',
    birthdate: '',
    goal: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
  });
  const [loadingCep, setLoadingCep] = useState(false);

  // Re-geocodificar todas as lideranças com TomTom
  const reGeocodificarTodas = async () => {
    if (!confirm('Isso irá atualizar as coordenadas de todas as lideranças usando TomTom. Continuar?')) return;

    setReGeocodificando(true);
    let atualizadas = 0;
    let erros = 0;

    for (const lideranca of liderancas) {
      if (!lideranca.endereco || !lideranca.cidade) continue;

      try {
        const novasCoordenadas = await reGeocodificarRegistro({
          endereco: lideranca.endereco,
          numero: lideranca.numero,
          bairro: lideranca.bairro,
          cidade: lideranca.cidade,
          estado: lideranca.estado,
          cep: lideranca.cep
        });

        if (novasCoordenadas) {
          await liderancasService.atualizar(lideranca.id, {
            latitude: novasCoordenadas.latitude,
            longitude: novasCoordenadas.longitude
          });
          atualizadas++;
        }
      } catch (error) {
        console.error(`Erro ao re-geocodificar ${lideranca.nome}:`, error);
        erros++;
      }

      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await carregarDados();
    setReGeocodificando(false);
    alert(`Re-geocodificação concluída!\n✅ Atualizadas: ${atualizadas}\n❌ Erros: ${erros}`);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [liderData, equipesData, orgData, cadData, notifAvailable] = await Promise.all([
        liderancasService.listar(),
        equipesService.listar(),
        organizacoesService.listar(),
        cadastrosService.listar(),
        isNotificationServiceAvailable(),
      ]);
      setLiderancas(liderData);
      setEquipes(equipesData);
      setOrganizacoes(orgData);
      setCadastros(cadData);
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

    if (!formData.team) {
      alert('Por favor, selecione uma equipe.');
      return;
    }

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

      setSubmitStep('Salvando liderança...');

      const novaLideranca = await liderancasService.criar({
        equipe_id: formData.team,
        organizacao_id: formData.organization || null,
        nome: formData.name,
        telefone: formData.phone,
        email: formData.email,
        data_nascimento: formData.birthdate,
        codigo_unico: gerarCodigoUnico(),
        cep: formData.cep || null,
        endereco: formData.street || null,
        numero: formData.number || null,
        bairro: formData.neighborhood || null,
        cidade: formData.city || null,
        estado: 'SP',
        latitude,
        longitude,
        meta: parseInt(formData.goal) || 500,
        ativo: true,
      });

      // Liderança criada com sucesso - fechar modal imediatamente
      const shouldNotify = sendNotification && notificationAvailable && novaLideranca && novaLideranca.telefone && novaLideranca.codigo_unico;
      const equipeNome = equipes.find(eq => eq.id === formData.team)?.nome;

      setShowModal(false);
      setSubmitting(false);
      setSubmitStep('');
      setSendNotification(true);
      setFormData({ name: '', team: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });

      setToast({ message: `Liderança "${novaLideranca.nome}" criada com sucesso!`, type: 'success' });

      // Recarregar dados em background
      carregarDados();

      // Enviar notificação WhatsApp em background (não bloqueia a UI)
      if (shouldNotify) {
        setToast({ message: `Liderança criada! Enviando WhatsApp para ${novaLideranca.nome}...`, type: 'info' });
        notificarNovaLideranca({
          nome: novaLideranca.nome,
          telefone: novaLideranca.telefone!,
          codigo_unico: novaLideranca.codigo_unico!,
          equipe_nome: equipeNome,
        }).then(() => {
          setToast({ message: `WhatsApp enviado para ${novaLideranca.nome}!`, type: 'success' });
        }).catch((notifError) => {
          console.error('Falha ao enviar notificação WhatsApp:', notifError);
          setToast({ message: `Liderança criada, mas falha ao enviar WhatsApp.`, type: 'error' });
        });
      }
    } catch (error) {
      console.error('Erro ao criar liderança:', error);
      setSubmitting(false);
      setSubmitStep('');
      setToast({ message: 'Erro ao criar liderança. Tente novamente.', type: 'error' });
    }
  };

  // Abrir modal de edição
  const abrirModalEditar = (e: React.MouseEvent, lideranca: Lideranca) => {
    e.stopPropagation();
    setEditingLideranca(lideranca);
    setFormData({
      name: lideranca.nome,
      team: lideranca.equipe_id,
      phone: lideranca.telefone || '',
      email: lideranca.email || '',
      birthdate: (lideranca as any).data_nascimento || '',
      goal: lideranca.meta?.toString() || '',
      organization: lideranca.organizacao_id || '',
      cep: lideranca.cep || '',
      street: lideranca.endereco || '',
      number: lideranca.numero || '',
      neighborhood: lideranca.bairro || '',
      city: lideranca.cidade || '',
    });
    setShowEditModal(true);
  };

  // Processar edição
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingLideranca) return;

    if (!formData.team) {
      alert('Por favor, selecione uma equipe.');
      return;
    }

    try {
      setLoading(true);

      // Verificar se endereço mudou para re-geocodificar
      const enderecoMudou =
        formData.street !== editingLideranca.endereco ||
        formData.number !== editingLideranca.numero ||
        formData.city !== editingLideranca.cidade ||
        formData.cep !== editingLideranca.cep;

      let latitude = editingLideranca.latitude;
      let longitude = editingLideranca.longitude;

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

      await liderancasService.atualizar(editingLideranca.id, {
        equipe_id: formData.team,
        organizacao_id: formData.organization || null,
        nome: formData.name,
        telefone: formData.phone,
        email: formData.email || null,
        data_nascimento: formData.birthdate,
        cep: formData.cep || null,
        endereco: formData.street || null,
        numero: formData.number || null,
        bairro: formData.neighborhood || null,
        cidade: formData.city || null,
        latitude,
        longitude,
        meta: parseInt(formData.goal) || 500,
      });

      await carregarDados();
      setShowEditModal(false);
      setEditingLideranca(null);
      setFormData({ name: '', team: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });
      alert('✅ Liderança atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar liderança:', error);
      alert('Erro ao atualizar liderança. Tente novamente.');
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
      await liderancasService.excluir(deleteTarget.id);
      await carregarDados();
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Erro ao excluir liderança:', error);
      alert('Erro ao excluir liderança. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  // Renotificar liderança
  const handleRenotifyLeader = async (e: React.MouseEvent, lider: Lideranca) => {
    e.stopPropagation();

    if (!lider.telefone || !lider.codigo_unico) {
      alert('Liderança não possui telefone ou código cadastrado.');
      return;
    }

    if (!notificationAvailable) {
      alert('WhatsApp não está conectado.');
      return;
    }

    setRenotifyingId(lider.id);
    try {
      const equipe = equipes.find(eq => eq.id === lider.equipe_id);
      await notificarNovaLideranca({
        nome: lider.nome,
        telefone: lider.telefone,
        codigo_unico: lider.codigo_unico,
        equipe_nome: equipe?.nome,
      });
      alert('Notificação enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao renotificar:', error);
      alert('Erro ao enviar notificação.');
    } finally {
      setRenotifyingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-gray-900 dark:text-white tracking-tight mb-1">
            Lideranças
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
            Acompanhe o desempenho de cada liderança
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="group relative px-5 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <Icon name="add" className="text-[18px]" />
              <span>Nova Liderança</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tabela com design minimalista */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white light:shadow-sm backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="light:bg-gray-50 dark:bg-white/[0.02] border-b light:border-gray-200 dark:border-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Liderança</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Equipe</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Cadastros</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Meta</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                <th className="px-6 py-4 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y light:divide-gray-200 dark:divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-white rounded-full"></div>
                      <span className="text-gray-400">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : liderancas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="person_off" className="text-4xl text-gray-500" />
                      <p className="text-gray-400">Nenhuma liderança cadastrada</p>
                      <p className="text-xs text-gray-500">Clique em "Nova Liderança" para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                liderancas.map((lider) => {
                  const initials = lider.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  const equipe = equipes.find(e => e.id === lider.equipe_id);
                  const totalCadastros = cadastros.filter(c => c.lideranca_id === lider.id).length;
                  const percentage = lider.meta ? Math.round((totalCadastros / lider.meta) * 100) : 0;
                  return (
                    <tr
                      key={lider.id}
                      onClick={() => navigate(`/leaders/${lider.id}`)}
                      className="light:hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a5f]/30 text-gray-400 border border-white/10 text-xs font-medium">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{lider.nome}</p>
                            <p className="text-[10px] text-gray-500">{lider.codigo_unico}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-400">{equipe?.nome || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{totalCadastros}</div>
                        <div className="text-[10px] text-gray-500">cadastros</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-400">{lider.meta || 0}</span>
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
                          {notificationAvailable && lider.telefone && (
                            <button
                              onClick={(e) => handleRenotifyLeader(e, lider)}
                              disabled={renotifyingId === lider.id}
                              className="text-gray-400 hover:text-emerald-500 dark:text-gray-500 dark:hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50"
                              title="Notificar"
                            >
                              {renotifyingId === lider.id ? (
                                <div className="w-[18px] h-[18px] border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Icon name="send" className="text-[18px]" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => abrirModalEditar(e, lider)}
                            className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            title="Editar"
                          >
                            <Icon name="edit" className="text-[18px]" />
                          </button>
                          <button
                            onClick={(e) => abrirModalExcluir(e, lider.id, lider.nome)}
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

      {/* Modal - Design Moderno Branco */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-[#1a2632] rounded-2xl border border-gray-200 dark:border-white/10 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Nova Liderança</h3>
                <p className="text-xs text-white/70 mt-1">Adicione uma nova liderança ao sistema</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-4">
                {/* Nome */}
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
                      placeholder="Ex: Maria Silva"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Equipe */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Equipe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="groups" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <select
                      required
                      value={formData.team}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all cursor-pointer appearance-none"
                    >
                      <option value="" disabled className="bg-white dark:bg-[#1a1f2e] text-gray-400">Selecione uma equipe</option>
                      {equipes.map((equipe) => (
                        <option key={equipe.id} value={equipe.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{equipe.nome}</option>
                      ))}
                    </select>
                    <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 pointer-events-none text-[18px]" />
                  </div>
                </div>

                {/* Telefone e Meta */}
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
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Meta Individual
                    </label>
                    <div className="relative">
                      <Icon name="flag" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="number"
                        value={formData.goal}
                        onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                        placeholder="Ex: 300"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Data de Nascimento */}
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
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
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
                      placeholder="Ex: maria@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* CEP */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    CEP <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.cep}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                    />
                    {loadingCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-[#1e5a8d] border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rua e Número */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Rua
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 relative">
                      <Icon name="signpost" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Preenchido automaticamente"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                        readOnly={loadingCep}
                      />
                    </div>
                    <div className="relative">
                      <Icon name="pin" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        placeholder="Nº"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Bairro e Cidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Bairro
                    </label>
                    <div className="relative">
                      <Icon name="home" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        placeholder="Preenchido auto"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                        readOnly={loadingCep}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                      Cidade
                    </label>
                    <div className="relative">
                      <Icon name="location_city" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Preenchido auto"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all"
                        readOnly={loadingCep}
                      />
                    </div>
                  </div>
                </div>

                {/* Organização */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1e3a5f] dark:text-gray-400 uppercase tracking-wider">
                    Organização (Opcional)
                  </label>
                  <div className="relative">
                    <Icon name="business" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <select
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8d] focus:border-transparent transition-all cursor-pointer appearance-none"
                    >
                      <option value="" className="bg-white dark:bg-[#1a1f2e] text-gray-400">Nenhuma organização</option>
                      {organizacoes.map(org => (
                        <option key={org.id} value={org.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{org.nome}</option>
                      ))}
                    </select>
                    <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 pointer-events-none text-[18px]" />
                  </div>
                </div>

                {/* Notificação WhatsApp */}
                {notificationAvailable && formData.phone && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                    <input
                      type="checkbox"
                      id="sendNotificationLeader"
                      checked={sendNotification}
                      onChange={(e) => setSendNotification(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 bg-white border-emerald-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="sendNotificationLeader" className="text-sm text-emerald-700 dark:text-emerald-300 cursor-pointer font-medium">
                      Notificar liderança via WhatsApp
                    </label>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5 mt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '', team: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });
                    }}
                    className="flex-1 px-5 py-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span className="text-sm">{submitStep || 'Criando...'}</span></>
                    ) : (
                      <><Icon name="check" className="text-[18px]" />Criar Liderança</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && editingLideranca && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setShowEditModal(false); setEditingLideranca(null); }}
        >
          <div
            className="bg-white dark:bg-[#1a2632] rounded-2xl border border-gray-200 dark:border-white/10 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Editar Liderança</h3>
                <p className="text-xs text-white/70 mt-1">Atualize os dados da liderança</p>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingLideranca(null); }}
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
                    Equipe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="groups" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 text-[18px]" />
                    <select
                      required
                      value={formData.team}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none"
                    >
                      <option value="" disabled>Selecione uma equipe</option>
                      {equipes.map((equipe) => (
                        <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>
                      ))}
                    </select>
                    <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1e5a8d] dark:text-gray-500 pointer-events-none text-[18px]" />
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
                      setEditingLideranca(null);
                      setFormData({ name: '', team: '', phone: '', email: '', birthdate: '', goal: '', organization: '', cep: '', street: '', number: '', neighborhood: '', city: '' });
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
        title="Excluir Liderança"
        message={`Tem certeza que deseja excluir a liderança "${deleteTarget?.nome}"? Os cadastros vinculados a esta liderança também serão afetados. Esta ação não pode ser desfeita.`}
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

export default Leaders;
