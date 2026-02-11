import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  XCircle,
  Edit2,
  Trash2,
  Calendar,
  List,
  AlertCircle,
  CalendarDays,
  Users,
  UserPlus,
  X,
  Send,
  FileText,
} from 'lucide-react';
import {
  tarefasService,
  responsaveisService,
  Tarefa,
  Responsavel,
  TarefaStatus,
  TarefaPrioridade,
} from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { notificarNovaTarefa, isNotificationServiceAvailable } from '../lib/notificationService';

// Configurações de status
const statusConfig: Record<TarefaStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: Circle },
  em_progresso: { label: 'Em Progresso', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: Clock },
  concluida: { label: 'Concluída', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: XCircle },
};

// Configurações de prioridade
const prioridadeConfig: Record<TarefaPrioridade, { label: string; color: string; bgColor: string; dotColor: string }> = {
  alta: { label: 'Alta', color: 'text-red-400', bgColor: 'bg-red-500/20', dotColor: 'bg-red-500' },
  media: { label: 'Média', color: 'text-amber-400', bgColor: 'bg-amber-500/20', dotColor: 'bg-amber-500' },
  baixa: { label: 'Baixa', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', dotColor: 'bg-emerald-500' },
};

// Dias da semana
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Componente do Modal de Tarefa (simplificado)
const TaskModal = memo(({
  isOpen,
  onClose,
  onSubmit,
  onRenotify,
  tarefa,
  loading,
  selectedDate,
  responsaveis,
  notificationAvailable,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Tarefa>, sendNotification: boolean) => Promise<void>;
  onRenotify: (tarefa: Tarefa) => Promise<void>;
  tarefa: Tarefa | null;
  loading: boolean;
  selectedDate: Date | null;
  responsaveis: Responsavel[];
  notificationAvailable: boolean;
}) => {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    status: 'pendente' as TarefaStatus,
    prioridade: 'media' as TarefaPrioridade,
    data_vencimento: '',
    responsavel_id: '',
  });
  const [sendNotification, setSendNotification] = useState(true);
  const [renotifying, setRenotifying] = useState(false);

  const handleRenotify = async () => {
    if (!tarefa) return;
    setRenotifying(true);
    try {
      await onRenotify(tarefa);
    } finally {
      setRenotifying(false);
    }
  };

  useEffect(() => {
    if (tarefa) {
      setFormData({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || '',
        status: tarefa.status,
        prioridade: tarefa.prioridade,
        data_vencimento: tarefa.data_vencimento ? tarefa.data_vencimento.slice(0, 16) : '',
        responsavel_id: tarefa.responsavel_id || '',
      });
      setSendNotification(false); // Ao editar, não notifica por padrão
    } else {
      const defaultDate = selectedDate || new Date();
      defaultDate.setHours(9, 0, 0, 0);
      setFormData({
        titulo: '',
        descricao: '',
        status: 'pendente',
        prioridade: 'media',
        data_vencimento: defaultDate.toISOString().slice(0, 16),
        responsavel_id: '',
      });
      setSendNotification(true); // Ao criar, notifica por padrão
    }
  }, [tarefa, isOpen, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Tarefa> = {
      titulo: formData.titulo,
      descricao: formData.descricao || null,
      status: formData.status,
      prioridade: formData.prioridade,
      data_vencimento: formData.data_vencimento ? new Date(formData.data_vencimento).toISOString() : null,
      responsavel_id: formData.responsavel_id || null,
      ativo: true,
    };
    await onSubmit(data, sendNotification);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md dark:bg-[#1a2632] light:bg-white rounded-2xl shadow-2xl border dark:border-white/10 light:border-gray-200">
        <div className="p-6 border-b dark:border-white/5 light:border-gray-200">
          <h2 className="text-lg font-semibold dark:text-white light:text-gray-900">
            {tarefa ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 light:text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full px-3 py-2 dark:bg-white/5 light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-lg dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Reunião com equipe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 light:text-gray-700 mb-1">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 dark:bg-white/5 light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-lg dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Detalhes da tarefa..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 light:text-gray-700 mb-1">Data e Hora</label>
            <input
              type="datetime-local"
              value={formData.data_vencimento}
              onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              className="w-full px-3 py-2 dark:bg-white/5 light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-lg dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 light:text-gray-700 mb-1">Responsável</label>
            <select
              value={formData.responsavel_id}
              onChange={(e) => setFormData({ ...formData, responsavel_id: e.target.value })}
              className="w-full px-3 py-2 dark:bg-white/5 light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-lg dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sem responsável</option>
              {responsaveis.map((resp) => (
                <option key={resp.id} value={resp.id}>
                  {resp.nome}{resp.cargo ? ` - ${resp.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 light:text-gray-700 mb-1">Prioridade</label>
              <select
                value={formData.prioridade}
                onChange={(e) => setFormData({ ...formData, prioridade: e.target.value as TarefaPrioridade })}
                className="w-full px-3 py-2 dark:bg-white/5 light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-lg dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 light:text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TarefaStatus })}
                className="w-full px-3 py-2 dark:bg-white/5 light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-lg dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="pendente">Pendente</option>
                <option value="em_progresso">Em Progresso</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          {/* Notificação WhatsApp - Nova tarefa */}
          {notificationAvailable && formData.responsavel_id && !tarefa && (
            <div className="flex items-center gap-3 p-3 dark:bg-emerald-500/10 light:bg-emerald-50 border dark:border-emerald-500/20 light:border-emerald-200 rounded-lg">
              <input
                type="checkbox"
                id="sendNotification"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
                className="w-4 h-4 text-emerald-500 bg-transparent border-emerald-500/50 rounded focus:ring-emerald-500/50"
              />
              <label htmlFor="sendNotification" className="text-sm dark:text-emerald-300 light:text-emerald-700 cursor-pointer">
                Notificar responsável via WhatsApp
              </label>
            </div>
          )}

          {/* Notificar Novamente - Tarefa existente */}
          {notificationAvailable && tarefa && tarefa.responsavel_id && (
            <div className="flex items-center justify-between p-3 dark:bg-blue-500/10 light:bg-blue-50 border dark:border-blue-500/20 light:border-blue-200 rounded-lg">
              <span className="text-sm dark:text-blue-300 light:text-blue-700">
                Reenviar notificação ao responsável
              </span>
              <button
                type="button"
                onClick={handleRenotify}
                disabled={renotifying}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {renotifying ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Notificar Novamente
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        <div className="p-6 border-t dark:border-white/5 light:border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium dark:text-gray-300 light:text-gray-600 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Salvando...' : tarefa ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
});

// Modal de Gerenciamento de Responsáveis
const ResponsaveisModal = memo(({
  isOpen,
  onClose,
  responsaveis,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  responsaveis: Responsavel[];
  onSave: (data: Partial<Responsavel>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [formData, setFormData] = useState({ nome: '', cargo: '', telefone: '', email: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({ nome: '', cargo: '', telefone: '', email: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await onSave({ id: editingId, ...formData });
      } else {
        await onSave({ ...formData, ativo: true });
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (resp: Responsavel) => {
    setFormData({
      nome: resp.nome,
      cargo: resp.cargo || '',
      telefone: resp.telefone || '',
      email: resp.email || '',
    });
    setEditingId(resp.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1a2632] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-transparent">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gerenciar Responsáveis
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-transparent">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome *"
                className="px-3 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                required
              />
              <input
                type="text"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Cargo"
                className="px-3 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="Telefone"
                className="px-3 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email"
                className="px-3 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !formData.nome.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-[#1e3a5f]/20"
              >
                <UserPlus className="w-4 h-4" />
                {editingId ? 'Atualizar' : 'Adicionar'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista de Responsáveis */}
        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-transparent">
          {responsaveis.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">Nenhum responsável cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {responsaveis.map((resp) => (
                <div
                  key={resp.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a5f] to-[#1e5a8d] rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white font-medium text-sm">
                      {resp.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{resp.nome}</p>
                    {resp.cargo && <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{resp.cargo}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(resp)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(resp.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Modal de Detalhes da Tarefa
const TaskDetailsModal = memo(({
  isOpen,
  onClose,
  tarefa,
  responsavelNome,
  onEdit,
  onDelete,
  onStatusChange,
  onRenotify,
  notificationAvailable,
}: {
  isOpen: boolean;
  onClose: () => void;
  tarefa: Tarefa | null;
  responsavelNome: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TarefaStatus) => void;
  onRenotify: () => void;
  notificationAvailable: boolean;
}) => {
  const [renotifying, setRenotifying] = useState(false);

  if (!isOpen || !tarefa) return null;

  const status = statusConfig[tarefa.status];
  const prioridade = prioridadeConfig[tarefa.prioridade];
  const StatusIcon = status.icon;
  const isOverdue = tarefa.data_vencimento &&
    new Date(tarefa.data_vencimento) < new Date() &&
    !['concluida', 'cancelada'].includes(tarefa.status);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const handleRenotify = async () => {
    setRenotifying(true);
    try {
      await onRenotify();
    } finally {
      setRenotifying(false);
    }
  };

  const dateTime = tarefa.data_vencimento ? formatDateTime(tarefa.data_vencimento) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-[#1a2632] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {/* Header com Status */}
        <div className={`p-4 border-b border-gray-200 dark:border-white/5 ${isOverdue ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-transparent'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${status.bgColor}`}>
                <StatusIcon className={`w-5 h-5 ${status.color}`} />
              </div>
              <div>
                <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                {isOverdue && (
                  <span className="ml-2 text-xs text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Atrasada
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5">
          {/* Título */}
          <div>
            <h2 className={`text-xl font-semibold text-gray-900 dark:text-white ${tarefa.status === 'concluida' ? 'line-through opacity-60' : ''}`}>
              {tarefa.titulo}
            </h2>
          </div>

          {/* Descrição */}
          {tarefa.descricao && (
            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{tarefa.descricao}</p>
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Prioridade */}
            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Prioridade</p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${prioridade.bgColor} ${prioridade.color}`}>
                <span className={`w-2 h-2 rounded-full ${prioridade.dotColor}`} />
                {prioridade.label}
              </span>
            </div>

            {/* Data/Hora */}
            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Data/Hora</p>
              {dateTime ? (
                <div>
                  <p className={`text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                    {dateTime.time}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {new Date(tarefa.data_vencimento!).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Não definida</p>
              )}
            </div>
          </div>

          {/* Responsável */}
          {responsavelNome && (
            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a5f] to-[#1e5a8d] rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white font-medium text-sm">
                      {responsavelNome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Responsável</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{responsavelNome}</p>
                  </div>
                </div>
                {notificationAvailable && (
                  <button
                    onClick={handleRenotify}
                    disabled={renotifying}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Enviar notificação WhatsApp"
                  >
                    {renotifying ? (
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Notificar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Alterar Status Rápido */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Alterar Status</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusConfig) as TarefaStatus[]).map((s) => {
                const cfg = statusConfig[s];
                const Icon = cfg.icon;
                const isActive = tarefa.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => !isActive && onStatusChange(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? `${cfg.bgColor} ${cfg.color} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1a2632] ${s === 'pendente' ? 'ring-gray-400' : s === 'em_progresso' ? 'ring-blue-400' : s === 'concluida' ? 'ring-emerald-400' : 'ring-red-400'}`
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex justify-between">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] rounded-lg transition-all shadow-lg shadow-[#1e3a5f]/20"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
});

// Página principal
const Tasks: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [notificationAvailable, setNotificationAvailable] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showResponsaveisModal, setShowResponsaveisModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Tarefa | null>(null);
  const [editingTask, setEditingTask] = useState<Tarefa | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tarefa | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterResponsavel, setFilterResponsavel] = useState<string>('');

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tarefasData, responsaveisData, notifAvailable] = await Promise.all([
        tarefasService.listarTodos(),
        responsaveisService.listarTodos(),
        isNotificationServiceAvailable(),
      ]);
      setTarefas(tarefasData);
      setResponsaveis(responsaveisData);
      setNotificationAvailable(notifAvailable);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Gerar dias do calendário
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];

    // Dias vazios antes do primeiro dia
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Dias do mês
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentDate]);

  // Tarefas por data
  const tarefasPorData = useMemo(() => {
    const map = new Map<string, Tarefa[]>();
    tarefas.forEach(tarefa => {
      if (tarefa.data_vencimento) {
        const dateKey = new Date(tarefa.data_vencimento).toDateString();
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(tarefa);
      }
    });
    return map;
  }, [tarefas]);

  // Tarefas do dia selecionado
  const tarefasDoDia = useMemo(() => {
    const dateKey = selectedDate.toDateString();
    return tarefasPorData.get(dateKey) || [];
  }, [selectedDate, tarefasPorData]);

  // Tarefas filtradas por data e responsável (para view de lista)
  const tarefasFiltradas = useMemo(() => {
    let filtered = tarefas;

    // Filtrar por data
    if (filterDate) {
      const filterDateObj = new Date(filterDate + 'T00:00:00');
      filtered = filtered.filter(tarefa => {
        if (!tarefa.data_vencimento) return false;
        const tarefaDate = new Date(tarefa.data_vencimento);
        return tarefaDate.toDateString() === filterDateObj.toDateString();
      });
    }

    // Filtrar por responsável
    if (filterResponsavel) {
      filtered = filtered.filter(tarefa => tarefa.responsavel_id === filterResponsavel);
    }

    return filtered;
  }, [tarefas, filterDate, filterResponsavel]);

  // Estatísticas
  const stats = useMemo(() => ({
    total: tarefas.length,
    pendentes: tarefas.filter(t => t.status === 'pendente').length,
    emProgresso: tarefas.filter(t => t.status === 'em_progresso').length,
    concluidas: tarefas.filter(t => t.status === 'concluida').length,
    atrasadas: tarefas.filter(t =>
      t.data_vencimento &&
      new Date(t.data_vencimento) < new Date() &&
      !['concluida', 'cancelada'].includes(t.status)
    ).length,
  }), [tarefas]);

  // Mapa de responsáveis por ID para lookup rápido
  const responsaveisMap = useMemo(() => {
    const map = new Map<string, Responsavel>();
    responsaveis.forEach(r => map.set(r.id, r));
    return map;
  }, [responsaveis]);

  const getResponsavelNome = useCallback((id: string | null) => {
    if (!id) return null;
    const resp = responsaveisMap.get(id);
    return resp ? resp.nome : null;
  }, [responsaveisMap]);

  // Navegação do calendário
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  // Handlers
  const handleSubmit = async (data: Partial<Tarefa>, sendNotification: boolean) => {
    try {
      setSaving(true);
      if (editingTask) {
        const atualizada = await tarefasService.atualizar(editingTask.id, data);
        setTarefas(prev => prev.map(t => t.id === editingTask.id ? atualizada : t));
      } else {
        const nova = await tarefasService.criar(data as Omit<Tarefa, 'id' | 'criado_em' | 'atualizado_em'>);
        setTarefas(prev => [nova, ...prev]);

        // Enviar notificação WhatsApp se habilitado e tem responsável
        if (sendNotification && data.responsavel_id && notificationAvailable) {
          const responsavel = responsaveis.find(r => r.id === data.responsavel_id);
          if (responsavel && responsavel.telefone) {
            try {
              await notificarNovaTarefa({
                titulo: data.titulo || '',
                descricao: data.descricao || undefined,
                prioridade: data.prioridade || 'media',
                data_vencimento: data.data_vencimento || undefined,
                responsavel_nome: responsavel.nome,
                responsavel_telefone: responsavel.telefone,
              });
              console.log('Notificação de tarefa enviada com sucesso');
            } catch (notifError) {
              console.error('Erro ao enviar notificação (tarefa criada):', notifError);
            }
          }
        }
      }
      setShowModal(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
    } finally {
      setSaving(false);
    }
  };

  // Renotificar tarefa existente
  const handleRenotify = async (tarefa: Tarefa) => {
    if (!tarefa.responsavel_id || !notificationAvailable) return;

    const responsavel = responsaveis.find(r => r.id === tarefa.responsavel_id);
    if (!responsavel || !responsavel.telefone) {
      alert('Responsável não possui telefone cadastrado.');
      return;
    }

    try {
      await notificarNovaTarefa({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || undefined,
        prioridade: tarefa.prioridade,
        data_vencimento: tarefa.data_vencimento || undefined,
        responsavel_nome: responsavel.nome,
        responsavel_telefone: responsavel.telefone,
      });
      alert('Notificação enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao renotificar:', error);
      alert('Erro ao enviar notificação. Verifique se o WhatsApp está conectado.');
    }
  };

  const handleStatusChange = async (tarefa: Tarefa, newStatus: TarefaStatus) => {
    // Update otimista
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, status: newStatus } : t));
    try {
      await tarefasService.atualizarStatus(tarefa.id, newStatus);
    } catch (error) {
      // Rollback em caso de erro
      setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, status: tarefa.status } : t));
      console.error('Erro ao atualizar status:', error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    // Update otimista
    setTarefas(prev => prev.filter(t => t.id !== deleteTarget.id));
    const backup = deleteTarget;
    setDeleteTarget(null);
    try {
      await tarefasService.excluir(backup.id);
    } catch (error) {
      // Rollback em caso de erro
      setTarefas(prev => [...prev, backup]);
      console.error('Erro ao excluir:', error);
    }
  };

  // Handlers para Responsáveis
  const handleSaveResponsavel = async (data: Partial<Responsavel>) => {
    try {
      if (data.id) {
        const atualizado = await responsaveisService.atualizar(data.id, data);
        setResponsaveis(prev => prev.map(r => r.id === data.id ? atualizado : r));
      } else {
        const novo = await responsaveisService.criar(data as Omit<Responsavel, 'id' | 'criado_em' | 'atualizado_em'>);
        setResponsaveis(prev => [...prev, novo]);
      }
    } catch (error) {
      console.error('Erro ao salvar responsável:', error);
    }
  };

  const handleDeleteResponsavel = async (id: string) => {
    try {
      await responsaveisService.excluir(id);
      setResponsaveis(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Erro ao excluir responsável:', error);
    }
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isSelected = (date: Date) => date.toDateString() === selectedDate.toDateString();

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight mb-1">
            Agenda de Tarefas
          </h1>
          <p className="text-sm dark:text-gray-400 light:text-gray-600">
            Organize suas tarefas e compromissos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex dark:bg-white/5 light:bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-primary text-white' : 'dark:text-gray-400 light:text-gray-600'}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'dark:text-gray-400 light:text-gray-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowResponsaveisModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 dark:bg-white/5 light:bg-gray-100 dark:hover:bg-white/10 light:hover:bg-gray-200 dark:text-gray-300 light:text-gray-700 text-sm font-medium rounded-xl transition-all"
            title="Gerenciar Responsáveis"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Responsáveis</span>
          </button>
          <button
            onClick={() => { setEditingTask(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Pendentes', value: stats.pendentes, color: 'text-gray-400' },
          { label: 'Em Progresso', value: stats.emProgresso, color: 'text-blue-400' },
          { label: 'Concluídas', value: stats.concluidas, color: 'text-emerald-400' },
          { label: 'Atrasadas', value: stats.atrasadas, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="dark:bg-white/[0.03] light:bg-white light:shadow-sm border dark:border-white/5 light:border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xs dark:text-gray-500 light:text-gray-600">{stat.label}</p>
            <p className={`text-xl font-semibold dark:${stat.color} light:text-gray-900`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendário */}
          <div className="lg:col-span-2 dark:bg-white/[0.02] light:bg-white light:shadow-sm border dark:border-white/5 light:border-gray-200 rounded-2xl p-6">
            {/* Header do Calendário */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium dark:text-white light:text-gray-900">
                {meses[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-xs font-medium dark:text-gray-300 light:text-gray-700 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hoje
                </button>
                <button
                  onClick={prevMonth}
                  className="p-2 dark:text-gray-400 light:text-gray-600 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 dark:text-gray-400 light:text-gray-600 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {diasSemana.map((dia) => (
                <div key={dia} className="text-center text-xs font-medium dark:text-gray-500 light:text-gray-500 py-2">
                  {dia}
                </div>
              ))}
            </div>

            {/* Dias do Mês */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const dayTasks = tarefasPorData.get(date.toDateString()) || [];
                const hasHighPriority = dayTasks.some(t => t.prioridade === 'alta' && t.status !== 'concluida');
                const hasOverdue = dayTasks.some(t =>
                  new Date(t.data_vencimento!) < new Date() &&
                  !['concluida', 'cancelada'].includes(t.status)
                );

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      aspect-square p-1 rounded-xl transition-all relative flex flex-col items-center justify-center
                      ${isSelected(date) ? 'bg-primary text-white' : ''}
                      ${isToday(date) && !isSelected(date) ? 'ring-2 ring-primary/50' : ''}
                      ${!isSelected(date) ? 'dark:hover:bg-white/5 light:hover:bg-gray-100' : ''}
                    `}
                  >
                    <span className={`text-sm ${isSelected(date) ? 'font-semibold' : isToday(date) ? 'font-medium dark:text-primary light:text-primary' : 'dark:text-gray-300 light:text-gray-700'}`}>
                      {date.getDate()}
                    </span>

                    {/* Indicadores de tarefas */}
                    {dayTasks.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        {hasHighPriority && !hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        {!hasOverdue && !hasHighPriority && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        {dayTasks.length > 1 && (
                          <span className={`text-[10px] ${isSelected(date) ? 'text-white/70' : 'dark:text-gray-500 light:text-gray-500'}`}>
                            +{dayTasks.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarefas do Dia */}
          <div className="dark:bg-white/[0.02] light:bg-white light:shadow-sm border dark:border-white/5 light:border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium dark:text-white light:text-gray-900">
                  {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="text-xs dark:text-gray-500 light:text-gray-500 mt-0.5">
                  {tarefasDoDia.length} {tarefasDoDia.length === 1 ? 'tarefa' : 'tarefas'}
                </p>
              </div>
              <button
                onClick={() => { setEditingTask(null); setShowModal(true); }}
                className="p-2 dark:text-gray-400 light:text-gray-600 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {tarefasDoDia.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="w-10 h-10 mx-auto mb-2 dark:text-gray-600 light:text-gray-400" />
                  <p className="text-sm dark:text-gray-500 light:text-gray-500">Nenhuma tarefa para este dia</p>
                </div>
              ) : (
                tarefasDoDia
                  .sort((a, b) => new Date(a.data_vencimento!).getTime() - new Date(b.data_vencimento!).getTime())
                  .map((tarefa) => {
                    const status = statusConfig[tarefa.status];
                    const prioridade = prioridadeConfig[tarefa.prioridade];
                    const StatusIcon = status.icon;
                    const isOverdue = tarefa.data_vencimento &&
                      new Date(tarefa.data_vencimento) < new Date() &&
                      !['concluida', 'cancelada'].includes(tarefa.status);

                    return (
                      <div
                        key={tarefa.id}
                        onClick={() => { setSelectedTaskForDetails(tarefa); setShowDetailsModal(true); }}
                        className={`
                          p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] hover:shadow-lg
                          ${isOverdue ? 'border-red-500/30 bg-red-50 dark:bg-red-500/5' : 'border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.05]'}
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(tarefa, tarefa.status === 'concluida' ? 'pendente' : 'concluida'); }}
                            className={`mt-0.5 ${status.color} hover:scale-110 transition-transform`}
                          >
                            <StatusIcon className="w-5 h-5" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${prioridade.dotColor}`} />
                              {tarefa.data_vencimento && (
                                <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-500 dark:text-gray-500'}`}>
                                  {formatTime(tarefa.data_vencimento)}
                                </span>
                              )}
                              {isOverdue && <AlertCircle className="w-3 h-3 text-red-400" />}
                            </div>
                            <p className={`text-sm font-medium ${tarefa.status === 'concluida' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                              {tarefa.titulo}
                            </p>
                            {tarefa.descricao && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-1">
                                {tarefa.descricao}
                              </p>
                            )}
                            {tarefa.responsavel_id && getResponsavelNome(tarefa.responsavel_id) && (
                              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {getResponsavelNome(tarefa.responsavel_id)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTask(tarefa); setShowModal(true); }}
                              className="p-1 text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(tarefa); }}
                              className="p-1 text-gray-500 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tabela de todas as tarefas */
        <div className="dark:bg-white/[0.02] light:bg-white light:shadow-sm border dark:border-white/5 light:border-gray-200 rounded-2xl overflow-hidden">
          {/* Filtros */}
          <div className="p-4 border-b dark:border-white/5 light:border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Filtro por Data */}
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 dark:text-gray-400 light:text-gray-500" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-2 dark:bg-white/5 light:bg-gray-100 border dark:border-white/10 light:border-gray-300 rounded-lg text-sm dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Filtrar por data"
                />
              </div>

              {/* Filtro por Responsável */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 dark:text-gray-400 light:text-gray-500" />
                <select
                  value={filterResponsavel}
                  onChange={(e) => setFilterResponsavel(e.target.value)}
                  className="px-3 py-2 dark:bg-white/5 light:bg-gray-100 border dark:border-white/10 light:border-gray-300 rounded-lg text-sm dark:text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[180px]"
                >
                  <option value="">Todos os responsáveis</option>
                  {responsaveis.map((resp) => (
                    <option key={resp.id} value={resp.id}>
                      {resp.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botão Limpar Filtros */}
              {(filterDate || filterResponsavel) && (
                <button
                  onClick={() => { setFilterDate(''); setFilterResponsavel(''); }}
                  className="px-3 py-2 text-xs font-medium dark:text-gray-400 light:text-gray-600 dark:hover:text-white light:hover:text-gray-900 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Limpar filtros
                </button>
              )}

              {/* Contagem de resultados */}
              <div className="sm:ml-auto">
                <span className="text-xs dark:text-gray-500 light:text-gray-500">
                  {tarefasFiltradas.length} tarefa{tarefasFiltradas.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Tabela */}
          {tarefasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 dark:text-gray-600 light:text-gray-400" />
              <p className="dark:text-gray-400 light:text-gray-600">
                {(filterDate || filterResponsavel) ? 'Nenhuma tarefa encontrada com os filtros aplicados' : 'Nenhuma tarefa cadastrada'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="dark:bg-white/[0.02] light:bg-gray-50 border-b dark:border-white/5 light:border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium dark:text-gray-400 light:text-gray-500 uppercase tracking-wider w-12">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium dark:text-gray-400 light:text-gray-500 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium dark:text-gray-400 light:text-gray-500 uppercase tracking-wider w-24">
                      Prioridade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium dark:text-gray-400 light:text-gray-500 uppercase tracking-wider w-40">
                      Data/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium dark:text-gray-400 light:text-gray-500 uppercase tracking-wider w-40">
                      Responsável
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium dark:text-gray-400 light:text-gray-500 uppercase tracking-wider w-24">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/5 light:divide-gray-100">
                  {tarefasFiltradas
                    .sort((a, b) => {
                      if (!a.data_vencimento) return 1;
                      if (!b.data_vencimento) return -1;
                      return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
                    })
                    .map((tarefa) => {
                      const status = statusConfig[tarefa.status];
                      const prioridade = prioridadeConfig[tarefa.prioridade];
                      const StatusIcon = status.icon;
                      const isOverdue = tarefa.data_vencimento &&
                        new Date(tarefa.data_vencimento) < new Date() &&
                        !['concluida', 'cancelada'].includes(tarefa.status);

                      return (
                        <tr
                          key={tarefa.id}
                          className={`
                            group dark:hover:bg-white/[0.02] light:hover:bg-gray-50 transition-colors
                            ${isOverdue ? 'dark:bg-red-500/5 light:bg-red-50/50' : ''}
                          `}
                        >
                          {/* Status */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleStatusChange(tarefa, tarefa.status === 'concluida' ? 'pendente' : 'concluida')}
                              className={`${status.color} hover:scale-110 transition-transform`}
                              title={status.label}
                            >
                              <StatusIcon className="w-5 h-5" />
                            </button>
                          </td>

                          {/* Título */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className={`font-medium text-sm ${tarefa.status === 'concluida' ? 'line-through dark:text-gray-500 light:text-gray-400' : 'dark:text-white light:text-gray-900'}`}>
                                {tarefa.titulo}
                              </span>
                              {tarefa.descricao && (
                                <span className="text-xs dark:text-gray-500 light:text-gray-500 line-clamp-1 mt-0.5">
                                  {tarefa.descricao}
                                </span>
                              )}
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1 text-xs text-red-400 mt-1">
                                  <AlertCircle className="w-3 h-3" /> Atrasada
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Prioridade */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${prioridade.bgColor} ${prioridade.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${prioridade.dotColor}`} />
                              {prioridade.label}
                            </span>
                          </td>

                          {/* Data/Hora */}
                          <td className="px-4 py-3">
                            {tarefa.data_vencimento ? (
                              <span className={`text-sm ${isOverdue ? 'text-red-400' : 'dark:text-gray-300 light:text-gray-700'}`}>
                                {new Date(tarefa.data_vencimento).toLocaleDateString('pt-BR', {
                                  day: '2-digit', month: 'short'
                                })}
                                <span className="dark:text-gray-500 light:text-gray-500 ml-1">
                                  {new Date(tarefa.data_vencimento).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </span>
                            ) : (
                              <span className="text-sm dark:text-gray-600 light:text-gray-400">-</span>
                            )}
                          </td>

                          {/* Responsável */}
                          <td className="px-4 py-3">
                            {tarefa.responsavel_id && getResponsavelNome(tarefa.responsavel_id) ? (
                              <span className="text-sm text-primary">
                                {getResponsavelNome(tarefa.responsavel_id)}
                              </span>
                            ) : (
                              <span className="text-sm dark:text-gray-600 light:text-gray-400">-</span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => { setEditingTask(tarefa); setShowModal(true); }}
                                className="p-1.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(tarefa)}
                                className="p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <TaskModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
        onSubmit={handleSubmit}
        onRenotify={handleRenotify}
        tarefa={editingTask}
        loading={saving}
        selectedDate={selectedDate}
        responsaveis={responsaveis}
        notificationAvailable={notificationAvailable}
      />

      {/* Modal de Responsáveis */}
      <ResponsaveisModal
        isOpen={showResponsaveisModal}
        onClose={() => setShowResponsaveisModal(false)}
        responsaveis={responsaveis}
        onSave={handleSaveResponsavel}
        onDelete={handleDeleteResponsavel}
      />

      {/* Modal de Detalhes da Tarefa */}
      <TaskDetailsModal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedTaskForDetails(null); }}
        tarefa={selectedTaskForDetails}
        responsavelNome={selectedTaskForDetails?.responsavel_id ? getResponsavelNome(selectedTaskForDetails.responsavel_id) : null}
        onEdit={() => {
          setShowDetailsModal(false);
          setEditingTask(selectedTaskForDetails);
          setShowModal(true);
        }}
        onDelete={() => {
          setShowDetailsModal(false);
          setDeleteTarget(selectedTaskForDetails);
        }}
        onStatusChange={async (newStatus) => {
          if (selectedTaskForDetails) {
            await handleStatusChange(selectedTaskForDetails, newStatus);
            // Atualiza a tarefa selecionada com o novo status
            setSelectedTaskForDetails({ ...selectedTaskForDetails, status: newStatus });
          }
        }}
        onRenotify={async () => {
          if (selectedTaskForDetails) {
            await handleRenotify(selectedTaskForDetails);
          }
        }}
        notificationAvailable={notificationAvailable}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir Tarefa"
        message={`Tem certeza que deseja excluir "${deleteTarget?.titulo}"?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
};

export default Tasks;
