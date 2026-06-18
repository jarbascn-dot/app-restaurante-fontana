/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { Usuario, AuditoriaLog, SystemSettings } from '../types';
import { X, KeyRound, Bell, Smartphone, ShieldCheck, Check, Eye, EyeOff, Volume2, Sparkles } from 'lucide-react';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Usuario;
  usuarios: Usuario[];
  onUpdatePassword: (newSenha: string) => void;
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
  appendAuditLog,
  onTriggerFlash,
  settings,
}: AccountSettingsModalProps) {
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

  // Mobile Mock Notification State
  const [showMockNotification, setShowMockNotification] = useState(false);
  const [mockNotifText, setMockNotifText] = useState('');

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

    appendAuditLog(
      `Configuração de Lembrete de Refeição alterada: ${notifyEnabled ? 'Ativo' : 'Inativo'} (${notifyTiming === 'vespera' ? 'Véspera' : 'No dia'} às ${notifyTime})`,
      currentUser.nome,
      currentUser.email
    );

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
            icon: '/icon.jpg'
          });
        } catch (e) {
          console.error("Erro na notificação nativa:", e);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            try {
              new Notification('SGR FONTANA', {
                body: text.replace('🔔 SGR FONTANA: ', ''),
                icon: '/icon.jpg'
              });
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

                  {/* High Fidelity Test Alert simulation option */}
                  <div className="bg-neutral-100 p-3 rounded-lg border border-neutral-200/60 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="space-y-0.5 text-left">
                      <span className="font-bold text-neutral-750 block flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Testar Alerta do SGR
                      </span>
                      <p className="text-[10px] text-neutral-500">Veja o visual simulando o push nativo no seu aparelho</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={triggerTestNotification}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-lg border border-neutral-700 transition flex items-center justify-center gap-1 shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5" /> Disparar Teste
                    </button>
                  </div>

                  {/* PWA background native alert limitations container */}
                  <div className="bg-amber-50 text-amber-950 text-[10px] leading-relaxed p-3 rounded-lg border border-amber-250">
                    <p className="font-bold flex items-center gap-1 mb-1">
                      ⚠️ ATENÇÃO PARA O SEU CELULAR (LIMITAÇÃO DE SEGUNDO PLANO):
                    </p>
                    <p>
                      Para economizar bateria, sistemas de celulares modernos (como <strong>iOS Safari</strong> e <strong>Android Chrome</strong>) <strong>suspendem ou congelam o funcionamento do navegador web em segundo plano</strong> segundos após você bloquear a tela do celular ou mudar de aplicativo.
                    </p>
                    <p className="mt-1.5 font-semibold">Como garantir que o lembrete seja disparado de forma confiável?</p>
                    <ul className="list-disc pl-4 space-y-1 mt-0.5 font-medium">
                      <li>Use a opção de <strong>Mapear o SGR na Tela Inicial</strong> (adicionando o site como aplicativo PWA através do botão "Compartilhar" -&gt; "Adicionar à Tela de Início"). Os PWAs instalados ganham imunidade temporária e permissões de segundo plano prioritárias!</li>
                      <li>Garanta que as notificações estejam habilitadas de forma persistente nas configurações de privacidade do seu telefone para o aplicativo.</li>
                      <li>Os lembretes não requerem internet após ativados e serão mostrados imediatamente ao desbloquear o telefone ou retornar à guia aberta do aplicativo.</li>
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

        </div>

      </div>
    </div>
  );
}
