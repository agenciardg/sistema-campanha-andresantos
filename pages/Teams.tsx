import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import { equipesService, organizacoesService, liderancasService, cadastrosService, Equipe, Organizacao, Lideranca, Cadastro } from '../lib/supabase';
import { geocodificarEndereco, reGeocodificarRegistro } from '../lib/geocoding';

interface NewTeamForm {
  name: string;
  color: string;
  organization: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
}

const colorOptions = [
  { name: 'Azul Escuro', hex: '#1e3a5f' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Azul Claro', hex: '#3b82f6' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Verde Claro', hex: '#22c55e' },
  { name: 'Lima', hex: '#84cc16' },
  { name: 'Amarelo', hex: '#eab308' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Roxo', hex: '#a855f7' },
  { name: 'Violeta', hex: '#8b5cf6' },
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Cinza', hex: '#6b7280' },
  { name: 'Marrom', hex: '#92400e' },
  { name: 'Slate', hex: '#475569' },
];

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showRegeoConfirmModal, setShowRegeoConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reGeocodificando, setReGeocodificando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [formData, setFormData] = useState<NewTeamForm>({
    name: '',
    color: '#1e3a5f',
    organization: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    latitude: null,
    longitude: null,
  });
  const [loadingCep, setLoadingCep] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [equipesData, orgsData, liderData, cadData] = await Promise.all([
        equipesService.listar(),
        organizacoesService.listar(),
        liderancasService.listar(),
        cadastrosService.listar(),
      ]);
      setEquipes(equipesData);
      setOrganizacoes(orgsData);
      setLiderancas(liderData);
      setCadastros(cadData);
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

  // Buscar endereço pelo CEP (apenas dados do endereço, sem coordenadas)
  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    try {
      // Buscar endereço na BrasilAPI v2
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);
      if (response.ok) {
        const data = await response.json();

        // Atualizar formulário apenas com dados do endereço
        // Coordenadas serão obtidas ao salvar, usando o endereço completo com número
        setFormData(prev => ({
          ...prev,
          rua: data.street || '',
          bairro: data.neighborhood || '',
          cidade: data.city || '',
          estado: data.state || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingCep(false);
    }
  };

  // Formatar CEP enquanto digita
  const formatarCep = (value: string) => {
    const cepLimpo = value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
    return cepLimpo;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cepFormatado = formatarCep(e.target.value);
    setFormData({ ...formData, cep: cepFormatado });

    // Buscar automaticamente quando o CEP estiver completo
    if (cepFormatado.replace(/\D/g, '').length === 8) {
      buscarCep(cepFormatado);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Geocodificar endereço usando serviço centralizado
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (formData.rua && formData.cidade && formData.estado) {
        const resultado = await geocodificarEndereco({
          cep: formData.cep,
          rua: formData.rua,
          numero: formData.numero,
          bairro: formData.bairro,
          cidade: formData.cidade,
          estado: formData.estado
        });

        if (resultado.sucesso && resultado.coordenadas) {
          latitude = resultado.coordenadas.latitude;
          longitude = resultado.coordenadas.longitude;
        }
      }

      await equipesService.criar({
        nome: formData.name,
        cor: formData.color,
        organizacao_id: formData.organization || null,
        cep: formData.cep || null,
        endereco: formData.rua || null,
        numero: formData.numero || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        latitude,
        longitude,
        meta: 0,
        ativo: true,
      });

      await carregarDados();
      setShowModal(false);
      setFormData({
        name: '',
        color: '#1e3a5f',
        organization: '',
        cep: '',
        rua: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        latitude: null,
        longitude: null,
      });
    } catch (error) {
      console.error('Erro ao criar equipe:', error);
      alert('Erro ao criar equipe. Tente novamente.');
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
      await equipesService.excluir(deleteTarget.id);
      await carregarDados();
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Erro ao excluir equipe:', error);
      alert('Erro ao excluir equipe. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  // Re-geocodificar todas as equipes com TomTom
  const reGeocodificarTodas = async () => {
    setReGeocodificando(true);
    let atualizadas = 0;
    let erros = 0;

    for (const equipe of equipes) {
      if (!equipe.endereco || !equipe.cidade) continue;

      try {
        const novasCoordenadas = await reGeocodificarRegistro({
          endereco: equipe.endereco,
          numero: equipe.numero,
          bairro: equipe.bairro,
          cidade: equipe.cidade,
          estado: equipe.estado,
          cep: equipe.cep
        });

        if (novasCoordenadas) {
          await equipesService.atualizar(equipe.id, {
            latitude: novasCoordenadas.latitude,
            longitude: novasCoordenadas.longitude
          });
          atualizadas++;
        }
      } catch (error) {
        console.error(`Erro ao re-geocodificar ${equipe.nome}:`, error);
        erros++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await carregarDados();
    setReGeocodificando(false);
    alert(`Re-geocodificação concluída!\n✅ Atualizadas: ${atualizadas}\n❌ Erros: ${erros}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light light:text-gray-900 dark:text-white tracking-tight mb-1">
            Equipes
          </h1>
          <p className="text-sm light:text-gray-600 dark:text-gray-400 font-light">
            Acompanhe o desempenho de cada equipe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="group relative px-5 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <Icon name="add" className="text-[18px]" />
              <span>Nova Equipe</span>
            </div>
          </button>
        </div>
      </div>

      {/* Grid de cards com design minimalista */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-white rounded-full"></div>
          </div>
        ) : equipes.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="groups_off" className="text-6xl text-gray-500 mb-4" />
            <p className="text-gray-400">Nenhuma equipe cadastrada</p>
            <p className="text-xs text-gray-500 mt-2">Clique em "Nova Equipe" para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {equipes.map((equipe) => {
              // Calcular lideranças da equipe
              const liderancasDaEquipe = liderancas.filter(l => l.equipe_id === equipe.id);
              const liderancaIds = liderancasDaEquipe.map(l => l.id);
              // Calcular cadastros das lideranças da equipe
              const cadastrosDaEquipe = cadastros.filter(c => c.lideranca_id && liderancaIds.includes(c.lideranca_id));
              const totalCadastros = cadastrosDaEquipe.length;
              // Meta calculada pela soma das metas das lideranças
              const metaCalculada = liderancasDaEquipe.reduce((acc, l) => acc + (l.meta || 0), 0);
              const percentage = metaCalculada > 0 ? Math.round((totalCadastros / metaCalculada) * 100) : 0;
              return (
                <div
                  key={equipe.id}
                  onClick={() => navigate(`/teams/${equipe.id}`)}
                  className="group relative light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] light:hover:border-gray-300 dark:hover:border-white/10 transition-all duration-500 cursor-pointer overflow-hidden shadow-sm"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/[0.02] group-hover:to-white/[0.02] transition-all duration-500" />

                  <div className="relative p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-[${equipe.cor}]/30 text-gray-400 transition-transform duration-300 group-hover:scale-110`}>
                        <Icon name="groups" className="text-[22px]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => abrirModalExcluir(e, equipe.id, equipe.nome)}
                          className="text-gray-500 hover:text-red-500 transition-colors p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg"
                          title="Excluir equipe"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                        <div className="flex flex-col items-end">
                          <span className={`text-2xl font-light ${getProgressTextColor(percentage)} tracking-tight`}>
                            {percentage}%
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mt-0.5">
                            Progresso
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-base font-medium light:text-gray-900 dark:text-white mb-4 tracking-tight">
                      {equipe.nome}
                    </h3>

                    {/* Métricas em grid */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="light:bg-gray-50 dark:bg-white/[0.02] rounded-lg p-3 light:border-gray-200 dark:border-white/[0.03]">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Meta</p>
                        <p className="text-sm font-semibold light:text-gray-900 dark:text-white">{metaCalculada.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="light:bg-gray-50 dark:bg-white/[0.02] rounded-lg p-3 light:border-gray-200 dark:border-white/[0.03]">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Atingido</p>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{totalCadastros.toLocaleString('pt-BR')}</p>
                      </div>
                    </div>

                    {/* Barra de progresso minimalista */}
                    <div className="relative w-full h-1 bg-white/[0.05] rounded-full overflow-hidden mb-4">
                      <div
                        className={`absolute inset-y-0 left-0 ${getProgressColor(percentage)} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Footer com lideranças e CTA */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.05]">
                          <Icon name="people" className="text-[14px] text-gray-400" />
                        </div>
                        <span className="text-xs text-gray-400 font-light">
                          {liderancasDaEquipe.length} lideranças
                        </span>
                      </div>
                      <div className="flex items-center gap-1 light:text-gray-600 dark:text-gray-400 light:group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        <span className="text-xs font-medium">Detalhes</span>
                        <Icon name="arrow_forward" className="text-[14px] group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="light:bg-white dark:bg-[#1a2632] rounded-2xl light:border-gray-200 dark:border-white/10 max-w-3xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b light:border-gray-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-light light:text-gray-900 dark:text-white tracking-tight">Nova Equipe</h3>
                <p className="text-xs light:text-gray-600 dark:text-gray-400 mt-1 font-light">Preencha os dados para criar uma nova equipe</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="light:text-gray-600 dark:text-gray-400 light:hover:text-gray-900 dark:hover:text-white transition-colors p-2 light:hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-5 max-h-[70vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Nome da Equipe
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Equipe Oeste"
                  className="w-full px-4 py-3 light:bg-gray-50 dark:bg-white/5 light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white light:placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none light:focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Organização (Opcional)
                </label>
                <div className="relative">
                  <Icon name="business" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                  <select
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/5 light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white focus:outline-none light:focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-white dark:bg-[#1a1f2e] text-gray-400">Nenhuma organização</option>
                    {organizacoes.map(org => (
                      <option key={org.id} value={org.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{org.nome}</option>
                    ))}
                  </select>
                  <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
                </div>
              </div>

              {/* Seção de Localização */}
              <div className="border-t light:border-gray-200 dark:border-white/10 pt-5">
                <h4 className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Icon name="location_on" className="text-[16px] text-[#1e5a8d]" />
                  Localização da Equipe (para o mapa)
                </h4>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      CEP *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.cep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full px-4 py-3 light:bg-gray-50 dark:bg-white/5 light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white light:placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none light:focus:border-[#1e5a8d] dark:focus:border-white/20 transition-all"
                      />
                      {loadingCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-[#1e5a8d] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Rua
                    </label>
                    <input
                      type="text"
                      value={formData.rua}
                      onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                      placeholder="Preenchido automaticamente"
                      className="w-full px-4 py-3 light:bg-gray-50 dark:bg-white/5 light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white light:placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none light:focus:border-[#1e5a8d] dark:focus:border-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Número
                    </label>
                    <input
                      type="text"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      placeholder="Nº"
                      className="w-full px-4 py-3 light:bg-gray-50 dark:bg-white/5 light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white light:placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none light:focus:border-[#1e5a8d] dark:focus:border-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={formData.bairro}
                      readOnly
                      placeholder="Auto"
                      className="w-full px-4 py-3 light:bg-gray-100 dark:bg-white/[0.02] light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-600 dark:text-gray-400 light:placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={formData.cidade}
                      readOnly
                      placeholder="Auto"
                      className="w-full px-4 py-3 light:bg-gray-100 dark:bg-white/[0.02] light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-600 dark:text-gray-400 light:placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Estado
                    </label>
                    <input
                      type="text"
                      value={formData.estado}
                      readOnly
                      placeholder="Auto"
                      className="w-full px-4 py-3 light:bg-gray-100 dark:bg-white/[0.02] light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-600 dark:text-gray-400 light:placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Indicador de coordenadas */}
                {formData.latitude && formData.longitude && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                    <Icon name="check_circle" className="text-[14px]" />
                    <span>Coordenadas obtidas: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}</span>
                  </div>
                )}
              </div>

              {/* Nota: Coordenadores e Lideranças são adicionados nas suas respectivas páginas */}
              <div className="p-4 light:bg-gray-50 dark:bg-white/[0.02] rounded-xl light:border-gray-200 dark:border-white/10">
                <p className="text-xs light:text-gray-600 dark:text-gray-400 text-center">
                  💡 Após criar a equipe, adicione coordenadores e lideranças nas páginas específicas.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Cor da Equipe
                </label>
                <div className="grid grid-cols-10 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.hex })}
                      className={`w-8 h-8 rounded-lg transition-all duration-200 hover:scale-110 ${formData.color === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1117] scale-110' : 'hover:ring-1 hover:ring-white/30'}`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Cor selecionada: <span style={{ color: formData.color }}>{colorOptions.find(c => c.hex === formData.color)?.name || formData.color}</span></p>
              </div>

              <div className="flex gap-3 pt-2 border-t light:border-gray-200 dark:border-white/10 mt-6">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ name: '', color: '0', coordinators: [], leaders: [] });
                  }}
                  className="flex-1 px-5 py-3 light:bg-gray-50 dark:bg-white/5 light:border-gray-200 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white light:hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all font-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Criando...</>
                  ) : (
                    <>Criar Equipe</>
                  )}
                </button>
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
        title="Excluir Equipe"
        message={`Tem certeza que deseja excluir a equipe "${deleteTarget?.nome}"? As lideranças e cadastros vinculados a esta equipe também serão afetados. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleting}
      />

    </div>
  );
};

export default Teams;
