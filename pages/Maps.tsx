import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon';
import LeafletMapComplete from '../components/Map/LeafletMapComplete';
import { 
  organizacoesService, 
  equipesService, 
  coordenadoresService,
  liderancasService, 
  cadastrosService,
  Organizacao,
  Equipe,
  Coordenador,
  Lideranca,
  Cadastro
} from '../lib/supabase';

type Visualizacao = 'markers' | 'clusters';

const Maps: React.FC = () => {
  const [visualizacao, setVisualizacao] = useState<Visualizacao>('clusters');
  const [filtroEquipes, setFiltroEquipes] = useState<string[]>([]);
  const [mostrarOrganizacoes, setMostrarOrganizacoes] = useState(true);
  const [mostrarEquipes, setMostrarEquipes] = useState(true);
  const [mostrarLiderancas, setMostrarLiderancas] = useState(true);
  const [mostrarCadastros, setMostrarCadastros] = useState(true);
  const [mostrarCirculosCadastros, setMostrarCirculosCadastros] = useState(true);
  const [mostrarPontosCadastros, setMostrarPontosCadastros] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [coordenadores, setCoordenadores] = useState<Coordenador[]>([]);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);

  const [detailsModal, setDetailsModal] = useState<{ type: 'team' | 'leader' | 'coordinator'; id: string } | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const detail = ce.detail as { type?: string; id?: string } | undefined;
      if (!detail?.type || !detail?.id) return;

      if (detail.type === 'team' || detail.type === 'leader' || detail.type === 'coordinator') {
        setDetailsModal({ type: detail.type, id: detail.id });
      }
    };

    window.addEventListener('open-details', handler as EventListener);
    return () => window.removeEventListener('open-details', handler as EventListener);
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [orgsData, equipesData, coordenadoresData, liderancasData, cadastrosData] = await Promise.all([
        organizacoesService.listar(),
        equipesService.listar(),
        coordenadoresService.listar(),
        liderancasService.listar(),
        cadastrosService.listar(),
      ]);
      setOrganizacoes(orgsData);
      setEquipes(equipesData);
      setCoordenadores(coordenadoresData);
      setLiderancas(liderancasData);
      setCadastros(cadastrosData);
    } catch (error) {
      console.error('Erro ao carregar dados do mapa:', error);
    } finally {
      setLoading(false);
    }
  };

  const estatisticas = useMemo(() => ({
    totalOrganizacoes: organizacoes.length,
    totalEquipes: equipes.length,
    totalLiderancas: liderancas.length,
    totalCadastros: cadastros.length,
  }), [organizacoes, equipes, liderancas, cadastros]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleEquipe = (equipeId: string) => {
    setFiltroEquipes(prev => 
      prev.includes(equipeId) 
        ? prev.filter(id => id !== equipeId)
        : [...prev, equipeId]
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-light light:text-gray-900 dark:text-white tracking-tight mb-1">
            Mapa Eleitoral
          </h1>
          <p className="text-sm light:text-gray-600 dark:text-gray-400 font-light">
            Visualização georreferenciada de cadastros no Estado de São Paulo
          </p>
        </div>
      </div>

      {/* Layout principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Mapa - 3 colunas (ou tela inteira) */}
        <div className={`${isFullscreen ? 'fixed inset-0 z-[9999] p-0' : 'lg:col-span-3'}`}>
          <div className={`relative w-full ${isFullscreen ? 'h-full' : 'h-[600px]'} light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm ${isFullscreen ? 'rounded-none' : 'rounded-2xl'} border light:border-gray-200 dark:border-white/[0.05] overflow-hidden ${!isFullscreen ? 'light:shadow-sm' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin h-8 w-8 border-2 light:border-gray-500 dark:border-gray-500 light:border-t-white dark:border-t-white rounded-full"></div>
                  <span className="light:text-gray-600 dark:text-gray-400">Carregando mapa...</span>
                </div>
              </div>
            ) : (
              <LeafletMapComplete 
                organizacoes={organizacoes}
                equipes={equipes}
                coordenadores={coordenadores}
                liderancas={liderancas}
                cadastros={cadastros}
                filtroEquipes={filtroEquipes}
                visualizacao={visualizacao}
                mostrarOrganizacoes={mostrarOrganizacoes}
                mostrarEquipes={mostrarEquipes}
                mostrarLiderancas={mostrarLiderancas}
                mostrarCadastros={mostrarCadastros}
                mostrarCirculosCadastros={mostrarCirculosCadastros}
                mostrarPontosCadastros={mostrarPontosCadastros}
                isFullscreen={isFullscreen}
              />
            )}
            
            {/* Badge de contagem */}
            <div className="absolute top-4 left-4 z-[1000] light:bg-white/90 dark:bg-[#0f1419]/90 backdrop-blur-sm rounded-xl px-4 py-3 border light:border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] light:text-gray-500 dark:text-gray-400 uppercase">Organizações</p>
                  <p className="text-lg font-semibold light:text-gray-900 dark:text-white">{estatisticas.totalOrganizacoes}</p>
                </div>
                <div className="w-px h-8 light:bg-gray-300 dark:bg-gray-600"></div>
                <div>
                  <p className="text-[10px] light:text-gray-500 dark:text-gray-400 uppercase">Equipes</p>
                  <p className="text-lg font-semibold light:text-gray-900 dark:text-white">{estatisticas.totalEquipes}</p>
                </div>
                <div className="w-px h-8 light:bg-gray-300 dark:bg-gray-600"></div>
                <div>
                  <p className="text-[10px] light:text-gray-500 dark:text-gray-400 uppercase">Lideranças</p>
                  <p className="text-lg font-semibold light:text-gray-900 dark:text-white">{estatisticas.totalLiderancas}</p>
                </div>
                <div className="w-px h-8 light:bg-gray-300 dark:bg-gray-600"></div>
                <div>
                  <p className="text-[10px] light:text-gray-500 dark:text-gray-400 uppercase">Cadastros</p>
                  <p className="text-lg font-semibold light:text-gray-900 dark:text-white">{estatisticas.totalCadastros}</p>
                </div>
              </div>
            </div>

            {/* Botão Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-[1000] light:bg-white/90 dark:bg-[#0f1419]/90 backdrop-blur-sm rounded-xl p-3 border light:border-gray-200 dark:border-white/10 hover:bg-[#1e5a8d] hover:text-white transition-all group"
              title={isFullscreen ? 'Sair da tela inteira' : 'Expandir para tela inteira'}
            >
              <Icon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} className="text-[20px] light:text-gray-700 dark:text-white group-hover:text-white" />
            </button>
          </div>
        </div>

        {/* Sidebar - 1 coluna (esconder em fullscreen) */}
        <div className={`flex flex-col gap-4 ${isFullscreen ? 'hidden' : ''}`}>
          {/* Camadas do Mapa */}
          <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-5 light:shadow-sm">
            <h3 className="text-sm font-medium light:text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon name="layers" className="text-[16px] text-[#1e5a8d]" />
              Camadas
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={mostrarEquipes}
                  onChange={() => setMostrarEquipes(!mostrarEquipes)}
                  className="w-4 h-4 rounded light:border-gray-300 dark:border-gray-600 text-[#1e5a8d] focus:ring-[#1e5a8d] bg-transparent"
                />
                <div className="w-5 h-5 rounded-full bg-[#1e5a8d] flex items-center justify-center text-white text-[10px]">👥</div>
                <span className="text-sm light:text-gray-600 dark:text-gray-400 light:group-hover:text-gray-900 dark:group-hover:text-gray-300">
                  Equipes ({estatisticas.totalEquipes})
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={mostrarLiderancas}
                  onChange={() => setMostrarLiderancas(!mostrarLiderancas)}
                  className="w-4 h-4 rounded light:border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 bg-transparent"
                />
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-[8px]">👤</div>
                <span className="text-sm light:text-gray-600 dark:text-gray-400 light:group-hover:text-gray-900 dark:group-hover:text-gray-300">
                  Lideranças ({estatisticas.totalLiderancas})
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={mostrarCadastros}
                  onChange={() => setMostrarCadastros(!mostrarCadastros)}
                  className="w-4 h-4 rounded light:border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-transparent"
                />
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-sm light:text-gray-600 dark:text-gray-400 light:group-hover:text-gray-900 dark:group-hover:text-gray-300">
                  Cadastros ({estatisticas.totalCadastros})
                </span>
              </label>

              {/* Sub-opções de Cadastros */}
              {mostrarCadastros && (
                <div className="ml-7 space-y-2 mt-2 pt-2 border-t light:border-gray-200 dark:border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={mostrarCirculosCadastros}
                      onChange={() => setMostrarCirculosCadastros(!mostrarCirculosCadastros)}
                      className="w-3 h-3 rounded light:border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500 bg-transparent"
                    />
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500/20"></div>
                    <span className="text-xs light:text-gray-500 dark:text-gray-500 light:group-hover:text-gray-700 dark:group-hover:text-gray-400">
                      Círculos de raio
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={mostrarPontosCadastros}
                      onChange={() => setMostrarPontosCadastros(!mostrarPontosCadastros)}
                      className="w-3 h-3 rounded light:border-gray-300 dark:border-gray-600 light:text-gray-700 dark:text-gray-700 focus:ring-gray-700 bg-transparent"
                    />
                    <div className="w-2 h-2 rounded-full light:bg-gray-700 dark:bg-gray-700 border light:border-gray-300 dark:border-white"></div>
                    <span className="text-xs light:text-gray-500 dark:text-gray-500 light:group-hover:text-gray-700 dark:group-hover:text-gray-400">
                      Pontos centrais
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Filtrar por Equipe */}
          <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-5 light:shadow-sm">
            <h4 className="text-sm font-medium light:text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon name="filter_alt" className="text-[16px] text-[#1e5a8d]" />
              Filtrar por Equipe
            </h4>
            <div className="space-y-2">
              {equipes.length === 0 ? (
                <p className="text-xs light:text-gray-500 dark:text-gray-500">Nenhuma equipe cadastrada</p>
              ) : (
                equipes.map(equipe => (
                  <label key={equipe.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filtroEquipes.length === 0 || filtroEquipes.includes(equipe.id)}
                      onChange={() => toggleEquipe(equipe.id)}
                      className="w-4 h-4 rounded light:border-gray-300 dark:border-gray-600 focus:ring-[#1e5a8d] bg-transparent"
                      style={{ accentColor: equipe.cor }}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: equipe.cor }}
                    ></div>
                    <span className="text-sm light:text-gray-600 dark:text-gray-400 light:group-hover:text-gray-900 dark:group-hover:text-gray-300 flex-1">
                      {equipe.nome}
                    </span>
                    <span className="text-xs light:text-gray-500 dark:text-gray-500">
                      {cadastros.filter(c => liderancas.filter(l => l.equipe_id === equipe.id).some(l => l.id === c.lideranca_id)).length}
                    </span>
                  </label>
                ))
              )}
            </div>
            {filtroEquipes.length > 0 && (
              <button
                onClick={() => setFiltroEquipes([])}
                className="mt-3 text-xs text-[#1e5a8d] hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Estatísticas por Equipe */}
          <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-5 light:shadow-sm">
            <h4 className="text-sm font-medium light:text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon name="analytics" className="text-[16px] text-[#1e5a8d]" />
              Cadastros por Equipe
            </h4>
            <ul className="space-y-3">
              {equipes.length === 0 ? (
                <li className="text-xs light:text-gray-500 dark:text-gray-500">Nenhuma equipe cadastrada</li>
              ) : (
                equipes.map((equipe) => {
                  const cadastrosEquipe = cadastros.filter(c =>
                    liderancas.filter(l => l.equipe_id === equipe.id).some(l => l.id === c.lideranca_id)
                  ).length;
                  const maxCadastros = Math.max(...equipes.map(e =>
                    cadastros.filter(c => liderancas.filter(l => l.equipe_id === e.id).some(l => l.id === c.lideranca_id)).length
                  ), 1);
                  return (
                    <li key={equipe.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="light:text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: equipe.cor }}
                          ></div>
                          {equipe.nome}
                        </span>
                        <span className="font-medium light:text-gray-900 dark:text-white">{cadastrosEquipe}</span>
                      </div>
                      <div className="h-1 light:bg-gray-200 dark:bg-white/[0.05] rounded-full overflow-hidden ml-5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(cadastrosEquipe / maxCadastros) * 100}%`,
                            backgroundColor: equipe.cor
                          }}
                        ></div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Legenda */}
          <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-5 light:shadow-sm">
            <h4 className="text-sm font-medium light:text-gray-900 dark:text-white mb-3">Legenda de Tamanhos</h4>
            <ul className="space-y-3 text-xs">
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1e5a8d] flex items-center justify-center text-white text-[10px]">👥</div>
                <span className="light:text-gray-600 dark:text-gray-400">Equipe (ícone grande)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="relative w-6 h-6 rounded-full bg-[#1e5a8d] flex items-center justify-center text-white text-[10px]">
                  👥
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 light:border-gray-100 dark:border-[#0d1117] flex items-center justify-center text-[8px] text-black">🏢</span>
                </div>
                <span className="light:text-gray-600 dark:text-gray-400">Equipe (vinculada a organização)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="relative w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-sky-700 border-2 border-white shadow flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                  </svg>
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 border border-white flex items-center justify-center text-[6px] font-black text-yellow-800">C</span>
                </div>
                <span className="light:text-gray-600 dark:text-gray-400">Coordenador (badge com shield)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-[8px]">👤</div>
                <span className="light:text-gray-600 dark:text-gray-400">Liderança (ícone médio)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500/20"></div>
                <span className="light:text-gray-600 dark:text-gray-400">Cadastro (círculo de raio 200m; pode aumentar quando agrupa)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full light:bg-gray-700 dark:bg-gray-700 border light:border-gray-300 dark:border-white"></div>
                <span className="light:text-gray-600 dark:text-gray-400">Cadastro (ponto central)</span>
              </li>
            </ul>
          </div>
        </div>

        {detailsModal && (
          <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-6xl h-[85vh] light:bg-white dark:bg-[#0d1117] rounded-2xl border light:border-gray-200 dark:border-white/10 light:shadow-2xl dark:shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b light:border-gray-100 dark:border-white/5">
                <div>
                  <p className="text-sm font-medium light:text-gray-900 dark:text-white">
                    {detailsModal.type === 'team' ? 'Métricas da Equipe' : detailsModal.type === 'leader' ? 'Métricas da Liderança' : 'Métricas do Coordenador'}
                  </p>
                  <p className="text-xs light:text-gray-600 dark:text-gray-500">Visualização dentro do mapa</p>
                </div>
                <button
                  onClick={() => setDetailsModal(null)}
                  className="light:text-gray-600 dark:text-gray-400 light:hover:text-gray-900 dark:hover:text-white transition-colors p-2 light:hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
                >
                  <Icon name="close" className="text-[20px]" />
                </button>
              </div>
              <div className="flex-1">
                <iframe
                  title="details"
                  src={
                    detailsModal.type === 'team'
                      ? `/#/teams/${detailsModal.id}`
                      : detailsModal.type === 'leader'
                        ? `/#/leaders/${detailsModal.id}`
                        : `/#/coordinators/${detailsModal.id}`
                  }
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Maps;
