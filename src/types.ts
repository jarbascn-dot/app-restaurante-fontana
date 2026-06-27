/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Perfil {
  Colaborador = 'colaborador',
  Admin = 'admin',
  Gestor = 'gestor',
  Fornecedor = 'fornecedor',
}

export enum UserStatus {
  Pendente = 'pendente',
  Aprovado = 'aprovado',
  Desativado = 'desativado',
}

export enum ReservaStatus {
  Reservado = 'reservado',
  Cancelado = 'cancelado',
}

export interface Obra {
  id: string;
  nome: string;
  centroCusto: string;
  ativa: boolean;
  valorRefeicao?: number;
  valorDescontoColaborador?: number;
  idFornecedorPrincipal?: string;
  cardapioUrl?: string;
  cardapioNome?: string;
  cardapioAtualizadoEm?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  tipo: 'Propria' | 'Terceirizada' | 'Prestadora';
}

export interface Usuario {
  id: string;
  nome: string;
  cpf: string;
  email?: string;
  senha?: string; // Senha para login no Modo Produção
  matricula: string;
  perfil: Perfil;
  status: UserStatus;
  idEmpresa: string; // Ref Empresa
  idObraPadrao: string; // Ref Obra
  idObrasFornecedor?: string[]; // IDs das obras às quais este Fornecedor tem acesso seguro
  criadoEm: string;
  fotoBiometria?: string; // Face Registration Photo/Template for Facial Scan
  alertaEnabled?: boolean;
  alertaTiming?: 'vespera' | 'mesmo_dia';
  alertaTime?: string;
  aceitouLGPD?: boolean;
  dataAceiteLGPD?: string;
  ipAceiteLGPD?: string;
  alertaTipo?: 'reservada' | 'sem_reserva' | 'sempre';
  requerTrocaSenha?: boolean;
}

export interface Reserva {
  id: string;
  idUsuario: string;
  nomeVisitante?: string; // Nome de visitantes ou extras
  empresaFaturamento?: string; // Empresa para faturamento da refeicao do visitante (sem desconto)
  data: string; // YYYY-MM-DD
  status: ReservaStatus;
  consumido: boolean; // Confirmação de retirada (Reconhecimento Facial)
  idObraNoDia: string; // Obra onde estava no dia
  alteradoEm: string;
  ipOrigem: string;
  dispositivo: string;
}

export interface Feriado {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  tipo: 'nacional' | 'estadual' | 'municipal' | 'interno';
  abrangencia?: 'nacional' | 'especifico';
  idObras?: string[];
  dataFixa?: boolean; // Feriado com data fixa para replicar no proximo ano
}

export interface AuditoriaLog {
  id: string;
  usuarioNome: string;
  usuarioEmail: string;
  dataHora: string; // ISO
  operacao: string;
  ip: string;
  dispositivo: string;
  perfil: Perfil;
}

export interface SystemSettings {
  horarioLimite: string; // e.g. "08:30"
  permitirFinsDeSemana: boolean;
  valorRefeicaoPropria: number;
  valorRefeicaoTerceiro: number;
  usarTabletRetirada: boolean; // Ativa/desativa validação via Tablet (se desativado, reserva ativa = entregue)
  requererBiometriaFacial: boolean; // Exige reconhecimento facial com câmera ativa no Tablet. Se falso, valida por aprovação manual direta / digitação rápida.
  permitirSimulador: boolean; // Se falso, oculta permanentemente o modo simulador e barra de simulação do app
}
