# Visualização do Mapa com Círculos de Densidade

## 🎯 Resumo Executivo

**Lógica de Visualização:**
- 🔵 **Círculos azuis** = Cadastros públicos agrupados por BAIRRO
- **Opacidade do círculo** = Quantidade de EQUIPES trabalhando no bairro
- 📍 **Marcadores individuais** = Equipes, Lideranças e Coordenadores

**Benefício Principal:**
Mapa mostra visualmente **onde as equipes estão concentradas**, permitindo decisões estratégicas de redistribuição de recursos.

---

## 📋 Contexto

### Problema Atual
- A API TomTom não encontra números específicos de endereços em todas as localidades (especialmente cidades menores como Osasco)
- Marcadores pontuais (📍) sugerem precisão exata quando na verdade a coordenada é aproximada (nível de rua)
- Exemplo: "Av. Prestes Maia, 801" retorna coordenadas no Bussocaba (sul) quando o endereço correto é mais ao norte
- Isso cria uma expectativa falsa de precisão para os usuários

### Solução Proposta
Em vez de marcadores pontuais, usar **círculos de área** com agrupamento inteligente:

#### Regras de Visualização por Tipo:

1. **Cadastros Públicos** → Círculo por **BAIRRO** 🔵
   - Maior privacidade (não mostra endereço exato)
   - 1 círculo por bairro
   - **Opacidade baseada na quantidade de EQUIPES** que atuam naquele bairro
   - Mostra visualmente onde há mais equipes trabalhando

2. **Equipes** → **Marcador Pontual** 📍
   - Marcador individual para cada equipe
   - Posição exata para gestão

3. **Lideranças** → **Marcador Pontual** 📍
   - Marcador individual para cada liderança
   - Posição exata para gestão

4. **Coordenadores** → **Marcador Pontual** 📍
   - Marcador individual para cada coordenador
   - Posição exata para gestão

**Benefícios:**
- Privacidade para cadastros públicos (círculo por bairro)
- Visualização clara de **onde as equipes estão concentradas**
- Opacidade do círculo = intensidade de trabalho das equipes no bairro
- Todos os atores (equipes, lideranças, coordenadores) têm marcação precisa

---

## 🎯 Especificações - Opção A

### 1. Raio do Círculo
**Fixo: 10km (10.000 metros)** para todos os registros

### 2. Densidade por Opacidade

**Cor dos círculos:**
- **Cadastros Públicos**: Azul (#3b82f6)
- **Opacidade**: Baseada na quantidade de **EQUIPES** no bairro

| Quantidade de EQUIPES no Bairro | Opacidade | Visual |
|--------------------------------|-----------|---------|
| 1 equipe | 30% (0.3) | 🔵 Azul muito claro |
| 2-5 equipes | 50% (0.5) | 🔵 Azul médio |
| 6-10 equipes | 70% (0.7) | 🔵 Azul escuro |
| 11+ equipes | 90% (0.9) | 🔵 Azul muito escuro |

**Marcadores pontuais:**
- **Equipes**: Ícone personalizado (ex: 👥)
- **Lideranças**: Ícone personalizado (ex: 👤)
- **Coordenadores**: Ícone personalizado (ex: 👔)

### 3. Borda do Círculo
- Cor: Azul escuro (#1e40af)
- Largura: 2px
- Opacidade: Sempre 80% (0.8)

### 4. Regra Importante
**Círculos só aparecem em bairros COM cadastros públicos.**

Se um bairro tem:
- ✅ Cadastros públicos → Aparece círculo (opacidade baseada em equipes)
- ❌ SEM cadastros → NÃO aparece círculo (mesmo que tenha equipes)

**Mas:** Marcadores de equipes aparecem normalmente, independente de ter círculo ou não.

### 5. Comportamento ao Passar o Mouse (Hover)
- Aumentar opacidade em +20%
- Mostrar tooltip com informações da área

### 6. Comportamento ao Clicar
Abrir popup mostrando:
```
📊 Região: [Nome do Bairro/Rua]
👥 [N] registro(s) nesta área

Lista:
• [Nome 1] - [Tipo: Liderança/Coordenador/etc]
• [Nome 2] - [Tipo]
• [Nome 3] - [Tipo]
...

📍 Clique para ver detalhes
```

---

## 🔧 Implementação Técnica

### Tecnologias Utilizadas
- **Leaflet.js** (já em uso)
- **React-Leaflet** (já em uso)
- **Componente Circle** do react-leaflet

### Estrutura de Dados

#### 1. Estrutura de Dados
```typescript
interface RegistroComCoordenadas {
  id: string;
  nome: string;
  tipo: 'lideranca' | 'coordenador' | 'equipe' | 'organizacao' | 'cadastro_publico';
  lat: number;
  lng: number;
  endereco: string; // Endereço completo
  rua: string;      // Nome da rua
  bairro: string;   // Nome do bairro
}

interface CirculoMapa {
  bairro: string; // Nome do bairro
  centro: {
    lat: number;
    lng: number;
  };
  raio: number; // 10km (10.000 metros) fixo
  cadastros: RegistroComCoordenadas[]; // Cadastros públicos no bairro
  quantidadeCadastros: number;         // Total de cadastros
  quantidadeEquipes: number;           // Total de EQUIPES no bairro (define opacidade)
  opacidade: number;                   // Calculado baseado na quantidade de EQUIPES
}
```

#### 2. Funções de Agrupamento

```typescript
// Conta quantas equipes existem em cada bairro
function contarEquipesPorBairro(
  equipes: RegistroComCoordenadas[]
): Map<string, number> {
  const contagemPorBairro = new Map<string, number>();

  for (const equipe of equipes) {
    const bairro = equipe.bairro || 'Sem Bairro';
    const countAtual = contagemPorBairro.get(bairro) || 0;
    contagemPorBairro.set(bairro, countAtual + 1);
  }

  return contagemPorBairro;
}

// Agrupa cadastros públicos por bairro e calcula opacidade baseada nas equipes
function agruparCadastrosPorBairro(
  cadastros: RegistroComCoordenadas[],
  equipes: RegistroComCoordenadas[]
): CirculoMapa[] {
  const circulos: CirculoMapa[] = [];

  // Conta equipes por bairro
  const equipesPorBairro = contarEquipesPorBairro(equipes);

  // Agrupa cadastros por bairro
  const cadastrosPorBairro = new Map<string, RegistroComCoordenadas[]>();

  for (const cadastro of cadastros) {
    const bairro = cadastro.bairro || 'Sem Bairro';

    if (!cadastrosPorBairro.has(bairro)) {
      cadastrosPorBairro.set(bairro, []);
    }

    cadastrosPorBairro.get(bairro)!.push(cadastro);
  }

  // Cria um círculo para cada bairro
  for (const [bairro, cadastrosDoBairro] of cadastrosPorBairro) {
    // Calcula centro do bairro (média das coordenadas dos cadastros)
    const latMedia = cadastrosDoBairro.reduce((sum, r) => sum + r.lat, 0) / cadastrosDoBairro.length;
    const lngMedia = cadastrosDoBairro.reduce((sum, r) => sum + r.lng, 0) / cadastrosDoBairro.length;

    // Quantidade de equipes no bairro (define opacidade)
    const quantidadeEquipes = equipesPorBairro.get(bairro) || 0;

    // Calcula opacidade baseado na quantidade de EQUIPES
    const opacidade = calcularOpacidade(quantidadeEquipes);

    circulos.push({
      bairro,
      centro: { lat: latMedia, lng: lngMedia },
      raio: 10000, // 10km
      cadastros: cadastrosDoBairro,
      quantidadeCadastros: cadastrosDoBairro.length,
      quantidadeEquipes,
      opacidade
    });
  }

  return circulos;
}

// Função principal que separa por tipo de registro
function processarRegistrosParaMapa(
  registros: RegistroComCoordenadas[]
): {
  circulos: CirculoMapa[];
  marcadores: RegistroComCoordenadas[]; // Equipes, Lideranças e Coordenadores
} {
  // Separa por tipo
  const cadastrosPublicos = registros.filter(r => r.tipo === 'cadastro_publico');
  const equipes = registros.filter(r => r.tipo === 'equipe');
  const liderancas = registros.filter(r => r.tipo === 'lideranca');
  const coordenadores = registros.filter(r => r.tipo === 'coordenador');

  // Agrupa cadastros públicos por bairro
  // A opacidade do círculo depende de quantas equipes tem no bairro
  const circulos = agruparCadastrosPorBairro(cadastrosPublicos, equipes);

  return {
    circulos,
    marcadores: [...equipes, ...liderancas, ...coordenadores] // Todos são marcadores individuais
  };
}
```

#### 3. Função de Cálculo de Opacidade
```typescript
function calcularOpacidade(quantidade: number): number {
  if (quantidade === 1) return 0.3;
  if (quantidade <= 5) return 0.5;
  if (quantidade <= 10) return 0.7;
  return 0.9; // 11+
}
```

---

## 🎨 Componente React (LeafletMapComplete.tsx)

### Estrutura do Componente

```tsx
import { Circle, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// Componente para círculos (Apenas Cadastros Públicos)
function CirculosDensidade({ circulos }: { circulos: CirculoMapa[] }) {
  return (
    <>
      {circulos.map((circulo, index) => (
        <Circle
          key={index}
          center={[circulo.centro.lat, circulo.centro.lng]}
          radius={circulo.raio}
          pathOptions={{
            fillColor: '#3b82f6',      // Azul
            fillOpacity: circulo.opacidade,
            color: '#1e40af',           // Azul escuro (borda)
            weight: 2,
            opacity: 0.8
          }}
          eventHandlers={{
            mouseover: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: Math.min(circulo.opacidade + 0.2, 1)
              });
            },
            mouseout: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: circulo.opacidade
              });
            }
          }}
        >
          {/* Tooltip ao passar o mouse */}
          <Tooltip>
            <div className="text-sm">
              <strong>{circulo.bairro}</strong>
              <br />
              {circulo.quantidadeCadastros} cadastro(s)
              <br />
              {circulo.quantidadeEquipes} equipe(s)
            </div>
          </Tooltip>

          {/* Popup ao clicar */}
          <Popup maxWidth={300}>
            <div className="p-2">
              <h3 className="font-bold text-lg mb-2">
                📊 Bairro: {circulo.bairro}
              </h3>

              <div className="mb-3 text-sm">
                <p className="text-gray-600">
                  👥 {circulo.quantidadeCadastros} cadastro(s) público(s)
                </p>
                <p className="text-blue-600 font-medium">
                  🔵 {circulo.quantidadeEquipes} equipe(s) atuando
                </p>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-2">Cadastros neste bairro:</p>
                {circulo.cadastros.slice(0, 5).map((cadastro) => (
                  <div
                    key={cadastro.id}
                    className="text-sm border-b pb-1 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      window.location.href = `/cadastros/${cadastro.id}`;
                    }}
                  >
                    <span className="font-medium">{cadastro.nome}</span>
                  </div>
                ))}
                {circulo.quantidadeCadastros > 5 && (
                  <p className="text-xs text-gray-500 mt-1">
                    + {circulo.quantidadeCadastros - 5} mais
                  </p>
                )}
              </div>

              <button className="mt-3 w-full bg-blue-500 text-white py-1 rounded hover:bg-blue-600">
                Ver todos os cadastros
              </button>
            </div>
          </Popup>
        </Circle>
      ))}
    </>
  );
}

// Componente para marcadores pontuais (Equipes, Lideranças e Coordenadores)
function MarcadoresPontuais({ marcadores }: { marcadores: RegistroComCoordenadas[] }) {
  // Ícones personalizados por tipo
  const icones = {
    equipe: L.icon({
      iconUrl: '/icons/equipe-marker.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    }),
    lideranca: L.icon({
      iconUrl: '/icons/lideranca-marker.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    }),
    coordenador: L.icon({
      iconUrl: '/icons/coordenador-marker.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    })
  };

  // Labels por tipo
  const labels = {
    equipe: 'Equipe',
    lideranca: 'Liderança',
    coordenador: 'Coordenador'
  };

  // Emojis por tipo
  const emojis = {
    equipe: '👥',
    lideranca: '👤',
    coordenador: '👔'
  };

  return (
    <>
      {marcadores.map((marcador) => (
        <Marker
          key={marcador.id}
          position={[marcador.lat, marcador.lng]}
          icon={icones[marcador.tipo]}
        >
          <Tooltip>
            <div className="text-sm">
              <strong>{marcador.nome}</strong>
              <br />
              <span className="text-gray-600">
                {labels[marcador.tipo]}
              </span>
            </div>
          </Tooltip>

          <Popup maxWidth={300}>
            <div className="p-2">
              <h3 className="font-bold text-lg mb-2">
                {emojis[marcador.tipo]} {marcador.nome}
              </h3>
              <p className="text-gray-600 text-sm mb-2">
                {labels[marcador.tipo]}
              </p>
              <p className="text-sm text-gray-700 mb-1">
                📍 {marcador.endereco}
              </p>
              <p className="text-sm text-gray-600">
                🏘️ {marcador.bairro}
              </p>
              <button
                className="mt-3 w-full bg-blue-500 text-white py-1 rounded hover:bg-blue-600"
                onClick={() => {
                  window.location.href = `/${marcador.tipo}s/${marcador.id}`;
                }}
              >
                Ver Detalhes
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// Componente principal do mapa
function MapaCompleto() {
  const { circulos, marcadores } = processarRegistrosParaMapa(todosRegistros);

  return (
    <MapContainer>
      {/* Círculos para Cadastros Públicos (opacidade baseada em equipes) */}
      <CirculosDensidade circulos={circulos} />

      {/* Marcadores pontuais para Equipes, Lideranças e Coordenadores */}
      <MarcadoresPontuais marcadores={marcadores} />
    </MapContainer>
  );
}
```

---

## 📁 Arquivos a Serem Modificados

### 1. `components/Map/LeafletMapComplete.tsx`
- Adicionar função `contarEquipesPorBairro()` (conta equipes em cada bairro)
- Adicionar função `agruparCadastrosPorBairro()` (agrupa cadastros, calcula opacidade por equipes)
- Adicionar função `processarRegistrosParaMapa()` (separa por tipo)
- Adicionar função `calcularOpacidade()` (baseada em quantidade de equipes)
- Criar componente `CirculosDensidade` (apenas para Cadastros Públicos)
- Criar componente `MarcadoresPontuais` (para Equipes, Lideranças e Coordenadores)
- Atualizar componente principal para usar ambos

### 2. `lib/geocoding.ts` (opcional)
- Adicionar campo `precisao` no resultado da geocodificação
- Permitir ajustar raio do círculo baseado na precisão no futuro

### 3. `public/icons/` (novos arquivos)
- Criar `equipe-marker.png` - Ícone para marcadores de equipes (ex: 👥)
- Criar `lideranca-marker.png` - Ícone para marcadores de lideranças (ex: 👤)
- Criar `coordenador-marker.png` - Ícone para marcadores de coordenadores (ex: 👔)
- Tamanho recomendado: 32x32 pixels (formato PNG com transparência)

---

## 🧪 Testes Sugeridos

### Cenários de Teste:

#### Cadastros Públicos (Círculos por Bairro):

1. **Bairro com cadastros e 1 equipe**
   - Deve aparecer círculo azul **muito claro** (opacidade 30%)
   - Raio de 10km (10.000 metros)
   - Centro calculado pela média dos cadastros
   - Popup: "📊 Bairro: [Nome]" + "[X] cadastros" + "1 equipe atuando"

2. **Bairro com cadastros e 2-5 equipes**
   - Deve aparecer círculo azul **médio** (opacidade 50%)
   - Opacidade baseada nas EQUIPES, não nos cadastros
   - Popup mostra ambos números

3. **Bairro com cadastros e 6-10 equipes**
   - Deve aparecer círculo azul **escuro** (opacidade 70%)

4. **Bairro com cadastros e 11+ equipes**
   - Deve aparecer círculo azul **muito escuro** (opacidade 90%)

5. **Bairro com cadastros mas SEM equipes**
   - Deve aparecer círculo azul muito claro (opacidade 30% - mínimo)
   - Indica que não há equipes trabalhando ali
   - Popup: "📊 Bairro: [Nome]" + "[X] cadastros" + "0 equipes"

#### Equipes (Marcadores Pontuais):

6. **Equipe**
   - Marcador pontual com ícone de equipe (👥)
   - Tooltip: Nome da equipe
   - Popup com endereço, bairro e botão "Ver Detalhes"

#### Lideranças (Marcadores Pontuais):

7. **Liderança**
   - Marcador pontual com ícone de liderança (👤)
   - Tooltip: Nome + "Liderança"
   - Popup com endereço completo e botão "Ver Detalhes"

#### Coordenadores (Marcadores Pontuais):

8. **Coordenador**
   - Marcador pontual com ícone de coordenador (👔)
   - Tooltip: Nome + "Coordenador"
   - Popup com informações detalhadas

#### Interações:

9. **Hover sobre círculo**
   - Opacidade deve aumentar +20%
   - Tooltip mostra:
     - Nome do bairro
     - Quantidade de cadastros
     - Quantidade de equipes

10. **Clicar no círculo**
    - Popup mostra:
      - Nome do bairro
      - Quantidade de cadastros públicos
      - Quantidade de equipes atuando (destaque em azul)
      - Lista dos primeiros 5 cadastros
      - Botão "Ver todos os cadastros"

11. **Clicar em marcador pontual**
    - Popup com informações completas
    - Botão para ver página de detalhes

---

## 🎯 Benefícios da Solução

### Vantagens:

1. **Privacidade Inteligente (LGPD)**
   - Cadastros públicos: Círculo por bairro (não expõe endereço exato)
   - Equipes/Lideranças/Coordenadores: Marcadores precisos (dados internos)

2. **Visualização Estratégica**
   - **Opacidade do círculo = intensidade de trabalho das equipes**
   - Círculos escuros = bairros com MUITAS equipes atuando
   - Círculos claros = bairros com POUCAS equipes (oportunidade de expansão?)
   - Responde visualmente: "Onde minhas equipes estão concentradas?"

3. **Honestidade Visual**
   - Não sugere precisão exata para cadastros públicos
   - Círculos mostram "área aproximada" claramente

4. **Gestão Tática**
   - Identifica bairros com muitos cadastros mas poucas equipes
   - Identifica bairros saturados (muitas equipes)
   - Facilita decisões de redistribuição de recursos

5. **Performance e Escalabilidade**
   - Milhares de cadastros públicos → alguns círculos (rápido)
   - Centenas de equipes → marcadores individuais (gerenciável)
   - Mapa limpo e rápido mesmo com grande volume

6. **Mantém Custo Zero**
   - Continua usando TomTom (gratuito)
   - Sem necessidade de trocar API

7. **Dupla Camada de Informação**
   - **Camada 1 (Círculos)**: Distribuição de cadastros + trabalho de equipes
   - **Camada 2 (Marcadores)**: Localização precisa de atores

### Possíveis Melhorias Futuras:

- **Escala de cores gradiente**: Verde (poucas equipes) → Amarelo → Vermelho (muitas equipes)
- **Filtros interativos**: Mostrar/ocultar equipes, lideranças, coordenadores
- **Slider de data**: Ver evolução temporal (quantas equipes por bairro ao longo do tempo)
- **Modo comparação**: Cadastros vs Equipes (destacar bairros desbalanceados)
- **Clusterização de marcadores**: Agrupar marcadores pontuais quando muito próximos
- **Animação**: Transições suaves ao aparecer/mudar zoom
- **Legenda interativa**: Explicar o que a opacidade significa
- **Estatísticas por bairro**: Popup com gráficos (ex: proporção cadastros/equipes)

---

## 📊 Comparação: Antes vs Depois

### Antes (Todos com Marcadores Pontuais):
```
❌ Sugere precisão exata para todos (mentiroso)
❌ Mapa poluído com centenas/milhares de marcadores
❌ Difícil ver concentração de cadastros
❌ Expõe localização exata de cadastros públicos (LGPD)
❌ Performance ruim com muitos registros
✅ Fácil de implementar
```

### Depois (Visualização Inteligente por Tipo):
```
✅ Cadastros Públicos: Círculo por bairro (privacidade LGPD)
✅ Equipes/Lideranças/Coordenadores: Marcadores precisos (gestão)
✅ Opacidade = intensidade de trabalho das equipes
✅ Mapa estratégico: "Onde estão minhas equipes?"
✅ Identifica oportunidades (bairros com poucos cadastros/equipes)
✅ Identifica saturação (bairros com muitas equipes)
✅ Mapa limpo mesmo com milhares de cadastros
✅ Performance excelente
✅ Conformidade com LGPD
✅ Mantém custo zero (TomTom)
✅ Dupla camada de informação (cadastros + trabalho)
```

---

## 💡 Exemplo Visual Prático

### Cenário Real:

**Bairro Vila Yara:**
- 45 cadastros públicos
- 2 equipes atuando
- → **Círculo azul MÉDIO** (opacidade 50%)

**Bairro Centro:**
- 120 cadastros públicos
- 15 equipes atuando
- → **Círculo azul MUITO ESCURO** (opacidade 90%)

**Bairro Jardim das Flores:**
- 20 cadastros públicos
- 0 equipes atuando
- → **Círculo azul MUITO CLARO** (opacidade 30%)

### Interpretação Estratégica:

1. **Vila Yara**: Trabalho moderado, pode receber mais equipes
2. **Centro**: Alta concentração de equipes (talvez saturado?)
3. **Jardim das Flores**: **OPORTUNIDADE!** Tem cadastros mas nenhuma equipe atuando

**No mapa, você vê:**
- 🔵 Círculo muito escuro no Centro
- 🔵 Círculo médio na Vila Yara
- 🔵 Círculo muito claro no Jardim das Flores
- 📍 15 marcadores de equipes no Centro
- 📍 2 marcadores de equipes na Vila Yara
- 📍 0 marcadores no Jardim das Flores

**Decisão**: Redistribuir algumas equipes do Centro para Jardim das Flores!

---

## 🚀 Próximos Passos

1. Implementar funções de contagem e agrupamento
2. Modificar LeafletMapComplete.tsx para usar círculos e marcadores
3. Criar ícones para equipes, lideranças e coordenadores
3. Testar com dados reais
4. Ajustar opacidades/cores se necessário
5. Documentar para equipe

---

## ❓ FAQ (Perguntas Frequentes)

### 1. Por que a opacidade do círculo depende das equipes e não dos cadastros?
**R:** Para mostrar **onde há trabalho ativo da campanha**. Um bairro pode ter muitos cadastros mas nenhuma equipe, indicando uma oportunidade de expansão.

### 2. E se um bairro tiver muitas equipes mas poucos cadastros?
**R:** O círculo será pequeno (poucos cadastros) mas escuro (muitas equipes). Isso pode indicar equipes trabalhando em captação de novos cadastros.

### 3. Por que não mostrar círculo para equipes também?
**R:** Equipes, lideranças e coordenadores são atores internos da campanha, precisam de localização precisa para gestão. Apenas cadastros públicos têm restrição de privacidade (LGPD).

### 4. Como interpretar um círculo muito claro?
**R:** Bairro com cadastros públicos mas poucas/nenhuma equipe atuando. Pode ser:
- Oportunidade de alocar mais equipes
- Bairro de baixa prioridade
- Área já trabalhada que não precisa mais equipes

### 5. Como interpretar um círculo muito escuro?
**R:** Bairro com muitas equipes atuando. Pode ser:
- Área prioritária da campanha
- Possível saturação (muitas equipes para poucos cadastros?)
- Centro de operações

---

**Documentação criada em:** 25/01/2026
**Última atualização:** 25/01/2026
**Status:** Planejado (aguardando implementação)
**Versão:** 2.0 (Opacidade baseada em equipes)
