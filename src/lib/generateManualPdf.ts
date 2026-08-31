/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import { Usuario } from '../types';
import { downloadPdfOrFile } from './downloadHelper';

/**
 * Generates an infographic-style User Manual PDF ("Manual do Colaborador SGR")
 * for employees of FONTANA.
 * Uses native jsPDF layout with vector shapes, badges, and clean visual design.
 */
export async function generateManualPdf(currentUser?: Usuario): Promise<void> {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight; // 186mm
  const marginTop = 12;

  // Palette
  const emeraldPrimary: [number, number, number] = [4, 120, 87];   // #047857
  const emeraldDark: [number, number, number] = [6, 95, 70];      // #065f46
  const emeraldLight: [number, number, number] = [236, 253, 245]; // #ecfdf5
  const darkGray: [number, number, number] = [31, 41, 55];        // #1f2937
  const bodyGray: [number, number, number] = [55, 65, 81];        // #374151
  const mutedGray: [number, number, number] = [107, 114, 128];    // #6b7280
  const lightBg: [number, number, number] = [249, 250, 251];      // #f9fafb
  const amberBg: [number, number, number] = [254, 243, 199];      // #fef3c7
  const amberText: [number, number, number] = [146, 64, 14];       // #92400e
  const roseBg: [number, number, number] = [254, 226, 226];       // #fee2e2
  const roseText: [number, number, number] = [153, 27, 27];       // #991b1b

  let y = marginTop;

  // ==========================================
  // PAGE 1: INFOGRÁFICO GUIA DO COLABORADOR
  // ==========================================

  // --- Header Banner ---
  const bannerHeight = 25;
  doc.setFillColor(...emeraldPrimary);
  doc.roundedRect(marginLeft, y, contentWidth, bannerHeight, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('FONTANA', pageWidth / 2, y + 8, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MANUAL PRATICO DO COLABORADOR - SGR REFEITORIOS', pageWidth / 2, y + 14, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 250, 229);
  doc.text('Guia em formato infografico para reservas, refeicoes e acompanhamento de custos', pageWidth / 2, y + 19.5, { align: 'center' });

  y += bannerHeight + 4;

  // --- User Identification Box if available ---
  if (currentUser) {
    const userBoxH = 12;
    doc.setFillColor(...lightBg);
    doc.roundedRect(marginLeft, y, contentWidth, userBoxH, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft, y, contentWidth, userBoxH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkGray);

    // Left: Colaborador
    const colText = `Colaborador: ${currentUser.nome}`;
    doc.text(colText, marginLeft + 4, y + 7.5);

    // Center: Matrícula
    const matText = `Matricula: ${currentUser.matricula || 'N/A'}`;
    doc.text(matText, marginLeft + 115, y + 7.5);

    // Right: Emissão
    doc.setFont('helvetica', 'normal');
    const dateText = `Data: ${new Date().toLocaleDateString('pt-BR')}`;
    doc.text(dateText, marginLeft + contentWidth - 4, y + 7.5, { align: 'right' });

    y += userBoxH + 4;
  }

  // --- Section Title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...emeraldDark);
  doc.text('PASSO A PASSO PARA USAR O APLICATIVO', marginLeft, y);
  doc.setDrawColor(...emeraldPrimary);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y + 2, marginLeft + contentWidth, y + 2);

  y += 7;

  // --- Grid 2x2 of Steps ---
  const gapBetween = 5;
  const boxW = (contentWidth - gapBetween) / 2; // 90.5mm
  const boxH = 42;

  // Box 1: Passo 1
  let x1 = marginLeft;
  let y1 = y;

  doc.setFillColor(...lightBg);
  doc.roundedRect(x1, y1, boxW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.roundedRect(x1, y1, boxW, boxH, 2.5, 2.5, 'S');

  // Badge 1
  doc.setFillColor(...emeraldPrimary);
  doc.circle(x1 + 6, y1 + 6, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('1', x1 + 6, y1 + 7.2, { align: 'center' });

  doc.setTextColor(...emeraldDark);
  doc.setFontSize(9.5);
  doc.text('Acessando sua Agenda', x1 + 13, y1 + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...bodyGray);
  
  const step1Lines = [
    '• Abra o app SGR no celular ou computador.',
    '• Na tela "Agenda Colaborador", selecione',
    '  o Mes e Ano desejado no seletor do topo.',
    '• Veja os dias disponiveis no calendario.',
    '• Agende o mes inteiro com apenas 1 clique!'
  ];
  let curY = y1 + 13;
  step1Lines.forEach(line => {
    doc.text(line, x1 + 4, curY);
    curY += 5.5;
  });

  // Box 2: Passo 2
  let x2 = marginLeft + boxW + gapBetween;
  let y2 = y;

  doc.setFillColor(...lightBg);
  doc.roundedRect(x2, y2, boxW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(x2, y2, boxW, boxH, 2.5, 2.5, 'S');

  // Badge 2
  doc.setFillColor(...emeraldPrimary);
  doc.circle(x2 + 6, y2 + 6, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('2', x2 + 6, y2 + 7.2, { align: 'center' });

  doc.setTextColor(...emeraldDark);
  doc.setFontSize(9.5);
  doc.text('Reservando / Cancelando', x2 + 13, y2 + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...bodyGray);

  const step2Lines = [
    '• Clique sobre o DIA para alternar o status.',
    '• Dia verde = Refeicao confirmada.',
    '• Para semanas completas, use o botao',
    '  "Reservar Mes Inteiro" ou por periodo.',
    '• Respeite o horario limite de corte (ate as 8:30).'
  ];
  curY = y2 + 13;
  step2Lines.forEach(line => {
    doc.text(line, x2 + 4, curY);
    curY += 5.5;
  });

  y += boxH + 5;

  // Box 3: Passo 3
  y1 = y;

  doc.setFillColor(...lightBg);
  doc.roundedRect(x1, y1, boxW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(x1, y1, boxW, boxH, 2.5, 2.5, 'S');

  // Badge 3
  doc.setFillColor(...emeraldPrimary);
  doc.circle(x1 + 6, y1 + 6, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('3', x1 + 6, y1 + 7.2, { align: 'center' });

  doc.setTextColor(...emeraldDark);
  doc.setFontSize(9.5);
  doc.text('Entendendo as Cores do Dia', x1 + 13, y1 + 7);

  // Status visual samples inside box 3
  // Verde
  doc.setFillColor(...emeraldLight);
  doc.roundedRect(x1 + 4, y1 + 11.5, boxW - 8, 8, 1.5, 1.5, 'F');
  doc.setFillColor(...emeraldPrimary);
  doc.circle(x1 + 8, y1 + 15.5, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...emeraldDark);
  doc.text('Verde: Refeicao Reservada (Confirmada)', x1 + 12, y1 + 16);

  // Rosa/Vermelho
  doc.setFillColor(...roseBg);
  doc.roundedRect(x1 + 4, y1 + 21, boxW - 8, 8, 1.5, 1.5, 'F');
  doc.setFillColor(225, 29, 72);
  doc.circle(x1 + 8, y1 + 25, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...roseText);
  doc.text('Vermelho: Cancelado (Nao havera refeicao)', x1 + 12, y1 + 25.5);

  // Cinza
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(x1 + 4, y1 + 30.5, boxW - 8, 8, 1.5, 1.5, 'F');
  doc.setFillColor(156, 163, 175);
  doc.circle(x1 + 8, y1 + 34.5, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(75, 85, 99);
  doc.text('Cinza: Bloqueado (Fim de semana/feriado)', x1 + 12, y1 + 35);

  // Box 4: Passo 4
  y2 = y;

  doc.setFillColor(...lightBg);
  doc.roundedRect(x2, y2, boxW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(x2, y2, boxW, boxH, 2.5, 2.5, 'S');

  // Badge 4
  doc.setFillColor(...emeraldPrimary);
  doc.circle(x2 + 6, y2 + 6, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('4', x2 + 6, y2 + 7.2, { align: 'center' });

  doc.setTextColor(...emeraldDark);
  doc.setFontSize(9.5);
  doc.text('Presenca e Assinatura no Refeitorio', x2 + 13, y2 + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...bodyGray);

  const step4Lines = [
    '• No horario, dirija-se ao refeitorio (Adm/Obra).',
    '• Localize seu nome na lista impressa diaria.',
    '• Assine a lista ao retirar seu prato para',
    '  confirmar a presenca e retirada da refeicao.',
    '• Tenha uma excelente refeicao!'
  ];
  curY = y2 + 13;
  step4Lines.forEach(line => {
    doc.text(line, x2 + 4, curY);
    curY += 5.5;
  });

  y += boxH + 8;

  // --- SECTION: CARTÃO DE TRANSPARÊNCIA DE VALOR UNITÁRIO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...emeraldDark);
  doc.text('TRANSPARENCIA DE CUSTOS E VALOR UNITARIO DA REFEICAO', marginLeft, y);
  doc.setDrawColor(...emeraldPrimary);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y + 2, marginLeft + contentWidth, y + 2);

  y += 7;

  // Unit Price Card Box Illustration
  const cardBoxH = 38;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginLeft, y, contentWidth, cardBoxH, 3, 3, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(marginLeft, y, contentWidth, cardBoxH, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text('Cartao de Transparencia do Valor Unitario no seu Painel', marginLeft + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...bodyGray);
  doc.text('No seu aplicativo, voce acompanha como e composto o valor da refeicao no refeitorio (Administrativo / Obra):', marginLeft + 5, y + 11);

  // Sub-boxes inside Transparency Card
  const subCardW = (contentWidth - 16) / 2; // 85mm
  const subCardH = 19;
  
  // Left Sub-box: Empresa
  doc.setFillColor(...emeraldLight);
  doc.roundedRect(marginLeft + 5, y + 14, subCardW, subCardH, 2, 2, 'F');
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(marginLeft + 5, y + 14, subCardW, subCardH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...emeraldDark);
  doc.text('PAGO PELA EMPRESA (Subsidio)', marginLeft + 8, y + 19);
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.text('A empresa custeia a maior parte do valor total', marginLeft + 8, y + 24);
  doc.text('da refeicao diretamente com a fornecedora.', marginLeft + 8, y + 28.5);

  // Right Sub-box: Colaborador
  doc.setFillColor(...amberBg);
  doc.roundedRect(marginLeft + 11 + subCardW, y + 14, subCardW, subCardH, 2, 2, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(marginLeft + 11 + subCardW, y + 14, subCardW, subCardH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...amberText);
  doc.text('DESCONTO COLABORADOR (Folha)', marginLeft + 14 + subCardW, y + 19);
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.text('Apenas um pequeno valor simbolico e descontado', marginLeft + 14 + subCardW, y + 24);
  doc.text('em folha por cada refeicao agendada e consumida.', marginLeft + 14 + subCardW, y + 28.5);

  y += cardBoxH + 6;

  // --- Page 1 Footer ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedGray);
  doc.text('SGR - Sistema de Gerenciamento de Refeitorios | FONTANA', marginLeft, 288);
  doc.text('Pagina 1 de 2', pageWidth - marginRight, 288, { align: 'right' });


  // ==========================================
  // PAGE 2: REGRAS, HORÁRIOS DE CORTE E FAQ
  // ==========================================
  doc.addPage();
  y = marginTop;

  // Page 2 Header Banner
  doc.setFillColor(...emeraldPrimary);
  doc.roundedRect(marginLeft, y, contentWidth, 16, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('MANUAL DO COLABORADOR SGR - REGRAS, PRAZOS E DUVIDAS', pageWidth / 2, y + 7, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 250, 229);
  doc.text('Normas operacionais para garantia da qualidade e prevencao do desperdicio de alimentos', pageWidth / 2, y + 12.5, { align: 'center' });

  y += 21;

  // --- SECTION: HORÁRIOS LIMITE DE CORTE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...emeraldDark);
  doc.text('REGRAS E HORARIOS LIMITE PARA AGENDAMENTO E CANCELAMENTO', marginLeft, y);
  doc.setDrawColor(...emeraldPrimary);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y + 2, marginLeft + contentWidth, y + 2);

  y += 7;

  // Table Header
  doc.setFillColor(243, 244, 246);
  doc.rect(marginLeft, y, contentWidth, 7, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.rect(marginLeft, y, contentWidth, 7, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text('DIA DA REFEICAO', marginLeft + 4, y + 4.8);
  doc.text('HORARIO LIMITE DE RESERVA / CANCELAMENTO', marginLeft + 55, y + 4.8);
  doc.text('OBSERVACAO OPERACIONAL', marginLeft + 128, y + 4.8);

  y += 7;

  // Table Rows
  const rows = [
    {
      dia: 'Segunda a Sexta-feira',
      limite: 'Diariamente ate as 8:30 do dia',
      obs: 'Limite diario para reservar ou cancelar',
    },
    {
      dia: 'Sabados, Domingos e Feriados',
      limite: 'Bloqueado (Sem expediente)',
      obs: 'Evita reservas acidentais. Em caso especial: RH',
    },
    {
      dia: 'Ferias / Atestado Medico',
      limite: 'Aviso previo ao RH',
      obs: 'Cancelamento de reservas no sistema',
    },
  ];

  rows.forEach((r, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(marginLeft, y, contentWidth, 7, 'F');
    }
    doc.setDrawColor(229, 231, 235);
    doc.rect(marginLeft, y, contentWidth, 7, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...darkGray);
    doc.text(r.dia, marginLeft + 4, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...emeraldDark);
    doc.text(r.limite, marginLeft + 55, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...bodyGray);
    doc.text(r.obs, marginLeft + 128, y + 4.8);

    y += 7;
  });

  y += 5;

  // Highlight Box - Dica de Ouro
  const dicaH = 18;
  doc.setFillColor(...amberBg);
  doc.roundedRect(marginLeft, y, contentWidth, dicaH, 2, 2, 'F');
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(marginLeft, y, contentWidth, dicaH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...amberText);
  doc.text('DICA IMPORTANTE PARA O COLABORADOR:', marginLeft + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Evite surpresas! Ao saber que faltara ao trabalho ou fara refeicao fora, cancele sua reserva antes', marginLeft + 4, y + 10.5);
  doc.text('das 8:30 da manha. Isso evita o desperdicio de comida e garante que a refeicao nao seja faturada sem uso.', marginLeft + 4, y + 14.5);

  y += dicaH + 8;

  // --- SECTION: FAQ / PERGUNTAS FREQUENTES ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...emeraldDark);
  doc.text('PERGUNTAS FREQUENTES (FAQ DO COLABORADOR)', marginLeft, y);
  doc.setDrawColor(...emeraldPrimary);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y + 2, marginLeft + contentWidth, y + 2);

  y += 7;

  const faqs = [
    {
      q: '1. Esqueci de agendar a refeicao, posso almocar assim mesmo?',
      a: 'A cozinha produz a quantidade exata agendada pelo SGR para evitar faltas ou desperdicios. Se voce nao agendou, consulte o RH ou encarregado para verificar se ha autorizacao.',
    },
    {
      q: '2. Mudei de unidade (Administrativo / Obra), como atualizar meu local?',
      a: 'Sua unidade padrao (Administrativo ou Obra) e vinculada ao seu cadastro no SGR. Solicite ao RH para atualizar sua Unidade no sistema, garantindo que seu nome conste na lista impressa do refeitorio correto.',
    },
    {
      q: '3. Onde consulto o valor que vira descontado na minha folha?',
      a: 'No app SGR, na tela "Agenda Colaborador", consulte o cartao "Resumos Gerais" e o cartao "Val. Unitario Refeicao". La e exibido o total de reservas do mes e o valor simbolico a ser descontado em folha.',
    },
    {
      q: '4. Como alterar minha senha de acesso ou atualizar meus dados?',
      a: 'Clique no icone de perfil no canto superior do aplicativo ou no menu de configuracoes para definir uma nova senha segura de acesso.',
    },
    {
      q: '5. Como obter uma copia do meu Termo de Aceite de Privacidade (LGPD)?',
      a: 'No menu do seu perfil no app SGR, clique na opcao "Ver Termo de Privacidade LGPD" para baixar o PDF assinado digitalmente com carimbo de data e hora.',
    },
  ];

  faqs.forEach((faq) => {
    const boxH = 17;
    doc.setFillColor(...lightBg);
    doc.roundedRect(marginLeft, y, contentWidth, boxH, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(marginLeft, y, contentWidth, boxH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...emeraldDark);
    doc.text(faq.q, marginLeft + 4, y + 5.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(...bodyGray);
    const splitA = doc.splitTextToSize(faq.a, contentWidth - 8);
    doc.text(splitA, marginLeft + 4, y + 9.8);

    y += boxH + 3.5;
  });

  y += 2;

  // Sign-off / Support Box
  const supportH = 13;
  doc.setFillColor(...emeraldLight);
  doc.roundedRect(marginLeft, y, contentWidth, supportH, 2, 2, 'F');
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(marginLeft, y, contentWidth, supportH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...emeraldDark);
  doc.text('DUVIDAS OU SUPORTE?', marginLeft + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...bodyGray);
  doc.text('Procure o setor de Recursos Humanos (RH) da Construtora FONTANA para atendimento Administrativo ou Obra.', marginLeft + 4, y + 9.5);

  // --- Page 2 Footer ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedGray);
  doc.text('SGR - Sistema de Gerenciamento de Refeitorios | FONTANA', marginLeft, 288);
  doc.text('Pagina 2 de 2', pageWidth - marginRight, 288, { align: 'right' });

  // Output / Download
  const filename = `SGR_Manual_do_Colaborador_Fontana.pdf`;
  await downloadPdfOrFile({
    pdfDoc: doc,
    filename,
    title: 'Manual do Colaborador - SGR FONTANA',
  });
}
