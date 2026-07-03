/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Obra, Empresa, Usuario, Perfil, UserStatus, Reserva, Feriado, AuditoriaLog, SystemSettings } from '../types';

export const INITIAL_OBRAS: Obra[] = [
  { id: 'o-sede', nome: 'Sede Administrativa', centroCusto: 'CC-001', ativa: true },
];

export const INITIAL_EMPRESAS: Empresa[] = [
  { id: 'e-1', nome: 'FONTANA SGR', tipo: 'Propria' },
];

export const INITIAL_USUARIOS: Usuario[] = [
  {
    id: 'u-jarbas',
    nome: 'Jarbas Nunes (RH)',
    cpf: '11111111111',
    email: 'jarbas.nunes@estilofontana.com.br',
    senha: '1234@',
    matricula: 'A-001',
    perfil: Perfil.Admin,
    status: UserStatus.Aprovado,
    idEmpresa: 'e-1',
    idObraPadrao: 'o-sede',
    criadoEm: '2026-06-14T07:00:00Z',
  }
];

export const INITIAL_FERIADOS: Feriado[] = [
  { id: 'f-1', data: '2026-01-01', descricao: 'Confraternização Universal', tipo: 'nacional' },
  { id: 'f-2', data: '2026-04-21', descricao: 'Tiradentes', tipo: 'nacional' },
  { id: 'f-3', data: '2026-05-01', descricao: 'Dia do Trabalho', tipo: 'nacional' },
  { id: 'f-4', data: '2026-06-18', descricao: 'Dia do Construtor FONTANA', tipo: 'interno' },
  { id: 'f-5', data: '2026-09-07', descricao: 'Independência do Brasil', tipo: 'nacional' },
  { id: 'f-6', data: '2026-10-12', descricao: 'Nossa Senhora Aparecida', tipo: 'nacional' },
  { id: 'f-7', data: '2026-12-25', descricao: 'Natal', tipo: 'nacional' },
];

export const INITIAL_SETTINGS: SystemSettings = {
  horarioLimite: '08:30',
  permitirFinsDeSemana: false,
  valorRefeicaoPropria: 15.0,
  valorRefeicaoTerceiro: 15.0,
  usarTabletRetirada: false,
  requererBiometriaFacial: false,
  permitirSimulador: true,
};

export const INITIAL_RESERVAS: Reserva[] = [];

export const INITIAL_LOGS: AuditoriaLog[] = [
  {
    id: 'log-1',
    usuarioNome: 'Jarbas Nunes (RH)',
    usuarioEmail: 'jarbas.nunes@estilofontana.com.br',
    dataHora: '2026-06-15T08:00:00Z',
    operacao: 'SGR Inicializado: Banco de dados unificado FONTANA ativo em produção.',
    ip: '127.0.0.1',
    dispositivo: 'Servidor SGR Cloud',
    perfil: Perfil.Admin,
  }
];
