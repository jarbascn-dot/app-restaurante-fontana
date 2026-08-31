/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, FileText, Download, CheckCircle, AlertTriangle, HelpCircle, Clock, ShieldCheck, DollarSign, Calendar, User, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Usuario } from '../types';
import { generateManualPdf } from '../lib/generateManualPdf';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: Usuario;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      await generateManualPdf(currentUser);
    } catch (e) {
      console.error('Erro ao gerar PDF do manual:', e);
      alert('Erro ao gerar o arquivo PDF do manual.');
    } finally {
      setIsGenerating(false);
    }
  };

  const faqs = [
    {
      q: '1. Esqueci de agendar a refeição, posso almoçar assim mesmo?',
      a: 'A cozinha produz a quantidade exata agendada pelo SGR para evitar faltas ou desperdícios. Se você não agendou a tempo, consulte o RH ou encarregado para verificar se há autorização.',
    },
    {
      q: '2. Mudei de unidade (Administrativo / Obra), como atualizar meu local de refeição?',
      a: 'Sua unidade padrão (Administrativo ou Obra) é vinculada ao seu cadastro no SGR. Solicite ao RH para atualizar sua Unidade no sistema, garantindo que sua refeição e seu nome constem na lista impressa do refeitório correto.',
    },
    {
      q: '3. Onde consulto o valor que virá descontado na minha folha?',
      a: 'No app SGR, na tela "Agenda Colaborador", consulte o cartão "Resumos Gerais" e o cartão "Val. Unitário Refeição". Lá é exibido o total de reservas do mês e o valor simbólico a ser descontado em folha.',
    },
    {
      q: '4. Como alterar minha senha de acesso ou atualizar meus dados?',
      a: 'Clique no ícone de perfil no canto superior do aplicativo ou no menu de configurações para definir uma nova senha segura de acesso.',
    },
    {
      q: '5. Como obter uma cópia do meu Termo de Aceite de Privacidade (LGPD)?',
      a: 'No menu do seu perfil no app SGR, clique na opção "Ver Termo de Privacidade LGPD" para baixar o PDF assinado digitalmente com carimbo de data e hora.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200" id="manual-colaborador-modal-overlay">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden my-auto" id="manual-modal-container">
        
        {/* Header Modal */}
        <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800 shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/80 rounded-xl text-emerald-200 border border-emerald-700/60 shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-800 text-emerald-200 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded font-mono">
                  FONTANA
                </span>
                <span className="text-xs text-emerald-300 font-medium hidden sm:inline">
                  • Manual Prático SGR
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold leading-tight mt-0.5 text-white">
                Manual do Colaborador — Guia do Usuário
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="Baixar a versão oficial deste manual formatada em PDF"
              id="btn-modal-manual-download-top"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Baixar PDF do Manual</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800/80 rounded-xl transition cursor-pointer"
              title="Fechar visualização"
              id="btn-modal-manual-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 text-neutral-800">

          {/* User ID Banner if logged in */}
          {currentUser && (
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs font-medium text-neutral-700">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Colaborador: <strong className="text-neutral-900">{currentUser.nome}</strong></span>
              </div>
              <div className="flex items-center gap-4 text-neutral-600">
                <span>Matrícula: <strong className="text-neutral-900 font-mono">{currentUser.matricula || 'N/A'}</strong></span>
                <span>Data: <strong className="text-neutral-900 font-mono">{new Date().toLocaleDateString('pt-BR')}</strong></span>
              </div>
            </div>
          )}

          {/* SECTION 1: PASSO A PASSO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <h4 className="font-extrabold text-emerald-900 text-sm uppercase tracking-wide">
                1. Passo a Passo para Usar o Aplicativo
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Step 1 */}
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-2 relative">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                    Acessando sua Agenda
                  </h5>
                </div>
                <ul className="text-xs text-neutral-600 space-y-1.5 pl-1">
                  <li>• Abra o app SGR no celular ou computador.</li>
                  <li>• Na tela <strong>"Agenda Colaborador"</strong>, selecione o Mês e Ano no seletor do topo.</li>
                  <li>• Veja os dias disponíveis marcados no calendário.</li>
                  <li>• Você pode agendar o mês inteiro com apenas 1 clique!</li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-2 relative">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                    Reservando / Cancelando
                  </h5>
                </div>
                <ul className="text-xs text-neutral-600 space-y-1.5 pl-1">
                  <li>• Clique diretamente sobre o <strong>DIA</strong> para alternar seu status.</li>
                  <li>• Dia <strong>verde</strong> = Refeição confirmada.</li>
                  <li>• Para semanas completas, use o painel <strong>"Reserva por Período"</strong>.</li>
                  <li>• Lembre-se de respeitar o horário limite de corte (até às 8:30 do próprio dia, de seg. a sex.).</li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-2.5 relative">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                    Entendendo as Cores do Dia
                  </h5>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-900 font-medium">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
                    <span><strong>Verde:</strong> Refeição Reservada e Confirmada</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-rose-50 rounded-lg border border-rose-100 text-rose-900 font-medium">
                    <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0"></span>
                    <span><strong>Vermelho:</strong> Refeição Cancelada (Não haverá refeição)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-neutral-100 rounded-lg border border-neutral-200 text-neutral-700 font-medium">
                    <span className="w-3 h-3 rounded-full bg-neutral-400 shrink-0"></span>
                    <span><strong>Cinza:</strong> Bloqueado (Fim de semana, feriado ou dia passado)</span>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-2 relative">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    4
                  </span>
                  <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                    Presença e Assinatura no Refeitório
                  </h5>
                </div>
                <ul className="text-xs text-neutral-600 space-y-1.5 pl-1">
                  <li>• No horário do almoço, dirija-se ao <strong>refeitório</strong> (Administrativo / Obra).</li>
                  <li>• Localize seu nome na lista impressa diária de refeições agendadas.</li>
                  <li>• <strong>Assine a lista impressa</strong> ao retirar seu prato para confirmar sua presença.</li>
                  <li>• Tenha uma excelente refeição!</li>
                </ul>
              </div>

            </div>
          </div>

          {/* SECTION 2: TRANSPARÊNCIA DE CUSTOS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
              <DollarSign className="h-4 w-4 text-emerald-700" />
              <h4 className="font-extrabold text-neutral-900 text-sm uppercase tracking-wide">
                2. Transparência de Custos e Valor Unitário
              </h4>
            </div>
            <p className="text-xs text-neutral-600">
              No seu aplicativo SGR, você acompanha de forma transparente como é composto o valor de cada refeição servida no refeitório (Administrativo / Obra):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                <span className="font-black text-emerald-900 block text-xs">
                  🏢 PAGO PELA EMPRESA (Subsídio)
                </span>
                <p className="text-emerald-800 leading-relaxed">
                  A empresa custeia a maior parte do valor total da refeição diretamente com a fornecedora terceirizada.
                </p>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                <span className="font-black text-amber-900 block text-xs">
                  💳 DESCONTO COLABORADOR (Folha)
                </span>
                <p className="text-amber-800 leading-relaxed">
                  Apenas um pequeno valor simbólico é descontado em folha por cada refeição agendada e consumida no mês.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: REGRAS E HORÁRIOS LIMITE */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Clock className="h-4 w-4 text-emerald-700" />
              <h4 className="font-extrabold text-neutral-900 text-sm uppercase tracking-wide">
                3. Regras e Horários Limite (Prazos de Corte)
              </h4>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-800 font-bold border-b border-neutral-200">
                    <th className="p-2.5">Dia da Refeição</th>
                    <th className="p-2.5">Horário Limite de Reserva / Cancelamento</th>
                    <th className="p-2.5">Observação Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700">
                  <tr className="hover:bg-neutral-50/80">
                    <td className="p-2.5 font-bold text-neutral-900">Segunda a Sexta-feira</td>
                    <td className="p-2.5 font-bold text-emerald-700">Diariamente até às 8:30 do próprio dia</td>
                    <td className="p-2.5">Limite diário para reservar, alterar ou cancelar a refeição</td>
                  </tr>
                  <tr className="bg-neutral-50/50 hover:bg-neutral-50">
                    <td className="p-2.5 font-bold text-neutral-900">Sábados, Domingos e Feriados</td>
                    <td className="p-2.5 font-bold text-rose-700">Bloqueado para reservas (Sem expediente)</td>
                    <td className="p-2.5">Não há expediente na empresa (evita reservas acidentais). Em caso de necessidade, consulte o RH.</td>
                  </tr>
                  <tr className="hover:bg-neutral-50/80">
                    <td className="p-2.5 font-bold text-neutral-900">Férias / Atestado Médico</td>
                    <td className="p-2.5 font-bold text-emerald-700">Aviso prévio ao RH</td>
                    <td className="p-2.5">Cancelamento de reservas no sistema</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dica de Ouro */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-0.5">
                <span className="font-black uppercase tracking-wider block text-amber-950">
                  💡 Dica Importante para o Colaborador:
                </span>
                <p>
                  Evite surpresas! Ao saber que faltará ao trabalho ou fará refeição fora da empresa, cancele sua reserva antes das <strong>8:30 da manhã</strong>. Isso evita o desperdício de comida e garante que a refeição não seja faturada sem uso.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: PERGUNTAS FREQUENTES (FAQ) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
              <HelpCircle className="h-4 w-4 text-emerald-700" />
              <h4 className="font-extrabold text-neutral-900 text-sm uppercase tracking-wide">
                4. Perguntas Frequentes (FAQ do Colaborador)
              </h4>
            </div>

            <div className="space-y-2">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="border border-neutral-200 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-3.5 text-left bg-neutral-50 hover:bg-emerald-50/50 flex items-center justify-between gap-3 text-xs font-bold text-neutral-900 transition cursor-pointer"
                    >
                      <span className="text-emerald-950">{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-emerald-700 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="p-3.5 bg-white border-t border-neutral-200 text-xs text-neutral-600 leading-relaxed animate-in fade-in duration-150">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: SUPORTE & RH */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-700 text-white rounded-xl shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-bold text-emerald-950 text-xs">Dúvidas ou Suporte ao Colaborador</h5>
                <p className="text-xs text-emerald-800">
                  Procure o setor de Recursos Humanos (RH) da Construtora FONTANA para atendimento Administrativo ou Obra.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Modal Actions */}
        <div className="p-4 bg-white border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <span className="text-xs text-neutral-500 font-medium">
            SGR — Sistema de Gerenciamento de Refeitórios | FONTANA
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer"
              id="btn-modal-manual-close-footer"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              id="btn-modal-manual-download-footer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Baixar PDF do Manual</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManualModal;
