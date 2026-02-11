# Estrutura de Visualização do Mapa - Equipes, Lideranças e Cadastros

## Resumo do Entendimento

O mapa eleitoral deve exibir uma hierarquia visual clara entre **Equipes**, **Lideranças** e **Cadastros**, onde cada nível tem sua representação visual distinta e as cores são herdadas da equipe.

---

## Hierarquia de Dados

```
EQUIPE (cor definida: azul, roxo, verde, etc.)
  │
  ├── COORDENADOR(ES) da equipe
  │
  └── LIDERANÇA(S) vinculada(s) à equipe
        │
        └── CADASTRO(S) feitos pela liderança
```

---

## Representação Visual no Mapa

### 1. EQUIPE (Ícone Grande)
- **Tamanho:** Grande (como está atualmente)
- **Posição:** Localização definida pelo CEP da equipe
- **Cor:** Cor escolhida na criação da equipe (azul, roxo, verde, amarelo, etc.)
- **Informações no popup/tooltip:**
  - Nome da equipe
  - Nome(s) do(s) coordenador(es)
  - Quantidade de lideranças
  - Quantidade de cadastros totais

### 2. LIDERANÇA (Ícone Médio)
- **Tamanho:** Médio (menor que a equipe, maior que cadastros)
- **Posição:** Localização definida pelo CEP da liderança
- **Cor:** Mesma cor da equipe à qual pertence
- **Informações no popup/tooltip:**
  - Nome da liderança
  - Equipe vinculada
  - Quantidade de cadastros feitos

### 3. CADASTRO (Bolinha Pequena)
- **Tamanho:** Pequeno (bolinha/ponto)
- **Posição:** Localização definida pelo CEP informado no cadastro
- **Cor:** Mesma cor da equipe (herdada via liderança)
- **Informações no popup/tooltip:**
  - Nome da pessoa cadastrada
  - Endereço
  - Liderança responsável
  - Data do cadastro

---

## Fluxo de Cores

```
┌─────────────────────────────────────────────────────────────────┐
│                         EQUIPE NORTE                            │
│                      Cor: AZUL (#1e5a8d)                        │
│                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐                   │
│   │   Liderança A   │     │   Liderança B   │                   │
│   │   (Azul médio)  │     │   (Azul médio)  │                   │
│   │                 │     │                 │                   │
│   │  • Cadastro 1   │     │  • Cadastro 4   │                   │
│   │  • Cadastro 2   │     │  • Cadastro 5   │                   │
│   │  • Cadastro 3   │     │  • Cadastro 6   │                   │
│   │  (bolinhas azuis│     │  (bolinhas azuis│                   │
│   │   pequenas)     │     │   pequenas)     │                   │
│   └─────────────────┘     └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         EQUIPE SUL                              │
│                      Cor: ROXO (#9333ea)                        │
│                                                                 │
│   ┌─────────────────┐                                           │
│   │   Liderança C   │                                           │
│   │   (Roxo médio)  │                                           │
│   │                 │                                           │
│   │  • Cadastro 7   │                                           │
│   │  • Cadastro 8   │                                           │
│   │  (bolinhas roxas│                                           │
│   │   pequenas)     │                                           │
│   └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tamanhos dos Ícones no Mapa

| Elemento   | Tamanho (px) | Descrição                              |
|------------|--------------|----------------------------------------|
| Equipe     | 40x40        | Ícone grande com símbolo de grupo      |
| Liderança  | 24x24        | Ícone médio com símbolo de pessoa      |
| Cadastro   | 10x10        | Bolinha pequena (apenas um círculo)    |

---

## Dados Necessários para o Mapa

### Equipe
```typescript
interface Equipe {
  id: number;
  nome: string;
  cor: string;           // Ex: "#1e5a8d" (azul)
  cep: string;
  endereco: string;
  latitude: number;
  longitude: number;
  coordenadores: string[];  // Nomes dos coordenadores
}
```

### Liderança
```typescript
interface Lideranca {
  id: number;
  nome: string;
  equipeId: number;      // Vinculada a qual equipe
  cep: string;
  endereco: string;
  latitude: number;
  longitude: number;
}
```

### Cadastro
```typescript
interface Cadastro {
  id: number;
  nome: string;
  telefone: string;
  cep: string;
  endereco: string;
  latitude: number;
  longitude: number;
  liderancaId: number;   // Feito por qual liderança
  dataCadastro: string;
}
```

---

## Fluxo de Criação e Exibição no Mapa

### Ao criar uma EQUIPE:
1. Usuário informa nome, cor e CEP
2. Sistema busca endereço e coordenadas pelo CEP
3. Equipe aparece no mapa com ícone grande na cor escolhida

### Ao criar uma LIDERANÇA:
1. Usuário informa nome, equipe vinculada e CEP
2. Sistema busca endereço e coordenadas pelo CEP
3. Liderança aparece no mapa com ícone médio na cor da equipe

### Ao criar um CADASTRO:
1. Liderança informa dados da pessoa e CEP
2. Sistema busca endereço e coordenadas pelo CEP
3. Cadastro aparece no mapa como bolinha pequena na cor da equipe (via liderança)

---

## Exemplo Visual no Mapa

```
        🔵 (grande) = Equipe Norte (azul)
           │
           ├── 🔵 (médio) = Liderança João
           │      │
           │      ├── • (pequeno azul) = Cadastro Maria
           │      ├── • (pequeno azul) = Cadastro Pedro
           │      └── • (pequeno azul) = Cadastro Ana
           │
           └── 🔵 (médio) = Liderança Carlos
                  │
                  ├── • (pequeno azul) = Cadastro José
                  └── • (pequeno azul) = Cadastro Paula


        🟣 (grande) = Equipe Sul (roxo)
           │
           └── 🟣 (médio) = Liderança Fernanda
                  │
                  ├── • (pequeno roxo) = Cadastro Lucas
                  └── • (pequeno roxo) = Cadastro Beatriz
```

---

## Resumo

1. **Equipes** = Ícones GRANDES no mapa, posicionados pelo CEP da equipe
2. **Lideranças** = Ícones MÉDIOS, posicionados pelo CEP da liderança, COR da equipe
3. **Cadastros** = Bolinhas PEQUENAS, posicionados pelo CEP do cadastro, COR da equipe (herdada via liderança)

Todas as cores são herdadas da equipe, criando uma visualização clara de qual região/equipe cada cadastro pertence.
