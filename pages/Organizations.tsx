import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import { organizacoesService, Organizacao } from '../lib/supabase';

// Cores por tipo de organização - com suporte para light e dark mode
const CORES_TIPO: { [key: string]: { bg: string; text: string; hex: string } } = {
  'Religioso': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', hex: '#9333ea' },
  'Sindicato': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', hex: '#f97316' },
  'Comunitário': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', hex: '#10b981' },
  'Empresarial': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', hex: '#3b82f6' },
  'Associação': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', hex: '#eab308' },
  'Educacional': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', hex: '#14b8a6' },
  'Esportivo': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', hex: '#ec4899' },
};

const getCorTipo = (tipo: string) => {
  return CORES_TIPO[tipo] || { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400', hex: '#6b7280' };
};

interface NewOrganizationForm {
  name: string;
}

const Organizations: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; nome: string } | null>(null);
  const [editNome, setEditNome] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<NewOrganizationForm>({
    name: '',
  });

  // Carregar organizações do Supabase
  const carregarOrganizacoes = async () => {
    try {
      setLoading(true);
      const data = await organizacoesService.listar();
      setOrganizacoes(data);
    } catch (error) {
      console.error('Erro ao carregar organizações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarOrganizacoes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      await organizacoesService.criar({
        nome: formData.name,
        tipo: 'Comunitário',
        tipo_personalizado: null,
        cep: null,
        endereco: null,
        numero: null,
        bairro: null,
        cidade: null,
        estado: null,
        latitude: null,
        longitude: null,
        ativo: true,
      });
      
      await carregarOrganizacoes();
      setShowModal(false);
      setFormData({ name: '' });
    } catch (error) {
      console.error('Erro ao criar organização:', error);
      alert('Erro ao criar organização. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de exclusão
  const abrirModalExcluir = (id: string, nome: string) => {
    setDeleteTarget({ id, nome });
    setShowDeleteModal(true);
  };

  const abrirModalEditar = (id: string, nome: string) => {
    setEditTarget({ id, nome });
    setEditNome(nome);
    setShowEditModal(true);
  };

  const confirmarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      setLoading(true);
      await organizacoesService.atualizar(editTarget.id, { nome: editNome.trim() });
      await carregarOrganizacoes();
      setShowEditModal(false);
      setEditTarget(null);
      setEditNome('');
    } catch (error) {
      console.error('Erro ao editar organização:', error);
      alert('Erro ao editar organização. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar exclusão
  const confirmarExclusao = async () => {
    if (!deleteTarget) return;
    
    try {
      setDeleting(true);
      await organizacoesService.excluir(deleteTarget.id);
      await carregarOrganizacoes();
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Erro ao excluir organização:', error);
      alert('Erro ao excluir organização. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-gray-900 dark:text-white tracking-tight mb-1">
            Organizações
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
            Gerencie suas bases de apoio e setores
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowModal(true)}
            className="group relative px-5 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <Icon name="add" className="text-[18px]" />
              <span>Nova Organização</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tabela com design minimalista */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="dark:bg-white/[0.02] light:bg-gray-50 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Organização</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-white rounded-full"></div>
                      <span className="text-gray-400">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : organizacoes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="domain_disabled" className="text-4xl text-gray-500" />
                      <p className="text-gray-400">Nenhuma organização cadastrada</p>
                      <p className="text-xs text-gray-500">Clique em "Nova Organização" para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                organizacoes.map((org) => {
                  const corTipo = getCorTipo(org.tipo);
                  const tipoExibir = org.tipo === 'Outros' && org.tipo_personalizado ? org.tipo_personalizado : org.tipo;
                  return (
                    <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${corTipo.bg} ${corTipo.text} text-xs font-medium`}>
                            <Icon name="domain" className="text-[18px]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{org.nome}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-lg ${corTipo.bg} ${corTipo.text}`}>{tipoExibir}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => abrirModalEditar(org.id, org.nome)}
                          className="text-gray-500 hover:text-blue-400 transition-colors p-2"
                          title="Editar organização"
                        >
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button 
                          onClick={() => abrirModalExcluir(org.id, org.nome)}
                          className="text-gray-500 hover:text-red-500 transition-colors p-2"
                          title="Excluir organização"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Editar Organização */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowEditModal(false);
            setEditTarget(null);
            setEditNome('');
          }}
        >
          <div
            className="bg-white dark:bg-gradient-to-br dark:from-[#1a1f2e] dark:to-[#151923] rounded-2xl border border-gray-200 dark:border-white/10 max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white tracking-tight">Editar Organização</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-light">Altere apenas o nome</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditTarget(null);
                  setEditNome('');
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <form onSubmit={confirmarEdicao} className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome da Organização <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="domain" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t border-white/5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditTarget(null);
                      setEditNome('');
                    }}
                    className="flex-1 px-5 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white transition-all font-light"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !editNome.trim()}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Icon name="check" className="text-[18px]" />
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Nova Organização */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gradient-to-br dark:from-[#1a1f2e] dark:to-[#151923] rounded-2xl border border-gray-200 dark:border-white/10 max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white tracking-tight">Nova Organização</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-light">Cadastro simplificado - vincule a equipes/lideranças depois</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-4">
                {/* Nome da Organização */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome da Organização <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="domain" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Igreja Batista Central"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                {/* Informação sobre vinculação */}
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Icon name="info" className="text-blue-600 dark:text-blue-400 text-[20px] mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Vinculação posterior</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400/70 mt-1">
                        Após criar a organização, você poderá vinculá-la a equipes, lideranças ou coordenadores nas respectivas páginas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t border-white/5 mt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '' });
                    }}
                    className="flex-1 px-5 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white transition-all font-light disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] dark:text-white light:text-gray-900 font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Criando...</>
                    ) : (
                      <><Icon name="check" className="text-[18px]" />Criar Organização</>
                    )}
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
        title="Excluir Organização"
        message={`Tem certeza que deseja excluir a organização "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleting}
      />
    </div>
  );
};

export default Organizations;
