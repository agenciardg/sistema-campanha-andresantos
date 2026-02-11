import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { adminService, Admin, CreateAdminData } from '../lib/adminService';

interface AdminForm {
  email: string;
  password: string;
  confirmPassword: string;
  nome: string;
  telefone: string;
  role: 'superadmin' | 'user';
}

const SuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estados de autorização
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');

  // Estados da página
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<AdminForm>({
    email: '',
    password: '',
    confirmPassword: '',
    nome: '',
    telefone: '',
    role: 'superadmin',
  });

  // Verificar autorização
  useEffect(() => {
    const verificarAutorizacao = () => {
      if (!user) {
        setAuthError('Usuário não autenticado');
        setAuthChecking(false);
        return;
      }

      const userRole = (user as any).app_metadata?.role;

      if (userRole === 'superadmin') {
        setIsAuthorized(true);
        setAuthError('');
      } else {
        setAuthError('Você não tem permissão para acessar esta área');
        setIsAuthorized(false);
      }

      setAuthChecking(false);
    };

    verificarAutorizacao();
  }, [user]);

  // Carregar admins
  const carregarAdmins = async () => {
    try {
      setLoading(true);
      const lista = await adminService.listar();
      // Filtrar para mostrar apenas superadmins
      const superadmins = lista.filter(a => a.role === 'superadmin');
      setAdmins(superadmins);
    } catch (error: any) {
      console.error('Erro ao carregar admins:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      carregarAdmins();
    }
  }, [isAuthorized]);

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!editingAdmin) {
      // Criando novo
      if (formData.password !== formData.confirmPassword) {
        setFormError('As senhas não coincidem');
        return;
      }

      if (formData.password.length < 6) {
        setFormError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
    }

    try {
      setLoading(true);

      if (editingAdmin) {
        // Atualizando
        await adminService.atualizar(editingAdmin.id, {
          nome: formData.nome,
          telefone: formData.telefone,
          role: formData.role,
        });
      } else {
        // Criando novo
        await adminService.criar({
          email: formData.email,
          password: formData.password,
          nome: formData.nome,
          telefone: formData.telefone,
          role: formData.role,
        });
      }

      await carregarAdmins();
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setFormError(error.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      password: '',
      confirmPassword: '',
      nome: admin.nome || '',
      telefone: admin.telefone || '',
      role: admin.role as 'superadmin' | 'user',
    });
    setShowModal(true);
  };

  const handleToggle = async (admin: Admin) => {
    try {
      setLoading(true);
      await adminService.toggle(admin.id, !admin.ativo);
      await carregarAdmins();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      alert(error.message || 'Erro ao alterar status');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (admin: Admin) => {
    if (!confirm(`Tem certeza que deseja excluir o administrador ${admin.email}?`)) {
      return;
    }

    try {
      setLoading(true);
      await adminService.excluir(admin.id);
      await carregarAdmins();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      alert(error.message || 'Erro ao excluir');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingAdmin(null);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      nome: '',
      telefone: '',
      role: 'superadmin',
    });
    setFormError('');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Loading - Verificando autorização
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-[#0a0e13] dark:to-[#1a1f2e] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Acesso Negado
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-[#0a0e13] dark:to-[#1a1f2e] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <Icon name="block" className="text-red-400 text-4xl" />
          </div>
          <h1 className="text-2xl font-light text-gray-900 dark:text-white tracking-tight mb-2">Acesso Negado</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{authError}</p>

          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
            <div className="flex items-start gap-3 text-left mb-4">
              <Icon name="info" className="text-blue-500 dark:text-blue-400 text-xl mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Esta área é restrita a <strong className="text-gray-900 dark:text-white">Superadmins</strong>.
                </p>
                <p className="text-xs text-gray-500">
                  Usuário atual: {user?.email || 'Não identificado'}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.05] rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Icon name="arrow_back" className="text-[18px]" />
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Painel do Super Admin
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-[#0a0e13] dark:to-[#1a1f2e] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <Icon name="admin_panel_settings" className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-gray-900 dark:text-white tracking-tight">Super Admin</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gerenciamento de Administradores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Icon name="verified" className="text-[14px]" />
              Superadmin
            </span>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-xl transition-all flex items-center gap-2"
            >
              <Icon name="arrow_back" className="text-[18px]" />
              Voltar
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Icon name="shield" className="text-green-600 dark:text-green-400 text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">Acesso Autorizado</h3>
              <p className="text-sm text-green-700 dark:text-green-400/70 mt-1">
                Logado como <strong className="text-green-900 dark:text-white">{user?.email}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Botão Novo Admin */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Administradores do Sistema</h2>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-red-600/25 hover:shadow-red-600/40 flex items-center gap-2"
          >
            <Icon name="add" className="text-[18px]" />
            Novo Administrador
          </button>
        </div>

        {/* Lista de Admins */}
        <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/[0.05] overflow-hidden">
          {loading && admins.length === 0 ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
            </div>
          ) : admins.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-white/[0.03] flex items-center justify-center">
                <Icon name="person_off" className="text-gray-400 dark:text-gray-500 text-3xl" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">Nenhum administrador cadastrado</p>
              <p className="text-sm text-gray-500">Clique no botão acima para criar o primeiro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Administrador</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Último Acesso</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/30 to-red-700/30 flex items-center justify-center text-red-600 dark:text-red-400 text-xs font-medium">
                            {(admin.nome || admin.email).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{admin.nome || '-'}</p>
                            <p className="text-xs text-gray-500">{admin.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{admin.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-lg ${admin.ativo ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                          {admin.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDate(admin.last_sign_in_at)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(admin)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="Editar"
                          >
                            <Icon name="edit" className="text-[16px]" />
                          </button>
                          {admin.id !== user?.id && (
                            <>
                              <button
                                onClick={() => handleToggle(admin)}
                                className={`p-2 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors ${admin.ativo ? 'text-green-500' : 'text-red-500'}`}
                                title={admin.ativo ? 'Desativar' : 'Ativar'}
                              >
                                <Icon name={admin.ativo ? 'toggle_on' : 'toggle_off'} className="text-[20px]" />
                              </button>
                              <button
                                onClick={() => handleDelete(admin)}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Excluir"
                              >
                                <Icon name="delete" className="text-[16px]" />
                              </button>
                            </>
                          )}
                          {admin.id === user?.id && (
                            <span className="text-xs text-gray-400 italic">Você</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Novo/Editar Admin */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gradient-to-br dark:from-[#1a1f2e] dark:to-[#151923] rounded-2xl border border-gray-200 dark:border-white/10 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white tracking-tight">
                  {editingAdmin ? 'Editar' : 'Novo'} Administrador
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-light">
                  {editingAdmin ? 'Atualize os dados do administrador' : 'Preencha os dados de acesso'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: João Silva"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-red-500 dark:focus:border-red-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[18px]" />
                    <input
                      type="email"
                      required
                      disabled={!!editingAdmin}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="admin@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-red-500 dark:focus:border-red-500/50 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Telefone
                  </label>
                  <div className="relative">
                    <Icon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[18px]" />
                    <input
                      type="tel"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(85) 99999-9999"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-red-500 dark:focus:border-red-500/50 transition-all"
                    />
                  </div>
                </div>

                {!editingAdmin && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Senha <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[18px]" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-red-500 dark:focus:border-red-500/50 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Confirmar Senha <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[18px]" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          placeholder="Repita a senha"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-red-500 dark:focus:border-red-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {formError && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
                    <Icon name="error" className="text-[16px]" />
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-white/5 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-5 py-3 bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white transition-all font-light"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <>
                        <Icon name="check" className="text-[18px]" />
                        {editingAdmin ? 'Salvar' : 'Criar'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
