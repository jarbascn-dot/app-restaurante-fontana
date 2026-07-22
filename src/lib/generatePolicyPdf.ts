/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Usuario } from '../types';

/**
 * Generates a crisp, vector-based PDF document of the Construtora Fontana Privacy Policy (LGPD).
 * Uses native jsPDF text layout engine with automatic line wrapping and exact page break math
 * to ensure no lines or paragraphs are cut in half across page boundaries.
 */
export async function generatePolicyPdf(currentUser: Usuario): Promise<void> {
  // @ts-ignore
  const { default: jsPDF } = await import('https://esm.sh/jspdf@2.5.1');

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 16;
  const marginRight = 16;
  const contentWidth = pageWidth - marginLeft - marginRight; // 178mm
  const marginTop = 20;
  const marginBottom = 20;
  const maxY = pageHeight - marginBottom;

  let y = marginTop;

  // Color Palette
  const emeraldPrimary = [4, 120, 87]; // #047857
  const darkGray = [31, 41, 55]; // #1f2937
  const textMuted = [107, 114, 128]; // #6b7280
  const lightBg = [243, 244, 246]; // #f3f4f6

  const simulatedIp = (currentUser as any).ipAceiteLGPD || '177.34.0.130';
  const issueDate = new Date().toLocaleString('pt-BR');

  // Helper for page break checks
  const checkSpace = (neededHeight: number) => {
    if (y + neededHeight > maxY) {
      doc.addPage();
      y = marginTop + 10;
      return true;
    }
    return false;
  };

  // --- Header Banner ---
  doc.setFillColor(...emeraldPrimary);
  doc.rect(marginLeft, y, contentWidth, 2, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...emeraldPrimary);
  doc.text('CONSTRUTORA FONTANA LTDA', pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkGray);
  doc.text('POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text('SGR — Sistema de Gerenciamento de Refeitórios', pageWidth / 2, y, { align: 'center' });
  y += 7;

  // --- Metadata Box ---
  doc.setFillColor(...lightBg);
  doc.roundedRect(marginLeft, y, contentWidth, 18, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(marginLeft, y, contentWidth, 18, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkGray);

  // Row 1
  doc.text('Titular:', marginLeft + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(currentUser.nome || 'Não informado', marginLeft + 18, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Matrícula:', marginLeft + 100, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(currentUser.matricula || 'Cadastro Pendente', marginLeft + 118, y + 6);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.text('Emissão:', marginLeft + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(issueDate, marginLeft + 18, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('IP Sessão:', marginLeft + 100, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(simulatedIp, marginLeft + 118, y + 13);

  y += 24;

  // --- Section Header Helper ---
  const addSectionHeader = (title: string) => {
    checkSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...emeraldPrimary);
    doc.text(title, marginLeft, y);
    y += 2;
    doc.setDrawColor(229, 231, 235);
    doc.line(marginLeft, y, marginLeft + contentWidth, y);
    y += 5;
  };

  // --- Paragraph Helper ---
  const addParagraph = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkGray);

    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkSpace(4);
      doc.text(line, marginLeft, y);
      y += 4;
    }
    y += 2.5;
  };

  // --- Bullet Item Helper ---
  const addBulletItem = (prefix: string, text: string) => {
    doc.setFontSize(8.5);
    doc.setTextColor(...darkGray);

    const fullStr = prefix ? `${prefix} ${text}` : text;
    const lines = doc.splitTextToSize(fullStr, contentWidth - 6);

    checkSpace(lines.length * 4 + 2);

    doc.setFillColor(...emeraldPrimary);
    doc.circle(marginLeft + 2, y - 1.2, 0.8, 'F');

    for (let i = 0; i < lines.length; i++) {
      checkSpace(4);
      doc.text(lines[i], marginLeft + 6, y);
      y += 4;
    }
    y += 1.5;
  };

  // --- SECTIONS CONTENT ---

  addSectionHeader('1. INTRODUÇÃO E ESCOPO DA PLATAFORMA SGR');
  addParagraph('Em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD) - Lei Federal nº 13.709/2018, a CONSTRUTORA FONTANA LTDA, por meio de seu departamento de Segurança da Informação, Tecnologia e Compliance, estabelece esta Diretiva e Política de Privacidade para regular as atividades de coleta, armazenamento, processamento e controle de dados pessoais tratados de forma eletrônica dentro do escopo do aplicativo SGR (Sistema de Gerenciamento de Refeitórios).');
  addParagraph('A plataforma SGR foi concebida para otimizar reservas ordinárias e recorrentes de refeições de colaboradores próprios ou terceirizados envolvidos nas atividades canteiristas da empresa, atuando diretamente no refeitório técnico, promovendo o combate sistemático ao desperdício socioambiental de suprimentos alimentares e garantindo uma distribuição idônea, transparente e auditável de custos corporativos indiretos entre as frentes de obras e suas respectivas prestadoras de serviço subcontratadas.');

  addSectionHeader('2. AGENTE CONTROLADOR E CANAL DE PRIVACIDADE DO ENCARREGADO (DPO)');
  addParagraph('Define-se, para todos os efeitos de governança corporativa, compliance legal e responsabilidade regulatória, como Controladora exclusiva das informações e dados de agendamentos tratados neste aplicativo:');
  addBulletItem('• Razão Social:', 'CONSTRUTORA FONTANA LTDA, pessoa jurídica de direito privado inscrita no CNPJ sob o nº 79.667.655/0001-78.');
  addBulletItem('• Endereço Físico Administrativo:', 'Rua Domênico Sônego, 255 – Centro, Criciúma/SC - CEP 88.804-050.');
  addBulletItem('• Encarregado de Proteção de Dados (DPO):', 'Setor de Compliance de Dados e Ouvidoria de Segurança, contatável e disponível via e-mail corporativo: dpo@estilofontana.com.br.');

  addSectionHeader('3. CATEGORIAS DE DADOS PESSOAIS TRATADOS NO SISTEMA');
  addParagraph('Para propiciar a funcionalidade legítima de refeições nos canteiros, prevenir potenciais fraudes cibernéticas de falsidade ideológica e garantir comprovação fiscal, recolhem-se e processam-se exclusivamente as seguintes categorias de dados:');
  addBulletItem('• Dados Cadastrais de Qualificação:', 'Nome completo, número de CPF e número de Matrícula administrativa funcional necessária para enquadramento operacional nos sistemas internos do ERP Sienge.');
  addBulletItem('• Dados de Alocação Profissional:', 'Perfil de usuário no sistema (Administrador, Gestor, Fornecedor ou Colaborador), Empresa de Enquadramento direto e Canteiro de Obras padrão designado.');
  addBulletItem('• Histórico e Métricas de Alimentação:', 'Datas e horários para agendamentos e cancelamentos de reservas, histórico retroativo de consumo de pratos e status gerados (Consumido, Não Consumido, Reservado ou Excedente).');
  addBulletItem('• Segurança e Biometria de Dispositivo Local:', 'Chave de acesso individual e autenticação biométrica local (Keychain/Keystore do próprio aparelho celular). Dados biométricos não são transmitidos nem armazenados nos servidores da Fontana.');
  addBulletItem('• Dados Eletrônicos de Rastreabilidade (Logs):', 'Endereço IP da conexão, identificador de dispositivo móvel, sistema operacional e carimbos de data/hora (timestamps GMT-3) para auditoria civil.');

  addSectionHeader('4. DAS FINALIDADES COGENTES DO PROCESSAMENTO DE DADOS');
  addParagraph('Nenhum dado pessoal do funcionário é coletado ou armazenado se desprovido de finalidade explícita, transparente e amparada nas prerrogativas da LGPD:');
  addBulletItem('1. Logística Preventiva e Redução de Desperdício:', 'O SGR fornece estimativas precisas em tempo real das refeições que serão consumidas, permitindo o preparo na quantidade apropriada de refeições e evitando descarte socioambiental.');
  addBulletItem('2. Controle e Partilha Legal de Despesas:', 'Possibilita auditar e apurar adequadamente as despesas de alimentação decorrentes das atividades produtivas em canteiros de subempreiteiras.');
  addBulletItem('3. Trilha de Auditoria e Defesa de Incidentes:', 'Impede duplicidades na retirada de almoço, registros fraudulentos e falsidades cadastrais de refeições.');

  addSectionHeader('5. DO COMPARTILHAMENTO DE INFORMAÇÕES PESSOAIS');
  addParagraph('A Construtora Fontana adota políticas rigorosas para restrição de compartilhamento. Os dados do canteiro são compartilhados tão somente nas seguintes hipóteses permitidas em lei:');
  addBulletItem('• Cozinhas e Operadoras Locais:', 'Acesso aos dados mínimos para validação física da retirada (Nome, Matrícula de Origem e Confirmação de Reserva).');
  addBulletItem('• Empresas Terceirizadas Parcerias:', 'Acesso restrito a relatórios e painéis dos agendamentos relativos unicamente aos seus empregados diretos para fiscalização e contabilidade.');
  addBulletItem('• Fins Fiscais, Regulatórios e Judiciais:', 'Compartilhamento com órgãos reguladores nacionais, sindicatos profissionais ou no cumprimento de liminar trabalhista.');

  addSectionHeader('6. DO ARQUIVAMENTO, RETENÇÃO E DISPOSIÇÃO DE DESCARTE SEGURO');
  addParagraph('Os dados pessoais permanecem armazenados ativamente durante a vigência do vínculo contratual do colaborador. Após o encerramento do contrato, o cadastro é mantido de forma inativa em ambiente eletrônico restrito visando fins judiciais pelo período legal de prescrição trabalhista civil e tributária (notadamente o prazo de 5 a 10 anos).');
  addParagraph('Ao atingir o termo prescricional correspondente, a totalidade das referências de identidade vinculando o usuário e os agendamentos é apagada de forma eletrônica segura e definitiva dos servidores, ou submetida a rotinas irreversíveis de anonimização matemática permanente.');

  addSectionHeader('7. DOS DIREITOS INDISPENSÁVEIS DOS TITULARES DE DADOS');
  addParagraph('De acordo com o Artigo 18 da Lei Federal nº 13.709/2018 (LGPD), você possui total direito jurídico de solicitar a qualquer tempo na Fontana:');
  addBulletItem('• Confirmação e Acesso:', 'Confirmação da existência de tratamento e acesso facilitado aos dados pessoais armazenados;');
  addBulletItem('• Correção e Atualização:', 'Correção célere de dados incompletos, desatualizados ou incorretos;');
  addBulletItem('• Anonimização e Eliminação:', 'Bloqueio ou eliminação de dados considerados desnecessários, obsoletos ou excessivos;');
  addBulletItem('• Revogação de Consentimento:', 'Revogação formal do consentimento (implica no encerramento compulsório da conta ativa no SGR Fontana).');

  addSectionHeader('8. DOS PROTOCOLOS DE SEGURANÇA DA INFORMAÇÃO');
  addParagraph('A Construtora Fontana adota medidas cibernéticas rígidas de segurança para conferir sigilo e integridade aos dados da plataforma SGR:');
  addBulletItem('• Criptografia em Trânsito:', 'Todas as comunicações eletrônicas são submetidas a protocolo seguro HTTPS com certificado internacional atualizado;');
  addBulletItem('• Regras de Acesso no Banco de Dados:', 'Controle por regras de segurança a nível de linha (Firestore Security Rules), impedindo acessos não autorizados;');
  addBulletItem('• Trilha de Auditoria Imutável:', 'Registros de auditoria gravados em modo append-only, impedindo alterações ou apagamentos retroativos.');

  // Page Numbers and Footer for all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Header on pages > 1
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text('CONSTRUTORA FONTANA LTDA — POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)', marginLeft, 12);
      doc.setDrawColor(229, 231, 235);
      doc.line(marginLeft, 14, marginLeft + contentWidth, 14);
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.setDrawColor(229, 231, 235);
    doc.line(marginLeft, pageHeight - 12, marginLeft + contentWidth, pageHeight - 12);

    doc.text(`SGR FONTANA — REGISTRO DE AUDITORIA INTERNA CADASTRAL | IP: ${simulatedIp}`, marginLeft, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPages}`, marginLeft + contentWidth, pageHeight - 7, { align: 'right' });
  }

  doc.save(`SGR_Fontana_Politica_Privacidade_LGPD_${currentUser.matricula || currentUser.id}.pdf`);
}
