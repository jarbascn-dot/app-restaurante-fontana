/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Check, X, FileText, Building2, CheckCircle2, ChevronDown, ChevronUp, Printer, Download } from 'lucide-react';
import { Usuario } from '../types';

interface LgpdConsentModalProps {
  isOpen: boolean;
  currentUser: Usuario;
  onAccept: (ip: string) => void;
  onDecline: () => void;
}

// Complete, un-shrunk literal legal text of Construtora Fontana Privacy Policy (LGPD)
export const COMPROMISSO_LGPD_HTML = `
  <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 15px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">1. INTRODUÇÃO E ESCOPO DA PLATAFORMA SGR</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      Em estrita conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD) - Lei Federal nº 13.709/2018</strong>, a <strong>CONSTRUTORA FONTANA LTDA</strong>, por meio de seu departamento de Segurança da Informação, Tecnologia e Compliance, estabelece esta Diretiva e Política de Privacidade para regular as atividades de coleta, armazenamento, processamento e controle de dados pessoais tratados de forma eletrônica dentro do escopo do aplicativo <strong>SGR (Sistema de Gerenciamento de Refeitórios)</strong>.
    </p>
    <p style="margin-bottom: 15px; font-size: 11.5px; text-align: justify;">
      A plataforma SGR foi concebida para otimizar reservas ordinárias e recorrentes de refeições de colaboradores próprios ou terceirizados envolvidos nas atividades canteiristas da empresa, atuando diretamente no refeitório técnico, promovendo o combate sistemático ao desperdício socioambiental de suprimentos alimentares e garantindo uma distribuição idônea, transparente e auditável de custos corporativos indiretos entre as frentes de obras e suas respectivas prestadoras de serviço subcontratadas.
    </p>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">2. AGENTE CONTROLADOR E CANAL DE PRIVACIDADE DO ENCARREGADO (DPO)</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      Define-se, para todos os efeitos de governança corporativa, compliance legal e responsabilidade regulatória, como Controladora exclusiva das informações e dados de agendamentos tratados neste aplicativo:
    </p>
    <ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 15px; font-size: 11px; space-y: 5px;">
      <li style="margin-bottom: 4px;"><strong>Razão Social:</strong> CONSTRUTORA FONTANA LTDA, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>79.667.655/0001-78</strong>.</li>
      <li style="margin-bottom: 4px;"><strong>Endereço Físico Administrativo:</strong> Rua Domênico Sônego, 255 – Centro, Criciúma/SC - CEP 88.804-050.</li>
      <li style="margin-bottom: 4px;"><strong>Encarregado de Proteção de Dados (DPO):</strong> Setor de Compliance de Dados e Ouvidoria de Segurança, contatável e disponível diretamente por intermédio do endereço eletrônico corporativo oficial: <strong>dpo@estilofontana.com.br</strong>.</li>
    </ul>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">3. CATEGORIAS DE DADOS PESSOAIS TRATADOS NO SISTEMA</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      Para propiciar a funcionalidade legítima de refeições nos canteiros, prevenir potenciais fraudes cibernéticas de falsidade ideológica e garantir comprovação fiscal, recolhem-se e processam-se exclusivamente as seguintes categorias de dados:
    </p>
    <ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 15px; font-size: 11px;">
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Dados Cadastrais de Qualificação:</strong> Nome completo, número de CPF, e número de Matrícula administrativa funcional necessária para enquadramento operacional nos sistemas internos do ERP Sienge de gestão de obras.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Dados de Alocação Profissional:</strong> Perfil de usuário no sistema (Administrador, Gestor, Fornecedor ou Colaborador de Canteiro), Empresa de Enquadramento direto (propria ou prestadora parceira subcontratada) e o Canteiro de Obras padrão designado como frente física atual de atuação.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Histórico e Métricas de Alimentação:</strong> Datas e horários selecionados preliminarmente para agendamentos e cancelamentos de reservas, histórico retroativo de consumo de pratos, registros manuais de confirmação e status gerados (Consumido, Não Consumido, Reservado ou Excedente/Extra).</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Segurança e Biometria de Dispositivo Local (Se habilitada):</strong> Chave de acesso individual do aplicativo e, opcionalmente, o uso da api nativa de autenticação rápida por impressão digital ou reconhecimento facial do próprio aparelho celular do funcionário. Reiteramos formalmente que os dados característicos puramente biométricos residem em área de armazenamento isolada e segura do próprio aparelho celular do usuário (Keychain local/Keystore), não sendo enviados, armazenados ou visíveis em qualquer banco de dados remoto da Construtora Fontana.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Dados Eletrônicos de Rastreabilidade (Logs):</strong> Endereço IP ("Internet Protocol") da conexão à internet utilizada para concessão do consentimento e operações, identificador de dispositivo móvel, sistema operacional utilizado e carimbos de data/hora (timestamps GMT-3) para cada operação no aplicativo para fins estritos de trilha de auditoria civil.</li>
    </ul>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">4. DAS FINALIDADES COGENTES DO PROCESSAMENTO DE DADOS</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      Nenhum dado pessoal do funcionário é coletado ou de alguma forma armazenado se desprovido de uma finalidade explícita, transparente e amparada nas prerrogativas da LGPD. As finalidades compreendem listadas:
    </p>
    <ul style="list-style-type: decimal; margin-left: 20px; margin-bottom: 15px; font-size: 11px;">
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Logística Preventiva e Redução de Desperdício de Alimentos:</strong> O SGR Fontana fornece estimativas precisas em tempo real das refeições que serão consumidas nas frentes de canteiro. Esse cálculo sincronizado permite que a equipe de cozinha prepare a quantidade milimetrada apropriada de refeições, evitando o descarte desmedido e prejuízo socioambiental de alimentos.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Controle e Partilha Legal de Despesas:</strong> Os agendamentos possibilitam auditar e apurar adequadamente as despesas de alimentação decorrentes das atividades produtivas em canteiros de obras de subempreiteiras, gerando relatórios corporativos fidedignos para estorno financeiro de custos ou divisão operacional acordada.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Trilha de Auditoria e Defesa de Incidentes:</strong> Impedir duplicidades na retirada de almoço, registros fraudulentos e falsidades cadastrais de refeições que comprometam o caixa de benefícios de alimentação.</li>
    </ul>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">5. DO COMPARTILHAMENTO DE INFORMAÇÕES PESSOAIS</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      A Construtora Fontana adota políticas rigorosas para restrição de compartilhamento. Os dados do canteiro são compartilhados tão somente nas seguintes hipóteses permitidas em lei:
    </p>
    <ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 15px; font-size: 11px;">
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Empresas Cozinheiras e Operadoras Locais de Refeição:</strong> O pessoal encarregado no refeitório industrial possui acesso aos dados mínimos para validação física da retirada (Nome, Matrícula de Origem e Confirmação de Reserva para o Dia correspondente), viabilizando o fornecimento mecânico do prato.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Empresas Terceirizadas e Parceiros Empregadores:</strong> Os administradores de frentes terceirizadas que prestam serviços de mão de obra para a Construtora Fontana terão acesso restrito a relatórios e painéis dos agendamentos relativos unicamente aos seus empregados diretos para fins de fiscalização e contabilidade.</li>
      <li style="margin-bottom: 6px; text-align: justify;"><strong>Fins Fiscais, Regulatórios e Judiciais:</strong> Os dados de auditoria armazenados imutavelmente em banco de dados podem ser compartilhados com órgãos reguladores nacionais, sindicatos profissionais ou no cumprimento de liminar trabalhista que determine exibição de relatórios.</li>
    </ul>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">6. DO ARQUIVAMENTO, RETENÇÃO E DISPOSIÇÃO DE DESCARTE SEGURO</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      Os dados pessoais coletados permanecem armazenados ativamente nos computadores de servidores da Construtora Fontana enquanto perdurar o vínculo ativo, contrato de emprego ou de prestação de serviços do colaborador. No entanto, por razões de conformidade legal, após o término definitivo da relação contratual, o cadastro é resguardado de forma inativa em ambiente eletrônico restrito visando fins judiciais pelo período legal de prescrição trabalhista civil e tributária (notadamente o prazo de até 5 ou 10 anos). 
    </p>
    <p style="margin-bottom: 15px; font-size: 11.5px; text-align: justify;">
      Ao atingir o termo prescricional correspondente, a totalidade das referências diretas de identidade vinculando o usuário e os agendamentos é apagada de forma eletrônica segura e definitiva dos servidores, ou submetida a rotinas irreversíveis de anonimização matemática permanente na base para estudos logísticos demográficos internos.
    </p>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">7. DOS DIREITOS INDISPENSÁVEIS DOS TITULARES DE DADOS</h3>
    <p style="margin-bottom: 10px; font-size: 11.5px; text-align: justify;">
      De acordo com os ditames expressos contidos no <strong>Artigo 18 da Lei Federal nº 13.709/2018 (LGPD)</strong>, você possui total direito jurídico de solicitar a qualquer tempo na Fontana:
    </p>
    <ul style="list-style-type: square; margin-left: 20px; margin-bottom: 15px; font-size: 11px;">
      <li style="margin-bottom: 6px; text-align: justify;">Confirmação integral e transparente da existência de tratamento dos seus dadospessoais em nossos ativos;</li>
      <li style="margin-bottom: 6px; text-align: justify;">Acesso facilitado para visualização física e portabilidade de dados pessoais que lhe digam respeito armazenados na nuvem Fontana;</li>
      <li style="margin-bottom: 6px; text-align: justify;">Correção célere de dados incompletos, desatualizados ou errôneos no cadastro pessoal;</li>
      <li style="margin-bottom: 6px; text-align: justify;">Bloqueio ou eliminação de dados considerados desnecessários, obsoletos ou excessivos, se identificada alguma irregularidade no cumprimento da lei;</li>
      <li style="margin-bottom: 6px; text-align: justify;">Revogação formal do consentimento de coleta. Informamos cordialmente que a revogação do consentimento implicará necessariamente no encerramento compulsório de sua conta ativa no aplicativo SGR Fontana, obstando que agendamentos de benefícios alimentares no refeitório local sejam efetuados por via digital.</li>
    </ul>

    <h3 style="font-size: 14px; font-weight: bold; color: #047857; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase;">8. DOS PROTOCOLOS DE SEGURANÇA DA INFORMAÇÃO</h3>
    <p style="margin-bottom: 15px; font-size: 11.5px; text-align: justify;">
      A Construtora Fontana adota medidas cibernéticas sérias e padronizadas de segurança para conferir sigilo, inviolabilidade e proteção contra danos à integridade de seus dados da plataforma SGR:
    </p>
    <ul style="list-style-type: check; margin-left: 20px; margin-bottom: 15px; font-size: 11px;">
      <li style="margin-bottom: 6px; text-align: justify;">Todas as comunicações de rede e trânsito eletrônico são submetidas a barreira criptográfica rígida sob protocolo seguro HTTPS com certificado internacional atualizado.</li>
      <li style="margin-bottom: 6px; text-align: justify;">Configuração nativa de controle no banco de dados baseada em regras de segurança a nível de linha (Firestore Database Rules), o que impede matematicamente que outros funcionários visualizem ou tentem alterar reservas cadastradas do canteiro alheio sem estar devidamente logado.</li>
      <li style="margin-bottom: 6px; text-align: justify;">A integridade das trilhas de auditoria (Auditoria Logs) é garantida por regras robustas de escrita unicamente por inserção (append-only), impossibilitando fisicamente atualizações ou apagamentos retroativos maliciosos no painel operacional de monitoração do sistema.</li>
    </ul>
  </div>
`;

export default function LgpdConsentModal({
  isOpen,
  currentUser,
  onAccept,
  onDecline,
}: LgpdConsentModalProps) {
  const [checkedConsent, setCheckedConsent] = useState(false);
  const [showFullPolicy, setShowFullPolicy] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCheckedConsent(false);
      setShowFullPolicy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Generate simulated IP address
  const simulatedIp = "177.34." + Math.floor(Math.random() * 254) + "." + Math.floor(Math.random() * 254);

  const handleAcceptSubmit = () => {
    if (!checkedConsent) {
      alert("Por favor, marque a caixa confirmando que concorda com a Política de Privacidade.");
      return;
    }
    onAccept(simulatedIp);
  };

  /**
   * Safe and robust Print system for iframes.
   * Instead of printing the main iframe which gets severely truncated/cluttered,
   * it opens a clean, borderless printed paper layout and triggers printing from it.
   */
  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Política de Privacidade e Proteção de Dados (LGPD) - Construtora Fontana Ltda</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #1f2937;
              line-height: 1.5;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            .header-print {
              border-bottom: 2px solid #047857;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .company-title {
              font-size: 20px;
              font-weight: bold;
              color: #0c0a09;
              margin: 0;
            }
            .document-title {
              font-size: 14px;
              font-weight: bold;
              color: #047857;
              margin: 4px 0 0 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-print {
              font-size: 11px;
              color: #4b5563;
              background-color: #f3f4f6;
              padding: 12px;
              border-radius: 6px;
              margin-bottom: 20px;
              border: 1px solid #e5e7eb;
            }
            .meta-print table {
              width: 100%;
              border-collapse: collapse;
            }
            .meta-print td {
              padding: 4px 0;
              vertical-align: top;
            }
            h3 {
              font-size: 13px;
              color: #047857 !important;
              margin-top: 20px;
              margin-bottom: 6px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 3px;
              text-transform: uppercase;
            }
            p, ul, li {
              font-size: 11.5px;
              text-align: justify;
              margin-bottom: 8px;
            }
            ul {
              padding-left: 20px;
            }
            li {
              margin-bottom: 4px;
            }
            .footer-print {
              margin-top: 40px;
              border-top: 1px solid #d1d5db;
              padding-top: 12px;
              font-size: 9.5px;
              text-align: center;
              color: #9ca3af;
              font-family: monospace;
            }
            .action-bar-toast {
              position: fixed;
              top: 15px;
              left: 50%;
              transform: translateX(-50%);
              background-color: #111827;
              color: #ffffff;
              padding: 10px 24px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: bold;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              z-index: 99999;
            }
            @media print {
              .action-bar-toast {
                display: none;
              }
              body {
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="action-bar-toast">
            Pronto para Imprimir/Salvar em PDF. Pressione Ctrl+P se a janela da impressora não abrir automaticamente!
          </div>
          <div class="header-print">
            <h1 class="company-title">CONSTRUTORA FONTANA LTDA</h1>
            <h2 class="document-title">POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD) - SGR</h2>
          </div>
          <div class="meta-print">
            <table>
              <tr>
                <td style="width: 15%;"><strong>Titular:</strong></td>
                <td>${currentUser.nome}</td>
                <td style="width: 15%;"><strong>Matrícula:</strong></td>
                <td>${currentUser.matricula || 'Cadastro Pendente'}</td>
              </tr>
              <tr>
                <td><strong>E-mail/CPF:</strong></td>
                <td>${currentUser.email || currentUser.cpf || 'Não Informado'}</td>
                <td><strong>Perfil:</strong></td>
                <td>${currentUser.perfil.toUpperCase()}</td>
              </tr>
              <tr>
                <td><strong>Documento:</strong></td>
                <td>Versão 1.2 Oficial da Diretoria</td>
                <td><strong>Data Geração:</strong></td>
                <td>${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            </table>
          </div>
          
          ${COMPROMISSO_LGPD_HTML}

          <div class="footer-print">
            SGR FONTANA - REGISTRO DE AUDITORIA INTERNA CADASTRAL - IP SIMULADO DA SESSÃO: ${simulatedIp}
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert("O bloqueador de pop-ups do seu navegador impediu a abertura da tela de impressão corporativa. Por favor, libere os pop-ups para este site ou clique no botão 'Baixar Termo Seguro (.HTML)' para guardar o termo offline!");
    }
  };

  /**
   * Generates a fully formatted, beautiful standalone HTML file of the Privacy Policy.
   * This guarantees and resolves the problem of download failures within sandbox environments.
   * Double clicking this file offline results in an identical high-fidelity physical page.
   */
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();

    const formattedHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Termo de Consentimento e Privacidade (LGPD) - Construtora Fontana Ltda</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #374151;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f3f4f6;
          }
          .container {
            background-color: #ffffff;
            max-width: 800px;
            margin: 30px auto;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e5e7eb;
          }
          .header {
            border-bottom: 3px solid #059669;
            padding-bottom: 16px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .company-name {
            font-size: 22px;
            font-weight: 800;
            color: #111827;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .policy-badge {
            font-size: 10px;
            background-color: #059669;
            color: #ffffff;
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .document-subtitle {
            font-size: 13px;
            font-weight: 600;
            color: #4b5563;
            margin-top: 4px;
            margin-bottom: 0;
          }
          .user-metadata {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            color: #4b5563;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            font-size: 12px;
          }
          .user-metadata table {
            width: 100%;
            border-collapse: collapse;
          }
          .user-metadata td {
            padding: 6px 4px;
            vertical-align: top;
          }
          h3 {
            font-size: 14px;
            color: #059669;
            margin-top: 25px;
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          p, ul, li {
            font-size: 13.5px;
            text-align: justify;
            margin-top: 0;
            margin-bottom: 12px;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin-bottom: 6px;
          }
          .footer-section {
            margin-top: 50px;
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
            font-size: 11px;
            text-align: center;
            color: #9ca3af;
            font-family: monospace;
          }
          .print-tip {
            background-color: #ecfdf5;
            border: 1px dashed #10b981;
            color: #065f46;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            margin-top: 30px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h1 class="company-name">CONSTRUTORA FONTANA LTDA</h1>
              <p class="document-subtitle">SISTEMA SGR - POLÍTICA DE PRIVACIDADE E CONSENTIMENTO (LGPD)</p>
            </div>
            <span class="policy-badge">LGPD Oficial</span>
          </div>

          <div class="user-metadata">
            <table>
              <tr>
                <td style="width: 18%;"><strong>Titular do Termo:</strong></td>
                <td>${currentUser.nome}</td>
                <td style="width: 18%;"><strong>Matrícula Interna:</strong></td>
                <td>${currentUser.matricula || 'Solicitada/RH'}</td>
              </tr>
              <tr>
                <td><strong>E-mail/CPF:</strong></td>
                <td>${currentUser.email || currentUser.cpf || 'Não Informado'}</td>
                <td><strong>Perfil Conta:</strong></td>
                <td>${currentUser.perfil.toUpperCase()}</td>
              </tr>
              <tr>
                <td><strong>Validade:</strong></td>
                <td>Versão 1.2 da Controladoria</td>
                <td><strong>Gerado em:</strong></td>
                <td>${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            </table>
          </div>

          ${COMPROMISSO_LGPD_HTML}

          <div class="print-tip">
            💡 <strong>Dica de Impressão offline:</strong> Abra este arquivo a qualquer momento em seu celular ou computador e pressione <strong>Ctrl+P</strong> (ou vá nas opções do navegador) para salvar como <strong>PDF permanente</strong> ou realizar a impressão física!
          </div>

          <div class="footer-section">
            CONSTRUTORA FONTANA LTDA - SISTEMA SGR - CODIGO DE SEGURANÇA INTEGRADO: AUD-${currentUser.id}-${Math.floor(Math.random() * 900000 + 100000)}
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([formattedHtml], { type: 'text/html;charset=utf-8' });
    const fileUrl = URL.createObjectURL(blob);
    const linkElement = document.createElement('a');
    linkElement.href = fileUrl;
    linkElement.download = `SGR_Fontana_Politica_Privacidade_LGPD_${currentUser.matricula || currentUser.id}.html`;
    
    document.body.appendChild(linkElement);
    linkElement.click();
    
    // Cleanup
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(fileUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md transition-opacity animate-[fadeIn_0.2s_ease]" id="lgpd-consent-modal-overlay">
      
      {/* Container */}
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-300 overflow-hidden flex flex-col animate-[scaleIn_0.2s_cubic-bezier(0.16,1,0.3,1)] max-h-[92vh]">
        
        {/* Banner Institucional Fontana */}
        <div className="bg-neutral-950 text-white relative shrink-0">
          <div className="h-2 bg-gradient-to-r from-red-600 via-white to-sky-700 w-full"></div>
          <div className="px-6 py-4 flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg text-white shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 font-mono flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-red-500" /> CONSTRUTORA FONTANA LTDA
              </span>
              <h2 className="font-bold text-sm leading-tight text-neutral-100">
                Termos de Privacidade e Proteção de Dados (LGPD)
              </h2>
            </div>
          </div>
        </div>

        {/* Compact Consent Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 font-sans" id="lgpd-consent-content-area">
          <div className="text-xs text-neutral-700 leading-relaxed space-y-3">
            <p className="font-semibold text-neutral-900">
              Olá, {currentUser.nome}!
            </p>
            <p>
              Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</strong>, solicitamos seu consentimento para coletar e tratar os dados estritamente necessários para o funcionamento e auditoria do seu agendamento de refeições no <strong>SGR Fontana</strong>.
            </p>
            <p className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-[11px] text-neutral-600">
              ⚠️ Seus dados (nome, matrícula, obra, CPF e refeições confirmadas) serão utilizados <strong>exclusivamente</strong> para controle logístico da cozinha, evitando desperdício de alimentos.
            </p>
          </div>

          {/* Toggle Full Policy Section */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-100/50">
            <button
              type="button"
              onClick={() => setShowFullPolicy(!showFullPolicy)}
              className="w-full px-4 py-3 bg-white hover:bg-neutral-50 transition flex items-center justify-between text-xs font-bold text-neutral-800 border-b border-neutral-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 font-bold" />
                Visualizar Política de Privacidade Completa
              </span>
              {showFullPolicy ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
            </button>

            {showFullPolicy && (
              <div className="p-4 max-h-[20rem] overflow-y-auto bg-white border-t border-neutral-100 space-y-4">
                
                {/* Embedded Actions (Quick PDF & Print) */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 mb-2">
                  <div className="text-[10px] text-neutral-500 font-medium">
                    📄 Termo Oficial (Em conformidade com a LGPD)
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-[10px] text-neutral-700 font-bold rounded-md border border-neutral-300 transition duration-150 shadow-xs cursor-pointer"
                      title="Imprimir termo em uma nova janela limpa"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Imprimir</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] text-white font-bold rounded-md transition duration-150 shadow-xs cursor-pointer"
                      title="Baixar termo formatado em arquivo HTML"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Baixar (.HTML)</span>
                    </button>
                  </div>
                </div>

                {/* Literal Text Area */}
                <div 
                  className="prose prose-sm font-sans text-[11px] leading-relaxed text-neutral-700 select-text" 
                  dangerouslySetInnerHTML={{ __html: COMPROMISSO_LGPD_HTML }} 
                />

                <div className="pt-2 text-center border-t border-neutral-100">
                  <span className="text-[10px] text-neutral-400 font-mono">
                    IP Seguro da Seção: {simulatedIp} | DPO: dpo@estilofontana.com.br
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Consent Checkbox */}
          <label className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer select-none transition ${
            checkedConsent ? 'bg-emerald-50/50 border-emerald-300' : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}>
            <input 
              type="checkbox"
              id="lgpd-consent-checkbox"
              checked={checkedConsent}
              onChange={(e) => setCheckedConsent(e.target.checked)}
              className="mt-0.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 cursor-pointer shrink-0"
            />
            <span className="text-[11.5px] leading-snug text-neutral-700 font-medium">
              Concordo expressamente com o tratamento e a coleta dos meus dados necessários para o agendamento de refeições da Construtora Fontana de acordo com a LGPD.
            </span>
          </label>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-between items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDecline}
            className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 hover:text-neutral-950 rounded-xl font-bold text-xs transition cursor-pointer"
            id="lgpd-decline-btn"
          >
            Recusar e Sair
          </button>
          
          <button
            type="button"
            disabled={!checkedConsent}
            onClick={handleAcceptSubmit}
            className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 ${
              checkedConsent 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-[0.98]' 
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
            }`}
            id="lgpd-accept-btn"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Confirmar e Acessar SGR</span>
          </button>
        </div>

      </div>
    </div>
  );
}

