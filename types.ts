
export interface NavItem {
  path: string;
  name: string;
  icon: string;
  fillIcon?: boolean;
}

export interface User {
    name: string;
    role: string;
    avatar: string;
}

export interface Team {
    name: string;
    createdAt: string;
    icon: string;
    iconBgColor: string;
    iconColor: string;
    coordinator: {
        name: string;
        email: string;
        avatar?: string;
        initials?: string;
        initialsBg?: string;
    };
    members: number;
    performance: number;
    status: 'Ativa' | 'Pendente' | 'Inativa';
}

export enum VoterStatus {
    Guaranteed = 'Garantido',
    Possible = 'Possível',
    Doubt = 'Dúvida',
}

export interface Voter {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    added: string;
    status: VoterStatus;
    assignee?: {
      name: string;
      avatar: string;
    };
}
