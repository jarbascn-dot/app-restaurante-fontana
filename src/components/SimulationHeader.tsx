/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Usuario, Perfil, UserStatus, SystemSettings } from '../types';
import { RotateCcw, AlertCircle, Clock, ShieldCheck, LogOut, ToggleLeft, ToggleRight, Building2, HelpCircle, Users, UtensilsCrossed } from 'lucide-react';

interface SimulationHeaderProps {
  usuarios: Usuario[];
  currentUser: Usuario;
  setCurrentUser: (user: Usuario) => void;
  virtualTime: string; // "07:30" or "08:45" etc
  setVirtualTime: (time: string) => void;
  onReset: () => void;
  onOpenRegister: () => void;
  pendingCount: number;
  modoProducao: boolean;
  setModoProducao: (val: boolean) => void;
  onLogout: () => void;
  isAfterCutoff: boolean;
  todayDate: string;
  settings: SystemSettings;
}

export default function SimulationHeader({
  usuarios,
  currentUser,
  setCurrentUser,
  virtualTime,
  setVirtualTime,
  onReset,
  onOpenRegister,
  pendingCount,
  modoProducao,
  setModoProducao,
  onLogout,
  isAfterCutoff,
  todayDate,
  settings,
}: SimulationHeaderProps) {

  const activeColaboradores = usuarios.filter(u => u.perfil === Perfil.Colaborador);
  const activeAdmins = usuarios.filter(u => u.perfil === Perfil.Admin);
  const activeGestores = usuarios.filter(u => u.perfil === Perfil.Gestor);
  const activeFornecedores = usuarios.filter(u => u.perfil === Perfil.Fornecedor);

  // Real-time clock for display in production mode
  const [realClock, setRealClock] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setRealClock(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format date display nicely
  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 text-white" id="simulation-header">
      
      {/* Operation Mode selector Master Control Bar */}
      {settings.permitirSimulador && !modoProducao && (
        <div className="max-w-7xl mx-auto px-4 py-2 bg-neutral-950 text-xs text-neutral-300 flex flex-wrap gap-4 items-center justify-between border-b border-neutral-800" id="master-control-bar">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold tracking-wider">Modo de Funcionamento:</span>
            <button
              onClick={() => setModoProducao(!modoProducao)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-bold uppercase text-[10px] transition-all tracking-wider ${
                modoProducao
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/40 hover:bg-amber-500/20'
              }`}
              title="Alterne entre o Painel de Homologação/Auditoria e a conformidade real de produção corporativa"
              id="toggle-modo-funcionamento-btn"
            >
              {modoProducao ? (
                <>
                  <Building2 className="h-3 w-3" /> Modo Produção (Ativo)
                </>
              ) : (
                <>
                  <HelpCircle className="h-3 w-3" /> Modo Homologação (Ativo)
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {!modoProducao ? (
              <>
                <button
                  onClick={onOpenRegister}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/20 font-medium transition-colors"
                   id="sim-register-btn"
                >
                  + Novo Colaborador (Formulário)
                </button>
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded border border-red-500/20 font-medium transition-colors"
                  id="sim-reset-btn"
                  title="Restaura banco de dados para o estado em branco atual"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Limpar Base
                </button>
              </>
            ) : (
              <span className="text-emerald-400 font-mono tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Servidor Conectado
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Brand header bar */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4 justify-between items-center" id="sgr-main-header">
        
        {/* Branding & Logo */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-lg text-white" id="app-title-main">
                APP Restaurante <span className="font-light text-neutral-400">| FONTANA</span>
              </h1>
              <p className="text-[11px] text-neutral-400 tracking-wide font-mono uppercase">
                Controle e Gestão de Refeições
              </p>
            </div>
          </div>
          
          {!modoProducao && (
            <div className="lg:hidden">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                Simulação
              </span>
            </div>
          )}
        </div>

        {/* MIDDLE CONTROLS ADAPTS DYNAMICALLY BY OPERATION MODE */}
        {!modoProducao ? (
          /* SIMULATOR CONTROLS (QUICK TABS AND TIME PRESETS) */
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto bg-neutral-800/40 p-3 rounded-lg border border-neutral-700/50 animate-[fadeIn_0.3s_ease]" id="simulation-tools-panel">
            <div className="w-full sm:w-auto">
              <label className="block text-[10px] text-neutral-400 uppercase font-mono mb-1 font-bold flex items-center gap-1">
                <Users className="h-3 w-3 text-sky-400" /> 1. Escolher Usuário Ativo:
              </label>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const found = usuarios.find(u => u.id === e.target.value);
                  if (found) setCurrentUser(found);
                }}
                className="text-xs bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none w-full"
                id="active-persona-select"
              >
                <optgroup label="RH / Administradores">
                  {activeAdmins.map(u => (
                    <option key={u.id} value={u.id}>🔑 {u.nome} (RH)</option>
                  ))}
                </optgroup>
                <optgroup label="Gestores de Obras">
                  {activeGestores.map(u => (
                    <option key={u.id} value={u.id}>📐 {u.nome} (Gestor)</option>
                  ))}
                </optgroup>
                <optgroup label="Fornecedores (Cozinha Externa)">
                  {activeFornecedores.map(u => (
                    <option key={u.id} value={u.id}>🍲 {u.nome} (Fornecedor)</option>
                  ))}
                </optgroup>
                <optgroup label="Colaboradores Próprios">
                  {activeColaboradores.map(u => (
                    <option key={u.id} value={u.id} disabled={u.status === UserStatus.Desativado}>
                      👤 {u.nome} ({u.status === UserStatus.Pendente ? 'PENDENTE' : 'APROVADO'})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Colaboradores Desativados (Excluidos)">
                  {usuarios.filter(u => u.status === UserStatus.Desativado).map(u => (
                    <option key={u.id} value={u.id}>❌ {u.nome} (Desligado)</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-[10px] text-neutral-400 uppercase font-mono mb-1 font-bold flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-400" /> 2. Ajustar Horário do Sistema (Teste):
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVirtualTime('07:30')}
                  className={`px-2 py-1 text-[11px] font-semibold border rounded transition-colors ${
                    virtualTime === '07:30'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                  }`}
                  id="time-preset-before"
                  title="Horário antes de 08:30"
                >
                  07:30 (Liberado)
                </button>
                <button
                  onClick={() => setVirtualTime('09:12')}
                  className={`px-2 py-1 text-[11px] font-semibold border rounded transition-colors ${
                    virtualTime === '09:12'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                  }`}
                  id="time-preset-after"
                  title="Horário depois de 08:30"
                >
                  09:12 (Bloqueado)
                </button>
              </div>
            </div>

            <div className="hidden sm:block text-center border-l border-neutral-700/60 pl-3">
              <span className="block text-[10px] font-mono text-neutral-400 uppercase">Data de Hoje</span>
              <span className="text-sm font-bold text-emerald-400">{formatDateDisplay(todayDate)}</span>
            </div>
          </div>
        ) : (
          /* PRODUCTION CONTROLS (USE REAL CLOCK & REAL USER INFO) */
          <div className="flex items-center gap-4 bg-emerald-950/20 border border-emerald-500/20 px-4 py-3 rounded-lg animate-[fadeIn_0.3s_ease]" id="production-clock-panel">
            <div className="text-right">
              <span className="block text-[9px] font-mono text-neutral-400 uppercase tracking-widest">Hora Real de Registro</span>
              <span className="text-xl font-bold font-mono tracking-tight text-white">{realClock || '--:--:--'}</span>
            </div>
            <div className="border-l border-emerald-500/20 pl-4">
              <span className="block text-[9px] font-mono text-neutral-400 uppercase tracking-widest">Data Real do Servidor</span>
              <span className="text-sm font-bold text-emerald-400 font-sans">{formatDateDisplay(todayDate)}</span>
            </div>
          </div>
        )}
      </div>

      {/* User Stats/Status Strip */}
      <div className="bg-neutral-800 border-t border-neutral-700 px-4 py-2" id="user-status-strip">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs text-neutral-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-400">Usuário Logado:</span>
            <span className="font-bold text-white">{currentUser.nome}</span>
            <span className="text-neutral-500">|</span>
            <span className="text-neutral-400">Perfil de Acesso:</span>
            <span className="px-1.5 py-0.5 bg-neutral-700 text-sky-300 tracking-wide font-mono text-[10px] uppercase rounded">
              {currentUser.perfil === Perfil.Admin 
                ? 'RH / Adm' 
                : currentUser.perfil === Perfil.Gestor 
                ? 'Engenheiro / Gestor' 
                : currentUser.perfil === Perfil.Fornecedor 
                ? 'Fornecedor' 
                : 'Colaborador'}
            </span>
            <span className="text-neutral-500">|</span>
            <span className="text-neutral-400">Status cadastral:</span>
            <span className={`inline-flex items-center gap-1 font-bold ${
              currentUser.status === UserStatus.Aprovado
                ? 'text-emerald-400'
                : currentUser.status === UserStatus.Pendente
                ? 'text-amber-400'
                : 'text-red-400'
            }`}>
              {currentUser.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2">
              {isAfterCutoff ? (
                <span className="flex items-center gap-1 text-red-400 font-bold text-xs" id="header-cutoff-status-closed">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 animate-pulse text-red-400" />
                  Horário fechado para Reservas e Cancelamentos do Dia
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs" id="header-cutoff-status-open">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  Horário aberto para Reservas e Cancelamentos do Dia
                </span>
              )}

              {pendingCount > 0 && currentUser.perfil === Perfil.Admin && (
                <span className="animate-pulse px-2 py-0.5 bg-rose-500 text-white rounded-full font-bold text-[10px]">
                  {pendingCount} Pendente(s)
                </span>
              )}
            </div>

            {/* Logout available in production mode */}
            {modoProducao && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[11px] font-bold shadow transition duration-200"
                title="Desconectar do sistema"
                id="header-logout-btn"
              >
                <LogOut className="h-3 w-3" /> Desconectar (Sair)
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
