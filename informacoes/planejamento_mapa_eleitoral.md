# 📍 Planejamento: Mapa Eleitoral com Leaflet.js

## 🎯 Objetivo Geral

Criar um mapa interativo do **Estado de São Paulo** usando **Leaflet.js** que mostre todos os cadastros realizados (por Coordenadores, Lideranças e Equipes) de forma georreferenciada, permitindo visualizar:

- **Densidade de cadastros** por região
- **Quem fez cada cadastro** (coordenador/liderança/equipe)
- **Clusters de apoio** (onde tem mais concentração)
- **Análise geográfica** para tomada de decisão estratégica

---

## 🗺️ Estrutura do Mapa

### Camadas do Mapa (Layers)

```
┌─────────────────────────────────────────┐
│  Mapa Base (OpenStreetMap)              │
│  ├── Camada 1: Contorno do Estado SP    │
│  ├── Camada 2: Municípios (opcional)    │
│  ├── Camada 3: Bairros (opcional)       │
│  ├── Camada 4: Markers (cadastros)      │
│  ├── Camada 5: Clusters (agrupamentos)  │
│  └── Camada 6: Heatmap (densidade)      │
└─────────────────────────────────────────┘
```

---

## 📊 Dados Geográficos

### 1. **Mapa do Estado de São Paulo**

**Fonte:** IBGE - Instituto Brasileiro de Geografia e Estatística

**GeoJSON do Estado:**
```
https://servicodados.ibge.gov.br/api/v3/malhas/estados/35?formato=application/vnd.geo+json
```

**Características:**
- Formato: GeoJSON
- Contém: Polígono do estado de SP
- Coordenadas: Sistema WGS84 (EPSG:4326)
- Tamanho: ~500KB

**Centro do Mapa:**
- Latitude: -23.5505 (São Paulo capital)
- Longitude: -46.6333
- Zoom inicial: 7 (mostra todo o estado)

---

### 2. **Municípios de São Paulo**

**Fonte:** IBGE

**GeoJSON dos Municípios:**
```
https://servicodados.ibge.gov.br/api/v3/malhas/estados/35?formato=application/vnd.geo+json&intrarregiao=municipio
```

**Características:**
- 645 municípios
- Cada município é um polígono
- Permite colorir por densidade de cadastros
- Tamanho: ~15MB (grande, usar com cuidado)

**Uso:**
- Mostrar divisões municipais no mapa
- Colorir municípios por quantidade de cadastros
- Tooltip ao passar mouse mostrando nome e estatísticas

---

### 3. **Bairros (Opcional)**

**Problema:** Não existe base oficial de bairros do IBGE

**Soluções:**

**Opção A: Usar CEP como aproximação**
- Cada CEP representa uma área pequena
- Agrupar cadastros por CEP
- Mostrar círculo no centro do CEP

**Opção B: Usar Nominatim (OpenStreetMap)**
- API gratuita de geocoding
- Retorna coordenadas de bairros
- Limite: 1 requisição por segundo

**Opção C: Base de dados própria**
- Criar tabela de bairros principais
- Coordenadas manuais dos centros
- Mais preciso para áreas importantes

**Recomendação:** Usar **Opção A** (CEP) por ser mais simples e automático

---

## 🎯 Estrutura de Dados dos Cadastros

### Interface TypeScript

```typescript
interface CadastroGeorreferenciado {
  // Identificação
  id: number;
  nome: string;
  telefone: string;
  email?: string;
  
  // Status político
  status: 'garantido' | 'possivel' | 'duvida';
  
  // Localização
  localizacao: {
    cep: string;
    rua: string;
    numero?: string;
    bairro: string;
    cidade: string;
    estado: 'SP';
    
    // Coordenadas geográficas
    latitude: number;
    longitude: number;
    
    // Precisão da localização
    precisao: 'exata' | 'cep' | 'bairro' | 'cidade';
  };
  
  // Hierarquia (quem cadastrou)
  cadastradoPor: {
    tipo: 'coordenador' | 'lideranca' | 'equipe' | 'direto';
    id: number;
    nome: string;
  };
  
  // Organização (opcional)
  organizacao?: {
    id: number;
    nome: string;
  };
  
  // Metadados
  dataCadastro: Date;
  ultimaAtualizacao: Date;
}
```

---

## 🔄 Fluxo de Geolocalização

### 1. **No Momento do Cadastro**

```
┌─────────────────────────────────────────────────┐
│ Usuário preenche formulário                     │
│   ├── Nome, telefone, email                     │
│   └── CEP (obrigatório)                         │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Sistema busca CEP na BrasilAPI                  │
│   GET https://brasilapi.com.br/api/cep/v2/{cep}│
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ BrasilAPI retorna:                              │
│   {                                             │
│     "cep": "01310-100",                         │
│     "state": "SP",                              │
│     "city": "São Paulo",                        │
│     "neighborhood": "Bela Vista",               │
│     "street": "Avenida Paulista",               │
│     "location": {                               │
│       "type": "Point",                          │
│       "coordinates": {                          │
│         "longitude": "-46.6388",                │
│         "latitude": "-23.5614"                  │
│       }                                         │
│     }                                           │
│   }                                             │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Sistema salva cadastro com lat/long             │
│   - Cadastro completo                           │
│   - Coordenadas geográficas                     │
│   - Pronto para aparecer no mapa                │
└─────────────────────────────────────────────────┘
```

### 2. **Fallback (se BrasilAPI não retornar coordenadas)**

```
┌─────────────────────────────────────────────────┐
│ BrasilAPI não retornou coordenadas              │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Usar Nominatim (OpenStreetMap)                  │
│   GET https://nominatim.openstreetmap.org/      │
│       search?format=json&q={endereço completo}  │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Se ainda falhar:                                │
│   - Usar centro da cidade como aproximação      │
│   - Marcar precisão como "cidade"               │
│   - Permitir edição manual depois               │
└─────────────────────────────────────────────────┘
```

---

## 🎨 Visualização no Mapa

### 1. **Markers Individuais**

**Cores por Status:**
- 🔵 **Azul** (`#1e5a8d`): Garantido
- 🟡 **Amarelo** (`#f59e0b`): Possível
- 🔴 **Vermelho** (`#ef4444`): Dúvida

**Ícones Customizados:**
```javascript
const markerIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div class="marker-pin" style="background-color: ${cor}">
      <div class="marker-icon">
        <i class="material-symbols-outlined">person</i>
      </div>
    </div>
  `,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -42]
});
```

**Popup ao Clicar:**
```
┌─────────────────────────────────┐
│ 👤 João Silva                   │
│ 📞 (11) 99999-9999              │
│ 📧 joao@email.com               │
│ ─────────────────────────────── │
│ 📍 Bela Vista, São Paulo        │
│ 🏢 Igreja Batista Central       │
│ ─────────────────────────────── │
│ ✅ Status: Garantido            │
│ 👥 Cadastrado por: Ana (Líder)  │
│ 📅 15/01/2026                   │
│ ─────────────────────────────── │
│ [Editar] [Ver Detalhes]         │
└─────────────────────────────────┘
```

---

### 2. **Clusters (Agrupamentos)**

**Plugin:** `leaflet.markercluster`

**Comportamento:**
- Agrupa markers próximos automaticamente
- Mostra número de cadastros no cluster
- Ao clicar, faz zoom e expande o cluster

**Cores por Densidade:**
```javascript
// Pequeno (1-10 cadastros)
background: linear-gradient(135deg, #10b981, #059669);
color: white;

// Médio (11-50 cadastros)
background: linear-gradient(135deg, #f59e0b, #d97706);
color: white;

// Grande (51+ cadastros)
background: linear-gradient(135deg, #ef4444, #dc2626);
color: white;
```

**Exemplo Visual:**
```
    ┌─────┐
    │ 127 │  ← Cluster grande (vermelho)
    └─────┘
       │
       ├─── ┌────┐
       │    │ 45 │  ← Cluster médio (amarelo)
       │    └────┘
       │
       └─── ┌───┐
            │ 8 │  ← Cluster pequeno (verde)
            └───┘
```

---

### 3. **Heatmap (Mapa de Calor)**

**Plugin:** `leaflet.heat`

**Características:**
- Mostra densidade de cadastros
- Gradiente de cores (azul → verde → amarelo → vermelho)
- Toggle on/off na interface

**Configuração:**
```javascript
L.heatLayer(pontos, {
  radius: 25,
  blur: 15,
  maxZoom: 13,
  gradient: {
    0.0: '#1e5a8d',  // Azul (baixa densidade)
    0.5: '#f59e0b',  // Amarelo (média densidade)
    1.0: '#ef4444'   // Vermelho (alta densidade)
  }
});
```

---

## 🎛️ Controles e Filtros

### Sidebar de Controles

```
┌─────────────────────────────────────┐
│ 🎛️ Controles do Mapa               │
├─────────────────────────────────────┤
│                                     │
│ 📊 Visualização                     │
│   ○ Markers                         │
│   ○ Clusters                        │
│   ○ Heatmap                         │
│                                     │
│ 🎨 Filtrar por Status               │
│   ☑ Garantido (1.245)               │
│   ☑ Possível (856)                  │
│   ☑ Dúvida (342)                    │
│                                     │
│ 👥 Filtrar por Responsável          │
│   ☑ Coordenadores                   │
│   ☑ Lideranças                      │
│   ☑ Equipes                         │
│                                     │
│ 🏢 Filtrar por Organização          │
│   ☐ Igreja Batista Central          │
│   ☐ Sindicato Metalúrgicos          │
│   ☐ Assoc. Bairro Norte             │
│   ☐ Todas                           │
│                                     │
│ 📅 Período                          │
│   [01/01/2026] até [23/01/2026]     │
│                                     │
│ 📍 Buscar Local                     │
│   [Digite cidade ou bairro...]      │
│                                     │
└─────────────────────────────────────┘
```

---

## 📈 Estatísticas do Mapa

### Painel de Métricas

```
┌─────────────────────────────────────┐
│ 📊 Estatísticas Gerais              │
├─────────────────────────────────────┤
│                                     │
│ Total de Cadastros: 2.443           │
│ Georreferenciados: 2.401 (98.3%)   │
│ Sem localização: 42 (1.7%)          │
│                                     │
├─────────────────────────────────────┤
│ 🏆 Top 5 Cidades                    │
├─────────────────────────────────────┤
│ 1. São Paulo............ 1.245      │
│ 2. Campinas............... 342      │
│ 3. Santos................. 198      │
│ 4. Ribeirão Preto......... 156      │
│ 5. Sorocaba............... 134      │
│                                     │
├─────────────────────────────────────┤
│ 🏆 Top 5 Bairros (SP Capital)       │
├─────────────────────────────────────┤
│ 1. Centro................. 156      │
│ 2. Mooca.................. 134      │
│ 3. Vila Mariana........... 112      │
│ 4. Pinheiros............... 98      │
│ 5. Tatuapé................. 87      │
│                                     │
├─────────────────────────────────────┤
│ 👥 Por Responsável                  │
├─────────────────────────────────────┤
│ Coordenadores: 856 (35%)            │
│ Lideranças: 1.245 (51%)             │
│ Equipes: 342 (14%)                  │
│                                     │
└─────────────────────────────────────┘
```

---

## 🛠️ Implementação Técnica

### 1. **Instalação de Dependências**

```bash
npm install leaflet react-leaflet
npm install @types/leaflet --save-dev
npm install leaflet.markercluster
npm install leaflet.heat
npm install @types/leaflet.markercluster --save-dev
```

### 2. **Estrutura de Arquivos**

```
projeto-campanha/
├── pages/
│   └── Maps.tsx                    # Página principal do mapa
│
├── components/
│   └── Map/
│       ├── LeafletMap.tsx          # Componente do mapa
│       ├── MapMarker.tsx           # Marker customizado
│       ├── MapCluster.tsx          # Cluster de markers
│       ├── MapHeatmap.tsx          # Camada de calor
│       ├── MapPopup.tsx            # Popup de informações
│       ├── MapControls.tsx         # Controles do mapa
│       ├── MapFilters.tsx          # Filtros laterais
│       └── MapStats.tsx            # Estatísticas
│
├── services/
│   ├── geocoding.ts                # Serviço de geocoding
│   └── mapData.ts                  # Dados do mapa
│
├── utils/
│   └── mapHelpers.ts               # Funções auxiliares
│
└── public/
    └── geojson/
        ├── sp-estado.json          # GeoJSON do estado
        └── sp-municipios.json      # GeoJSON dos municípios (opcional)
```

### 3. **Serviço de Geocoding**

```typescript
// services/geocoding.ts

interface GeocodingResult {
  latitude: number;
  longitude: number;
  precisao: 'exata' | 'cep' | 'bairro' | 'cidade';
}

export async function geocodificarPorCEP(cep: string): Promise<GeocodingResult | null> {
  try {
    // Tentar BrasilAPI primeiro
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    const data = await response.json();
    
    if (data.location?.coordinates) {
      return {
        latitude: data.location.coordinates.latitude,
        longitude: data.location.coordinates.longitude,
        precisao: 'exata'
      };
    }
    
    // Fallback: Nominatim
    return await geocodificarPorEndereco(
      `${data.street}, ${data.neighborhood}, ${data.city}, SP, Brasil`
    );
  } catch (error) {
    console.error('Erro ao geocodificar:', error);
    return null;
  }
}

async function geocodificarPorEndereco(endereco: string): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`
    );
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        precisao: 'bairro'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro no Nominatim:', error);
    return null;
  }
}
```

---

## 🚀 Fases de Implementação

### **Fase 1: Mapa Básico** (1-2 dias)
- ✅ Instalar Leaflet e dependências
- ✅ Criar componente base do mapa
- ✅ Carregar GeoJSON do Estado de SP
- ✅ Centralizar no estado
- ✅ Adicionar controles de zoom

### **Fase 2: Markers** (1 dia)
- ✅ Criar markers customizados
- ✅ Adicionar dados mockados
- ✅ Implementar popups
- ✅ Cores por status

### **Fase 3: Clustering** (1 dia)
- ✅ Instalar leaflet.markercluster
- ✅ Configurar clusters
- ✅ Cores por densidade
- ✅ Animações

### **Fase 4: Filtros** (1-2 dias)
- ✅ Sidebar de filtros
- ✅ Filtrar por status
- ✅ Filtrar por responsável
- ✅ Filtrar por organização
- ✅ Filtrar por período

### **Fase 5: Heatmap** (1 dia)
- ✅ Instalar leaflet.heat
- ✅ Configurar camada de calor
- ✅ Toggle markers/heatmap
- ✅ Gradiente customizado

### **Fase 6: Estatísticas** (1 dia)
- ✅ Painel de métricas
- ✅ Top cidades
- ✅ Top bairros
- ✅ Gráficos de distribuição

### **Fase 7: Integração Backend** (2-3 dias)
- ✅ Conectar com API real
- ✅ Geocoding no cadastro
- ✅ Atualização em tempo real
- ✅ Cache de coordenadas

### **Fase 8: Otimização** (1-2 dias)
- ✅ Lazy loading de dados
- ✅ Virtualização de markers
- ✅ Cache de GeoJSON
- ✅ Performance para 10k+ cadastros

---

## ⚠️ Considerações Importantes

### **Privacidade e LGPD**

1. **Não mostrar endereço exato**
   - Mostrar apenas bairro/região
   - Adicionar "ruído" nas coordenadas (±50m)
   - Opção de "não mostrar no mapa"

2. **Dados sensíveis**
   - Não exibir telefone/email no popup público
   - Apenas usuários autorizados veem detalhes
   - Log de quem visualizou cada cadastro

3. **Anonimização**
   - Em visualizações públicas, mostrar apenas estatísticas
   - Sem nomes ou dados pessoais
   - Apenas densidade e distribuição

### **Performance**

1. **Muitos markers (>1000)**
   - Usar clustering obrigatoriamente
   - Lazy loading por região visível
   - Virtualização de markers fora da tela

2. **GeoJSON grande**
   - Carregar apenas quando necessário
   - Cache no localStorage
   - Simplificar polígonos (menos pontos)

3. **Atualização em tempo real**
   - WebSocket para novos cadastros
   - Atualizar apenas região visível
   - Debounce de 5 segundos

### **Fallbacks**

1. **CEP sem coordenadas**
   - Usar centro da cidade
   - Marcar como "baixa precisão"
   - Permitir correção manual

2. **Offline**
   - Cache de dados básicos
   - Mapa base offline (tiles salvos)
   - Modo degradado sem heatmap

3. **Navegador antigo**
   - Fallback para mapa estático
   - Imagem do Google Maps
   - Lista de cadastros por região

---

## 📱 Responsividade

### Desktop (>1024px)
- Mapa ocupa 70% da tela
- Sidebar com filtros à direita (30%)
- Estatísticas em painel flutuante

### Tablet (768px - 1024px)
- Mapa ocupa tela inteira
- Filtros em drawer lateral
- Estatísticas em modal

### Mobile (<768px)
- Mapa em tela cheia
- Filtros em bottom sheet
- Estatísticas em tabs
- Touch gestures para zoom/pan

---

## 🎨 Tema Dark/Light

### Dark Mode
- Mapa: Tiles escuros (CartoDB Dark Matter)
- Markers: Cores vibrantes
- Popups: Fundo escuro com borda sutil
- Clusters: Gradiente escuro

### Light Mode
- Mapa: Tiles claros (OpenStreetMap)
- Markers: Cores saturadas
- Popups: Fundo branco com sombra
- Clusters: Gradiente claro

---

## 📊 Métricas de Sucesso

1. **Performance**
   - Carregamento inicial < 2s
   - Renderização de 1000 markers < 1s
   - Zoom/pan suave (60fps)

2. **Usabilidade**
   - Encontrar cadastro em < 10s
   - Filtros intuitivos
   - Mobile-friendly

3. **Precisão**
   - >95% dos cadastros georreferenciados
   - <5% de erros de localização
   - Coordenadas com precisão de ±50m

---

## 🔮 Funcionalidades Futuras

1. **Rotas**
   - Traçar rota entre cadastros
   - Otimizar visitas de campo
   - Calcular distâncias

2. **Áreas de Influência**
   - Desenhar polígonos de atuação
   - Atribuir regiões a coordenadores
   - Alertas de sobreposição

3. **Análise Temporal**
   - Animação de crescimento no tempo
   - Comparar períodos
   - Previsão de crescimento

4. **Exportação**
   - Exportar mapa como imagem
   - Gerar PDF com estatísticas
   - Compartilhar link do mapa

5. **Integração**
   - Importar dados de planilhas
   - Exportar para Google Maps
   - API pública do mapa

---

## ✅ Checklist de Implementação

### Preparação
- [ ] Instalar Leaflet.js e plugins
- [ ] Baixar GeoJSON do Estado de SP
- [ ] Configurar serviço de geocoding
- [ ] Criar estrutura de componentes

### Desenvolvimento
- [ ] Mapa base com Leaflet
- [ ] Markers customizados
- [ ] Popups informativos
- [ ] Clustering de markers
- [ ] Heatmap de densidade
- [ ] Filtros laterais
- [ ] Painel de estatísticas
- [ ] Integração com formulário de cadastro
- [ ] Geocoding automático por CEP
- [ ] Tema dark/light

### Testes
- [ ] Performance com 1000+ cadastros
- [ ] Responsividade mobile
- [ ] Precisão de coordenadas
- [ ] Filtros funcionando
- [ ] Privacidade (LGPD)

### Deploy
- [ ] Otimização de assets
- [ ] Cache de GeoJSON
- [ ] CDN para tiles
- [ ] Monitoramento de erros

---

## 📚 Recursos e Referências

### Documentação
- [Leaflet.js Docs](https://leafletjs.com/reference.html)
- [React Leaflet](https://react-leaflet.js.org/)
- [Leaflet MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster)
- [Leaflet Heat](https://github.com/Leaflet/Leaflet.heat)

### APIs
- [BrasilAPI - CEP](https://brasilapi.com.br/docs#tag/CEP-V2)
- [IBGE - Malhas](https://servicodados.ibge.gov.br/api/docs/malhas)
- [Nominatim - Geocoding](https://nominatim.org/release-docs/latest/api/Overview/)

### Tiles (Mapas Base)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [CartoDB](https://carto.com/basemaps/)
- [Stamen](http://maps.stamen.com/)

### Dados Geográficos
- [IBGE - Downloads](https://www.ibge.gov.br/geociencias/downloads-geociencias.html)
- [GeoJSON Brasil](https://github.com/tbrugz/geodata-br)

---

## 🎯 Próximos Passos

**Quando você aprovar este planejamento, vou:**

1. ✅ Instalar todas as dependências do Leaflet
2. ✅ Baixar e configurar GeoJSON do Estado de SP
3. ✅ Criar estrutura de componentes do mapa
4. ✅ Implementar mapa base com zoom no estado
5. ✅ Adicionar markers com dados mockados
6. ✅ Configurar clustering
7. ✅ Implementar filtros
8. ✅ Integrar com formulário de cadastro (geocoding)

**Está de acordo? Quer ajustar algo antes de começar?** 🚀
