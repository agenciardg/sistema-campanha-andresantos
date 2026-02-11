import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { equipesService, liderancasService, cadastrosService, organizacoesService, Equipe, Lideranca, Cadastro, Organizacao } from '../lib/supabase';
import { geocodificarEndereco } from '../lib/geocoding';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

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

interface EditForm {
  nome: string;
  cor: string;
  organizacao_id: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const TeamDetails: React.FC = () => {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [liderancaFiltroId, setLiderancaFiltroId] = useState('');
  const [cadastrosMin, setCadastrosMin] = useState('');
  const [cadastrosMax, setCadastrosMax] = useState('');
  const [editForm, setEditForm] = useState<EditForm>({
    nome: '',
    cor: '#1e3a5f',
    organizacao_id: '',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
  });
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [teamId]);

  const carregarDados = async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      const [equipeData, orgsData, liderData, cadData] = await Promise.all([
        equipesService.buscarPorId(teamId),
        organizacoesService.listar(),
        liderancasService.listarTodosPorEquipe(teamId),
        cadastrosService.listarPorEquipe(teamId),
      ]);
      setEquipe(equipeData);
      setOrganizacoes(orgsData);
      setLiderancas(liderData);
      setCadastros(cadData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de edição
  const abrirModalEdicao = () => {
    if (equipe) {
      setEditForm({
        nome: equipe.nome || '',
        cor: equipe.cor || '#1e3a5f',
        organizacao_id: equipe.organizacao_id || '',
        cep: equipe.cep || '',
        endereco: equipe.endereco || '',
        numero: equipe.numero || '',
        bairro: equipe.bairro || '',
        cidade: equipe.cidade || '',
        estado: equipe.estado || '',
      });
      setShowEditModal(true);
    }
  };

  // Buscar CEP
  const buscarCep = async (cepValue: string) => {
    const cepLimpo = cepValue.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
      if (response.ok) {
        const data = await response.json();
        setEditForm(prev => ({
          ...prev,
          endereco: data.street || '',
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

  // Obter coordenadas usando Nominatim
  const obterCoordenadas = async (enderecoCompleto: string, cidade: string, estado: string): Promise<{lat: number, lng: number} | null> => {
    try {
      const queryCompleta = `${enderecoCompleto}, ${cidade}, ${estado}, Brasil`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryCompleta)}&limit=1&addressdetails=1`, {
        headers: { 'User-Agent': 'CampaignManager/1.0' }
      });
      const data = await response.json();
      
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      
      // Fallback: busca sem número
      const enderecoSemNumero = enderecoCompleto.replace(/\s*\d+\s*$/, '').trim();
      if (enderecoSemNumero !== enderecoCompleto) {
        const queryFallback = `${enderecoSemNumero}, ${cidade}, ${estado}, Brasil`;
        const responseFallback = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryFallback)}&limit=1`, {
          headers: { 'User-Agent': 'CampaignManager/1.0' }
        });
        const dataFallback = await responseFallback.json();
        
        if (dataFallback && dataFallback.length > 0) {
          return { lat: parseFloat(dataFallback[0].lat), lng: parseFloat(dataFallback[0].lon) };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter coordenadas:', error);
      return null;
    }
  };

  // Salvar edição
  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    try {
      setSaving(true);
      
      // Geocodificar endereço usando serviço centralizado (TomTom > HERE > Nominatim)
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      if (editForm.endereco && editForm.cidade && editForm.estado) {
        const resultado = await geocodificarEndereco({
          cep: editForm.cep,
          rua: editForm.endereco,
          numero: editForm.numero,
          bairro: editForm.bairro,
          cidade: editForm.cidade,
          estado: editForm.estado
        });

        if (resultado.sucesso && resultado.coordenadas) {
          latitude = resultado.coordenadas.latitude;
          longitude = resultado.coordenadas.longitude;
        }
      }

      await equipesService.atualizar(teamId, {
        nome: editForm.nome,
        cor: editForm.cor,
        organizacao_id: editForm.organizacao_id || null,
        cep: editForm.cep || null,
        endereco: editForm.endereco || null,
        numero: editForm.numero || null,
        bairro: editForm.bairro || null,
        cidade: editForm.cidade || null,
        estado: editForm.estado || null,
        latitude,
        longitude,
      });

      await carregarDados();
      setShowEditModal(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  // Calcular lideranças da equipe
  const liderancasDaEquipe = liderancas.filter(l => l.equipe_id === teamId);
  const liderancaIds = liderancasDaEquipe.map(l => l.id);
  const cadastrosDaEquipe = cadastros.filter(c => c.lideranca_id && liderancaIds.includes(c.lideranca_id));

  const cutoff = (() => {
    if (periodo === 'all') return null;
    const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d;
  })();

  const cadastrosPeriodo = cutoff
    ? cadastrosDaEquipe.filter(c => c.criado_em && new Date(c.criado_em) >= cutoff)
    : cadastrosDaEquipe;

  const totalCadastros = cadastrosPeriodo.length;
  // Meta calculada pela soma das metas das lideranças
  const meta = liderancasDaEquipe.reduce((acc, l) => acc + (l.meta || 0), 0);
  const percentage = meta > 0 ? Math.round((totalCadastros / meta) * 100) : 0;

  const cadastrosDiarios = (() => {
    const byDay = new Map<string, number>();
    for (const c of cadastrosPeriodo) {
      if (!c.criado_em) continue;
      const d = new Date(c.criado_em);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }

    const keys = Array.from(byDay.keys()).sort();

    if (cutoff) {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
      const out: { dia: string; cadastros: number }[] = [];
      for (let i = 0; i < days; i++) {
        const cur = new Date(cutoff);
        cur.setDate(cutoff.getDate() + i);
        if (cur > end) break;
        const k = cur.toISOString().slice(0, 10);
        out.push({ dia: k, cadastros: byDay.get(k) || 0 });
      }
      return out;
    }

    return keys.map(k => ({ dia: k, cadastros: byDay.get(k) || 0 }));
  })();

  const liderancasRanking = (() => {
    const min = cadastrosMin.trim() === '' ? null : Number(cadastrosMin);
    const max = cadastrosMax.trim() === '' ? null : Number(cadastrosMax);

    const base = liderancasDaEquipe
      .map((lider) => {
        const cadLider = cadastrosPeriodo.filter(c => c.lideranca_id === lider.id).length;
        const liderMeta = lider.meta || 0;
        const liderPct = liderMeta > 0 ? Math.round((cadLider / liderMeta) * 100) : 0;
        const initials = lider.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return { ...lider, cadLider, liderMeta, liderPct, initials };
      })
      .sort((a, b) => b.cadLider - a.cadLider);

    const filtradoPorLideranca = liderancaFiltroId
      ? base.filter(l => l.id === liderancaFiltroId)
      : base;

    const filtradoPorRange = filtradoPorLideranca.filter(l => {
      if (min !== null && !Number.isNaN(min) && l.cadLider < min) return false;
      if (max !== null && !Number.isNaN(max) && l.cadLider > max) return false;
      return true;
    });

    return filtradoPorRange.slice(0, 10);
  })();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-white rounded-full mb-4"></div>
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!equipe) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 rounded-2xl dark:bg-white/[0.03] light:bg-gray-50 flex items-center justify-center mb-4">
          <Icon name="error_outline" className="text-gray-500 text-3xl" />
        </div>
        <p className="dark:text-white light:text-gray-900 text-lg font-light mb-3">Equipe não encontrada</p>
        <button
          onClick={() => navigate('/teams')}
          className="text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors text-sm font-medium"
        >
          ← Voltar para Equipes
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/teams')}
          className="text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors p-2 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: equipe.cor || '#1e3a5f' }}
          >
            <Icon name="groups" className="text-white text-[20px]" />
          </div>
          <div>
            <h1 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{equipe.nome}</h1>
            <p className="text-sm text-gray-400 font-light">Métricas detalhadas da equipe</p>
          </div>
        </div>
        <button
          onClick={abrirModalEdicao}
          className="flex items-center gap-2 px-4 py-2 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl text-gray-400 hover:dark:text-white light:text-gray-900 hover:dark:bg-white/[0.05] light:hover:bg-gray-100 transition-all"
        >
          <Icon name="edit" className="text-[16px]" />
          <span className="text-sm">Editar</span>
        </button>
      </div>

      {/* Informações da Equipe */}
      {(equipe.endereco || equipe.cidade || equipe.cep) && (
        <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-4">
          <div className="flex items-center gap-6 text-sm text-gray-400">
            {equipe.endereco && (
              <div className="flex items-center gap-2">
                <Icon name="location_on" className="text-[16px]" style={{ color: equipe.cor }} />
                <span>{equipe.endereco}{equipe.numero ? `, ${equipe.numero}` : ''}</span>
              </div>
            )}
            {equipe.bairro && (
              <div className="flex items-center gap-2">
                <Icon name="home" className="text-[16px]" style={{ color: equipe.cor }} />
                <span>{equipe.bairro}</span>
              </div>
            )}
            {equipe.cidade && (
              <div className="flex items-center gap-2">
                <Icon name="location_city" className="text-[16px]" style={{ color: equipe.cor }} />
                <span>{equipe.cidade}{equipe.estado ? ` - ${equipe.estado}` : ''}</span>
              </div>
            )}
            {equipe.cep && (
              <div className="flex items-center gap-2">
                <Icon name="mail" className="text-[16px]" style={{ color: equipe.cor }} />
                <span>CEP: {equipe.cep}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Meta</p>
              <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                <Icon name="flag" className="text-gray-400 text-[16px]" />
              </div>
            </div>
            <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{meta.toLocaleString('pt-BR')}</h3>
          </div>

          <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Atingido</p>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Icon name="trending_up" className="text-emerald-400 text-[16px]" />
              </div>
            </div>
            <h3 className="text-2xl font-light text-emerald-400 tracking-tight">{totalCadastros.toLocaleString('pt-BR')}</h3>
            <p className="text-[10px] text-gray-500 mt-1">{percentage}% da meta</p>
          </div>

          <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Membros</p>
              <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                <Icon name="people" className="text-gray-400 text-[16px]" />
              </div>
            </div>
            <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{liderancasDaEquipe.length}</h3>
            <p className="text-[10px] text-gray-500 mt-1">lideranças</p>
          </div>

          <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Conversão</p>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Icon name="verified" className="text-amber-400 text-[16px]" />
              </div>
            </div>
            <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{percentage}%</h3>
          </div>
        </div>

        <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-medium dark:text-white light:text-gray-900 tracking-tight">Cadastros diários</h3>
              <p className="text-xs text-gray-500 mt-1">Curva de cadastros por dia no período selecionado</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Período</span>
              <div className="relative">
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as any)}
                  className="pl-3 pr-9 py-2 text-xs dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all cursor-pointer appearance-none"
                >
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                  <option value="all">Tudo</option>
                </select>
                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={cadastrosDiarios} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickFormatter={(v) => {
                    if (typeof v !== 'string') return '';
                    const parts = v.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : v;
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    color: '#e5e7eb'
                  }}
                  labelFormatter={(label) => {
                    if (typeof label !== 'string') return '';
                    const d = new Date(label);
                    return isNaN(d.getTime()) ? label : d.toLocaleDateString('pt-BR');
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cadastros"
                  stroke={equipe.cor || '#1e3a5f'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-medium dark:text-white light:text-gray-900 tracking-tight">Lideranças da Equipe</h3>
              <p className="text-xs text-gray-500 mt-1">Ranking calculado pelo período selecionado</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Período</span>
              <div className="relative">
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as any)}
                  className="pl-3 pr-9 py-2 text-xs dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all cursor-pointer appearance-none"
                >
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                  <option value="all">Tudo</option>
                </select>
                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
              </div>

              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium ml-2">Liderança</span>
              <div className="relative">
                <select
                  value={liderancaFiltroId}
                  onChange={(e) => setLiderancaFiltroId(e.target.value)}
                  className="pl-3 pr-9 py-2 text-xs dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Todas</option>
                  {liderancasDaEquipe
                    .slice()
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                    .map(l => (
                      <option key={l.id} value={l.id}>{l.nome}</option>
                    ))}
                </select>
                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
              </div>

              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium ml-2">Cadastros</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={cadastrosMin}
                onChange={(e) => setCadastrosMin(e.target.value)}
                placeholder="Min"
                className="w-20 px-3 py-2 text-xs dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={cadastrosMax}
                onChange={(e) => setCadastrosMax(e.target.value)}
                placeholder="Max"
                className="w-20 px-3 py-2 text-xs dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
          </div>
          <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="dark:bg-white/[0.02] light:bg-gray-50 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Liderança</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Cadastros</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Meta</th>
                    <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {liderancasDaEquipe.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Icon name="person_off" className="text-4xl text-gray-500" />
                          <p className="text-gray-400">Nenhuma liderança vinculada</p>
                        </div>
                      </td>
                    </tr>
                  ) : liderancasRanking.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Icon name="filter_alt_off" className="text-4xl text-gray-500" />
                          <p className="text-gray-400">Nenhuma liderança encontrada para os filtros</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    liderancasRanking.map((lider, index) => (
                        <tr 
                          key={lider.id} 
                          onClick={() => navigate(`/leaders/${lider.id}`)}
                          className="hover:dark:bg-white/[0.02] light:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="h-9 w-9 rounded-xl bg-white/[0.05] flex items-center justify-center text-gray-400 text-xs font-medium border dark:border-white/10 light:border-gray-300">
                                  {lider.initials}
                                </div>
                                {index === 0 && lider.cadLider > 0 && (
                                  <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                                    <Icon name="star" className="text-[10px] dark:text-white light:text-gray-900" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="dark:text-white light:text-gray-900 text-sm font-medium">{lider.nome}</p>
                                <p className="text-gray-500 text-[10px]">
                                  {index === 0 && lider.cadLider > 0 ? '🏆 Top Performer' : `#${index + 1} da equipe`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-lg font-light dark:text-white light:text-gray-900">{lider.cadLider}</div>
                            <div className="text-[10px] text-gray-500">cadastros</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-400">{lider.liderMeta}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 max-w-[120px]">
                                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${lider.liderPct >= 80 ? 'bg-emerald-500' : lider.liderPct >= 50 ? 'bg-[#1e5a8d]' : 'bg-amber-500'} rounded-full transition-all duration-500`}
                                    style={{ width: `${Math.min(lider.liderPct, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-sm font-medium text-gray-300 min-w-[45px]">
                                {lider.liderPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="dark:bg-[#0d1117] light:bg-white rounded-2xl border dark:border-white/10 light:border-gray-200 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b dark:border-white/5 light:border-gray-100">
              <div>
                <h2 className="text-lg font-medium dark:text-white light:text-gray-900">Editar Equipe</h2>
                <p className="text-xs text-gray-500 mt-0.5">Atualize as informações da equipe</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:dark:text-white light:text-gray-900 transition-colors p-2 hover:dark:bg-white/5 light:hover:bg-gray-100 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <form onSubmit={salvarEdicao} className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-col gap-4">
                {/* Nome */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome da Equipe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nome}
                    onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                    className="w-full px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>

                {/* Cor */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cor da Equipe
                  </label>
                  <div className="grid grid-cols-10 gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, cor: color.hex })}
                        className={`w-7 h-7 rounded-lg transition-all duration-200 hover:scale-110 ${editForm.cor === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1117] scale-110' : 'hover:ring-1 hover:ring-white/30'}`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Organização */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Organização
                  </label>
                  <div className="relative">
                    <Icon name="business" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <select
                      value={editForm.organizacao_id}
                      onChange={(e) => setEditForm({ ...editForm, organizacao_id: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all cursor-pointer appearance-none"
                    >
                      <option value="">Nenhuma organização</option>
                      {organizacoes.map(org => (
                        <option key={org.id} value={org.id}>{org.nome}</option>
                      ))}
                    </select>
                    <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
                  </div>
                </div>

                {/* CEP */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">CEP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editForm.cep}
                      onChange={(e) => {
                        const cep = e.target.value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
                        setEditForm({ ...editForm, cep });
                        if (cep.replace(/\D/g, '').length === 8) {
                          buscarCep(cep);
                        }
                      }}
                      placeholder="00000-000"
                      className="flex-1 px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
                    />
                    {loadingCep && (
                      <div className="flex items-center px-3">
                        <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Endereço */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Rua</label>
                    <input
                      type="text"
                      value={editForm.endereco}
                      onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })}
                      className="w-full px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Número</label>
                    <input
                      type="text"
                      value={editForm.numero}
                      onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })}
                      className="w-full px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                </div>

                {/* Bairro e Cidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Bairro</label>
                    <input
                      type="text"
                      value={editForm.bairro}
                      onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })}
                      className="w-full px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Cidade</label>
                    <input
                      type="text"
                      value={editForm.cidade}
                      onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                      className="w-full px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                </div>

                {/* Estado */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</label>
                  <input
                    type="text"
                    value={editForm.estado}
                    onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full px-4 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl dark:text-white light:text-gray-900 focus:outline-none focus:border-white/20 transition-all uppercase"
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4 border-t dark:border-white/5 light:border-gray-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-5 py-3 dark:bg-white/[0.03] light:bg-gray-50 border dark:border-white/10 light:border-gray-300 rounded-xl text-gray-300 hover:bg-white/[0.05] hover:dark:text-white light:text-gray-900 transition-all font-light"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Icon name="check" className="text-[18px]" />
                        Salvar
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

export default TeamDetails;
