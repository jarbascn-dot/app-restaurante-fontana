/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Check, X, FileText, Building2, CheckCircle2, ChevronDown, ChevronUp, Download } from 'lucide-react';
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
   * Generates and downloads the Privacy Policy term as a PDF file directly.
   * Avoids opening any print window/dialog, which previously left the user
   * unable to close the window and resume navigation inside the app.
   */
  const handleDownloadPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    (async () => {
      try {
        const { default: jsPDF } = await import('https://esm.sh/jspdf@2.5.1');

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-99999px';
        container.style.top = '0';
        container.style.width = '760px';
        container.style.padding = '24px';
        container.style.background = '#ffffff';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#1f2937';
        container.innerHTML = `
          <div style="text-align:center; border-bottom:2px solid #047857; padding-bottom:12px; margin-bottom:16px;">
            <h1 style="font-size:16px; color:#047857; margin:0;">CONSTRUTORA FONTANA LTDA</h1>
            <h2 style="font-size:13px; margin:4px 0 0; color:#1f2937;">POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)</h2>
          </div>
          <table style="width:100%; font-size:11px; margin-bottom:16px; border-collapse: collapse;">
            <tr><td style="width:15%; padding:2px 0;"><strong>Titular:</strong></td><td>${currentUser.nome}</td></tr>
            <tr><td style="width:15%; padding:2px 0;"><strong>Matrícula:</strong></td><td>${currentUser.matricula || 'Cadastro Pendente'}</td></tr>
            <tr><td style="width:15%; padding:2px 0;"><strong>Data:</strong></td><td>${new Date().toLocaleString('pt-BR')}</td></tr>
            <tr><td style="width:15%; padding:2px 0;"><strong>IP Simulado:</strong></td><td>${simulatedIp}</td></tr>
          </table>
          ${COMPROMISSO_LGPD_HTML}
          <div style="margin-top:20px; font-size:9px; color:#6b7280; text-align:center; border-top:1px solid #e5e7eb; padding-top:8px;">
            SGR FONTANA - REGISTRO DE AUDITORIA INTERNA CADASTRAL - IP SIMULADO DA SESSÃO: ${simulatedIp}
          </div>
        `;
        document.body.appendChild(container);

        new jsPDF('p', 'pt', 'a4').html(container, {
          margin: [24, 24, 24, 24],
          autoPaging: 'text',
          width: 547,
          windowWidth: 760,
          callback: (doc: any) => {
            doc.save(`SGR_Fontana_Politica_Privacidade_LGPD_${currentUser.matricula || currentUser.id}.pdf`);
            document.body.removeChild(container);
          },
        });
      } catch (err) {
        console.error('Erro ao gerar o PDF da Política de Privacidade:', err);
        alert('Não foi possível gerar o PDF no momento. Por favor, tente novamente.');
      }
    })();
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
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] text-white font-bold rounded-md transition duration-150 shadow-xs cursor-pointer"
                      title="Baixar o termo em PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Baixar PDF</span>
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

