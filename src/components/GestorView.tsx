/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Usuario, Reserva, ReservaStatus, Obra, Empresa, SystemSettings } from '../types';
import { Shield, Hammer, Users, Utensils, CheckCircle } from 'lucide-react';

interface GestorViewProps {
  currentUser: Usuario;
  reservas: Reserva[];
  usuarios: Usuario[];
  obras: Obra[];
  empresas: Empresa[];
  settings: SystemSettings;
  todayDate: string;
}

export default function GestorView({
  currentUser,
  reservas,
  usuarios,
  obras,
  empresas,
  settings,
  todayDate,
}: GestorViewProps) {
  
  // Format date display nicely (DD/MM/AAAA)
  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Under active engineering area responsibility
  const obraIdResponsabilidade = currentUser.idObraPadrao;
  const obraObj = obras.find(o => o.id === obraIdResponsabilidade);

  const getObra = (id: string) => obras.find(item => item.id === id);
  const getEmpresa = (id: string) => empresas.find(e => e.id === id);

  // Filter ONLY collaborators belonging to this work
  const colaboradoresSobGestao = usuarios.filter(u => 
    u.idObraPadrao === obraIdResponsabilidade && (u.perfil === 'colaborador' || u.perfil === 'admin')
  );

  // Mapped companies/unidades working on this site
  const contractorIdsOnSite = Array.from(new Set(colaboradoresSobGestao.map(u => u.idEmpresa)));
  const empresasOnSite = empresas.filter(e => contractorIdsOnSite.includes(e.id));

  // Count reservations for today under this specific site
  const reportDate = todayDate;
  const reservasSiteHoje = reservas.filter(r => 
    r.data === reportDate && 
    r.status === ReservaStatus.Reservado && 
    (r.idObraNoDia === obraIdResponsabilidade || (!r.idObraNoDia && getUsuario(r.idUsuario)?.idObraPadrao === obraIdResponsabilidade))
  );

  function getUsuario(id: string) {
    return usuarios.find(u => u.id === id);
  }

  // Monthly sum of meals in o-1
  const reservasSiteMes = reservas.filter(r => {
    const currentMonthPrefix = reportDate.substring(0, 7);
    const isCurrentMonth = r.data.startsWith(currentMonthPrefix);
    if (!isCurrentMonth) return false;
    
    const user = getUsuario(r.idUsuario);
    if (!user) return false;

    const belongsToObra = r.idObraNoDia === obraIdResponsabilidade || (!r.idObraNoDia && user.idObraPadrao === obraIdResponsabilidade);
    return belongsToObra && r.status === ReservaStatus.Reservado;
  });

  return (
    <div className="space-y-6" id="gestor-view-panel">
      {/* Scope Block Warning Banner explaining RBAC */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
        <div className="flex gap-2">
          <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide font-mono">Restrição de Acesso Ativa (RBAC)</h4>
            <p className="text-xs text-amber-700 leading-relaxed max-w-2xl mt-0.5">
              Como <strong>Engenheiro de Obra</strong>, seu acesso está restrito à obra <strong>{obraObj?.nome || 'Sede Administrativa'}</strong>. Você não possui privilégios para visualizar faturas ou refeições de outras obras.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
          <span className="block text-[10px] font-mono text-neutral-500 uppercase">Minha Obra</span>
          <span className="text-lg font-extrabold text-neutral-800 mt-1 block truncate">
            {obraObj?.nome}
          </span>
          <span className="text-[10px] text-neutral-400 block font-mono mt-1">CC: {obraObj?.centroCusto}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
          <span className="block text-[10px] font-mono text-neutral-500 uppercase">Marmitas Hoje ({formatDateDisplay(reportDate)})</span>
          <span className="text-2xl font-black text-neutral-900 mt-1 block">
            {reservasSiteHoje.length} <span className="text-xs font-normal text-neutral-500">Reservas</span>
          </span>
          <span className="text-[10px] text-emerald-700 font-bold block mt-1">
            ✓ {reservasSiteHoje.filter(r => r.consumido || !settings.usarTabletRetirada).length} {settings.usarTabletRetirada ? 'retiradas confirmadas com câmera' : 'refeições faturadas (Lista Assinada)'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
          <span className="block text-[10px] font-mono text-neutral-500 uppercase">Aculumado do Mês (Custo Obra)</span>
          <span className="text-2xl font-black text-neutral-900 mt-1 block font-mono">
            {reservasSiteMes.length} <span className="text-xs font-normal text-neutral-500">Pratos</span>
          </span>
          <span className="text-[10px] text-neutral-500 block mt-1">
            Empresas vinculadas à área/obra: {empresasOnSite.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Table of collaborators under management */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm lg:col-span-2 space-y-4" id="gestor-team-list">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
            <Users className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-wide">Equipes Vinculadas à Minha Obra</h4>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs bg-white">
              <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                <tr>
                  <th className="p-3">Nome do Integrante</th>
                  <th className="p-3">Matrícula</th>
                  <th className="p-3">Empresa Cadastrada</th>
                  <th className="p-3 text-center">Status Cadastral</th>
                  <th className="p-3 text-right">Marmita Hoje?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {colaboradoresSobGestao.map((colab) => {
                  const resHoje = reservas.find(r => r.idUsuario === colab.id && r.data === reportDate);
                  const optEmp = getEmpresa(colab.idEmpresa);
                  const hasBookingForToday = resHoje && resHoje.status === ReservaStatus.Reservado;
                  
                  return (
                    <tr key={colab.id} className="hover:bg-neutral-50">
                      <td className="p-3 font-bold text-neutral-800">{colab.nome}</td>
                      <td className="p-3 font-mono font-bold text-neutral-500">{colab.matricula}</td>
                      <td className="p-3 font-semibold text-neutral-600">{optEmp?.nome || 'Estilo Fontana'}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-extrabold uppercase border border-emerald-100">
                          {colab.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded ${
                          hasBookingForToday
                            ? 'bg-emerald-500 text-white font-mono'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}>
                          {hasBookingForToday ? '🟢 RESERVADA' : '⚪ NÃO'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side: contractor allocation summaries */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4" id="gestor-contractors">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
            <Hammer className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-wide">Distribuição de Colaboradores</h4>
          </div>

          <div className="space-y-3">
            {empresasOnSite.map(emp => {
              const staffCount = colaboradoresSobGestao.filter(c => c.idEmpresa === emp.id).length;
              return (
                <div key={emp.id} className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex justify-between items-center">
                  <div>
                    <h5 className="font-bold text-neutral-800 text-xs">{emp.nome}</h5>
                    <span className="text-[10px] text-neutral-400 font-medium">Unidade Ativa</span>
                  </div>
                  <span className="px-2 py-1 bg-neutral-200 text-neutral-700 text-xs font-bold rounded">
                    {staffCount} colaboradores
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-neutral-500 leading-relaxed pt-2">
            ℹ **Sienge Sync:** O credenciamento de novos colaboradores, bem como a alocação de frentes de serviço, é sincronizado de forma consolidada para manter a coerência das equipes de obra.
          </div>
        </div>
      </div>
    </div>
  );
}
