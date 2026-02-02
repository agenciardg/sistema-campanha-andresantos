import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useTheme } from '../../contexts/ThemeContext';
import { Organizacao, Equipe, Lideranca, Cadastro, Coordenador } from '../../lib/supabase';

interface LeafletMapCompleteProps {
  organizacoes: Organizacao[];
  equipes: Equipe[];
  liderancas: Lideranca[];
  coordenadores?: Coordenador[];
  cadastros: Cadastro[];
  filtroEquipes?: string[];
  visualizacao: 'markers' | 'clusters';
  mostrarOrganizacoes?: boolean;
  mostrarEquipes?: boolean;
  mostrarLiderancas?: boolean;
  mostrarCoordenadores?: boolean;
  mostrarCadastros?: boolean;
  mostrarCirculosCadastros?: boolean;
  mostrarPontosCadastros?: boolean;
  isFullscreen?: boolean;
}

// Interface para círculos de cadastros agrupados por bairro
interface CirculoBairro {
  bairro: string;
  centro: { lat: number; lng: number };
  cadastros: Cadastro[];
  quantidadeCadastros: number;
  quantidadeEquipes: number;
  opacidade: number;
}

// Interface para agrupamento de cadastros próximos
interface GrupoCadastros {
  centro: { lat: number; lng: number };
  cadastros: Cadastro[];
  quantidade: number;
  raio: number;
}

// Função para calcular distância entre dois pontos (em metros)
function calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Função para agrupar cadastros próximos
function agruparCadastrosProximos(cadastros: Cadastro[], raioBase: number = 200): GrupoCadastros[] {
  const grupos: GrupoCadastros[] = [];
  const processados = new Set<string>();

  for (const cadastro of cadastros) {
    if (processados.has(cadastro.id)) continue;
    if (!cadastro.latitude || !cadastro.longitude) continue;

    const lat = typeof cadastro.latitude === 'string' ? parseFloat(cadastro.latitude) : cadastro.latitude;
    const lng = typeof cadastro.longitude === 'string' ? parseFloat(cadastro.longitude) : cadastro.longitude;
    
    if (isNaN(lat) || isNaN(lng)) continue;

    // Criar novo grupo com este cadastro
    const grupo: GrupoCadastros = {
      centro: { lat, lng },
      cadastros: [cadastro],
      quantidade: 1,
      raio: raioBase
    };

    // Procurar cadastros próximos
    for (const outroCadastro of cadastros) {
      if (cadastro.id === outroCadastro.id || processados.has(outroCadastro.id)) continue;
      if (!outroCadastro.latitude || !outroCadastro.longitude) continue;

      const outroLat = typeof outroCadastro.latitude === 'string' ? parseFloat(outroCadastro.latitude) : outroCadastro.latitude;
      const outroLng = typeof outroCadastro.longitude === 'string' ? parseFloat(outroCadastro.longitude) : outroCadastro.longitude;
      
      if (isNaN(outroLat) || isNaN(outroLng)) continue;

      const distancia = calcularDistancia(lat, lng, outroLat, outroLng);
      
      // Se a distância for menor que o raio, agrupar
      if (distancia < raioBase * 1.5) { // 1.5x o raio base permite sobreposição significativa
        grupo.cadastros.push(outroCadastro);
        grupo.quantidade++;
        processados.add(outroCadastro.id);
        
        // Aumentar o raio proporcionalmente à quantidade de cadastros
        grupo.raio = raioBase * Math.sqrt(grupo.quantidade);
      }
    }

    // Recalcular centro como média de todos os cadastros do grupo
    if (grupo.quantidade > 1) {
      let latTotal = 0;
      let lngTotal = 0;
      for (const cad of grupo.cadastros) {
        const cadLat = typeof cad.latitude === 'string' ? parseFloat(cad.latitude) : cad.latitude;
        const cadLng = typeof cad.longitude === 'string' ? parseFloat(cad.longitude) : cad.longitude;
        latTotal += cadLat;
        lngTotal += cadLng;
      }
      grupo.centro = {
        lat: latTotal / grupo.quantidade,
        lng: lngTotal / grupo.quantidade
      };
    }

    grupos.push(grupo);
    processados.add(cadastro.id);
  }

  return grupos;
}

// Cores por tipo de organização
const getCoresOrganizacao = (tipo: string): string => {
  const cores: { [key: string]: string } = {
    'Religioso': '#9333ea',
    'Sindicato': '#f97316',
    'Comunitário': '#10b981',
    'Empresarial': '#3b82f6',
    'Associação': '#eab308',
  };
  return cores[tipo] || '#6b7280';
};

// Criar ícone para ORGANIZAÇÃO (prédio - 36px)
const createOrganizacaoIcon = (cor: string) => {
  return L.divIcon({
    className: 'organizacao-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${cor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 16px;
        ">🏢</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

// Criar ícone para EQUIPE (grande - 40px)
const createEquipeIcon = (cor: string, nome: string, temOrganizacao: boolean) => {
  return L.divIcon({
    className: 'equipe-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px;">
        <div style="
          width: 44px;
          height: 44px;
          background: ${cor};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-size: 18px;
          ">👥</span>
        </div>
        ${temOrganizacao ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 16px;
            height: 16px;
            background: #f59e0b;
            border: 2px solid white;
            border-radius: 9999px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            line-height: 1;
            color: #0d1117;
            font-weight: 700;
          ">🏢</div>
        ` : ''}
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  });
};

// Criar ícone para LIDERANÇA (médio - 28px)
const createLiderancaIcon = (cor: string) => {
  return L.divIcon({
    className: 'lideranca-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${cor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 12px;
        ">👤</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
};

// Criar ícone para CADASTRO (pequeno - 12px bolinha)
const createCadastroIcon = (cor: string) => {
  return L.divIcon({
    className: 'cadastro-marker',
    html: `
      <div style="
        width: 12px;
        height: 12px;
        background: ${cor};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  });
};

// Criar ícone para COORDENADOR (médio - 28px)
const createCoordenadorIcon = (cor: string) => {
  return L.divIcon({
    className: 'coordenador-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${cor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 12px;
        ">🧭</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
};

// Funções auxiliares para círculos de densidade

// Calcula opacidade baseado na quantidade de equipes no bairro
const calcularOpacidade = (quantidadeEquipes: number): number => {
  if (quantidadeEquipes === 0) return 0.3; // Mínimo (sem equipes)
  if (quantidadeEquipes === 1) return 0.3; // 1 equipe
  if (quantidadeEquipes <= 5) return 0.5;  // 2-5 equipes
  if (quantidadeEquipes <= 10) return 0.7; // 6-10 equipes
  return 0.9; // 11+ equipes
};

// Conta quantas equipes existem em cada bairro
const contarEquipesPorBairro = (equipes: Equipe[]): Map<string, number> => {
  const contagemPorBairro = new Map<string, number>();

  for (const equipe of equipes) {
    const bairro = (equipe.bairro || 'Sem Bairro').trim().toUpperCase();
    const countAtual = contagemPorBairro.get(bairro) || 0;
    contagemPorBairro.set(bairro, countAtual + 1);
  }

  return contagemPorBairro;
};

// Agrupa cadastros por bairro e calcula opacidade baseada nas equipes
const agruparCadastrosPorBairro = (
  cadastros: Cadastro[],
  equipes: Equipe[]
): CirculoBairro[] => {
  const circulos: CirculoBairro[] = [];

  // Conta equipes por bairro
  const equipesPorBairro = contarEquipesPorBairro(equipes);

  // Agrupa cadastros por bairro
  const cadastrosPorBairro = new Map<string, Cadastro[]>();

  for (const cadastro of cadastros) {
    // Só processar cadastros com coordenadas válidas
    if (!cadastro.latitude || !cadastro.longitude) continue;

    const bairro = (cadastro.bairro || 'Sem Bairro').trim().toUpperCase();

    if (!cadastrosPorBairro.has(bairro)) {
      cadastrosPorBairro.set(bairro, []);
    }

    cadastrosPorBairro.get(bairro)!.push(cadastro);
  }

  // Cria um círculo para cada bairro
  for (const [bairro, cadastrosDoBairro] of cadastrosPorBairro) {
    // Calcula centro do bairro (média das coordenadas dos cadastros)
    let latTotal = 0;
    let lngTotal = 0;
    let count = 0;

    for (const cadastro of cadastrosDoBairro) {
      const lat = typeof cadastro.latitude === 'string' ? parseFloat(cadastro.latitude) : cadastro.latitude;
      const lng = typeof cadastro.longitude === 'string' ? parseFloat(cadastro.longitude) : cadastro.longitude;

      if (!isNaN(lat) && !isNaN(lng)) {
        latTotal += lat;
        lngTotal += lng;
        count++;
      }
    }

    if (count === 0) continue; // Pula se não houver coordenadas válidas

    const latMedia = latTotal / count;
    const lngMedia = lngTotal / count;

    // Quantidade de equipes no bairro (define opacidade)
    const quantidadeEquipes = equipesPorBairro.get(bairro) || 0;

    // Calcula opacidade baseado na quantidade de EQUIPES
    const opacidade = calcularOpacidade(quantidadeEquipes);

    circulos.push({
      bairro,
      centro: { lat: latMedia, lng: lngMedia },
      cadastros: cadastrosDoBairro,
      quantidadeCadastros: cadastrosDoBairro.length,
      quantidadeEquipes,
      opacidade
    });
  }

  return circulos;
};

const LeafletMapComplete: React.FC<LeafletMapCompleteProps> = ({
  organizacoes = [],
  equipes = [],
  liderancas = [],
  coordenadores = [],
  cadastros = [],
  filtroEquipes = [],
  visualizacao = 'markers',
  mostrarOrganizacoes = true,
  mostrarEquipes = true,
  mostrarLiderancas = true,
  mostrarCoordenadores = true,
  mostrarCadastros = true,
  mostrarCirculosCadastros = true,
  mostrarPontosCadastros = true,
  isFullscreen = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const organizacoesLayerRef = useRef<L.LayerGroup | null>(null);
  const equipesLayerRef = useRef<L.LayerGroup | null>(null);
  const liderancasLayerRef = useRef<L.LayerGroup | null>(null);
  const coordenadoresLayerRef = useRef<L.LayerGroup | null>(null);
  const cadastrosLayerRef = useRef<L.LayerGroup | null>(null);
  const { theme } = useTheme();

  // Invalidar tamanho do mapa quando mudar fullscreen
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300);
    }
  }, [isFullscreen]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const spCenter: L.LatLngExpression = [-23.5, -47.0];
    const spBounds: L.LatLngBoundsExpression = [
      [-25.5, -53.5],
      [-19.5, -44.0]
    ];

    const map = L.map(mapRef.current, {
      center: spCenter,
      zoom: 8,
      zoomControl: false,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: spBounds,
      maxBoundsViscosity: 1.0
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Carregar contorno do Estado de SP
    fetch('/geojson/sp-estado.json')
      .then(res => res.json())
      .then(data => {
        L.geoJSON(data, {
          style: {
            color: '#1e5a8d',
            weight: 2,
            fillColor: 'transparent',
            fillOpacity: 0
          }
        }).addTo(map);
      })
      .catch(err => console.error('Erro ao carregar GeoJSON:', err));

    // Criar layers
    organizacoesLayerRef.current = L.layerGroup().addTo(map);
    equipesLayerRef.current = L.layerGroup().addTo(map);
    liderancasLayerRef.current = L.layerGroup().addTo(map);
    coordenadoresLayerRef.current = L.layerGroup().addTo(map);
    cadastrosLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Atualizar markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Limpar layers
    organizacoesLayerRef.current?.clearLayers();
    equipesLayerRef.current?.clearLayers();
    liderancasLayerRef.current?.clearLayers();
    coordenadoresLayerRef.current?.clearLayers();
    cadastrosLayerRef.current?.clearLayers();

    // Adicionar ORGANIZAÇÕES (ícones de prédio)
    if (mostrarOrganizacoes) {
      organizacoes.forEach(org => {
        // Só renderizar se tiver coordenadas
        if (!org.latitude || !org.longitude) return;

        const cor = getCoresOrganizacao(org.tipo);
        const marker = L.marker([org.latitude, org.longitude], {
          icon: createOrganizacaoIcon(cor),
          zIndexOffset: 900
        });

        marker.bindPopup(`
          <div style="min-width: 180px; font-family: Inter, sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 12px; height: 12px; background: ${cor}; border-radius: 50%;"></div>
              <strong style="font-size: 14px;">${org.nome}</strong>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 4px;">ORGANIZAÇÃO - ${org.tipo}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              📍 ${org.endereco || ''} ${org.numero || ''}, ${org.bairro || ''}
            </div>
            <div style="font-size: 12px; color: #666;">
              🏙️ ${org.cidade || ''} - ${org.estado || ''}
            </div>
          </div>
        `);

        organizacoesLayerRef.current?.addLayer(marker);
      });
    }

    // Filtrar equipes
    const equipesParaMostrar = filtroEquipes.length > 0
      ? equipes.filter(e => filtroEquipes.includes(e.id))
      : equipes;

    // Adicionar EQUIPES (ícones grandes)
    if (mostrarEquipes) {
      equipesParaMostrar.forEach(equipe => {
        // Só renderizar se tiver coordenadas
        if (!equipe.latitude || !equipe.longitude) return;
        
        // Converter para número (pode vir como string do banco)
        const lat = typeof equipe.latitude === 'string' ? parseFloat(equipe.latitude) : equipe.latitude;
        const lng = typeof equipe.longitude === 'string' ? parseFloat(equipe.longitude) : equipe.longitude;
        
        if (isNaN(lat) || isNaN(lng)) return;

        const liderancasDaEquipe = liderancas.filter(l => l.equipe_id === equipe.id);
        const cadastrosDaEquipe = cadastros.filter(c => 
          liderancasDaEquipe.some(l => l.id === c.lideranca_id)
        );

        const marker = L.marker([lat, lng], {
          icon: createEquipeIcon(equipe.cor, equipe.nome, !!equipe.organizacao_id),
          zIndexOffset: 1000
        });

        const orgNome = equipe.organizacao_id
          ? (organizacoes.find(o => o.id === equipe.organizacao_id)?.nome || 'N/A')
          : null;

        marker.bindPopup(`
          <div style="min-width: 200px; font-family: Inter, sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 12px; height: 12px; background: ${equipe.cor}; border-radius: 50%;"></div>
              <strong style="font-size: 14px;">${equipe.nome}</strong>
            </div>
            ${orgNome ? `<div style="font-size: 11px; color: #666; margin-bottom: 6px;">🏢 Organização: <strong>${orgNome}</strong></div>` : ''}
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              📍 ${equipe.endereco || ''} ${equipe.numero || ''}, ${equipe.bairro || ''}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              🏙️ ${equipe.cidade || ''} - ${equipe.estado || ''}
            </div>
            <button
              style="width: 100%; padding: 8px 10px; background: #1e5a8d; color: white; border: 0; border-radius: 10px; font-size: 12px; cursor: pointer;"
              onclick="window.dispatchEvent(new CustomEvent('open-details', { detail: { type: 'team', id: '${equipe.id}' } }))"
            >Ver métricas</button>
            <div style="display: flex; gap: 16px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
              <div>
                <div style="font-size: 18px; font-weight: bold; color: ${equipe.cor};">${liderancasDaEquipe.length}</div>
                <div style="font-size: 10px; color: #888;">Lideranças</div>
              </div>
              <div>
                <div style="font-size: 18px; font-weight: bold; color: ${equipe.cor};">${cadastrosDaEquipe.length}</div>
                <div style="font-size: 10px; color: #888;">Cadastros</div>
              </div>
            </div>
          </div>
        `);

        equipesLayerRef.current?.addLayer(marker);
      });
    }

    // Adicionar COORDENADORES (ícones médios)
    if (mostrarCoordenadores && coordenadores.length > 0) {
      coordenadores.forEach(coordenador => {
        if (!coordenador.latitude || !coordenador.longitude) return;

        const lat = typeof coordenador.latitude === 'string' ? parseFloat(coordenador.latitude as any) : (coordenador.latitude as any);
        const lng = typeof coordenador.longitude === 'string' ? parseFloat(coordenador.longitude as any) : (coordenador.longitude as any);
        if (isNaN(lat) || isNaN(lng)) return;

        const cor = '#0ea5e9';
        const marker = L.marker([lat, lng], {
          icon: createCoordenadorIcon(cor),
          zIndexOffset: 700
        });

        marker.bindPopup(`
          <div style="min-width: 180px; font-family: Inter, sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 10px; height: 10px; background: ${cor}; border-radius: 50%;"></div>
              <strong style="font-size: 13px;">${coordenador.nome}</strong>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 6px;">COORDENADOR</div>
            <button
              style="width: 100%; padding: 8px 10px; background: #1e5a8d; color: white; border: 0; border-radius: 10px; font-size: 12px; cursor: pointer;"
              onclick="window.dispatchEvent(new CustomEvent('open-details', { detail: { type: 'coordinator', id: '${coordenador.id}' } }))"
            >Ver métricas</button>
          </div>
        `);

        coordenadoresLayerRef.current?.addLayer(marker);
      });
    }

    // Adicionar LIDERANÇAS (ícones médios)
    if (mostrarLiderancas) {
      const liderancasParaMostrar = filtroEquipes.length > 0
        ? liderancas.filter(l => filtroEquipes.includes(l.equipe_id))
        : liderancas;

      liderancasParaMostrar.forEach(lideranca => {
        // Só renderizar se tiver coordenadas
        if (!lideranca.latitude || !lideranca.longitude) return;
        
        // Converter para número (pode vir como string do banco)
        const lat = typeof lideranca.latitude === 'string' ? parseFloat(lideranca.latitude) : lideranca.latitude;
        const lng = typeof lideranca.longitude === 'string' ? parseFloat(lideranca.longitude) : lideranca.longitude;
        
        if (isNaN(lat) || isNaN(lng)) return;

        const equipe = equipes.find(e => e.id === lideranca.equipe_id);
        const cor = equipe?.cor || '#6b7280';
        const cadastrosDaLideranca = cadastros.filter(c => c.lideranca_id === lideranca.id);

        const marker = L.marker([lat, lng], {
          icon: createLiderancaIcon(cor),
          zIndexOffset: 500
        });

        marker.bindPopup(`
          <div style="min-width: 180px; font-family: Inter, sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 10px; height: 10px; background: ${cor}; border-radius: 50%;"></div>
              <strong style="font-size: 13px;">${lideranca.nome}</strong>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 4px;">LIDERANÇA</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              📍 ${lideranca.endereco || ''}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              📞 ${lideranca.telefone || ''}
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
              <div style="font-size: 11px; color: #888;">Equipe: <span style="color: ${cor}; font-weight: 500;">${equipe?.nome || 'N/A'}</span></div>
            </div>
            <button
              style="width: 100%; margin-top: 10px; padding: 8px 10px; background: #1e5a8d; color: white; border: 0; border-radius: 10px; font-size: 12px; cursor: pointer;"
              onclick="window.dispatchEvent(new CustomEvent('open-details', { detail: { type: 'leader', id: '${lideranca.id}' } }))"
            >Ver métricas</button>
            <div style="margin-top: 8px;">
              <div style="font-size: 16px; font-weight: bold; color: ${cor};">${cadastrosDaLideranca.length}</div>
              <div style="font-size: 10px; color: #888;">Cadastros realizados</div>
            </div>
          </div>
        `);

        liderancasLayerRef.current?.addLayer(marker);
      });
    }

    // Adicionar CADASTROS (círculos de 10km centrados na coordenada exata)
    if (mostrarCadastros) {
      const liderancasIds = filtroEquipes.length > 0
        ? liderancas.filter(l => filtroEquipes.includes(l.equipe_id)).map(l => l.id)
        : liderancas.map(l => l.id);

      const cadastrosParaMostrar = cadastros.filter(c => liderancasIds.includes(c.lideranca_id || ''));

      // Contar equipes por bairro para calcular opacidade
      const equipesParaContagem = filtroEquipes.length > 0
        ? equipes.filter(e => filtroEquipes.includes(e.id))
        : equipes;
      
      const equipesPorBairro = contarEquipesPorBairro(equipesParaContagem);

      // Agrupar cadastros próximos para evitar sobreposição
      const gruposCadastros = agruparCadastrosProximos(cadastrosParaMostrar, 200);

      // Renderizar grupos de cadastros
      gruposCadastros.forEach(grupo => {
        const { centro, cadastros: cadastrosGrupo, quantidade, raio } = grupo;

        // Calcular opacidade baseada na quantidade de equipes no bairro (usando primeiro cadastro)
        const primeiroCadastro = cadastrosGrupo[0];
        const bairro = (primeiroCadastro.bairro || 'Sem Bairro').trim().toUpperCase();
        const quantidadeEquipes = equipesPorBairro.get(bairro) || 0;
        const opacidade = calcularOpacidade(quantidadeEquipes);

        // 1. CÍRCULO AGRUPADO com raio proporcional
        const circle = L.circle([centro.lat, centro.lng], {
          radius: raio, // Raio ajustado pela quantidade de cadastros
          fillColor: '#3b82f6', // Azul
          fillOpacity: opacidade * 0.4, // Reduzir opacidade para não cobrir o mapa
          color: '#1e40af', // Azul escuro (borda)
          weight: 1,
          opacity: 0.4
        });

        // Tooltip do círculo agrupado
        circle.bindTooltip(`
          <div style="font-family: Inter, sans-serif; font-size: 12px;">
            ${quantidade === 1 ? `<strong>${primeiroCadastro.nome}</strong>` : `<strong>${quantidade} cadastros</strong>`}<br/>
            ${primeiroCadastro.bairro || 'Sem bairro'}<br/>
            ${quantidadeEquipes} equipe(s) no bairro
          </div>
        `, {
          sticky: true
        });

        // Popup do círculo agrupado
        if (quantidade === 1) {
          // Popup individual
          const cadastro = primeiroCadastro;
          const lideranca = liderancas.find(l => l.id === cadastro.lideranca_id);
          const equipe = lideranca ? equipes.find(e => e.id === lideranca.equipe_id) : undefined;
          const cor = equipe?.cor || '#6b7280';

          circle.bindPopup(`
            <div style="min-width: 180px; font-family: Inter, sans-serif;">
              <strong style="font-size: 13px;">${cadastro.nome}</strong>
              <div style="font-size: 11px; color: #666; margin-top: 6px;">
                📍 ${cadastro.endereco || ''} ${cadastro.numero || ''}, ${cadastro.bairro || ''}
              </div>
              <div style="font-size: 11px; color: #666;">
                🏙️ ${cadastro.cidade || ''} - ${cadastro.estado || ''}
              </div>
              <div style="font-size: 11px; color: #666;">
                📞 ${cadastro.telefone || ''}
              </div>
              ${cadastro.email ? `<div style="font-size: 11px; color: #666;">✉️ ${cadastro.email}</div>` : ''}
              <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
                <div style="font-size: 10px; color: #888;">
                  Liderança: <span style="color: ${cor};">${lideranca?.nome || 'N/A'}</span>
                </div>
                <div style="font-size: 10px; color: #888;">
                  Equipe: <span style="color: ${cor};">${equipe?.nome || 'N/A'}</span>
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 4px;">
                  📅 ${cadastro.criado_em ? new Date(cadastro.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                </div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                <div style="font-size: 10px; color: #3b82f6; font-weight: 600;">
                  🔵 ${quantidadeEquipes} equipe(s) atuando no bairro
                </div>
              </div>
            </div>
          `);
        } else {
          // Popup agrupado
          const nomes = cadastrosGrupo.slice(0, 5).map(c => c.nome).join(', ');
          const resto = quantidade - 5;

          circle.bindPopup(`
            <div style="min-width: 220px; font-family: Inter, sans-serif;">
              <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
                📍 ${quantidade} cadastros agrupados
              </h3>
              <div style="margin-bottom: 12px; font-size: 12px;">
                <p style="color: #666; margin: 4px 0;">
                  🏙️ ${primeiroCadastro.cidade || ''} - ${primeiroCadastro.estado || ''}
                </p>
                <p style="color: #3b82f6; font-weight: 600; margin: 4px 0;">
                  🔵 ${quantidadeEquipes} equipe(s) atuando no bairro
                </p>
              </div>
              <div style="margin-bottom: 8px;">
                <p style="font-size: 10px; color: #888; margin-bottom: 4px;">Cadastros neste grupo:</p>
                ${cadastrosGrupo.slice(0, 5).map(cad => `
                  <div style="font-size: 11px; border-bottom: 1px solid #eee; padding: 4px 0;">
                    <span style="font-weight: 500;">${cad.nome}</span>
                  </div>
                `).join('')}
                ${resto > 0 ? `<p style="font-size: 10px; color: #888; margin-top: 4px;">+ ${resto} mais</p>` : ''}
              </div>
            </div>
          `);
        }

        // Efeito hover: aumentar opacidade
        circle.on('mouseover', () => {
          circle.setStyle({
            fillOpacity: Math.min(opacidade * 0.4 + 0.2, 1)
          });
        });

        circle.on('mouseout', () => {
          circle.setStyle({
            fillOpacity: opacidade * 0.4
          });
        });

        // Adicionar círculo apenas se a opção estiver ativada
        if (mostrarCirculosCadastros) {
          cadastrosLayerRef.current?.addLayer(circle);
        }

        // 2. PONTOS CENTRAIS (um para cada cadastro individual)
        if (mostrarPontosCadastros) {
          cadastrosGrupo.forEach(cadastro => {
            const lat = typeof cadastro.latitude === 'string' ? parseFloat(cadastro.latitude) : cadastro.latitude;
            const lng = typeof cadastro.longitude === 'string' ? parseFloat(cadastro.longitude) : cadastro.longitude;
            
            if (isNaN(lat) || isNaN(lng)) return;

            const pontocentral = L.circleMarker([lat, lng], {
              radius: 4,
              fillColor: '#1e293b', // Cinza escuro
              fillOpacity: 1,
              color: '#ffffff', // Borda branca
              weight: 2,
              opacity: 1,
              pane: 'markerPane' // Garante que fica acima dos círculos
            });

            // Popup do ponto individual
            const lideranca = liderancas.find(l => l.id === cadastro.lideranca_id);
            const equipe = lideranca ? equipes.find(e => e.id === lideranca.equipe_id) : undefined;
            const cor = equipe?.cor || '#6b7280';

            pontocentral.bindPopup(`
              <div style="min-width: 180px; font-family: Inter, sans-serif;">
                <strong style="font-size: 13px;">${cadastro.nome}</strong>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">
                  📍 ${cadastro.endereco || ''} ${cadastro.numero || ''}, ${cadastro.bairro || ''}
                </div>
                <div style="font-size: 11px; color: #666;">
                  🏙️ ${cadastro.cidade || ''} - ${cadastro.estado || ''}
                </div>
                <div style="font-size: 11px; color: #666;">
                  📞 ${cadastro.telefone || ''}
                </div>
                ${cadastro.email ? `<div style="font-size: 11px; color: #666;">✉️ ${cadastro.email}</div>` : ''}
                <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
                  <div style="font-size: 10px; color: #888;">
                    Liderança: <span style="color: ${cor};">${lideranca?.nome || 'N/A'}</span>
                  </div>
                  <div style="font-size: 10px; color: #888;">
                    Equipe: <span style="color: ${cor};">${equipe?.nome || 'N/A'}</span>
                  </div>
                  <div style="font-size: 10px; color: #888; margin-top: 4px;">
                    📅 ${cadastro.criado_em ? new Date(cadastro.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                  </div>
                </div>
              </div>
            `);

            cadastrosLayerRef.current?.addLayer(pontocentral);
          });
        }
      });

      // Código antigo de clusters removido
      if (false && visualizacao === 'clusters') {
        const clusterGroup = (L as any).markerClusterGroup({
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            return L.divIcon({
              html: `<div style="
                background: linear-gradient(135deg, #1e5a8d 0%, #2563eb 100%);
                color: white;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 12px;
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">${count}</div>`,
              className: 'custom-cluster',
              iconSize: L.point(36, 36)
            });
          }
        });

        cadastrosParaMostrar.forEach(cadastro => {
          // Só renderizar se tiver coordenadas
          if (!cadastro.latitude || !cadastro.longitude) return;
          
          // Converter para número (pode vir como string do banco)
          const lat = typeof cadastro.latitude === 'string' ? parseFloat(cadastro.latitude) : cadastro.latitude;
          const lng = typeof cadastro.longitude === 'string' ? parseFloat(cadastro.longitude) : cadastro.longitude;
          
          if (isNaN(lat) || isNaN(lng)) return;

          const lideranca = liderancas.find(l => l.id === cadastro.lideranca_id);
          const equipe = lideranca ? equipes.find(e => e.id === lideranca.equipe_id) : undefined;
          const cor = equipe?.cor || '#6b7280';

          const marker = L.marker([lat, lng], {
            icon: createCadastroIcon(cor)
          });

          marker.bindPopup(`
            <div style="min-width: 160px; font-family: Inter, sans-serif;">
              <strong style="font-size: 12px;">${cadastro.nome}</strong>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">
                📍 ${cadastro.endereco || ''}
              </div>
              <div style="font-size: 11px; color: #666;">
                📞 ${cadastro.telefone || ''}
              </div>
              ${cadastro.email ? `<div style="font-size: 11px; color: #666;">✉️ ${cadastro.email}</div>` : ''}
              <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
                <div style="font-size: 10px; color: #888;">
                  Liderança: <span style="color: ${cor};">${lideranca?.nome || 'N/A'}</span>
                </div>
                <div style="font-size: 10px; color: #888;">
                  Equipe: <span style="color: ${cor};">${equipe?.nome || 'N/A'}</span>
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 4px;">
                  📅 ${cadastro.criado_em ? new Date(cadastro.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                </div>
              </div>
            </div>
          `);

          clusterGroup.addLayer(marker);
        });

        cadastrosLayerRef.current = clusterGroup;
        mapInstanceRef.current?.addLayer(clusterGroup);
      } else {
        // Mantemos apenas a visualização nova (círculos/pontos), controlada pelos toggles.
      }
    }
  }, [
    organizacoes,
    equipes,
    liderancas,
    coordenadores,
    cadastros,
    filtroEquipes,
    visualizacao,
    mostrarOrganizacoes,
    mostrarEquipes,
    mostrarLiderancas,
    mostrarCoordenadores,
    mostrarCadastros,
    mostrarCirculosCadastros,
    mostrarPontosCadastros
  ]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
};

export default LeafletMapComplete;
