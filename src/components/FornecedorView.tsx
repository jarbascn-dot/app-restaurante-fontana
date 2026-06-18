/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Usuario, Reserva, Obra, SystemSettings, ReservaStatus } from '../types';
import { Calendar, Building2, TrendingUp, CheckCircle, Clock, UtensilsCrossed, CalendarDays, Download, ShieldCheck } from 'lucide-react';

interface FornecedorViewProps {
  currentUser: Usuario;
  reservas: Reserva[];
  obras: Obra[];
  settings: SystemSettings;
}

export default function FornecedorView({ currentUser, reservas, obras, settings }: FornecedorViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  // Filter only the works (obras) allowed for this supplier
  const allowedObraIds = currentUser.idObrasFornecedor || [];
  const supplierObras = obras.filter(o => allowedObraIds.includes(o.id));

  const getObraName = (id: string) => obras.find(o => o.id === id)?.nome || 'Área/Obra Ativa';
  const getObraCC = (id: string) => obras.find(o => o.id === id)?.centroCusto || 'CC-000';

  // Calculations for selected date
  const getDailyStatsForObra = (obraId: string, date: string) => {
    // Active bookings
    const activeReservas = reservas.filter(
      r => r.idObraNoDia === obraId && r.data === date && r.status === ReservaStatus.Reservado
    );
    const totalReservadas = activeReservas.length;
    const totalConsumidas = activeReservas.filter(r => r.consumido).length;
    const totalPendenteEnvio = totalReservadas - totalConsumidas;

    return { totalReservadas, totalConsumidas, totalPendenteEnvio };
  };

  // Summarize monthly report
  const getMonthlyStats = () => {
    const monthsData: Record<string, Record<string, { total: number; consumidas: number }>> = {};
    
    // Sort reservations that fall into supplier's works
    const supplierReservas = reservas.filter(
      r => allowedObraIds.includes(r.idObraNoDia) && r.status === ReservaStatus.Reservado
    );

    supplierReservas.forEach(r => {
      const yearMonth = r.data.substring(0, 7); // YYYY-MM
      const oId = r.idObraNoDia;

      if (!monthsData[yearMonth]) {
        monthsData[yearMonth] = {};
      }
      if (!monthsData[yearMonth][oId]) {
        monthsData[yearMonth][oId] = { total: 0, consumidas: 0 };
      }

      monthsData[yearMonth][oId].total += 1;
      if (r.consumido) {
        monthsData[yearMonth][oId].consumidas += 1;
      }
    });

    return monthsData;
  };

  const monthlyReport = getMonthlyStats();

  return (
    <div className="space-y-6" id="fornecedor-scope-view">
      
      {/* Visual Header */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono rounded font-bold uppercase tracking-wider">
            📶 Canal do Fornecedor Externo de Alimentos
          </span>
          <h2 className="text-lg font-bold text-neutral-900">Acesso de Logística & Cozinha</h2>
          <p className="text-xs text-neutral-500 leading-normal">
            Consulte as quantidades oficiais de almoço reservadas e liberadas para planejar seu transporte e faturamento com segurança.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 bg-neutral-50 p-2.5 rounded-lg border border-neutral-150 text-xs md:text-right">
          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-mono block">Credencial Logada:</span>
            <strong className="text-neutral-800 block text-xs">{currentUser.nome}</strong>
            <span className="text-[10px] text-neutral-500 font-mono">Fornecedor Oficial FONTANA</span>
          </div>
        </div>
      </div>

      {/* Authorized Areas/Obras Highlight Card */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
          <UtensilsCrossed className="h-44 w-44" />
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-200" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-amber-100">Áreas/Obras sob seu Suprimento:</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {supplierObras.map(o => (
            <div key={o.id} className="bg-white/10 backdrop-blur-xs p-3 rounded-lg border border-white/10 flex items-center gap-3">
              <Building2 className="h-7 w-7 shrink-0 text-amber-205" />
              <div className="min-w-0">
                <span className="font-extrabold text-white text-xs truncate block">{o.nome}</span>
                <span className="text-[10px] text-amber-150 font-mono uppercase block">C. Custo: {o.centroCusto}</span>
              </div>
            </div>
          ))}
          {supplierObras.length === 0 && (
            <div className="col-span-full border border-dashed border-white/20 p-4 text-center text-sm text-amber-100">
              Nenhuma área/obra ativa associada a este usuário pelo RH.
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-250">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
          id="tab-supplier-daily"
        >
          <Calendar className="h-4 w-4" /> Quantitativo Diário
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'monthly'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
          id="tab-supplier-monthly"
        >
          <CalendarDays className="h-4 w-4" /> Acumulado para Faturamento
        </button>
      </div>

      {/* Daily tabulation */}
      {activeTab === 'daily' && (
        <div className="space-y-4 animate-[fadeIn_0.25s_ease]" id="supplier-daily-content">
          
          {/* Date Selector Banner */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-neutral-500" />
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-tight">Data da Programação:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="text-[11px] text-neutral-500 font-semibold flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              <span>Os dados refletem em tempo real as reservas feitas pelos colaboradores no app corporativo.</span>
            </div>
          </div>

          {/* Obras detailed grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supplierObras.map(o => {
              const stats = getDailyStatsForObra(o.id, selectedDate);
              return (
                <div key={o.id} className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
                  
                  {/* Header of card */}
                  <div className="bg-neutral-900 text-white px-4 py-3 border-b border-neutral-800 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-extrabold font-sans uppercase tracking-wider">{o.nome}</h4>
                      <p className="text-[10px] text-neutral-400 font-mono tracking-tight">{o.centroCusto}</p>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-neutral-800 text-neutral-300 border border-neutral-750 rounded font-bold">
                      Cozinha Suprida
                    </span>
                  </div>

                  {/* Body values description */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-2.5">
                      
                      {/* Enviar */}
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
                        <span className="block text-[9px] font-bold text-amber-700 uppercase tracking-tight font-mono mb-1">Pendente Envio</span>
                        <span className="block text-xl font-black text-amber-900">{stats.totalPendenteEnvio}</span>
                        <span className="block text-[8px] text-neutral-400 mt-1">Refeições programadas</span>
                      </div>

                      {/* Consumidos / Já Entregues */}
                      <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-lg text-center">
                        <span className="block text-[9px] font-bold text-emerald-800 uppercase tracking-tight font-mono mb-1">Pratos Entregues</span>
                        <span className="block text-xl font-black text-emerald-900">{stats.totalConsumidas}</span>
                        <span className="block text-[8px] text-neutral-400 mt-1">Baixa via Biometria</span>
                      </div>

                      {/* Total Reservado */}
                      <div className="p-3 bg-neutral-50 border border-neutral-150 rounded-lg text-center">
                        <span className="block text-[9px] font-bold text-neutral-600 uppercase tracking-tight font-mono mb-1">Total de Reservas</span>
                        <span className="block text-xl font-black text-neutral-900">{stats.totalReservadas}</span>
                        <span className="block text-[8px] text-neutral-400 mt-1">Total para a obra</span>
                      </div>

                    </div>

                    {/* Progress visual line */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] text-neutral-500 font-bold mb-1 uppercase font-mono">
                        <span>Retirada no Refeitório (Consumo)</span>
                        <span>{stats.totalReservadas > 0 ? Math.round((stats.totalConsumidas / stats.totalReservadas) * 100) : 0}% entregue</span>
                      </div>
                      <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${stats.totalReservadas > 0 ? (stats.totalConsumidas / stats.totalReservadas) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-neutral-50 rounded text-[11px] text-neutral-600 space-y-1">
                      <p className="font-semibold text-neutral-800">💡 Programação Segura de Produção:</p>
                      <p>
                        Para a data de hoje, produza e envie ao menos <strong>{stats.totalReservadas} refeições</strong>. Conforme ocorrem as validações biométricas faciais no tablet local, as refeições passam do status "Pendente Envio" para "Pratos Entregues" instantaneamente.
                      </p>
                    </div>

                  </div>
                </div>
              );
            })}

            {supplierObras.length === 0 && (
              <div className="bg-white p-12 text-center text-neutral-400 border border-neutral-200 rounded-xl col-span-full">
                Nenhuma área ou obra associada ao seu cadastro pelo administrador do RH.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly compilation */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-xl border border-neutral-205 shadow-xs overflow-hidden animate-[fadeIn_0.25s_ease]" id="supplier-monthly-content">
          <div className="p-5 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
            <div>
              <h3 className="text-sm font-bold text-neutral-850 uppercase tracking-wider">Acumulado das Obras</h3>
              <p className="text-xs text-neutral-500">Extrato seguro consolidado mensalmente para conciliação física de notas fiscais de faturamento de cozinha.</p>
            </div>
            
            <button
              onClick={() => alert(`Planilha mensal gerada! O fornecedor pode exportar em PDF pela visualização administrativa real com base nos totais aqui apresentados.`)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Exportar Planilha
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 text-neutral-800 border-b border-neutral-200 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Competência (Mês/Ano)</th>
                  <th className="p-3">Obra / Refeitório</th>
                  <th className="p-3 font-mono">Centro de Custo</th>
                  <th className="p-3 text-center">Refeições Reservadas</th>
                  <th className="p-3 text-center">Refeições Entregues (Baixadas)</th>
                  <th className="p-3 text-right">Valor Unitário Base</th>
                  <th className="p-3 text-right">Faturamento Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {Object.keys(monthlyReport).length > 0 ? (
                  Object.entries(monthlyReport).flatMap(([month, monthData]) => 
                    Object.entries(monthData).map(([oId, data]) => {
                      const obra = obras.find(o => o.id === oId);
                      const valuePerMeal = (obra && obra.valorRefeicao !== undefined && obra.valorRefeicao > 0)
                        ? obra.valorRefeicao 
                        : settings.valorRefeicaoPropria;
                      const estimatedBill = data.consumidas * valuePerMeal;
                      const [year, mNum] = month.split('-');
                      const formattedMonth = new Date(Number(year), Number(mNum) - 1, 1)
                        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                      return (
                        <tr key={`${month}-${oId}`} className="hover:bg-neutral-50 font-medium">
                          <td className="p-3 font-bold text-neutral-800 capitalize">{formattedMonth}</td>
                          <td className="p-3 text-neutral-900 font-bold">{getObraName(oId)}</td>
                          <td className="p-3 font-mono font-bold text-neutral-500">{getObraCC(oId)}</td>
                          <td className="p-3 text-center font-bold font-mono text-neutral-600">{data.total}</td>
                          <td className="p-3 text-center font-bold font-mono text-emerald-700 bg-emerald-500/5">{data.consumidas}</td>
                          <td className="p-3 text-right font-mono text-neutral-500">R$ {valuePerMeal.toFixed(2)}</td>
                          <td className="p-3 text-right font-bold font-mono text-neutral-950 bg-neutral-50">R$ {estimatedBill.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  <tr>
                    <td className="p-8 text-center text-neutral-400 italic" colSpan={7}>
                      Nenhum dado mensal consolidado para faturamento neste período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-amber-50/40 border-t border-neutral-150 flex items-start gap-2 text-xs text-neutral-600">
            <span className="font-bold text-amber-805 uppercase">🔒 Proteção Estrita de Dados GDPR / LGPD:</span>
            <p>
              Em conformidade com as diretivas corporativas, este acesso dispõe apenas de estatísticas agregadas de buffet e contadores logísticos de entrega por obra. Nomes, documentos, cargos, dados cadastrais pessoais ou fotos brutas de biometria facial dos colaboradores permanecem ocultos por design.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
