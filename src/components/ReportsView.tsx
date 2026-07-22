/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reserva, Usuario, Obra, Empresa, ReservaStatus, SystemSettings, Perfil, UserStatus } from '../types';
import { FileSpreadsheet, Download, Filter, Search, DollarSign, Calendar, Sliders, Printer, Loader2 } from 'lucide-react';

interface ReportsViewProps {
  reservas: Reserva[];
  usuarios: Usuario[];
  obras: Obra[];
  empresas: Empresa[];
  settings: SystemSettings;
  todayDate: string;
}

export default function ReportsView({ reservas, usuarios, obras, empresas, settings, todayDate }: ReportsViewProps) {
  const [reportType, setReportType] = useState<'diario' | 'mensal' | 'financeiro' | 'folha' | 'desconto' | 'empresa'>('diario');

  // Daily Filter
  const [filterDailyObra, setFilterDailyObra] = useState<string>('all');
  // Monthly search
  const [searchMonthlyUser, setSearchMonthlyUser] = useState('');

  // Helper: primeiro e ultimo dia do mes atual (baseado em todayDate)
  const getMonthStart = (ref: string) => {
    const [y, m] = ref.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-01`;
  };
  const getMonthEnd = (ref: string) => {
    const [y, m] = ref.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  // Financial Filters
  const [finStart, setFinStart] = useState(getMonthStart(todayDate));
  const [finEnd, setFinEnd] = useState(getMonthEnd(todayDate));
  const [filterFinObra, setFilterFinObra] = useState<string>('all');
  const [filterFinEmpresa, setFilterFinEmpresa] = useState<string>('all');

  // Print list filters
  const [folhaDate, setFolhaDate] = useState<string>(todayDate);
  const [folhaObraId, setFolhaObraId] = useState<string>('all');

  // Desconto em Folha monthly report Filters
  const [filterDescontoEmpresa, setFilterDescontoEmpresa] = useState<string>('all');
  const [descontoStart, setDescontoStart] = useState(getMonthStart(todayDate));
  const [descontoEnd, setDescontoEnd] = useState(getMonthEnd(todayDate));

  // Report by Company and Period Filters
  const [empresaStart, setEmpresaStart] = useState(getMonthStart(todayDate));
  const [empresaEnd, setEmpresaEnd] = useState(getMonthEnd(todayDate));
  const [filterEmpresaObra, setFilterEmpresaObra] = useState<string>('all');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

  const handleDownloadPdf = async (elementId: string, filename: string) => {
    setIsGeneratingPdf(elementId);
    try {
      // @ts-ignore
      const { default: jsPDF } = await import('https://esm.sh/jspdf@2.5.1');

      const element = document.getElementById(elementId);
      if (!element) {
        alert('Não foi possível localizar o conteúdo do relatório para geração do PDF.');
        return;
      }

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.zIndex = '-9999';
      container.style.top = '0';
      container.style.width = '780px';
      container.style.padding = '24px';
      container.style.background = '#ffffff';
      container.style.color = '#1f2937';
      container.style.fontFamily = 'Arial, sans-serif';

      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = '100%';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      container.appendChild(clone);

      document.body.appendChild(container);

      const doc = new jsPDF('p', 'pt', 'a4');
      await doc.html(container, {
        margin: [24, 24, 24, 24],
        autoPaging: 'slice',
        width: 547,
        windowWidth: 780,
        callback: (pdf: any) => {
          pdf.save(`${filename}.pdf`);
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        },
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao processar PDF diretamente. Tentando acionar a tela de impressão corporativa...');
      handlePrintReport(elementId, filename);
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  const handlePrintReport = (elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
      window.focus();
      window.print();
      return;
    }

    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
              * { box-sizing: border-box; }
              body {
                font-family: Arial, Helvetica, sans-serif;
                color: #111827;
                background-color: #ffffff;
                padding: 20px;
                margin: 0;
                line-height: 1.4;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid #d1d5db;
                padding: 6px 8px;
              }
              .no-print { display: none !important; }
              @page {
                size: A4 portrait;
                margin: 1.2cm 1cm;
              }
            </style>
          </head>
          <body>
            ${element.outerHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 300);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        window.focus();
        window.print();
      }
    } catch (e) {
      console.error('Erro ao abrir janela de impressão:', e);
      window.focus();
      window.print();
    }
  };

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
    const activeColabs = usuarios.filter(u =>
      (u.perfil === 'colaborador' || u.perfil === 'admin') &&
      u.status !== 'pendente' &&
      (u.status !== 'excluido' || reservas.some(r => r.idUsuario === u.id && r.data === reportDate && r.status === ReservaStatus.Reservado))
    );

    const colabRows = activeColabs.map(user => {
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
    });

    // Append extra visitor lunches launched by Admin/RH
    const visitors = reservas.filter(r => r.data === reportDate && r.status === ReservaStatus.Reservado && r.idUsuario.startsWith('visitante-'));
    const visitorRows = visitors.map(res => {
      const oId = res.idObraNoDia;
      const obra = getObra(oId);
      const custo = getMealPrice(undefined, oId);
      return {
        id: res.id,
        nome: res.nomeVisitante || 'Visitante/Cortesia',
        matricula: 'VISITANTE',
        obraId: oId,
        obraNome: obra ? obra.nome : 'Sede Fontana',
        centroCusto: obra ? obra.centroCusto : 'CC SGR',
        empresaNome: res.empresaFaturamento || 'Visitante / Cortesia',
        reservou: '🟢 Sim',
        consumido: 'Sim (Cortesia)',
        alterado: res.alteradoEm ? new Date(res.alteradoEm).toLocaleTimeString('pt-BR') : 'S/R',
        custo
      };
    });

    const allRows = [...colabRows, ...visitorRows];

    return allRows.filter(row => {
      if (filterDailyObra !== 'all' && row.obraId !== filterDailyObra) return false;
      return true;
    });
  };

  // 2. MONTHLY REPORT (Aggregates dynamically based on selected/current month)
  const getMonthlyRows = () => {
    const currentMonthPrefix = todayDate.substring(0, 7); // e.g. "2026-06"
    const monthlyReservas = reservas.filter(r => r.data.startsWith(currentMonthPrefix));
    const activeColabs = usuarios.filter(u =>
      (u.perfil === 'colaborador' || u.perfil === 'admin') &&
      (u.status !== 'excluido' || monthlyReservas.some(r => r.idUsuario === u.id))
    );

    const aggregated = activeColabs.map(user => {
      const userRes = monthlyReservas.filter(r => r.idUsuario === user.id);

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
    });

    // Aggregate visitors in active month
    const visitors = monthlyReservas.filter(r => r.idUsuario.startsWith('visitante-') && r.status === ReservaStatus.Reservado);
    const visitorGroups: Record<string, { nome: string; obraNome: string; empresaNome: string; reservadas: number; utilizadas: number; canceladas: number }> = {};

    visitors.forEach(v => {
      const vName = v.nomeVisitante || 'Visitante/Cortesia';
      const vEmp = v.empresaFaturamento || 'Visitante / Cortesia';
      const key = `${vName}-${vEmp}`;
      const oId = v.idObraNoDia;
      const oObj = getObra(oId);
      if (!visitorGroups[key]) {
        visitorGroups[key] = {
          nome: vName,
          obraNome: oObj ? oObj.nome : 'Sede Fontana',
          empresaNome: vEmp,
          reservadas: 0,
          utilizadas: 0,
          canceladas: 0
        };
      }
      visitorGroups[key].reservadas += 1;
      visitorGroups[key].utilizadas += 1;
    });

    const visitorRows = Object.values(visitorGroups).map((item, idx) => ({
      id: 'visitor-monthly-' + idx,
      matricula: 'VISITANTE',
      ...item
    }));

    const allRows = [...aggregated, ...visitorRows];

    return allRows.filter(row => {
      if (searchMonthlyUser) {
        return row.nome.toLowerCase().includes(searchMonthlyUser.toLowerCase()) || row.matricula.toLowerCase().includes(searchMonthlyUser.toLowerCase());
      }
      return true;
    });
  };

  // 3. FINANCIAL REPORT (Based on period and price models)
  const getFinancialRows = () => {
    // Filter reservas by date range
    const filteredReservations = reservas.filter(r => {
      const insideDate = r.data >= finStart && r.data <= finEnd;
      if (!insideDate) return false;

      const user = getUsuario(r.idUsuario);
      const isVisitor = r.idUsuario.startsWith('visitante-');
      if (!user && !isVisitor) return false;

      if (filterFinObra !== 'all' && r.idObraNoDia !== filterFinObra) {
        if (r.idObraNoDia) {
          if (r.idObraNoDia !== filterFinObra) return false;
        } else if (user && user.idObraPadrao !== filterFinObra) {
          return false;
        }
      }
      if (filterFinEmpresa !== 'all') {
        if (isVisitor) {
          return false;
        } else if (user && user.idEmpresa !== filterFinEmpresa) {
          return false;
        }
      }

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
      // Keep excluded (soft-deleted) users only if they have reservations in the selected range
      if ((u.status as string) === 'excluido' || (u.status as any) === UserStatus.Excluido) {
        const hasRes = activeReservations.some(r => r.idUsuario === u.id);
        if (!hasRes) return false;
      }
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
      const isVisitor = res.idUsuario.startsWith('visitante-');
      const oId = res.idObraNoDia || (user ? user.idObraPadrao : 'other');
      const oObj = getObra(oId);
      const eObj = user ? getEmpresa(user.idEmpresa) : null;

      return {
        id: res.id,
        nome: isVisitor ? (res.nomeVisitante || 'Visitante/Cortesia') : (user ? user.nome : 'Ex-colaborador'),
        matricula: isVisitor ? 'VISITANTE' : (user ? user.matricula : 'S/M'),
        obraId: oId,
        obraNome: oObj ? oObj.nome : 'Administrativo Sede',
        empresaNome: isVisitor ? (res.empresaFaturamento || 'Visitante / Cortesia') : (eObj ? eObj.nome : 'Fontana'),
      };
    });

    const filtered = rows.filter(row => {
      if (folhaObraId !== 'all' && row.obraId !== folhaObraId) return false;
      return true;
    });

    filtered.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return filtered;
  };

  const getEmpresaReportRows = () => {
    // Filter active reservations in the selected period that are Reserved
    const activeReservations = reservas.filter(
      r => r.data >= empresaStart && r.data <= empresaEnd && r.status === ReservaStatus.Reservado
    );

    const companyMap: Record<string, {
      id: string;
      nome: string;
      tipo: string;
      quantidadeReservas: number;
      quantidadeConsumidas: number;
    }> = {};

    activeReservations.forEach(r => {
      const user = getUsuario(r.idUsuario);
      const isVisitor = r.idUsuario.startsWith('visitante-');
      const oId = r.idObraNoDia || (user ? user.idObraPadrao : 'other');

      // Filter by Obra
      if (filterEmpresaObra !== 'all' && oId !== filterEmpresaObra) {
        return;
      }

      let companyId = 'outros';
      let companyName = 'Não Informada / Outros';
      let companyType = 'Outros';

      if (isVisitor) {
        companyId = 'visitante';
        companyName = 'Visitantes / Cortesia';
        companyType = 'Cortesia';
      } else if (user) {
        const eObj = getEmpresa(user.idEmpresa);
        if (eObj) {
          companyId = eObj.id;
          companyName = eObj.nome;
          companyType = eObj.tipo === 'Propria' ? 'Própria' : eObj.tipo === 'Terceirizada' ? 'Terceirizada' : 'Prestadora';
        }
      }

      if (!companyMap[companyId]) {
        companyMap[companyId] = {
          id: companyId,
          nome: companyName,
          tipo: companyType,
          quantidadeReservas: 0,
          quantidadeConsumidas: 0,
        };
      }

      companyMap[companyId].quantidadeReservas += 1;
      if (r.consumido || !settings.usarTabletRetirada) {
        companyMap[companyId].quantidadeConsumidas += 1;
      }
    });

    // Also make sure all registered companies are visible with 0 if there are no bookings,
    // only if the filter by Obra is 'all'.
    if (filterEmpresaObra === 'all') {
      empresas.forEach(e => {
        if (!companyMap[e.id]) {
          companyMap[e.id] = {
            id: e.id,
            nome: e.nome,
            tipo: e.tipo === 'Propria' ? 'Própria' : e.tipo === 'Terceirizada' ? 'Terceirizada' : 'Prestadora',
            quantidadeReservas: 0,
            quantidadeConsumidas: 0,
          };
        }
      });
    }

    const rows = Object.values(companyMap);

    // Sort by reservations desc
    rows.sort((a, b) => b.quantidadeReservas - a.quantidadeReservas || a.nome.localeCompare(b.nome, 'pt-BR'));

    return rows;
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
        `"${r.nome}";"${r.matricula}";"${r.obraNome}";"${r.centroCusto}";"${r.empresaNome}";"${r.reservou}";"${r.consumido}";"${r.alterado}";${fNum(r.custo)}`
      ).join('\n');
      fn = `SGR-Relatorio-Diario-${reportDate}.csv`;
    } else if (reportType === 'mensal') {
      headers = 'Colaborador;Matrícula;Obra de Origem;Contrato / Empresa;Reservadas;Consumidas;Canceladas\n';
      const rows = getMonthlyRows();
      body = rows.map(r =>
        `"${r.nome}";"${r.matricula}";"${r.obraNome}";"${r.empresaNome}";${r.reservadas};${r.utilizadas};${r.canceladas}`
      ).join('\n');
      fn = 'SGR-Relatorio-Mensal-Consumo.csv';
    } else if (reportType === 'desconto') {
      headers = 'Matrícula;Nome do Colaborador;Empresa/Contrato;Quantidade de Reservas;Custo Total Empresa;Valor total de Desconto;Custo Líquido Empresa\n';
      const rows = getDescontoRows();
      body = rows.map(r =>
        `"${r.matricula}";"${r.nome}";"${r.empresaNome}";${r.quantidadeReservas};${fNum(r.custoCozinhaTotal)};${fNum(r.descontoTotalColaborador)};${fNum(r.custoLiquidoEmpresa)}`
      ).join('\n');
      const totalReservas = rows.reduce((acc, r) => acc + r.quantidadeReservas, 0);
      const totalEmpresa = rows.reduce((acc, r) => acc + r.custoCozinhaTotal, 0);
      const totalDesconto = rows.reduce((acc, r) => acc + r.descontoTotalColaborador, 0);
      const totalLiquido = rows.reduce((acc, r) => acc + r.custoLiquidoEmpresa, 0);
      body += `\n\n"TOTAL";"";"";${totalReservas};${fNum(totalEmpresa)};${fNum(totalDesconto)};${fNum(totalLiquido)}\n`;
      fn = `SGR-Relatorio-Descontos-Folha-${descontoStart}-a-${descontoEnd}.csv`;
    } else if (reportType === 'financeiro') {
      headers = 'Obra / Centro;Centro de Custo;Quantidade de Marmitas;Retirada Confirmada (FaceID);Custo Total Gasto\n';
      const rows = getFinancialRows();
      body = rows.map(r =>
        `"${r.obra}";"${r.cc}";${r.qtd};${r.consumidoQtd};${fNum(r.valorTotal)}`
      ).join('\n');
      body += `\n\n"TOTAL";"";${totalRefeicoesFinanceiro};"";${fNum(totalFinanceiro)}\n`;
      fn = `App-Restaurante-Relatorio-Financeiro-Custos.csv`;
    } else if (reportType === 'empresa') {
      const obraSel = filterEmpresaObra === 'all' ? 'Todas as Áreas' : (obras.find(o => o.id === filterEmpresaObra)?.nome || 'Outras');
      headers = `Relatório de Reservas por Empresa (Período: ${empresaStart} a ${empresaEnd} | Área/Obra: ${obraSel})\n\n`;
      headers += 'Empresa;Tipo de Contrato;Quantidade de Reservas;Quantidades Consumidas (Confirmadas);Percentual Consumo\n';
      const rows = getEmpresaReportRows();
      body = rows.map(r => {
        const pct = r.quantidadeReservas > 0 ? ((r.quantidadeConsumidas / r.quantidadeReservas) * 100).toFixed(1) + '%' : '0%';
        return `"${r.nome}";"${r.tipo}";${r.quantidadeReservas};${r.quantidadeConsumidas};"${pct}"`;
      }).join('\n');
      const totReservas = rows.reduce((acc, r) => acc + r.quantidadeReservas, 0);
      const totConsumidas = rows.reduce((acc, r) => acc + r.quantidadeConsumidas, 0);
      const pctGeral = totReservas > 0 ? ((totConsumidas / totReservas) * 100).toFixed(1) + '%' : '0%';
      body += `\n\n"TOTAL";"";${totReservas};${totConsumidas};"${pctGeral}"\n`;
      fn = `SGR-Relatorio-Reservas-por-Empresa-${empresaStart}-a-${empresaEnd}.csv`;
    } else {
      headers = 'Nº;Colaborador;Matrícula;Obra;Empresa\n';
      const rows = getFolhaRows();
      body = rows.map((r, i) => `"${i + 1}";"${r.nome}";"${r.matricula}";"${r.obraNome}";"${r.empresaNome}"`).join('\n');
      fn = `SGR-Relacao-Assinaturas-${folhaDate}.csv`;
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
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${reportType === 'diario'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
              }`}
            id="report-type-daily"
          >
            📊 Relatório Diário
          </button>

          <button
            onClick={() => setReportType('mensal')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${reportType === 'mensal'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
              }`}
            id="report-type-monthly"
          >
            🗓️ Absenteísmo & Mensal
          </button>

          <button
            onClick={() => setReportType('financeiro')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${reportType === 'financeiro'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
              }`}
            id="report-type-financial"
          >
            💰 Custos por Obra
          </button>

          <button
            onClick={() => setReportType('folha')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${reportType === 'folha'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
              }`}
            id="report-type-folha"
          >
            📋 Folha de Assinatura (Imprimir)
          </button>

          <button
            onClick={() => setReportType('desconto')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${reportType === 'desconto'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
              }`}
            id="report-type-desconto"
          >
            💸 Desconto em Folha (Assinatura)
          </button>

          <button
            onClick={() => setReportType('empresa')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${reportType === 'empresa'
                ? 'bg-neutral-900 text-white shadow'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300'
              }`}
            id="report-type-empresa"
          >
            🏢 Consumo por Empresa
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
                  <tr key={row.id} className="hover:bg-neutral-50 h-[16px]" style={{ height: '16px' }}>
                    <td className="p-0.5 px-3 h-[16px] text-xs">
                      <div className="flex gap-1.5 items-center">
                        <span className="font-bold text-neutral-800 text-[11px]">{row.nome}</span>
                        <span className="text-[9px] text-neutral-400 font-mono font-medium">(Reg: {row.matricula})</span>
                      </div>
                    </td>
                    <td className="p-0.5 px-3 font-semibold text-neutral-600 text-[11px] h-[16px]">{row.empresaNome}</td>
                    <td className="p-0.5 px-3 text-neutral-700 text-[11px] h-[16px]">{row.obraNome}</td>
                    <td className="p-0.5 px-3 font-mono text-[9px] font-bold text-neutral-500 h-[16px]">{row.centroCusto}</td>
                    <td className="p-0.5 px-3 text-center font-bold text-[10px] h-[16px]">{row.reservou}</td>
                    <td className="p-0.5 px-3 text-neutral-450 text-[9px] font-mono h-[16px]">{row.alterado}</td>
                    <td className="p-0.5 px-3 h-[16px]">
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold font-mono border ${row.consumido.includes('Sim')
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
                  <tr key={row.id} className="hover:bg-neutral-50 h-[16px]" style={{ height: '16px' }}>
                    <td className="p-0.5 px-3 font-bold text-neutral-800 text-[11px] h-[16px]">{row.nome}</td>
                    <td className="p-0.5 px-3 font-mono font-medium text-[10px] h-[16px]">{row.matricula}</td>
                    <td className="p-0.5 px-3 text-[11px] h-[16px]">{row.obraNome}</td>
                    <td className="p-0.5 px-3 font-semibold text-neutral-500 text-[11px] h-[16px]">{row.empresaNome}</td>
                    <td className="p-0.5 px-3 text-center text-xs font-mono text-neutral-900 font-bold h-[16px]">{row.reservadas}</td>
                    <td className="p-0.5 px-3 text-center text-xs font-mono text-emerald-700 font-bold bg-emerald-50/10 h-[16px]">{row.utilizadas}</td>
                    <td className="p-0.5 px-3 text-center text-xs font-mono text-neutral-500 font-bold h-[16px]">{row.canceladas}</td>
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
                    <tr key={row.id} className="hover:bg-neutral-50 font-medium h-[16px]" style={{ height: '16px' }}>
                      <td className="p-0.5 px-3 font-bold text-neutral-800 text-[11px] h-[16px]">{row.obra}</td>
                      <td className="p-0.5 px-3 font-mono font-bold text-neutral-500 text-[10px] h-[16px]">{row.cc}</td>
                      <td className="p-0.5 px-3 text-center font-mono text-[11px] h-[16px]">{row.qtd}</td>
                      <td className="p-0.5 px-3 text-center font-mono text-neutral-500 text-[10px] h-[16px]">
                        {row.consumidoQtd} de {row.qtd} {settings.usarTabletRetirada ? '(Facial)' : '(Lista)'}
                      </td>
                      <td className="p-0.5 px-3 text-right font-mono font-bold text-neutral-900 text-[11px] h-[16px]">
                        R$ {row.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-900 text-white font-bold h-[20px]" style={{ height: '20px' }}>
                    <td className="p-0.5 px-3 text-[11px]" colSpan={2}>SUBTOTAL TOTAL DE CONTRATOS DO GRUPO</td>
                    <td className="p-0.5 px-3 text-center font-mono text-[11px]">{totalRefeicoesFinanceiro}</td>
                    <td className="p-0.5 px-3 text-center font-mono text-neutral-300 text-[10px]">
                      Auditado
                    </td>
                    <td className="p-0.5 px-3 text-right font-mono text-emerald-400 text-[11px]">
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  type="button"
                  onClick={() => handleDownloadPdf('printable-sheet-area', `SGR_Folha_Assinatura_${folhaDate}`)}
                  disabled={isGeneratingPdf === 'printable-sheet-area'}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 duration-150 disabled:opacity-50 cursor-pointer"
                  id="trigger-download-folha-pdf-btn"
                >
                  {isGeneratingPdf === 'printable-sheet-area' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>Gerando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 shrink-0" />
                      <span>Baixar PDF</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handlePrintReport('printable-sheet-area', 'Folha de Assinatura - Fontana')}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 duration-150 cursor-pointer"
                  id="trigger-print-cmd-btn"
                >
                  <Printer className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Imprimir Documento</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-medium text-neutral-700 leading-normal">
                💡 <strong>Download & Impressão:</strong> Clique em <strong>Baixar PDF</strong> para salvar o arquivo digital diretamente no seu dispositivo, ou em <strong>Imprimir Documento</strong> para acionar a impressão em papel.
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
                        <tr key={row.id} className="h-[26px] text-neutral-950 font-medium font-sans hover:bg-neutral-50/50" style={{ height: '26px' }}>
                          <td className="p-1 align-middle border-r border-neutral-350 text-center font-bold font-mono bg-neutral-50 text-[11px] h-[26px]">{index + 1}</td>
                          <td className="p-1 px-2 align-middle border-r border-neutral-350 font-bold text-[11px] h-[26px] truncate max-w-[200px]">{row.nome}</td>
                          <td className="p-0 px-2 align-middle pr-4 h-[26px]">
                            <div className="w-full border-b border-dashed border-neutral-400 mt-[11px] h-0"></div>
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
                SGR - APP AUTOMAÇÃO DE RESTAURANTE FONTANA -- IMPRESSO EM {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                  type="button"
                  onClick={() => handleDownloadPdf('payroll-printable-sheet-area', `SGR_Desconto_Folha_${descontoStart}_a_${descontoEnd}`)}
                  disabled={isGeneratingPdf === 'payroll-printable-sheet-area'}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 duration-150 disabled:opacity-50 cursor-pointer"
                  id="trigger-download-desconto-pdf-btn"
                >
                  {isGeneratingPdf === 'payroll-printable-sheet-area' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>Gerando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 shrink-0" />
                      <span>Baixar PDF</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handlePrintReport('payroll-printable-sheet-area', 'Relatório de Desconto em Folha - Fontana')}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 duration-150 cursor-pointer"
                  id="trigger-desconto-print-btn"
                >
                  <Printer className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Imprimir Documento</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-medium text-neutral-700 leading-normal">
                💡 <strong>Relatório para Assinatura e Desconto:</strong> Baixe o arquivo PDF diretamente para arquivamento digital ou acione a impressão em papel para coleta física de assinaturas.
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
                        <tr key={row.id} className="h-[26px] text-neutral-950 font-medium font-sans" style={{ height: '26px' }}>
                          <td className="p-1 align-middle border-r border-neutral-350 text-center font-bold font-mono bg-neutral-50 text-[11px] h-[26px]">{index + 1}</td>
                          <td className="p-1 px-2 align-middle border-r border-neutral-350 font-mono font-bold text-neutral-800 tracking-tight text-[11px] h-[26px]">{row.matricula}</td>
                          <td className="p-1 px-2 align-middle border-r border-neutral-350 font-bold text-[11px] uppercase h-[26px] truncate max-w-[150px]">{row.nome}</td>
                          <td className="p-1 align-middle border-r border-neutral-350 text-center font-mono font-extrabold text-[11px] text-neutral-800 h-[26px]">{row.quantidadeReservas}</td>
                          <td className="p-1 px-2 align-middle border-r border-neutral-350 text-right font-mono text-[11px] text-neutral-600 h-[26px]">R$ {row.custoCozinhaTotal.toFixed(2)}</td>
                          <td className="p-1 px-2 align-middle border-r border-neutral-350 text-right font-mono font-bold text-emerald-800 text-[11px] h-[26px]">R$ {row.descontoTotalColaborador.toFixed(2)}</td>
                          <td className="p-0 px-2 align-middle h-[26px]">
                            <div className="w-full border-b border-dashed border-neutral-950 mt-[11px] h-0"></div>
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

      {/* Report by Company and Period */}
      {reportType === 'empresa' && (
        <div className="space-y-4" id="company-report-box">
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-widest text-[11px] font-mono">Filtros de Período e Área / Obra</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-black mb-1">Período Inicial</label>
                <input
                  type="date"
                  value={empresaStart}
                  onChange={(e) => setEmpresaStart(e.target.value)}
                  className="w-full text-xs font-mono border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="empresa-range-start"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-black mb-1">Período Final</label>
                <input
                  type="date"
                  value={empresaEnd}
                  onChange={(e) => setEmpresaEnd(e.target.value)}
                  className="w-full text-xs font-mono border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="empresa-range-end"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-black mb-1">Filtrar por Área / Obra</label>
                <select
                  value={filterEmpresaObra}
                  onChange={(e) => setFilterEmpresaObra(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  id="empresa-obra-select"
                >
                  <option value="all">Todas as Áreas / Obras (Filtro)</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600">
              💡 <strong>Relatório Executivo de Reservas por Empresa:</strong> Consolida a soma de refeições reservadas, refeições confirmadas e taxas de adesão por parceiro e frente de trabalho no período selecionado.
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Consumo Consolidado</h3>
                <p className="text-xs text-neutral-500">Valores agrupados por empresa de {new Date(empresaStart + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(empresaEnd + 'T00:00:00').toLocaleDateString('pt-BR')}.</p>
              </div>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs bg-white">
                <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Nome da Empresa</th>
                    <th className="p-3">Tipo de Contrato</th>
                    <th className="p-3 text-center">Quantidade de Reservas</th>
                    <th className="p-3 text-center">Confirmadas (Auditadas)</th>
                    <th className="p-3 text-center">Aproveitamento / Presença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {getEmpresaReportRows().length > 0 ? (
                    getEmpresaReportRows().map((row) => {
                      const pct = row.quantidadeReservas > 0
                        ? (row.quantidadeConsumidas / row.quantidadeReservas * 100).toFixed(1)
                        : '0';
                      const pctNum = parseFloat(pct);

                      return (
                        <tr key={row.id} className="hover:bg-neutral-50 h-[16px]" style={{ height: '16px' }}>
                          <td className="p-0.5 px-3 h-[16px]">
                            <div className="font-bold text-neutral-800 text-[11px]">{row.nome}</div>
                          </td>
                          <td className="p-0.5 px-3 font-semibold text-neutral-500 text-[11px] h-[16px]">{row.tipo}</td>
                          <td className="p-0.5 px-3 text-center text-[11px] font-mono text-neutral-900 font-bold h-[16px]">{row.quantidadeReservas}</td>
                          <td className="p-0.5 px-3 text-center text-[11px] font-mono text-emerald-700 font-bold h-[16px]">{row.quantidadeConsumidas}</td>
                          <td className="p-0.5 px-3 text-center h-[16px]">
                            <span className={`px-1.5 rounded text-[8px] font-bold font-mono border ${pctNum >= 90 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                pctNum >= 75 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                  pctNum > 0 ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                    'bg-neutral-100 text-neutral-450 border-neutral-200'
                              }`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-8 text-center text-neutral-400 italic" colSpan={5}>
                        Nenhum consumo registrado neste período com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
                {getEmpresaReportRows().length > 0 && (
                  <tfoot>
                    <tr className="bg-neutral-50 border-t-2 border-neutral-200 font-bold font-mono text-[10px] text-neutral-900">
                      <td className="p-3 uppercase" colSpan={2}>Totais do Período:</td>
                      <td className="p-3 text-center text-sm font-extrabold text-neutral-950 font-mono">
                        {getEmpresaReportRows().reduce((acc, r) => acc + r.quantidadeReservas, 0)}
                      </td>
                      <td className="p-3 text-center text-sm font-extrabold text-emerald-800 font-mono">
                        {getEmpresaReportRows().reduce((acc, r) => acc + r.quantidadeConsumidas, 0)}
                      </td>
                      <td className="p-3 text-center font-bold text-neutral-800">
                        {(() => {
                          const totRes = getEmpresaReportRows().reduce((acc, r) => acc + r.quantidadeReservas, 0);
                          const totCons = getEmpresaReportRows().reduce((acc, r) => acc + r.quantidadeConsumidas, 0);
                          return totRes > 0 ? (totCons / totRes * 100).toFixed(1) + '%' : '0%';
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
