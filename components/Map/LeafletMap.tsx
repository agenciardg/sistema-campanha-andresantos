import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useTheme } from '../../contexts/ThemeContext';

// Tipos
export interface CadastroMapa {
  id: number;
  nome: string;
  telefone: string;
  email?: string;
  bairro: string;
  cidade: string;
  latitude: number;
  longitude: number;
  cadastradoPor: {
    tipo: 'coordenador' | 'lideranca' | 'equipe';
    nome: string;
  };
  organizacao?: string;
  dataCadastro: string;
}

interface LeafletMapProps {
  cadastros: CadastroMapa[];
  filtros: {
    responsavel: ('coordenador' | 'lideranca' | 'equipe')[];
    organizacao: string | null;
  };
  visualizacao: 'markers' | 'clusters' | 'heatmap';
  onCadastroClick?: (cadastro: CadastroMapa) => void;
  isFullscreen?: boolean;
}

// Cores por tipo de responsável
const CORES_RESPONSAVEL = {
  coordenador: '#1e5a8d',
  lideranca: '#f59e0b',
  equipe: '#10b981'
};

// Criar ícone customizado
const createCustomIcon = (tipo: 'coordenador' | 'lideranca' | 'equipe') => {
  const cor = CORES_RESPONSAVEL[tipo];
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background: ${cor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 14px;
          font-weight: bold;
        ">●</span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

const LeafletMap: React.FC<LeafletMapProps> = ({ 
  cadastros, 
  filtros, 
  visualizacao,
  onCadastroClick,
  isFullscreen = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | L.LayerGroup | null>(null);
  const { theme } = useTheme();

  // Invalidar tamanho do mapa quando mudar fullscreen
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300);
    }
  }, [isFullscreen]);

  // Filtrar cadastros
  const cadastrosFiltrados = cadastros.filter(c => {
    if (filtros.responsavel.length > 0 && !filtros.responsavel.includes(c.cadastradoPor.tipo)) {
      return false;
    }
    if (filtros.organizacao && c.organizacao !== filtros.organizacao) {
      return false;
    }
    return true;
  });

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Centro do Estado de São Paulo
    const spCenter: L.LatLngExpression = [-22.2, -48.8];
    
    // Limites do Estado de São Paulo (bounding box)
    const spBounds: L.LatLngBoundsExpression = [
      [-25.5, -53.5], // Sudoeste
      [-19.5, -44.0]  // Nordeste
    ];
    
    // Criar mapa
    const map = L.map(mapRef.current, {
      center: spCenter,
      zoom: 7,
      zoomControl: false,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: spBounds,
      maxBoundsViscosity: 1.0
    });

    // Adicionar controle de zoom no canto direito
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles CartoDB Positron (cor natural clara)
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    });
    
    tileLayer.addTo(map);

    // Carregar contorno do Estado de SP
    fetch('/geojson/sp-estado.json')
      .then(res => res.json())
      .then(data => {
        // Adicionar borda do estado de SP
        L.geoJSON(data, {
          style: {
            color: '#1e5a8d',
            weight: 3,
            fillColor: 'transparent',
            fillOpacity: 0
          }
        }).addTo(map);
      })
      .catch(err => console.error('Erro ao carregar GeoJSON:', err));

    mapInstanceRef.current = map;

    // Forçar recálculo do tamanho do mapa após renderização
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Listener para redimensionamento da janela
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

    const map = mapInstanceRef.current;

    // Remover camada anterior
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }

    // Criar nova camada
    let layer: L.MarkerClusterGroup | L.LayerGroup;

    if (visualizacao === 'clusters') {
      layer = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          let size = 'small';
          let color = '#10b981';
          
          if (count > 50) {
            size = 'large';
            color = '#ef4444';
          } else if (count > 10) {
            size = 'medium';
            color = '#f59e0b';
          }

          return L.divIcon({
            html: `<div style="
              background: ${color};
              color: white;
              width: ${size === 'large' ? 50 : size === 'medium' ? 40 : 30}px;
              height: ${size === 'large' ? 50 : size === 'medium' ? 40 : 30}px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: ${size === 'large' ? 14 : size === 'medium' ? 12 : 10}px;
              border: 3px solid white;
              box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            ">${count}</div>`,
            className: 'marker-cluster',
            iconSize: L.point(size === 'large' ? 50 : size === 'medium' ? 40 : 30, size === 'large' ? 50 : size === 'medium' ? 40 : 30)
          });
        }
      });
    } else {
      layer = L.layerGroup();
    }

    // Adicionar markers
    cadastrosFiltrados.forEach(cadastro => {
      const marker = L.marker([cadastro.latitude, cadastro.longitude], {
        icon: createCustomIcon(cadastro.cadastradoPor.tipo)
      });

      // Popup
      const popupContent = `
        <div style="
          min-width: 200px;
          font-family: 'Inter', sans-serif;
        ">
          <div style="
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 8px;
            color: ${theme === 'dark' ? '#fff' : '#111'};
          ">${cadastro.nome}</div>
          
          <div style="
            font-size: 12px;
            color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
            margin-bottom: 4px;
          ">
            📞 ${cadastro.telefone}
          </div>
          
          ${cadastro.email ? `
            <div style="
              font-size: 12px;
              color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
              margin-bottom: 4px;
            ">
              📧 ${cadastro.email}
            </div>
          ` : ''}
          
          <div style="
            font-size: 12px;
            color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
            margin-bottom: 8px;
          ">
            📍 ${cadastro.bairro}, ${cadastro.cidade}
          </div>
          
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding-top: 8px;
            border-top: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          ">
            <span style="
              display: inline-block;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${CORES_RESPONSAVEL[cadastro.cadastradoPor.tipo]};
            "></span>
            <span style="
              font-size: 11px;
              color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
            ">
              ${cadastro.cadastradoPor.tipo === 'coordenador' ? 'Coordenador' : 
                cadastro.cadastradoPor.tipo === 'lideranca' ? 'Liderança' : 'Equipe'}: 
              ${cadastro.cadastradoPor.nome}
            </span>
          </div>
          
          ${cadastro.organizacao ? `
            <div style="
              font-size: 11px;
              color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
              margin-top: 4px;
            ">
              🏢 ${cadastro.organizacao}
            </div>
          ` : ''}
          
          <div style="
            font-size: 10px;
            color: ${theme === 'dark' ? '#6b7280' : '#9ca3af'};
            margin-top: 8px;
          ">
            📅 Cadastrado em ${cadastro.dataCadastro}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: theme === 'dark' ? 'dark-popup' : 'light-popup'
      });

      marker.on('click', () => {
        if (onCadastroClick) {
          onCadastroClick(cadastro);
        }
      });

      layer.addLayer(marker);
    });

    layer.addTo(map);
    markersLayerRef.current = layer;

  }, [cadastrosFiltrados, visualizacao, theme, onCadastroClick]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: '500px' }}
    />
  );
};

export default LeafletMap;
