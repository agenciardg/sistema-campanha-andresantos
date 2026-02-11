import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import QRCodeCard from '../components/QRCodeCard';
import * as XLSX from 'xlsx';
import { liderancasService, equipesService, cadastrosService, Lideranca, Equipe, Cadastro } from '../lib/supabase';
import { gerarLinkCadastro } from '../services/linkService';
import { useConfig } from '../contexts/ConfigContext';

const LeaderDetails: React.FC = () => {
  const navigate = useNavigate();
  const { leaderId } = useParams<{ leaderId: string }>();
  const { getConfigValue, loading: configLoading } = useConfig();
  const baseUrlCadastro = getConfigValue('links.url_base_cadastro');
  const [loading, setLoading] = useState(true);
  const [lideranca, setLideranca] = useState<Lideranca | null>(null);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [leaderId]);

  const carregarDados = async () => {
    if (!leaderId) return;
    try {
      setLoading(true);
      const [liderData, cadData] = await Promise.all([
        liderancasService.buscarPorId(leaderId),
        cadastrosService.listarPorLideranca(leaderId),
      ]);
      setLideranca(liderData);
      setCadastros(cadData);
      
      if (liderData?.equipe_id) {
        const equipeData = await equipesService.buscarPorId(liderData.equipe_id);
        setEquipe(equipeData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || configLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-white rounded-full mb-4"></div>
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!lideranca) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 rounded-2xl dark:bg-white/[0.03] light:bg-gray-50 flex items-center justify-center mb-4">
          <Icon name="error_outline" className="text-gray-500 text-3xl" />
        </div>
        <p className="dark:text-white light:text-gray-900 text-lg font-light mb-3">Liderança não encontrada</p>
        <button
          onClick={() => navigate('/leaders')}
          className="text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors text-sm font-medium"
        >
          ← Voltar para Lideranças
        </button>
      </div>
    );
  }

  const totalCadastros = cadastros.length;
  const meta = lideranca.meta || 0;
  const percentage = meta > 0 ? Math.round((totalCadastros / meta) * 100) : 0;
  const initials = lideranca.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleExportToExcel = () => {
    const exportData = cadastros.map((cad) => ({
      Nome: cad.nome,
      Telefone: cad.telefone || '-',
      Email: cad.email || '-',
      Bairro: cad.bairro || '-',
      Cidade: cad.cidade || '-',
      'Data de Cadastro': cad.criado_em ? new Date(cad.criado_em).toLocaleDateString('pt-BR') : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cadastros');

    const fileName = `cadastros_${lideranca.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/leaders')}
          className="text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors p-2 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight mb-1">{lideranca.nome}</h1>
          <p className="text-sm text-gray-400 font-light">Detalhes da liderança e cadastros realizados</p>
        </div>
        <button
          onClick={handleExportToExcel}
          className="group relative px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 dark:text-white light:text-gray-900 text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:scale-105"
        >
          <div className="flex items-center gap-2">
            <Icon name="download" className="text-[18px]" />
            <span>Exportar XLSX</span>
          </div>
        </button>
      </div>

      {/* Cards de Informações */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Cadastros</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="people" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{totalCadastros}</h3>
        </div>

        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Meta</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="flag" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{meta}</h3>
        </div>

        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Progresso</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="trending_up" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light text-emerald-400 tracking-tight">{percentage}%</h3>
        </div>

        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Código</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="tag" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light text-emerald-400 tracking-tight">{lideranca.codigo_unico}</h3>
        </div>
      </div>

      {/* Informações de Contato */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 p-6">
        <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight mb-4">Informações de Contato</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Icon name="groups" className="text-gray-400 text-[18px]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Equipe</p>
              <p className="text-sm dark:text-white light:text-gray-900 font-medium">{equipe?.nome || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Icon name="call" className="text-gray-400 text-[18px]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Telefone</p>
              <p className="text-sm dark:text-white light:text-gray-900 font-medium">{lideranca.telefone || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Icon name="mail" className="text-gray-400 text-[18px]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Email</p>
              <p className="text-sm dark:text-white light:text-gray-900 font-medium">{lideranca.email || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Link de Cadastro */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-6">
        <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight mb-4 flex items-center gap-2">
          <Icon name="link" className="text-[20px] text-[#1e5a8d]" />
          Link de Cadastro
        </h2>
        <div className="dark:bg-white/[0.02] light:bg-gray-50 rounded-xl p-4 border dark:border-white/[0.05] light:border-gray-200">
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
            Link para cadastro de apoiadores
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={gerarLinkCadastro(baseUrlCadastro, lideranca.codigo_unico || '')}
              readOnly
              className="flex-1 px-3 py-2 text-sm rounded-lg dark:bg-white/5 light:bg-white dark:text-white light:text-gray-900 border dark:border-white/10 light:border-gray-300 focus:outline-none"
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(gerarLinkCadastro(baseUrlCadastro, lideranca.codigo_unico || ''));
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                } catch (err) {
                  alert('Erro ao copiar link');
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                copiado
                  ? 'bg-green-500 text-white'
                  : 'bg-[#1e5a8d] hover:bg-[#2a6fa8] text-white'
              }`}
            >
              <Icon name={copiado ? 'check' : 'content_copy'} className="text-[16px]" />
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div className="mt-3 pt-3 border-t dark:border-white/[0.05] light:border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Código único:</span>
            <span className="font-mono text-sm dark:text-white light:text-gray-900 bg-[#1e5a8d]/10 px-2 py-1 rounded">
              {lideranca.codigo_unico}
            </span>
          </div>
        </div>
      </div>

      {/* QR Code de Cadastro */}
      {lideranca.codigo_unico && (
        <QRCodeCard
          url={gerarLinkCadastro(baseUrlCadastro, lideranca.codigo_unico)}
          nome={lideranca.nome}
        />
      )}

      {/* Lista de Cadastros */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:dark:border-white/[0.05] light:border-gray-200 light:border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight">Cadastros Realizados</h2>
              <p className="text-xs text-gray-400 mt-1 font-light">{cadastros.length} cadastros no total</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="dark:bg-white/[0.02] light:bg-gray-50 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Bairro</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {cadastros.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="person_off" className="text-4xl text-gray-500" />
                      <p className="text-gray-400">Nenhum cadastro realizado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                cadastros.map((cad) => (
                  <tr key={cad.id} className="hover:dark:bg-white/[0.02] light:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium dark:text-white light:text-gray-900">{cad.nome}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {cad.telefone && (
                          <a href={`tel:${cad.telefone}`} className="text-xs text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors flex items-center gap-1.5">
                            <Icon name="call" className="text-[14px]" />
                            {cad.telefone}
                          </a>
                        )}
                        {cad.email && (
                          <a href={`mailto:${cad.email}`} className="text-xs text-gray-500 hover:dark:text-white light:text-gray-900 transition-colors flex items-center gap-1.5 truncate max-w-[180px]">
                            <Icon name="mail" className="text-[14px]" />
                            {cad.email}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-400">{cad.bairro || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500">{cad.criado_em ? new Date(cad.criado_em).toLocaleDateString('pt-BR') : '-'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaderDetails;
