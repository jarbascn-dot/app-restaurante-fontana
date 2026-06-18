/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Usuario, SystemSettings } from '../types';
import { LogIn, KeyRound, Mail, AlertCircle, UserPlus, HelpCircle, Fingerprint, Smartphone, UtensilsCrossed } from 'lucide-react';
import BiometriaModal from './BiometriaModal';

interface LoginScreenProps {
  usuarios: Usuario[];
  settings: SystemSettings;
  onLoginSuccess: (user: Usuario) => void;
  onOpenRegister: () => void;
}

export default function LoginScreen({ usuarios, settings, onLoginSuccess, onOpenRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBiometriaModalOpen, setIsBiometriaModalOpen] = useState(false);
  const [savedBiometrics, setSavedBiometrics] = useState<string[]>([]);
  const [loginMethod, setLoginMethod] = useState<'biometrics' | 'password'>('password');

  // Update saved biometric accounts on mount and automatically select preferred view
  useEffect(() => {
    try {
      const emails = JSON.parse(localStorage.getItem('sgr_biometria_cadastrada_emails') || '[]');
      setSavedBiometrics(emails);
      if (emails.length > 0) {
        setLoginMethod('biometrics');
      }
    } catch {
      setSavedBiometrics([]);
    }
  }, []);

  const handleBiometricSuccess = (validatedEmail: string) => {
    setError(null);
    if (!validatedEmail) {
      setError('E-mail inválido recebido do leitor.');
      return;
    }

    const foundUser = usuarios.find(
      u => u.email.toLowerCase().trim() === validatedEmail.toLowerCase().trim()
    );

    if (!foundUser) {
      setError(`E-mail '${validatedEmail}' não encontrado como usuário ativo.`);
      return;
    }

    if (foundUser.status === 'desativado') {
      setError('Este cadastro foi desativado pelo RH. Entre em contato com a equipe administrativa.');
      return;
    }

    // Login success!
    onLoginSuccess(foundUser);
  };

  const startBiometricWithEmail = (targetEmail: string) => {
    setEmail(targetEmail);
    setError(null);
    setIsBiometriaModalOpen(true);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Por favor, informe o e-mail e a senha.');
      return;
    }

    // Try finding matching user
    const foundUser = usuarios.find(
      u => u.email.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!foundUser) {
      setError('E-mail não cadastrado no sistema.');
      return;
    }

    // Since the system defaults to password '1234@' for jarbas or whatever password they defined during registration
    const correctPassword = foundUser.senha || '1234@';

    if (password !== correctPassword) {
      setError('Senha incorreta.');
      return;
    }

    if (foundUser.status === 'desativado') {
      setError('Este cadastro foi desativado pelo RH. Entre em contato com a equipe administrativa.');
      return;
    }

    // Login success!
    onLoginSuccess(foundUser);
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white" id="login-screen-view">
      
      {/* Container Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-xl overflow-hidden animate-[fadeIn_0.4s_ease]" id="login-card">
        
        {/* Branding header */}
        <div className="bg-neutral-900 px-6 py-8 text-center text-white relative">
          <div className="inline-flex bg-emerald-600 text-white p-4 rounded-2xl shadow-lg mb-3 items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">APP Restaurante</h2>
          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider font-mono">FONTANA</p>
        </div>

        {/* Login Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
              {loginMethod === 'biometrics' ? 'Acesso Biométrico Rápido' : 'Identificação do Colaborador'}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {loginMethod === 'biometrics' 
                ? 'Toque na sua conta abaixo para acionar a biometria de seu aparelho celular' 
                : 'Informe suas credenciais para reservar refeições'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 animate-[shake_0.2s_ease]" id="login-error-banner">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* BIOMETRICS DIRECT INSTANT VIEW */}
          {loginMethod === 'biometrics' && savedBiometrics.length > 0 ? (
            <div className="space-y-4" id="direct-biometric-picker-view">
              <div className="space-y-2.5">
                {savedBiometrics.map(savedEmail => {
                  const matchedUser = usuarios.find(u => u.email.toLowerCase() === savedEmail.toLowerCase());
                  const displayName = matchedUser ? matchedUser.nome : savedEmail.split('@')[0];
                  
                  return (
                    <button
                      key={savedEmail}
                      type="button"
                      onClick={() => startBiometricWithEmail(savedEmail)}
                      className="w-full flex items-center gap-3.5 p-4 bg-neutral-50 hover:bg-emerald-50/50 hover:border-emerald-300 rounded-xl border border-neutral-200 text-left transition-all active:scale-[0.98] group relative overflow-hidden shadow-xs"
                    >
                      <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                        <Fingerprint className="h-5 w-5 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-neutral-800 truncate">{displayName}</h4>
                        <p className="text-[10px] font-mono text-neutral-400 truncate mt-0.5">{savedEmail}</p>
                      </div>
                      <div className="shrink-0 bg-emerald-600/10 text-emerald-700 font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                        Toque 🤳
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setLoginMethod('password')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                  id="switch-to-password-btn"
                >
                  Entrar com e-mail e senha convencional
                </button>
              </div>
            </div>
          ) : (
            /* PASSWORD VIEW */
            <form onSubmit={handleLoginSubmit} className="space-y-4" id="login-form">
              {/* Email field */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide mb-1">E-mail Corporativo ou Pessoal</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="Seu e-mail cadastrado"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    id="login-email-input"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">Senha de Entrada</label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors font-mono"
                    id="login-password-input"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2 mt-2"
                id="submit-login-btn"
              >
                <LogIn className="h-4 w-4" /> Acessar com Senha
              </button>

              {savedBiometrics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLoginMethod('biometrics')}
                  className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  id="back-to-biometrics-btn"
                >
                  <Fingerprint className="h-4 w-4 text-emerald-600 animate-pulse" /> Voltar ao Acesso por Biometria
                </button>
              )}
            </form>
          )}

            {/* Quick instructions / actions */}
            <div className="pt-2 border-t border-neutral-150 flex flex-col gap-3">
              <button
                onClick={onOpenRegister}
                className="w-full py-2 px-4 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                id="login-register-link"
              >
                <UserPlus className="h-3.5 w-3.5 text-neutral-500" /> Solicitar Novo Acesso (Cadastro)
              </button>
            </div>

        </div>

      </div>

      <div className="text-center mt-6 text-[10px] text-neutral-400 font-mono">
        APP Restaurante - FONTANA © 2026. Todos os direitos reservados.
      </div>

      <BiometriaModal
        isOpen={isBiometriaModalOpen}
        onClose={() => setIsBiometriaModalOpen(false)}
        onSuccess={handleBiometricSuccess}
        mode="authenticate"
        userEmail={email}
        registeredEmails={savedBiometrics}
        usuarios={usuarios}
      />
    </div>
  );
}
