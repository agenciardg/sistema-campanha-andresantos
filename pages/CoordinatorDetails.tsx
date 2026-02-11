import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import QRCodeCard from '../components/QRCodeCard';
import * as XLSX from 'xlsx';
import { coordenadoresService, liderancasService, cadastrosService, Coordenador, Lideranca, Cadastro, Equipe, supabase } from '../lib/supabase';
import { gerarLinkCadastro } from '../services/linkService';
import { useConfig } from '../contexts/ConfigContext';

const CoordinatorDetails: React.FC = () => {
  const navigate = useNavigate();
  const { coordinatorId } = useParams<{ coordinatorId: string }>();
  const { getConfigValue, loading: configLoading } = useConfig();
  const baseUrlCadastro = getConfigValue('links.url_base_cadastro');
  const [loading, setLoading] = useState(true);
  const [coordenador, setCoordenador] = useState<Coordenador | null>(null);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeCoordenadores, setEquipeCoordenadores] = useState<{equipe_id: string, coordenador_id: string}[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [coordinatorId]);

  const carregarDados = async () => {
    if (!coordinatorId) return;
    try {
      setLoading(true);
      // Buscar dados do coordenador e vínculos com equipes
      const [coordData, ecData] = await Promise.all([
        coordenadoresService.buscarPorId(coordinatorId),
        supabase.from('pltdataandrebueno_equipe_coordenadores').select('equipe_id, coordenador_id').eq('coordenador_id', coordinatorId),
      ]);
      setCoordenador(coordData);
      const vinculos = ecData.data || [];
      setEquipeCoordenadores(vinculos);

      // Buscar apenas equipes deste coordenador (não todas)
      const equipeIds = vinculos.map((ec: any) => ec.equipe_id);
      if (equipeIds.length > 0) {
        const { data: equipesData } = await supabase
          .from('pltdataandrebueno_equipes')
          .select('*')
          .in('id', equipeIds);
        setEquipes(equipesData || []);

        // Buscar lideranças e cadastros em paralelo
        const liderPromises = equipeIds.map((eqId: string) => liderancasService.listarTodosPorEquipe(eqId));
        const [liderResults, cadData] = await Promise.all([
          Promise.all(liderPromises),
          cadastrosService.listarPorCoordenador(coordinatorId),
        ]);
        setLiderancas(liderResults.flat());
        setCadastros(cadData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular lideranças do coordenador
  const equipesDoCoord = equipeCoordenadores
    .filter(ec => ec.coordenador_id === coordinatorId)
    .map(ec => ec.equipe_id);
  const liderancasDoCoord = liderancas.filter(l => equipesDoCoord.includes(l.equipe_id));
  const liderancaIds = liderancasDoCoord.map(l => l.id);
  const cadastrosDoCoord = cadastros.filter(c => c.lideranca_id && liderancaIds.includes(c.lideranca_id));

  if (loading || configLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-white rounded-full mb-4"></div>
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!coordenador) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 rounded-2xl dark:bg-white/[0.03] light:bg-gray-50 flex items-center justify-center mb-4">
          <Icon name="error_outline" className="text-gray-500 text-3xl" />
        </div>
        <p className="dark:text-white light:text-gray-900 text-lg font-light mb-3">Coordenador não encontrado</p>
        <button
          onClick={() => navigate('/coordinators')}
          className="text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors text-sm font-medium"
        >
          ← Voltar para Coordenadores
        </button>
      </div>
    );
  }

  const totalLiderancas = liderancasDoCoord.length;
  const totalCadastros = cadastrosDoCoord.length;
  const meta = coordenador.meta || 0;
  const percentage = meta > 0 ? Math.round((totalCadastros / meta) * 100) : 0;

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-[#1e5a8d]';
    return 'bg-amber-500';
  };

  const handleExportToExcel = () => {
    const exportData = liderancasDoCoord.map((lider) => {
      const cadLider = cadastros.filter(c => c.lideranca_id === lider.id).length;
      return {
        Nome: lider.nome,
        Cadastros: cadLider,
        Meta: lider.meta || 0,
        'Progresso (%)': lider.meta ? Math.round((cadLider / lider.meta) * 100) : 0,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lideranças');

    const fileName = `liderancas_${coordenador.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/coordinators')}
          className="text-gray-400 hover:dark:text-white light:text-gray-900 transition-colors p-2 dark:hover:bg-white/5 light:hover:bg-gray-100 rounded-lg"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight mb-1">{coordenador.nome}</h1>
          <p className="text-sm text-gray-400 font-light">Detalhes do coordenador e lideranças vinculadas</p>
        </div>
        <button
          onClick={handleExportToExcel}
          className="group relative px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:scale-105"
        >
          <div className="flex items-center gap-2">
            <Icon name="download" className="text-[18px]" />
            <span>Exportar XLSX</span>
          </div>
        </button>
      </div>

      {/* Cards de Informações */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Lideranças</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="groups" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{totalLiderancas}</h3>
        </div>

        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Cadastros</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="people" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{totalCadastros}</h3>
        </div>

        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Meta</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="flag" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light dark:text-white light:text-gray-900 tracking-tight">{meta}</h3>
        </div>

        <div className="group dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-5 dark:hover:border-white/10 light:hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Progresso</p>
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <Icon name="trending_up" className="text-gray-400 text-[16px]" />
            </div>
          </div>
          <h3 className="text-2xl font-light text-emerald-400 tracking-tight">{percentage}%</h3>
        </div>
      </div>

      {/* Informações de Contato */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-6">
        <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight mb-4">Informações de Contato</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Icon name="location_on" className="text-gray-400 text-[18px]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Região</p>
              <p className="text-sm dark:text-white light:text-gray-900 font-medium">{coordenador.regiao || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Icon name="call" className="text-gray-400 text-[18px]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Telefone</p>
              <p className="text-sm dark:text-white light:text-gray-900 font-medium">{coordenador.telefone || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Icon name="mail" className="text-gray-400 text-[18px]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Email</p>
              <p className="text-sm dark:text-white light:text-gray-900 font-medium">{coordenador.email || '-'}</p>
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
              value={gerarLinkCadastro(baseUrlCadastro, coordenador.codigo_unico || '')}
              readOnly
              className="flex-1 px-3 py-2 text-sm rounded-lg dark:bg-white/5 light:bg-white dark:text-white light:text-gray-900 border dark:border-white/10 light:border-gray-300 focus:outline-none"
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(gerarLinkCadastro(baseUrlCadastro, coordenador.codigo_unico || ''));
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
              {coordenador.codigo_unico}
            </span>
          </div>
        </div>
      </div>

      {/* QR Code de Cadastro */}
      {coordenador.codigo_unico && (
        <QRCodeCard
          url={gerarLinkCadastro(baseUrlCadastro, coordenador.codigo_unico)}
          nome={coordenador.nome}
        />
      )}

      {/* Lista de Lideranças */}
      <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight">Lideranças Vinculadas</h2>
              <p className="text-xs text-gray-400 mt-1 font-light">{liderancasDoCoord.length} lideranças no total</p>
            </div>
          </div>
        </div>
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
              {liderancasDoCoord.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="person_off" className="text-4xl text-gray-500" />
                      <p className="text-gray-400">Nenhuma liderança vinculada</p>
                    </div>
                  </td>
                </tr>
              ) : (
                liderancasDoCoord.map((lider) => {
                  const cadLider = cadastros.filter(c => c.lideranca_id === lider.id).length;
                  const leaderPct = lider.meta ? Math.round((cadLider / lider.meta) * 100) : 0;
                  return (
                    <tr 
                      key={lider.id} 
                      onClick={() => navigate(`/leaders/${lider.id}`)}
                      className="hover:dark:bg-white/[0.02] light:hover:bg-gray-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium dark:text-white light:text-gray-900">{lider.nome}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm dark:text-white light:text-gray-900">{cadLider}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-400">{lider.meta || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[120px]">
                            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressColor(leaderPct)} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(leaderPct, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-300 min-w-[45px]">
                            {leaderPct}%
                          </span>
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
    </div>
  );
};

export default CoordinatorDetails;
