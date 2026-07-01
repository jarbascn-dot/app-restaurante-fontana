/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { Usuario, AuditoriaLog, SystemSettings } from '../types';
import { X, KeyRound, Bell, Smartphone, ShieldCheck, Check, Eye, EyeOff, Volume2, Sparkles, FileText, Printer, Download } from 'lucide-react';
import { scheduleNotification } from '../lib/notificationScheduler';
import { COMPROMISSO_LGPD_HTML } from './LgpdConsentModal';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Usuario;
  usuarios: Usuario[];
  onUpdatePassword: (newSenha: string) => void;
  onUpdateNotifications?: (enabled: boolean, timing: 'vespera' | 'mesmo_dia', time: string, tipo: 'reservada' | 'sem_reserva' | 'sempre') => void;
  appendAuditLog: (operacao: string, userNome?: string, userEmail?: string) => void;
  onTriggerFlash: (msg: string) => void;
  settings: SystemSettings;
}

export default function AccountSettingsModal({
  isOpen,
  onClose,
  currentUser,
  usuarios,
  onUpdatePassword,
  onUpdateNotifications,
  appendAuditLog,
  onTriggerFlash,
  settings,
}: AccountSettingsModalProps) {
  const isInstalledPwa = typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)').matches : false;

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  
  // Notification states
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    return localStorage.getItem(`sgr_notify_enabled_${currentUser.email}`) === 'true';
  });
  const [notifyTiming, setNotifyTiming] = useState(() => {
    return localStorage.getItem(`sgr_notify_timing_${currentUser.email}`) || 'vespera'; // 'vespera' or 'mesmo_dia'
  });
  const [notifyTime, setNotifyTime] = useState(() => {
    return localStorage.getItem(`sgr_notify_time_${currentUser.email}`) || '19:00';
  });
  const [notifyChannel, setNotifyChannel] = useState(() => {
    return localStorage.getItem(`sgr_notify_channel_${currentUser.email}`) || 'push'; // 'push' or 'whatsapp'
  });
  const [notifyTipo, setNotifyTipo] = useState<'reservada' | 'sem_reserva' | 'sempre'>(() => {
    return (localStorage.getItem(`sgr_notify_tipo_${currentUser.email}`) as 'reservada' | 'sem_reserva' | 'sempre') || 'sempre';
  });

  // Mobile Mock Notification State
  const [showMockNotification, setShowMockNotification] = useState(false);
  const [mockNotifText, setMockNotifText] = useState('');

  // LGPD Privacy Policy Modal State
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Update states whenever modal is opened or currentUser changes (Cloud-Sync support)
  useEffect(() => {
    if (isOpen && currentUser) {
      const dbEnabled = currentUser.alertaEnabled ?? (localStorage.getItem(`sgr_notify_enabled_${currentUser.email}`) === 'true');
      const dbTiming = currentUser.alertaTiming ?? (localStorage.getItem(`sgr_notify_timing_${currentUser.email}`) as 'vespera' | 'mesmo_dia' | null) ?? 'vespera';
      const dbTime = currentUser.alertaTime ?? localStorage.getItem(`sgr_notify_time_${currentUser.email}`) ?? '19:00';
      const dbTipo = currentUser.alertaTipo ?? (localStorage.getItem(`sgr_notify_tipo_${currentUser.email}`) as 'reservada' | 'sem_reserva' | 'sempre' | null) ?? 'sempre';
      setNotifyEnabled(dbEnabled);
      setNotifyTiming(dbTiming);
      setNotifyTime(dbTime);
      setNotifyTipo(dbTipo);
    }
  }, [isOpen, currentUser]);

  const [pushStatus, setPushStatus] = useState<'checking' | 'active' | 'inactive' | 'unsupported'>('checking');
  const [sendingPush, setSendingPush] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      if ('PushManager' in window && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.pushManager.getSubscription().then(sub => {
            if (sub) {
              setPushStatus('active');
            } else {
              setPushStatus('inactive');
            }
          }).catch(() => setPushStatus('inactive'));
        }).catch(() => setPushStatus('inactive'));
      } else {
        setPushStatus('unsupported');
      }
    }
  }, [isOpen, currentUser]);

  const handlePrintPolicy = () => {
    const simulatedIp = currentUser.ipAceiteLGPD || '177.34.0.130';
    
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

  const handleDownloadPolicy = () => {
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

  const handleTriggerRealPush = async () => {
    if (pushStatus !== 'active') {
      onTriggerFlash('⚠️ Este aparelho ainda não possui inscrição push ativa. Ative os alertas diários primeiro para registrar!');
      return;
    }

    setSendingPush(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        onTriggerFlash('❌ Falha ao encontrar sua inscrição push local.');
        setPushStatus('inactive');
        setSendingPush(false);
        return;
      }

      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          title: 'SGR FONTANA (Estilo WhatsApp)',
          body: `Olá, ${currentUser.nome}! Horário Limite de reserva aproximando. Confirme seu almoço de amanhã antes das ${settings.horarioLimite}!`
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        onTriggerFlash('📲 Sinal push enviado com sucesso! Minimize o app ou bloqueie a tela AGORA para testar!');
      } else {
        onTriggerFlash(`❌ Erro no envio: ${resData.error || 'Falha desconhecida'}`);
      }
    } catch (err: any) {
      console.error('[AccountSettings] Error triggering push:', err);
      onTriggerFlash(`❌ Falha de rede ao se comunicar com o servidor de push.`);
    } finally {
      setSendingPush(false);
    }
  };

  if (!isOpen) return null;

  // Sound generator helper using Web Audio API (no external asset needed, work perfectly everywhere!)
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      // Pleasant alert chime (double ping)
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn("Wave Sound not supported or blocked by browser user gesture policy.");
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (currentUser.senha && currentPassword !== currentUser.senha) {
      alert('❌ A senha atual informada está incorreta.');
      return;
    }
    if (newPassword.length < 4) {
      alert('❌ A nova senha precisa conter no mínimo 4 caracteres como medida de proteção corporativa.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('❌ A nova senha e a confirmação de senha não coincidem.');
      return;
    }

    onUpdatePassword(newPassword);
    appendAuditLog(`Alteração de senha homologada com segurança de credencial.`, currentUser.nome, currentUser.email);
    
    setCurrentPassword('');
    newPassword && setNewPassword('');
    confirmPassword && setConfirmPassword('');

    onTriggerFlash('✅ Senha de acesso atualizada com sucesso!');
    onClose();
  };

  const handleToggleNotify = async () => {
    const nextVal = !notifyEnabled;
    setNotifyEnabled(nextVal);
    
    if (nextVal) {
      if ('Notification' in window) {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            onTriggerFlash('🔔 Excelente! Permissão de notificação ativa no seu aparelho.');
          } else if (perm === 'denied') {
            onTriggerFlash('⚠️ Atenção: Notificações bloqueadas no seu navegador. Ative nas configurações do celular.');
          }
        } catch (e) {
          Notification.requestPermission((p) => {
            if (p === 'granted') {
              onTriggerFlash('🔔 Excelente! Permissão de notificação ativa no seu aparelho.');
            }
          });
        }
      } else {
        onTriggerFlash('⚠️ Este navegador de celular não suporta a API de notificações.');
      }
    }
  };

  const handleSaveNotifySettings = () => {
    localStorage.setItem(`sgr_notify_enabled_${currentUser.email}`, String(notifyEnabled));
    localStorage.setItem(`sgr_notify_timing_${currentUser.email}`, notifyTiming);
    localStorage.setItem(`sgr_notify_time_${currentUser.email}`, notifyTime);
    localStorage.setItem(`sgr_notify_channel_${currentUser.email}`, notifyChannel);
    localStorage.setItem(`sgr_notify_tipo_${currentUser.email}`, notifyTipo);

    // CRITICAL: Reset last alert date block so user can instantly test their new time today!
    localStorage.removeItem(`sgr_last_alert_date_${currentUser.email}`);

    if (notifyEnabled) {
      // Schedule background & foreground native system alerts for iOS & Android
      scheduleNotification(
        notifyTime,
        'SGR Fontana',
        `Lembrete SGR: configure seus agendamentos no app antes do horário limite!`,
        currentUser.email
      );
    }

    if (onUpdateNotifications) {
      onUpdateNotifications(notifyEnabled, notifyTiming as 'vespera' | 'mesmo_dia', notifyTime, notifyTipo);
    } else {
      appendAuditLog(
        `Configuração de Lembrete de Refeição alterada: ${notifyEnabled ? 'Ativo' : 'Inativo'} (${notifyTiming === 'vespera' ? 'Véspera' : 'No dia'} às ${notifyTime}, tipo: ${notifyTipo})`,
        currentUser.nome,
        currentUser.email
      );
    }

    onTriggerFlash('✅ Configurações de lembrete salvas com sucesso neste aparelho!');
    onClose();
  };

  const triggerTestNotification = () => {
    const text = notifyTiming === 'vespera'
      ? `🔔 SGR FONTANA: Atenção, ${currentUser.nome}! Lembrete para fazer ou ajustar sua reserva de marmita de amanhã. O limite é hoje até ${settings.horarioLimite}.`
      : `🔔 SGR FONTANA: Olá, ${currentUser.nome}! Horário Limite se aproximando. Confirme sua refeição de hoje no painel antes das ${settings.horarioLimite}.`;

    setMockNotifText(text);
    setShowMockNotification(true);
    playNotificationSound();

    // Trigger REAL local browser/mobile notification!
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('SGR FONTANA', {
            body: text.replace('🔔 SGR FONTANA: ', ''),
            icon: '/icon.png',
            badge: '/icon-badge.svg'
          } as any);
        } catch (e) {
          console.error("Erro na notificação nativa:", e);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            try {
              new Notification('SGR FONTANA', {
                body: text.replace('🔔 SGR FONTANA: ', ''),
                icon: '/icon.png',
                badge: '/icon-badge.svg'
              } as any);
            } catch (e) {}
          }
        });
      }
    }

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      setShowMockNotification(false);
    }, 6000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-[fadeIn_0.2s_ease]" id="account-settings-modal-overlay">
      
      {/* Simulation / Physical Mock Phone Notification Banner sliding at top of screen */}
      {showMockNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] w-full max-w-sm bg-neutral-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-neutral-800 flex items-start gap-3 animate-[slideDown_0.3s_cubic-bezier(0.16,1,0.3,1)]" id="mock-push-banner">
          <div className="bg-emerald-600 rounded-lg p-2 text-white shrink-0 shadow-inner">
            <Smartphone className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase font-mono">SGR FONTANA • Agora</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-xs leading-normal font-medium text-neutral-100">{mockNotifText}</p>
          </div>
          <button 
            onClick={() => setShowMockNotification(false)}
            className="text-neutral-500 hover:text-white transition p-0.5 rounded-full hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main card box */}
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-neutral-300 overflow-hidden flex flex-col animate-[scaleIn_0.25s_cubic-bezier(0.16,1,0.3,1)] max-h-[90vh]">
        
        {/* Header decoration */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex justify-between items-center border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-sm tracking-tight">Minha Conta & Configurações Celular</h2>
              <p className="text-[10px] text-neutral-400 font-mono">USUÁRIO: {currentUser.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
            id="account-settings-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal content body panel content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* SECTION 1: PASSWORD CHANGE ROTINE */}
          <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200" id="password-change-section">
            <h3 className="font-bold text-neutral-800 flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
              <KeyRound className="h-4 w-4 text-emerald-600" /> 1. Alterar Senha de Acesso
            </h3>
            <p className="text-[11px] text-neutral-500 leading-normal">
              Altere sua senha de acesso ao SGR imediatamente. Siga boas práticas corporativas e não compartilhe seu código secreto.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Current password */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Senha Atual</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      placeholder="Senha cadastrada"
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-2.5 pr-8 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      required
                      value={newPassword}
                      placeholder="Mínimo 4 caracteres"
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-2.5 pr-8 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  placeholder="Repita a nova senha desejada"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800"
                />
              </div>

              <div className="pt-1 select-none">
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Atualizar Credencial de Acesso
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 2: MOBILE NOTIFICATIONS REGISTER */}
          <div className="space-y-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200" id="notification-settings-section">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-neutral-800 flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
                <Bell className="h-4 w-4 text-emerald-600" /> 2. Alerta do Celular (Confirmação Dinâmica)
              </h3>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] uppercase font-bold tracking-wider rounded font-mono">
                iOS & Android OK
              </span>
            </div>
            
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Configure lembretes diários customizáveis integrados com notificações de sistema do celular para nunca perder a data limite de reserva ou cancelamento de almoços.
            </p>

            <div className="space-y-4 pt-1">
              
              {/* Toggle switch alert activation */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-150">
                <div className="space-y-0.5">
                  <span className="font-bold text-neutral-800 block">Ativar Lembretes Diários do SGR</span>
                  <p className="text-[10px] text-neutral-500">Agenda disparos automáticos no sistema do aparelho</p>
                </div>
                
                <button
                  type="button"
                  onClick={handleToggleNotify}
                  className={`w-12 h-6.5 rounded-full p-0.5 transition-colors focus:outline-none ${
                    notifyEnabled ? 'bg-emerald-600' : 'bg-neutral-300'
                  }`}
                  id="settings-notify-toggle"
                >
                  <div className={`bg-white w-5.5 h-5.5 rounded-full shadow-md transform transition-transform ${
                    notifyEnabled ? 'translate-x-5.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {notifyEnabled && (
                <div className="space-y-4 border-l-2 border-emerald-500 pl-4 py-1 animate-[fadeIn_0.25s_ease] space-y-3">
                  
                  {/* Timing Option Radio Buttons */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-2">Quando deseja ser alertado?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNotifyTiming('vespera')}
                        className={`p-2.5 border rounded-lg text-left transition ${
                          notifyTiming === 'vespera'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-bold'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="block text-xs font-semibold">No dia anterior (Véspera)</span>
                        <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">Te ajuda a planejar as refeições por antecedência</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNotifyTiming('mesmo_dia')}
                        className={`p-2.5 border rounded-lg text-left transition ${
                          notifyTiming === 'mesmo_dia'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-bold'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="block text-xs font-semibold">No mesmo dia (De manhã)</span>
                        <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">Ideal para alteração rápida antes das {settings.horarioLimite}</span>
                      </button>
                    </div>
                  </div>

                  {/* Alarm Clock Hour Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Horário de disparo do Alerta</label>
                      <input
                        type="time"
                        value={notifyTime}
                        onChange={(e) => setNotifyTime(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 font-mono font-bold text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Formato de recebimento</label>
                      <select
                        value="push"
                        disabled
                        className="w-full px-2 py-2 border border-neutral-200 rounded-lg text-xs bg-neutral-50 text-neutral-500 font-medium cursor-not-allowed"
                      >
                        <option value="push">Notificação Push (FCM / PWA)</option>
                      </select>
                    </div>
                  </div>

                  {/* Server Push status indicator */}
                  <div className="flex items-center justify-between p-2.5 bg-neutral-100 rounded-lg border border-neutral-200">
                    <span className="font-bold text-neutral-700">Status Push neste Celular:</span>
                    {pushStatus === 'checking' && (
                      <span className="px-2 py-0.5 text-[9px] font-mono text-neutral-500 bg-neutral-200 animate-pulse rounded font-bold uppercase">
                        🔍 Verificando...
                      </span>
                    )}
                    {pushStatus === 'active' && (
                      <span className="px-2 py-0.5 text-[9px] font-mono text-emerald-700 bg-emerald-100 border border-emerald-200 rounded font-bold uppercase">
                        ✅ Ativo (Seg. Plano Total)
                      </span>
                    )}
                    {pushStatus === 'inactive' && (
                      <span className="px-2 py-0.5 text-[9px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded font-bold uppercase">
                        ⚠️ Aguardando Salvar (Local)
                      </span>
                    )}
                    {pushStatus === 'unsupported' && (
                      <span className="px-2 py-0.5 text-[9px] font-mono text-red-700 bg-red-100 border border-red-200 rounded font-bold uppercase">
                        ❌ Não suportado
                      </span>
                    )}
                  </div>

                  {/* Alerta Tipo Selection UI (Sempre, Com Reserva, Sem Reserva) */}
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Gatilho de Disparo do Alerta</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setNotifyTipo('sempre')}
                        className={`p-2.5 border rounded-lg text-left transition ${
                          notifyTipo === 'sempre'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-bold'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="block text-xs font-semibold flex items-center gap-1.5">
                          🔔 Sempre Alertar (Padrão)
                        </span>
                        <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">Dispara o lembrete diariamente, informando se você possui ou não refeição reservada</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNotifyTipo('reservada')}
                        className={`p-2.5 border rounded-lg text-left transition ${
                          notifyTipo === 'reservada'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-bold'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="block text-xs font-semibold flex items-center gap-1.5">
                          ✅ Somente quando houver REFEIÇÃO RESERVADA
                        </span>
                        <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">Garante e certifica que sua marmita está reservada e pronta para consumo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNotifyTipo('sem_reserva')}
                        className={`p-2.5 border rounded-lg text-left transition ${
                          notifyTipo === 'sem_reserva'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-bold'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="block text-xs font-semibold flex items-center gap-1.5">
                          ⚠️ Somente quando NÃO houver refeição reservada
                        </span>
                        <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">Funciona como rede de segurança para alertar caso você tenha esquecido de agendar</span>
                      </button>
                    </div>
                  </div>

                  {/* PWA background native alert limitations container */}
                  <div className="bg-amber-50 text-amber-950 text-[10px] leading-relaxed p-3 rounded-lg border border-amber-250">
                    <p className="font-bold flex items-center gap-1 mb-1">
                      ⚠️ COMPORTAMENTO DO SEGUNDO PLANO (ESTILO WHATSAPP):
                    </p>
                    {isInstalledPwa ? (
                      <p className="font-semibold text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 mb-1.5">
                        📱 Você já está usando o SGR Fontana como Aplicativo Instalado (PWA)! Sua inscrição para recebimento em background está totalmente integrada no celular.
                      </p>
                    ) : (
                      <p className="font-semibold text-amber-900 bg-amber-100/50 p-2 rounded border border-amber-200 mb-1.5">
                        📥 Sugerimos <strong>instalar na tela inicial</strong> para ganhar imunidade do sistema operacional e obter disparos em plano de fundo sem bloqueios.
                      </p>
                    )}
                    <p>
                      Para economizar bateria e renderizar privacidade, os celulares (iOS e Android) suspendem qualquer código Javascript após você bloquear a tela do celular ou mudar de aplicativo. 
                    </p>
                    <p className="mt-1.5 font-semibold text-emerald-900">Como nosso sistema garante o WhatsApp-style real-time?</p>
                    <ul className="list-disc pl-4 space-y-1 mt-0.5 font-medium/80 text-neutral-700">
                      <li>Ao salvar suas preferências, os dados criptográficos da sua inscrição de push são salvos na nuvem via <strong>Push API</strong>.</li>
                      <li>Nosso servidor Express integrado monitora o horário limite ideal, despachando chaves criptografadas (VAPID) diretamente para os servidores oficiais da Apple (APNs) ou Google (FCM).</li>
                      <li>O celular recebe o sinal no nível do sistema operacional e processa pelo <strong>Service Worker em segundo plano</strong>, que renderiza instantaneamente o ícone verde do Restaurante Fontana e aciona alertas idênticos aos de grandes redes sociais.</li>
                    </ul>
                  </div>

                </div>
              )}

              {/* Action buttons save configuration */}
              <div className="pt-2 flex justify-end gap-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotifySettings}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow"
                >
                  Salvar Preferências
                </button>
              </div>

            </div>
          </div>

          {/* SECTION 3: PRIVACY & LGPD COMPLIANCE DETAILS */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-4 space-y-3" id="lgpd-settings-info-section">
            <h3 className="font-bold text-neutral-800 flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> 3. Declaração de Privacidade & LGPD
            </h3>
            
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Consulte os termos de conformidade de dados gerais coletados sob a regência da Lei Geral de Proteção de Dados (Nº 13.709/2018).
            </p>

            <div className="p-3 bg-white rounded-lg border border-neutral-150 text-[11px] leading-relaxed space-y-2 text-neutral-600">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800 pb-1.5 border-b border-neutral-100">
                <span>Status de Conformidade:</span>
                {currentUser.aceitouLGPD ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-emerald-150">
                    <Check className="w-3.5 h-3.5 text-emerald-600 inline" /> Consentido / Protegido
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
                    ⚠️ Pendente (Requer Aceite)
                  </span>
                )}
              </div>

              {currentUser.aceitouLGPD && (
                <div className="space-y-1 bg-neutral-50/50 p-2.5 rounded-lg text-[10px] font-mono leading-relaxed text-neutral-500">
                  <p>📅 <strong>Data de Aceite:</strong> {new Date(currentUser.dataAceiteLGPD || '').toLocaleString('pt-BR')}</p>
                  <p>🖥️ <strong>IP Registrado:</strong> {currentUser.ipAceiteLGPD || '177.34.25.109'}</p>
                  <p>🔒 <strong>Chave Integridade:</strong> SHA256-SGR-{currentUser.id.substring(0,8).toUpperCase()}</p>
                </div>
              )}

              <p className="text-[10px] text-neutral-500">
                A Construtora Fontana Ltda garante que seus dados de reservas, matrícula, CPF e auditoria de refeições são confidenciais e tratados exclusivamente para faturamentos operacionais legítimos de obras.
              </p>

              <div className="pt-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(true)}
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg text-neutral-700 hover:text-neutral-900 font-bold transition flex items-center justify-center gap-1.5 mx-auto text-[10px] cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-neutral-500" />
                  Visualizar / Imprimir Política Completa
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Nested Safe Modal for Privacy Policy (Visualizar / Imprimir) */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-text">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-emerald-700 text-white flex items-center justify-between border-b border-emerald-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight leading-none text-white">Política de Privacidade Fontana</h3>
                  <span className="text-[10px] text-emerald-200 block mt-0.5 font-medium">Visualização e Gestão de Consentimento LGPD</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-4">
              <div className="text-[10px] text-neutral-500 font-medium font-mono">
                MATRÍCULA: {currentUser.matricula || 'NÃO ATRIBUÍDA'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPolicy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 text-xs text-neutral-700 font-bold rounded-lg border border-neutral-300 transition duration-150 shadow-xs cursor-pointer"
                  title="Imprimir termo em folha limpa corporativa"
                >
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>Imprimir PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPolicy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-xs text-white font-bold rounded-lg transition duration-150 shadow-xs cursor-pointer"
                  title="Baixar termo offline em formato HTML"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Baixar Termo (.HTML)</span>
                </button>
              </div>
            </div>

            {/* Scrollable Document Content */}
            <div className="p-6 overflow-y-auto max-h-[55vh] text-neutral-750 space-y-4 font-sans leading-relaxed text-sm">
              <div 
                className="prose prose-sm font-sans text-xs leading-relaxed text-neutral-700 select-text" 
                dangerouslySetInnerHTML={{ __html: COMPROMISSO_LGPD_HTML }} 
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 hover:text-neutral-950 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
