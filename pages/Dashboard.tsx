
import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line
} from 'recharts';
import Icon from '../components/Icon';
import {
  cadastrosService,
  coordenadoresService,
  liderancasService,
  equipesService,
  organizacoesService,
  supabase
} from '../lib/supabase';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="light:bg-white dark:bg-gray-900 p-3 light:border-gray-200 dark:border-gray-700 border rounded-lg shadow-xl">
        <p className="light:text-gray-600 dark:text-gray-400 text-sm mb-1">{label}</p>
        <p className="light:text-gray-900 dark:text-white font-bold">{`${payload[0].value.toLocaleString('pt-BR')} registros`}</p>
      </div>
    );
  }
  return null;
};

const CustomEvolucaoTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="light:bg-white dark:bg-gray-900 p-3 light:border-gray-200 dark:border-gray-700 border rounded-lg shadow-xl">
        <p className="light:text-gray-600 dark:text-gray-400 text-xs mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          if (entry.value === null) return null;
          const colors: { [key: string]: string } = {
            meta: '#3b82f6',
            real: '#10b981',
            projecao: '#f59e0b'
          };
          const labels: { [key: string]: string } = {
            meta: 'Meta',
            real: 'Realizado',
            projecao: 'Projeção'
          };
          return (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[entry.dataKey] }} />
              <span className="text-xs light:text-gray-700 dark:text-gray-300">
                {labels[entry.dataKey]}: <span className="font-bold light:text-gray-900 dark:text-white">{entry.value.toLocaleString('pt-BR')}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

type PeriodoFilter = 'hoje' | '7dias' | '30dias' | '60dias' | 'personalizado';
type MetricaType = 'cadastros' | 'percentual' | 'media_mensal';

interface DadosEvolucao {
    mes: string;
    meta: number | null;
    real: number | null;
    projecao: number | null;
}

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [periodoSelecionado, setPeriodoSelecionado] = useState<PeriodoFilter>('30dias');
    const [dataInicial, setDataInicial] = useState('');
    const [dataFinal, setDataFinal] = useState('');
    const [todosCadastros, setTodosCadastros] = useState<any[]>([]);

    // Estados para gráficos de evolução
    const [equipeSelecionada, setEquipeSelecionada] = useState<string>('todas');
    const [metricaSelecionada, setMetricaSelecionada] = useState<MetricaType>('cadastros');
    const [dadosEvolucao, setDadosEvolucao] = useState<DadosEvolucao[]>([]);
    const [equipesDisponiveis, setEquipesDisponiveis] = useState<any[]>([]);

    // Evolução por Liderança
    const [liderancaSelecionada, setLiderancaSelecionada] = useState<string>('todas');
    const [dadosEvolucaoLideranca, setDadosEvolucaoLideranca] = useState<DadosEvolucao[]>([]);
    const [liderancasDisponiveis, setLiderancasDisponiveis] = useState<any[]>([]);

    // Evolução por Coordenador
    const [coordenadorSelecionado, setCoordenadorSelecionado] = useState<string>('todas');
    const [dadosEvolucaoCoordenador, setDadosEvolucaoCoordenador] = useState<DadosEvolucao[]>([]);
    const [coordenadoresDisponiveis, setCoordenadoresDisponiveis] = useState<any[]>([]);

    const [stats, setStats] = useState({
        totalCadastros: 0,
        totalCoordenadores: 0,
        totalLiderancas: 0,
        totalEquipes: 0,
        totalOrganizacoes: 0,
    });

    const [neighborhoodData, setNeighborhoodData] = useState<any[]>([{ name: 'Sem dados', value: 0 }]);
    const [sectorData, setSectorData] = useState<any[]>([{ name: 'Sem dados', value: 1, color: '#6b7280' }]);
    const [coordinatorPerformance, setCoordinatorPerformance] = useState<any[]>([{ name: 'Sem dados', value: 0 }]);
    const [teamGoalProgress, setTeamGoalProgress] = useState<any[]>([{ name: 'Sem dados', meta: 0, atingido: 0 }]);
    const [topEquipesData, setTopEquipesData] = useState<any[]>([{ name: 'Sem dados', value: 0 }]);
    const [topLiderancasData, setTopLiderancasData] = useState<any[]>([{ name: 'Sem dados', value: 0 }]);
    const [cadastrosPorHorarioData, setCadastrosPorHorarioData] = useState<any[]>([]);
    const [cadastrosPorDiaData, setCadastrosPorDiaData] = useState<any[]>([]);
    const [liderancasInativasData, setLiderancasInativasData] = useState<any[]>([]);
    const [rankingCrescimentoData, setRankingCrescimentoData] = useState<any[]>([]);
    const [faixaEtariaData, setFaixaEtariaData] = useState<any[]>([]);

    useEffect(() => {
        carregarDados();
    }, []);

    useEffect(() => {
        if (todosCadastros.length > 0) {
            processarDadosFiltrados();
        }
    }, [periodoSelecionado, dataInicial, dataFinal, todosCadastros]);

    useEffect(() => {
        if (todosCadastros.length > 0 && equipesDisponiveis.length > 0) {
            processarDadosEvolucao();
        }
    }, [equipeSelecionada, metricaSelecionada, todosCadastros, equipesDisponiveis]);

    useEffect(() => {
        if (liderancasDisponiveis.length > 0) {
            processarDadosEvolucaoLideranca();
        }
    }, [liderancaSelecionada, todosCadastros, liderancasDisponiveis]);

    useEffect(() => {
        if (coordenadoresDisponiveis.length > 0) {
            processarDadosEvolucaoCoordenador();
        }
    }, [coordenadorSelecionado, todosCadastros, coordenadoresDisponiveis]);

    // Função para formatar mês/ano
    const formatarMesAno = (mes: number, ano: number): string => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${meses[mes]}/${ano.toString().slice(-2)}`;
    };

    // Função para processar dados de evolução temporal
    const processarDadosEvolucao = async () => {
        try {
            const liderancasData = await liderancasService.listar();

            // Filtrar cadastros pela equipe selecionada
            let cadastrosFiltrados = [...todosCadastros];
            let metaTotal = 0;

            if (equipeSelecionada === 'todas') {
                // Meta = soma das metas de todas as lideranças (mesmo cálculo do Teams.tsx)
                metaTotal = liderancasData.reduce((sum, l) => sum + (l.meta || 0), 0);
            } else {
                // Filtrar por equipe específica
                const liderancasEquipe = liderancasData.filter(l => l.equipe_id === equipeSelecionada);
                const liderancaIds = liderancasEquipe.map(l => l.id);
                cadastrosFiltrados = todosCadastros.filter(c =>
                    c.lideranca_id && liderancaIds.includes(c.lideranca_id)
                );
                // Meta = soma das metas das lideranças da equipe
                metaTotal = liderancasEquipe.reduce((sum, l) => sum + (l.meta || 0), 0);
            }

            // Agrupar cadastros por mês
            const cadastrosPorMes = new Map<string, number>();
            const dataAtual = new Date();
            const anoAtual = dataAtual.getFullYear();
            const mesAtual = dataAtual.getMonth();

            // Inicializar últimos 6 meses
            for (let i = 5; i >= 0; i--) {
                const data = new Date(anoAtual, mesAtual - i, 1);
                const chave = formatarMesAno(data.getMonth(), data.getFullYear());
                cadastrosPorMes.set(chave, 0);
            }

            // Contar cadastros por mês
            cadastrosFiltrados.forEach(cadastro => {
                const data = new Date(cadastro.criado_em);
                const chave = formatarMesAno(data.getMonth(), data.getFullYear());
                if (cadastrosPorMes.has(chave)) {
                    cadastrosPorMes.set(chave, (cadastrosPorMes.get(chave) || 0) + 1);
                }
            });

            // Calcular acumulado e média
            const mesesComDados: DadosEvolucao[] = [];
            let acumulado = 0;
            let totalCadastros = 0;
            let mesesComCadastros = 0;

            cadastrosPorMes.forEach((count, mes) => {
                acumulado += count;
                totalCadastros += count;
                if (count > 0) mesesComCadastros++;

                mesesComDados.push({
                    mes,
                    meta: metaTotal,
                    real: acumulado,
                    projecao: null
                });
            });

            // Calcular projeção para os próximos 10 meses
            const mediaMensal = mesesComCadastros > 0 ? totalCadastros / mesesComCadastros : 0;
            let ultimoAcumulado = acumulado;

            for (let i = 1; i <= 10; i++) {
                const data = new Date(anoAtual, mesAtual + i, 1);
                const chave = formatarMesAno(data.getMonth(), data.getFullYear());
                ultimoAcumulado += mediaMensal;

                mesesComDados.push({
                    mes: chave,
                    meta: metaTotal,
                    real: null,
                    projecao: Math.round(ultimoAcumulado)
                });
            }

            setDadosEvolucao(mesesComDados);
        } catch (error) {
            console.error('Erro ao processar dados de evolução:', error);
        }
    };

    // Função auxiliar para calcular evolução temporal (reutilizada por equipe, liderança e coordenador)
    const calcularEvolucaoTemporal = (cadastrosFiltrados: any[], metaTotal: number): DadosEvolucao[] => {
        const cadastrosPorMes = new Map<string, number>();
        const dataAtual = new Date();
        const anoAtual = dataAtual.getFullYear();
        const mesAtual = dataAtual.getMonth();

        for (let i = 5; i >= 0; i--) {
            const data = new Date(anoAtual, mesAtual - i, 1);
            const chave = formatarMesAno(data.getMonth(), data.getFullYear());
            cadastrosPorMes.set(chave, 0);
        }

        cadastrosFiltrados.forEach(cadastro => {
            const data = new Date(cadastro.criado_em);
            const chave = formatarMesAno(data.getMonth(), data.getFullYear());
            if (cadastrosPorMes.has(chave)) {
                cadastrosPorMes.set(chave, (cadastrosPorMes.get(chave) || 0) + 1);
            }
        });

        const mesesComDados: DadosEvolucao[] = [];
        let acumulado = 0;
        let totalCadastros = 0;
        let mesesComCadastros = 0;

        cadastrosPorMes.forEach((count, mes) => {
            acumulado += count;
            totalCadastros += count;
            if (count > 0) mesesComCadastros++;
            mesesComDados.push({ mes, meta: metaTotal, real: acumulado, projecao: null });
        });

        const mediaMensal = mesesComCadastros > 0 ? totalCadastros / mesesComCadastros : 0;
        let ultimoAcumulado = acumulado;

        for (let i = 1; i <= 10; i++) {
            const data = new Date(anoAtual, mesAtual + i, 1);
            const chave = formatarMesAno(data.getMonth(), data.getFullYear());
            ultimoAcumulado += mediaMensal;
            mesesComDados.push({ mes: chave, meta: metaTotal, real: null, projecao: Math.round(ultimoAcumulado) });
        }

        return mesesComDados;
    };

    // Evolução de Meta por Liderança
    const processarDadosEvolucaoLideranca = () => {
        try {
            let cadastrosFiltrados = [...todosCadastros];
            let metaTotal = 0;

            if (liderancaSelecionada === 'todas') {
                metaTotal = liderancasDisponiveis.reduce((sum, l) => sum + (l.meta || 0), 0);
            } else {
                cadastrosFiltrados = todosCadastros.filter(c => c.lideranca_id === liderancaSelecionada);
                const lideranca = liderancasDisponiveis.find(l => l.id === liderancaSelecionada);
                metaTotal = lideranca?.meta || 0;
            }

            setDadosEvolucaoLideranca(calcularEvolucaoTemporal(cadastrosFiltrados, metaTotal));
        } catch (error) {
            console.error('Erro ao processar evolução de liderança:', error);
        }
    };

    // Evolução de Meta por Coordenador
    const processarDadosEvolucaoCoordenador = () => {
        try {
            let cadastrosFiltrados = [...todosCadastros];
            let metaTotal = 0;

            if (coordenadorSelecionado === 'todas') {
                metaTotal = coordenadoresDisponiveis.reduce((sum, c) => sum + ((c as any).meta || 0), 0);
            } else {
                cadastrosFiltrados = todosCadastros.filter(c => c.coordenador_id === coordenadorSelecionado);
                const coordenador = coordenadoresDisponiveis.find(c => c.id === coordenadorSelecionado);
                metaTotal = (coordenador as any)?.meta || 0;
            }

            setDadosEvolucaoCoordenador(calcularEvolucaoTemporal(cadastrosFiltrados, metaTotal));
        } catch (error) {
            console.error('Erro ao processar evolução de coordenador:', error);
        }
    };

    const filtrarCadastrosPorPeriodo = (cadastros: any[]) => {
        const agora = new Date();
        let dataLimite = new Date();

        switch (periodoSelecionado) {
            case 'hoje':
                dataLimite.setHours(0, 0, 0, 0);
                break;
            case '7dias':
                dataLimite.setDate(agora.getDate() - 7);
                break;
            case '30dias':
                dataLimite.setDate(agora.getDate() - 30);
                break;
            case '60dias':
                dataLimite.setDate(agora.getDate() - 60);
                break;
            case 'personalizado':
                if (dataInicial && dataFinal) {
                    return cadastros.filter(c => {
                        const dataCadastro = new Date(c.criado_em);
                        const inicio = new Date(dataInicial);
                        const fim = new Date(dataFinal);
                        fim.setHours(23, 59, 59, 999);
                        return dataCadastro >= inicio && dataCadastro <= fim;
                    });
                }
                return cadastros;
            default:
                return cadastros;
        }

        return cadastros.filter(c => new Date(c.criado_em) >= dataLimite);
    };

    const carregarDados = async () => {
        try {
            setLoading(true);
            // Buscar cadastros apenas dos últimos 90 dias (cobre todos os filtros de período)
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() - 90);
            const dataLimiteStr = dataLimite.toISOString();

            const [cadastros, totalCadastros, coordenadores, liderancas, equipes, organizacoes] = await Promise.all([
                cadastrosService.listarDesde(dataLimiteStr),
                cadastrosService.contar(),
                coordenadoresService.listar(),
                liderancasService.listarTodos(),
                equipesService.listarTodos(),
                organizacoesService.listar(),
            ]);

            setTodosCadastros(cadastros);
            setEquipesDisponiveis(equipes);
            setLiderancasDisponiveis(liderancas);
            setCoordenadoresDisponiveis(coordenadores);

            setStats({
                totalCadastros,
                totalCoordenadores: coordenadores.length,
                totalLiderancas: liderancas.filter(l => l.ativo).length,
                totalEquipes: equipes.length,
                totalOrganizacoes: organizacoes.length,
            });
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const processarDadosFiltrados = async () => {
        try {
            const cadastrosFiltrados = filtrarCadastrosPorPeriodo(todosCadastros);

            // 1. Top 5 Bairros por número de cadastros
            const bairroMap = new Map<string, number>();
            cadastrosFiltrados.forEach(cadastro => {
                const bairro = cadastro.bairro?.trim() || 'Não informado';
                bairroMap.set(bairro, (bairroMap.get(bairro) || 0) + 1);
            });
            const topBairros = Array.from(bairroMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            setNeighborhoodData(topBairros.length > 0 ? topBairros : [{ name: 'Sem dados', value: 0 }]);

            // 2. Top 5 Cidades
            const cidadeMap = new Map<string, number>();
            const cores = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'];
            cadastrosFiltrados.forEach(cadastro => {
                const cidade = cadastro.cidade?.trim() || 'Não informado';
                cidadeMap.set(cidade, (cidadeMap.get(cidade) || 0) + 1);
            });
            const topCidades = Array.from(cidadeMap.entries())
                .map(([name, value], index) => ({
                    name,
                    value,
                    color: cores[index % cores.length]
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            setSectorData(topCidades.length > 0 ? topCidades : [{ name: 'Sem dados', value: 1, color: '#6b7280' }]);

            // 3. Top 5 Coordenadores por cadastros
            const coordenadorMap = new Map<string, { nome: string; count: number }>();
            const coordenadoresData = coordenadoresDisponiveis;

            cadastrosFiltrados.forEach(cadastro => {
                if (cadastro.coordenador_id) {
                    const coord = coordenadoresData.find(c => c.id === cadastro.coordenador_id);
                    if (coord) {
                        const existing = coordenadorMap.get(coord.id);
                        coordenadorMap.set(coord.id, {
                            nome: coord.nome,
                            count: (existing?.count || 0) + 1
                        });
                    }
                }
            });

            const topCoordenadores = Array.from(coordenadorMap.values())
                .map(({ nome, count }) => ({
                    name: nome.split(' ')[0],
                    value: count
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            setCoordinatorPerformance(topCoordenadores.length > 0 ? topCoordenadores : [{ name: 'Sem dados', value: 0 }]);

            // 4. Meta por Equipe
            const equipesData = equipesDisponiveis;
            const liderancasData = liderancasDisponiveis;

            const progressoEquipes = equipesData.slice(0, 8).map((equipe) => {
                const liderancasEquipe = liderancasData.filter(l => l.equipe_id === equipe.id);
                const liderancaIds = liderancasEquipe.map(l => l.id);

                const cadastrosEquipe = cadastrosFiltrados.filter(c =>
                    c.lideranca_id && liderancaIds.includes(c.lideranca_id)
                );

                const metaCalculada = liderancasEquipe.reduce((acc, l) => acc + (l.meta || 0), 0);

                return {
                    name: equipe.nome,
                    meta: metaCalculada,
                    atingido: cadastrosEquipe.length
                };
            });

            setTeamGoalProgress(progressoEquipes.length > 0 ? progressoEquipes : [{ name: 'Sem dados', meta: 0, atingido: 0 }]);

            // 5. Top 3 Equipes
            const equipeMap = new Map<string, { nome: string; count: number }>();

            cadastrosFiltrados.forEach(cadastro => {
                if (cadastro.lideranca_id) {
                    const lideranca = liderancasData.find(l => l.id === cadastro.lideranca_id);
                    if (lideranca && lideranca.equipe_id) {
                        const equipe = equipesData.find(e => e.id === lideranca.equipe_id);
                        if (equipe) {
                            const existing = equipeMap.get(equipe.id);
                            equipeMap.set(equipe.id, {
                                nome: equipe.nome,
                                count: (existing?.count || 0) + 1
                            });
                        }
                    }
                }
            });

            const topEquipes = Array.from(equipeMap.values())
                .map(({ nome, count }) => ({
                    name: nome,
                    value: count
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 3);
            setTopEquipesData(topEquipes.length > 0 ? topEquipes : [{ name: 'Sem dados', value: 0 }]);

            // 6. Top 5 Lideranças
            const liderancaMap = new Map<string, { nome: string; count: number }>();

            cadastrosFiltrados.forEach(cadastro => {
                if (cadastro.lideranca_id) {
                    const lideranca = liderancasData.find(l => l.id === cadastro.lideranca_id);
                    if (lideranca) {
                        const existing = liderancaMap.get(lideranca.id);
                        liderancaMap.set(lideranca.id, {
                            nome: lideranca.nome,
                            count: (existing?.count || 0) + 1
                        });
                    }
                }
            });

            const topLiderancas = Array.from(liderancaMap.values())
                .map(({ nome, count }) => ({
                    name: nome.split(' ')[0],
                    value: count
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            setTopLiderancasData(topLiderancas.length > 0 ? topLiderancas : [{ name: 'Sem dados', value: 0 }]);

            // 7. Cadastros por Horário (0-23h)
            const horarioMap = new Map<number, number>();
            for (let i = 0; i < 24; i++) {
                horarioMap.set(i, 0);
            }

            cadastrosFiltrados.forEach(cadastro => {
                if (cadastro.criado_em) {
                    const hora = new Date(cadastro.criado_em).getHours();
                    horarioMap.set(hora, (horarioMap.get(hora) || 0) + 1);
                }
            });

            const cadastrosPorHorario = Array.from(horarioMap.entries())
                .map(([hora, count]) => ({
                    name: `${hora}h`,
                    value: count
                }))
                .sort((a, b) => parseInt(a.name) - parseInt(b.name));
            setCadastrosPorHorarioData(cadastrosPorHorario);

            // 8. Cadastros por Dia da Semana
            const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            const diaMap = new Map<number, number>();
            for (let i = 0; i < 7; i++) {
                diaMap.set(i, 0);
            }

            cadastrosFiltrados.forEach(cadastro => {
                if (cadastro.criado_em) {
                    const dia = new Date(cadastro.criado_em).getDay();
                    diaMap.set(dia, (diaMap.get(dia) || 0) + 1);
                }
            });

            const cadastrosPorDia = Array.from(diaMap.entries())
                .map(([dia, count]) => ({
                    name: diasSemana[dia],
                    value: count
                }));
            setCadastrosPorDiaData(cadastrosPorDia);

            // 9. Lideranças Inativas (30 dias)
            const dataLimite30Dias = new Date();
            dataLimite30Dias.setDate(dataLimite30Dias.getDate() - 30);

            const liderancasInativas = liderancasData
                .filter(lideranca => lideranca.ativo !== false) // Apenas lideranças ativas
                .map(lideranca => {
                    // Contar cadastros nos últimos 30 dias para esta liderança
                    const cadastrosRecentes = todosCadastros.filter(cadastro => {
                        if (!cadastro.lideranca_id || cadastro.lideranca_id !== lideranca.id) return false;
                        const dataCadastro = new Date(cadastro.criado_em);
                        return dataCadastro >= dataLimite30Dias;
                    });

                    // Encontrar último cadastro
                    const todosLiderancaCadastros = todosCadastros
                        .filter(c => c.lideranca_id === lideranca.id)
                        .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

                    const ultimoCadastroDate = todosLiderancaCadastros.length > 0
                        ? new Date(todosLiderancaCadastros[0].criado_em).toLocaleDateString('pt-BR')
                        : 'Nunca';

                    const equipe = equipesData.find(e => e.id === lideranca.equipe_id);

                    return {
                        nome: lideranca.nome,
                        equipe: equipe?.nome || 'Sem equipe',
                        ultimoCadastro: ultimoCadastroDate,
                        cadastrosRecentes: cadastrosRecentes.length
                    };
                })
                .filter(l => l.cadastrosRecentes === 0) // Apenas sem cadastros nos últimos 30 dias
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .slice(0, 10);

            setLiderancasInativasData(liderancasInativas);

            // 10. Ranking de Crescimento
            const calcularPeriodoAnterior = () => {
                const agora = new Date();
                let dataInicioAtual = new Date();
                let dataFimAtual = agora;
                let dataInicioAnterior = new Date();
                let dataFimAnterior = new Date();

                switch (periodoSelecionado) {
                    case 'hoje':
                        dataInicioAtual.setHours(0, 0, 0, 0);
                        dataInicioAnterior.setDate(agora.getDate() - 1);
                        dataInicioAnterior.setHours(0, 0, 0, 0);
                        dataFimAnterior.setDate(agora.getDate() - 1);
                        dataFimAnterior.setHours(23, 59, 59, 999);
                        break;
                    case '7dias':
                        dataInicioAtual.setDate(agora.getDate() - 7);
                        dataInicioAnterior.setDate(agora.getDate() - 14);
                        dataFimAnterior.setDate(agora.getDate() - 7);
                        break;
                    case '30dias':
                        dataInicioAtual.setDate(agora.getDate() - 30);
                        dataInicioAnterior.setDate(agora.getDate() - 60);
                        dataFimAnterior.setDate(agora.getDate() - 30);
                        break;
                    case '60dias':
                        dataInicioAtual.setDate(agora.getDate() - 60);
                        dataInicioAnterior.setDate(agora.getDate() - 120);
                        dataFimAnterior.setDate(agora.getDate() - 60);
                        break;
                    case 'personalizado':
                        if (dataInicial && dataFinal) {
                            const inicio = new Date(dataInicial);
                            const fim = new Date(dataFinal);
                            const duracao = fim.getTime() - inicio.getTime();
                            dataInicioAtual = inicio;
                            dataFimAtual = fim;
                            dataInicioAnterior = new Date(inicio.getTime() - duracao);
                            dataFimAnterior = new Date(inicio.getTime());
                        }
                        break;
                }

                return { dataInicioAnterior, dataFimAnterior };
            };

            const { dataInicioAnterior, dataFimAnterior } = calcularPeriodoAnterior();

            const cadastrosAnterior = todosCadastros.filter(c => {
                const dataCadastro = new Date(c.criado_em);
                return dataCadastro >= dataInicioAnterior && dataCadastro <= dataFimAnterior;
            });

            // Agrupar por equipe
            const equipeMapAtual = new Map<string, { nome: string; count: number }>();
            const equipeMapAnterior = new Map<string, { nome: string; count: number }>();

            cadastrosFiltrados.forEach(cadastro => {
                if (cadastro.lideranca_id) {
                    const lideranca = liderancasData.find(l => l.id === cadastro.lideranca_id);
                    if (lideranca && lideranca.equipe_id) {
                        const equipe = equipesData.find(e => e.id === lideranca.equipe_id);
                        if (equipe) {
                            const existing = equipeMapAtual.get(equipe.id);
                            equipeMapAtual.set(equipe.id, {
                                nome: equipe.nome,
                                count: (existing?.count || 0) + 1
                            });
                        }
                    }
                }
            });

            cadastrosAnterior.forEach(cadastro => {
                if (cadastro.lideranca_id) {
                    const lideranca = liderancasData.find(l => l.id === cadastro.lideranca_id);
                    if (lideranca && lideranca.equipe_id) {
                        const equipe = equipesData.find(e => e.id === lideranca.equipe_id);
                        if (equipe) {
                            const existing = equipeMapAnterior.get(equipe.id);
                            equipeMapAnterior.set(equipe.id, {
                                nome: equipe.nome,
                                count: (existing?.count || 0) + 1
                            });
                        }
                    }
                }
            });

            // Combinar dados e calcular crescimento
            const todasEquipes = new Set([...equipeMapAtual.keys(), ...equipeMapAnterior.keys()]);
            const rankingCrescimento = Array.from(todasEquipes).map(equipeId => {
                const atual = equipeMapAtual.get(equipeId)?.count || 0;
                const anterior = equipeMapAnterior.get(equipeId)?.count || 0;
                const nome = equipeMapAtual.get(equipeId)?.nome || equipeMapAnterior.get(equipeId)?.nome || 'Desconhecida';

                let crescimento = 0;
                if (anterior === 0 && atual > 0) {
                    crescimento = 100;
                } else if (anterior > 0) {
                    crescimento = ((atual - anterior) / anterior) * 100;
                }

                return {
                    nome,
                    atual,
                    anterior,
                    crescimento: Math.round(crescimento * 10) / 10 // Arredondar para 1 casa decimal
                };
            }).sort((a, b) => b.crescimento - a.crescimento);

            setRankingCrescimentoData(rankingCrescimento);

            // 11. Cadastros por Faixa Etária
            const faixasEtarias = {
                '16-25': 0,
                '26-35': 0,
                '36-45': 0,
                '46-55': 0,
                '56-65': 0,
                '65+': 0,
                'Não informado': 0
            };

            cadastrosFiltrados.forEach(cadastro => {
                if (!cadastro.data_nascimento) {
                    faixasEtarias['Não informado']++;
                    return;
                }

                try {
                    const nascimento = new Date(cadastro.data_nascimento);
                    const hoje = new Date();
                    let idade = hoje.getFullYear() - nascimento.getFullYear();
                    const mesAtual = hoje.getMonth();
                    const mesNascimento = nascimento.getMonth();

                    // Ajustar idade se ainda não fez aniversário este ano
                    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
                        idade--;
                    }

                    if (idade >= 16 && idade <= 25) {
                        faixasEtarias['16-25']++;
                    } else if (idade >= 26 && idade <= 35) {
                        faixasEtarias['26-35']++;
                    } else if (idade >= 36 && idade <= 45) {
                        faixasEtarias['36-45']++;
                    } else if (idade >= 46 && idade <= 55) {
                        faixasEtarias['46-55']++;
                    } else if (idade >= 56 && idade <= 65) {
                        faixasEtarias['56-65']++;
                    } else if (idade > 65) {
                        faixasEtarias['65+']++;
                    } else {
                        faixasEtarias['Não informado']++;
                    }
                } catch (error) {
                    faixasEtarias['Não informado']++;
                }
            });

            const faixaEtariaArray = Object.entries(faixasEtarias).map(([name, value]) => ({
                name,
                value
            }));

            setFaixaEtariaData(faixaEtariaArray);

            // Atualizar total de cadastros filtrados
            setStats(prev => ({
                ...prev,
                totalCadastros: cadastrosFiltrados.length
            }));

        } catch (error) {
            console.error('Erro ao processar dados filtrados:', error);
        }
    };

    const statsCards = [
        { title: 'Total Registros', value: stats.totalCadastros.toString(), change: 'Cadastros realizados', changeType: 'stable', icon: 'how_to_reg', iconColor: 'text-primary' },
        { title: 'Coordenadores', value: stats.totalCoordenadores.toString(), change: 'Ativos no sistema', changeType: 'stable', icon: 'badge', iconColor: 'text-indigo-500' },
        { title: 'Líderes Ativos', value: stats.totalLiderancas.toString(), change: 'Lideranças ativas', changeType: 'stable', icon: 'person', iconColor: 'text-amber-500' },
        { title: 'Equipes de Campo', value: stats.totalEquipes.toString(), change: 'Equipes cadastradas', changeType: 'stable', icon: 'groups', iconColor: 'text-cyan-500' },
        { title: 'Organizações', value: stats.totalOrganizacoes.toString(), change: 'Parceiros', changeType: 'stable', icon: 'domain', iconColor: 'text-emerald-400' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-light light:text-gray-900 dark:text-white tracking-tight mb-1">
                    Visão Geral
                </h1>
                <p className="text-sm light:text-gray-600 dark:text-gray-400 font-light">
                    Bem-vindo de volta ao painel de controle da campanha
                </p>
            </div>

            {/* Filtros de Período */}
            <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Icon name="date_range" className="text-primary text-[20px]" />
                    <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Período de Análise</h3>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setPeriodoSelecionado('hoje')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            periodoSelecionado === 'hoje'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'light:bg-gray-100 dark:bg-white/[0.05] light:text-gray-600 dark:text-gray-400 light:hover:bg-gray-200 dark:hover:bg-white/[0.08] light:hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => setPeriodoSelecionado('7dias')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            periodoSelecionado === '7dias'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'light:bg-gray-100 dark:bg-white/[0.05] light:text-gray-600 dark:text-gray-400 light:hover:bg-gray-200 dark:hover:bg-white/[0.08] light:hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Últimos 7 dias
                    </button>
                    <button
                        onClick={() => setPeriodoSelecionado('30dias')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            periodoSelecionado === '30dias'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'light:bg-gray-100 dark:bg-white/[0.05] light:text-gray-600 dark:text-gray-400 light:hover:bg-gray-200 dark:hover:bg-white/[0.08] light:hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Últimos 30 dias
                    </button>
                    <button
                        onClick={() => setPeriodoSelecionado('60dias')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            periodoSelecionado === '60dias'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'light:bg-gray-100 dark:bg-white/[0.05] light:text-gray-600 dark:text-gray-400 light:hover:bg-gray-200 dark:hover:bg-white/[0.08] light:hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Últimos 60 dias
                    </button>
                    <button
                        onClick={() => setPeriodoSelecionado('personalizado')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            periodoSelecionado === 'personalizado'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'light:bg-gray-100 dark:bg-white/[0.05] light:text-gray-600 dark:text-gray-400 light:hover:bg-gray-200 dark:hover:bg-white/[0.08] light:hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Personalizado
                    </button>
                </div>

                {periodoSelecionado === 'personalizado' && (
                    <div className="flex gap-4 mt-4">
                        <div className="flex-1">
                            <label className="block text-xs light:text-gray-600 dark:text-gray-400 mb-2">Data Inicial</label>
                            <input
                                type="date"
                                value={dataInicial}
                                onChange={(e) => setDataInicial(e.target.value)}
                                className="w-full px-3 py-2 light:bg-gray-50 dark:bg-white/[0.05] light:border-gray-200 dark:border-white/[0.08] border rounded-lg text-sm light:text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs light:text-gray-600 dark:text-gray-400 mb-2">Data Final</label>
                            <input
                                type="date"
                                value={dataFinal}
                                onChange={(e) => setDataFinal(e.target.value)}
                                className="w-full px-3 py-2 light:bg-gray-50 dark:bg-white/[0.05] light:border-gray-200 dark:border-white/[0.08] border rounded-lg text-sm light:text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {loading ? (
                        <div className="col-span-full flex items-center justify-center py-12">
                            <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-white rounded-full"></div>
                        </div>
                    ) : (
                        statsCards.map((stat, index) => (
                        <div key={index} className="group relative light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm light:hover:border-gray-300 dark:hover:border-white/10 hover:shadow-md transition-all duration-500 p-4 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 light:group-hover:from-gray-50/50 light:group-hover:to-gray-50/50 dark:group-hover:from-white/[0.02] dark:group-hover:to-white/[0.02] transition-all duration-500" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg light:bg-gray-100 dark:bg-white/[0.05] ${stat.iconColor}`}>
                                        <Icon name={stat.icon} className="text-[16px]" />
                                    </div>
                                </div>
                                <p className="text-[10px] uppercase tracking-wider light:text-gray-500 dark:text-gray-500 font-medium mb-1">{stat.title}</p>
                                <h3 className="text-xl font-light light:text-gray-900 dark:text-white tracking-tight">{stat.value}</h3>
                                <div className={`flex items-center mt-2 text-[10px] font-medium ${
                                    stat.changeType === 'increase' ? 'text-emerald-400' :
                                    stat.changeType === 'stable' ? 'light:text-gray-500 dark:text-gray-500' : 'text-rose-400'
                                }`}>
                                    <Icon name={stat.changeType === 'increase' ? 'trending_up' : stat.changeType === 'stable' ? 'remove' : 'trending_down'} className="text-[12px] mr-1" />
                                    <span className="truncate">{stat.change}</span>
                                </div>
                            </div>
                        </div>
                        ))
                    )}
                </div>

                {/* Charts Grid - Primeira Linha */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Bairros */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Top 5 Bairros por Registro</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-1 font-light">Desempenho nas principais localidades</p>
                            </div>
                            <button className="text-xs font-medium light:text-gray-600 dark:text-gray-400 light:hover:text-gray-900 dark:hover:text-white transition-colors">Ver Relatório</button>
                        </div>
                        <div className="flex-1 w-full min-h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={neighborhoodData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" horizontal={true} vertical={false} />
                                    <XAxis type="number" className="stroke-gray-400 dark:stroke-gray-600" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={11} tickLine={false} axisLine={false} width={110} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}/>
                                    <Bar dataKey="value" fill="url(#colorGradient)" barSize={20} radius={[0, 8, 8, 0]} />
                                    <defs>
                                        <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#1e40af" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top 5 Cidades */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6 flex flex-col">
                        <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight mb-4">Top 5 Cidades</h3>
                        <div className="flex-1 w-full min-h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} fill="#8884d8" paddingAngle={3}>
                                        {sectorData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize: "10px"}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Charts Grid - Segunda Linha: Top Performers */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Top 5 Coordenadores */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Top 5 Coordenadores</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Cadastros realizados</p>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={coordinatorPerformance} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" horizontal={true} vertical={false} />
                                    <XAxis type="number" className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={10} tickLine={false} axisLine={false} width={60} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                                    <Bar dataKey="value" fill="#1e40af" radius={[0, 6, 6, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top 5 Lideranças */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Top 5 Lideranças</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Cadastros realizados</p>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={topLiderancasData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" horizontal={true} vertical={false} />
                                    <XAxis type="number" className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={10} tickLine={false} axisLine={false} width={60} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }} />
                                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top 3 Equipes */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Top 3 Equipes</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Cadastros realizados</p>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={topEquipesData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" horizontal={true} vertical={false} />
                                    <XAxis type="number" className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={10} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                                    <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Charts Grid - Terceira Linha */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cadastros por Horário */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Cadastros por Horário</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Distribuição por hora do dia</p>
                            </div>
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <LineChart data={cadastrosPorHorarioData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" />
                                    <XAxis dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Cadastros por Dia da Semana */}
                    <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Cadastros por Dia da Semana</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Distribuição semanal</p>
                            </div>
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={cadastrosPorDiaData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" />
                                    <XAxis dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Evolução de Meta por Equipe - NOVO GRÁFICO */}
                <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                    {/* Header com título */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Evolução de Meta por Equipe</h3>
                            <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Análise temporal com projeção baseada em dados reais</p>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Dropdown de Equipe */}
                        <div>
                            <label className="block text-xs light:text-gray-600 dark:text-gray-400 mb-2 font-medium">Equipe</label>
                            <select
                                value={equipeSelecionada}
                                onChange={(e) => setEquipeSelecionada(e.target.value)}
                                className="w-full px-3 py-2.5 light:bg-gray-50 dark:bg-white/[0.05] light:border-gray-200 dark:border-white/[0.08] border rounded-lg text-sm light:text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors light:hover:bg-gray-100 dark:hover:bg-white/[0.08] cursor-pointer"
                            >
                                <option value="todas" className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">Todas as Equipes</option>
                                {equipesDisponiveis.map(equipe => (
                                    <option key={equipe.id} value={equipe.id} className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">
                                        {equipe.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Dropdown de Métrica */}
                        <div>
                            <label className="block text-xs light:text-gray-600 dark:text-gray-400 mb-2 font-medium">Métrica</label>
                            <select
                                value={metricaSelecionada}
                                onChange={(e) => setMetricaSelecionada(e.target.value as MetricaType)}
                                className="w-full px-3 py-2.5 light:bg-gray-50 dark:bg-white/[0.05] light:border-gray-200 dark:border-white/[0.08] border rounded-lg text-sm light:text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors light:hover:bg-gray-100 dark:hover:bg-white/[0.08] cursor-pointer"
                            >
                                <option value="cadastros" className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">Cadastros Totais (Acumulado)</option>
                                <option value="percentual" className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">% da Meta Atingida</option>
                                <option value="media_mensal" className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">Média Mensal</option>
                            </select>
                        </div>
                    </div>

                    {/* Gráfico de Linha */}
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={dadosEvolucao} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" />
                                <XAxis
                                    dataKey="mes"
                                    className="stroke-gray-600 dark:stroke-gray-500"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis
                                    className="stroke-gray-400 dark:stroke-gray-600"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => value.toLocaleString('pt-BR')}
                                />
                                <Tooltip content={<CustomEvolucaoTooltip />} />
                                <Legend
                                    iconType="line"
                                    iconSize={16}
                                    wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }}
                                    formatter={(value) => {
                                        const labels: { [key: string]: string } = {
                                            meta: 'Meta',
                                            real: 'Progresso Real',
                                            projecao: 'Projeção (10 meses)'
                                        };
                                        return labels[value] || value;
                                    }}
                                />

                                {/* Linha da Meta (azul) */}
                                <Line
                                    type="monotone"
                                    dataKey="meta"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                    name="meta"
                                />

                                {/* Linha de Progresso Real (verde) */}
                                <Line
                                    type="monotone"
                                    dataKey="real"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ fill: '#10b981', r: 4 }}
                                    name="real"
                                    connectNulls={false}
                                />

                                {/* Linha de Projeção (laranja tracejada) */}
                                <Line
                                    type="monotone"
                                    dataKey="projecao"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ fill: '#f59e0b', r: 3 }}
                                    name="projecao"
                                    connectNulls={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Informações adicionais */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 light:border-gray-200 dark:border-white/[0.05] border-t">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Icon name="flag" className="text-blue-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Meta Total</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucao.length > 0 && dadosEvolucao[0].meta
                                        ? dadosEvolucao[0].meta.toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Icon name="trending_up" className="text-green-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Realizado até agora</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucao.filter(d => d.real !== null).length > 0
                                        ? (dadosEvolucao.filter(d => d.real !== null).slice(-1)[0]?.real || 0).toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Icon name="insights" className="text-orange-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Projeção em 10 meses</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucao.filter(d => d.projecao !== null).length > 0
                                        ? (dadosEvolucao.filter(d => d.projecao !== null).slice(-1)[0]?.projecao || 0).toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Evolução de Meta por Liderança */}
                <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Evolução de Meta por Liderança</h3>
                            <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Análise temporal com projeção baseada em dados reais</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs light:text-gray-600 dark:text-gray-400 mb-2 font-medium">Liderança</label>
                        <select
                            value={liderancaSelecionada}
                            onChange={(e) => setLiderancaSelecionada(e.target.value)}
                            className="w-full px-3 py-2.5 light:bg-gray-50 dark:bg-white/[0.05] light:border-gray-200 dark:border-white/[0.08] border rounded-lg text-sm light:text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors light:hover:bg-gray-100 dark:hover:bg-white/[0.08] cursor-pointer"
                        >
                            <option value="todas" className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">Todas as Lideranças</option>
                            {liderancasDisponiveis.filter(l => l.ativo).map(lideranca => (
                                <option key={lideranca.id} value={lideranca.id} className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">
                                    {lideranca.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={dadosEvolucaoLideranca} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" />
                                <XAxis dataKey="mes" className="stroke-gray-600 dark:stroke-gray-500" fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                                <YAxis className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString('pt-BR')} />
                                <Tooltip content={<CustomEvolucaoTooltip />} />
                                <Legend iconType="line" iconSize={16} wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }} formatter={(value) => {
                                    const labels: { [key: string]: string } = { meta: 'Meta', real: 'Progresso Real', projecao: 'Projeção (10 meses)' };
                                    return labels[value] || value;
                                }} />
                                <Line type="monotone" dataKey="meta" stroke="#f59e0b" strokeWidth={2} dot={false} name="meta" />
                                <Line type="monotone" dataKey="real" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} name="real" connectNulls={false} />
                                <Line type="monotone" dataKey="projecao" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#8b5cf6', r: 3 }} name="projecao" connectNulls={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 light:border-gray-200 dark:border-white/[0.05] border-t">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Icon name="flag" className="text-amber-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Meta Total</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucaoLideranca.length > 0 && dadosEvolucaoLideranca[0].meta
                                        ? dadosEvolucaoLideranca[0].meta.toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Icon name="trending_up" className="text-green-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Realizado até agora</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucaoLideranca.filter(d => d.real !== null).length > 0
                                        ? (dadosEvolucaoLideranca.filter(d => d.real !== null).slice(-1)[0]?.real || 0).toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Icon name="insights" className="text-purple-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Projeção em 10 meses</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucaoLideranca.filter(d => d.projecao !== null).length > 0
                                        ? (dadosEvolucaoLideranca.filter(d => d.projecao !== null).slice(-1)[0]?.projecao || 0).toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Evolução de Meta por Coordenador */}
                <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Evolução de Meta por Coordenador</h3>
                            <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Análise temporal com projeção baseada em dados reais</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs light:text-gray-600 dark:text-gray-400 mb-2 font-medium">Coordenador</label>
                        <select
                            value={coordenadorSelecionado}
                            onChange={(e) => setCoordenadorSelecionado(e.target.value)}
                            className="w-full px-3 py-2.5 light:bg-gray-50 dark:bg-white/[0.05] light:border-gray-200 dark:border-white/[0.08] border rounded-lg text-sm light:text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors light:hover:bg-gray-100 dark:hover:bg-white/[0.08] cursor-pointer"
                        >
                            <option value="todas" className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">Todos os Coordenadores</option>
                            {coordenadoresDisponiveis.map(coordenador => (
                                <option key={coordenador.id} value={coordenador.id} className="light:bg-white dark:bg-gray-800 light:text-gray-900 dark:text-white">
                                    {coordenador.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={dadosEvolucaoCoordenador} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" />
                                <XAxis dataKey="mes" className="stroke-gray-600 dark:stroke-gray-500" fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                                <YAxis className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString('pt-BR')} />
                                <Tooltip content={<CustomEvolucaoTooltip />} />
                                <Legend iconType="line" iconSize={16} wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }} formatter={(value) => {
                                    const labels: { [key: string]: string } = { meta: 'Meta', real: 'Progresso Real', projecao: 'Projeção (10 meses)' };
                                    return labels[value] || value;
                                }} />
                                <Line type="monotone" dataKey="meta" stroke="#0ea5e9" strokeWidth={2} dot={false} name="meta" />
                                <Line type="monotone" dataKey="real" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} name="real" connectNulls={false} />
                                <Line type="monotone" dataKey="projecao" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#f43f5e', r: 3 }} name="projecao" connectNulls={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 light:border-gray-200 dark:border-white/[0.05] border-t">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                <Icon name="flag" className="text-sky-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Meta Total</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucaoCoordenador.length > 0 && dadosEvolucaoCoordenador[0].meta
                                        ? dadosEvolucaoCoordenador[0].meta.toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Icon name="trending_up" className="text-green-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Realizado até agora</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucaoCoordenador.filter(d => d.real !== null).length > 0
                                        ? (dadosEvolucaoCoordenador.filter(d => d.real !== null).slice(-1)[0]?.real || 0).toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                                <Icon name="insights" className="text-rose-500 text-[18px]" />
                            </div>
                            <div>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500">Projeção em 10 meses</p>
                                <p className="text-sm font-semibold light:text-gray-900 dark:text-white">
                                    {dadosEvolucaoCoordenador.filter(d => d.projecao !== null).length > 0
                                        ? (dadosEvolucaoCoordenador.filter(d => d.projecao !== null).slice(-1)[0]?.projecao || 0).toLocaleString('pt-BR')
                                        : '0'} cadastros
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cadastros por Faixa Etária */}
                <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Cadastros por Faixa Etária</h3>
                            <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Distribuição por idade dos cadastrados</p>
                        </div>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={faixaEtariaData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/5" />
                                <XAxis dataKey="name" className="stroke-gray-600 dark:stroke-gray-500" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis className="stroke-gray-400 dark:stroke-gray-600" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" fill="url(#ageGradient)" radius={[6, 6, 0, 0]} />
                                <defs>
                                    <linearGradient id="ageGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#1e40af" stopOpacity={0.9} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ranking de Crescimento */}
                <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Ranking de Crescimento por Equipe</h3>
                            <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Comparação com período anterior</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {rankingCrescimentoData.length > 0 ? (
                            <table className="w-full">
                                <thead>
                                    <tr className="light:border-gray-200 dark:border-white/[0.05] border-b">
                                        <th className="text-left py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">#</th>
                                        <th className="text-left py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Equipe</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Atual</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Anterior</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Crescimento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingCrescimentoData.map((equipe, index) => (
                                        <tr key={index} className="light:border-gray-100 dark:border-white/[0.03] border-b last:border-0 light:hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 px-2 text-sm light:text-gray-900 dark:text-white font-medium">{index + 1}</td>
                                            <td className="py-3 px-2 text-sm light:text-gray-900 dark:text-white">{equipe.nome}</td>
                                            <td className="py-3 px-2 text-sm light:text-gray-900 dark:text-white text-right font-medium">{equipe.atual}</td>
                                            <td className="py-3 px-2 text-sm light:text-gray-600 dark:text-gray-400 text-right">{equipe.anterior}</td>
                                            <td className="py-3 px-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {equipe.crescimento > 0 ? (
                                                        <>
                                                            <Icon name="trending_up" className="text-[14px] text-emerald-500" />
                                                            <span className="text-sm font-semibold text-emerald-500">+{equipe.crescimento}%</span>
                                                        </>
                                                    ) : equipe.crescimento < 0 ? (
                                                        <>
                                                            <Icon name="trending_down" className="text-[14px] text-rose-500" />
                                                            <span className="text-sm font-semibold text-rose-500">{equipe.crescimento}%</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Icon name="remove" className="text-[14px] light:text-gray-500 dark:text-gray-400" />
                                                            <span className="text-sm font-medium light:text-gray-500 dark:text-gray-400">0%</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-8 light:text-gray-500 dark:text-gray-400 text-sm">
                                Sem dados disponíveis
                            </div>
                        )}
                    </div>
                </div>

                {/* Lideranças Inativas */}
                <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl light:border-gray-200 dark:border-white/[0.05] border shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Icon name="warning" className="text-amber-500 text-[18px]" />
                            </div>
                            <div>
                                <h3 className="text-base font-medium light:text-gray-900 dark:text-white tracking-tight">Lideranças Inativas</h3>
                                <p className="text-xs light:text-gray-600 dark:text-gray-500 mt-0.5 font-light">Sem cadastros nos últimos 30 dias</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {liderancasInativasData.length === 0 ? (
                            <div className="flex items-center justify-center py-8 px-4 light:bg-emerald-50 dark:bg-emerald-500/5 rounded-lg border light:border-emerald-200 dark:border-emerald-500/20">
                                <Icon name="check_circle" className="text-emerald-500 text-[20px] mr-2" />
                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Todas as lideranças estão ativas!</span>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="light:border-gray-200 dark:border-white/[0.05] border-b">
                                        <th className="text-left py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                                        <th className="text-left py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Equipe</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium light:text-gray-600 dark:text-gray-400 uppercase tracking-wider">Último Cadastro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {liderancasInativasData.map((lideranca, index) => (
                                        <tr key={index} className="light:border-gray-100 dark:border-white/[0.03] border-b last:border-0 light:hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 px-2 text-sm light:text-gray-900 dark:text-white">{lideranca.nome}</td>
                                            <td className="py-3 px-2 text-sm light:text-gray-600 dark:text-gray-400">{lideranca.equipe}</td>
                                            <td className="py-3 px-2 text-sm light:text-gray-600 dark:text-gray-400 text-right font-medium">{lideranca.ultimoCadastro}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
