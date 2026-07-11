/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, XCircle, ShieldCheck, Smartphone, HelpCircle, Lock, ShieldAlert } from 'lucide-react';
import { Usuario } from '../types';

interface BiometriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  mode: 'register' | 'authenticate';
  userEmail?: string; // If authenticating or registering for specific user
  registeredEmails?: string[]; // If doing quick login from saved device accounts
  usuarios?: Usuario[]; // App database of accounts to match passwords securely
}

// Convert ArrayBuffer to Base64 string for localStorage persistence
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string back to ArrayBuffer for WebAuthn calls
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function BiometriaModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  userEmail = '',
  registeredEmails = [],
  usuarios = [],
}: BiometriaModalProps) {
  const [selectedEmail, setSelectedEmail] = useState<string>(userEmail);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error' | 'password-fallback'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fallbackPassword, setFallbackPassword] = useState('');
  const [isRealWebAuthnSupported, setIsRealWebAuthnSupported] = useState(false);

  const onSuccessRef = React.useRef(onSuccess);
  const onCloseRef = React.useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  useEffect(() => {
    // Detect core hardware capability
    if (window.PublicKeyCredential) {
      setIsRealWebAuthnSupported(true);
    }
  }, []);

  useEffect(() => {
    if (userEmail) {
      setSelectedEmail(userEmail);
    } else if (registeredEmails.length > 0) {
      setSelectedEmail(registeredEmails[0]);
    }
  }, [userEmail, registeredEmails]);

  // Handle immediate automatic trigger of biometric scanner in authenticate mode
  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      return;
    }

    if (mode === 'authenticate') {
      setStatus('scanning');
      setErrorMessage('');
      setFallbackPassword('');
      
      const timer = setTimeout(() => {
        handleStartBiometrics();
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setStatus('idle');
    }
  }, [isOpen, mode, selectedEmail]);

  if (!isOpen) return null;

  const handleStartBiometrics = async () => {
    const targetEmail = selectedEmail || userEmail || (registeredEmails.length > 0 ? registeredEmails[0] : '');
    if (!targetEmail.trim()) {
      setStatus('error');
      setErrorMessage('Por favor, selecione ou digite o e-mail cadastrado.');
      return;
    }
    // Se o app estiver rodando dentro do wrapper Android nativo (SGRNativeBridge),
    // o WebView nao suporta WebAuthn/FIDO2 - usamos o BiometricPrompt nativo do
    // Android (leitor de digital/rosto do sistema) em vez disso.
    const nativeBridge = (window as any).SGRNativeBridge;
    if (nativeBridge && typeof nativeBridge.isBiometricAvailable === 'function' && nativeBridge.isBiometricAvailable()) {
        const handleNativeResult = (e: any) => {
              window.removeEventListener('sgr-native-biometric-result', handleNativeResult);
              const detail = (e && e.detail) || {};
              if (detail.success) {
                      try {
                                localStorage.setItem(`sgr_credential_id_${targetEmail}`, 'native-android');
                      } catch (err) {}
                      setStatus('success');
                      setTimeout(() => {
                                onSuccessRef.current(targetEmail);
                                onCloseRef.current();
                                setStatus('idle');
                      }, 1250);
              } else {
                      setStatus('password-fallback');
                      setErrorMessage(detail.error || 'Nao foi possivel confirmar a biometria neste aparelho. Use sua senha.');
              }
        };
        window.addEventListener('sgr-native-biometric-result', handleNativeResult);
        nativeBridge.authenticateBiometric();
        return;
    }
    

    if (mode === 'authenticate') {
      const savedBase64Id = localStorage.getItem(`sgr_credential_id_${targetEmail}`);
      if (!savedBase64Id) {
        setStatus('password-fallback');
        setErrorMessage(`A biometria do seu celular está ativa globalmente, mas este site ainda não tem autorização para acessá-la. Para vincular sua digital com segurança a este endereço de internet (${window.location.hostname}), faça login com sua senha uma única vez e clique em "Ativar Biometria Celular" no menu do sistema.`);
        return;
      }
    }

    setStatus('scanning');
    setErrorMessage('');
    setFallbackPassword('');

    // Attempt actual platform level hardware biometric authenticator
    if (window.PublicKeyCredential) {
      try {
        if (mode === 'register') {
          const challenge = new Uint8Array(16);
          window.crypto.getRandomValues(challenge);
          
          const options: CredentialCreationOptions = {
            publicKey: {
              challenge,
              rp: { name: "SGR FONTANA" },
              user: {
                id: new TextEncoder().encode(targetEmail),
                name: targetEmail,
                displayName: targetEmail.split('@')[0],
              },
              pubKeyCredParams: [
                { alg: -7, type: "public-key" }, // ES256
                { alg: -257, type: "public-key" } // RS256
              ],
              timeout: 15000,
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required"
              }
            }
          };
          const credential = await navigator.credentials.create(options) as PublicKeyCredential;
          
          if (credential && credential.rawId) {
            const base64Id = bufferToBase64(credential.rawId);
            localStorage.setItem(`sgr_credential_id_${targetEmail}`, base64Id);
          }
          
          setStatus('success');
          setTimeout(() => {
            onSuccessRef.current(targetEmail);
            onCloseRef.current();
            setStatus('idle');
          }, 1250);
          return;

        } else {
          // MODE: authenticate
          const challenge = new Uint8Array(16);
          window.crypto.getRandomValues(challenge);
          
          const savedBase64Id = localStorage.getItem(`sgr_credential_id_${targetEmail}`);
          const allowCredentials = [];
          
          if (savedBase64Id) {
            try {
              const buffer = base64ToBuffer(savedBase64Id);
              allowCredentials.push({
                id: buffer,
                type: 'public-key' as const
              });
            } catch (e) {
              console.warn("Erro ao decodificar ID de credencial salva:", e);
            }
          }
          
          const options: CredentialRequestOptions = {
            publicKey: {
              challenge,
              timeout: 15000,
              userVerification: "required",
              allowCredentials
            }
          };
          
          await navigator.credentials.get(options);
          
          // Successful native biometric verification!
          setStatus('success');
          setTimeout(() => {
            onSuccessRef.current(targetEmail);
            onCloseRef.current();
            setStatus('idle');
          }, 1250);
          return;
        }

      } catch (err: any) {
        console.warn("Dispositivo ou Iframe impediu verificação biométrica em hardware:", err);
        
        // Show secure password fallback instead of allowing simulated bypass
        setStatus('password-fallback');
        
        let customMsg = 'O leitor biométrico nativo está ocupado, o login foi cancelado ou não há digital configurada no dispositivo.';
        if (err.name === 'NotAllowedError') {
          customMsg = 'A biometria foi cancelada pelo usuário ou está bloqueada pela política deste navegador.';
        } else if (err.name === 'SecurityError') {
          customMsg = 'Acesso biométrico restrito em ambientes incorporados (visualização sandbox). Use a senha cadastrada para autenticar.';
        }
        setErrorMessage(customMsg);
        return;
      }
    }

    // WebAuthn is completely unsupported in current browser
    setStatus('password-fallback');
    setErrorMessage('Seu navegador/aparelho atual não possui suporte nativo à biometria FIDO2/WebAuthn.');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fallbackPassword.trim()) {
      return;
    }

    const targetEmail = selectedEmail || userEmail || (registeredEmails.length > 0 ? registeredEmails[0] : '');
    const cleanRaw = targetEmail.toLowerCase().trim();
    const cleanNum = cleanRaw.replace(/\D/g, '');
    const matchedUser = usuarios.find(u => {
      if (cleanNum && u.cpf && u.cpf.replace(/\D/g, '') === cleanNum) return true;
      if (u.email && u.email.toLowerCase().trim() === cleanRaw) return true;
      return false;
    });
    
    if (!matchedUser) {
      alert("Usuário não cadastrado neste sistema.");
      return;
    }

    if (matchedUser.senha === fallbackPassword) {
      setStatus('success');
      setTimeout(() => {
        onSuccessRef.current(targetEmail);
        onCloseRef.current();
        setStatus('idle');
      }, 1250);
    } else {
      alert("Senha incorreta. Acesso Recusado.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/80 backdrop-blur-xs flex items-center justify-center p-4 antialiased" id="biometrics-modal-backdrop">
      
      <div className="bg-white rounded-2xl border border-neutral-250 shadow-2xl max-w-md w-full overflow-hidden animate-[fadeIn_0.2s_ease]" id="biometrics-modal-container">
        {/* Header decoration */}
        <div className="bg-neutral-900 text-white p-5 border-b border-neutral-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">Verificação Segura</h3>
              <p className="text-sm font-bold">Biometria SGR Fontana</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              setStatus('idle');
              onClose();
            }}
            className="text-neutral-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Modal content area */}
        <div className="p-6 space-y-6 text-center">
          
          {/* Instructions and account selection */}
          {status === 'idle' && (
            <div className="space-y-4 text-left">
              <div className="p-3 bg-neutral-50 border border-neutral-150 rounded-lg text-xs leading-normal text-neutral-600">
                <p className="font-bold text-neutral-800 mb-1">🤳 Proteção por Biometria Local:</p>
                Este recurso lê com segurança as chaves criptográficas de segurança (Touch ID, Face ID ou código de desbloqueio próprio de seu aparelho) gerenciadas pelo Android ou iOS. Seus dados biométricos nunca saem de seu smartphone.
              </div>

              {/* Account Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
                  Selecione seu e-mail cadastrado:
                </label>
                {registeredEmails.length > 0 && mode === 'authenticate' ? (
                  <select
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-800 focus:outline-none"
                    id="biometrics-email-select"
                  >
                    {registeredEmails.map(email => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="email"
                    placeholder="exemplo@fontana.com.br"
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 focus:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-800 font-mono focus:outline-none"
                    id="biometrics-email-input"
                  />
                )}
                <span className="text-[10px] text-neutral-400 font-medium block">
                  É obrigatório que você possua biometria ou senha em hardware ativa nas configurações gerais deste celular.
                </span>
              </div>
            </div>
          )}

          {/* Graphical Scanning State */}
          {status === 'scanning' && (
            <div className="flex flex-col items-center justify-center space-y-6 py-6" id="scanning-sensor-loading">
              <div className="relative flex items-center justify-center">
                {/* Visual scanner circular pulse */}
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-500/10 animate-ping" />
                <span className="absolute inline-flex h-16 w-16 rounded-full bg-emerald-500/20 animate-pulse" />
                
                {/* Visual biometric indicator */}
                <div className="relative bg-emerald-50 border-2 border-emerald-500 p-5 rounded-full text-emerald-600 shadow-sm animate-pulse">
                  <Fingerprint className="h-10 w-10" />
                </div>
              </div>

              <div className="space-y-2 text-center px-4">
                <p className="text-xs font-extrabold text-neutral-800 animate-pulse uppercase tracking-wide">
                  Aguardando sensor integrado...
                </p>
                <p className="text-[11px] text-neutral-500 leading-normal font-medium">
                  Verifique a tela ou o leitor físico de seu celular para concluir a leitura da sua impressão digital (Touch ID) ou Face ID.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStatus('password-fallback')}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-250 border border-neutral-200 text-neutral-600 text-[10px] font-bold rounded-lg transition-all"
                id="skip-to-password-fallback-btn"
              >
                🔑 Cancelar e entrar com senha
              </button>
            </div>
          )}

          {/* Secure PASSWORD FALLBACK (Triggered if real biometric verification is canceled, blocked or sandbox-restricted) */}
          {status === 'password-fallback' && (
            <div className="space-y-4 py-2 animate-[fadeIn_0.2s_ease]" id="password-validation-backup">
              <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left">
                <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Segurança Reforçada SGR</h4>
                  <p className="text-[10px] text-neutral-600 leading-normal">
                    {errorMessage || 'O sensor de biometria foi cancelado ou não está disponível atualmente neste aparelho.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left" id="fallback-password-auth-form">
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-neutral-400 capitalize">
                    E-mail selecionado:
                  </span>
                  <div className="px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-mono font-bold text-neutral-600">
                    {selectedEmail || userEmail || (registeredEmails.length > 0 ? registeredEmails[0] : 'Nenhum e-mail selecionado')}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
                    Digite a Senha da sua conta para liberar:
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="Senha do ecossistema SGR"
                      value={fallbackPassword}
                      onChange={(e) => setFallbackPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors font-mono"
                      id="fallback-pass-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition-colors flex items-center justify-center gap-2"
                  id="confirm-fallback-password-btn"
                >
                  Confirmar Senha & Entrar 🔒
                </button>
              </form>

               {isRealWebAuthnSupported && (
                <div className="pt-2 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const targetEmail = selectedEmail || userEmail || (registeredEmails.length > 0 ? registeredEmails[0] : '');
                      const savedBase64Id = localStorage.getItem(`sgr_credential_id_${targetEmail}`);
                      if (!savedBase64Id) {
                        alert(`🤳 Vínculo Biométrico Requerido nesta URL:\n\nComo o endereço deste site é '${window.location.hostname}', sua digital precisa ser associada uma única vez especificamente a este endereço.\n\nComo resolver em 2 passos:\n1. Digite sua senha padrão abaixo e faça login.\n2. No painel inicial, clique em "Ativar Biometria Celular" no menu do sistema.\n\nApós isso, você poderá acessar o SGR com apenas um toque em qualquer momento!`);
                      } else {
                        handleStartBiometrics();
                      }
                    }}
                    className="text-emerald-600 hover:text-emerald-700 font-extrabold flex items-center gap-1 mx-auto"
                  >
                    <Fingerprint className="h-4 w-4" /> Tentar biometria nativa novamente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-3 py-6 animate-[bounce_0.5s_ease_1]">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-full text-emerald-600">
                <CheckCircle2 className="h-10 w-10 animate-[bounce_1s_infinite]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-850 font-mono uppercase tracking-wider">Identidade Confirmada!</p>
                <p className="text-[11px] text-neutral-500 font-bold">Acesso autenticado e liberado com segurança local.</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center space-y-3 py-4">
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-full text-rose-600">
                <XCircle className="h-10 w-10 animate-bounce" />
              </div>
              <div className="space-y-1 bg-red-50 border border-red-100 p-3 rounded-lg text-xs text-red-700 font-semibold max-w-xs leading-normal">
                {errorMessage || 'Falha na validação biométrica do dispositivo.'}
              </div>
            </div>
          )}

          {/* Action Footer triggers */}
          <div className="flex flex-col gap-2.5 pt-4 border-t border-neutral-100">
            {status === 'idle' && (
              <button
                type="button"
                onClick={handleStartBiometrics}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                id="biometrics-btn-start"
              >
                <Fingerprint className="h-4 w-4" /> 
                {mode === 'register' ? 'Registrar meu Celular' : 'Validar minha Biometria'}
              </button>
            )}

            {status === 'error' && (
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="w-full py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold text-xs uppercase rounded-lg transition-colors"
                id="biometrics-btn-retry"
              >
                Tentar Novamente
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                onClose();
              }}
              className="py-1.5 text-neutral-500 hover:text-neutral-800 text-xs font-bold font-mono uppercase tracking-wider"
              id="biometrics-btn-cancel"
            >
              Cancelar & Voltar
            </button>
          </div>

        </div>

        {/* Security Policy assurance */}
        <div className="bg-neutral-50 px-5 py-3 border-t border-neutral-150 flex items-start gap-2 text-[10px] text-neutral-400 leading-normal">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Este terminal emite chaves exclusivas de hardware pelo padrão fido2 passkeys locais, garantindo total conformidade de guarda de identidades de acordo com a LGPD e a política SGR.</span>
        </div>
      </div>

    </div>
  );
}
