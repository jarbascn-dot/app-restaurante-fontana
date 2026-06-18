/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reserva, Usuario, Obra, Empresa, ReservaStatus, SystemSettings, Perfil } from '../types';
import { FileSpreadsheet, Download, Filter, Search, DollarSign, Calendar, Sliders, Printer } from 'lucide-react';

interface ReportsViewProps {
  reservas: Reserva[];
  usuarios: Usuario[];
  obras: Obra[];
  empresas: Empresa[];
  settings: SystemSettings;
  todayDate: string;
}

export default function ReportsView({ reservas, usuarios, obras, empresas, settings, todayDate }: ReportsViewProps) {
  const [reportType, setReportType] = useState<'diario' | 'mensal' | 'financeiro' | 'folha' | 'desconto'>('diario');
  
  // Daily Filter
  const [filterDailyObra, setFilterDailyObra] = useState<string>('all');
  // Monthly search
  const [searchMonthlyUser, setSearchMonthlyUser] = useState('');
  
  // Financial Filters
  const [finStart, setFinStart] = useState('2026-06-01');
  const [finEnd, setFinEnd] = useState('2026-06-30');
  const [filterFinObra, setFilterFinObra] = useState<string>('all');
  const [filterFinEmpresa, setFilterFinEmpresa] = useState<string>('all');

  // Print list filters
  const [folhaDate, setFolhaDate] = useState<string>(todayDate);
  const [folhaObraId, setFolhaObraId] = useState<string>('all');

  // Desconto em Folha monthly report Filters
  const [filterDescontoEmpresa, setFilterDescontoEmpresa] = useState<string>('all');
  const [descontoStart, setDescontoStart] = useState('2026-06-01');
  const [descontoEnd, setDescontoEnd] = useState('2026-06-30');

  const getUsuario = (id: string) => usuarios.find(u => u.id === id);
  const getObra = (id: string) => obras.find(o => o.id === id);
  const getEmpresa = (id: string) => empresas.find(e => e.id === id);

  const getMealPrice = (user?: Usuario, obraId?: string) => {
    const targetObraId = obraId || user?.idObraPadrao;
    const obra = targetObraId ? getObra(targetObraId) : undefined;
    
    // Obra custom price or fallback to global settings
    if (obra && obra.valorRefeicao !== undefined && obra.valorRefeicao > 0) {
      return obra.valorRefeicao;
    }
    return settings.valorRefeicaoPropria;
  };

  // --- REPORT GENERATORS ---

  // 1. DAILY REPORT (Dynamic date)
  const reportDate = todayDate;
  const getDailyRows = () => {
    // We list all approved/active employees, and check if they made a Booking for June 13, 2026
    const activeColabs = usuarios.filter(u => (u.perfil === 'colaborador' || u.perfil === 'admin') && u.status !== 'pendente');
    
    return activeColabs.map(user => {
      const res = reservas.find(r => r.idUsuario === user.id && r.data === reportDate);
      const obra = getObra(user.idObraPadrao);
      const empresa = getEmpresa(user.idEmpresa);
      
      const reservou = res && res.status === ReservaStatus.Reservado;
      const consumido = (res && res.status === ReservaStatus.Reservado && (res.consumido || !settings.usarTabletRetirada))
        ? (settings.usarTabletRetirada ? 'Sim (Auditado)' : 'Sim (Lista Assinada)')
        : 'Não';
      const alterado = res ? new Date(res.alteradoEm).toLocaleTimeString('pt-BR') : 'Sem alteração';
      const custo = reservou ? getMealPrice(user, res?.idObraNoDia) : 0;

      return {
        id: user.id,
        nome: user.nome,
        matricula: user.matricula,
        obraId: user.idObraPadrao,
        obraNome: obra ? obra.nome : 'Sede Fontana',
        centroCusto: obra ? obra.centroCusto : 'CC SGR',
        empresaNome: empresa ? empresa.nome : 'Fontana',
        reservou: reservou ? '🟢 Sim' : '⚪ Não',
        consumido,
        alterado,
        custo
      };
    }).filter(row => {
      if (filterDailyObra !== 'all' && row.obraId !== filterDailyObra) return false;
      return true;
    });
  };

  // 2. MONTHLY REPORT (Aggregates for June 2026)
  const getMonthlyRows = () => {
    const activeColabs = usuarios.filter(u => u.perfil === 'colaborador' || u.perfil === 'admin');
    const juneReservas = reservas.filter(r => r.data.startsWith('2026-06'));

    const aggregated = activeColabs.map(user => {
      const userRes = juneReservas.filter(r => r.idUsuario === user.id);
      
      const totalReservadas = userRes.filter(r => r.status === ReservaStatus.Reservado).length;
      const totalUtilizadas = userRes.filter(r => r.status === ReservaStatus.Reservado && (r.consumido || !settings.usarTabletRetirada)).length;
      const totalCanceladas = userRes.filter(r => r.status === ReservaStatus.Cancelado).length;
      
      const obra = getObra(user.idObraPadrao);
      const empresa = getEmpresa(user.idEmpresa);

      return {
        id: user.id,
        nome: user.nome,
        matricula: user.matricula,
        obraNome: obra ? obra.nome : 'Sede',
        empresaNome: empresa ? empresa.nome : 'Fontana',
        reservadas: totalReservadas,
        utilizadas: totalUtilizadas,
        canceladas: totalCanceladas
      };
    }).filter(row => {
      if (searchMonthlyUser) {
        return row.nome.toLowerCase().includes(searchMonthlyUser.toLowerCase()) || row.matricula.toLowerCase().includes(searchMonthlyUser.toLowerCase());
      }
      return true;
    });

    return aggregated;
  };

  // 3. FINANCIAL REPORT (Based on period and price models)
  const getFinancialRows = () => {
    // Filter reservas by date range
    const filteredReservations = reservas.filter(r => {
      const insideDate = r.data >= finStart && r.data <= finEnd;
      if (!insideDate) return false;
      
      const user = getUsuario(r.idUsuario);
      if (!user) return false;

      if (filterFinObra !== 'all' && r.idObraNoDia !== filterFinObra) {
        if (r.idObraNoDia || user.idObraPadrao !== filterFinObra) return false;
      }
      if (filterFinEmpresa !== 'all' && user.idEmpresa !== filterFinEmpresa) return false;
      
      return r.status === ReservaStatus.Reservado; // only active meals costs money
    });

    // Group costs by site / work standard
    const financialMap: Record<string, { obra: string; cc: string; qtd: number; consumidoQtd: number; valorTotal: number }> = {};
    
    filteredReservations.forEach(r => {
      const user = getUsuario(r.idUsuario);
      const oId = r.idObraNoDia || (user ? user.idObraPadrao : 'outra');
      const oObj = getObra(oId);
      
      const obraName = oObj ? oObj.nome : 'Outras Obras / Sede';
      const cCusto = oObj ? oObj.centroCusto : 'CC Geral';
      const price = getMealPrice(user, oId);

      if (!financialMap[oId]) {
        financialMap[oId] = {
          obra: obraName,
          cc: cCusto,
          qtd: 0,
          consumidoQtd: 0,
          valorTotal: 0
        };
      }
      
      financialMap[oId].qtd += 1;
      if (r.consumido || !settings.usarTabletRetirada) {
        financialMap[oId].consumidoQtd += 1;
      }
      financialMap[oId].valorTotal += price;
    });

    return Object.entries(financialMap).map(([id, val]) => ({
      id,
      ...val
    }));
  };

  // 5. PAYROLL DISCOUNT AND CORPORATE COST REPORT ROW CALCULATOR
  const getDescontoRows = () => {
    // Filter active reservations in the selected period that are Reserved
    const activeReservations = reservas.filter(
      r => r.data >= descontoStart && r.data <= descontoEnd && r.status === ReservaStatus.Reservado
    );

    // Filter relevant users
    const relevantUsers = usuarios.filter(u => {
      // Must be a Collaborator or Admin
      if (u.perfil !== Perfil.Colaborador && u.perfil !== Perfil.Admin) return false;
      // Must match selected company if not 'all'
      if (filterDescontoEmpresa !== 'all' && u.idEmpresa !== filterDescontoEmpresa) return false;
      return true;
    });

    const rows = relevantUsers.map(user => {
      // Find reservations for this user
      const userRes = activeReservations.filter(r => r.idUsuario === user.id);
      
      const totalReservas = userRes.length;
      
      // Compute total meal price & total collaborator discount
      let valorTotalRefeicao = 0;
      let valorTotalDesconto = 0;

      userRes.forEach(r => {
        const oId = r.idObraNoDia || user.idObraPadrao;
        const oObj = getObra(oId);
        const price = oObj?.valorRefeicao && oObj.valorRefeicao > 0 ? oObj.valorRefeicao : settings.valorRefeicaoPropria;
        const discount = oObj?.valorDescontoColaborador ?? 0;

        valorTotalRefeicao += price;
        valorTotalDesconto += discount;
      });

      const eObj = getEmpresa(user.idEmpresa);

      return {
        id: user.id,
        matricula: user.matricula || '---',
        nome: user.nome,
        empresaNome: eObj ? eObj.nome : 'Fontana',
        quantidadeReservas: totalReservas,
        custoCozinhaTotal: valorTotalRefeicao,
        descontoTotalColaborador: valorTotalDesconto,
        custoLiquidoEmpresa: valorTotalRefeicao - valorTotalDesconto
      };
    });

    // Skip users with 0 reservations
    const withReservas = rows.filter(r => r.quantidadeReservas > 0);

    // Sort alphabetically by collaborator name
    withReservas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return withReservas;
  };

  // 4. PRINTABLE REF SIGNATURE SHEET
  const getFolhaRows = () => {
    const dayReservations = reservas.filter(
      r => r.data === folhaDate && r.status === ReservaStatus.Reservado
    );

    const rows = dayReservations.map(res => {
      const user = getUsuario(res.idUsuario);
      const oId = res.idObraNoDia || (user ? user.idObraPadrao : 'other');
      const oObj = getObra(oId);
      const eObj = user ? getEmpresa(user.idEmpresa) : null;

      return {
        id: res.id,
        nome: user ? user.nome : 'Ex-colaborador',
        matricula: user ? user.matricula : 'S/M',
        obraId: oId,
        obraNome: oObj ? oObj.nome : 'Administrativo Sede',
        empresaNome: eObj ? eObj.nome : 'Fontana',
      };
    });

    const filtered = rows.filter(row => {
      if (folhaObraId !== 'all' && row.obraId !== folhaObraId) return false;
      return true;
    });

    filtered.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return filtered;
  };

  // --- HEURISTIC CALCULATORS ---

  const totalFinanceiro = getFinancialRows().reduce((acc, row) => acc + row.valorTotal, 0);
  const totalRefeicoesFinanceiro = getFinancialRows().reduce((acc, row) => acc + row.qtd, 0);

  // --- CSV EXPORTER ACTION ---
  const triggerCSVDownload = () => {
    let headers = '';
    let body = '';
    let fn = '';

    const fNum = (val: number) => val.toFixed(2).replace('.', ',');

    if (reportType === 'diario') {
      headers = 'Nome;Matrícula;Obra;Centro de Custo;Empresa;Reservou?;Consumido?;IP/Hora;Custo Estimado\n';
      const rows = getDailyRows();
      body = rows.map(r => 
        `"${r.nome}";"${r.matricula}";"${r.obraNome}";"${r.centroCusto}";"${r.empresaNome}";"${r.reservou}";"${r.consumido}";"${r.alterado}";"${fNum(r.custo)}"`
      ).join('\n');
      fn = `SGR-Relatorio-Diario-${reportDate}.csv`;
    } else if (reportType === 'mensal') {
      headers = 'Colaborador;Matrícula;Obra de Origem;Contrato / Empresa;Reservadas;Consumidas;Canceladas\n';
      const rows = getMonthlyRows();
      body = rows.map(r => 
        `"${r.nome}";"${r.matricula}";"${r.obraNome}";"${r.empresaNome}";"${r.reservadas}";"${r.utilizadas}";"${r.canceladas}"`
      ).join('\n');
      fn = 'SGR-Relatorio-Mensal-Consumo.csv';
    } else if (reportType === 'desconto') {
      headers = 'Matrícula;Nome do Colaborador;Empresa/Contrato;Quantidade de Reservas;Custo Total Empresa;Valor total de Desconto;Custo Líquido Empresa\n';
      const rows = getDescontoRows();
      body = rows.map(r => 
        `"${r.matricula}";"${r.nome}";"${r.empresaNome}";"${r.quantidadeReservas}";"${fNum(r.custoCozinhaTotal)}";"${fNum(r.descontoTotalColaborador)}";"${fNum(r.custoLiquidoEmpresa)}"`
      ).join('\n');
      const totalReservas = rows.reduce((acc, r) => acc + r.quantidadeReservas, 0);
      const totalEmpresa = rows.reduce((acc, r) => acc + r.custoCozinhaTotal, 0);
      const totalDesconto = rows.reduce((acc, r) => acc + r.descontoTotalColaborador, 0);
      const totalLiquido = rows.reduce((acc, r) => acc + r.custoLiquidoEmpresa, 0);
      body += `\n\n"TOTAL";"";"";"${totalReservas}";"${fNum(totalEmpresa)}";"${fNum(totalDesconto)}";"${fNum(totalLiquido)}"\n`;
      fn = `SGR-Relatorio-Descontos-Folha-${descontoStart}-a-${descontoEnd}.csv`;
    } else {
      headers = 'Obra / Centro;Centro de Custo;Quantidade de Marmitas;Retirada Confirmada (FaceID);Custo Total Gasto\n';
      const rows = getFinancialRows();
      body = rows.map(r => 
        `"${r.obra}";"${r.cc}";"${r.qtd}";"${r.consumidoQtd}";"${fNum(r.valorTotal)}"`
      ).join('\n');
      body += `\n\n"TOTAL";"";"${totalRefeicoesFinanceiro}";"";"R$ ${fNum(totalFinanceiro)}"\n`;
      fn = `App-Restaurante-Relatorio-Financeiro-Custos.csv`;
    }

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), headers + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fn);
    link.click();
  };

  return (
    <div className="space-y-6" id="reports-view-panel">
      {/* Selector buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setReportType('diario')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              reportType === 'diario'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
            }`}
            id="report-type-daily"
          >
            📊 Relatório Diário
          </button>
          
          <button
            onClick={() => setReportType('mensal')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              reportType === 'mensal'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
            }`}
            id="report-type-monthly"
          >
            🗓️ Absenteísmo & Mensal
          </button>

          <button
            onClick={() => setReportType('financeiro')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              reportType === 'financeiro'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
            }`}
            id="report-type-financial"
          >
            💰 Custos por Obra
          </button>

          <button
            onClick={() => setReportType('folha')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              reportType === 'folha'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
            }`}
            id="report-type-folha"
          >
            📋 Folha de Assinatura (Imprimir)
          </button>

          <button
            onClick={() => setReportType('desconto')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              reportType === 'desconto'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
            }`}
            id="report-type-desconto"
          >
            💸 Desconto em Folha (Assinatura)
          </button>
        </div>

        <button
          onClick={triggerCSVDownload}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5 w-full sm:w-auto justify-center"
          id="xlsx-export-btn"
        >
          <Download className="h-4 w-4" /> Exportar Planilha (CSV)
        </button>
      </div>

      {/* Daily Report View */}
      {reportType === 'diario' && (
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4" id="daily-report-box">
          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Relatório de Consumo Diário</h3>
              <p className="text-xs text-neutral-500">Filtrabilidade rápida por frentes de trabalho para o dia atual <strong>{reportDate}</strong>.</p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-neutral-400" />
              <select
                value={filterDailyObra}
                onChange={(e) => setFilterDailyObra(e.target.value)}
                className="text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                id="daily-obra-filter"
              >
                <option value="all">Todas as Obras (Filtro)</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs bg-white">
              <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                <tr>
                  <th className="p-3">Colaborador / Reg.</th>
                  <th className="p-3">Empresa/Contrato</th>
                  <th className="p-3">Obra Vinculada</th>
                  <th className="p-3">Centro de Custo</th>
                  <th className="p-3 text-center">Reservado Hoje?</th>
                  <th className="p-3">Última Alteração</th>
                  <th className="p-3">Retirada (Face ID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {getDailyRows().map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="p-3">
                      <div className="font-bold text-neutral-800">{row.nome}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">Reg: {row.matricula}</div>
                    </td>
                    <td className="p-3 font-semibold text-neutral-600">{row.empresaNome}</td>
                    <td className="p-3">{row.obraNome}</td>
                    <td className="p-3 font-mono text-[10px] font-bold text-neutral-500">{row.centroCusto}</td>
                    <td className="p-3 text-center font-bold text-xs">{row.reservou}</td>
                    <td className="p-3 text-neutral-450 text-[11px] font-mono">{row.alterado}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                        row.consumido.includes('Sim')
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {row.consumido}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Report View */}
      {reportType === 'mensal' && (
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4" id="monthly-report-box">
          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Relatório Consolidado de Absenteísmo</h3>
              <p className="text-xs text-neutral-500">Mapeamento mensal de refeições solicitadas, consumidas e taxas de cancelamento antecipados de cada empreiteiro.</p>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Pesquisar por colaborador..."
                value={searchMonthlyUser}
                onChange={(e) => setSearchMonthlyUser(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-neutral-300 rounded text-xs bg-white text-neutral-800 w-full sm:w-64"
                id="search-monthly-colab"
              />
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs bg-white">
              <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                <tr>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Matrícula</th>
                  <th className="p-3">Obra Origem</th>
                  <th className="p-3">Contrato / Empreiteira</th>
                  <th className="p-3 text-center">Marmitas Reservadas</th>
                  <th className="p-3 text-center">Consumidas (Confirmadas)</th>
                  <th className="p-3 text-center">Canceladas no Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {getMonthlyRows().map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="p-3 font-bold text-neutral-800">{row.nome}</td>
                    <td className="p-3 font-mono font-medium">{row.matricula}</td>
                    <td className="p-3">{row.obraNome}</td>
                    <td className="p-3 font-semibold text-neutral-500">{row.empresaNome}</td>
                    <td className="p-3 text-center text-sm font-mono text-neutral-900 font-bold">{row.reservadas}</td>
                    <td className="p-3 text-center text-sm font-mono text-emerald-700 font-bold bg-emerald-50/20">{row.utilizadas}</td>
                    <td className="p-3 text-center text-sm font-mono text-neutral-500 font-bold">{row.canceladas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial Cost Allocation Report View */}
      {reportType === 'financeiro' && (
        <div className="space-y-4" id="financial-report-box">
          {/* Filter Bar Panel */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-widest text-[11px] font-mono">Filtros Avançados de Faturamento</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Período Inicial</label>
                <input
                  type="date"
                  value={finStart}
                  onChange={(e) => setFinStart(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="fin-range-start"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Período Final</label>
                <input
                  type="date"
                  value={finEnd}
                  onChange={(e) => setFinEnd(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="fin-range-end"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Obra / CC</label>
                <select
                  value={filterFinObra}
                  onChange={(e) => setFilterFinObra(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="fin-obra-select"
                >
                  <option value="all">Todas as Obras vinculadas</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Empreiteira Associada</label>
                <select
                  value={filterFinEmpresa}
                  onChange={(e) => setFilterFinEmpresa(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="fin-empr-select"
                >
                  <option value="all">Filtro de Empresa</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table displaying aggregated costs */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold font-mono text-neutral-500 uppercase">Espelho de Gestão Automatizada de Custos por Centro de Custo</span>
              <div className="flex gap-4 text-xs font-semibold">
                <span className="text-neutral-600">Total Refeições: <strong className="text-neutral-950 font-mono">{totalRefeicoesFinanceiro}</strong></span>
                <span className="text-emerald-700">Subtotal Período: <strong className="font-mono text-emerald-800 font-extrabold">R$ {totalFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs bg-white">
                <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Obra / Centro de Custo</th>
                    <th className="p-3">Código do Projeto (CC)</th>
                    <th className="p-3 text-center">Quantidade de Refeições</th>
                    <th className="p-3 text-center">Controle de Retiradas Confirmadas</th>
                    <th className="p-3 text-right">Custo Líquido Período</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700 font-sans">
                  {getFinancialRows().map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50 font-medium">
                      <td className="p-3 font-bold text-neutral-800">{row.obra}</td>
                      <td className="p-3 font-mono font-bold text-neutral-500">{row.cc}</td>
                      <td className="p-3 text-center font-mono text-sm">{row.qtd}</td>
                      <td className="p-3 text-center font-mono text-neutral-500">
                        {row.consumidoQtd} de {row.qtd} {settings.usarTabletRetirada ? '(Facial)' : '(Lista)'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-neutral-900">
                        R$ {row.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-950 text-white font-bold h-10">
                    <td className="p-3" colSpan={2}>SUBTOTAL TOTAL DE CONTRATOS DO GRUPO</td>
                    <td className="p-3 text-center font-mono">{totalRefeicoesFinanceiro}</td>
                    <td className="p-3 text-center font-mono text-neutral-300">
                      Auditado
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-400">
                      R$ {totalFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-neutral-400 max-w-2xl leading-normal mt-2">
              💡 **Vantagem Construtora Fontana:** Em planilhas tradicionais, a distribuição de custos de almoços corporativos exige dias de cruzamento. Aqui, a distribuição contábil por obra e centro de custo é instantânea porque as refeições confirmadas na cozinha registram o centro de custo do trabalhador de forma automatizada no momento da retirada.
            </p>
          </div>
        </div>
      )}

      {/* Printable Signature List */}
      {reportType === 'folha' && (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease]" id="folha-assinatura-box">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-sheet-area, #printable-sheet-area * {
                visibility: visible !important;
              }
              #printable-sheet-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background-color: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 1.5cm 1.2cm !important;
              }
            }
          `}</style>

          {/* Quick interactive print config bar */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4 no-print" id="print-controls">
            <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase text-xs tracking-wider">
              <Printer className="h-4 w-4" />
              <span>Configurações da Relação de Assinaturas</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-black mb-1">Selecione a Data das Refeições</label>
                <input
                  type="date"
                  value={folhaDate}
                  onChange={(e) => setFolhaDate(e.target.value)}
                  className="w-full text-xs font-mono border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="folha-date-picker"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-black mb-1">Filtrar por Área / Obra</label>
                <select
                  value={folhaObraId}
                  onChange={(e) => setFolhaObraId(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="folha-obra-picker"
                >
                  <option value="all">Todas as Áreas</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => window.print()}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2 duration-150"
                  id="trigger-print-cmd-btn"
                >
                  <Printer className="h-4 w-4 shrink-0 text-emerald-400" /> Imprimir Relação (ou Salvar em PDF)
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-medium text-neutral-700 leading-normal">
                💡 **Dica de Impressão:** Ao abrir a janela de impressão do seu navegador, escolha <strong>Salvar como PDF</strong> caso queira salvar o arquivo digital, ou envie diretamente para a sua impressora física. Lembre-se de certificar que a opção "Gráficos de fundo" esteja marcada para imprimir as linhas pontilhadas de assinatura de forma nítida.
              </span>
            </div>
          </div>

          {/* Visual simulation sheet area - looks exactly like real printed paper */}
          <div className="bg-white border border-neutral-300/80 rounded-xl shadow-lg p-6 md:p-8 max-w-4xl mx-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] overflow-x-auto min-h-[500px]" id="printable-sheet-preview-frame">
            
            <div className="w-full min-w-[620px] bg-white p-4 border border-neutral-200 shadow-xs" id="printable-sheet-area">
              
              {/* Sheet header */}
              <div className="border-b-2 border-neutral-950 pb-4 flex justify-between items-start">
                <div className="space-y-0.5">
                  <div className="text-sm font-black tracking-wider uppercase text-neutral-900 font-sans">FONTANA</div>
                  <div className="text-xs font-bold uppercase text-neutral-500 font-mono tracking-wide">Controle Interno de Restaurante</div>
                  <h4 className="text-base font-extrabold tracking-tight text-neutral-950 uppercase mt-2">LISTA DE PRESENÇA E ASSINATURA</h4>
                </div>
                
                <div className="text-right font-mono text-[11px] text-neutral-800 space-y-1 bg-neutral-50 border border-neutral-200 p-2.5 rounded-lg max-w-xs">
                  <p><strong>DATA:</strong> {new Date(folhaDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  <p><strong>CÓD. DOC:</strong> FTR-{folhaDate.replace(/-/g, '')}</p>
                  <p><strong>TOTAL RESERVADO:</strong> {getFolhaRows().length} almoço(s)</p>
                </div>
              </div>

              {/* Sheet Sub-Metadata Fields */}
              <div className="grid grid-cols-2 gap-4 border-b border-neutral-300 py-3 text-xs bg-neutral-50/50 px-2 my-2 rounded">
                <div>
                  <span className="text-neutral-400 font-mono text-[10px] uppercase block font-bold">Local / Refeitório:</span>
                  <span className="font-extrabold text-neutral-900">
                    {folhaObraId === 'all' ? 'Todos os Refeitórios da Empresa' : obras.find(o => o.id === folhaObraId)?.nome || 'Área Administradora'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 font-mono text-[10px] uppercase block font-bold">Responsável pela Coleta:</span>
                  <span className="font-extrabold text-neutral-900">Resp. Cozinha Administrativa</span>
                </div>
              </div>

              {/* Booking List Table for print */}
              <div className="mt-4">
                <table className="w-full text-left text-xs border border-neutral-350">
                  <thead>
                    <tr className="bg-neutral-100 text-neutral-800 border-b border-neutral-350 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-2 border-r border-neutral-350 text-center w-12">Nº</th>
                      <th className="p-2 border-r border-neutral-350 w-2/5">Nome do Colaborador</th>
                      <th className="p-2 w-3/5">Assinatura do Colaborador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300 text-neutral-900">
                    {getFolhaRows().length > 0 ? (
                      getFolhaRows().map((row, index) => (
                        <tr key={row.id} className="h-16 text-neutral-950 font-medium font-sans">
                          <td className="p-2 border-r border-neutral-350 text-center font-bold font-mono bg-neutral-50">{index + 1}</td>
                          <td className="p-2 border-r border-neutral-350 font-bold text-sm">{row.nome}</td>
                          <td className="p-2 align-middle pr-4">
                            <div className="w-full border-b border-dashed border-neutral-900 mt-6 h-1"></div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-8 text-center text-neutral-400 italic" colSpan={3}>
                          Nenhum colaborador possui reserva de refeição ativa para a data e área selecionadas.
                          <div className="text-[11px] font-normal text-neutral-400 not-italic mt-2 font-sans no-print flex-col">
                            Selecione outra data (ex: datas com reservas ativas) ou mude o filtro de área.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sheet footer signatures of supervisor */}
              <div className="mt-12 flex justify-between gap-12 pt-8 border-t border-dotted border-neutral-400">
                <div className="text-center w-1/2">
                  <div className="border-b border-neutral-950 w-full mx-auto h-6"></div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block mt-1.5">Visto do Administrativo / RH</span>
                </div>
                <div className="text-center w-1/2">
                  <div className="border-b border-neutral-950 w-full mx-auto h-6"></div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block mt-1.5">Visto do Fornecedor / Cozinha</span>
                </div>
              </div>

              <div className="mt-8 text-center text-[9px] font-mono text-neutral-400 border-t border-neutral-200 pt-2">
                SGR - APP AUTOMAÇÃO DE RESTAURANTE FONTANA -- IMPRESSO EM {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
              </div>

            </div>
          </div>
        </div>
      )}

      {reportType === 'desconto' && (
        <div className="space-y-4 font-sans" id="payroll-discount-report-box">
          <style>{`
            @media print {
              html, body, #root, #app-interior, #reports-view-panel {
                background: white !important;
                color: black !important;
              }
              #app-sidebar, #app-navbar, #reports-view-panel > :not(#payroll-printable-sheet-frame) {
                display: none !important;
              }
              #payroll-printable-sheet-frame {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background-color: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 1.2cm 1cm !important;
              }
            }
          `}</style>

          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4 no-print" id="desconto-controls">
            <div className="flex items-center gap-2 text-neutral-800 font-bold uppercase text-xs tracking-wider">
              <Sliders className="h-4 w-4 text-neutral-600" />
              <span>Configuração do Relatório de Desconto</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Selecionar Empresa</label>
                <select
                  value={filterDescontoEmpresa}
                  onChange={(e) => setFilterDescontoEmpresa(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="desconto-empresa-picker"
                >
                  <option value="all">Todas as Empresas</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-semibold mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={descontoStart}
                  onChange={(e) => setDescontoStart(e.target.value)}
                  className="w-full text-xs font-mono border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="desconto-start-date"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-semibold mb-1">Data Final</label>
                <input
                  type="date"
                  value={descontoEnd}
                  onChange={(e) => setDescontoEnd(e.target.value)}
                  className="w-full text-xs font-mono border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="desconto-end-date"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => window.print()}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2 duration-150"
                  id="trigger-desconto-print-btn"
                >
                  <Printer className="h-4 w-4 shrink-0 text-emerald-400" /> Imprimir Documento (PDF)
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-medium text-neutral-700 leading-normal">
                💡 **Relatório para Assinatura e Desconto**: Lista os colaboradores em ordem alfabética com o total de refeições reservadas, custos totais e o valor a ser descontado em folha (com base no desconto de colaborador configurado em cada obra).
              </span>
            </div>
          </div>

          {/* Visual simulation sheet area */}
          <div className="bg-white border border-neutral-300/80 rounded-xl shadow-lg p-6 md:p-8 max-w-4xl mx-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] overflow-x-auto min-h-[500px]" id="payroll-printable-sheet-frame">
            <div className="w-full min-w-[700px] bg-white p-4 border border-neutral-200 shadow-xs" id="payroll-printable-sheet-area">
              
              {/* Header */}
              <div className="border-b-2 border-neutral-950 pb-4 flex justify-between items-start">
                <div className="space-y-0.5">
                  <div className="text-sm font-black tracking-wider uppercase text-neutral-900 font-sans">FONTANA</div>
                  <div className="text-xs font-bold uppercase text-neutral-500 font-mono tracking-wide">CONSTRUTORA E INCORPORADORA</div>
                  <h4 className="text-base font-extrabold tracking-tight text-neutral-950 uppercase mt-2">RELAÇÃO DE DESCONTO EM FOLHA - REFEIÇÕES</h4>
                </div>
                
                <div className="text-right font-mono text-[11px] text-neutral-800 space-y-1 bg-neutral-50 border border-neutral-200 p-2.5 rounded-lg max-w-xs">
                  <p><strong>PERÍODO:</strong> {new Date(descontoStart + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(descontoEnd + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  <p><strong>EMPRESA:</strong> {filterDescontoEmpresa === 'all' ? 'TODAS COMPATÍVEIS' : empresas.find(e => e.id === filterDescontoEmpresa)?.nome || 'Fontana'}</p>
                  <p><strong>COLETADO EM:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Table */}
              <div className="mt-4">
                <table className="w-full text-left text-xs border border-neutral-350">
                  <thead>
                    <tr className="bg-neutral-100 text-neutral-800 border-b border-neutral-350 font-bold uppercase tracking-wider text-[9px]">
                      <th className="p-2 border-r border-neutral-350 text-center w-10">Nº</th>
                      <th className="p-2 border-r border-neutral-350 w-24">Matrícula</th>
                      <th className="p-2 border-r border-neutral-350 w-44">Nome do Colaborador</th>
                      <th className="p-2 border-r border-neutral-350 w-16 text-center">Quant. Reservas</th>
                      <th className="p-2 border-r border-neutral-350 w-24 text-right">Valor Custo Empresa</th>
                      <th className="p-2 border-r border-neutral-350 w-24 text-right">Total Desconto Colab.</th>
                      <th className="p-2 w-36 text-center">Assinatura do Colaborador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300 text-neutral-900">
                    {getDescontoRows().length > 0 ? (
                      getDescontoRows().map((row, index) => (
                        <tr key={row.id} className="h-12 text-neutral-950 font-medium font-sans">
                          <td className="p-2 border-r border-neutral-350 text-center font-bold font-mono bg-neutral-50 text-[10px]">{index + 1}</td>
                          <td className="p-2 border-r border-neutral-350 font-mono font-bold text-neutral-800 tracking-tight text-[10px]">{row.matricula}</td>
                          <td className="p-2 border-r border-neutral-350 font-bold text-[11px] uppercase">{row.nome}</td>
                          <td className="p-2 border-r border-neutral-350 text-center font-mono font-extrabold text-[11px] text-neutral-800">{row.quantidadeReservas}</td>
                          <td className="p-2 border-r border-neutral-350 text-right font-mono text-[10px] text-neutral-600">R$ {row.custoCozinhaTotal.toFixed(2)}</td>
                          <td className="p-2 border-r border-neutral-350 text-right font-mono font-bold text-emerald-800 text-[11px]">R$ {row.descontoTotalColaborador.toFixed(2)}</td>
                          <td className="p-2 align-middle pr-2">
                            <div className="w-full border-b border-dashed border-neutral-900 mt-4 h-1"></div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-8 text-center text-neutral-400 italic" colSpan={7}>
                          Nenhum colaborador possui reservas de refeição ativas no período selecionado.
                          <div className="text-[11px] font-normal text-neutral-400 not-italic mt-2 font-sans no-print">
                            Certifique-se de que existem reservas com status "Reservado" para as datas configuradas.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {getDescontoRows().length > 0 && (
                    <tfoot>
                      <tr className="bg-neutral-50 border-t-2 border-neutral-950 font-bold font-mono text-[10px] text-neutral-900">
                        <td className="p-2 text-right uppercase border-r border-neutral-350" colSpan={3}>Totais Gerais:</td>
                        <td className="p-2 text-center border-r border-neutral-350 font-extrabold text-[11px]">
                          {getDescontoRows().reduce((acc, r) => acc + r.quantidadeReservas, 0)}
                        </td>
                        <td className="p-2 text-right border-r border-neutral-350 text-neutral-600 font-mono">
                          R$ {getDescontoRows().reduce((acc, r) => acc + r.custoCozinhaTotal, 0).toFixed(2)}
                        </td>
                        <td className="p-2 text-right border-r border-neutral-350 text-emerald-900 font-extrabold text-[11px]">
                          R$ {getDescontoRows().reduce((acc, r) => acc + r.descontoTotalColaborador, 0).toFixed(2)}
                        </td>
                        <td className="p-2 bg-white"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Footer supervisor signatures */}
              <div className="mt-12 flex justify-between gap-12 pt-8 border-t border-dotted border-neutral-400">
                <div className="text-center w-1/3">
                  <div className="border-b border-neutral-950 w-full mx-auto h-6"></div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider block mt-1">Responsável RH / Auditor</span>
                </div>
                <div className="text-center w-1/3">
                  <div className="border-b border-neutral-950 w-full mx-auto h-6"></div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider block mt-1">Diretor da Empresa</span>
                </div>
                <div className="text-center w-1/3">
                  <div className="border-b border-neutral-950 w-full mx-auto h-6"></div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider block mt-1">Representante Fornecedor</span>
                </div>
              </div>

              <div className="mt-8 text-center text-[8px] font-mono text-neutral-400 border-t border-neutral-200 pt-2 uppercase">
                SGR - APP AUTOMAÇÃO DE RESTAURANTE FONTANA -- RELATÓRIO CONFIGURADO DE ADESÃO E DESCONTO EM FOLHA COLETIVO
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
